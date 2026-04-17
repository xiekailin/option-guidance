import {
  calculateDeltaFitScore,
  clamp,
  getMinContractSizeBtc,
  roundTo,
} from "./calculations";
import type {
  ExpiryPayoff,
  ExpiryPayoffScenario,
  LongCallRecommendation,
  LongCallScoreBreakdownItem,
  OptionContract,
  RecommendationInput,
  RecommendationLevel,
  RecommendationScenario,
  RecommendationTone,
} from "../types/option";

const MIN_DAYS = 30;
const MAX_DAYS = 90;
const MAX_LONG_CALL_RECOMMENDATIONS = 10;

export function buildLongCallRecommendations(
  options: OptionContract[],
  input: RecommendationInput,
): LongCallRecommendation[] {
  const minContractSize = getMinContractSizeBtc();
  const targetDelta = getLongCallDeltaRange(input.riskTolerance);
  const targetPremiumRatio = getTargetPremiumRatio(input.riskTolerance);

  return options
    .filter((option) => isEligibleLongCall(option, input))
    .map((option) => {
      const absDelta = Math.abs(option.delta ?? 0);
      const premiumPerMinContractUsd =
        option.premiumUsdPerBtc != null ? roundTo(option.premiumUsdPerBtc * minContractSize, 2) : null;
      const premiumPerMinContractBtc = roundTo((option.markPrice ?? 0) * minContractSize, 5);
      const maxLots = premiumPerMinContractUsd && premiumPerMinContractUsd > 0
        ? Math.floor(input.availableCashUsd / premiumPerMinContractUsd)
        : 0;
      const durationFit = getDurationFitScore(option.daysToExpiry);
      const deltaFit = calculateDeltaFitScore(absDelta, targetDelta.target, targetDelta.min, targetDelta.max);
      const affordability = premiumPerMinContractUsd == null || input.availableCashUsd <= 0
        ? 0
        : getAffordabilityScore(premiumPerMinContractUsd / input.availableCashUsd, targetPremiumRatio);
      const liquidity = clamp(Math.log10(option.openInterest + option.volume + 1) / 3, 0, 1);
      const ivCost = getIvCostScore(option.markIv);
      const moneyness = getMoneynessScore(option.otmPercent ?? null);

      const scoreBreakdown = buildScoreBreakdown({
        option,
        deltaFit,
        durationFit,
        affordability,
        liquidity,
        ivCost,
        moneyness,
        premiumPerMinContractUsd,
        input,
      });
      const score = roundTo(scoreBreakdown.reduce((total, item) => total + item.contribution, 0), 1);
      const breakEvenPrice = option.premiumUsdPerBtc != null
        ? roundTo(option.strike + option.premiumUsdPerBtc, 0)
        : null;
      const maxLossUsd = premiumPerMinContractUsd;

      return {
        contract: option,
        strategy: "long-call",
        score,
        level: getRecommendationLevel(score),
        tone: getLongCallTone(absDelta),
        maxLots,
        maxTradeAmountBtc: roundTo(maxLots * minContractSize, 3),
        premiumPerMinContractBtc,
        premiumPerMinContractUsd,
        maxLossUsd,
        breakEvenPrice,
        summary: buildSummary(option, breakEvenPrice, input),
        algorithmTags: buildAlgorithmTags(option, premiumPerMinContractUsd),
        reasons: buildReasons(option, breakEvenPrice, premiumPerMinContractUsd, input),
        risks: buildRisks(option, premiumPerMinContractUsd),
        scoreBreakdown,
        scenarios: buildScenarios(option, breakEvenPrice, premiumPerMinContractUsd),
        unsuitableScenarios: buildUnsuitableScenarios(option, premiumPerMinContractUsd),
        expiryPayoff: buildExpiryPayoff(option, premiumPerMinContractUsd, minContractSize),
      } satisfies LongCallRecommendation;
    })
    .filter((item) => item.maxLots > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_LONG_CALL_RECOMMENDATIONS);
}

export function getLongCallMethodology(
  input: Pick<RecommendationInput, "riskTolerance" | "availableCashUsd">,
) {
  const deltaRange = getLongCallDeltaRange(input.riskTolerance);

  return {
    filters: [
      {
        label: "策略方向",
        description: "只保留 BTC 看涨期权，不混入卖方收租或合成仓位。",
      },
      {
        label: "长周期窗口",
        description: `固定筛选 ${MIN_DAYS} - ${MAX_DAYS} 天到期的合约，用相对长周期表达中期看涨观点。`,
      },
      {
        label: "现金约束",
        description: `单张 0.1 BTC 的权利金不能超过你的可用现金 $${Math.round(input.availableCashUsd).toLocaleString()}。`,
      },
      {
        label: "风险偏好对应的 Delta",
        description: `当前风险偏好要求 Delta 绝对值优先落在 ${roundTo(deltaRange.min * 100, 0)}% - ${roundTo(deltaRange.max * 100, 0)}%，目标点约 ${roundTo(deltaRange.target * 100, 0)}%。`,
      },
      {
        label: "执行价不过分激进",
        description: "优先 ATM 到轻度 OTM 的 Call，避免太深 ITM 的高成本替代现货，也避免太远 OTM 的彩票仓。",
      },
    ],
    scoring: [
      { label: "Delta 匹配", weightPercent: 24, description: "杠杆程度是否符合你的风险偏好。" },
      { label: "期限匹配", weightPercent: 20, description: "越接近 30-90 天窗口中部，越像中期看涨布局。" },
      { label: "成本占比", weightPercent: 18, description: "单张权利金占可用现金的比例是否合理。" },
      { label: "流动性", weightPercent: 14, description: "综合 OI 和成交量，避免纸面上便宜但不好成交。" },
      { label: "隐波成本", weightPercent: 14, description: "IV 越不极端，越不容易出现“方向看对但买太贵”的情况。" },
      { label: "执行价平衡", weightPercent: 10, description: "兼顾兑现概率和上涨弹性。" },
    ],
    notes: [
      "这不是收租策略，最大亏损是买入权利金，最坏情况可以亏掉 100% 权利金。",
      "30-90 天只是 BTC 市场里的相对长周期，不等于美股 LEAPS 的超长期限。",
      "首版只做选仓与解释，不做自动滚动续仓；临近到期时你仍需自己决定平仓、展期或放弃。",
    ],
  };
}

function isEligibleLongCall(option: OptionContract, input: RecommendationInput): boolean {
  if (
    option.optionType !== "call" ||
    option.markPrice == null ||
    option.delta == null ||
    option.underlyingPrice == null ||
    option.premiumUsdPerBtc == null ||
    option.markIv == null
  ) {
    return false;
  }

  if (option.daysToExpiry < MIN_DAYS || option.daysToExpiry > MAX_DAYS) {
    return false;
  }

  const premiumPerMinContractUsd = option.premiumUsdPerBtc * getMinContractSizeBtc();
  if (premiumPerMinContractUsd > input.availableCashUsd) {
    return false;
  }

  const deltaRange = getLongCallDeltaRange(input.riskTolerance);
  const absDelta = Math.abs(option.delta);
  if (absDelta < deltaRange.min || absDelta > deltaRange.max) {
    return false;
  }

  return isMoneynessEligible(option.otmPercent ?? null);
}

function getLongCallDeltaRange(riskTolerance: RecommendationInput["riskTolerance"]) {
  switch (riskTolerance) {
    case "conservative":
      return { min: 0.45, max: 0.7, target: 0.58 };
    case "aggressive":
      return { min: 0.22, max: 0.45, target: 0.32 };
    case "balanced":
    default:
      return { min: 0.32, max: 0.58, target: 0.45 };
  }
}

function getTargetPremiumRatio(riskTolerance: RecommendationInput["riskTolerance"]): number {
  switch (riskTolerance) {
    case "conservative":
      return 0.14;
    case "aggressive":
      return 0.07;
    case "balanced":
    default:
      return 0.1;
  }
}

function getDurationFitScore(daysToExpiry: number): number {
  if (daysToExpiry < MIN_DAYS || daysToExpiry > MAX_DAYS) {
    return 0;
  }

  const midpoint = (MIN_DAYS + MAX_DAYS) / 2;
  const halfSpan = (MAX_DAYS - MIN_DAYS) / 2;
  return clamp(1 - Math.abs(daysToExpiry - midpoint) / halfSpan, 0, 1);
}

function getAffordabilityScore(ratio: number, targetRatio: number): number {
  if (ratio <= 0) {
    return 0;
  }

  const distance = Math.abs(ratio - targetRatio);
  return clamp(1 - distance / Math.max(targetRatio, 0.04), 0, 1);
}

function getIvCostScore(markIv: number | null): number {
  if (markIv == null) {
    return 0;
  }

  if (markIv <= 45) {
    return 1;
  }

  if (markIv >= 95) {
    return 0;
  }

  return clamp(1 - (markIv - 45) / 50, 0, 1);
}

function isMoneynessEligible(otmPercent: number | null): boolean {
  if (otmPercent == null) {
    return false;
  }

  return otmPercent >= -6 && otmPercent <= 12;
}

function getMoneynessScore(otmPercent: number | null): number {
  if (otmPercent == null || !isMoneynessEligible(otmPercent)) {
    return 0;
  }

  const target = 3;
  const maxDistance = 9;
  return clamp(1 - Math.abs(otmPercent - target) / maxDistance, 0, 1);
}

function buildScoreBreakdown({
  option,
  deltaFit,
  durationFit,
  affordability,
  liquidity,
  ivCost,
  moneyness,
  premiumPerMinContractUsd,
  input,
}: {
  option: OptionContract;
  deltaFit: number;
  durationFit: number;
  affordability: number;
  liquidity: number;
  ivCost: number;
  moneyness: number;
  premiumPerMinContractUsd: number | null;
  input: Pick<RecommendationInput, "riskTolerance" | "availableCashUsd">;
}): LongCallScoreBreakdownItem[] {
  return [
    {
      key: "delta-fit",
      label: "Delta 匹配",
      scorePercent: roundTo(deltaFit * 100, 0),
      weightPercent: 24,
      contribution: roundTo(deltaFit * 24, 1),
      explanation: `当前 ${riskLabel(input.riskTolerance)} 更适合 Delta ${Math.abs(option.delta ?? 0).toFixed(2)} 这种上涨弹性。`,
    },
    {
      key: "duration-fit",
      label: "期限匹配",
      scorePercent: roundTo(durationFit * 100, 0),
      weightPercent: 20,
      contribution: roundTo(durationFit * 20, 1),
      explanation: `剩余 ${option.daysToExpiry} 天，越接近 30-90 天窗口中部，越符合这次“佩洛西打法”的定义。`,
    },
    {
      key: "affordability",
      label: "成本占比",
      scorePercent: roundTo(affordability * 100, 0),
      weightPercent: 18,
      contribution: roundTo(affordability * 18, 1),
      explanation: premiumPerMinContractUsd == null
        ? "当前拿不到完整美元权利金，成本占比得分偏保守。"
        : `单张约 $${premiumPerMinContractUsd.toLocaleString()}，相对你的可用现金 $${Math.round(input.availableCashUsd).toLocaleString()} 属于可承受范围。`,
    },
    {
      key: "liquidity",
      label: "流动性",
      scorePercent: roundTo(liquidity * 100, 0),
      weightPercent: 14,
      contribution: roundTo(liquidity * 14, 1),
      explanation: `OI ${option.openInterest}、成交量 ${option.volume}，流动性越好越容易进出。`,
    },
    {
      key: "iv-cost",
      label: "隐波成本",
      scorePercent: roundTo(ivCost * 100, 0),
      weightPercent: 14,
      contribution: roundTo(ivCost * 14, 1),
      explanation: `当前标记 IV ${option.markIv}% ，IV 越高，你越有可能在“方向没错但买贵了”的位置入场。`,
    },
    {
      key: "moneyness",
      label: "执行价平衡",
      scorePercent: roundTo(moneyness * 100, 0),
      weightPercent: 10,
      contribution: roundTo(moneyness * 10, 1),
      explanation: `执行价相对现价 ${option.otmPercent}% ，模型更偏好 ATM 到轻度 OTM。`,
    },
  ];
}

function buildSummary(
  option: OptionContract,
  breakEvenPrice: number | null,
  input: Pick<RecommendationInput, "riskTolerance">,
): string {
  return `这张 ${option.daysToExpiry} 天后的 BTC Call 更像中期看涨表达：最大亏损锁定在权利金，执行价 ${option.strike.toLocaleString()}，适合 ${riskLabel(input.riskTolerance)} 用有限亏损换上涨弹性${breakEvenPrice != null ? `，到期盈亏平衡约 $${breakEvenPrice.toLocaleString()}` : ""}。`;
}

function buildAlgorithmTags(option: OptionContract, premiumPerMinContractUsd: number | null): string[] {
  return [
    `${option.daysToExpiry}天到期`,
    `Delta ${Math.abs(option.delta ?? 0).toFixed(2)}`,
    `执行价 $${option.strike.toLocaleString()}`,
    `权利金 ${premiumPerMinContractUsd != null ? `$${premiumPerMinContractUsd.toLocaleString()}` : "--"}`,
    `IV ${option.markIv ?? "--"}%`,
  ];
}

function buildReasons(
  option: OptionContract,
  breakEvenPrice: number | null,
  premiumPerMinContractUsd: number | null,
  input: Pick<RecommendationInput, "riskTolerance">,
): string[] {
  return [
    `剩余 ${option.daysToExpiry} 天，落在这次定义的 30-90 天长周期窗口内。`,
    `Delta 约 ${Math.abs(option.delta ?? 0).toFixed(2)}，更符合 ${riskLabel(input.riskTolerance)} 对上涨弹性和兑现概率的平衡。`,
    premiumPerMinContractUsd != null
      ? `每张 0.1 BTC 的权利金约 $${premiumPerMinContractUsd.toLocaleString()}，亏损上限清晰。`
      : "当前美元权利金暂不可得，但可继续参考 Delta、期限和 IV 结构。",
    breakEvenPrice != null
      ? `到期盈亏平衡约 $${breakEvenPrice.toLocaleString()}，有利于快速判断“涨多少才值回票价”。`
      : "当前缺少完整价格，暂时无法精确给出盈亏平衡价。",
  ];
}

function buildRisks(option: OptionContract, premiumPerMinContractUsd: number | null): string[] {
  return [
    premiumPerMinContractUsd != null
      ? `最坏情况是这张 Call 到期归零，你会亏掉全部权利金约 $${premiumPerMinContractUsd.toLocaleString()}。`
      : "最坏情况是这张 Call 到期归零，你会亏掉全部权利金。",
    "方向看对不代表能赚钱：如果上涨来得太慢，时间价值衰减也会吞掉大部分收益。",
    `如果买入时 IV 已经很高（当前约 ${option.markIv ?? "--"}%），后续 IV 回落会压缩期权价格。`,
  ];
}

function buildScenarios(
  option: OptionContract,
  breakEvenPrice: number | null,
  premiumPerMinContractUsd: number | null,
): RecommendationScenario[] {
  return [
    {
      title: "上涨快、提前到位",
      description: `如果 BTC 在到期前快速逼近或突破 $${option.strike.toLocaleString()}，这类长 Call 往往能更快体现上涨弹性。`,
    },
    {
      title: "震荡或慢涨",
      description: breakEvenPrice != null
        ? `如果 BTC 到期前一直没能有效站上 $${breakEvenPrice.toLocaleString()}，你可能方向没错但仍赚不到钱。`
        : "如果 BTC 到期前涨得不够快，这张期权也可能因为时间价值衰减而表现平平。",
    },
    {
      title: "高波动后回落",
      description: premiumPerMinContractUsd != null
        ? `即便 BTC 没大跌，IV 回落也可能让你持仓先缩水，这张票不是付了 $${premiumPerMinContractUsd.toLocaleString()} 就一定能等来机会。`
        : "即便 BTC 没大跌，IV 回落也可能让你持仓先缩水。",
    },
  ];
}

function buildUnsuitableScenarios(option: OptionContract, premiumPerMinContractUsd: number | null): string[] {
  return [
    "如果你要的是稳定收租，这个策略不适合你。",
    premiumPerMinContractUsd != null
      ? `如果你不能接受单张先亏掉约 $${premiumPerMinContractUsd.toLocaleString()} 的权利金，这个策略不适合你。`
      : "如果你不能接受期权可能直接归零，这个策略不适合你。",
    `如果你更倾向于赚时间价值而不是赌 BTC 在 ${option.daysToExpiry} 天内出现趋势上涨，这个策略不适合你。`,
  ];
}

function buildExpiryPayoff(
  option: OptionContract,
  premiumPerMinContractUsd: number | null,
  minContractSize: number,
): ExpiryPayoff {
  const premiumPerBtc = option.premiumUsdPerBtc;
  if (premiumPerMinContractUsd == null || premiumPerBtc == null) {
    return { premiumPerContractUsd: premiumPerMinContractUsd, breakEvenPrice: null, estimatedMonthlyUsd: null, estimatedAnnualUsd: null, scenarios: [] };
  }

  const breakEven = roundTo(option.strike + premiumPerBtc, 0);
  const itmPrice = roundTo(option.strike * 1.12, 0);
  const nearBreakEvenPrice = roundTo(breakEven, 0);
  const intrinsicAtItm = Math.max(itmPrice - option.strike, 0) * minContractSize;
  const intrinsicAtBreakEven = Math.max(nearBreakEvenPrice - option.strike, 0) * minContractSize;

  const scenarios: ExpiryPayoffScenario[] = [
    {
      title: "到期低于执行价",
      description: "期权到期归零，最大亏损就是你付出的全部权利金。",
      amountUsd: premiumPerMinContractUsd != null ? -premiumPerMinContractUsd : null,
    },
    {
      title: "刚好到盈亏平衡",
      description: `BTC 到期约在 $${breakEven.toLocaleString()}，内在价值刚好覆盖权利金。`,
      amountUsd: premiumPerMinContractUsd != null ? roundTo(intrinsicAtBreakEven - premiumPerMinContractUsd, 2) : 0,
    },
    {
      title: "突破执行价并继续上涨",
      description: `如果 BTC 到期涨到约 $${itmPrice.toLocaleString()}，这张 Call 的上涨弹性会开始体现。`,
      amountUsd: premiumPerMinContractUsd != null ? roundTo(intrinsicAtItm - premiumPerMinContractUsd, 2) : null,
    },
  ];

  return {
    premiumPerContractUsd: premiumPerMinContractUsd,
    breakEvenPrice: breakEven,
    estimatedMonthlyUsd: null,
    estimatedAnnualUsd: null,
    scenarios,
  };
}

function getRecommendationLevel(score: number): RecommendationLevel {
  if (score >= 76) {
    return "优先考虑";
  }

  if (score >= 58) {
    return "可接受";
  }

  return "谨慎考虑";
}

function getLongCallTone(absDelta: number): RecommendationTone {
  if (absDelta >= 0.55) {
    return "safe";
  }

  if (absDelta >= 0.38) {
    return "balanced";
  }

  return "aggressive";
}

function riskLabel(riskTolerance: RecommendationInput["riskTolerance"]): string {
  switch (riskTolerance) {
    case "conservative":
      return "保守型";
    case "aggressive":
      return "进取型";
    case "balanced":
    default:
      return "平衡型";
  }
}
