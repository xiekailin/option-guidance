import assert from "node:assert/strict";
import test from "node:test";
import { buildRecommendations, getRecommendationMethodology } from "../lib/domain/recommendation";
import { buildSyntheticLongRecommendations, getSyntheticLongMethodology } from "../lib/domain/synthetic-long";
import { validateRecommendationInput } from "../lib/domain/calculations";
import { analyzeVolatility } from "../lib/domain/volatility";

const baseInput = {
  strategy: "covered-call" as const,
  availableBtc: 0.145,
  availableCashUsd: 10000,
  cycle: "weekly" as const,
  riskTolerance: "balanced" as const,
  acceptAssignment: true,
  minPremiumPercent: 0.4,
};

const baseOption = {
  expirationCode: "17APR26",
  expiration: "4月17日 08:00",
  expirationTimestamp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  bidPrice: 0.005,
  askPrice: 0.006,
  markPrice: 0.0055,
  midPrice: 0.0055,
  underlyingPrice: 73000,
  markIv: 42,
  interestRate: 0,
  openInterest: 12,
  volume: 4,
  premiumReturnPercent: 0.55,
  annualizedYieldPercent: 28,
  premiumUsdPerBtc: 401.5,
};

test("保守模式会过滤高 delta 合约", () => {
  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-76000-C",
      optionType: "call" as const,
      strike: 76000,
      daysToExpiry: 7,
      delta: 0.16,
      otmPercent: 4.2,
    },
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-75000-C",
      optionType: "call" as const,
      strike: 75000,
      daysToExpiry: 7,
      delta: 0.29,
      otmPercent: 2.8,
      premiumReturnPercent: 0.91,
      annualizedYieldPercent: 54,
    },
  ];

  const recommendations = buildRecommendations(options, {
    ...baseInput,
    riskTolerance: "conservative",
  });

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]?.contract.instrumentName, "BTC-17APR26-76000-C");
});

test("输入校验会拦截负数可用 BTC", () => {
  const errors = validateRecommendationInput({
    ...baseInput,
    availableBtc: -0.1,
  });

  assert.ok(errors.includes("可用 BTC 不能小于 0。"));
});

test("推荐结果会生成结构化解释字段", () => {
  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-76000-C",
      optionType: "call" as const,
      strike: 76000,
      daysToExpiry: 7,
      delta: 0.18,
      otmPercent: 4.2,
      openInterest: 24,
      volume: 8,
    },
  ];

  const [recommendation] = buildRecommendations(options, baseInput);

  assert.ok(recommendation);
  assert.equal(recommendation.scoreBreakdown.length, 6);
  assert.equal(recommendation.algorithmTags.length, 5);
  assert.equal(recommendation.scenarios.length, 2);
  assert.ok(recommendation.summary.includes("优先候选"));
  assert.ok(recommendation.unsuitableScenarios.length >= 3);
});

test("推荐结果会包含到期收益预估", () => {
  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-76000-C",
      optionType: "call" as const,
      strike: 76000,
      daysToExpiry: 7,
      delta: 0.18,
      otmPercent: 4.2,
      openInterest: 24,
      volume: 8,
    },
  ];

  const [recommendation] = buildRecommendations(options, baseInput);

  assert.ok(recommendation);
  assert.equal(recommendation.expiryPayoff.scenarios.length, 2);
  assert.ok(recommendation.expiryPayoff.premiumPerContractUsd != null);
  assert.ok(recommendation.expiryPayoff.breakEvenPrice != null);
  assert.ok(recommendation.expiryPayoff.scenarios[0]?.title.length > 0);
  assert.ok(recommendation.expiryPayoff.scenarios[1]?.title.length > 0);
});

test("缺少 underlyingPrice 时不会把美元权利金误写成 0", () => {
  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-76000-C",
      optionType: "call" as const,
      strike: 76000,
      daysToExpiry: 7,
      delta: 0.18,
      otmPercent: 4.2,
      underlyingPrice: null,
      premiumUsdPerBtc: null,
    },
  ];

  const [recommendation] = buildRecommendations(options, baseInput);

  assert.equal(recommendation?.premiumPerMinContractUsd, null);
});

test("算法说明会反映当前输入约束", () => {
  const methodology = getRecommendationMethodology({
    ...baseInput,
    strategy: "cash-secured-put",
    cycle: "monthly",
    riskTolerance: "conservative",
    acceptAssignment: false,
    minPremiumPercent: 0.6,
  });

  assert.ok(methodology.filters.some((item) => item.description.includes("0.6%")));
  assert.ok(methodology.filters.some((item) => item.description.includes("18 - 45 天")));
  assert.ok(methodology.filters.some((item) => item.description.includes("10% - 18%")));
  assert.ok(methodology.scoring.some((item) => item.label === "接货偏好匹配" && item.weightPercent === 15));
  assert.ok(methodology.notes.some((item) => item.includes("只能降低可能性") || item.includes("不会取消接货义务")));
});

test("合成现货会配对同到期且执行价接近的 call 和 put", () => {
  const syntheticInput = {
    ...baseInput,
    strategy: "synthetic-long" as const,
    cycle: "weekly" as const,
    riskTolerance: "balanced" as const,
  };

  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-76000-C",
      optionType: "call" as const,
      strike: 76000,
      daysToExpiry: 7,
      delta: 0.19,
      otmPercent: 4.1,
      premiumUsdPerBtc: 410,
    },
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-74500-P",
      optionType: "put" as const,
      strike: 74500,
      daysToExpiry: 7,
      delta: -0.2,
      otmPercent: 3.4,
      premiumUsdPerBtc: 420,
    },
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-70000-P",
      optionType: "put" as const,
      strike: 70000,
      daysToExpiry: 7,
      delta: -0.2,
      otmPercent: 9.5,
      premiumUsdPerBtc: 280,
    },
  ];

  const recommendations = buildSyntheticLongRecommendations(options, syntheticInput);

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]?.pair.call.instrumentName, "BTC-17APR26-76000-C");
  assert.equal(recommendations[0]?.pair.put.instrumentName, "BTC-17APR26-74500-P");
});

test("合成现货会输出净权利金与风险说明", () => {
  const syntheticInput = {
    ...baseInput,
    strategy: "synthetic-long" as const,
    cycle: "weekly" as const,
    riskTolerance: "balanced" as const,
  };

  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-76000-C",
      optionType: "call" as const,
      strike: 76000,
      daysToExpiry: 7,
      delta: 0.19,
      otmPercent: 4.1,
      premiumUsdPerBtc: 410,
      openInterest: 30,
      volume: 10,
    },
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-74500-P",
      optionType: "put" as const,
      strike: 74500,
      daysToExpiry: 7,
      delta: -0.2,
      otmPercent: 3.4,
      premiumUsdPerBtc: 420,
      openInterest: 28,
      volume: 9,
    },
  ];

  const [recommendation] = buildSyntheticLongRecommendations(options, syntheticInput);

  assert.ok(recommendation);
  assert.equal(recommendation.pair.netPremiumUsdPerMinContract, 1);
  assert.ok(recommendation.summary.includes("看涨") || recommendation.summary.includes("模拟持有 BTC"));
  assert.ok(recommendation.risks.some((item) => item.includes("卖看跌") || item.includes("下跌义务")));
  assert.ok(recommendation.unsuitableScenarios.some((item) => item.includes("稳定收租")));
  assert.equal(recommendation.expiryPayoff.scenarios.length, 4);
  assert.ok(recommendation.expiryPayoff.breakEvenPrice != null);
});

test("波动率分析会按天重采样历史价格再计算 HV", () => {
  const day = 24 * 60 * 60 * 1000;
  const start = Date.UTC(2026, 0, 1);
  const historicalPrices = Array.from({ length: 95 }, (_, index) => {
    const base = 70000 + index * 150;
    return [
      { timestamp: start + index * day + 1 * 60 * 60 * 1000, price: base - 200 },
      { timestamp: start + index * day + 12 * 60 * 60 * 1000, price: base + 100 },
      { timestamp: start + index * day + 23 * 60 * 60 * 1000, price: base + 300 },
    ];
  }).flat();

  const analysis = analyzeVolatility([
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-76000-C",
      optionType: "call",
      strike: 76000,
      daysToExpiry: 7,
      delta: 0.2,
      otmPercent: 4.5,
      expirationTimestamp: start + 100 * day,
      markIv: 48,
    },
  ], 73000, historicalPrices);

  assert.ok(analysis.historicalVol30d != null);
  assert.ok(analysis.historicalVol90d != null);
  assert.ok(analysis.ivHvSpread30d != null);
});

test("波动率分析会给出历史波动率和贵不贵判断", () => {
  const now = Date.now();
  const historicalPrices = Array.from({ length: 100 }, (_, index) => ({
    timestamp: now - (99 - index) * 24 * 60 * 60 * 1000,
    price: 70000 + index * 120 + ((index % 3) - 1) * 80,
  }));

  const analysis = analyzeVolatility([
    {
      ...baseOption,
      instrumentName: "BTC-17APR26-76000-C",
      optionType: "call",
      strike: 76000,
      daysToExpiry: 7,
      delta: 0.2,
      otmPercent: 4.5,
      expirationTimestamp: now + 7 * 24 * 60 * 60 * 1000,
      markIv: 48,
    },
    {
      ...baseOption,
      instrumentName: "BTC-24APR26-76000-C",
      optionType: "call",
      strike: 76000,
      daysToExpiry: 14,
      delta: 0.22,
      otmPercent: 4.5,
      expirationTimestamp: now + 14 * 24 * 60 * 60 * 1000,
      markIv: 46,
    },
  ], 73000, historicalPrices);

  assert.ok(analysis.historicalVol7d != null);
  assert.ok(analysis.historicalVol30d != null);
  assert.ok(analysis.historicalVol90d != null);
  assert.ok(analysis.ivHvSpread30d != null);
  assert.ok(analysis.verdict.length > 0);
  assert.ok(analysis.summary.includes("30天历史波动率"));
});

test("合成现货算法说明会强调零成本不等于无风险", () => {
  const methodology = getSyntheticLongMethodology({
    cycle: "monthly",
    riskTolerance: "aggressive",
  });

  assert.ok(methodology.filters.some((item) => item.description.includes("同到期")));
  assert.ok(methodology.scoring.some((item) => item.label === "净权利金接近 0" && item.weightPercent === 24));
  assert.ok(methodology.notes.some((item) => item.includes("不代表无风险")));
});
