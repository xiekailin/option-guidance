import { ChevronRight } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent } from "react";
import { SectionHeader } from "@/components/newPages2/section-header";

type Tone = "cyan" | "fuchsia" | "amber" | "emerald";

type OpportunityCard = {
  name: string;
  bias: string;
  edge: string;
  execution: string;
  warning: string;
  bestFor: string;
  capital: string;
  decay: string;
  tone: Tone;
};

type ToneStyles = {
  badge: string;
  glow: string;
  ring: string;
  accent: string;
};

interface StrategyAxis {
  label: string;
  values: string[];
}

interface StrategiesSectionProps {
  opportunities: OpportunityCard[];
  activeStrategy: OpportunityCard;
  activeStrategyTone: ToneStyles;
  strategyAxes: StrategyAxis[];
  recommendedRoles: string[];
  suggestedWorkflowLabel: string;
  onStrategyChange: (strategyName: string) => void;
  onSuggestWorkflow: () => void;
  getNextIndex: (event: ReactKeyboardEvent<HTMLElement>, index: number, total: number) => number | null;
  focusRadioAt: (container: HTMLElement, index: number) => void;
  toneClasses: (tone: Tone) => ToneStyles;
  isRoleRecommended: (roleName: string, bestRoles: string[]) => boolean;
}

export function StrategiesSection({
  opportunities,
  activeStrategy,
  activeStrategyTone,
  strategyAxes,
  recommendedRoles,
  suggestedWorkflowLabel,
  onStrategyChange,
  onSuggestWorkflow,
  getNextIndex,
  focusRadioAt,
  toneClasses,
  isRoleRecommended,
}: StrategiesSectionProps) {
  return (
    <section id="strategies" tabIndex={-1} className="scroll-mt-32 space-y-5 sm:scroll-mt-24">
      <div className="panel-surface relative overflow-hidden rounded-[32px] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.014),transparent)]" />
        <div className="panel-shell-fade-medium" />
        <div className="panel-shell-content">
          <SectionHeader
            eyebrow="策略角色"
            title="四种打法不是四张表，而是四种完全不同的性格"
            description="2.0 先把策略当成角色看：谁负责稳收益，谁负责等接货，谁负责冲趋势，谁只拿来买弹性。角色分清楚，执行就不容易打架。"
          />
        </div>

        <div className="panel-shell-content mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div role="radiogroup" aria-label="策略角色切换" className="space-y-3">
            {opportunities.map((opportunity, index) => {
              const tone = toneClasses(opportunity.tone);
              const isActive = opportunity.name === activeStrategy.name;
              const isRecommended = isRoleRecommended(opportunity.name, recommendedRoles);

              return (
                <button
                  key={opportunity.name}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => onStrategyChange(opportunity.name)}
                  onKeyDown={(event) => {
                    const nextIndex = getNextIndex(event, index, opportunities.length);
                    if (nextIndex == null) {
                      return;
                    }

                    const nextStrategy = opportunities[nextIndex];
                    if (nextStrategy) {
                      onStrategyChange(nextStrategy.name);
                      focusRadioAt(event.currentTarget.parentElement as HTMLElement, nextIndex);
                    }
                  }}
                  className={`group relative w-full overflow-hidden rounded-[26px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
                    isActive
                      ? `border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[0_24px_48px_-28px_rgba(34,211,238,0.5)] ring-1 ${tone.ring}`
                      : "border-white/8 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-white">{opportunity.name}</h3>
                        {isRecommended ? (
                          <span className="rounded-full border border-cyan-400/16 bg-cyan-400/[0.06] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
                            当前剧本适配
                          </span>
                        ) : null}
                      </div>
                      <p className={`mt-2 text-sm ${tone.accent}`}>{opportunity.bias}</p>
                    </div>
                    <ChevronRight className={`mt-0.5 size-4 transition ${isActive ? tone.accent : "text-slate-500 group-hover:text-slate-300"}`} />
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{opportunity.edge}</p>
                </button>
              );
            })}
          </div>

          <article className="metric-tile relative overflow-hidden rounded-[28px] p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.014),transparent)]" />
            <div className="panel-shell-fade-medium" />
            <div className="panel-shell-content flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={`text-sm font-medium ${activeStrategyTone.accent}`}>{activeStrategy.bias}</p>
                  <h3 className="mt-3 text-[1.8rem] font-semibold tracking-[-0.03em] text-white">{activeStrategy.name}</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${activeStrategyTone.badge}`}>
                  角色主卡
                </span>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4">
                <dl className="space-y-4 text-sm leading-7">
                  <div>
                    <dt className="text-slate-500">适合场景</dt>
                    <dd className="mt-1 text-slate-200">{activeStrategy.edge}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">执行重点</dt>
                    <dd className="mt-1 text-slate-200">{activeStrategy.execution}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">适合谁</dt>
                    <dd className="mt-1 text-slate-200">{activeStrategy.bestFor}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">一句提醒</dt>
                    <dd className="mt-1 text-slate-200">{activeStrategy.warning}</dd>
                  </div>
                </dl>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,15,26,0.92),rgba(7,13,24,0.9))] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">资金感觉</p>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{activeStrategy.capital}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,15,26,0.92),rgba(7,13,24,0.9))] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">时间关系</p>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{activeStrategy.decay}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onSuggestWorkflow}
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-slate-100 transition hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
              >
                建议推进：{suggestedWorkflowLabel}
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </article>
        </div>
      </div>

      <div className="panel-surface relative overflow-hidden rounded-[32px] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(90deg,rgba(148,163,184,0.08),rgba(148,163,184,0.02),transparent)]" />
        <div className="panel-shell-fade-compact" />
        <div className="panel-shell-content">
          <SectionHeader
            eyebrow="角色对照"
            title="别只问收益率，更要问它到底是哪种打法"
            description="1.0 更像实时推荐台，2.0 先帮你把打法的性格记住。下面这组维度，不是绝对分数，而是帮助你快速分流。"
          />
        </div>

        <div className="panel-shell-content mt-5 grid gap-3 lg:grid-cols-2">
          {strategyAxes.map((axis) => (
            <article key={axis.label} className="metric-tile rounded-[24px] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{axis.label}</p>
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">战术对照</span>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                {axis.values.map((value) => (
                  <li key={value} className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5">{value}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
