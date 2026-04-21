"use client";

import { Layers } from "lucide-react";
import { EmptyStateCard } from "@/components/ui/empty-state-card";
import { SectionHeader } from "@/components/ui/section-header";
import type { OptionsPanorama } from "@/lib/types/option";

interface OptionsPanoramaPanelProps {
  panorama: OptionsPanorama | null;
  underlyingPrice: number | undefined;
}

export function OptionsPanoramaPanel({ panorama, underlyingPrice }: OptionsPanoramaPanelProps) {
  const spot = underlyingPrice ?? 0;

  if (!panorama || panorama.putCallRatios.length === 0) {
    return (
      <section id="panorama" className="scroll-mt-32 sm:scroll-mt-24">
        <div className="panel-surface rounded-[24px] p-4 sm:rounded-[32px] sm:p-6">
          <SectionHeader
            icon={Layers}
            title="期权全景"
            description="持仓分布、市场情绪、Max Pain 一图看完"
          />
          <EmptyStateCard
            icon={Layers}
            title="期权全景还在等完整期权链"
            description="Put/Call Ratio、Max Pain 和 OI 热力图都依赖同一批期权链数据，所以会在数据齐了之后一起出现。"
            tips={[
              "先有期权链，才能看到全市场偏多还是偏空。",
              "如果刚打开页面，这里通常会比推荐列表晚一步补齐。",
            ]}
            tone="info"
          />
        </div>
      </section>
    );
  }

  const overallSentiment = getSentiment(panorama.overallOiRatio);

  return (
    <section id="panorama" className="scroll-mt-32 sm:scroll-mt-24">
      <div className="panel-surface rounded-[24px] p-4 sm:rounded-[32px] sm:p-6">
        <SectionHeader
          icon={Layers}
          title="期权全景"
          description="持仓分布、市场情绪、Max Pain 一图看完"
        />

        {/* 区块 A: P/C Ratio 总览 */}
        <div className="mt-6">
          <SectionTitle title="Put/Call Ratio" hint="看跌 vs 看涨的持仓和成交量之比，判断市场整体偏向" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <MetricTile
              label="OI 比率 (P/C)"
              value={formatRatio(panorama.overallOiRatio)}
              badge={overallSentiment.label}
              badgeClassName={overallSentiment.className}
              hint="所有到期日的 Put OI ÷ Call OI"
            />
            <MetricTile
              label="总 Call OI"
              value={formatOi(panorama.totalCallOi)}
              hint={`Put OI: ${formatOi(panorama.totalPutOi)}`}
            />
            <MetricTile
              label="Volume 比率 (P/C)"
              value={formatRatio(panorama.overallVolumeRatio)}
              hint="所有到期日的 Put Volume ÷ Call Volume"
            />
          </div>

          {panorama.putCallRatios.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium text-white">按到期日分布</p>
              <p className="mt-1 text-xs text-slate-400">柱子越低越偏多（看涨多），越高越偏空（看跌多）</p>
              <PcRatioChart ratios={panorama.putCallRatios} />
            </div>
          )}
        </div>

        {/* 区块 B: Max Pain */}
        {panorama.maxPainPoints.length > 0 && (
          <div className="mt-8">
            <SectionTitle title="Max Pain" hint="期权买方总亏损最大化的行权价，价格有向此位置回归的倾向" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {panorama.maxPainPoints.map((mp) => {
                const diff = spot > 0 ? ((spot - mp.maxPainStrike) / spot) * 100 : 0;
                return (
                  <div key={mp.expiration} className="metric-tile rounded-[24px] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400">{mp.expiration}</p>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">
                        {mp.daysToExpiry}天
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-white">
                      ${mp.maxPainStrike.toLocaleString()}
                    </p>
                    {spot > 0 && (
                      <p className={`mt-1 text-xs ${Math.abs(diff) < 3 ? "text-emerald-300" : "text-amber-300"}`}>
                        {diff >= 0 ? "高于" : "低于"}现价 {Math.abs(diff).toFixed(1)}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-50/95">
              <p className="font-medium text-amber-200">怎么看 Max Pain</p>
              <ul className="mt-2 space-y-1">
                <li>- Max Pain 是让所有期权买方亏损最大、卖方盈利最大的行权价。</li>
                <li>- 现价离 Max Pain 越远，到期前回归的概率越高（但不保证）。</li>
                <li>- 临近到期时效果更明显，因为做市商的对冲活动会形成价格磁力。</li>
              </ul>
            </div>
          </div>
        )}

        {/* 区块 C: OI 热力图 */}
        {panorama.heatmap.length > 0 && (
          <div className="mt-8">
            <SectionTitle title="持仓热力图" hint="每个格子的颜色深浅代表该行权价和到期日的持仓量" />
            <OiHeatmapChart
              heatmap={panorama.heatmap}
              strikes={panorama.heatmapStrikes}
              expirations={panorama.heatmapExpirations}
              spotPrice={spot}
            />
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm" style={{ background: "rgb(34 211 238)" }} />
                Call OI 较多
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm" style={{ background: "rgb(251 113 133)" }} />
                Put OI 较多
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm" style={{ background: "rgb(250 204 21)", opacity: 0.6 }} />
                现价参考线
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Shared helpers ---------- */

function formatRatio(ratio: number): string {
  if (!isFinite(ratio)) return "∞";
  return ratio.toFixed(2);
}

function formatOi(oi: number): string {
  if (oi >= 1000) return `${(oi / 1000).toFixed(1)}K`;
  return oi.toFixed(0);
}

function getSentiment(ratio: number) {
  if (!isFinite(ratio) || ratio > 1.3) {
    return { label: "偏空", className: "bg-rose-400/15 text-rose-200 border border-rose-400/20" };
  }
  if (ratio < 0.7) {
    return { label: "偏多", className: "bg-emerald-400/15 text-emerald-200 border border-emerald-400/20" };
  }
  return { label: "中性", className: "bg-slate-400/15 text-slate-200 border border-slate-400/20" };
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

function MetricTile({
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
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-slate-400">{label}</p>
        {badge && <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClassName}`}>{badge}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

/* ---------- SVG Charts ---------- */

function PcRatioChart({ ratios }: { ratios: OptionsPanorama["putCallRatios"] }) {
  const width = 600;
  const height = 160;
  const padding = { top: 20, right: 15, bottom: 35, left: 50 };

  const maxRatio = Math.max(...ratios.map((r) => Math.min(r.oiRatio, 3)), 1.5);
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const barWidth = Math.min(40, (plotW - 10) / ratios.length - 8);
  const gap = (plotW - barWidth * ratios.length) / (ratios.length + 1);

  const toY = (val: number) => padding.top + (1 - val / maxRatio) * plotH;
  const ratioLineY = toY(1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" preserveAspectRatio="xMidYMid meet">
      {/* ratio=1 参考线 */}
      <line
        x1={padding.left}
        y1={ratioLineY}
        x2={width - padding.right}
        y2={ratioLineY}
        stroke="rgb(148 163 184)"
        strokeDasharray="4 4"
        opacity="0.4"
      />
      <text x={padding.left - 6} y={ratioLineY + 3} textAnchor="end" fill="rgb(148 163 184)" fontSize="9" fontFamily="sans-serif">
        1.0
      </text>

      {ratios.map((r, i) => {
        const cappedRatio = Math.min(r.oiRatio, maxRatio);
        const barH = (cappedRatio / maxRatio) * plotH;
        const x = padding.left + gap + i * (barWidth + gap);
        const y = padding.top + plotH - barH;

        const color = r.oiRatio < 0.7
          ? "rgb(52 211 153)"
          : r.oiRatio > 1.3
            ? "rgb(251 113 133)"
            : "rgb(34 211 238)";

        return (
          <g key={r.expiration}>
            <rect x={x} y={y} width={barWidth} height={barH} rx="4" fill={color} opacity="0.65" />
            <text
              x={x + barWidth / 2}
              y={y - 5}
              textAnchor="middle"
              fill="rgb(103 232 249)"
              fontSize="9"
              fontFamily="sans-serif"
            >
              {formatRatio(r.oiRatio)}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - padding.bottom + 14}
              textAnchor="middle"
              fill="rgb(148 163 184)"
              fontSize="9"
              fontFamily="sans-serif"
            >
              {r.daysToExpiry}天
            </text>
          </g>
        );
      })}

      {/* Y 轴标签 */}
      <text x={padding.left - 6} y={padding.top + 4} textAnchor="end" fill="rgb(148 163 184)" fontSize="9" fontFamily="sans-serif">
        {maxRatio.toFixed(1)}
      </text>
    </svg>
  );
}

function OiHeatmapChart({
  heatmap,
  strikes,
  expirations,
  spotPrice,
}: {
  heatmap: OptionsPanorama["heatmap"];
  strikes: number[];
  expirations: string[];
  spotPrice: number;
}) {
  const width = 700;
  const height = Math.max(200, 40 + strikes.length * 22);
  const padding = { top: 10, right: 15, bottom: 50, left: 65 };

  const cellMap = new Map<string, (typeof heatmap)[number]>();
  for (const cell of heatmap) {
    cellMap.set(`${cell.strike}-${cell.expiration}`, cell);
  }

  const maxOi = Math.max(...heatmap.map((c) => c.totalOi), 1);

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const cellW = plotW / expirations.length;
  const cellH = plotH / strikes.length;

  // 现价参考线 Y 位置
  const minStrike = strikes[0] ?? 0;
  const maxStrike = strikes[strikes.length - 1] ?? 1;
  const strikeRange = maxStrike - minStrike || 1;
  const spotY = spotPrice >= minStrike && spotPrice <= maxStrike
    ? padding.top + (1 - (spotPrice - minStrike) / strikeRange) * plotH
    : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" preserveAspectRatio="xMidYMid meet">
      {strikes.map((strike, rowIdx) => {
        const y = padding.top + rowIdx * cellH;

        // Y 轴标签（只显示部分避免拥挤）
        const showLabel = strikes.length <= 12 || rowIdx % Math.ceil(strikes.length / 10) === 0;

        return (
          <g key={strike}>
            {showLabel && (
              <text
                x={padding.left - 6}
                y={y + cellH / 2 + 3}
                textAnchor="end"
                fill="rgb(148 163 184)"
                fontSize="9"
                fontFamily="sans-serif"
              >
                {(strike / 1000).toFixed(0)}K
              </text>
            )}
            {expirations.map((exp, colIdx) => {
              const x = padding.left + colIdx * cellW;
              const cell = cellMap.get(`${strike}-${exp}`);

              if (!cell) return null;

              const intensity = Math.min(cell.totalOi / maxOi, 1);
              const callRatio = cell.totalOi > 0 ? cell.callOi / cell.totalOi : 0.5;

              // Call 多 → cyan，Put 多 → rose，混合 → 中间色
              const r = Math.round(callRatio * 34 + (1 - callRatio) * 251);
              const g = Math.round(callRatio * 211 + (1 - callRatio) * 113);
              const b = Math.round(callRatio * 238 + (1 - callRatio) * 133);

              return (
                <rect
                  key={`${strike}-${exp}`}
                  x={x + 1}
                  y={y + 1}
                  width={cellW - 2}
                  height={cellH - 2}
                  rx="3"
                  fill={`rgb(${r} ${g} ${b})`}
                  opacity={0.15 + intensity * 0.7}
                />
              );
            })}
          </g>
        );
      })}

      {/* X 轴到期日标签 */}
      {expirations.map((exp, colIdx) => {
        const x = padding.left + colIdx * cellW + cellW / 2;
        const showLabel = expirations.length <= 10 || colIdx % Math.ceil(expirations.length / 8) === 0;
        if (!showLabel) return null;
        return (
          <text
            key={exp}
            x={x}
            y={height - padding.bottom + 16}
            textAnchor="middle"
            fill="rgb(148 163 184)"
            fontSize="9"
            fontFamily="sans-serif"
          >
            {exp.length > 6 ? exp.slice(0, 6) : exp}
          </text>
        );
      })}

      {/* 现价参考线 */}
      {spotY != null && (
        <line
          x1={padding.left}
          y1={spotY}
          x2={width - padding.right}
          y2={spotY}
          stroke="rgb(250 204 21)"
          strokeDasharray="6 4"
          opacity="0.6"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
