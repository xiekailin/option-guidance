import assert from "node:assert/strict";
import test from "node:test";
import { DeribitApiError, fetchDeribitJson } from "../lib/market/deribit";
import { configureDeribitNodeProxy, isDeribitNodeProxyConfigured, resetDeribitNodeProxyForTest } from "../lib/node/deribit-fetch";

const originalSetTimeout = global.setTimeout;
const originalHttpsProxy = process.env.HTTPS_PROXY;

function mockJsonResponse(payload: unknown, ok = true, status = 200, statusText = "OK") {
  return {
    ok,
    status,
    statusText,
    json: async () => payload,
  };
}

test("configureDeribitNodeProxy: 配置代理时会包装全局 fetch", async (t) => {
  process.env.HTTPS_PROXY = "http://127.0.0.1:7897";
  const originalFetch = global.fetch;
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    assert.ok(init && "dispatcher" in init);
    return mockJsonResponse({ result: { ok: true } }) as Response;
  });

  await configureDeribitNodeProxy();
  await fetch("https://example.com");

  assert.equal(isDeribitNodeProxyConfigured(), true);
  fetchMock.mock.restore();
  global.fetch = originalFetch;
  resetDeribitNodeProxyForTest();
  if (originalHttpsProxy == null) {
    delete process.env.HTTPS_PROXY;
  } else {
    process.env.HTTPS_PROXY = originalHttpsProxy;
  }
});

test("configureDeribitNodeProxy: 清掉代理后会恢复原始 fetch", async (t) => {
  const initialFetch = global.fetch;
  process.env.HTTPS_PROXY = "http://127.0.0.1:7897";
  const proxiedFetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    assert.ok(init && "dispatcher" in init);
    return mockJsonResponse({ result: { ok: true } }) as Response;
  });

  await configureDeribitNodeProxy();
  await fetch("https://example.com");
  proxiedFetchMock.mock.restore();

  delete process.env.HTTPS_PROXY;
  await configureDeribitNodeProxy();

  const restoredFetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    assert.ok(init && !("dispatcher" in init));
    return mockJsonResponse({ result: { ok: true } }) as Response;
  });

  await fetchDeribitJson<{ ok: boolean }>("/dummy");

  assert.equal(isDeribitNodeProxyConfigured(), false);
  restoredFetchMock.mock.restore();
  global.fetch = initialFetch;
  resetDeribitNodeProxyForTest();
  if (originalHttpsProxy != null) {
    process.env.HTTPS_PROXY = originalHttpsProxy;
  }
});

test("fetchDeribitJson: 无代理时仍按原样请求", async (t) => {
  delete process.env.HTTPS_PROXY;
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    assert.ok(init && !("dispatcher" in init));
    return mockJsonResponse({ result: { ok: true } }) as Response;
  });

  await fetchDeribitJson<{ ok: boolean }>("/dummy");

  fetchMock.mock.restore();
  resetDeribitNodeProxyForTest();
  if (originalHttpsProxy != null) {
    process.env.HTTPS_PROXY = originalHttpsProxy;
  }
});

test("fetchDeribitJson: 使用 15 秒超时", async (t) => {
  const delays: number[] = [];
  const setTimeoutMock = t.mock.method(global, "setTimeout", ((handler: TimerHandler, timeout?: number) => {
    delays.push(Number(timeout));
    return originalSetTimeout(() => {
      if (typeof handler === "function") {
        handler();
      }
    }, 0);
  }) as typeof setTimeout);
  const fetchMock = t.mock.method(global, "fetch", async () => {
    return mockJsonResponse({ result: { ok: true } }) as Response;
  });

  await fetchDeribitJson<{ ok: boolean }>("/dummy");

  assert.equal(delays[0], 15_000);
  fetchMock.mock.restore();
  setTimeoutMock.mock.restore();
});

test("fetchDeribitJson: 首次超时后重试一次并成功返回", async (t) => {
  let attempts = 0;
  const fetchMock = t.mock.method(global, "fetch", async (_input, init) => {
    attempts += 1;
    const signal = init?.signal as AbortSignal;
    if (attempts === 1) {
      assert.ok(signal);
      signal.dispatchEvent(new Event("abort"));
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }
    return mockJsonResponse({ result: { index_price: 73000 } }) as Response;
  });

  const result = await fetchDeribitJson<{ index_price: number }>("/get_index_price?index_name=btc_usd");
  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(result.index_price, 73000);
  fetchMock.mock.restore();
});

test("fetchDeribitJson: 首次网络错误后重试一次并成功返回", async (t) => {
  let attempts = 0;
  const fetchMock = t.mock.method(global, "fetch", async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new TypeError("fetch failed");
    }
    return mockJsonResponse({ result: [1, 2, 3] }) as Response;
  });

  const result = await fetchDeribitJson<number[]>("/dummy");
  assert.equal(fetchMock.mock.calls.length, 2);
  assert.deepEqual(result, [1, 2, 3]);
  fetchMock.mock.restore();
});

test("fetchDeribitJson: 503 后重试一次并成功返回", async (t) => {
  let attempts = 0;
  const fetchMock = t.mock.method(global, "fetch", async () => {
    attempts += 1;
    if (attempts === 1) {
      return mockJsonResponse({}, false, 503, "Service Unavailable") as Response;
    }
    return mockJsonResponse({ result: { ok: true } }) as Response;
  });

  const result = await fetchDeribitJson<{ ok: boolean }>("/dummy");
  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(result.ok, true);
  fetchMock.mock.restore();
});

test("fetchDeribitJson: 404 不重试并直接抛错", async (t) => {
  const fetchMock = t.mock.method(global, "fetch", async () => {
    return mockJsonResponse({}, false, 404, "Not Found") as Response;
  });

  await assert.rejects(
    () => fetchDeribitJson("/missing"),
    (error) => error instanceof DeribitApiError && error.code === "UPSTREAM_BAD_STATUS",
  );
  assert.equal(fetchMock.mock.calls.length, 1);
  fetchMock.mock.restore();
});

test("fetchDeribitJson: payload 缺少 result 时不重试", async (t) => {
  const fetchMock = t.mock.method(global, "fetch", async () => {
    return mockJsonResponse({ jsonrpc: "2.0" }) as Response;
  });

  await assert.rejects(
    () => fetchDeribitJson("/invalid"),
    (error) => error instanceof DeribitApiError && error.code === "UPSTREAM_INVALID_PAYLOAD",
  );
  assert.equal(fetchMock.mock.calls.length, 1);
  fetchMock.mock.restore();
});

test("fetchDeribitJson: 两次超时后抛出超时错误", async (t) => {
  const fetchMock = t.mock.method(global, "fetch", async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  });

  await assert.rejects(
    () => fetchDeribitJson("/timeout"),
    (error) => error instanceof DeribitApiError && error.code === "UPSTREAM_TIMEOUT",
  );
  assert.equal(fetchMock.mock.calls.length, 2);
  fetchMock.mock.restore();
});
