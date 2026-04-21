import { getMinContractSizeBtc } from "../domain/calculations";
import type {
  LongCallRecommendation,
  OptionContract,
  PreflightCheck,
  Recommendation,
  StrategyType,
  TradeEnvironment,
  TradeMode,
  TradePlan,
  TradePreflightResult,
  TradeSide,
} from "../types/option";

const MAX_LOTS_PER_TRADE = 10;
const MAX_NOTIONAL_USD = 100_000;
const MAX_SLIPPAGE_PERCENT = 15;

export function resolveSide(strategy: StrategyType): TradeSide {
  if (strategy === "long-call") return "buy";
  return "sell";
}

export function resolveLots(
  recommendation: Recommendation | LongCallRecommendation,
): number {
  return Math.min(recommendation.maxLots, MAX_LOTS_PER_TRADE);
}

export function resolveLimitPrice(
  contract: OptionContract,
  side: TradeSide,
): number | null {
  if (side === "sell") {
    if (contract.bidPrice != null && contract.bidPrice > 0) return contract.bidPrice;
    if (contract.midPrice != null && contract.midPrice > 0) return contract.midPrice;
    if (contract.markPrice != null && contract.markPrice > 0) return contract.markPrice;
  } else {
    if (contract.askPrice != null && contract.askPrice > 0) return contract.askPrice;
    if (contract.midPrice != null && contract.midPrice > 0) return contract.midPrice;
    if (contract.markPrice != null && contract.markPrice > 0) return contract.markPrice;
  }
  return null;
}

export function computeSlippagePercent(
  limitPrice: number,
  markPrice: number | null,
): number | null {
  if (!markPrice || markPrice <= 0) return null;
  return Math.abs(limitPrice - markPrice) / markPrice * 100;
}

export function runPreflight(params: {
  side: TradeSide;
  lots: number;
  contractSizeBtc: number;
  limitPriceBtc: number | null;
  markPrice: number | null;
  underlyingPrice: number | null;
  availableBtc: number;
  availableCashUsd: number;
  strategy: StrategyType;
  strike: number;
  environment: TradeEnvironment;
  mode: TradeMode;
}): TradePreflightResult {
  const checks: PreflightCheck[] = [];

  const hasPrice = params.limitPriceBtc != null && params.limitPriceBtc > 0;
  checks.push({
    key: "market_data_complete",
    passed: hasPrice && params.underlyingPrice != null,
    message: !hasPrice ? "合约缺少可用的买卖价格，无法确定限价" : params.underlyingPrice == null ? "缺少标的当前价格" : "市场数据完整",
  });

  if (hasPrice) {
    const slippage = computeSlippagePercent(params.limitPriceBtc!, params.markPrice);
    const slippageOk = slippage == null || slippage <= MAX_SLIPPAGE_PERCENT;
    checks.push({
      key: "slippage_ok",
      passed: slippageOk,
      message: slippageOk
        ? `限价与标记价偏差 ${slippage?.toFixed(1) ?? "未知"}%`
        : `限价偏差 ${slippage!.toFixed(1)}% 超过 ${MAX_SLIPPAGE_PERCENT}% 阈值`,
    });
  } else {
    checks.push({ key: "slippage_ok", passed: false, message: "无有效限价，无法检查偏差" });
  }

  if (hasPrice) {
    checks.push({
      key: "price_valid",
      passed: true,
      message: `限价 ${params.limitPriceBtc!.toFixed(5)} BTC`,
    });
  } else {
    checks.push({ key: "price_valid", passed: false, message: "无有效限价" });
  }

  const amountBtc = params.lots * params.contractSizeBtc;
  const notionalUsd = amountBtc * (params.underlyingPrice ?? 0);

  if (params.strategy === "covered-call") {
    const needed = amountBtc;
    checks.push({
      key: "balance_sufficient",
      passed: params.availableBtc >= needed,
      message: params.availableBtc >= needed
        ? `需要 ${needed.toFixed(3)} BTC 覆盖，可用 ${params.availableBtc.toFixed(3)} BTC`
        : `需要 ${needed.toFixed(3)} BTC 覆盖，但只有 ${params.availableBtc.toFixed(3)} BTC`,
    });
  } else if (params.strategy === "cash-secured-put") {
    const needed = params.strike * amountBtc;
    checks.push({
      key: "balance_sufficient",
      passed: params.availableCashUsd >= needed,
      message: params.availableCashUsd >= needed
        ? `需要 $${needed.toLocaleString()} 现金担保，可用 $${params.availableCashUsd.toLocaleString()}`
        : `需要 $${needed.toLocaleString()} 现金担保，但只有 $${params.availableCashUsd.toLocaleString()}`,
    });
  } else if (params.strategy === "long-call") {
    const cost = amountBtc * (params.limitPriceBtc ?? 0) * (params.underlyingPrice ?? 0);
    checks.push({
      key: "balance_sufficient",
      passed: params.availableCashUsd >= cost,
      message: params.availableCashUsd >= cost
        ? `权利金成本 ~$${cost.toFixed(0)}，可用 $${params.availableCashUsd.toLocaleString()}`
        : `权利金成本 ~$${cost.toFixed(0)}，但只有 $${params.availableCashUsd.toLocaleString()}`,
    });
  }

  const withinLots = params.lots <= MAX_LOTS_PER_TRADE;
  const withinNotional = notionalUsd <= MAX_NOTIONAL_USD;
  checks.push({
    key: "within_limits",
    passed: withinLots && withinNotional,
    message: !withinLots
      ? `张数 ${params.lots} 超过单笔上限 ${MAX_LOTS_PER_TRADE}`
      : !withinNotional
        ? `名义 $${notionalUsd.toFixed(0)} 超过单笔上限 $${MAX_NOTIONAL_USD.toLocaleString()}`
        : `张数 ${params.lots}，名义 $${notionalUsd.toFixed(0)}`,
  });

  const envAllowed = params.mode === "dry-run" || params.environment === "testnet";
  checks.push({
    key: "environment_allowed",
    passed: envAllowed,
    message: params.mode === "dry-run"
      ? "dry-run 模式，不会发送真实订单"
      : params.environment === "testnet"
        ? "测试网执行"
        : "生产环境需要显式 --execute 开关",
  });

  const allPassed = checks.every((c) => c.passed);
  const premiumUsd = hasPrice && params.underlyingPrice
    ? amountBtc * params.limitPriceBtc! * params.underlyingPrice
    : null;
  const costUsd = params.strategy === "long-call" ? premiumUsd : null;

  return {
    passed: allPassed,
    checks,
    estimatedPremiumUsd: params.side === "sell" ? premiumUsd : null,
    estimatedCostUsd: costUsd,
    notionalUsd,
  };
}

export function buildTradePlan(params: {
  recommendation: Recommendation | LongCallRecommendation;
  availableBtc: number;
  availableCashUsd: number;
  environment: TradeEnvironment;
  mode: TradeMode;
}): TradePlan {
  const { recommendation, availableBtc, availableCashUsd, environment, mode } = params;
  const contract = recommendation.contract;
  const strategy = recommendation.strategy;
  const side = resolveSide(strategy);
  const lots = Math.max(1, resolveLots(recommendation));
  const contractSizeBtc = getMinContractSizeBtc();
  const amountBtc = lots * contractSizeBtc;
  const limitPriceBtc = resolveLimitPrice(contract, side);
  const limitPriceUsd = limitPriceBtc != null && contract.underlyingPrice != null
    ? limitPriceBtc * contract.underlyingPrice
    : null;

  const preflight = runPreflight({
    side,
    lots,
    contractSizeBtc,
    limitPriceBtc,
    markPrice: contract.markPrice,
    underlyingPrice: contract.underlyingPrice,
    availableBtc,
    availableCashUsd,
    strategy,
    strike: contract.strike,
    environment,
    mode,
  });

  return {
    strategy,
    side,
    instrumentName: contract.instrumentName,
    lots,
    contractSizeBtc,
    amountBtc,
    limitPriceBtc: limitPriceBtc ?? 0,
    limitPriceUsd,
    estimatedPremiumUsd: preflight.estimatedPremiumUsd,
    estimatedCostUsd: preflight.estimatedCostUsd,
    notionalUsd: preflight.notionalUsd,
    maxLossUsd: strategy === "long-call" ? preflight.estimatedCostUsd : null,
    breakEvenPrice: null,
    environment,
    mode,
    preflight,
  };
}
