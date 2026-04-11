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
            ? "只保留看涨合约；看跌会直接排除。"
            : "只保留看跌合约；看涨会直接排除。",
      },
      {
        label: "触发范围约束",
        description: "只保留触发范围外（执行价远离当前价格）的合约，已经在触发范围内的合约直接排除。",
      },
      {
        label: "最低权利金",
        description: `单期权利金回报低于 ${input.minPremiumPercent}% 的合约会被过滤。`,
      },
      {
        label: "触发概率区间",
        description: `当前风险偏好要求触发概率绝对值位于 ${roundTo(deltaRange.min * 100, 0)}% - ${roundTo(deltaRange.max * 100, 0)}%，目标点约 ${roundTo(deltaRange.target * 100, 0)}%。`,
      },
      {
        label: "周期窗口",
        description: `当前${input.cycle === "weekly" ? "周度" : "月度"}偏好要求到期日落在 ${cycleRange.min} - ${cycleRange.max} 天。`,
      },
    ],
    scoring: [
      {
        label: "触发概率匹配",
        weightPercent: roundTo(weights.deltaFit * 100, 0),
        description: "越接近目标触发概率，越符合你当前的风险偏好。",
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
        label: input.strategy === "covered-call" ? "上涨空间" : "跌价保护空间",
        weightPercent: roundTo(weights.safety * 100, 0),
        description:
          input.strategy === "covered-call"
            ? "看涨看执行价离现价的安全距离。"
            : "看跌看下方折价空间和跌价保护空间。",
      },
      {
        label: "市场买卖活跃度",
        weightPercent: roundTo(weights.liquidity * 100, 0),
        description: "综合持仓量和成交量，避免只看参考价。",
      },
      {
        label: getAssignmentLabel(input.strategy, acceptsAssignment),
        weightPercent: roundTo(weights.assignment * 100, 0),
        description: getAssignmentMethodologyDescription(input.strategy, acceptsAssignment),
      },
    ],
    notes: [
      ...(input.strategy === "cash-secured-put"
        ? ["cash-secured put 默认意味着愿意在执行价被迫按约定价买入 BTC；低触发概率只能降低可能性，不会取消接货义务。"]
        : []),
      "折算年收益只是把单期权利金按剩余天数粗略换算，方便横向比较，不代表可稳定利滚利。",
      "公开 API 提供的是参考价和市场买卖活跃度摘要，不等于你的真实成交价。",
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

  return acceptsAssignment ? "被触发容忍度" : "避开被触发";
}

function getAssignmentMethodologyDescription(
  strategy: RecommendationInput["strategy"],
  acceptsAssignment: boolean,
): string {
  if (strategy === "cash-secured-put") {
    return "卖看跌的前提就是愿意按执行价被迫按约定价买入 BTC；这一项只衡量你愿意用多高的触发概率去换更厚的权利金。";
  }

  return acceptsAssignment
    ? "如果你能接受被触发卖出，模型会对更容易成交/被触发的合约稍微加分。"
    : "如果你不想被动卖出，模型会偏向更低触发概率的看涨，但这只能降低概率，不会消除风险。";
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
      label: "触发概率匹配",
      scorePercent: roundTo(scores.deltaFit * 100, 0),
      weightPercent: roundTo(weights.deltaFit * 100, 0),
      contribution: roundTo(scores.deltaFit * weights.deltaFit * 100, 1),
      explanation: `实际触发概率 ${scores.absDelta.toFixed(3)}，目标区间 ${deltaRange.min.toFixed(2)} - ${deltaRange.max.toFixed(2)}，越接近 ${deltaRange.target.toFixed(2)} 分越高。`,
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
      explanation: `单期权利金约 ${option.premiumReturnPercent}% ，折算年收益粗略约 ${option.annualizedYieldPercent}% 。这里看的是效率，不是只看绝对金额。`,
    },
    {
      key: "safety",
      label: input.strategy === "covered-call" ? "上涨空间" : "跌价保护空间",
      scorePercent: roundTo(scores.safetyScore * 100, 0),
      weightPercent: roundTo(weights.safety * 100, 0),
      contribution: roundTo(scores.safetyScore * weights.safety * 100, 1),
      explanation:
        input.strategy === "covered-call"
          ? `执行价在现价上方约 ${option.otmPercent}% ，上涨空间越大，安全距离分数越高。`
          : `执行价在现价下方约 ${option.otmPercent}% ，折价空间越大，跌价保护空间越好。`,
    },
    {
      key: "liquidity",
      label: "市场买卖活跃度",
      scorePercent: roundTo(scores.liquidityScore * 100, 0),
      weightPercent: roundTo(weights.liquidity * 100, 0),
      contribution: roundTo(scores.liquidityScore * weights.liquidity * 100, 1),
      explanation: `持仓量 ${option.openInterest}，成交量 ${option.volume}。市场买卖活跃度越好，参考价越有参考意义。`,
    },
    {
      key: "assignment",
      label: getAssignmentLabel(input.strategy, acceptsAssignment),
      scorePercent: roundTo(scores.assignmentScore * 100, 0),
      weightPercent: roundTo(weights.assignment * 100, 0),
      contribution: roundTo(scores.assignmentScore * weights.assignment * 100, 1),
      explanation:
        input.strategy === "cash-secured-put"
          ? "卖看跌天然带被迫按约定价买入 BTC 的义务；这一项看的是你是否愿意接受更高触发概率来换更厚的权利金。"
          : acceptsAssignment
            ? "你接受被动交割，所以模型允许更高一些的被触发概率进入更前排。"
            : "你不希望被动卖出，所以模型会更偏向低触发概率、低触发概率的候选。",
    },
  ];
}

function buildSummary(option: OptionContract, input: RecommendationInput): string {
  const cycleLabel = formatRelativeCycle(option.daysToExpiry);

  if (input.strategy === "covered-call") {
    return `${cycleLabel} $${option.strike.toLocaleString()} 看涨在触发概率、周期、权利金和上涨空间之间更均衡，适合作为当前筛选条件下的优先候选。`;
  }

  return `${cycleLabel} $${option.strike.toLocaleString()} 看跌在跌价保护空间、权利金效率和周期匹配之间更均衡，适合作为当前筛选条件下的优先候选。`;
}

function buildAlgorithmTags(option: OptionContract, input: RecommendationInput): string[] {
  const absDelta = Math.abs(option.delta ?? 0);
  const premiumText = option.premiumReturnPercent != null ? `${option.premiumReturnPercent}%` : "--";
  const otmText = option.otmPercent != null ? `${option.otmPercent}%` : "--";

  return [
    `触发概率 ${absDelta.toFixed(3)}`,
    `${formatRelativeCycle(option.daysToExpiry)} ${option.daysToExpiry}天`,
    `单期权利金 ${premiumText}`,
    `${input.strategy === "covered-call" ? "上涨空间" : "跌价保护空间"} ${otmText}`,
    `活跃度 持仓量 ${option.openInterest} / 成交量 ${option.volume}`,
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
    `触发概率约 ${roundTo(absDelta * 100, 1)}%，适合 ${riskToleranceLabel(input.riskTolerance)} 收租节奏。`,
    `单期权利金约 ${option.premiumReturnPercent}% ，折算年收益粗略约 ${option.annualizedYieldPercent}%。`,
  ];

  if (input.strategy === "covered-call") {
    reasons.push(`执行价高于现价约 ${option.otmPercent}% ，保留一定上涨空间。`);
  }

  if (input.strategy === "cash-secured-put" && effectiveBuyCostPerBtc != null) {
    reasons.push(`若被迫按约定价买入 BTC，折算买入成本约 $${effectiveBuyCostPerBtc.toLocaleString()}/BTC。`);
  }

  return reasons;
}

function buildRisks(option: OptionContract, input: RecommendationInput): string[] {
  const absDelta = Math.abs(option.delta ?? 0);
  const risks: string[] = [];

  if (absDelta >= 0.25) {
    risks.push("触发概率偏高，租金更厚，但更容易被触发或被迫按约定价买入 BTC。");
  }

  if (option.daysToExpiry <= 7) {
    risks.push("到期较近，剩余时间的价值减少得快，价格敏感度风险也更大。");
  }

  if (option.openInterest < 5 && option.volume < 1) {
    risks.push("市场买卖活跃度一般，实际成交价可能和参考价有偏差。");
  }

  if (option.markIv != null && option.markIv >= 55) {
    risks.push("波动率预期偏高，权利金更好，但往往意味着更大的价格波动。");
  }

  if (input.strategy === "covered-call") {
    risks.push("若 BTC 快速暴涨，你的上涨收益会在执行价附近被封顶。");
  } else {
    risks.push("若 BTC 快速下跌，你可能在执行价被迫按约定价买入 BTC。");
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
        description: `你先收下权利金；若 BTC 到期高于 $${option.strike.toLocaleString()}，这张 ${minContractSize} BTC 的看涨可能被触发，你的 BTC 会按执行价卖出，上方继续暴涨的部分不再归你。`,
      },
      {
        title: "到期低于执行价",
        description: "期权过期不值钱，你保留 BTC 和整笔权利金。只要你仍看涨后市，下个周期还能继续卖看涨收租。",
      },
    ];
  }

  return [
    {
      title: "到期高于执行价",
      description: "期权过期不值钱，你保留现金和整笔权利金。这是 cash-secured put 最舒服的结果。",
    },
    {
      title: "到期低于执行价",
      description: effectiveBuyCostPerBtc != null
        ? `你先收下权利金，但这张 ${minContractSize} BTC 的看跌可能让你按 $${option.strike.toLocaleString()} 被迫按约定价买入 BTC，折算后的买入成本约为 $${effectiveBuyCostPerBtc.toLocaleString()}/BTC。`
        : `你先收下权利金，但这张 ${minContractSize} BTC 的看跌可能让你按 $${option.strike.toLocaleString()} 被迫按约定价买入 BTC。`,
    },
  ];
}

function buildUnsuitableScenarios(option: OptionContract, input: RecommendationInput): string[] {
  if (input.strategy === "covered-call") {
    return [
      "如果你强烈看涨，且完全不想在上涨时卖出任何 BTC，这张看涨不适合你。",
      "如果这部分 BTC 是你不愿动用的长期持有的 BTC，也不适合拿来做 covered call。",
      option.daysToExpiry <= 7
        ? "如果你不想临近到期频繁盯盘或续做下一期，短周期看涨会比较累。"
        : "如果你不想让仓位被更久锁在一个执行价附近，较长周期也未必适合你。",
    ];
  }

  return [
    "如果你并不真的想被迫按约定价买入 BTC，只是单纯想收租，这张看跌不适合你。",
    "如果 BTC 大跌时你没有继续持有现货的准备，卖看跌会放大心理压力。",
    option.markIv != null && option.markIv >= 55
      ? "当前波动率预期不低，虽然租金更厚，但也意味着下跌波动可能更剧烈。"
      : "即便当前波动率预期不算极端，卖看跌依旧是用下跌被迫按约定价买入 BTC 的义务换取权利金。",
  ];
}

function buildAssignmentText(
  option: OptionContract,
  input: RecommendationInput,
  minContractSize: number,
): string {
  const sizeText = `${minContractSize} BTC/张`;
  if (input.strategy === "covered-call") {
    return `若到期时 BTC 高于 $${option.strike.toLocaleString()}，你卖出的 ${sizeText} 可能按执行价被触发卖出。`;
  }

  return `若到期时 BTC 低于 $${option.strike.toLocaleString()}，你卖出的 ${sizeText} 可能按执行价被迫按约定价买入 BTC。`;
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
          title: "不被触发（BTC ≤ 执行价）",
          description: "期权过期不值钱，你保留 BTC 和全部权利金。",
          amountUsd: premium,
        },
        {
          title: "被触发（BTC > 执行价）",
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
        title: "不被触发（BTC ≥ 执行价）",
        description: "期权过期不值钱，你保留现金和全部权利金。",
        amountUsd: premium,
      },
      {
        title: "被迫按约定价买入 BTC（BTC < 执行价）",
        description: `按 $${option.strike.toLocaleString()} 买入 ${minContractSize} BTC，折算成本 $${breakEven.toLocaleString()}/BTC。`,
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
