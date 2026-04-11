import {
  calculateCycleFitScore,
  calculateDeltaFitScore,
  clamp,
  getMinContractSizeBtc,
  getTargetDeltaRange,
  roundTo,
} from "./calculations";
import type {
  ExpiryPayoff,
  ExpiryPayoffScenario,
  OptionContract,
  RecommendationInput,
  RecommendationLevel,
  RecommendationTone,
  SyntheticLongPair,
  SyntheticLongRecommendation,
} from "../types/option";

const MAX_SYNTHETIC_RECOMMENDATIONS = 8;

export function buildSyntheticLongRecommendations(
  options: OptionContract[],
  input: RecommendationInput,
): SyntheticLongRecommendation[] {
  const calls = options.filter((option) => isSyntheticLegEligible(option, input, "call"));
  const puts = options.filter((option) => isSyntheticLegEligible(option, input, "put"));
  const pairs: SyntheticLongPair[] = [];

  for (const call of calls) {
    for (const put of puts) {
      if (call.expirationCode !== put.expirationCode) {
        continue;
      }

      const underlyingPrice = call.underlyingPrice ?? put.underlyingPrice;
      const strikeGapPercent = underlyingPrice != null && underlyingPrice > 0
        ? Math.abs(call.strike - put.strike) / underlyingPrice
        : Math.abs(call.strike - put.strike) / Math.max(call.strike, put.strike);
      if (strikeGapPercent > 0.03) {
        continue;
      }

      const callPremium = call.premiumUsdPerBtc;
      const putPremium = put.premiumUsdPerBtc;
      const minContractSize = getMinContractSizeBtc();
      const netPremiumUsdPerMinContract =
        callPremium != null && putPremium != null ? roundTo((putPremium - callPremium) * minContractSize, 2) : null;
      const premiumBalanceUsd =
        callPremium != null && putPremium != null ? roundTo(Math.abs(putPremium - callPremium) * minContractSize, 2) : null;
      const downsideObligationUsd = roundTo(put.strike * minContractSize, 2);

      pairs.push({
        expirationCode: call.expirationCode,
        expiration: call.expiration,
        expirationTimestamp: call.expirationTimestamp,
        daysToExpiry: call.daysToExpiry,
        underlyingPrice,
        call,
        put,
        netPremiumUsdPerMinContract,
        premiumBalanceUsd,
        downsideObligationUsd,
      });
    }
  }

  const deltaRange = getTargetDeltaRange(input.riskTolerance);
  const targetBalanceUsd = getTargetPremiumBalanceUsd(input);

  return pairs
    .map((pair) => {
      const callDelta = Math.abs(pair.call.delta ?? 0);
      const putDelta = Math.abs(pair.put.delta ?? 0);
      const callDeltaFit = calculateDeltaFitScore(callDelta, deltaRange.target, deltaRange.min, deltaRange.max);
      const putDeltaFit = calculateDeltaFitScore(putDelta, deltaRange.target, deltaRange.min, deltaRange.max);
      const deltaFit = roundTo((callDeltaFit + putDeltaFit) / 2, 4);
      const cycleFit = calculateCycleFitScore(pair.daysToExpiry, input.cycle);
      const premiumBalanceScore =
        pair.premiumBalanceUsd == null
          ? 0
          : clamp(1 - pair.premiumBalanceUsd / targetBalanceUsd, 0, 1);
      const callLeverageScore = clamp((pair.call.otmPercent ?? 0) / 8, 0, 1);
      const putBufferScore = clamp((pair.put.otmPercent ?? 0) / 8, 0, 1);
      const downsideScore = roundTo((callLeverageScore + putBufferScore) / 2, 4);
      const totalLiquidity = Math.max(pair.call.openInterest, 0) + Math.max(pair.put.openInterest, 0)
        + Math.max(pair.call.volume, 0) + Math.max(pair.put.volume, 0);
      const liquidityScore = clamp(Math.log10(totalLiquidity + 1), 0, 1);

      const score = roundTo(
        (deltaFit * 0.3 + cycleFit * 0.18 + premiumBalanceScore * 0.24 + downsideScore * 0.18 + liquidityScore * 0.1) * 100,
        1,
      );

      const maxLots = pair.put.strike > 0 ? Math.floor(input.availableCashUsd / (pair.put.strike * getMinContractSizeBtc())) : 0;

      return {
        pair,
        score,
        level: getSyntheticLevel(score),
        tone: getSyntheticTone((callDelta + putDelta) / 2),
        maxLots,
        maxTradeAmountBtc: roundTo(maxLots * getMinContractSizeBtc(), 3),
        summary: buildSyntheticSummary(pair),
        reasons: buildSyntheticReasons(pair, input),
        risks: buildSyntheticRisks(pair),
        algorithmTags: buildSyntheticTags(pair),
        unsuitableScenarios: buildSyntheticUnsuitableScenarios(pair),
        expiryPayoff: buildSyntheticExpiryPayoff(pair, getMinContractSizeBtc()),
      } satisfies SyntheticLongRecommendation;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_SYNTHETIC_RECOMMENDATIONS);
}

export function getSyntheticLongMethodology(
  input: Pick<RecommendationInput, "cycle" | "riskTolerance">,
) {
  const deltaRange = getTargetDeltaRange(input.riskTolerance);

  return {
    filters: [
      {
        label: "合约方向",
        description: "只组合买看涨 + 卖看跌，不和现有收租策略混在一起。",
      },
      {
        label: "到期一致",
        description: "看涨与看跌必须同到期，避免把不同剩余时间的价值硬拼成一组。",
      },
      {
        label: "执行价接近",
        description: "两个合约执行价差控制在约 3% 内，尽量接近模拟持有 BTC 而不是变成杂糅组合。",
      },
      {
        label: "触发概率窗口",
        description: `看涨和看跌的触发概率绝对值都优先落在 ${roundTo(deltaRange.min * 100, 0)}% - ${roundTo(deltaRange.max * 100, 0)}%。`,
      },
      {
        label: "周期匹配",
        description: `继续沿用${input.cycle === "weekly" ? "周度" : "月度"}窗口，避免期限失控。`,
      },
    ],
    scoring: [
      { label: "触发概率对称度", weightPercent: 30, description: "看涨 / 看跌的触发概率越接近目标区间，方向风险越干净。" },
      { label: "周期匹配", weightPercent: 18, description: "离你想做的周度/月度节奏越近越好。" },
      { label: "净权利金接近 0", weightPercent: 24, description: "优先卖看跌收到的权利金尽量覆盖买看涨成本。" },
      { label: "两个合约缓冲", weightPercent: 18, description: "既看看涨的上方杠杆空间，也看看跌的下方跌价保护空间。" },
      { label: "市场买卖活跃度", weightPercent: 10, description: "两个合约都要有足够市场买卖活跃度，避免纸面组合无法成交。" },
    ],
    notes: [
      "净权利金接近 0 只是入场成本接近 0，不代表无风险。",
      "这类组合本质是强烈看涨的组合，暴跌时的风险主要来自卖看跌。",
      "如果 BTC 暴跌，亏损会远大于单纯买看涨，并可能带来追加押金压力。",
    ],
  };
}

function isSyntheticLegEligible(
  option: OptionContract,
  input: RecommendationInput,
  optionType: OptionContract["optionType"],
): boolean {
  if (
    option.optionType !== optionType ||
    option.markPrice == null ||
    option.delta == null ||
    option.otmPercent == null ||
    option.annualizedYieldPercent == null
  ) {
    return false;
  }

  const absDelta = Math.abs(option.delta);
  const deltaRange = getTargetDeltaRange(input.riskTolerance);
  if (absDelta < deltaRange.min || absDelta > deltaRange.max) {
    return false;
  }

  if (calculateCycleFitScore(option.daysToExpiry, input.cycle) <= 0) {
    return false;
  }

  // 合成多头的两条腿都要求 OTM：call 的 strike 在上方，put 的 strike 在下方
  return option.otmPercent > 0;
}

function getTargetPremiumBalanceUsd(input: Pick<RecommendationInput, "riskTolerance">): number {
  switch (input.riskTolerance) {
    case "conservative":
      return 80;
    case "aggressive":
      return 180;
    case "balanced":
    default:
      return 120;
  }
}

function buildSyntheticSummary(pair: SyntheticLongPair): string {
  const balanceText =
    pair.netPremiumUsdPerMinContract == null
      ? "净权利金暂不可得"
      : pair.netPremiumUsdPerMinContract >= 0
        ? `净收 $${pair.netPremiumUsdPerMinContract.toLocaleString()}`
        : `净付 $${Math.abs(pair.netPremiumUsdPerMinContract).toLocaleString()}`;

  return `买看涨 ${pair.call.strike.toLocaleString()}，同时卖看跌 ${pair.put.strike.toLocaleString()}；${balanceText}，更接近强烈看涨的模拟持有 BTC 组合，而不是稳定收租。`;
}

function buildSyntheticReasons(pair: SyntheticLongPair, input: RecommendationInput): string[] {
  const reasons = [
    `${pair.expiration} 到期，剩余 ${pair.daysToExpiry} 天，符合你的${input.cycle === "weekly" ? "周度" : "月度"}节奏。`,
    `买看涨的触发概率约 ${Math.abs(pair.call.delta ?? 0).toFixed(3)}，卖看跌的触发概率约 ${Math.abs(pair.put.delta ?? 0).toFixed(3)}，方向风险更接近对称。`,
    pair.netPremiumUsdPerMinContract == null
      ? "当前净权利金无法精确估算，但两个合约仍满足方向与周期筛选。"
      : `每 0.1 BTC 组合净权利金约 ${pair.netPremiumUsdPerMinContract >= 0 ? `+$${pair.netPremiumUsdPerMinContract.toLocaleString()}` : `-$${Math.abs(pair.netPremiumUsdPerMinContract).toLocaleString()}` }，更接近用看跌权利金覆盖看涨成本。`,
  ];

  reasons.push(`卖看跌的执行价在现价下方约 ${pair.put.otmPercent ?? 0}% ，仍保留一定跌价保护空间。`);
  return reasons;
}

function buildSyntheticRisks(pair: SyntheticLongPair): string[] {
  return [
    "这不是免费持有看涨，而是用卖看跌的下跌义务去换取接近零成本的看涨仓位。",
    `如果 BTC 暴跌，卖出的看跌可能让你按 $${pair.put.strike.toLocaleString()} 被迫按约定价买入 BTC，单组需要承担的金额约 $${pair.downsideObligationUsd.toLocaleString()}。`,
    "如果账户使用押金而不是全额现金，波动放大时会有额外追加押金压力。",
  ];
}

function buildSyntheticTags(pair: SyntheticLongPair): string[] {
  return [
    `买看涨 ${pair.call.strike.toLocaleString()}`,
    `卖看跌 ${pair.put.strike.toLocaleString()}`,
    `净权利金 ${pair.netPremiumUsdPerMinContract == null ? "--" : `$${pair.netPremiumUsdPerMinContract.toLocaleString()}`}`,
    `周期 ${pair.daysToExpiry}天`,
    `持仓量 ${pair.call.openInterest}/${pair.put.openInterest}`,
  ];
}

function buildSyntheticUnsuitableScenarios(pair: SyntheticLongPair): string[] {
  return [
    "如果你要的是稳定收租而不是方向性强看涨，这种组合不适合你。",
    "如果你无法接受 BTC 大跌时按卖出看跌的执行价被迫按约定价买入 BTC，这种组合不适合你。",
    `如果你无法承受约 $${pair.downsideObligationUsd.toLocaleString()} 每组的需要承担的金额，也不适合你。`,
  ];
}

function buildSyntheticExpiryPayoff(pair: SyntheticLongPair, minContractSize: number): ExpiryPayoff {
  const underlying = pair.underlyingPrice;
  const netPremium = pair.netPremiumUsdPerMinContract;

  if (underlying == null) {
    return { premiumPerContractUsd: netPremium, breakEvenPrice: null, estimatedMonthlyUsd: null, estimatedAnnualUsd: null, scenarios: [] };
  }

  const breakEven = roundTo(underlying + (netPremium ?? 0) / minContractSize, 0);
  const scenarios: ExpiryPayoffScenario[] = [];

  const priceChanges = [
    { pct: 10, label: "上涨 10%" },
    { pct: 5, label: "上涨 5%" },
    { pct: -5, label: "下跌 5%" },
    { pct: -10, label: "下跌 10%" },
  ];

  for (const { pct, label } of priceChanges) {
    const priceAtExpiry = roundTo(underlying * (1 + pct / 100), 0);
    let payoff = 0;

    if (priceAtExpiry > pair.call.strike) {
      payoff += (priceAtExpiry - pair.call.strike) * minContractSize;
    }

    if (priceAtExpiry < pair.put.strike) {
      payoff -= (pair.put.strike - priceAtExpiry) * minContractSize;
    }

    payoff += (netPremium ?? 0);

    scenarios.push({
      title: `BTC ${label}（~$${priceAtExpiry.toLocaleString()}）`,
      description: pct > 0 ? "看涨赚钱，看跌过期不值钱。" : "看跌亏钱，看涨过期不值钱。",
      amountUsd: roundTo(payoff, 2),
    });
  }

  return { premiumPerContractUsd: netPremium, breakEvenPrice: breakEven, estimatedMonthlyUsd: null, estimatedAnnualUsd: null, scenarios };
}

function getSyntheticLevel(score: number): RecommendationLevel {
  if (score >= 78) {
    return "优先考虑";
  }

  if (score >= 60) {
    return "可接受";
  }

  return "谨慎考虑";
}

function getSyntheticTone(avgDelta: number): RecommendationTone {
  if (avgDelta <= 0.16) {
    return "safe";
  }

  if (avgDelta <= 0.24) {
    return "balanced";
  }

  return "aggressive";
}
