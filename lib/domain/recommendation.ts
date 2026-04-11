import {
  calculateCycleFitScore,
  calculateDeltaFitScore,
  clamp,
  formatRelativeCycle,
  getCycleDayRange,
  getMaxLotsForInput,
  getMinContractSizeBtc,
  getTargetDeltaRange,
  roundTo,
} from "./calculations";
import type {
  ExpiryPayoff,
  OptionContract,
  Recommendation,
  RecommendationInput,
  RecommendationLevel,
  RecommendationScoreBreakdownItem,
  RecommendationTone,
} from "../types/option";

const MAX_RECOMMENDATIONS = 12;

export function buildRecommendations(
  options: OptionContract[],
  input: RecommendationInput,
): Recommendation[] {
  const deltaRange = getTargetDeltaRange(input.riskTolerance);
  const acceptsAssignment = isAssignmentAccepted(input);
  const weights = getScoreWeights(acceptsAssignment);

  return options
    .filter((option) => isEligibleOption(option, input))
    .map((option) => {
      const absDelta = Math.abs(option.delta ?? 0);
      const deltaFit = calculateDeltaFitScore(absDelta, deltaRange.target, deltaRange.min, deltaRange.max);
      const cycleFit = calculateCycleFitScore(option.daysToExpiry, input.cycle);
      const premiumScore = clamp((option.annualizedYieldPercent ?? 0) / 30, 0, 1);
      const safetyTarget = input.strategy === "covered-call" ? 10 : 14;
      const safetyScore = clamp((option.otmPercent ?? 0) / safetyTarget, 0, 1);
      const liquidityScore = clamp(Math.log10(option.openInterest + option.volume + 1), 0, 1);
      const assignmentScore = acceptsAssignment
        ? clamp(absDelta / 0.35, 0, 1)
        : clamp((0.32 - absDelta) / 0.22, 0, 1);

      const scoreBreakdown = buildScoreBreakdown(
        {
          absDelta,
          deltaFit,
          cycleFit,
          premiumScore,
          safetyScore,
          liquidityScore,
          assignmentScore,
        },
        option,
        input,
        acceptsAssignment,
        weights,
      );
      const score = roundTo(
        scoreBreakdown.reduce((total, item) => total + item.contribution, 0),
        1,
      );

      const maxLots = getMaxLotsForInput(input, option);
      const minContractSize = getMinContractSizeBtc();
      const premiumPerMinContractBtc = roundTo((option.markPrice ?? 0) * minContractSize, 5);
      const premiumPerMinContractUsd =
        option.premiumUsdPerBtc != null ? roundTo(option.premiumUsdPerBtc * minContractSize, 2) : null;
      const effectiveBuyCostPerBtc =
        input.strategy === "cash-secured-put" && option.premiumUsdPerBtc != null
          ? roundTo(option.strike - option.premiumUsdPerBtc, 2)
          : null;

      return {
        contract: option,
        strategy: input.strategy,
        score,
        level: getRecommendationLevel(score),
        tone: getRecommendationTone(absDelta),
        maxLots,
        maxTradeAmountBtc: roundTo(maxLots * minContractSize, 3),
        premiumPerMinContractBtc,
        premiumPerMinContractUsd,
        effectiveBuyCostPerBtc,
        summary: buildSummary(option, input),
        algorithmTags: buildAlgorithmTags(option, input),
        reasons: buildReasons(option, input, effectiveBuyCostPerBtc),
        risks: buildRisks(option, input),
        scoreBreakdown,
        scenarios: buildScenarios(option, input, effectiveBuyCostPerBtc, minContractSize),
        unsuitableScenarios: buildUnsuitableScenarios(option, input),
        assignmentText: buildAssignmentText(option, input, minContractSize),
        expiryPayoff: buildExpiryPayoff(option, input, premiumPerMinContractUsd, minContractSize),
      } satisfies Recommendation;
    })
    .filter((item) => item.maxLots > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_RECOMMENDATIONS);
}

export function getRecommendationMethodology(
  input: Pick<RecommendationInput, "strategy" | "cycle" | "riskTolerance" | "acceptAssignment" | "minPremiumPercent">,
) {
  const deltaRange = getTargetDeltaRange(input.riskTolerance);
  const cycleRange = getCycleDayRange(input.cycle);
  const acceptsAssignment = isAssignmentAccepted(input);
  const weights = getScoreWeights(acceptsAssignment);

  return {
    filters: [
      {
        label: "策略方向",
        description:
          input.strategy === "covered-call"
            ? "只保留 call 合约；put 会直接排除。"
            : "只保留 put 合约；call 会直接排除。",
      },
      {
        label: "OTM 约束",
        description: "只保留 OTM 百分比大于 0 的合约，避免直接把 ITM 合约纳入收租候选。",
      },
      {
        label: "最低权利金",
        description: `单期权利金回报低于 ${input.minPremiumPercent}% 的合约会被过滤。`,
      },
      {
        label: "Delta 区间",
        description: `当前风险偏好要求 Delta 绝对值位于 ${roundTo(deltaRange.min * 100, 0)}% - ${roundTo(deltaRange.max * 100, 0)}%，目标点约 ${roundTo(deltaRange.target * 100, 0)}%。`,
      },
      {
        label: "周期窗口",
        description: `当前${input.cycle === "weekly" ? "周度" : "月度"}偏好要求到期日落在 ${cycleRange.min} - ${cycleRange.max} 天。`,
      },
    ],
    scoring: [
      {
        label: "Delta 匹配",
        weightPercent: roundTo(weights.deltaFit * 100, 0),
        description: "越接近目标 Delta，越符合你当前的风险偏好。",
      },
      {
        label: "周期匹配",
        weightPercent: roundTo(weights.cycleFit * 100, 0),
        description: "越接近你选择的周度/月度时间窗口，分数越高。",
      },
      {
        label: "权利金",
        weightPercent: roundTo(weights.premium * 100, 0),
        description: "看的是权利金效率，不是单纯谁绝对美元最高。",
      },
      {
        label: input.strategy === "covered-call" ? "上行留白" : "接货缓冲",
        weightPercent: roundTo(weights.safety * 100, 0),
        description:
          input.strategy === "covered-call"
            ? "call 看执行价离现价的安全边际。"
            : "put 看下方折价空间和接货缓冲。",
      },
      {
        label: "流动性",
        weightPercent: roundTo(weights.liquidity * 100, 0),
        description: "综合 open interest 和 volume，避免只看标记价。",
      },
      {
        label: getAssignmentLabel(input.strategy, acceptsAssignment),
        weightPercent: roundTo(weights.assignment * 100, 0),
        description: getAssignmentMethodologyDescription(input.strategy, acceptsAssignment),
      },
    ],
    notes: [
      ...(input.strategy === "cash-secured-put"
        ? ["cash-secured put 默认意味着愿意在执行价接货；低 Delta 只能降低概率，不会取消接货义务。"]
        : []),
      "年化只是把单期权利金按剩余天数粗略折算，方便横向比较，不代表可稳定复利。",
      "公开 API 提供的是标记价和盘口摘要，不等于你的真实成交价。",
      "这个模型是规则过滤 + 加权评分，不是黑箱 AI，也不是自动下单系统。",
    ],
  };
}

function isEligibleOption(option: OptionContract, input: RecommendationInput): boolean {
  if (
    option.markPrice == null ||
    option.delta == null ||
    option.annualizedYieldPercent == null ||
    option.otmPercent == null
  ) {
    return false;
  }

  if (option.otmPercent <= 0) {
    return false;
  }

  if (option.premiumReturnPercent != null && option.premiumReturnPercent < input.minPremiumPercent) {
    return false;
  }

  if (input.strategy === "covered-call" && option.optionType !== "call") {
    return false;
  }

  if (input.strategy === "cash-secured-put" && option.optionType !== "put") {
    return false;
  }

  const deltaRange = getTargetDeltaRange(input.riskTolerance);
  const absDelta = Math.abs(option.delta);
  if (absDelta < deltaRange.min || absDelta > deltaRange.max) {
    return false;
  }

  return calculateCycleFitScore(option.daysToExpiry, input.cycle) > 0;
}

function isAssignmentAccepted(
  input: Pick<RecommendationInput, "strategy" | "acceptAssignment">,
): boolean {
  return input.strategy === "cash-secured-put" ? true : input.acceptAssignment;
}

function getScoreWeights(acceptsAssignment: boolean) {
  return {
    deltaFit: 0.28,
    cycleFit: 0.16,
    premium: 0.22,
    safety: acceptsAssignment ? 0.12 : 0.22,
    liquidity: 0.07,
    assignment: acceptsAssignment ? 0.15 : 0.05,
  };
}

function getAssignmentLabel(
  strategy: RecommendationInput["strategy"],
  acceptsAssignment: boolean,
): string {
  if (strategy === "cash-secured-put") {
    return "接货偏好匹配";
  }

  return acceptsAssignment ? "行权容忍度" : "避开行权";
}

function getAssignmentMethodologyDescription(
  strategy: RecommendationInput["strategy"],
  acceptsAssignment: boolean,
): string {
  if (strategy === "cash-secured-put") {
    return "卖 put 的前提就是愿意按执行价接货；这一项只衡量你愿意用多高的触发概率去换更厚的权利金。";
  }

  return acceptsAssignment
    ? "如果你能接受被行权卖出，模型会对更容易成交/行权的合约稍微加分。"
    : "如果你不想被动卖出，模型会偏向更低 Delta 的 call，但这只能降低概率，不会消除风险。";
}

function buildScoreBreakdown(
  scores: {
    absDelta: number;
    deltaFit: number;
    cycleFit: number;
    premiumScore: number;
    safetyScore: number;
    liquidityScore: number;
    assignmentScore: number;
  },
  option: OptionContract,
  input: RecommendationInput,
  acceptsAssignment: boolean,
  weights: ReturnType<typeof getScoreWeights>,
): RecommendationScoreBreakdownItem[] {
  const deltaRange = getTargetDeltaRange(input.riskTolerance);

  return [
    {
      key: "delta-fit",
      label: "Delta 匹配",
      scorePercent: roundTo(scores.deltaFit * 100, 0),
      weightPercent: roundTo(weights.deltaFit * 100, 0),
      contribution: roundTo(scores.deltaFit * weights.deltaFit * 100, 1),
      explanation: `实际 Delta ${scores.absDelta.toFixed(3)}，目标区间 ${deltaRange.min.toFixed(2)} - ${deltaRange.max.toFixed(2)}，越接近 ${deltaRange.target.toFixed(2)} 分越高。`,
    },
    {
      key: "cycle-fit",
      label: "周期匹配",
      scorePercent: roundTo(scores.cycleFit * 100, 0),
      weightPercent: roundTo(weights.cycleFit * 100, 0),
      contribution: roundTo(scores.cycleFit * weights.cycleFit * 100, 1),
      explanation: `当前距到期 ${option.daysToExpiry} 天，越贴近你的${input.cycle === "weekly" ? "周度" : "月度"}时间窗口，分数越高。`,
    },
    {
      key: "premium",
      label: "权利金效率",
      scorePercent: roundTo(scores.premiumScore * 100, 0),
      weightPercent: roundTo(weights.premium * 100, 0),
      contribution: roundTo(scores.premiumScore * weights.premium * 100, 1),
      explanation: `单期权利金约 ${option.premiumReturnPercent}% ，年化粗略约 ${option.annualizedYieldPercent}% 。这里看的是效率，不是只看绝对金额。`,
    },
    {
      key: "safety",
      label: input.strategy === "covered-call" ? "上行留白" : "接货缓冲",
      scorePercent: roundTo(scores.safetyScore * 100, 0),
      weightPercent: roundTo(weights.safety * 100, 0),
      contribution: roundTo(scores.safetyScore * weights.safety * 100, 1),
      explanation:
        input.strategy === "covered-call"
          ? `执行价在现价上方约 ${option.otmPercent}% ，上涨留白越大，安全边际分数越高。`
          : `执行价在现价下方约 ${option.otmPercent}% ，折价空间越大，接货缓冲越好。`,
    },
    {
      key: "liquidity",
      label: "流动性",
      scorePercent: roundTo(scores.liquidityScore * 100, 0),
      weightPercent: roundTo(weights.liquidity * 100, 0),
      contribution: roundTo(scores.liquidityScore * weights.liquidity * 100, 1),
      explanation: `Open interest ${option.openInterest}，成交量 ${option.volume}。流动性越好，标记价越有参考意义。`,
    },
    {
      key: "assignment",
      label: getAssignmentLabel(input.strategy, acceptsAssignment),
      scorePercent: roundTo(scores.assignmentScore * 100, 0),
      weightPercent: roundTo(weights.assignment * 100, 0),
      contribution: roundTo(scores.assignmentScore * weights.assignment * 100, 1),
      explanation:
        input.strategy === "cash-secured-put"
          ? "卖 put 天然带接货义务；这一项看的是你是否愿意接受更高触发概率来换更厚的权利金。"
          : acceptsAssignment
            ? "你接受被动交割，所以模型允许更高一些的行权概率进入更前排。"
            : "你不希望被动卖出，所以模型会更偏向低 Delta、低触发行权概率的候选。",
    },
  ];
}

function buildSummary(option: OptionContract, input: RecommendationInput): string {
  const cycleLabel = formatRelativeCycle(option.daysToExpiry);

  if (input.strategy === "covered-call") {
    return `${cycleLabel} $${option.strike.toLocaleString()} call 在 Delta、周期、权利金和上行留白之间更均衡，适合作为当前筛选条件下的优先候选。`;
  }

  return `${cycleLabel} $${option.strike.toLocaleString()} put 在接货折价、权利金效率和周期匹配之间更均衡，适合作为当前筛选条件下的优先候选。`;
}

function buildAlgorithmTags(option: OptionContract, input: RecommendationInput): string[] {
  const absDelta = Math.abs(option.delta ?? 0);
  const premiumText = option.premiumReturnPercent != null ? `${option.premiumReturnPercent}%` : "--";
  const otmText = option.otmPercent != null ? `${option.otmPercent}%` : "--";

  return [
    `Delta ${absDelta.toFixed(3)}`,
    `${formatRelativeCycle(option.daysToExpiry)} ${option.daysToExpiry}天`,
    `单期权利金 ${premiumText}`,
    `${input.strategy === "covered-call" ? "上行留白" : "接货缓冲"} ${otmText}`,
    `流动性 OI ${option.openInterest} / Vol ${option.volume}`,
  ];
}

function buildReasons(
  option: OptionContract,
  input: RecommendationInput,
  effectiveBuyCostPerBtc: number | null,
): string[] {
  const absDelta = Math.abs(option.delta ?? 0);
  const reasons = [
    `${formatRelativeCycle(option.daysToExpiry)}到期，剩余 ${option.daysToExpiry} 天，和你的${input.cycle === "weekly" ? "周度" : "月度"}偏好匹配。`,
    `Delta 约 ${roundTo(absDelta * 100, 1)}%，适合 ${riskToleranceLabel(input.riskTolerance)} 收租节奏。`,
    `单期权利金约 ${option.premiumReturnPercent}% ，年化粗略约 ${option.annualizedYieldPercent}%。`,
  ];

  if (input.strategy === "covered-call") {
    reasons.push(`执行价高于现价约 ${option.otmPercent}% ，保留一定上涨空间。`);
  }

  if (input.strategy === "cash-secured-put" && effectiveBuyCostPerBtc != null) {
    reasons.push(`若被接货，折算接入成本约 $${effectiveBuyCostPerBtc.toLocaleString()}/BTC。`);
  }

  return reasons;
}

function buildRisks(option: OptionContract, input: RecommendationInput): string[] {
  const absDelta = Math.abs(option.delta ?? 0);
  const risks: string[] = [];

  if (absDelta >= 0.25) {
    risks.push("Delta 偏高，租金更厚，但更容易被行权或被接货。");
  }

  if (option.daysToExpiry <= 7) {
    risks.push("到期较近，时间价值衰减快，但 gamma 风险也更大。");
  }

  if (option.openInterest < 5 && option.volume < 1) {
    risks.push("流动性一般，实际成交价可能和标记价有偏差。");
  }

  if (option.markIv != null && option.markIv >= 55) {
    risks.push("隐波偏高，权利金更好，但往往意味着更大的波动预期。");
  }

  if (input.strategy === "covered-call") {
    risks.push("若 BTC 快速暴涨，你的上涨收益会在执行价附近被封顶。");
  } else {
    risks.push("若 BTC 快速下跌，你可能在执行价被动接入现货。");
  }

  return risks;
}

function buildScenarios(
  option: OptionContract,
  input: RecommendationInput,
  effectiveBuyCostPerBtc: number | null,
  minContractSize: number,
) {
  if (input.strategy === "covered-call") {
    return [
      {
        title: "到期高于执行价",
        description: `你先收下权利金；若 BTC 到期高于 $${option.strike.toLocaleString()}，这张 ${minContractSize} BTC 的 call 可能被行权，你的现货会按执行价卖出，上方继续暴涨的部分不再归你。`,
      },
      {
        title: "到期低于执行价",
        description: "期权大概率归零，你保留现货和整笔权利金。只要你仍看多后市，下个周期还能继续卖 call 收租。",
      },
    ];
  }

  return [
    {
      title: "到期高于执行价",
      description: "期权大概率归零，你保留现金和整笔权利金。这是 cash-secured put 最舒服的结果。",
    },
    {
      title: "到期低于执行价",
      description: effectiveBuyCostPerBtc != null
        ? `你先收下权利金，但这张 ${minContractSize} BTC 的 put 可能让你按 $${option.strike.toLocaleString()} 被动接货，折算后的接货成本约为 $${effectiveBuyCostPerBtc.toLocaleString()}/BTC。`
        : `你先收下权利金，但这张 ${minContractSize} BTC 的 put 可能让你按 $${option.strike.toLocaleString()} 被动接货。`,
    },
  ];
}

function buildUnsuitableScenarios(option: OptionContract, input: RecommendationInput): string[] {
  if (input.strategy === "covered-call") {
    return [
      "如果你强烈看多，且完全不想在上涨时卖出任何 BTC，这张 call 不适合你。",
      "如果这部分 BTC 是你不愿动用的长期核心仓位，也不适合拿来做 covered call。",
      option.daysToExpiry <= 7
        ? "如果你不想临近到期频繁盯盘或滚仓，短周期 call 会比较累。"
        : "如果你不想让仓位被更久锁在一个执行价附近，较长周期也未必适合你。",
    ];
  }

  return [
    "如果你并不真的想接货，只是单纯想收租，这张 put 不适合你。",
    "如果 BTC 大跌时你没有继续持有现货的准备，卖 put 会放大心理压力。",
    option.markIv != null && option.markIv >= 55
      ? "当前隐波不低，虽然租金更厚，但也意味着下跌波动可能更剧烈。"
      : "即便当前隐波不算极端，卖 put 依旧是用下跌接货义务换取权利金。",
  ];
}

function buildAssignmentText(
  option: OptionContract,
  input: RecommendationInput,
  minContractSize: number,
): string {
  const sizeText = `${minContractSize} BTC/张`;
  if (input.strategy === "covered-call") {
    return `若到期时 BTC 高于 $${option.strike.toLocaleString()}，你卖出的 ${sizeText} 可能按执行价被卖出。`;
  }

  return `若到期时 BTC 低于 $${option.strike.toLocaleString()}，你卖出的 ${sizeText} 可能按执行价被动接货。`;
}

function buildExpiryPayoff(
  option: OptionContract,
  input: RecommendationInput,
  premiumPerMinContractUsd: number | null,
  minContractSize: number,
): ExpiryPayoff {
  const underlying = option.underlyingPrice;
  const premium = premiumPerMinContractUsd;

  if (premium == null || underlying == null || option.daysToExpiry <= 0) {
    return { premiumPerContractUsd: premium, breakEvenPrice: null, estimatedMonthlyUsd: null, estimatedAnnualUsd: null, scenarios: [] };
  }

  const estimatedMonthlyUsd = roundTo(premium * (30 / option.daysToExpiry), 0);
  const estimatedAnnualUsd = roundTo(premium * (365 / option.daysToExpiry), 0);

  if (input.strategy === "covered-call") {
    const premiumPerBtc = premium / minContractSize;
    const breakEven = roundTo(underlying - premiumPerBtc, 0);
    const priceDiff = (option.strike - underlying) * minContractSize;

    return {
      premiumPerContractUsd: premium,
      breakEvenPrice: breakEven,
      estimatedMonthlyUsd,
      estimatedAnnualUsd,
      scenarios: [
        {
          title: "不被行权（BTC ≤ 执行价）",
          description: "期权归零，你保留 BTC 和全部权利金。",
          amountUsd: premium,
        },
        {
          title: "被行权（BTC > 执行价）",
          description: `BTC 按执行价卖出，你赚权利金加价差。`,
          amountUsd: roundTo(premium + priceDiff, 2),
        },
      ],
    };
  }

  // cash-secured-put
  const premiumPerBtc = premium / minContractSize;
  const breakEven = roundTo(option.strike - premiumPerBtc, 0);

  return {
    premiumPerContractUsd: premium,
    breakEvenPrice: breakEven,
    estimatedMonthlyUsd,
    estimatedAnnualUsd,
    scenarios: [
      {
        title: "不被行权（BTC ≥ 执行价）",
        description: "期权归零，你保留现金和全部权利金。",
        amountUsd: premium,
      },
      {
        title: "被接货（BTC < 执行价）",
        description: `按 $${option.strike.toLocaleString()} 接入 ${minContractSize} BTC，折算成本 $${breakEven.toLocaleString()}/BTC。`,
        amountUsd: null,
      },
    ],
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

function getRecommendationTone(absDelta: number): RecommendationTone {
  if (absDelta <= 0.16) {
    return "safe";
  }

  if (absDelta <= 0.24) {
    return "balanced";
  }

  return "aggressive";
}

function riskToleranceLabel(riskTolerance: RecommendationInput["riskTolerance"]): string {
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
