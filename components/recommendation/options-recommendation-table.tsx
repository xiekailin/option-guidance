"use client";

import { memo } from "react";
import type { Recommendation } from "@/lib/types/option";

interface OptionsRecommendationTableProps {
  recommendations: Recommendation[];
  onSelect: (recommendation: Recommendation) => void;
}

const toneStyles = {
  safe: "bg-emerald-400/15 text-emerald-200 border-emerald-400/20",
  balanced: "bg-cyan-400/15 text-cyan-200 border-cyan-400/20",
  aggressive: "bg-amber-400/15 text-amber-200 border-amber-400/20",
};

export const OptionsRecommendationTable = memo(function OptionsRecommendationTable({
  recommendations,
  onSelect,
}: OptionsRecommendationTableProps) {
  if (recommendations.length === 0) {
    return (
      <div className="panel-surface rounded-[32px] border-dashed p-8 text-center text-sm leading-7 text-slate-400">
        当前条件下没有找到合适候选。你可以放宽最低权利金、调整周/月偏好，或提高可用 BTC / 现金。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 sm:hidden">
        {recommendations.map((item) => {
          const totalPremium = item.premiumPerMinContractUsd != null
            ? item.premiumPerMinContractUsd * item.maxLots
            : null;

          return (
            <article key={item.contract.instrumentName} className="panel-surface rounded-[24px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneStyles[item.tone]}`}>
                      {item.level}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{item.contract.daysToExpiry} 天</span>
                  </div>
                  <h3 className="mt-3 truncate text-base font-semibold text-white">{item.contract.instrumentName}</h3>
                  <p className="mt-1 text-xs text-slate-400">{item.contract.expiration} 到期</p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  aria-label={`查看 ${item.contract.instrumentName} 详情`}
                  className="min-h-[44px] shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
                >
                  详情
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricItem label="执行价" value={`$${item.contract.strike.toLocaleString()}`} hint={`${item.contract.otmPercent}%`} />
                <MetricItem
                  label="单张租金"
                  value={item.premiumPerMinContractUsd != null ? `$${item.premiumPerMinContractUsd.toLocaleString()}` : "--"}
                  hint={`${item.premiumPerMinContractBtc} BTC`}
                />
                <MetricItem label="可开张数" value={`${item.maxLots} 张`} />
                <MetricItem label="总收益" value={totalPremium != null ? `≈ $${totalPremium.toLocaleString()}` : "--"} accent />
              </div>
            </article>
          );
        })}
      </div>

      <div className="panel-surface hidden overflow-hidden rounded-[24px] sm:block sm:rounded-[32px]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="sticky top-0 z-10 bg-[#0d1624]/95 text-xs uppercase tracking-[0.2em] text-slate-400 backdrop-blur supports-[backdrop-filter]:bg-[#0d1624]/80">
              <tr>
                <th className="px-3 py-3 sm:px-5 sm:py-4">合约</th>
                <th className="px-3 py-3 sm:px-5 sm:py-4">执行价</th>
                <th className="hidden px-5 py-4 md:table-cell">到期</th>
                <th className="px-3 py-3 sm:px-5 sm:py-4">单张租金</th>
                <th className="px-3 py-3 sm:px-5 sm:py-4">可开 / 总收益</th>
                <th className="hidden px-5 py-4 lg:table-cell">等级</th>
                <th className="px-3 py-3 sm:px-5 sm:py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((item) => {
                const totalPremium = item.premiumPerMinContractUsd != null
                  ? item.premiumPerMinContractUsd * item.maxLots
                  : null;
                return (
                  <tr key={item.contract.instrumentName} className="border-t border-white/6 transition hover:bg-white/[0.04]">
                    <td className="px-3 py-3 sm:px-5 sm:py-4">
                      <div className="font-medium text-white">{item.contract.instrumentName}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.contract.daysToExpiry} 天后到期</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 sm:px-5 sm:py-4 text-white">
                      ${item.contract.strike.toLocaleString()}
                      <span className="ml-1.5 text-xs text-slate-500">{item.contract.otmPercent}%</span>
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-4 md:table-cell">
                      {item.contract.expiration}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 sm:px-5 sm:py-4">
                      <div className="font-medium text-white">
                        {item.premiumPerMinContractUsd != null
                          ? `$${item.premiumPerMinContractUsd.toLocaleString()}`
                          : "--"}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">{item.premiumPerMinContractBtc} BTC</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 sm:px-5 sm:py-4">
                      <div className="font-medium text-cyan-200">{item.maxLots} 张</div>
                      <div className="mt-0.5 text-xs text-emerald-300/80">
                        {totalPremium != null ? `≈ $${totalPremium.toLocaleString()}` : "--"}
                      </div>
                    </td>
                    <td className="hidden px-5 py-4 lg:table-cell">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneStyles[item.tone]}`}
                      >
                        {item.level}
                      </span>
                    </td>
                    <td className="px-3 py-3 sm:px-5 sm:py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        aria-label={`查看 ${item.contract.instrumentName} 详情`}
                        className="min-h-[44px] rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-400/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

function MetricItem({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${accent ? "text-emerald-300" : "text-white"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
