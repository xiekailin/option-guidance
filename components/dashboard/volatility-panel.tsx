"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";
import { analyzeVolatility } from "@/lib/domain/volatility";
import type { HistoricalPricePoint, OptionContract, VolatilityAnalysis } from "@/lib/types/option";

interface VolatilityPanelProps {
  options: OptionContract[];
  underlyingPrice: number | undefined;
  historicalPrices: HistoricalPricePoint[];
  historicalLoading: boolean;
  historicalError: boolean;
}

const ivLevelStyles = {
  high: { bg: "bg-amber-400/15 text-amber-200 border-amber-400/20", label: "偏高" },
  normal: { bg: "bg-cyan-400/15 text-cyan-200 border-cyan-400/20", label: "正常" },
  low: { bg: "bg-emerald-400/15 text-emerald-200 border-emerald-400/20", label: "偏低" },
};

export function VolatilityPanel({
  options,
  underlyingPrice,
  historicalPrices,
  historicalLoading,
  historicalError,
}: VolatilityPanelProps) {
  const analysis: VolatilityAnalysis = useMemo(
    () => analyzeVolatility(options ?? [], underlyingPrice ?? null, historicalPrices ?? []),
    [options, underlyingPrice, historicalPrices],
  );

  const hasData = analysis.atmIv != null;

  return (
    <section id="volatility" className="scroll-mt-24">
      <div className="panel-surface rounded-[32px] p-6">
        <div className="flex items-center gap-3">
          <Activity className="size-5 text-cyan-300" />
          <div>
            <h2 className="text-xl font-semibold text-white">波动率分析</h2>
            <p className="mt-1 text-xs text-slate-400">波动率预期告诉你现在的权利金是贵还是便宜</p>
          </div>
        </div>

        {!hasData ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
            等待期权链数据加载...
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="当前隐含波动率"
                value={analysis.atmLabel}
                hint="期权市场现在给的价格温度"
                badge={ivLevelStyles[analysis.ivLevel].label}
                badgeClassName={ivLevelStyles[analysis.ivLevel].bg}
              />
              <MetricCard
                label="7天历史波动率"
                value={formatPercent(analysis.historicalVol7d)}
                hint="最近一周 BTC 真实波动有多大"
              />
              <MetricCard
                label="30天历史波动率"
                value={formatPercent(analysis.historicalVol30d)}
                hint="最近一个月 BTC 真实波动有多大"
              />
              <MetricCard
                label="90天历史波动率"
                value={formatPercent(analysis.historicalVol90d)}
                hint="最近三个月 BTC 真实波动有多大"
              />
              <MetricCard
                label="IV - 30天HV"
                value={formatSpread(analysis.ivHvSpread30d)}
                hint="正数越大，通常说明期权越贵"
              />
            </div>

            <div className="mt-4 rounded-[28px] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.16),rgba(255,255,255,0.03))] p-5">
              <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-100">一句话判断</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{analysis.verdict}</p>
              <p className="mt-3 text-sm leading-7 text-cyan-50/90">{analysis.summary}</p>
              <p className="mt-3 text-xs text-cyan-100/70">全部合约范围 {analysis.ivMin}% — {analysis.ivMax}%，中位数 {analysis.ivMedian}%</p>
              {historicalError ? (
                <p className="mt-2 text-xs text-amber-200">历史波动率加载失败，下面先只参考隐含波动率。</p>
              ) : historicalLoading ? (
                <p className="mt-2 text-xs text-cyan-100/70">历史波动率还在加载中。</p>
              ) : analysis.historicalVol30d == null ? (
                <p className="mt-2 text-xs text-cyan-100/70">历史价格数据还不够，暂时算不出完整的历史波动率。</p>
              ) : null}
            </div>

            {/* 期限结构 */}
            {analysis.termStructure.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-white">不同到期日的波动率变化</p>
                <p className="mt-1 text-xs text-slate-400">看不同到期日的波动率预期，判断短期还是长期的期权更贵</p>
                <TermStructureChart points={analysis.termStructure} />
              </div>
            )}

            {/* IV Skew */}
            {analysis.skew.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-white">看跌和看涨之间的波动率差异</p>
                <p className="mt-1 text-xs text-slate-400">看跌期权的波动率预期比看涨高多少，差得越多说明市场越害怕跌</p>
                <SkewChart points={analysis.skew} />
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-50/95">
              <p className="font-medium text-amber-200">怎么看这些数据</p>
              <ul className="mt-2 space-y-1">
                <li>- <strong>隐含波动率（IV）</strong>是期权市场现在报出来的贵不贵。</li>
                <li>- <strong>历史波动率（HV）</strong>是 BTC 最近真实波动有多大。</li>
                <li>- <strong>IV 比 HV 高很多</strong>，通常说明期权偏贵，卖方收租更舒服。</li>
                <li>- <strong>IV 比 HV 低很多</strong>，通常说明期权不贵，买方更容易拿到便宜价格。</li>
                <li>- <strong>波动率突然拉高</strong>，权利金通常也会一起变贵，但也往往代表市场更紧张，别只看租金高就冲进去。</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function formatPercent(value: number | null): string {
  return value == null ? "--" : `${value}%`;
}

function formatSpread(value: number | null): string {
  return value == null ? "--" : `${value >= 0 ? "+" : ""}${value}%`;
}

function MetricCard({
  label,
  value,
  hint,
  badge,
  badgeClassName,
}: {
  label: string;
  value: string;
  hint: string;
  badge?: string;
  badgeClassName?: string;
}) {
  return (
    <div className="metric-tile rounded-[24px] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-slate-400">{label}</p>
        {badge ? <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClassName}`}>{badge}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

function TermStructureChart({ points }: { points: VolatilityAnalysis["termStructure"] }) {
  const width = 600;
  const height = 140;
  const padding = { top: 15, right: 15, bottom: 30, left: 70 };

  const ivValues = points.map((p) => p.iv);
  const maxIv = Math.max(...ivValues, 1);
  const minDays = Math.min(...points.map((p) => p.daysToExpiry));
  const maxDays = Math.max(...points.map((p) => p.daysToExpiry));
  const dayRange = maxDays - minDays || 1;

  const barWidth = Math.min(50, (width - padding.left - padding.right - 10) / points.length - 6);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {points.map((point) => {
        const x = padding.left + ((point.daysToExpiry - minDays) / dayRange) * (width - padding.left - padding.right);
        const barHeight = (point.iv / maxIv) * (height - padding.top - padding.bottom);
        const y = height - padding.bottom - barHeight;

        return (
          <g key={point.label}>
            <rect x={x - barWidth / 2} y={y} width={barWidth} height={barHeight} rx="4" fill="rgb(34 211 238)" opacity="0.6" />
            <text x={x} y={height - padding.bottom + 16} textAnchor="middle" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
              {point.daysToExpiry}天
            </text>
            <text x={x - barWidth / 2 - 6} y={y + barHeight / 2 + 4} textAnchor="end" fill="rgb(103 232 249)" fontSize="10" fontFamily="sans-serif">
              {point.iv}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SkewChart({ points }: { points: VolatilityAnalysis["skew"] }) {
  const width = 600;
  const height = 140;
  const padding = { top: 15, right: 15, bottom: 30, left: 15 };

  const strikes = points.map((p) => p.strike);
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);
  const strikeRange = maxStrike - minStrike || 1;
  const maxIv = Math.max(...points.map((p) => p.iv), 1);

  const toX = (strike: number) => padding.left + ((strike - minStrike) / strikeRange) * (width - padding.left - padding.right);
  const toY = (iv: number) => padding.top + (1 - iv / maxIv) * (height - padding.top - padding.bottom);

  const callPoints = points.filter((p) => p.optionType === "call").map((p) => `${toX(p.strike)},${toY(p.iv)}`).join(" ");
  const putPoints = points.filter((p) => p.optionType === "put").map((p) => `${toX(p.strike)},${toY(p.iv)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {callPoints && <polyline points={callPoints} fill="none" stroke="rgb(34 211 238)" strokeWidth="2" />}
      {putPoints && <polyline points={putPoints} fill="none" stroke="rgb(251 113 133)" strokeWidth="2" />}
      {callPoints && callPoints.split(" ").map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        return <circle key={`c-${i}`} cx={x} cy={y} r="3" fill="rgb(34 211 238)" />;
      })}
      {putPoints && putPoints.split(" ").map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        return <circle key={`p-${i}`} cx={x} cy={y} r="3" fill="rgb(251 113 133)" />;
      })}
      <text x={padding.left + 4} y={padding.top + 4} fill="rgb(34 211 238)" fontSize="10" fontFamily="sans-serif">● 看涨</text>
      <text x={padding.left + 60} y={padding.top + 4} fill="rgb(251 113 133)" fontSize="10" fontFamily="sans-serif">● 看跌</text>
      <text x={padding.left} y={height - 8} textAnchor="start" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
        {Math.round(minStrike).toLocaleString()}
      </text>
      <text x={width - padding.right} y={height - 8} textAnchor="end" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
        {Math.round(maxStrike).toLocaleString()}
      </text>
    </svg>
  );
}
