import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapNodeProxy, resolveSimulatedBalance, runLocalSimulation, tradeFlow, tradeFlowLongCall } from "../scripts/trade";
import { resetDeribitNodeProxyForTest } from "../lib/node/deribit-fetch";
import type { LongCallRecommendation, Recommendation } from "../lib/types/option";

const baseRecommendation: Recommendation = {
  contract: {
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
  },
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

const longCallRecommendation: LongCallRecommendation = {
  contract: {
    ...baseRecommendation.contract,
    instrumentName: "BTC-20DEC26-76000-C",
    expirationCode: "20DEC26",
    expiration: "12月20日",
    expirationTimestamp: Date.now() + 240 * 24 * 60 * 60 * 1000,
    daysToExpiry: 240,
  },
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

test("tradeFlow: dry-run 不会调用 sellOption", async (t) => {
  const sellCalls: unknown[][] = [];
  const logMock = t.mock.method(console, "log", () => undefined);

  await tradeFlow(
    [baseRecommendation],
    { availableBtc: 0.15, equityBtc: 0.15, availableCashUsd: 10950 },
    "testnet",
    true,
    async () => "1",
    async (...args) => {
      sellCalls.push(args);
      throw new Error("should not be called");
    },
  );

  assert.equal(sellCalls.length, 0);
  assert.ok(logMock.mock.calls.some((call) => String(call.arguments[0]).includes("dry-run 模式")));
  logMock.mock.restore();
});

test("tradeFlow: execute + 非 CONFIRM 时不下单", async (t) => {
  const sellCalls: unknown[][] = [];
  const logMock = t.mock.method(console, "log", () => undefined);
  let askCount = 0;

  await tradeFlow(
    [baseRecommendation],
    { availableBtc: 0.15, equityBtc: 0.15, availableCashUsd: 10950 },
    "testnet",
    false,
    async () => (askCount++ === 0 ? "1" : "NO"),
    async (...args) => {
      sellCalls.push(args);
      throw new Error("should not be called");
    },
  );

  assert.equal(sellCalls.length, 0);
  assert.ok(logMock.mock.calls.some((call) => String(call.arguments[0]).includes("已取消")));
  logMock.mock.restore();
});

test("tradeFlow: execute + CONFIRM 时调用 sellOption 且参数来自 plan", async (t) => {
  const sellCalls: unknown[][] = [];
  const logMock = t.mock.method(console, "log", () => undefined);
  let askCount = 0;

  await tradeFlow(
    [baseRecommendation],
    { availableBtc: 0.15, equityBtc: 0.15, availableCashUsd: 10950 },
    "testnet",
    false,
    async () => (askCount++ === 0 ? "1" : "CONFIRM"),
    async (...args) => {
      sellCalls.push(args);
      return {
        orderId: "order-1",
        orderState: "open" as const,
        instrumentName: String(args[0]),
        amount: Number(args[1]),
        filledAmount: 0,
        price: Number(args[2]),
        direction: "sell" as const,
        orderType: "limit" as const,
        createTime: 1700000000000,
      };
    },
  );

  assert.equal(sellCalls.length, 1);
  const [instrumentName, amount, price] = sellCalls[0]!;
  assert.equal(instrumentName, "BTC-25APR26-76000-C");
  assert.equal(amount, 0.1);
  assert.equal(price, 0.005);
  logMock.mock.restore();
});

test("tradeFlowLongCall: execute + CONFIRM 时调用 buyOption", async (t) => {
  const buyCalls: unknown[][] = [];
  const logMock = t.mock.method(console, "log", () => undefined);
  let askCount = 0;

  await tradeFlowLongCall(
    [longCallRecommendation],
    { availableBtc: 0.15, equityBtc: 0.15, availableCashUsd: 10950 },
    "testnet",
    false,
    async () => (askCount++ === 0 ? "1" : "CONFIRM"),
    async (...args) => {
      buyCalls.push(args);
      return {
        orderId: "order-2",
        orderState: "filled" as const,
        instrumentName: String(args[0]),
        amount: Number(args[1]),
        filledAmount: Number(args[1]),
        price: Number(args[2]),
        direction: "buy" as const,
        orderType: "limit" as const,
        createTime: 1700000000001,
      };
    },
  );

  assert.equal(buyCalls.length, 1);
  const [instrumentName, amount, price] = buyCalls[0]!;
  assert.equal(instrumentName, "BTC-20DEC26-76000-C");
  assert.equal(amount, 0.2);
  assert.equal(price, 0.006);
  logMock.mock.restore();
});

test("tradeFlow: preflight 不通过时不会下单", async (t) => {
  const sellCalls: unknown[][] = [];
  const logMock = t.mock.method(console, "log", () => undefined);

  await tradeFlow(
    [{ ...baseRecommendation, maxLots: 2 }],
    { availableBtc: 0.05, equityBtc: 0.05, availableCashUsd: 3650 },
    "testnet",
    false,
    async () => "1",
    async (...args) => {
      sellCalls.push(args);
      throw new Error("should not be called");
    },
  );

  assert.equal(sellCalls.length, 0);
  assert.ok(logMock.mock.calls.some((call) => String(call.arguments[0]).includes("preflight 检查未通过")));
  logMock.mock.restore();
});

test("resolveSimulatedBalance: covered-call 在交互输入下返回模拟 BTC 余额", async () => {
  const balance = await resolveSimulatedBalance("covered-call", async () => "1.25");
  assert.equal(balance.availableBtc, 1.25);
  assert.equal(balance.availableCashUsd, 0);
  assert.equal(balance.simulated, true);
});

test("resolveSimulatedBalance: long-call 在交互输入下返回模拟现金余额", async () => {
  const balance = await resolveSimulatedBalance("long-call", async () => "5000");
  assert.equal(balance.availableBtc, 0);
  assert.equal(balance.availableCashUsd, 5000);
  assert.equal(balance.simulated, true);
});

test("tradeFlowLongCall: dry-run 使用 availableCashUsd 做 preflight，不依赖 BTC 折算", async (t) => {
  const buyCalls: unknown[][] = [];
  const logMock = t.mock.method(console, "log", () => undefined);

  await tradeFlowLongCall(
    [longCallRecommendation],
    { availableBtc: 0, equityBtc: 0, availableCashUsd: 5000 },
    "testnet",
    true,
    async () => "1",
    async (...args) => {
      buyCalls.push(args);
      throw new Error("should not be called");
    },
  );

  assert.equal(buyCalls.length, 0);
  assert.ok(logMock.mock.calls.some((call) => String(call.arguments[0]).includes("dry-run 模式")));
  logMock.mock.restore();
});

test("bootstrapNodeProxy: 有代理时会包装全局 fetch", async (t) => {
  const originalHttpsProxy = process.env.HTTPS_PROXY;
  const originalFetch = global.fetch;
  process.env.HTTPS_PROXY = "http://127.0.0.1:7897";
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    assert.ok(init && "dispatcher" in init);
    return {
      ok: true,
      json: async () => ({ result: { ok: true } }),
    } as Response;
  });

  await bootstrapNodeProxy();
  await fetch("https://example.com");

  fetchMock.mock.restore();
  delete process.env.HTTPS_PROXY;
  await bootstrapNodeProxy();
  global.fetch = originalFetch;
  resetDeribitNodeProxyForTest();
  if (originalHttpsProxy == null) {
    delete process.env.HTTPS_PROXY;
  } else {
    process.env.HTTPS_PROXY = originalHttpsProxy;
  }
});

test("runLocalSimulation: 无凭证下可基于公开行情和模拟余额跑通 list 模式", async (t) => {
  const fetchMock = t.mock.method(global, "fetch", async (input) => {
    const url = String(input);
    if (url.includes("get_index_price")) {
      return {
        ok: true,
        json: async () => ({ result: { index_price: 73000 } }),
      } as Response;
    }
    if (url.includes("get_book_summary_by_currency")) {
      return {
        ok: true,
        json: async () => ({
          result: [
            {
              instrument_name: "BTC-25APR26-76000-C",
              option_type: "call",
              strike: 76000,
              creation_timestamp: 0,
              expiration_timestamp: Date.now() + 7 * 24 * 60 * 60 * 1000,
              bid_price: 0.005,
              ask_price: 0.006,
              mark_price: 0.0055,
              underlying_price: 73000,
              mark_iv: 42,
              interest_rate: 0,
              open_interest: 12,
              volume: 4,
            },
          ],
        }),
      } as Response;
    }
    throw new Error(`unexpected url: ${url}`);
  });
  const logMock = t.mock.method(console, "log", () => undefined);

  await runLocalSimulation(async () => "1");

  assert.ok(logMock.mock.calls.some((call) => String(call.arguments[0]).includes("本地模拟")));
  assert.ok(logMock.mock.calls.some((call) => String(call.arguments[0]).includes("当前条件下没有推荐合约") || String(call.arguments[0]).includes("合约")));
  fetchMock.mock.restore();
  logMock.mock.restore();
});
