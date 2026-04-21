import { createAuthHeader, configureCredentials, getCredentials } from "./deribit-auth";

/**
 * Deribit 交易 API 客户端
 *
 * 所有交易接口使用 JSON-RPC 2.0 格式，通过 HMAC-SHA256 签名认证。
 */

// --- 类型定义 ---

export interface OrderResult {
  orderId: string;
  orderState: "open" | "filled" | "rejected" | "cancelled" | "untriggered";
  instrumentName: string;
  amount: number;
  filledAmount: number;
  price: number;
  direction: "sell" | "buy";
  orderType: "limit" | "market";
  createTime: number;
}

export interface BalanceInfo {
  availableBtc: number;
  totalBtc: number;
  equityBtc: number;
}

export interface PositionInfo {
  instrumentName: string;
  size: number;
  direction: "buy" | "sell";
  markPrice: number;
  unrealizedPnl: number;
  openOrderMargin: number;
  initialMargin: number;
  maintenanceMargin: number;
}

// --- 配置 ---

const PRODUCTION_BASE = "https://www.deribit.com/api/v2";
const TESTNET_BASE = "https://test.deribit.com/api/v2";

let _testnet = true;

export function configureTrading(testnet: boolean): void {
  _testnet = testnet;
}

export function getBaseUrl(): string {
  return _testnet ? TESTNET_BASE : PRODUCTION_BASE;
}

export function isTestnet(): boolean {
  return _testnet;
}

// --- JSON-RPC 请求 ---

let _requestId = 0;

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const ORDER_STATES = new Set<OrderResult["orderState"]>(["open", "filled", "rejected", "cancelled", "untriggered"]);
const ORDER_TYPES = new Set<OrderResult["orderType"]>(["limit", "market"]);
const DIRECTIONS = new Set<PositionInfo["direction"]>(["buy", "sell"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Deribit ${label} 缺少有效字段: ${key}`);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Deribit ${label} 缺少有效字段: ${key}`);
  }
  return value;
}

function readEnum<T extends string>(record: Record<string, unknown>, key: string, allowed: Set<T>, label: string): T {
  const value = record[key];
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`Deribit ${label} 缺少有效字段: ${key}`);
  }
  return value as T;
}

function parseJsonRpcResponse(record: Record<string, unknown>, expectedId: number): JsonRpcResponse<unknown> {
  if (record.jsonrpc !== "2.0") {
    throw new Error("Deribit API 返回无效响应: jsonrpc");
  }

  if (record.id !== expectedId) {
    throw new Error("Deribit API 响应 ID 不匹配");
  }

  const errorValue = record.error;
  if (errorValue !== undefined) {
    if (!isRecord(errorValue) || typeof errorValue.code !== "number" || typeof errorValue.message !== "string") {
      throw new Error("Deribit API 返回无效响应: error");
    }

    return {
      jsonrpc: "2.0",
      id: expectedId,
      error: {
        code: errorValue.code,
        message: errorValue.message,
        data: errorValue.data,
      },
    };
  }

  return {
    jsonrpc: "2.0",
    id: expectedId,
    result: record.result,
  };
}

function parseOrderResult(result: unknown, label: string, fixedDirection?: OrderResult["direction"]): OrderResult {
  if (!isRecord(result)) {
    throw new Error(`Deribit ${label} 返回无效结果`);
  }

  return {
    orderId: readString(result, "order_id", label),
    orderState: readEnum(result, "order_state", ORDER_STATES, label),
    instrumentName: readString(result, "instrument_name", label),
    amount: readNumber(result, "amount", label),
    filledAmount: readNumber(result, "filled_amount", label),
    price: readNumber(result, "price", label),
    direction: fixedDirection ?? readEnum(result, "direction", DIRECTIONS, label),
    orderType: readEnum(result, "order_type", ORDER_TYPES, label),
    createTime: readNumber(result, "creation_timestamp", label),
  };
}

function parseBalanceInfo(result: unknown): BalanceInfo {
  if (!isRecord(result)) {
    throw new Error("无法获取账户信息");
  }

  return {
    availableBtc: readNumber(result, "available_withdrawal_funds", "account_summary"),
    totalBtc: readNumber(result, "balance", "account_summary"),
    equityBtc: readNumber(result, "equity", "account_summary"),
  };
}

function parsePosition(result: unknown): PositionInfo {
  if (!isRecord(result)) {
    throw new Error("Deribit positions 返回无效结果");
  }

  return {
    instrumentName: readString(result, "instrument_name", "position"),
    size: readNumber(result, "size", "position"),
    direction: readEnum(result, "direction", DIRECTIONS, "position"),
    markPrice: readNumber(result, "mark_price", "position"),
    unrealizedPnl: readNumber(result, "unrealized_pnl", "position"),
    openOrderMargin: readNumber(result, "open_orders_margin", "position"),
    initialMargin: readNumber(result, "initial_margin", "position"),
    maintenanceMargin: readNumber(result, "maintenance_margin", "position"),
  };
}

/**
 * 发送认证的 JSON-RPC 请求到 Deribit private 接口
 */
async function privateRequest<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("API 凭证未配置。请在 .env.local 中设置 DERIBIT_CLIENT_ID 和 DERIBIT_CLIENT_SECRET");
  }

  const uri = "/api/v2/" + method;
  const requestId = ++_requestId;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: requestId,
    method,
    params,
  });

  const authHeader = createAuthHeader("POST", uri, body);
  const url = `${getBaseUrl()}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Deribit API HTTP ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as unknown;

  if (!isRecord(json)) {
    throw new Error("Deribit API 返回无效响应");
  }

  const rpc = parseJsonRpcResponse(json, requestId);

  if (rpc.error) {
    throw new Error(`Deribit API 错误 [${rpc.error.code}]: ${rpc.error.message}`);
  }

  if (rpc.result == null) {
    throw new Error("Deribit API 返回空结果");
  }

  return rpc.result as T;
}

// --- 交易接口 ---

/**
 * 卖出期权（用于 covered call / cash-secured put）
 */
export async function sellOption(
  instrumentName: string,
  amount: number,
  price: number,
  options?: {
    type?: "limit" | "market";
    postOnly?: boolean;
    timeInForce?: "good_til_cancelled" | "good_til_day" | "fill_or_kill" | "immediate_or_cancel";
  },
): Promise<OrderResult> {
  const params: Record<string, unknown> = {
    instrument_name: instrumentName,
    amount,
    price,
    type: options?.type ?? "limit",
    time_in_force: options?.timeInForce ?? "good_til_cancelled",
  };

  if (options?.postOnly != null) {
    params.post_only = options.postOnly;
    params.reject_post_only = true;
  }

  const result = await privateRequest<unknown>("private/sell", params);
  return parseOrderResult(result, "sell", "sell");
}

/**
 * 买入期权（用于 long call / synthetic long）
 */
export async function buyOption(
  instrumentName: string,
  amount: number,
  price: number,
  options?: {
    type?: "limit" | "market";
    timeInForce?: "good_til_cancelled" | "good_til_day" | "fill_or_kill" | "immediate_or_cancel";
  },
): Promise<OrderResult> {
  const params: Record<string, unknown> = {
    instrument_name: instrumentName,
    amount,
    price,
    type: options?.type ?? "limit",
    time_in_force: options?.timeInForce ?? "good_til_cancelled",
  };

  const result = await privateRequest<unknown>("private/buy", params);
  return parseOrderResult(result, "buy", "buy");
}

/**
 * 获取账户 BTC 余额
 */
export async function getAccountBalance(): Promise<BalanceInfo> {
  const account = await privateRequest<unknown>("private/get_account_summary", {
    currency: "BTC",
  });

  return parseBalanceInfo(account);
}

/**
 * 获取当前期权持仓
 */
export async function getPositions(): Promise<PositionInfo[]> {
  const result = await privateRequest<unknown>("private/get_positions", {
    currency: "BTC",
    kind: "option",
  });

  if (!Array.isArray(result)) {
    throw new Error("Deribit positions 返回无效结果");
  }

  return result.map((pos) => parsePosition(pos));
}

/**
 * 取消订单
 */
export async function cancelOrder(orderId: string): Promise<void> {
  await privateRequest("private/cancel", { order_id: orderId });
}

/**
 * 获取订单状态
 */
export async function getOrderStatus(orderId: string): Promise<OrderResult> {
  const result = await privateRequest<unknown>("private/get_order_state", {
    order_id: orderId,
  });

  return parseOrderResult(result, "get_order_state");
}

/**
 * 初始化交易客户端
 */
export function initTradingClient(clientId: string, clientSecret: string, testnet: boolean): void {
  configureCredentials(clientId, clientSecret);
  configureTrading(testnet);
}
