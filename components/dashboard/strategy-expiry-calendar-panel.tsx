"use client";

import { useState, useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ExpiryCalendarDay, OptionsPanorama } from "@/lib/types/option";

interface StrategyExpiryCalendarPanelProps {
  calendarDays: ExpiryCalendarDay[];
  panorama: OptionsPanorama | null;
}

export function StrategyExpiryCalendarPanel({ calendarDays, panorama }: StrategyExpiryCalendarPanelProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  // 按年月索引日历数据
  const expiryByDay = useMemo(() => {
    const map = new Map<number, ExpiryCalendarDay>();
    for (const day of calendarDays) {
      if (day.year === year && day.month === month) {
        map.set(day.day, day);
      }
    }
    return map;
  }, [calendarDays, year, month]);

  // 计算 OI 阈值（top 25%）
  const oiThresholds = useMemo(() => {
    const ois = calendarDays.map((d) => d.totalOi).sort((a, b) => a - b);
    if (ois.length === 0) return { high: Infinity, mid: 0 };
    const q75 = ois[Math.floor(ois.length * 0.75)] ?? ois[ois.length - 1]!;
    const q50 = ois[Math.floor(ois.length * 0.5)] ?? 0;
    return { high: q75, mid: q50 };
  }, [calendarDays]);

  // 选中日详情
  const selectedDay = useMemo(
    () => (selectedTimestamp != null ? calendarDays.find((d) => d.expirationTimestamp === selectedTimestamp) ?? null : null),
    [calendarDays, selectedTimestamp],
  );

  // 月份标题
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(viewMonth),
    [viewMonth],
  );

  // 日历网格
  const gridCells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const cells: { day: number; isToday: boolean; expiry: ExpiryCalendarDay | null }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: 0, isToday: false, expiry: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        isToday: d === today.getDate() && month === today.getMonth() && year === today.getFullYear(),
        expiry: expiryByDay.get(d) ?? null,
      });
    }
    while (cells.length % 7 !== 0) cells.push({ day: 0, isToday: false, expiry: null });
    return cells;
  }, [year, month, expiryByDay]);

  if (!panorama || calendarDays.length === 0) {
    return (
      <section>
        <div className="panel-surface rounded-[24px] p-4 sm:rounded-[32px] sm:p-6">
          <div className="flex items-center gap-3">
            <CalendarDays className="size-5 text-cyan-300" />
            <div>
              <h2 className="text-xl font-semibold text-white">策略到期日历</h2>
              <p className="mt-1 text-xs text-slate-400">OI 集中度、Max Pain、P/C Ratio 一目了然</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
            等待期权链数据加载...
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="panel-surface rounded-[24px] p-4 sm:rounded-[32px] sm:p-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="size-5 text-cyan-300" />
          <div>
            <h2 className="text-xl font-semibold text-white">策略到期日历</h2>
            <p className="mt-1 text-xs text-slate-400">OI 集中度、Max Pain、P/C Ratio 一目了然</p>
          </div>
        </div>

        {/* 月份导航 */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-lg font-semibold text-white">{monthLabel}</p>
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* 星期标题 */}
        <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5">
          {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
            <div key={w} className="py-2 text-center text-xs font-medium text-slate-500">
              {w}
            </div>
          ))}
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {gridCells.map((cell, i) => {
            if (cell.day === 0) {
              return <div key={`e-${i}`} className="aspect-square" />;
            }

            const expiry = cell.expiry;
            const isSelected = expiry != null && expiry.expirationTimestamp === selectedTimestamp;
            const oiLevel = expiry ? getOiLevel(expiry.totalOi, oiThresholds) : null;

            return (
              <button
                key={cell.day}
                type="button"
                disabled={!expiry}
                onClick={() => {
                  if (!expiry) return;
                  setSelectedTimestamp(isSelected ? null : expiry.expirationTimestamp);
                }}
                className={[
                  "relative flex aspect-square flex-col items-center justify-center rounded-2xl border transition",
                  expiry
                    ? oiLevel === "high"
                      ? "border-cyan-400/40 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,211,238,0.06))] shadow-[0_4px_14px_-4px_rgba(34,211,238,0.25)]"
                      : oiLevel === "mid"
                        ? "border-white/20 bg-white/[0.06]"
                        : "border-white/10 bg-white/[0.03]"
                    : "cursor-default border-transparent",
                  isSelected ? "ring-2 ring-cyan-300/60" : "",
                  cell.isToday && !expiry ? "ring-2 ring-cyan-400/30" : "",
                  expiry ? "cursor-pointer hover:border-cyan-400/30 hover:bg-white/[0.08]" : "",
                ].join(" ")}
              >
                <span className={[
                  expiry ? (oiLevel === "high" ? "text-base font-bold text-white" : "text-sm font-semibold text-white") : "text-sm text-slate-600",
                ].join(" ")}>
                  {cell.day}
                </span>
                {expiry && (
                  <>
                    <span className="mt-0.5 flex items-center gap-1">
                      <span className={`inline-block size-1.5 rounded-full ${sentimentDotClass(expiry.sentiment)}`} />
                      <span className="text-[10px] text-slate-400">{formatOi(expiry.totalOi)}</span>
                    </span>
                    <span className="mt-0.5 text-[10px] text-slate-500">
                      {expiry.daysToExpiry.toFixed(0)}天
                    </span>
                  </>
                )}
                {cell.isToday && expiry && (
                  <span className="absolute right-1 top-1 size-1.5 rounded-full bg-cyan-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* 图例 */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-emerald-400" />
            P/C &lt; 0.7 偏多
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-cyan-400" />
            中性
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-rose-400" />
            P/C &gt; 1.3 偏空
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-cyan-400" />
            今天
          </span>
        </div>

        {/* 展开详情 */}
        {selectedDay && (
          <ExpandedDayDetail
            day={selectedDay}
            onClose={() => setSelectedTimestamp(null)}
          />
        )}

        {/* 使用说明 */}
        <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-sm leading-7 text-cyan-50/90">
          <p className="font-medium text-cyan-200">怎么看到期日历</p>
          <ul className="mt-2 space-y-1">
            <li>- 发光的格子表示该日到期 OI 较高（top 25%），到期前后可能有较大的价格波动。</li>
            <li>- 绿色圆点 = 看涨 OI 占优，红色圆点 = 看跌 OI 占优，青色 = 均衡。</li>
            <li>- 点击任意到期日查看详细的 OI 分布、Max Pain、成交量等信息。</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Expanded Day Detail ---------- */

function ExpandedDayDetail({ day, onClose }: { day: ExpiryCalendarDay; onClose: () => void }) {
  const callPercent = day.totalOi > 0 ? (day.callOi / day.totalOi) * 100 : 50;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            {day.dateLabel} 到期
          </p>
          <p className="mt-1 text-xs text-slate-400">
            剩余 {day.daysToExpiry.toFixed(1)} 天 · {day.uniqueStrikes} 个行权价
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:border-white/20 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* 指标网格 */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DetailTile label="总 OI" value={formatOi(day.totalOi)} />
        <DetailTile label="Call OI" value={formatOi(day.callOi)} hint={`占比 ${callPercent.toFixed(0)}%`} />
        <DetailTile label="Put OI" value={formatOi(day.putOi)} hint={`占比 ${(100 - callPercent).toFixed(0)}%`} />
        <DetailTile
          label="P/C OI Ratio"
          value={formatRatio(day.oiRatio)}
          badge={day.sentiment}
          badgeClassName={sentimentBadgeClass(day.sentiment)}
        />
        <DetailTile
          label="Max Pain"
          value={day.maxPainStrike != null ? `$${day.maxPainStrike.toLocaleString()}` : "--"}
          hint={
            day.maxPainDeviationPercent != null
              ? `${day.maxPainDeviationPercent >= 0 ? "低于" : "高于"}现价 ${Math.abs(day.maxPainDeviationPercent).toFixed(1)}%`
              : undefined
          }
        />
        <DetailTile label="成交量" value={formatOi(day.totalVolume)} />
      </div>

      {/* OI 分布条 */}
      <div className="mt-4">
        <p className="text-xs text-slate-400">Call / Put OI 分布</p>
        <div className="mt-2 flex h-6 overflow-hidden rounded-full">
          <div
            className="flex items-center justify-center bg-cyan-400/70 text-[10px] font-medium text-white"
            style={{ width: `${callPercent}%` }}
          >
            {callPercent >= 15 ? `${callPercent.toFixed(0)}%` : ""}
          </div>
          <div
            className="flex items-center justify-center bg-rose-400/70 text-[10px] font-medium text-white"
            style={{ width: `${100 - callPercent}%` }}
          >
            {100 - callPercent >= 15 ? `${(100 - callPercent).toFixed(0)}%` : ""}
          </div>
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
          <span>Call OI: {formatOi(day.callOi)}</span>
          <span>Put OI: {formatOi(day.putOi)}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Shared helpers ---------- */

function formatRatio(ratio: number): string {
  if (!isFinite(ratio)) return "∞";
  return ratio.toFixed(2);
}

function formatOi(oi: number): string {
  if (oi >= 1_000_000) return `${(oi / 1_000_000).toFixed(1)}M`;
  if (oi >= 1000) return `${(oi / 1000).toFixed(1)}K`;
  return oi.toFixed(0);
}

function getOiLevel(oi: number, thresholds: { high: number; mid: number }): "high" | "mid" | "low" {
  if (oi >= thresholds.high) return "high";
  if (oi >= thresholds.mid) return "mid";
  return "low";
}

function sentimentDotClass(sentiment: ExpiryCalendarDay["sentiment"]): string {
  if (sentiment === "偏多") return "bg-emerald-400";
  if (sentiment === "偏空") return "bg-rose-400";
  return "bg-cyan-400";
}

function sentimentBadgeClass(sentiment: ExpiryCalendarDay["sentiment"]): string {
  if (sentiment === "偏多") return "bg-emerald-400/15 text-emerald-200 border border-emerald-400/20";
  if (sentiment === "偏空") return "bg-rose-400/15 text-rose-200 border border-rose-400/20";
  return "bg-slate-400/15 text-slate-200 border border-slate-400/20";
}

function DetailTile({
  label,
  value,
  hint,
  badge,
  badgeClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: string;
  badgeClassName?: string;
}) {
  return (
    <div className="metric-tile rounded-[20px] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-slate-400">{label}</p>
        {badge && <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClassName}`}>{badge}</span>}
      </div>
      <p className="mt-1.5 text-xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
