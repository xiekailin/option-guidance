import { memo } from "react";
import type {
  LongCallRecommendation,
  Recommendation,
  StrategyType,
  SyntheticLongRecommendation,
} from "@/lib/types/option";

interface RecommendationSummaryProps {
  strategy: StrategyType;
  price: number | undefined;
  recommendation: Recommendation | undefined;
  syntheticRecommendation?: SyntheticLongRecommendation | undefined;
  longCallRecommendation?: LongCallRecommendation | undefined;
  total: number;
  source?: string;
  updatedAt?: string;
  marketHint?: string;
  marketLevel?: string;
  adviceLabel?: string;
}

export const RecommendationSummary = memo(function RecommendationSummary({
  strategy,
  price,
  recommendation,
  syntheticRecommendation,
  longCallRecommendation,
  total,
  source,
  updatedAt,
  marketHint,
  marketLevel,
  adviceLabel,
}: RecommendationSummaryProps) {
  const cards =
    strategy === "synthetic-long"
      ? [
          {
            label: "BTC 现价",
            value: price ? `$${price.toLocaleString()}` : "--",
            hint: source ?? "等待行情",
          },
          {
            label: "首选买 Call",
            value: syntheticRecommendation ? `$${syntheticRecommendation.pair.call.strike.toLocaleString()}` : "--",
            hint: syntheticRecommendation ? syntheticRecommendation.pair.expiration : "等待筛选",
          },
          {
            label: "首选卖 Put",
            value: syntheticRecommendation ? `$${syntheticRecommendation.pair.put.strike.toLocaleString()}` : "--",
            hint: syntheticRecommendation ? `${syntheticRecommendation.pair.daysToExpiry} 天` : "等待筛选",
          },
          {
            label: "净权利金",
            value:
              syntheticRecommendation?.pair.netPremiumUsdPerMinContract != null
                ? `$${syntheticRecommendation.pair.netPremiumUsdPerMinContract.toLocaleString()}`
                : "--",
            hint: syntheticRecommendation ? syntheticRecommendation.level : `${total} 个候选`,
          },
          {
            label: "系统建议",
            value: adviceLabel ?? "观察中",
            hint: marketHint ?? marketLevel ?? "等待市场分析",
          },
        ]
      : strategy === "long-call"
        ? [
            {
              label: "BTC 现价",
              value: price ? `$${price.toLocaleString()}` : "--",
              hint: source ?? "等待行情",
            },
            {
              label: "首选执行价",
              value: longCallRecommendation ? `$${longCallRecommendation.contract.strike.toLocaleString()}` : "--",
              hint: longCallRecommendation ? longCallRecommendation.contract.expiration : "等待筛选",
            },
            {
              label: "单张权利金",
              value:
                longCallRecommendation?.premiumPerMinContractUsd != null
                  ? `$${longCallRecommendation.premiumPerMinContractUsd.toLocaleString()}`
                  : "--",
              hint: longCallRecommendation ? `${longCallRecommendation.premiumPerMinContractBtc} BTC` : `${total} 个候选`,
            },
            {
              label: "盈亏平衡价",
              value:
                longCallRecommendation?.breakEvenPrice != null
                  ? `$${longCallRecommendation.breakEvenPrice.toLocaleString()}`
                  : "--",
              hint:
                longCallRecommendation?.maxLossUsd != null
                  ? `最大亏损 $${longCallRecommendation.maxLossUsd.toLocaleString()}`
                  : "最坏情况亏掉全部权利金",
            },
            {
              label: "系统建议",
              value: "未提供自动建议",
              hint: marketHint ?? marketLevel ?? "市场概览暂未纳入佩洛西打法自动建议",
            },
          ]
        : [
            {
              label: "BTC 现价",
              value: price ? `$${price.toLocaleString()}` : "--",
              hint: source ?? "等待行情",
            },
            {
              label: "首选执行价",
              value: recommendation ? `$${recommendation.contract.strike.toLocaleString()}` : "--",
              hint: recommendation ? `${recommendation.contract.expiration} 到期` : "等待筛选",
            },
            {
              label: "单张预估租金",
              value:
                recommendation?.premiumPerMinContractUsd != null
                  ? `$${recommendation.premiumPerMinContractUsd.toLocaleString()}`
                  : "--",
              hint: recommendation ? `${recommendation.premiumPerMinContractBtc} BTC` : "基于 0.1 BTC/张",
            },
            {
              label: "候选数量",
              value: total.toString(),
              hint: recommendation ? recommendation.level : "等待结果",
            },
            {
              label: "系统建议",
              value: adviceLabel ?? "观察中",
              hint: marketHint ?? marketLevel ?? "等待市场分析",
            },
          ];

  const theme =
    strategy === "synthetic-long"
      ? {
          chip: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100",
          glow: "bg-fuchsia-500/20",
          title: "把方向感、权利金和押金压力放在同一眼里看",
          description: "这一排优先告诉你当前价位、首选腿和净成本，不用先翻表格。",
        }
      : strategy === "long-call"
        ? {
            chip: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
            glow: "bg-emerald-500/20",
            title: "先看入场成本，再看值不值得为长期上涨买票",
            description: "这一排会把执行价、门票钱和盈亏平衡价先摆出来。",
          }
        : {
            chip: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
            glow: "bg-cyan-500/20",
            title: "先看现价、首选执行价和系统建议，再决定要不要继续收租",
            description: "这一排是你的开盘速览，当前最值得先看的数字都在这里。",
          };

  return (
    <section className="panel-surface relative overflow-hidden rounded-[24px] p-4 sm:rounded-[32px] sm:p-6">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.28em] ${theme.chip}`}>
              实时摘要
            </span>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-white sm:text-2xl">{theme.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">{theme.description}</p>
          </div>
          {updatedAt ? (
            <div className="metric-tile rounded-[24px] px-4 py-3 text-left lg:min-w-[240px]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">最近更新</p>
              <p className="mt-2 text-sm font-medium text-slate-100">{new Date(updatedAt).toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">数据来源：{source ?? "Deribit"}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
          {cards.map((card, index) => (
            <article
              key={card.label}
              className={`metric-tile rounded-[22px] p-4 sm:rounded-[26px] sm:p-5 ${index === 0 ? "xl:col-span-4" : "xl:col-span-2"}`}
            >
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{card.label}</p>
              <p className={`mt-3 font-semibold tracking-tight tabular-nums text-white ${index === 0 ? "text-4xl sm:text-[2.6rem]" : "text-2xl"}`}>
                {card.value}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-400">{card.hint}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
});
