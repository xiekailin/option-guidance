"use client";

import { Activity, Gauge, Layers3, MapPinned } from "lucide-react";
import type { MarketOverviewAnalysis } from "@/lib/domain/market-analysis";
import type { VolatilityAnalysis } from "@/lib/types/option";

interface MarketOverviewPanelProps {
  underlyingPrice: number | undefined;
  overview: MarketOverviewAnalysis | null;
  volatility: VolatilityAnalysis;
  historicalLoading: boolean;
  historicalError: boolean;
}

const trendTone = {
  bullish: "text-emerald-300 border-emerald-400/20 bg-emerald-400/10",
  bearish: "text-rose-300 border-rose-400/20 bg-rose-400/10",
  neutral: "text-slate-300 border-white/10 bg-white/5",
};

export function MarketOverviewPanel({
  underlyingPrice,
  overview,
  volatility,
  historicalLoading,
  historicalError,
}: MarketOverviewPanelProps) {
  if (!underlyingPrice) {
    return (
      <section className="rounded-3xl border border-dashed border-white/10 bg-slate-950/70 p-8 text-center text-sm leading-7 text-slate-400">
        等待 BTC 行情加载后，再生成市场概览。
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="rounded-3xl border border-dashed border-white/10 bg-slate-950/70 p-8 text-center text-sm leading-7 text-slate-400">
        市场分析还在准备中，等期权链和历史数据到齐后会补全。
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-lg shadow-black/10">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-200">
              <Activity className="size-3.5" />
              BTC 市场简报
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">{overview.brief.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{overview.brief.summary}</p>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-right">
              <p className="text-xs text-slate-500">BTC 现价</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">${underlyingPrice.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-4">
              <p className="text-xs text-cyan-300">系统建议模式</p>
              <p className="mt-2 text-xl font-semibold text-white">{overview.advice.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{overview.advice.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">置信度 {formatConfidence(overview.advice.confidence)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {overview.brief.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] tracking-wide text-slate-200">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/10 p-4 text-sm leading-7 text-amber-50/95">
          <p className="font-medium text-amber-200">现在最该注意什么</p>
          <p className="mt-2">{overview.brief.riskNote}</p>
          {historicalError ? <p className="mt-2 text-xs text-amber-200/80">历史价格加载失败，趋势和关键位判断可能偏弱。</p> : null}
          {historicalLoading ? <p className="mt-2 text-xs text-amber-200/80">历史价格还在加载中，部分判断会逐步补全。</p> : null}
        </div>
      </div>

      <article className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-lg shadow-black/10">
        <div className="flex items-center gap-2 text-cyan-200">
          <Activity className="size-4" />
          <p className="text-sm font-medium">为什么现在更偏这个策略</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {overview.advice.reasons.map((reason, index) => (
            <div key={`${index}-${reason}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm leading-7 text-slate-300">
              {reason}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/10 p-4 text-sm leading-7 text-amber-50/95">
          <p className="font-medium text-amber-200">这条建议最怕什么</p>
          <p className="mt-2">{overview.advice.riskNote}</p>
        </div>
      </article>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-lg shadow-black/10">
          <div className="flex items-center gap-2 text-cyan-200">
            <Gauge className="size-4" />
            <p className="text-sm font-medium">趋势动量</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="7天动量" value={formatPercent(overview.trendMomentum.return7d)} hint="短线变化" />
            <MetricCard label="30天动量" value={formatPercent(overview.trendMomentum.return30d)} hint="中期方向" />
            <MetricCard label="90天动量" value={formatPercent(overview.trendMomentum.return90d)} hint="大级别背景" />
            <MetricCard label="相对 SMA20" value={formatPercent(overview.trendMomentum.priceVsSma20Percent)} hint="现价与短均线偏离" />
            <MetricCard label="相对 SMA50" value={formatPercent(overview.trendMomentum.priceVsSma50Percent)} hint="现价与中均线偏离" />
            <MetricCard label="SMA20 / SMA50" value={`${formatPrice(overview.trendMomentum.sma20)} / ${formatPrice(overview.trendMomentum.sma50)}`} hint="短中线均值" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs ${trendTone[overview.trendMomentum.shortTrend]}`}>
              短线 {formatTrend(overview.trendMomentum.shortTrend)}
            </span>
            <span className={`rounded-full border px-3 py-1.5 text-xs ${trendTone[overview.trendMomentum.mediumTrend]}`}>
              中线 {formatTrend(overview.trendMomentum.mediumTrend)}
            </span>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-300">{overview.trendMomentum.summary}</p>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-lg shadow-black/10">
          <div className="flex items-center gap-2 text-cyan-200">
            <MapPinned className="size-4" />
            <p className="text-sm font-medium">关键价位</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <MetricCard label="上方压力位" value={formatPrice(overview.keyLevels.resistance)} hint={`距离现价 ${formatPercent(overview.keyLevels.resistanceDistancePercent)}`} />
            <MetricCard label="下方支撑位" value={formatPrice(overview.keyLevels.support)} hint={`距离现价 ${formatPercent(overview.keyLevels.supportDistancePercent)}`} />
            <MetricCard label="30天区间低点" value={formatPrice(overview.keyLevels.rangeLow30d)} hint="近期价格下沿" />
            <MetricCard label="30天区间高点" value={formatPrice(overview.keyLevels.rangeHigh30d)} hint="近期价格上沿" />
          </div>
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm leading-7 text-slate-300">
            <div>
              <p className="font-medium text-white">大白话怎么理解</p>
              <p className="mt-2">{overview.keyLevels.resistancePlain}</p>
              <p className="mt-2">{overview.keyLevels.supportPlain}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-slate-950/60 px-4 py-3 text-slate-300">
              <p>{overview.keyLevels.distancePlain}</p>
            </div>
            <div>
              <p className="font-medium text-white">期权热区提示</p>
              <p className="mt-2">{overview.keyLevels.oiZonePlain}</p>
            </div>
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/10 px-4 py-3 text-amber-50/95">
              <p className="font-medium text-amber-200">接下来先盯什么</p>
              <p className="mt-2">{overview.keyLevels.actionHint}</p>
            </div>
          </div>
        </article>
      </div>

      <article className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-lg shadow-black/10">
        <div className="flex items-center gap-2 text-cyan-200">
          <Layers3 className="size-4" />
          <p className="text-sm font-medium">衍生品情绪</p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="ATM IV" value={volatility.atmLabel} hint="期权市场给的实时波动率" />
          <MetricCard label="30天历史波动率" value={formatPercent(volatility.historicalVol30d)} hint="BTC 过去一个月真实波动" />
          <MetricCard label="IV - HV" value={formatPercent(volatility.ivHvSpread30d)} hint="期权贵不贵的核心差值" />
          <MetricCard label="Put/Call Skew" value={formatPercent(overview.derivativesSentiment.putCallSkewSpread)} hint="put 相对 call 贵多少" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">期权定价：{formatPremiumRegime(overview.derivativesSentiment.premiumRegime)}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">情绪偏向：{formatSkewBias(overview.derivativesSentiment.skewBias)}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">期限结构：{formatTermStructure(overview.derivativesSentiment.termStructureBias)}</span>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-300">{overview.derivativesSentiment.summary}</p>
      </article>
    </section>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-1.5 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

function formatPercent(value: number | null): string {
  return value == null ? "--" : `${value >= 0 ? "+" : ""}${value}%`;
}

function formatPrice(value: number | null): string {
  return value == null ? "--" : `$${Math.round(value).toLocaleString()}`;
}

function formatTrend(value: "bullish" | "bearish" | "neutral"): string {
  return value === "bullish" ? "偏强" : value === "bearish" ? "偏弱" : "震荡";
}

function formatPremiumRegime(value: "expensive" | "fair" | "cheap"): string {
  return value === "expensive" ? "偏贵" : value === "cheap" ? "偏便宜" : "中性";
}

function formatSkewBias(value: "defensive" | "balanced" | "risk-on"): string {
  return value === "defensive" ? "偏防守" : value === "risk-on" ? "偏进攻" : "中性";
}

function formatTermStructure(value: "short-stress" | "flat" | "forward-rich"): string {
  return value === "short-stress" ? "短端更贵" : value === "forward-rich" ? "远端更贵" : "比较平";
}

function formatConfidence(value: "high" | "medium" | "low"): string {
  return value === "high" ? "高" : value === "medium" ? "中" : "低";
}
