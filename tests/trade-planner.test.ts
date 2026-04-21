import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTradePlan,
  computeSlippagePercent,
  resolveLimitPrice,
  resolveLots,
  resolveSide,
  runPreflight,
} from "../lib/trading/trade-planner";
import type {
  LongCallRecommendation,
  OptionContract,
  Recommendation,
} from "../lib/types/option";

const baseContract: OptionContract = {
  instrumentName: "BTC-25APR26-76000-C",
  optionType: "call",
  strike: 76000,
  expirationCode: "25APR26",
  expiration: "4月25日 08:00",
  expirationTimestamp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  daysToExpiry: 7,
  bidPrice: 0.005,
  askPrice: 0.006,
  markPrice: 0.0055,
  midPrice: 0.0055,
  underlyingPrice: 73000,
  markIv: 42,
  interestRate: 0,
  openInterest: 12,
  volume: 4,
  delta: 0.18,
  otmPercent: 4.2,
  premiumReturnPercent: 0.55,
  annualizedYieldPercent: 28,
  premiumUsdPerBtc: 401.5,
};

const baseRec: Recommendation = {
  contract: baseContract,
  strategy: "covered-call",
  score: 78,
  level: "优先考虑",
  tone: "balanced",
  maxLots: 1,
  maxTradeAmountBtc: 0.1,
  premiumPerMinContractBtc: 0.005,
  premiumPerMinContractUsd: 40,
  effectiveBuyCostPerBtc: null,
  summary: "测试",
  algorithmTags: [],
  reasons: [],
  risks: [],
  scoreBreakdown: [],
  scenarios: [],
  unsuitableScenarios: [],
  assignmentText: "测试",
  expiryPayoff: { premiumPerContractUsd: 40, breakEvenPrice: null, estimatedMonthlyUsd: null, estimatedAnnualUsd: null, scenarios: [] },
};

// --- resolveSide ---

test("resolveSide: covered-call -> sell", () => {
  assert.equal(resolveSide("covered-call"), "sell");
});

test("resolveSide: cash-secured-put -> sell", () => {
  assert.equal(resolveSide("cash-secured-put"), "sell");
});

test("resolveSide: long-call -> buy", () => {
  assert.equal(resolveSide("long-call"), "buy");
});

test("resolveLots: 正常返回 recommendation.maxLots", () => {
  assert.equal(resolveLots(baseRec), 1);
});

test("resolveLots: 超过单笔上限时截断为 10", () => {
  assert.equal(resolveLots({ ...baseRec, maxLots: 20 }), 10);
});

// --- resolveLimitPrice ---

test("resolveLimitPrice: 卖单优先用 bidPrice", () => {
  assert.equal(resolveLimitPrice(baseContract, "sell"), 0.005);
});

test("resolveLimitPrice: 买单优先用 askPrice", () => {
  assert.equal(resolveLimitPrice(baseContract, "buy"), 0.006);
});

test("resolveLimitPrice: 缺 bid 时卖单回退到 midPrice", () => {
  const c = { ...baseContract, bidPrice: null };
  assert.equal(resolveLimitPrice(c, "sell"), 0.0055);
});

test("resolveLimitPrice: 缺 ask 时买单回退到 midPrice", () => {
  const c = { ...baseContract, askPrice: null };
  assert.equal(resolveLimitPrice(c, "buy"), 0.0055);
});

test("resolveLimitPrice: 全部为 null 时返回 null", () => {
  const c = { ...baseContract, bidPrice: null, askPrice: null, midPrice: null, markPrice: null };
  assert.equal(resolveLimitPrice(c, "sell"), null);
});

// --- computeSlippagePercent ---

test("computeSlippagePercent: 正常偏差", () => {
  const result = computeSlippagePercent(0.005, 0.0055);
  assert.ok(result != null && result > 0);
});

test("computeSlippagePercent: markPrice 为 null 返回 null", () => {
  assert.equal(computeSlippagePercent(0.005, null), null);
});

// --- runPreflight ---

test("runPreflight: 正常 covered-call 通过", () => {
  const result = runPreflight({
    side: "sell",
    lots: 1,
    contractSizeBtc: 0.1,
    limitPriceBtc: 0.005,
    markPrice: 0.0055,
    underlyingPrice: 73000,
    availableBtc: 0.15,
    availableCashUsd: 10000,
    strategy: "covered-call",
    strike: 76000,
    environment: "testnet",
    mode: "dry-run",
  });
  assert.equal(result.passed, true);
  assert.equal(result.checks.every((c) => c.passed), true);
});

test("runPreflight: BTC 不足时 covered-call 不通过", () => {
  const result = runPreflight({
    side: "sell",
    lots: 1,
    contractSizeBtc: 0.1,
    limitPriceBtc: 0.005,
    markPrice: 0.0055,
    underlyingPrice: 73000,
    availableBtc: 0.05,
    availableCashUsd: 10000,
    strategy: "covered-call",
    strike: 76000,
    environment: "testnet",
    mode: "dry-run",
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((c) => c.key === "balance_sufficient" && !c.passed));
});

test("runPreflight: 现金不足时 CSP 不通过", () => {
  const result = runPreflight({
    side: "sell",
    lots: 1,
    contractSizeBtc: 0.1,
    limitPriceBtc: 0.005,
    markPrice: 0.0055,
    underlyingPrice: 73000,
    availableBtc: 0,
    availableCashUsd: 100,
    strategy: "cash-secured-put",
    strike: 76000,
    environment: "testnet",
    mode: "dry-run",
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((c) => c.key === "balance_sufficient" && !c.passed));
});

test("runPreflight: 无有效价格时不通过", () => {
  const result = runPreflight({
    side: "sell",
    lots: 1,
    contractSizeBtc: 0.1,
    limitPriceBtc: null,
    markPrice: null,
    underlyingPrice: 73000,
    availableBtc: 0.15,
    availableCashUsd: 10000,
    strategy: "covered-call",
    strike: 76000,
    environment: "testnet",
    mode: "dry-run",
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((c) => c.key === "market_data_complete" && !c.passed));
});

test("runPreflight: 生产环境未显式开启执行时不通过", () => {
  const result = runPreflight({
    side: "sell",
    lots: 1,
    contractSizeBtc: 0.1,
    limitPriceBtc: 0.005,
    markPrice: 0.0055,
    underlyingPrice: 73000,
    availableBtc: 0.15,
    availableCashUsd: 10000,
    strategy: "covered-call",
    strike: 76000,
    environment: "production",
    mode: "dry-run",
  });
  // dry-run 模式下 envAllowed 仍然通过（不发真实单）
  assert.ok(result.checks.some((c) => c.key === "environment_allowed" && c.passed));
});

test("runPreflight: dry-run 模式永远允许环境检查", () => {
  const result = runPreflight({
    side: "sell",
    lots: 1,
    contractSizeBtc: 0.1,
    limitPriceBtc: 0.005,
    markPrice: 0.0055,
    underlyingPrice: 73000,
    availableBtc: 0.15,
    availableCashUsd: 10000,
    strategy: "covered-call",
    strike: 76000,
    environment: "production",
    mode: "dry-run",
  });
  const envCheck = result.checks.find((c) => c.key === "environment_allowed");
  assert.ok(envCheck?.passed);
  assert.ok(envCheck?.message.includes("dry-run"));
});

test("runPreflight: execute + production 时环境检查不通过", () => {
  const result = runPreflight({
    side: "sell",
    lots: 1,
    contractSizeBtc: 0.1,
    limitPriceBtc: 0.005,
    markPrice: 0.0055,
    underlyingPrice: 73000,
    availableBtc: 0.15,
    availableCashUsd: 10000,
    strategy: "covered-call",
    strike: 76000,
    environment: "production",
    mode: "execute",
  });
  const envCheck = result.checks.find((c) => c.key === "environment_allowed");
  assert.equal(result.passed, false);
  assert.ok(envCheck && !envCheck.passed);
});

test("runPreflight: 滑点超过阈值时不通过", () => {
  const result = runPreflight({
    side: "sell",
    lots: 1,
    contractSizeBtc: 0.1,
    limitPriceBtc: 0.007,
    markPrice: 0.0055,
    underlyingPrice: 73000,
    availableBtc: 0.15,
    availableCashUsd: 10000,
    strategy: "covered-call",
    strike: 76000,
    environment: "testnet",
    mode: "dry-run",
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((c) => c.key === "slippage_ok" && !c.passed));
});

test("runPreflight: lots 超过上限时不通过", () => {
  const result = runPreflight({
    side: "sell",
    lots: 11,
    contractSizeBtc: 0.1,
    limitPriceBtc: 0.005,
    markPrice: 0.0055,
    underlyingPrice: 73000,
    availableBtc: 2,
    availableCashUsd: 1000000,
    strategy: "covered-call",
    strike: 76000,
    environment: "testnet",
    mode: "dry-run",
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((c) => c.key === "within_limits" && !c.passed));
});

test("runPreflight: 名义金额超过上限时不通过", () => {
  const result = runPreflight({
    side: "sell",
    lots: 2,
    contractSizeBtc: 0.1,
    limitPriceBtc: 0.005,
    markPrice: 0.0055,
    underlyingPrice: 600000,
    availableBtc: 1,
    availableCashUsd: 1000000,
    strategy: "covered-call",
    strike: 76000,
    environment: "testnet",
    mode: "dry-run",
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((c) => c.key === "within_limits" && !c.passed));
});

test("runPreflight: 缺少 underlyingPrice 时市场数据不完整", () => {
  const result = runPreflight({
    side: "sell",
    lots: 1,
    contractSizeBtc: 0.1,
    limitPriceBtc: 0.005,
    markPrice: 0.0055,
    underlyingPrice: null,
    availableBtc: 0.15,
    availableCashUsd: 10000,
    strategy: "covered-call",
    strike: 76000,
    environment: "testnet",
    mode: "dry-run",
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((c) => c.key === "market_data_complete" && !c.passed));
});

// --- buildTradePlan ---

test("buildTradePlan: 正常 covered-call 生成完整计划", () => {
  const plan = buildTradePlan({
    recommendation: baseRec,
    availableBtc: 0.15,
    availableCashUsd: 10000,
    environment: "testnet",
    mode: "dry-run",
  });

  assert.equal(plan.strategy, "covered-call");
  assert.equal(plan.side, "sell");
  assert.equal(plan.instrumentName, "BTC-25APR26-76000-C");
  assert.equal(plan.lots, 1);
  assert.equal(plan.contractSizeBtc, 0.1);
  assert.equal(plan.amountBtc, 0.1);
  assert.equal(plan.limitPriceBtc, 0.005);
  assert.equal(plan.environment, "testnet");
  assert.equal(plan.mode, "dry-run");
  assert.equal(plan.preflight.passed, true);
});

test("buildTradePlan: long-call 生成 buy 方向", () => {
  const lcRec: LongCallRecommendation = {
    contract: { ...baseContract, instrumentName: "BTC-20DEC26-76000-C", daysToExpiry: 240, expiration: "12月20日", expirationCode: "20DEC26", expirationTimestamp: Date.now() + 240 * 24 * 60 * 60 * 1000 },
    strategy: "long-call",
    score: 75,
    level: "优先考虑",
    tone: "balanced",
    maxLots: 2,
    maxTradeAmountBtc: 0.2,
    premiumPerMinContractBtc: 0.02,
    premiumPerMinContractUsd: 1460,
    maxLossUsd: 2920,
    breakEvenPrice: 77517,
    summary: "测试 long-call",
    algorithmTags: [],
    reasons: [],
    risks: [],
    scoreBreakdown: [],
    scenarios: [],
    unsuitableScenarios: [],
    expiryPayoff: { premiumPerContractUsd: 1460, breakEvenPrice: 77517, estimatedMonthlyUsd: null, estimatedAnnualUsd: null, scenarios: [] },
  };

  const plan = buildTradePlan({
    recommendation: lcRec,
    availableBtc: 0,
    availableCashUsd: 5000,
    environment: "testnet",
    mode: "dry-run",
  });

  assert.equal(plan.side, "buy");
  assert.equal(plan.lots, 2);
  assert.equal(plan.amountBtc, 0.2);
  assert.equal(plan.limitPriceBtc, 0.006);
});
