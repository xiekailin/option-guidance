"use client";

import { useMemo, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle, Copy, XCircle } from "lucide-react";
import type {
  LongCallRecommendation,
  PreflightCheck,
  Recommendation,
  TradePlan,
} from "@/lib/types/option";
import { buildTradePlan } from "@/lib/trading/trade-planner";

interface TradePlanPreviewProps {
  recommendation: Recommendation | LongCallRecommendation;
  availableBtc: number;
  availableCashUsd: number;
}

export function TradePlanPreview({
  recommendation,
  availableBtc,
  availableCashUsd,
}: TradePlanPreviewProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");

  const plan: TradePlan = useMemo(
    () =>
      buildTradePlan({
        recommendation,
        availableBtc,
        availableCashUsd,
        environment: "testnet",
        mode: "dry-run",
      }),
    [recommendation, availableBtc, availableCashUsd],
  );

  const isLongCall = recommendation.strategy === "long-call";

  const cliCommand = isLongCall
    ? "npx tsx scripts/trade.ts --env testnet"
    : `npx tsx scripts/trade.ts --strategy ${plan.strategy} --env testnet`;

  const actionHint = !confirmed
    ? "先勾选确认，再复制 CLI 命令。"
    : !plan.preflight.passed
      ? "预检未通过，先修正余额或市场数据问题。"
      : "确认后可复制命令去 CLI 执行。";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(cliCommand);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }

    setTimeout(() => setCopyStatus("idle"), 2200);
  }, [cliCommand]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`rounded-full p-2 ${plan.preflight.passed ? "bg-emerald-400/15 text-emerald-400" : "bg-rose-400/15 text-rose-400"}`}>
          {plan.preflight.passed ? <CheckCircle className="size-5" /> : <XCircle className="size-5" />}
        </div>
        <div>
          <p className="text-sm font-medium text-white">
            {plan.preflight.passed ? "预检全部通过" : "预检未通过"}
          </p>
          <p className="text-xs text-slate-400">
            dry-run 模式 · testnet · 不会发送真实订单
          </p>
        </div>
      </div>

      {/* Trade Plan Summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <PlanMetric label="合约" value={plan.instrumentName} />
        <PlanMetric label="方向" value={plan.side === "sell" ? "卖出" : "买入"} />
        <PlanMetric label="策略" value={strategyLabel(plan.strategy)} />
        <PlanMetric label="张数" value={`${plan.lots} 张 (${plan.amountBtc} BTC)`} />
        <PlanMetric label="限价" value={`${plan.limitPriceBtc.toFixed(5)} BTC`} />
        <PlanMetric label="名义价值" value={`$${plan.notionalUsd.toLocaleString()}`} />
        {plan.estimatedPremiumUsd != null && (
          <PlanMetric label="预估权利金收入" value={`$${plan.estimatedPremiumUsd.toLocaleString()}`} accent />
        )}
        {plan.estimatedCostUsd != null && (
          <PlanMetric label="预估成本" value={`$${plan.estimatedCostUsd.toLocaleString()}`} accent />
        )}
        {plan.maxLossUsd != null && (
          <PlanMetric label="最大亏损" value={`$${plan.maxLossUsd.toLocaleString()}`} danger />
        )}
      </div>

      {/* Preflight Checks */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">预检清单</p>
        <div className="mt-3 space-y-2">
          {plan.preflight.checks.map((check) => (
            <PreflightRow key={check.key} check={check} />
          ))}
        </div>
      </div>

      {/* Warning banner */}
      {!plan.preflight.passed && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-400" />
          <p className="text-sm text-rose-100/90">
            预检未通过，无法执行交易。请检查余额或市场数据后重试。
          </p>
        </div>
      )}

      {/* Safety notice */}
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
        <p className="text-xs leading-5 text-amber-100/80">
          前端仅展示交易计划预览，不会发送真实订单。实际交易请通过 CLI 执行：<br />
          <code className="mt-1 block rounded bg-white/5 px-2 py-1 font-mono text-[11px] text-slate-300">
            {cliCommand}
          </code>
        </p>
      </div>

      {/* Acknowledge & action */}
      <div className="sticky bottom-0 -mx-4 mt-2 border-t border-white/5 bg-[#07101d] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:-mx-6 sm:px-6">
        <label className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:border-white/12 hover:bg-white/[0.05]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 size-4 rounded border-white/20 bg-transparent accent-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07101d]"
          />
          <span>
            我已了解这是 dry-run 预览，不会发送真实订单。要执行真实交易请使用 CLI。
          </span>
        </label>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400" aria-live="polite">
          <span>{copyStatus === "success" ? "命令已复制到剪贴板。" : copyStatus === "error" ? "复制失败，请手动复制下方命令。" : actionHint}</span>
          <span className={`shrink-0 ${plan.preflight.passed ? "text-emerald-300/80" : "text-amber-200/80"}`}>
            {plan.preflight.passed ? "预检通过" : "预检未通过"}
          </span>
        </div>
        <button
          type="button"
          disabled={!confirmed || !plan.preflight.passed}
          onClick={handleCopy}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Copy className="size-4" />
          {copyStatus === "success" ? "已复制 CLI 命令" : copyStatus === "error" ? "复制失败，请重试" : "复制 CLI 命令"}
        </button>
      </div>
    </div>
  );
}

function PreflightRow({ check }: { check: PreflightCheck }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm ${check.passed ? "bg-emerald-400/5 text-slate-300" : "bg-rose-400/5 text-rose-200"}`}>
      {check.passed ? (
        <CheckCircle className="size-4 shrink-0 text-emerald-400" />
      ) : (
        <XCircle className="size-4 shrink-0 text-rose-400" />
      )}
      <span>{check.message}</span>
    </div>
  );
}

function PlanMetric({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="metric-tile rounded-xl p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-semibold ${danger ? "text-rose-300" : accent ? "text-emerald-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function strategyLabel(strategy: string): string {
  switch (strategy) {
    case "covered-call": return "备兑看涨";
    case "cash-secured-put": return "现金担保看跌";
    case "long-call": return "买入看涨（佩洛西打法）";
    case "synthetic-long": return "合成现货";
    default: return strategy;
  }
}
