"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";
import { analyzeVolatility } from "@/lib/domain/volatility";
import type { OptionContract, VolatilityAnalysis } from "@/lib/types/option";

interface VolatilityPanelProps {
  options: OptionContract[];
  underlyingPrice: number | undefined;
}

const ivLevelStyles = {
  high: { bg: "bg-amber-400/15 text-amber-200 border-amber-400/20", label: "偏高" },
  normal: { bg: "bg-cyan-400/15 text-cyan-200 border-cyan-400/20", label: "正常" },
  low: { bg: "bg-emerald-400/15 text-emerald-200 border-emerald-400/20", label: "偏低" },
};

export function VolatilityPanel({ options, underlyingPrice }: VolatilityPanelProps) {
  const analysis: VolatilityAnalysis = useMemo(
    () => analyzeVolatility(options ?? [], underlyingPrice ?? null),
    [options, underlyingPrice],
  );

  const hasData = analysis.atmIv != null;

  return (
    <section id="volatility" className="scroll-mt-24">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="flex items-center gap-3">
          <Activity className="size-5 text-cyan-300" />
          <div>
            <h2 className="text-xl font-semibold text-white">波动率分析</h2>
            <p className="mt-1 text-xs text-slate-400">隐含波动率是权利金贵不贵的核心指标</p>
          </div>
        </div>

        {!hasData ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
            等待期权链数据加载...
          </div>
        ) : (
          <>
            {/* ATM IV 大数字 */}
            <div className="mt-5 flex flex-wrap items-end gap-6">
              <div>
                <p className="text-xs text-slate-400">ATM 隐波（平值隐含波动率）</p>
                <p className="mt-2 text-4xl font-bold text-white">{analysis.atmLabel}</p>
                <p className="mt-1 text-xs text-slate-400">BTC 现价附近的期权市场预期的年化波动幅度</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-sm font-medium ${ivLevelStyles[analysis.ivLevel].bg}`}>
                {ivLevelStyles[analysis.ivLevel].label}
              </span>
              <div className="text-xs text-slate-400">
                <p>全部合约 IV 范围：{analysis.ivMin}% — {analysis.ivMax}%</p>
                <p>中位数：{analysis.ivMedian}%</p>
              </div>
            </div>

            {/* 一句话判断 */}
            <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/40 p-4 text-sm leading-7 text-slate-200">
              {analysis.summary}
            </div>

            {/* 期限结构 */}
            {analysis.termStructure.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-white">期限结构 — 隐波随到期日怎么变</p>
                <p className="mt-1 text-xs text-slate-400">看不同到期日的 ATM 隐波，判断短期还是长期的期权更&ldquo;值钱&rdquo;</p>
                <TermStructureChart points={analysis.termStructure} />
              </div>
            )}

            {/* IV Skew */}
            {analysis.skew.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-white">波动率偏斜 — 不同执行价的隐波差异</p>
                <p className="mt-1 text-xs text-slate-400">看虚值 put 和虚值 call 的隐波差，偏斜越大说明市场越恐慌</p>
                <SkewChart points={analysis.skew} />
              </div>
            )}

            {/* 解释 */}
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-50/95">
              <p className="font-medium text-amber-200">怎么看这些数据</p>
              <ul className="mt-2 space-y-1">
                <li>- <strong>ATM 隐波</strong>就是市场觉得 BTC 一年内的波动幅度。50% 意味着市场认为 BTC 有 50% 概率在当前价 ±50% 的范围内波动。</li>
                <li>- <strong>偏高</strong>说明权利金贵，适合卖方收租；<strong>偏低</strong>说明权利金便宜，适合买方建仓。</li>
                <li>- <strong>期限结构</strong>如果远期隐波高于近期，说明市场预期未来波动会加大（通常是对的）。</li>
                <li>- <strong>偏斜</strong>如果虚值 put 的隐波明显高于虚值 call，说明市场愿意花更多钱&ldquo;买保险&rdquo;，是恐慌信号。</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
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
      <text x={padding.left + 4} y={padding.top + 4} fill="rgb(34 211 238)" fontSize="10" fontFamily="sans-serif">● Call</text>
      <text x={padding.left + 60} y={padding.top + 4} fill="rgb(251 113 133)" fontSize="10" fontFamily="sans-serif">● Put</text>
      <text x={padding.left} y={height - 8} textAnchor="start" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
        {Math.round(minStrike).toLocaleString()}
      </text>
      <text x={width - padding.right} y={height - 8} textAnchor="end" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
        {Math.round(maxStrike).toLocaleString()}
      </text>
    </svg>
  );
}
