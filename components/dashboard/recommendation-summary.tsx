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
    <section className="grid gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/20 backdrop-blur"
        >
          <p className="text-sm text-slate-400">{card.label}</p>
          <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{card.hint}</p>
        </article>
      ))}
      {updatedAt ? (
        <p className="text-xs text-slate-500 lg:col-span-4">数据更新时间：{new Date(updatedAt).toLocaleString()}</p>
      ) : null}
    </section>
  );
}
