import assert from "node:assert/strict";
import test from "node:test";
import { buildLongCallRecommendations, getLongCallMethodology } from "../lib/domain/long-call";
import { validateRecommendationInput } from "../lib/domain/calculations";

const baseInput = {
  strategy: "long-call" as const,
  availableBtc: 0,
  availableCashUsd: 2_000,
  cycle: "monthly" as const,
  riskTolerance: "balanced" as const,
  acceptAssignment: false,
  minPremiumPercent: 0,
};

const baseOption = {
  expirationCode: "20JUN26",
  expiration: "6月20日 08:00",
  expirationTimestamp: Date.now() + 45 * 24 * 60 * 60 * 1000,
  bidPrice: 0.02,
  askPrice: 0.021,
  markPrice: 0.0205,
  midPrice: 0.0205,
  underlyingPrice: 74_000,
  markIv: 48,
  interestRate: 0,
  openInterest: 520,
  volume: 110,
  premiumReturnPercent: 2.05,
  annualizedYieldPercent: 16,
  premiumUsdPerBtc: 1_517,
  optionType: "call" as const,
  strike: 76_000,
  daysToExpiry: 45,
  delta: 0.43,
  otmPercent: 2.7,
};

test("佩洛西打法只保留 30-90 天的 call", () => {
  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-20JUN26-76000-C",
      daysToExpiry: 45,
    },
    {
      ...baseOption,
      instrumentName: "BTC-10MAY26-76000-C",
      daysToExpiry: 22,
    },
    {
      ...baseOption,
      instrumentName: "BTC-20JUN26-72000-P",
      optionType: "put" as const,
      delta: -0.43,
      otmPercent: 2.7,
    },
  ];

  const recommendations = buildLongCallRecommendations(options, baseInput);

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]?.contract.instrumentName, "BTC-20JUN26-76000-C");
});

test("现金不足时不会返回候选", () => {
  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-20JUN26-76000-C",
      premiumUsdPerBtc: 30_000,
      markPrice: 0.4,
    },
  ];

  const recommendations = buildLongCallRecommendations(options, baseInput);

  assert.equal(recommendations.length, 0);
});

test("风险偏好会影响 long call 的筛选窗口", () => {
  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-20JUN26-74500-C",
      strike: 74_500,
      delta: 0.6,
      otmPercent: 0.7,
    },
    {
      ...baseOption,
      instrumentName: "BTC-20JUN26-79000-C",
      strike: 79_000,
      delta: 0.28,
      otmPercent: 6.8,
    },
  ];

  const conservative = buildLongCallRecommendations(options, {
    ...baseInput,
    riskTolerance: "conservative",
  });
  const aggressive = buildLongCallRecommendations(options, {
    ...baseInput,
    riskTolerance: "aggressive",
  });

  assert.equal(conservative.length, 1);
  assert.equal(conservative[0]?.contract.instrumentName, "BTC-20JUN26-74500-C");
  assert.equal(aggressive.length, 1);
  assert.equal(aggressive[0]?.contract.instrumentName, "BTC-20JUN26-79000-C");
});

test("高 IV 合约会在排序上吃亏", () => {
  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-20JUN26-76000-C",
      markIv: 46,
      volume: 150,
      openInterest: 700,
    },
    {
      ...baseOption,
      instrumentName: "BTC-20JUN26-76500-C",
      strike: 76_500,
      otmPercent: 3.4,
      markIv: 92,
      volume: 160,
      openInterest: 720,
    },
  ];

  const recommendations = buildLongCallRecommendations(options, baseInput);

  assert.equal(recommendations[0]?.contract.instrumentName, "BTC-20JUN26-76000-C");
});

test("long call 会给出最大亏损和盈亏平衡价", () => {
  const options = [
    {
      ...baseOption,
      instrumentName: "BTC-20JUN26-76000-C",
    },
  ];

  const [recommendation] = buildLongCallRecommendations(options, baseInput);

  assert.ok(recommendation);
  assert.equal(recommendation.maxLossUsd, 151.7);
  assert.equal(recommendation.breakEvenPrice, 77517);
  assert.equal(recommendation.expiryPayoff.breakEvenPrice, 77517);
  assert.equal(recommendation.expiryPayoff.estimatedMonthlyUsd, null);
  assert.equal(recommendation.scoreBreakdown.length, 6);
});

test("long-call 模式下输入校验不再要求 BTC 和最低权利金", () => {
  const errors = validateRecommendationInput({
    ...baseInput,
    availableBtc: -1,
    minPremiumPercent: -5,
  });

  assert.deepEqual(errors, []);
});

test("算法说明会反映 30-90 天和最大亏损=权利金", () => {
  const methodology = getLongCallMethodology({
    riskTolerance: "balanced",
    availableCashUsd: 2000,
  });

  assert.ok(methodology.filters.some((item) => item.description.includes("30 - 90 天") || item.description.includes("30-90 天")));
  assert.ok(methodology.notes.some((item) => item.includes("最大亏损") && item.includes("权利金")));
  assert.ok(methodology.scoring.some((item) => item.label === "隐波成本"));
});
