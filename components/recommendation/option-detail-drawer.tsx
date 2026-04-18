"use client";

import { useEffect, useRef } from "react";
import type { Recommendation } from "@/lib/types/option";
import { TrendingUp } from "lucide-react";
import { X } from "lucide-react";

interface OptionDetailDrawerProps {
  recommendation: Recommendation | null;
  onClose: () => void;
}

export function OptionDetailDrawer({ recommendation, onClose }: OptionDetailDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!recommendation) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirst = () => {
      const focusable = drawerRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    };

    focusFirst();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) {
        return;
      }

      const focusableElements = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusableElements.length === 0) {
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [recommendation, onClose]);

  if (!recommendation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/82">
      <button type="button" className="flex-1 cursor-default" onClick={onClose} aria-label="关闭详情" />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="期权推荐详情"
        className="panel-surface-strong relative h-full w-full max-w-xl overflow-y-auto border-l border-white/10 px-6 py-6 shadow-[0_8px_30px_-10px_rgba(2,6,23,0.7)]"
      >
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-cyan-300">{recommendation.level}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{recommendation.contract.instrumentName}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-400">{recommendation.assignmentText}</p>
          </div>
          <button
            type="button"
            aria-label="关闭详情"
            onClick={onClose}
            className="rounded-[16px] border border-white/10 p-2 text-slate-300 transition hover:border-cyan-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <MetricCard label="执行价" value={`$${recommendation.contract.strike.toLocaleString()}`} />
          <MetricCard label="到期" value={recommendation.contract.expiration} />
          <MetricCard label="剩余天数" value={`${recommendation.contract.daysToExpiry} 天`} />
          <MetricCard label="触发概率" value={`${Math.abs(recommendation.contract.delta ?? 0).toFixed(3)}`} />
          <MetricCard label="权利金 / 张" value={formatUsdAmount(recommendation.premiumPerMinContractUsd)} />
          <MetricCard label="折算年收益（粗略）" value={`${recommendation.contract.annualizedYieldPercent ?? "--"}%`} />
          <MetricCard label="可开最大张数" value={`${recommendation.maxLots} 张`} />
          <MetricCard label="可覆盖数量" value={`${recommendation.maxTradeAmountBtc} BTC`} />
        </div>

        {recommendation.effectiveBuyCostPerBtc != null ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <p className="text-sm font-medium text-emerald-200">实际买入成本</p>
            <p className="mt-2 text-xl font-semibold text-white">
              ${recommendation.effectiveBuyCostPerBtc.toLocaleString()}/BTC
            </p>
          </div>
        ) : null}

        <Section title="一句话结论">
          <div className="metric-tile rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 text-sm leading-7 text-cyan-50">
            {recommendation.summary}
          </div>
        </Section>

        <Section title="为什么推荐这张">
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            {recommendation.reasons.map((reason) => (
              <li key={reason} className="metric-tile rounded-[22px] px-4 py-3">
                {reason}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="评分拆解">
          <div className="space-y-3">
            {recommendation.scoreBreakdown.map((item) => (
              <article key={item.key} className="metric-tile rounded-[24px] p-4">
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
              <article key={scenario.title} className="metric-tile rounded-[24px] p-4">
                <p className="text-sm font-medium text-white">{scenario.title}</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{scenario.description}</p>
              </article>
            ))}
          </div>
        </Section>

        {recommendation.expiryPayoff.scenarios.length > 0 ? (
          <section className="mt-8 rounded-[28px] border border-emerald-400/20 bg-emerald-400/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-400" />
                <h4 className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">到期收益预估（每张 0.1 BTC）</h4>
              </div>
              {(recommendation.expiryPayoff.estimatedMonthlyUsd != null || recommendation.expiryPayoff.estimatedAnnualUsd != null) ? (
                <div className="flex gap-4 text-xs text-emerald-100/80">
                  {recommendation.expiryPayoff.estimatedMonthlyUsd != null ? (
                    <span>估算月收 ~${recommendation.expiryPayoff.estimatedMonthlyUsd.toLocaleString()}</span>
                  ) : null}
                  {recommendation.expiryPayoff.estimatedAnnualUsd != null ? (
                    <span>估算年收 ~${recommendation.expiryPayoff.estimatedAnnualUsd.toLocaleString()}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {recommendation.expiryPayoff.scenarios.map((scenario) => (
                <article key={scenario.title} className="metric-tile rounded-[20px] px-4 py-3">
                  <p className="text-xs text-slate-400">{scenario.title}</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {scenario.amountUsd != null
                      ? `${scenario.amountUsd >= 0 ? "赚" : "亏"} $${Math.abs(scenario.amountUsd).toLocaleString()}`
                      : "换入现货"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{scenario.description}</p>
                </article>
              ))}
            </div>
            {recommendation.expiryPayoff.breakEvenPrice != null ? (
              <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-emerald-100/80">
                盈亏平衡价约 ${recommendation.expiryPayoff.breakEvenPrice.toLocaleString()}
                {recommendation.expiryPayoff.estimatedMonthlyUsd != null ? (
                  <span className="ml-2">（假设每期都不被触发，持续做下一期）</span>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <Section title="不适合你的场景">
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            {recommendation.unsuitableScenarios.map((item) => (
              <li key={item} className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-rose-50/95">
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="你要重点盯的风险">
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            {recommendation.risks.map((risk) => (
              <li key={risk} className="rounded-[22px] border border-amber-400/20 bg-amber-400/10 px-4 py-3">
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
    <div className="metric-tile rounded-[24px] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
