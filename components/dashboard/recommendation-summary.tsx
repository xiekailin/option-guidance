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

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-2xl border border-white/8 bg-slate-950/70 p-5"
        >
          <p className="text-xs text-slate-500">{card.label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">{card.value}</p>
          <p className="mt-1.5 text-xs text-slate-500">{card.hint}</p>
        </article>
      ))}
      {updatedAt ? (
        <p className="text-[11px] text-slate-600 sm:col-span-2 xl:col-span-5">更新于 {new Date(updatedAt).toLocaleString()}</p>
      ) : null}
    </section>
  );
});
