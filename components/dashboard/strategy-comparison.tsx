"use client";

import { ShieldAlert, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type {
  LongCallRecommendation,
  Recommendation,
  SyntheticLongRecommendation,
  StrategyType,
} from "@/lib/types/option";

interface StrategyComparisonProps {
  strategy: StrategyType;
  underlyingPrice: number | undefined;
  coveredCallRecommendation: Recommendation | undefined;
  cashSecuredPutRecommendation: Recommendation | undefined;
  syntheticRecommendation: SyntheticLongRecommendation | undefined;
  longCallRecommendation: LongCallRecommendation | undefined;
  availableBtc: number;
  availableCashUsd: number;
}

interface RadarPoint {
  strategy: "covered-call" | "cash-secured-put" | "synthetic-long" | "long-call";
  label: string;
  scores: number[];
  color: string;
}

const dimensions = ["收益率", "安全性", "资金效率", "灵活性", "简单程度"];

const radarData: RadarPoint[] = [
  {
    strategy: "covered-call",
    label: "卖看涨",
    scores: [60, 85, 70, 90, 90],
    color: "rgb(34 211 238)",
  },
  {
    strategy: "cash-secured-put",
    label: "卖看跌",
    scores: [65, 60, 65, 80, 75],
    color: "rgb(52 211 153)",
  },
  {
    strategy: "synthetic-long",
    label: "合成现货",
    scores: [90, 30, 85, 60, 50],
    color: "rgb(217 70 239)",
  },
  {
    strategy: "long-call",
    label: "佩洛西",
    scores: [82, 72, 88, 78, 92],
    color: "rgb(74 222 128)",
  },
];

function RadarChart() {
  const n = dimensions.length;
  const cx = 150;
  const cy = 150;
  const maxR = 110;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const toX = (i: number, r: number) => cx + r * Math.cos(startAngle + i * angleStep);
  const toY = (i: number, r: number) => cy + r * Math.sin(startAngle + i * angleStep);
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <svg viewBox="0 0 300 300" className="mx-auto w-full max-w-xs">
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={Array.from({ length: n }, (_, i) => `${toX(i, maxR * ring)},${toY(i, maxR * ring)}`).join(" ")}
          fill="none"
          stroke="rgb(148 163 184)"
          strokeWidth="0.5"
          strokeOpacity="0.25"
        />
      ))}

      {Array.from({ length: n }, (_, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={toX(i, maxR)}
          y2={toY(i, maxR)}
          stroke="rgb(148 163 184)"
          strokeWidth="0.5"
          strokeOpacity="0.25"
        />
      ))}

      {radarData.map((point) => (
        <polygon
          key={point.strategy}
          points={point.scores.map((score, i) => `${toX(i, (score / 100) * maxR)},${toY(i, (score / 100) * maxR)}`).join(" ")}
          fill={point.color}
          fillOpacity="0.1"
          stroke={point.color}
          strokeWidth="1.5"
        />
      ))}

      {dimensions.map((dim, i) => {
        const labelR = maxR + 18;
        const x = toX(i, labelR);
        const y = toY(i, labelR);
        const anchor = i === 0 ? "middle" : i < n / 2 ? "start" : i === Math.floor(n / 2) ? "middle" : "end";
        return (
          <text
            key={dim}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="central"
            fill="rgb(148 163 184)"
            fontSize="11"
            fontFamily="sans-serif"
          >
            {dim}
          </text>
        );
      })}

      {radarData.map((point, idx) => (
        <g key={point.strategy} transform={`translate(${8 + idx * 72}, 285)`}>
          <circle cx="5" cy="-3" r="4" fill={point.color} />
          <text x="12" y="0" fill="rgb(203 213 225)" fontSize="10" fontFamily="sans-serif">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function StrategyComparison({
  underlyingPrice,
  coveredCallRecommendation,
  cashSecuredPutRecommendation,
  syntheticRecommendation,
  longCallRecommendation,
  availableBtc,
  availableCashUsd,
}: StrategyComparisonProps) {
  const spot = underlyingPrice ?? 0;

  const columns = [
    {
      key: "covered-call" as const,
      label: "持有 BTC 卖看涨（Covered Call）",
      subtitle: "持有 BTC 卖看涨",
      data: coveredCallRecommendation ? buildStrategyMetrics("covered-call", coveredCallRecommendation, spot, availableBtc, availableCashUsd) : null,
      color: "cyan" as const,
    },
    {
      key: "cash-secured-put" as const,
      label: "卖看跌准备接货（Cash-Secured Put）",
      subtitle: "卖看跌准备接货",
      data: cashSecuredPutRecommendation ? buildStrategyMetrics("cash-secured-put", cashSecuredPutRecommendation, spot, availableBtc, availableCashUsd) : null,
      color: "teal" as const,
    },
    {
      key: "synthetic-long" as const,
      label: "模拟持有 BTC（Synthetic Long）",
      subtitle: "买看涨 + 卖看跌",
      data: syntheticRecommendation ? buildSyntheticMetrics(syntheticRecommendation, spot) : null,
      color: "fuchsia" as const,
    },
    {
      key: "long-call" as const,
      label: "佩洛西打法（Long Call）",
      subtitle: "买 30-90 天 BTC Call",
      data: longCallRecommendation ? buildLongCallMetrics(longCallRecommendation) : null,
      color: "emerald" as const,
    },
  ];

  const borderColor = {
    cyan: "border-cyan-400/20 bg-cyan-400/5",
    teal: "border-emerald-400/20 bg-emerald-400/5",
    fuchsia: "border-fuchsia-400/20 bg-fuchsia-400/5",
    emerald: "border-lime-400/20 bg-lime-400/5",
  };
  const badgeColor = {
    cyan: "bg-cyan-400/15 text-cyan-200 border-cyan-400/20",
    teal: "bg-emerald-400/15 text-emerald-200 border-emerald-400/20",
    fuchsia: "bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-400/20",
    emerald: "bg-lime-400/15 text-lime-200 border-lime-400/20",
  };
  const iconColor = {
    cyan: "text-cyan-400",
    teal: "text-emerald-400",
    fuchsia: "text-fuchsia-400",
    emerald: "text-lime-400",
  };

  return (
    <section className="scroll-mt-24">
      <div className="rounded-3xl border border-white/10 bg-slate-950/75 p-6 shadow-lg shadow-black/10">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-white">策略对比</h2>
          <p className="mt-1 text-xs text-slate-400">同样的行情下，四种策略的赚钱方式、风险和资金效率有什么不同</p>
        </div>

        <div className="mb-6 rounded-2xl border border-white/8 bg-slate-950/40 p-4">
          <RadarChart />
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          {columns.map((col) => (
            <div key={col.key} className={`rounded-2xl border p-5 ${col.data ? borderColor[col.color] : "border-white/5 bg-slate-950/40 opacity-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{col.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{col.subtitle}</p>
                </div>
                {col.data ? (
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${badgeColor[col.color]}`}>
                    {col.data.riskLabel}
                  </span>
                ) : null}
              </div>

              {col.data ? (
                <div className="mt-4 space-y-3">
                  <ComparisonRow label="单期最大收益" value={col.data.maxProfitText} hint={col.data.maxProfitHint} icon={<TrendingUp className={`size-3.5 ${iconColor[col.color]}`} />} />
                  <ComparisonRow label="最大亏损" value={col.data.maxLossText} hint={col.data.maxLossHint} icon={<TrendingDown className="size-3.5 text-rose-400" />} />
                  <ComparisonRow label="盈亏平衡价" value={col.data.breakEvenText} hint={col.data.breakEvenHint} />
                  <ComparisonRow label="占用资金" value={col.data.capitalText} hint={col.data.capitalHint} icon={<Wallet className={`size-3.5 ${iconColor[col.color]}`} />} />
                  <ComparisonRow label="风险本质" value={col.data.riskNature} hint="" icon={<ShieldAlert className="size-3.5 text-amber-400" />} />
                </div>
              ) : (
                <p className="mt-6 text-center text-xs text-slate-500">当前条件下暂无推荐数据</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-50/95">
          <p className="font-medium text-amber-200">怎么选</p>
          <ul className="mt-2 space-y-1">
            <li>- <strong>看涨但想赚租金</strong> → 持有 BTC 卖看涨，赚权利金但涨太多你就卖飞了。</li>
            <li>- <strong>想低价接 BTC</strong> → 卖看跌准备接货，先赚一笔权利金，真跌了就按折扣价买入 BTC。</li>
            <li>- <strong>强烈看涨且能扛波动</strong> → 模拟持有 BTC，上涨弹性最强，但暴跌与押金压力也最大。</li>
            <li>- <strong>只想用小钱押中期上涨</strong> → 佩洛西打法，最大亏损锁在权利金，但看对方向也要看对时间。</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

interface StrategyMetrics {
  maxProfitText: string;
  maxProfitHint: string;
  maxLossText: string;
  maxLossHint: string;
  breakEvenText: string;
  breakEvenHint: string;
  capitalText: string;
  capitalHint: string;
  riskNature: string;
  riskLabel: string;
}

function buildStrategyMetrics(
  strategy: "covered-call" | "cash-secured-put",
  rec: Recommendation,
  spot: number,
  availableBtc: number,
  availableCashUsd: number,
): StrategyMetrics {
  const premium = rec.premiumPerMinContractUsd ?? 0;
  const strike = rec.contract.strike;
  const size = 0.1;

  if (strategy === "covered-call") {
    const maxProfit = premium + (strike - spot) * size;
    const maxLoss = premium - spot * size;
    const breakEven = spot - premium / size;
    const capitalBtc = availableBtc * spot;

    return {
      maxProfitText: `$${Math.round(maxProfit).toLocaleString()}`,
      maxProfitHint: `权利金 $${Math.round(premium)} + 执行价和现价的价差`,
      maxLossText: `$${Math.round(Math.abs(maxLoss)).toLocaleString()}`,
      maxLossHint: "如果 BTC 大跌，你主要亏的是手里现货的市值",
      breakEvenText: `$${Math.round(breakEven).toLocaleString()}`,
      breakEvenHint: "BTC 跌到这个价格，权利金刚好抵消现货下跌",
      capitalText: `${availableBtc} BTC ≈ $${Math.round(capitalBtc).toLocaleString()}`,
      capitalHint: "你拿来做持有 BTC 卖看涨的现货市值",
      riskNature: "涨幅被封顶",
      riskLabel: "稳健",
    };
  }

  const breakEven = strike - premium / size;
  const maxLoss = strike * size - premium;

  return {
    maxProfitText: `$${Math.round(premium).toLocaleString()}`,
    maxProfitHint: "如果 BTC 不跌到执行价，你赚到的上限就是这笔权利金",
    maxLossText: `$${Math.round(Math.abs(maxLoss)).toLocaleString()}`,
    maxLossHint: `如果 BTC 跌到 0，你仍要按 $${strike.toLocaleString()} 接货（极端情况）`,
    breakEvenText: `$${Math.round(breakEven).toLocaleString()}`,
    breakEvenHint: "BTC 跌到这个价格，接货成本才与现价持平",
    capitalText: `$${availableCashUsd.toLocaleString()}`,
    capitalHint: "你预留出来用于接货的现金",
    riskNature: "下跌接货",
    riskLabel: "中等",
  };
}

function buildSyntheticMetrics(rec: SyntheticLongRecommendation, spot: number): StrategyMetrics {
  const putStrike = rec.pair.put.strike;

  return {
    maxProfitText: "理论上无限",
    maxProfitHint: "BTC 涨得越多，买的看涨期权赚得越多",
    maxLossText: `$${rec.pair.downsideObligationUsd.toLocaleString()}+`,
    maxLossHint: `BTC 大跌时，卖的看跌期权让你按 $${putStrike.toLocaleString()} 接货`,
    breakEvenText: `≈ $${Math.round(spot).toLocaleString()}`,
    breakEvenHint: "因为净权利金接近 0，盈亏平衡价大致在现价附近",
    capitalText: "押金（按需）",
    capitalHint: "不需要全额现金，但暴跌时押金会明显上升",
    riskNature: "涨跌都有风险",
    riskLabel: "激进",
  };
}

function buildLongCallMetrics(rec: LongCallRecommendation): StrategyMetrics {
  return {
    maxProfitText: "理论上无限",
    maxProfitHint: "BTC 涨得越多，这张 Call 的到期收益上限越高",
    maxLossText: rec.maxLossUsd != null ? `$${rec.maxLossUsd.toLocaleString()}` : "--",
    maxLossHint: "最坏情况是这张 Call 到期归零，亏掉全部权利金",
    breakEvenText: rec.breakEvenPrice != null ? `$${rec.breakEvenPrice.toLocaleString()}` : "--",
    breakEvenHint: "到期至少涨到这个价位附近，你才真正值回票价",
    capitalText: rec.premiumPerMinContractUsd != null ? `$${rec.premiumPerMinContractUsd.toLocaleString()}` : "--",
    capitalHint: "首笔占用资金就是买入这一张 0.1 BTC Call 的权利金",
    riskNature: "时间价值衰减 + IV 回落",
    riskLabel: "进取",
  };
}

function ComparisonRow({ label, value, hint, icon }: { label: string; value: string; hint: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
      {hint ? <p className="mt-0.5 text-xs leading-5 text-slate-400">{hint}</p> : null}
    </div>
  );
}
