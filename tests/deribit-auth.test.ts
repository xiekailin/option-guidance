import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import {
  configureCredentials,
  createAuthHeader,
  getCredentials,
} from "../lib/trading/deribit-auth";

test("configureCredentials/getCredentials: 能保存并读取凭证", () => {
  configureCredentials("client-id", "client-secret");
  assert.deepEqual(getCredentials(), {
    clientId: "client-id",
    clientSecret: "client-secret",
  });
});

test("createAuthHeader: 生成稳定的 HMAC header", (t) => {
  configureCredentials("client-id", "client-secret");

  const dateNowMock = t.mock.method(Date, "now", () => 1700000000000);
  const randomBytesMock = t.mock.method(crypto, "randomBytes", () => Buffer.from("fixednonce123456", "utf8"));

  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "private/sell", params: { amount: 0.1 } });
  const header = createAuthHeader("post", "/api/v2/private/sell", body);

  assert.ok(header.startsWith("deri-hmac-sha256 id=client-id,ts=1700000000000,nonce="));
  assert.ok(header.includes(",sig="));
  assert.ok(header.includes("nonce=66697865646e6f6e6365313233343536"));
  assert.equal(
    header,
    "deri-hmac-sha256 id=client-id,ts=1700000000000,nonce=66697865646e6f6e6365313233343536,sig=b4895dfe7b916fc0d20920e3c0bfa88dec2cb69c27009ead1509fb5041259f8d",
  );

  dateNowMock.mock.restore();
  randomBytesMock.mock.restore();
});
