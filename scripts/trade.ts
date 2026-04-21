/**
 * Deribit 期权交易 CLI（安全版）
 *
 * 默认 dry-run，不会发送真实订单。
 * 要执行真实交易需要同时传入 --prod --execute。
 *
 * 用法:
 *   npx tsx scripts/trade.ts                     # 交互式（默认 dry-run）
 *   npx tsx scripts/trade.ts --list               # 只看推荐不下单
 *   npx tsx scripts/trade.ts --positions           # 查看当前持仓
 *   npx tsx scripts/trade.ts --order-status=ID     # 查询订单状态
 *   npx tsx scripts/trade.ts --cancel=ID           # 撤销订单
 *   npx tsx scripts/trade.ts --prod --execute      # 生产环境真实执行
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { configureDeribitNodeProxy } from "@/lib/node/deribit-fetch";
import {
  initTradingClient,
  getAccountBalance,
  getPositions,
  sellOption,
  buyOption,
  cancelOrder,
  getOrderStatus,
  type OrderResult,
} from "@/lib/trading/deribit-trading";
import { fetchBtcTicker, fetchOptionsChain } from "@/lib/market/deribit-client";
import { buildRecommendations } from "@/lib/domain/recommendation";
import { buildSyntheticLongRecommendations } from "@/lib/domain/synthetic-long";
import { buildLongCallRecommendations } from "@/lib/domain/long-call";
import { buildTradePlan } from "@/lib/trading/trade-planner";
import type {
  RecommendationInput,
  Recommendation,
  SyntheticLongRecommendation,
  LongCallRecommendation,
  StrategyType,
  TradeEnvironment,
} from "@/lib/types/option";

// --- CLI 参数 ---

const args = process.argv.slice(2);

function readArgValue(flag: string): string | undefined {
  return args.find((a) => a.startsWith(`${flag}=`))?.split("=")[1]
    ?? (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

const strategyArg = readArgValue("--strategy");
const listOnly = args.includes("--list");
const showPositions = args.includes("--positions");
const prodMode = args.includes("--prod");
const executeMode = args.includes("--execute");
const localSimMode = args.includes("--local-sim");
const simBtcArg = parseOptionalNumber(readArgValue("--sim-btc"));
const simCashUsdArg = parseOptionalNumber(readArgValue("--sim-cash-usd"));
const orderStatusArg = readArgValue("--order-status");
const cancelArg = readArgValue("--cancel");
const PROXY_ENV_KEYS = ["HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY"] as const;

// --- 环境变量 ---

export async function bootstrapNodeProxy(): Promise<void> {
  await configureDeribitNodeProxy();
}

export async function loadEnv(): Promise<{ clientId: string; clientSecret: string; testnet: boolean }> {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error("错误: 找不到 .env.local 文件");
    console.error("请复制 .env.local.example 为 .env.local 并填入 API 凭证:");
    console.error("  cp .env.local.example .env.local");
    process.exit(1);
  }

  const content = readFileSync(envPath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val) vars[key] = val;
  }

  for (const key of PROXY_ENV_KEYS) {
    if (!process.env[key] && vars[key]) {
      process.env[key] = vars[key];
    }
  }

  const clientId = vars.DERIBIT_CLIENT_ID;
  const clientSecret = vars.DERIBIT_CLIENT_SECRET;
  const testnet = vars.DERIBIT_TESTNET !== "false";

  if (!clientId || !clientSecret) {
    console.error("错误: DERIBIT_CLIENT_ID 或 DERIBIT_CLIENT_SECRET 为空");
    console.error("请在 .env.local 中填入 API 凭证");
    process.exit(1);
  }

  return { clientId, clientSecret, testnet };
}

// --- Readline 工具 ---

export function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// --- 策略映射 ---

const STRATEGY_MAP: Record<string, { key: StrategyType; label: string }> = {
  cc: { key: "covered-call", label: "Covered Call（卖 Call 收租）" },
  csp: { key: "cash-secured-put", label: "Cash-Secured Put（卖 Put 接货）" },
  sl: { key: "synthetic-long", label: "Synthetic Long（合成现货）" },
  lc: { key: "long-call", label: "Long Call（佩洛西打法）" },
};

interface CliBalance {
  availableBtc: number;
  equityBtc: number;
  availableCashUsd: number;
  simulated: boolean;
}

function exitWithMessage(message: string): never {
  console.error(message);
  process.exit(1);
}

async function resolveSelectedStrategy(askFn: (question: string) => Promise<string> = ask): Promise<StrategyType> {
  if (strategyArg && STRATEGY_MAP[strategyArg]) {
    return STRATEGY_MAP[strategyArg].key;
  }

  console.log("  选择策略:");
  Object.entries(STRATEGY_MAP).forEach(([k, v], i) => {
    console.log(`  ${i + 1}. ${v.label} (${k})`);
  });
  const choice = await askFn("\n  输入编号或缩写: ");
  const byIndex = Object.values(STRATEGY_MAP)[Number(choice) - 1];
  const byKey = STRATEGY_MAP[choice.toLowerCase()];
  if (byIndex) return byIndex.key;
  if (byKey) return byKey.key;
  exitWithMessage("  无效选择");
}

export async function resolveSimulatedBalance(
  strategy: StrategyType,
  askFn: (question: string) => Promise<string> = ask,
): Promise<CliBalance> {
  if (Number.isNaN(simBtcArg) || Number.isNaN(simCashUsdArg)) {
    exitWithMessage("错误: --sim-btc / --sim-cash-usd 必须是数字");
  }

  let availableBtc = simBtcArg ?? 0;
  let availableCashUsd = simCashUsdArg ?? 0;

  if (strategy === "covered-call" && simBtcArg == null) {
    availableBtc = Number(await askFn("  输入模拟可用 BTC: "));
  }
  if ((strategy === "cash-secured-put" || strategy === "long-call") && simCashUsdArg == null) {
    availableCashUsd = Number(await askFn("  输入模拟可用现金 USD: "));
  }

  if (!Number.isFinite(availableBtc) || !Number.isFinite(availableCashUsd)) {
    exitWithMessage("错误: 模拟余额必须是有效数字");
  }
  if (availableBtc < 0 || availableCashUsd < 0) {
    exitWithMessage("错误: 模拟余额不能为负数");
  }

  return {
    availableBtc,
    equityBtc: availableBtc,
    availableCashUsd,
    simulated: true,
  };
}

export async function runLocalSimulation(askFn: (question: string) => Promise<string> = ask) {
  if (executeMode) {
    exitWithMessage("错误: --local-sim 不能和 --execute 同时使用");
  }
  if (showPositions || cancelArg || orderStatusArg) {
    exitWithMessage("错误: --local-sim 不支持 --positions / --cancel / --order-status");
  }

  console.log("\n  BTC 期权交易 CLI");
  console.log("  网络: 公开行情（本地模拟）");
  console.log("  模式: local-sim（只生成计划，不下单）\n");

  console.log("  获取期权链数据...");
  const [ticker, chain] = await Promise.all([fetchBtcTicker(), fetchOptionsChain()]);
  if (!ticker?.price || !chain?.options?.length) {
    exitWithMessage("  无法获取行情数据");
  }
  console.log(`  BTC 现价: $${ticker.price.toLocaleString()} | ${chain.options.length} 个合约\n`);

  const selectedStrategy = strategyArg && STRATEGY_MAP[strategyArg]
    ? STRATEGY_MAP[strategyArg].key
    : await resolveSelectedStrategy(askFn);
  const balance = await resolveSimulatedBalance(selectedStrategy, askFn);
  const stratLabel = Object.values(STRATEGY_MAP).find((s) => s.key === selectedStrategy)?.label ?? selectedStrategy;
  console.log(`\n  策略: ${stratLabel}`);
  console.log(`  模拟余额: ${balance.availableBtc.toFixed(4)} BTC | $${balance.availableCashUsd.toLocaleString()}\n`);

  const input: RecommendationInput = {
    strategy: selectedStrategy,
    availableBtc: balance.availableBtc,
    availableCashUsd: balance.availableCashUsd,
    cycle: "monthly",
    riskTolerance: "balanced",
    acceptAssignment: true,
    minPremiumPercent: 0,
  };

  if (selectedStrategy === "covered-call" || selectedStrategy === "cash-secured-put") {
    const recs = buildRecommendations(chain.options, input).slice(0, 5);
    if (recs.length === 0) {
      console.log("  当前条件下没有推荐合约");
      return;
    }
    displayRecTable(recs);
    if (listOnly) return;
    await tradeFlow(recs, balance, "testnet", true, askFn);
    return;
  }

  if (selectedStrategy === "synthetic-long") {
    const recs = buildSyntheticLongRecommendations(chain.options, input).slice(0, 5);
    if (recs.length === 0) {
      console.log("  当前条件下没有推荐合约");
      return;
    }
    displaySyntheticTable(recs);
    if (listOnly) return;
    console.log("  合成现货需要同时操作 call 和 put，暂不支持自动下单");
    console.log("  当前为本地模拟模式，仅展示推荐\n");
    return;
  }

  const recs = buildLongCallRecommendations(chain.options, input).slice(0, 5);
  if (recs.length === 0) {
    console.log("  当前条件下没有推荐合约");
    return;
  }
  displayLongCallTable(recs);
  if (listOnly) return;
  await tradeFlowLongCall(recs, balance, "testnet", true, askFn);
}

// --- 主流程 ---

export async function main() {
  if (localSimMode) {
    await bootstrapNodeProxy();
    await runLocalSimulation();
    return;
  }

  const { clientId, clientSecret, testnet } = await loadEnv();
  await bootstrapNodeProxy();

  // 环境判断：--prod 强制生产，否则跟随 .env.local
  const useTestnet = prodMode ? false : testnet;
  initTradingClient(clientId, clientSecret, useTestnet);

  const environment: TradeEnvironment = useTestnet ? "testnet" : "production";
  const dryRun = !executeMode;

  console.log(`\n  BTC 期权交易 CLI`);
  console.log(`  网络: ${useTestnet ? "测试网 (test.deribit.com)" : "⚠️  生产 (www.deribit.com)"}`);
  console.log(`  模式: ${dryRun ? "dry-run（只生成计划，不下单）" : "⚠️  execute（将发送真实订单）"}`);
  if (!useTestnet && dryRun) {
    console.log("  提示: 要在生产环境真实执行，需同时传入 --prod --execute");
  }
  console.log();

  // 查询订单状态
  if (orderStatusArg) {
    await displayOrderStatus(orderStatusArg);
    return;
  }

  // 撤销订单
  if (cancelArg) {
    await displayCancelOrder(cancelArg);
    return;
  }

  // 查看持仓模式
  if (showPositions) {
    await displayPositions();
    return;
  }

  // 获取账户余额
  console.log("  获取账户信息...");
  let balance;
  try {
    balance = await getAccountBalance();
    console.log(`  可用: ${balance.availableBtc.toFixed(4)} BTC | 权益: ${balance.equityBtc.toFixed(4)} BTC\n`);
  } catch (err) {
    console.error("  获取余额失败:", err instanceof Error ? err.message : err);
    console.error("  请检查 API 凭证和网络连接\n");
    process.exit(1);
  }

  // 获取行情
  console.log("  获取期权链数据...");
  const [ticker, chain] = await Promise.all([fetchBtcTicker(), fetchOptionsChain()]);
  if (!ticker?.price || !chain?.options?.length) {
    console.error("  无法获取行情数据");
    process.exit(1);
  }
  console.log(`  BTC 现价: $${ticker.price.toLocaleString()} | ${chain.options.length} 个合约\n`);

  balance = {
    ...balance,
    availableCashUsd: balance.availableBtc * ticker.price,
  };

  const selectedStrategy = await resolveSelectedStrategy();
  const stratLabel = Object.values(STRATEGY_MAP).find((s) => s.key === selectedStrategy)?.label ?? selectedStrategy;
  console.log(`\n  策略: ${stratLabel}\n`);

  // 构建推荐
  const input: RecommendationInput = {
    strategy: selectedStrategy,
    availableBtc: balance.availableBtc,
    availableCashUsd: balance.availableBtc * ticker.price,
    cycle: "monthly",
    riskTolerance: "balanced",
    acceptAssignment: true,
    minPremiumPercent: 0,
  };

  if (selectedStrategy === "covered-call" || selectedStrategy === "cash-secured-put") {
    const recs = buildRecommendations(chain.options, input).slice(0, 5);
    if (recs.length === 0) {
      console.log("  当前条件下没有推荐合约");
      return;
    }
    displayRecTable(recs);
    if (listOnly) return;
    await tradeFlow(recs, balance, environment, dryRun);

  } else if (selectedStrategy === "synthetic-long") {
    const recs = buildSyntheticLongRecommendations(chain.options, input).slice(0, 5);
    if (recs.length === 0) {
      console.log("  当前条件下没有推荐合约");
      return;
    }
    displaySyntheticTable(recs);
    if (listOnly) return;
    console.log("  合成现货需要同时操作 call 和 put，暂不支持自动下单");
    console.log("  请根据推荐在 Deribit 手动操作\n");

  } else if (selectedStrategy === "long-call") {
    const recs = buildLongCallRecommendations(chain.options, input).slice(0, 5);
    if (recs.length === 0) {
      console.log("  当前条件下没有推荐合约");
      return;
    }
    displayLongCallTable(recs);
    if (listOnly) return;
    await tradeFlowLongCall(recs, balance, environment, dryRun);
  }
}

// --- 表格展示（保持不变）---

function displayRecTable(recs: Recommendation[]) {
  console.log("  ┌────────────────────────────┬──────────┬──────┬──────────┬──────┬──────────┐");
  console.log("  │ 合约                        │ 执行价    │ 到期  │ 单张租金  │ 可开  │ 总收益    │");
  console.log("  ├────────────────────────────┼──────────┼──────┼──────────┼──────┼──────────┤");
  recs.forEach((r, i) => {
    const name = r.contract.instrumentName.padEnd(26);
    const strike = `$${(r.contract.strike / 1000).toFixed(0)}K`.padStart(8);
    const days = `${r.contract.daysToExpiry.toFixed(0)}天`.padStart(4);
    const prem = r.premiumPerMinContractUsd != null ? `$${r.premiumPerMinContractUsd.toFixed(0)}` : "--";
    const premiumStr = prem.padStart(8);
    const lots = `${r.maxLots}张`.padStart(4);
    const totalPrem = r.premiumPerMinContractUsd != null
      ? `$${(r.premiumPerMinContractUsd * r.maxLots).toFixed(0)}`
      : "--";
    const totalStr = totalPrem.padStart(8);
    console.log(`  │ ${name} │ ${strike} │ ${days} │ ${premiumStr} │ ${lots} │ ${totalStr} │  ${i + 1}`);
  });
  console.log("  └────────────────────────────┴──────────┴──────┴──────────┴──────┴──────────┘\n");
}

function displaySyntheticTable(recs: SyntheticLongRecommendation[]) {
  console.log("  ┌────────────────────────────────────────────┬──────┬──────────┬──────────┐");
  console.log("  │ 合约对                                      │ 到期  │ 净权利金  │ 等级      │");
  console.log("  ├────────────────────────────────────────────┼──────┼──────────┼──────────┤");
  recs.forEach((r, i) => {
    const pair = `${r.pair.call.instrumentName} / ${r.pair.put.instrumentName}`;
    const pairStr = pair.length > 42 ? pair.slice(0, 42) : pair.padEnd(42);
    const days = `${r.pair.daysToExpiry.toFixed(0)}天`.padStart(4);
    const net = r.pair.netPremiumUsdPerMinContract != null
      ? `$${r.pair.netPremiumUsdPerMinContract.toFixed(0)}`
      : "--";
    const netStr = net.padStart(8);
    const level = r.level.padEnd(8);
    console.log(`  │ ${pairStr} │ ${days} │ ${netStr} │ ${level} │  ${i + 1}`);
  });
  console.log("  └────────────────────────────────────────────┴──────┴──────────┴──────────┘\n");
}

function displayLongCallTable(recs: LongCallRecommendation[]) {
  console.log("  ┌────────────────────────────┬──────────┬──────┬──────────┬──────┬──────────┐");
  console.log("  │ 合约                        │ 执行价    │ 到期  │ 单张权利金│ 可开  │ 总成本    │");
  console.log("  ├────────────────────────────┼──────────┼──────┼──────────┼──────┼──────────┤");
  recs.forEach((r, i) => {
    const name = r.contract.instrumentName.padEnd(26);
    const strike = `$${(r.contract.strike / 1000).toFixed(0)}K`.padStart(8);
    const days = `${r.contract.daysToExpiry.toFixed(0)}天`.padStart(4);
    const prem = r.premiumPerMinContractUsd != null ? `$${r.premiumPerMinContractUsd.toFixed(0)}` : "--";
    const premiumStr = prem.padStart(8);
    const lots = `${r.maxLots}张`.padStart(4);
    const totalCost = r.premiumPerMinContractUsd != null
      ? `$${(r.premiumPerMinContractUsd * r.maxLots).toFixed(0)}`
      : "--";
    const totalStr = totalCost.padStart(8);
    console.log(`  │ ${name} │ ${strike} │ ${days} │ ${premiumStr} │ ${lots} │ ${totalStr} │  ${i + 1}`);
  });
  console.log("  └────────────────────────────┴──────────┴──────┴──────────┴──────┴──────────┘\n");
}

// --- 交易流程（安全版）---

export async function tradeFlow(
  recs: Recommendation[],
  balance: { availableBtc: number; equityBtc: number; availableCashUsd: number },
  environment: TradeEnvironment,
  dryRun: boolean,
  askFn: (question: string) => Promise<string> = ask,
  sellOptionFn: typeof sellOption = sellOption,
) {
  const choice = await askFn("  输入编号选择合约 (回车退出): ");
  const idx = Number(choice) - 1;
  if (idx < 0 || idx >= recs.length || !Number.isFinite(idx)) {
    console.log("  已退出");
    return;
  }

  const rec = recs[idx]!;
  const plan = buildTradePlan({
    recommendation: rec,
    availableBtc: balance.availableBtc,
    availableCashUsd: balance.availableCashUsd,
    environment,
    mode: dryRun ? "dry-run" : "execute",
  });

  displayTradePlan(plan);

  if (!plan.preflight.passed) {
    console.log("\n  ⛔ preflight 检查未通过，无法下单。请检查上方标记为 ✗ 的项目。\n");
    return;
  }

  if (dryRun) {
    console.log("  📋 dry-run 模式：以上为交易计划预览，未发送真实订单。");
    console.log("  要真实执行，请同时传入 --prod --execute\n");
    return;
  }

  const confirm = await askFn("\n  输入 CONFIRM 确认下单，其他任意键取消: ");
  if (confirm !== "CONFIRM") {
    console.log("  已取消");
    return;
  }

  try {
    console.log("\n  下单中...");
    const order = await sellOptionFn(plan.instrumentName, plan.amountBtc, plan.limitPriceBtc);
    displayOrderResult(order);
  } catch (err) {
    console.error("  下单失败:", err instanceof Error ? err.message : err);
  }
}

export async function tradeFlowLongCall(
  recs: LongCallRecommendation[],
  balance: { availableBtc: number; equityBtc: number; availableCashUsd: number },
  environment: TradeEnvironment,
  dryRun: boolean,
  askFn: (question: string) => Promise<string> = ask,
  buyOptionFn: typeof buyOption = buyOption,
) {
  const choice = await askFn("  输入编号选择合约 (回车退出): ");
  const idx = Number(choice) - 1;
  if (idx < 0 || idx >= recs.length || !Number.isFinite(idx)) {
    console.log("  已退出");
    return;
  }

  const rec = recs[idx]!;
  const plan = buildTradePlan({
    recommendation: rec,
    availableBtc: balance.availableBtc,
    availableCashUsd: balance.availableCashUsd,
    environment,
    mode: dryRun ? "dry-run" : "execute",
  });

  displayTradePlan(plan);

  if (!plan.preflight.passed) {
    console.log("\n  ⛔ preflight 检查未通过，无法下单。请检查上方标记为 ✗ 的项目。\n");
    return;
  }

  if (dryRun) {
    console.log("  📋 dry-run 模式：以上为交易计划预览，未发送真实订单。");
    console.log("  要真实执行，请同时传入 --prod --execute\n");
    return;
  }

  const confirm = await askFn("\n  输入 CONFIRM 确认下单，其他任意键取消: ");
  if (confirm !== "CONFIRM") {
    console.log("  已取消");
    return;
  }

  try {
    console.log("\n  下单中...");
    const order = await buyOptionFn(plan.instrumentName, plan.amountBtc, plan.limitPriceBtc);
    displayOrderResult(order);
  } catch (err) {
    console.error("  下单失败:", err instanceof Error ? err.message : err);
  }
}

// --- 交易计划展示 ---

function displayTradePlan(plan: ReturnType<typeof buildTradePlan>) {
  const directionLabel = plan.side === "buy" ? "买入" : "卖出";
  const strategyLabel = plan.strategy === "covered-call" ? "Covered Call"
    : plan.strategy === "cash-secured-put" ? "Cash-Secured Put"
    : "Long Call";

  console.log("\n  ╔══════════════════════════════════════════════╗");
  console.log("  ║  交易计划                                      ║");
  console.log("  ╠══════════════════════════════════════════════╣");
  console.log(`  ║  策略:    ${strategyLabel.padEnd(36)}║`);
  console.log(`  ║  方向:    ${directionLabel.padEnd(36)}║`);
  console.log(`  ║  合约:    ${plan.instrumentName.padEnd(36)}║`);
  console.log(`  ║  张数:    ${`${plan.lots} 张 (${plan.amountBtc.toFixed(1)} BTC)`.padEnd(36)}║`);
  console.log(`  ║  限价:    ${`${plan.limitPriceBtc.toFixed(5)} BTC`.padEnd(36)}║`);
  console.log(`  ║  限价USD: ${(plan.limitPriceUsd != null ? `$${plan.limitPriceUsd.toFixed(0)}/张` : "--").padEnd(36)}║`);
  if (plan.estimatedPremiumUsd != null) {
    console.log(`  ║  预估权利金: ${`$${plan.estimatedPremiumUsd.toFixed(0)}`.padEnd(34)}║`);
  }
  if (plan.estimatedCostUsd != null) {
    console.log(`  ║  预估成本:   ${`$${plan.estimatedCostUsd.toFixed(0)}`.padEnd(34)}║`);
  }
  console.log(`  ║  名义金额: ${`$${plan.notionalUsd.toFixed(0)}`.padEnd(34)}║`);
  console.log(`  ║  网络:    ${(plan.environment === "testnet" ? "测试网" : "⚠️ 生产").padEnd(36)}║`);
  console.log(`  ║  模式:    ${(plan.mode === "dry-run" ? "dry-run" : "⚠️ execute").padEnd(36)}║`);
  console.log("  ╠══════════════════════════════════════════════╣");
  console.log("  ║  Preflight 检查                               ║");
  console.log("  ╠══════════════════════════════════════════════╣");
  for (const check of plan.preflight.checks) {
    const icon = check.passed ? "✓" : "✗";
    console.log(`  ║  ${icon} ${check.message.padEnd(43)}║`);
  }
  console.log("  ╚══════════════════════════════════════════════╝");
}

// --- 订单结果 ---

function displayOrderResult(order: OrderResult) {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║  订单已提交                          ║");
  console.log("  ╠══════════════════════════════════════╣");
  console.log(`  ║  订单ID:  ${order.orderId.padEnd(26)}║`);
  console.log(`  ║  状态:    ${order.orderState.padEnd(26)}║`);
  console.log(`  ║  合约:    ${order.instrumentName.padEnd(26)}║`);
  console.log(`  ║  方向:    ${order.direction.padEnd(26)}║`);
  console.log(`  ║  数量:    ${String(order.amount).padEnd(26)}║`);
  console.log(`  ║  已成交:  ${String(order.filledAmount).padEnd(26)}║`);
  console.log(`  ║  价格:    ${order.price.toFixed(5)} BTC${"".padEnd(18)}║`);
  console.log("  ╚══════════════════════════════════════╝\n");
}

// --- 订单生命周期 ---

async function displayOrderStatus(orderId: string) {
  try {
    const order = await getOrderStatus(orderId);
    console.log("\n  订单状态:");
    displayOrderResult(order);
  } catch (err) {
    console.error("  查询订单失败:", err instanceof Error ? err.message : err);
  }
}

async function displayCancelOrder(orderId: string) {
  console.log(`  即将撤销订单: ${orderId}`);
  const confirm = await ask("  输入 CONFIRM 确认撤单: ");
  if (confirm !== "CONFIRM") {
    console.log("  已取消");
    return;
  }

  try {
    await cancelOrder(orderId);
    console.log("  订单已撤销");
    const updated = await getOrderStatus(orderId);
    displayOrderResult(updated);
  } catch (err) {
    console.error("  撤单失败:", err instanceof Error ? err.message : err);
  }
}

// --- 持仓展示 ---

async function displayPositions() {
  try {
    const [balance, positions] = await Promise.all([getAccountBalance(), getPositions()]);
    console.log(`  账户权益: ${balance.equityBtc.toFixed(4)} BTC | 可用: ${balance.availableBtc.toFixed(4)} BTC\n`);

    const optionPositions = positions.filter((p) => Math.abs(p.size) > 0);
    if (optionPositions.length === 0) {
      console.log("  当前无期权持仓\n");
      return;
    }

    console.log("  ┌────────────────────────────┬──────────┬──────────┬──────────┐");
    console.log("  │ 合约                        │ 方向      │ 数量      │ 标记价格  │");
    console.log("  ├────────────────────────────┼──────────┼──────────┼──────────┤");
    optionPositions.forEach((p) => {
      const name = p.instrumentName.padEnd(26);
      const dir = p.direction === "buy" ? "买入".padEnd(8) : "卖出".padEnd(8);
      const size = String(Math.abs(p.size)).padStart(8);
      const mp = p.markPrice.toFixed(5).padStart(8);
      console.log(`  │ ${name} │ ${dir} │ ${size} │ ${mp} │`);
    });
    console.log("  └────────────────────────────┴──────────┴──────────┴──────────┘\n");
  } catch (err) {
    console.error("  获取持仓失败:", err instanceof Error ? err.message : err);
  }
}

// --- 入口 ---

const entryFile = process.argv[1] ? resolve(process.argv[1]) : "";
const currentFile = fileURLToPath(import.meta.url);

if (entryFile === currentFile) {
  main().catch((err) => {
    console.error("致命错误:", err);
    process.exit(1);
  });
}
