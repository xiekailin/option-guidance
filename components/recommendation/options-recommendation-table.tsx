"use client";

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

export function OptionsRecommendationTable({
  recommendations,
  onSelect,
}: OptionsRecommendationTableProps) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm leading-7 text-slate-400">
        当前条件下没有找到合适候选。你可以放宽最低权利金、调整周/月偏好，或提高可用 BTC / 现金。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/20">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-300">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-400">
            <tr>
              <th className="px-5 py-4">合约</th>
              <th className="px-5 py-4">执行价</th>
              <th className="px-5 py-4">到期 / 天数</th>
              <th className="px-5 py-4">Delta</th>
              <th className="px-5 py-4">OTM</th>
              <th className="px-5 py-4">单张租金</th>
              <th className="px-5 py-4">年化</th>
              <th className="px-5 py-4">等级</th>
              <th className="px-5 py-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((item) => (
              <tr key={item.contract.instrumentName} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-5 py-4">
                  <div className="font-medium text-white">{item.contract.instrumentName}</div>
                  <div className="mt-1 text-xs text-slate-500">最多可做 {item.maxTradeAmountBtc} BTC</div>
                </td>
                <td className="px-5 py-4 text-white">${item.contract.strike.toLocaleString()}</td>
                <td className="px-5 py-4">
                  <div>{item.contract.expiration}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.contract.daysToExpiry} 天</div>
                </td>
                <td className="px-5 py-4">{Math.abs(item.contract.delta ?? 0).toFixed(3)}</td>
                <td className="px-5 py-4">{item.contract.otmPercent}%</td>
                <td className="px-5 py-4">
                  <div>
                    {item.premiumPerMinContractUsd != null
                      ? `$${item.premiumPerMinContractUsd.toLocaleString()}`
                      : "--"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{item.premiumPerMinContractBtc} BTC</div>
                </td>
                <td className="px-5 py-4">{item.contract.annualizedYieldPercent}%</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneStyles[item.tone]}`}
                  >
                    {item.level}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20"
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
