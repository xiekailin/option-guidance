import type { Recommendation, SyntheticLongRecommendation } from "@/lib/types/option";

interface RecommendationSummaryProps {
  price: number | undefined;
  recommendation: Recommendation | undefined;
  syntheticRecommendation?: SyntheticLongRecommendation | undefined;
  total: number;
  source?: string;
  updatedAt?: string;
}

export function RecommendationSummary({
  price,
  recommendation,
  syntheticRecommendation,
  total,
  source,
  updatedAt,
}: RecommendationSummaryProps) {
  const cards = syntheticRecommendation
    ? [
        {
          label: "BTC 现价",
          value: price ? `$${price.toLocaleString()}` : "--",
          hint: source ?? "等待行情",
        },
        {
          label: "首选买 Call",
          value: `$${syntheticRecommendation.pair.call.strike.toLocaleString()}`,
          hint: syntheticRecommendation.pair.expiration,
        },
        {
          label: "首选卖 Put",
          value: `$${syntheticRecommendation.pair.put.strike.toLocaleString()}`,
          hint: syntheticRecommendation.pair.daysToExpiry + " 天",
        },
        {
          label: "净权利金",
          value:
            syntheticRecommendation.pair.netPremiumUsdPerMinContract != null
              ? `$${syntheticRecommendation.pair.netPremiumUsdPerMinContract.toLocaleString()}`
              : "--",
          hint: syntheticRecommendation.level,
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
            recommendation && recommendation.premiumPerMinContractUsd != null
              ? `$${recommendation.premiumPerMinContractUsd.toLocaleString()}`
              : "--",
          hint: recommendation ? `${recommendation.premiumPerMinContractBtc} BTC` : "基于 0.1 BTC/张",
        },
        {
          label: "候选数量",
          value: total.toString(),
          hint: recommendation ? recommendation.level : "等待结果",
        },
      ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur"
        >
          <p className="text-xs text-slate-500">{card.label}</p>
          <p className="mt-1.5 text-xl font-bold text-white">{card.value}</p>
          <p className="mt-1 text-[11px] text-slate-500">{card.hint}</p>
        </article>
      ))}
      {updatedAt ? (
        <p className="text-[11px] text-slate-600 sm:col-span-2 lg:col-span-4">更新于 {new Date(updatedAt).toLocaleString()}</p>
      ) : null}
    </section>
  );
}
