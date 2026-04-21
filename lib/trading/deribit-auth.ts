import { createHmac, randomBytes } from "node:crypto";

/**
 * Deribit HMAC-SHA256 签名认证
 *
 * Authorization header 格式:
 *   deri-hmac-sha256 id=ClientId,ts=Timestamp,nonce=Nonce,sig=Signature
 *
 * 签名计算:
 *   RequestData  = UPPERCASE(METHOD) + "\n" + URI + "\n" + Body + "\n"
 *   StringToSign = Timestamp + "\n" + Nonce + "\n" + RequestData
 *   Signature    = HEX(HMAC-SHA256(ClientSecret, StringToSign))
 */

let _clientId = "";
let _clientSecret = "";

export function configureCredentials(clientId: string, clientSecret: string): void {
  _clientId = clientId;
  _clientSecret = clientSecret;
}

export function getCredentials(): { clientId: string; clientSecret: string } {
  return { clientId: _clientId, clientSecret: _clientSecret };
}

/**
 * 生成 Deribit HMAC-SHA256 Authorization header
 */
export function createAuthHeader(method: string, uri: string, body: string): string {
  const ts = Date.now();
  const nonce = randomBytes(16).toString("hex");

  const requestData = `${method.toUpperCase()}\n${uri}\n${body}\n`;
  const stringToSign = `${ts}\n${nonce}\n${requestData}`;
  const signature = createHmac("sha256", _clientSecret).update(stringToSign).digest("hex");

  return `deri-hmac-sha256 id=${_clientId},ts=${ts},nonce=${nonce},sig=${signature}`;
}
