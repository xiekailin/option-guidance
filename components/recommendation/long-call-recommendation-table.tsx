"use client";

import { memo } from "react";
import type { LongCallRecommendation } from "@/lib/types/option";

interface LongCallRecommendationTableProps {
  recommendations: LongCallRecommendation[];
  onSelect: (recommendation: LongCallRecommendation) => void;
}

const toneStyles = {
  safe: "bg-emerald-400/15 text-emerald-200 border-emerald-400/20",
  balanced: "bg-cyan-400/15 text-cyan-200 border-cyan-400/20",
  aggressive: "bg-amber-400/15 text-amber-200 border-amber-400/20",
};

export const LongCallRecommendationTable = memo(function LongCallRecommendationTable({
  recommendations,
  onSelect,
}: LongCallRecommendationTableProps) {
  if (recommendations.length === 0) {
    return (
      <div className="panel-surface rounded-[32px] border-dashed p-8 text-center text-sm leading-7 text-slate-400">
        当前条件下没有找到合适的佩洛西打法候选。你可以提高可用现金，或把风险偏好从保守调到平衡/进取试试。
      </div>
    );
  }

  return (
    <div className="panel-surface overflow-hidden rounded-[24px] sm:rounded-[32px]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-300">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.2em] text-slate-400">
            <tr>
              <th className="px-3 py-3 sm:px-5 sm:py-4">合约</th>
              <th className="px-3 py-3 sm:px-5 sm:py-4">执行价</th>
              <th className="hidden px-5 py-4 md:table-cell">到期</th>
              <th className="px-3 py-3 sm:px-5 sm:py-4">单张权利金</th>
              <th className="hidden px-5 py-4 lg:table-cell">盈亏平衡</th>
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((item) => (
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
                <td className="hidden px-5 py-4 lg:table-cell">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneStyles[item.tone]}`}>
                    {item.breakEvenPrice != null ? `$${item.breakEvenPrice.toLocaleString()}` : item.level}
                  </span>
                </td>
                <td className="px-3 py-3 sm:px-5 sm:py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="min-h-[44px] rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-emerald-400/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
