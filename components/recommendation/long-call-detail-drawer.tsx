"use client";

import { useEffect } from "react";
import { TrendingUp, X } from "lucide-react";
import type { LongCallRecommendation } from "@/lib/types/option";

interface LongCallDetailDrawerProps {
  recommendation: LongCallRecommendation | null;
  onClose: () => void;
}

export function LongCallDetailDrawer({ recommendation, onClose }: LongCallDetailDrawerProps) {
  useEffect(() => {
    if (!recommendation) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recommendation, onClose]);

  if (!recommendation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/80">
      <button type="button" className="flex-1 cursor-default" onClick={onClose} aria-label="关闭详情" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="佩洛西打法详情"
        className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-slate-950 px-6 py-6 shadow-lg shadow-black/20"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-cyan-300">{recommendation.level}</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{recommendation.contract.instrumentName}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">这是一张半年到一年期限的 BTC Call，最大亏损锁定在权利金，适合用有限亏损换长期上涨弹性。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-cyan-400 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <MetricCard label="执行价" value={`$${recommendation.contract.strike.toLocaleString()}`} />
          <MetricCard label="到期" value={recommendation.contract.expiration} />
          <MetricCard label="剩余天数" value={`${recommendation.contract.daysToExpiry} 天`} />
          <MetricCard label="Delta" value={`${Math.abs(recommendation.contract.delta ?? 0).toFixed(3)}`} />
          <MetricCard label="权利金 / 张" value={formatUsdAmount(recommendation.premiumPerMinContractUsd)} />
          <MetricCard label="最大亏损" value={formatUsdAmount(recommendation.maxLossUsd)} />
          <MetricCard label="盈亏平衡价" value={recommendation.breakEvenPrice != null ? `$${recommendation.breakEvenPrice.toLocaleString()}` : "--"} />
          <MetricCard label="可开最大张数" value={`${recommendation.maxLots} 张`} />
        </div>

        <Section title="一句话结论">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 text-sm leading-7 text-cyan-50">
            {recommendation.summary}
          </div>
        </Section>

        <Section title="为什么推荐这张">
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            {recommendation.reasons.map((reason) => (
              <li key={reason} className="rounded-2xl border border-white/8 bg-slate-900/70 px-4 py-3">
                {reason}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="评分拆解">
          <div className="space-y-3">
            {recommendation.scoreBreakdown.map((item) => (
              <article key={item.key} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-400">维度得分 {item.scorePercent}% · 权重 {item.weightPercent}%</p>
                  </div>
                  <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-100">
                    贡献 {item.contribution} 分
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.explanation}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section title="到期情景说明">
          <div className="space-y-3">
            {recommendation.scenarios.map((scenario) => (
              <article key={scenario.title} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-sm font-medium text-white">{scenario.title}</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{scenario.description}</p>
              </article>
            ))}
          </div>
        </Section>

        {recommendation.expiryPayoff.scenarios.length > 0 ? (
          <section className="mt-8">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-400" />
              <h4 className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">到期损益预估（每张 0.1 BTC）</h4>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {recommendation.expiryPayoff.scenarios.map((scenario) => (
                <article key={scenario.title} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-xs text-slate-400">{scenario.title}</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {scenario.amountUsd != null
                      ? `${scenario.amountUsd >= 0 ? "赚" : "亏"} $${Math.abs(scenario.amountUsd).toLocaleString()}`
                      : "--"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{scenario.description}</p>
                </article>
              ))}
            </div>
            {recommendation.expiryPayoff.breakEvenPrice != null ? (
              <p className="mt-4 text-sm text-emerald-100/80">
                盈亏平衡价约 ${recommendation.expiryPayoff.breakEvenPrice.toLocaleString()}
              </p>
            ) : null}
          </section>
        ) : null}

        <Section title="不适合你的场景">
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            {recommendation.unsuitableScenarios.map((item) => (
              <li key={item} className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-rose-50/95">
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="你要重点盯的风险">
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            {recommendation.risks.map((risk) => (
              <li key={risk} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
                {risk}
              </li>
            ))}
          </ul>
        </Section>
      </aside>
    </div>
  );
}

function formatUsdAmount(value: number | null): string {
  return value == null ? "--" : `$${value.toLocaleString()}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h4 className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">{title}</h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
