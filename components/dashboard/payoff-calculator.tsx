"use client";

import { useMemo, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { calculatePayoffCurve, buildPayoffLegsForStrategy } from "@/lib/domain/payoff";
import type { OptionContract, PayoffCurve, StrategyType } from "@/lib/types/option";

interface PayoffCalculatorProps {
  selectedContract: OptionContract | null;
  syntheticPut?: OptionContract | null;
  underlyingPrice: number | undefined;
  strategy: StrategyType;
  availableBtc: number;
  availableCashUsd: number;
}

export function PayoffCalculator({
  selectedContract,
  syntheticPut,
  underlyingPrice,
  strategy,
}: PayoffCalculatorProps) {
  const [manualMode, setManualMode] = useState(false);
  const [manualOptionType, setManualOptionType] = useState<"call" | "put">("call");
  const [manualStrike, setManualStrike] = useState(76000);
  const [manualPremium, setManualPremium] = useState(0.005);
  const [manualUnderlying, setManualUnderlying] = useState(73000);

  const price = underlyingPrice ?? manualUnderlying;

  const legs = useMemo(() => {
    if (manualMode) {
      return [
        { direction: "short" as const, optionType: manualOptionType, strike: manualStrike, premium: manualPremium, contractSize: 0.1 },
      ];
    }

    if (!selectedContract || !underlyingPrice) return null;

    const premium = selectedContract.markPrice ?? selectedContract.midPrice ?? 0;
    const putPremium = syntheticPut?.markPrice ?? syntheticPut?.midPrice ?? undefined;

    return buildPayoffLegsForStrategy(
      strategy,
      selectedContract.strike,
      premium,
      underlyingPrice,
      syntheticPut?.strike,
      putPremium,
    );
  }, [manualMode, manualOptionType, manualStrike, manualPremium, selectedContract, syntheticPut, underlyingPrice, strategy]);

  const curve: PayoffCurve | null = useMemo(() => {
    if (!legs) return null;
    return calculatePayoffCurve(legs, price);
  }, [legs, price]);

  return (
    <section id="calculator" className="scroll-mt-24">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="flex items-center gap-3">
          <BarChart3 className="size-5 text-cyan-300" />
          <div>
            <h2 className="text-xl font-semibold text-white">到期损益计算器</h2>
            <p className="mt-1 text-xs text-slate-400">输入合约参数，看到期时 BTC 在不同价格下你能赚多少或亏多少</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/8 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-200">合约来源</p>
            <button
              type="button"
              onClick={() => setManualMode(!manualMode)}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-400/60"
            >
              {manualMode ? "手动输入" : "自动填充"}
            </button>
          </div>

          {manualMode ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField label="期权类型" value={manualOptionType} onChange={(v) => setManualOptionType(v as "call" | "put")} options={[{ value: "call", label: "Call" }, { value: "put", label: "Put" }]} />
              <NumberField label="执行价 ($)" value={manualStrike} step="1000" onChange={setManualStrike} />
              <NumberField label="权利金 (BTC)" value={manualPremium} step="0.001" onChange={setManualPremium} />
              <NumberField label="BTC 现价 ($)" value={manualUnderlying} step="100" onChange={setManualUnderlying} />
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-300">
              {selectedContract ? (
                <p>
                  当前选中：<span className="font-medium text-white">{selectedContract.instrumentName}</span>
                  ，权利金 {selectedContract.premiumReturnPercent}%，执行价 ${selectedContract.strike.toLocaleString()}
                  {syntheticPut ? ` / 卖 ${syntheticPut.instrumentName}` : ""}
                </p>
              ) : (
                <p className="text-slate-400">从推荐列表点选一张合约，自动填充参数。或切换到&ldquo;手动输入&rdquo;。</p>
              )}
            </div>
          )}
        </div>

        {curve && curve.points.length > 0 ? (
          <div className="mt-5">
            <PayoffSvg curve={curve} underlyingPrice={price} />

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MetricCard
                icon={<TrendingUp className="size-4 text-emerald-400" />}
                label="最大盈利"
                value={curve.maxProfit > 1e6 ? "理论上无限" : `$${curve.maxProfit.toLocaleString()}`}
                hint={curve.maxProfit > 1e6 ? "BTC 涨得越多赚得越多" : "到期时能赚到的最多钱（每张 0.1 BTC）"}
              />
              <MetricCard
                icon={<TrendingDown className="size-4 text-rose-400" />}
                label="最大亏损"
                value={curve.maxLoss < -1e6 ? "理论上无限" : `$${Math.abs(curve.maxLoss).toLocaleString()}`}
                hint={curve.maxLoss < -1e6 ? "BTC 跌得越多亏得越多" : "到期时最多亏的钱（每张 0.1 BTC）"}
              />
              <MetricCard
                label="盈亏平衡价"
                value={curve.breakEvenPrice != null ? `$${curve.breakEvenPrice.toLocaleString()}` : "--"}
                hint={curve.breakEvenPrice != null ? `到期时 BTC 在这个价格，你不赚不亏` : "找不到明确的盈亏平衡点"}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-50/95">
              <p className="font-medium text-amber-200">怎么看这张图</p>
              <ul className="mt-2 space-y-1">
                <li>- <span className="text-emerald-300">绿色区域</span>是你赚钱的部分，<span className="text-rose-300">红色区域</span>是你亏钱的部分。</li>
                <li>- 横线是&ldquo;不赚不亏&rdquo;的分界线，交点就是盈亏平衡价。</li>
                <li>- 这只是到期时的理论损益，不考虑中间波动和手续费。</li>
                <li>- 每张合约 = 0.1 BTC，如果你做多张，收益和亏损按倍数放大。</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
            等待合约数据加载...
          </div>
        )}
      </div>
    </section>
  );
}

function PayoffSvg({ curve, underlyingPrice }: { curve: PayoffCurve; underlyingPrice: number }) {
  const { points } = curve;
  const width = 700;
  const height = 280;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };

  const prices = points.map((p) => p.priceAtExpiry);
  const pnls = points.map((p) => p.pnl);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minPnl = Math.min(...pnls, 0);
  const maxPnl = Math.max(...pnls, 0);
  const pnlRange = maxPnl - minPnl || 1;

  const toX = (price: number) => padding.left + ((price - minPrice) / (maxPrice - minPrice || 1)) * (width - padding.left - padding.right);
  const toY = (pnl: number) => padding.top + ((maxPnl - pnl) / pnlRange) * (height - padding.top - padding.bottom);
  const zeroY = toY(0);

  const areaPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.priceAtExpiry)},${toY(p.pnl)}`).join(" ") + ` L${toX(points[points.length - 1].priceAtExpiry)},${zeroY} L${toX(points[0].priceAtExpiry)},${zeroY} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="profit-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="loss-gradient" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgb(251 113 133)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(251 113 133)" stopOpacity="0.05" />
        </linearGradient>
        <clipPath id="loss-clip">
          <rect x="0" y={zeroY} width={width} height={height - zeroY} />
        </clipPath>
      </defs>

      {/* Zero line */}
      <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="rgb(148 163 184)" strokeWidth="1" strokeDasharray="4 4" />

      {/* Profit area */}
      <path d={areaPath} fill="url(#profit-gradient)" />
      {/* Loss area below zero */}
      <path d={areaPath} fill="url(#loss-gradient)" clipPath="url(#loss-clip)" />

      {/* P&L line */}
      <polyline
        points={points.map((p) => `${toX(p.priceAtExpiry)},${toY(p.pnl)}`).join(" ")}
        fill="none"
        stroke="rgb(148 163 184)"
        strokeWidth="2"
      />

      {/* Current price marker */}
      {underlyingPrice >= minPrice && underlyingPrice <= maxPrice ? (
        <g>
          <line x1={toX(underlyingPrice)} y1={padding.top} x2={toX(underlyingPrice)} y2={height - padding.bottom} stroke="rgb(6 182 212)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={toX(underlyingPrice)} y={height - padding.bottom + 16} textAnchor="middle" fill="rgb(103 232 249)" fontSize="11" fontFamily="sans-serif">
            现价 ${underlyingPrice.toLocaleString()}
          </text>
        </g>
      ) : null}

      {/* Break-even marker */}
      {curve.breakEvenPrice != null && curve.breakEvenPrice >= minPrice && curve.breakEvenPrice <= maxPrice ? (
        <g>
          <circle cx={toX(curve.breakEvenPrice)} cy={zeroY} r="4" fill="rgb(250 204 21)" />
          <text x={toX(curve.breakEvenPrice)} y={zeroY - 10} textAnchor="middle" fill="rgb(250 204 21)" fontSize="10" fontFamily="sans-serif">
            盈亏平衡 ${curve.breakEvenPrice.toLocaleString()}
          </text>
        </g>
      ) : null}

      {/* X axis labels */}
      <text x={toX(minPrice)} y={height - 8} textAnchor="middle" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
        ${Math.round(minPrice).toLocaleString()}
      </text>
      <text x={toX(maxPrice)} y={height - 8} textAnchor="middle" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
        ${Math.round(maxPrice).toLocaleString()}
      </text>

      {/* Y axis labels */}
      <text x={padding.left - 8} y={toY(maxPnl) + 4} textAnchor="end" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
        +${Math.round(maxPnl).toLocaleString()}
      </text>
      <text x={padding.left - 8} y={zeroY + 4} textAnchor="end" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
        0
      </text>
      <text x={padding.left - 8} y={toY(minPnl) + 4} textAnchor="end" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
        {Math.round(minPnl).toLocaleString()}
      </text>
    </svg>
  );
}

function MetricCard({ icon, label, value, hint }: { icon?: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
      />
    </label>
  );
}
