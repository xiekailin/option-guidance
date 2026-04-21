import assert from "node:assert/strict";
import test from "node:test";
import {
  buyOption,
  cancelOrder,
  getAccountBalance,
  getBaseUrl,
  getOrderStatus,
  getPositions,
  initTradingClient,
  sellOption,
} from "../lib/trading/deribit-trading";
import { configureDeribitNodeProxy, isDeribitNodeProxyConfigured, resetDeribitNodeProxyForTest } from "../lib/node/deribit-fetch";

function mockJsonResponse(payload: unknown, ok = true, status = 200, statusText = "OK") {
  return {
    ok,
    status,
    statusText,
    json: async () => payload,
  };
}

test("initTradingClient: testnet 切换 base url", () => {
  initTradingClient("id", "secret", true);
  assert.equal(getBaseUrl(), "https://test.deribit.com/api/v2");

  initTradingClient("id", "secret", false);
  assert.equal(getBaseUrl(), "https://www.deribit.com/api/v2");
});

test("sellOption: 发送 private/sell 请求并映射结果", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (input, init) => {
    assert.equal(String(input), "https://test.deribit.com/api/v2/private/sell");
    assert.equal(init?.method, "POST");
    assert.ok((init?.headers as Record<string, string>).Authorization.startsWith("deri-hmac-sha256 id=id,"));
    const body = JSON.parse(String(init?.body));
    assert.equal(body.method, "private/sell");
    assert.equal(body.params.instrument_name, "BTC-25APR26-76000-C");
    assert.equal(body.params.amount, 0.1);
    assert.equal(body.params.price, 0.005);
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        order_id: "order-1",
        order_state: "open",
        instrument_name: "BTC-25APR26-76000-C",
        amount: 0.1,
        filled_amount: 0,
        price: 0.005,
        order_type: "limit",
        creation_timestamp: 1700000000000,
      },
    }) as Response;
  });

  const result = await sellOption("BTC-25APR26-76000-C", 0.1, 0.005);
  assert.equal(result.orderId, "order-1");
  assert.equal(result.direction, "sell");
  fetchMock.mock.restore();
});

test("configureDeribitNodeProxy: 交易路径可复用全局代理", async () => {
  const originalHttpsProxy = process.env.HTTPS_PROXY;
  const originalFetch = global.fetch;
  process.env.HTTPS_PROXY = "http://127.0.0.1:7897";

  await configureDeribitNodeProxy();

  assert.equal(isDeribitNodeProxyConfigured(), true);
  delete process.env.HTTPS_PROXY;
  await configureDeribitNodeProxy();
  global.fetch = originalFetch;
  resetDeribitNodeProxyForTest();
  if (originalHttpsProxy == null) {
    delete process.env.HTTPS_PROXY;
  } else {
    process.env.HTTPS_PROXY = originalHttpsProxy;
  }
});

test("buyOption: 发送 private/buy 请求并映射结果", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.method, "private/buy");
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        order_id: "order-2",
        order_state: "filled",
        instrument_name: "BTC-20DEC26-76000-C",
        amount: 0.2,
        filled_amount: 0.2,
        price: 0.006,
        order_type: "limit",
        creation_timestamp: 1700000000001,
      },
    }) as Response;
  });

  const result = await buyOption("BTC-20DEC26-76000-C", 0.2, 0.006);
  assert.equal(result.orderId, "order-2");
  assert.equal(result.direction, "buy");
  fetchMock.mock.restore();
});

test("getAccountBalance: 正确映射账户字段", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        available_withdrawal_funds: 0.12,
        balance: 0.25,
        equity: 0.28,
      },
    }) as Response;
  });

  const balance = await getAccountBalance();
  assert.deepEqual(balance, {
    availableBtc: 0.12,
    totalBtc: 0.25,
    equityBtc: 0.28,
  });
  fetchMock.mock.restore();
});

test("getPositions: 正确映射持仓字段", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: body.id,
      result: [{
        instrument_name: "BTC-25APR26-76000-C",
        size: -0.1,
        direction: "sell",
        mark_price: 0.0055,
        unrealized_pnl: 10,
        open_orders_margin: 1,
        initial_margin: 2,
        maintenance_margin: 0.5,
      }],
    }) as Response;
  });

  const positions = await getPositions();
  assert.equal(positions[0]?.instrumentName, "BTC-25APR26-76000-C");
  assert.equal(positions[0]?.direction, "sell");
  fetchMock.mock.restore();
});

test("getOrderStatus: 正确映射订单状态", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        order_id: "order-3",
        order_state: "rejected",
        instrument_name: "BTC-25APR26-76000-C",
        amount: 0.1,
        filled_amount: 0,
        price: 0.005,
        direction: "sell",
        order_type: "limit",
        creation_timestamp: 1700000000002,
      },
    }) as Response;
  });

  const order = await getOrderStatus("order-3");
  assert.equal(order.orderState, "rejected");
  fetchMock.mock.restore();
});

test("cancelOrder: 发送 private/cancel 请求", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.method, "private/cancel");
    assert.equal(body.params.order_id, "order-4");
    return mockJsonResponse({ jsonrpc: "2.0", id: body.id, result: { ok: true } }) as Response;
  });

  await cancelOrder("order-4");
  fetchMock.mock.restore();
});

test("privateRequest: HTTP 错误时抛异常", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async () => {
    return mockJsonResponse({}, false, 500, "Server Error") as Response;
  });

  await assert.rejects(() => sellOption("BTC-25APR26-76000-C", 0.1, 0.005), /HTTP 500/);
  fetchMock.mock.restore();
});

test("privateRequest: JSON-RPC error 时抛异常", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: body.id,
      error: { code: 10001, message: "bad request" },
    }) as Response;
  });

  await assert.rejects(() => sellOption("BTC-25APR26-76000-C", 0.1, 0.005), /10001/);
  fetchMock.mock.restore();
});

test("privateRequest: 空 result 时抛异常", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({ jsonrpc: "2.0", id: body.id }) as Response;
  });

  await assert.rejects(() => sellOption("BTC-25APR26-76000-C", 0.1, 0.005), /空结果/);
  fetchMock.mock.restore();
});

test("privateRequest: null result 时抛异常", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({ jsonrpc: "2.0", id: body.id, result: null }) as Response;
  });

  await assert.rejects(() => sellOption("BTC-25APR26-76000-C", 0.1, 0.005), /空结果/);
  fetchMock.mock.restore();
});

test("privateRequest: 非 2.0 JSON-RPC 响应时抛异常", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({ jsonrpc: "1.0", id: body.id, result: {} }) as Response;
  });

  await assert.rejects(() => sellOption("BTC-25APR26-76000-C", 0.1, 0.005), /无效响应/);
  fetchMock.mock.restore();
});

test("privateRequest: 响应 ID 不匹配时抛异常", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async () => {
    return mockJsonResponse({ jsonrpc: "2.0", id: 999, result: {} }) as Response;
  });

  await assert.rejects(() => sellOption("BTC-25APR26-76000-C", 0.1, 0.005), /ID 不匹配/);
  fetchMock.mock.restore();
});

test("sellOption: 缺少关键字段时抛异常", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        order_state: "open",
        instrument_name: "BTC-25APR26-76000-C",
        amount: 0.1,
        filled_amount: 0,
        price: 0.005,
        order_type: "limit",
        creation_timestamp: 1700000000000,
      },
    }) as Response;
  });

  await assert.rejects(() => sellOption("BTC-25APR26-76000-C", 0.1, 0.005), /order_id/);
  fetchMock.mock.restore();
});

test("getOrderStatus: 非法方向时抛异常", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        order_id: "order-3",
        order_state: "rejected",
        instrument_name: "BTC-25APR26-76000-C",
        amount: 0.1,
        filled_amount: 0,
        price: 0.005,
        direction: "hold",
        order_type: "limit",
        creation_timestamp: 1700000000002,
      },
    }) as Response;
  });

  await assert.rejects(() => getOrderStatus("order-3"), /direction/);
  fetchMock.mock.restore();
});

test("getPositions: 非数组结果时抛异常", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({ jsonrpc: "2.0", id: body.id, result: {} }) as Response;
  });

  await assert.rejects(() => getPositions(), /无效结果/);
  fetchMock.mock.restore();
});

test("getAccountBalance: 缺少关键字段时抛异常", async (t) => {
  initTradingClient("id", "secret", true);
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    return mockJsonResponse({ jsonrpc: "2.0", id: body.id, result: {} }) as Response;
  });

  await assert.rejects(() => getAccountBalance(), /available_withdrawal_funds/);
  fetchMock.mock.restore();
});
