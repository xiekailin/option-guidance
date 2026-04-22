import { ChevronRight } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent } from "react";
import { SectionHeader } from "@/components/newPages2/section-header";

type Tone = "cyan" | "fuchsia" | "amber" | "emerald";

type WorkflowStep = {
  title: string;
  description: string;
  output: string;
  warning: string;
  tone: Tone;
};

type ToneStyles = {
  badge: string;
  glow: string;
  ring: string;
  accent: string;
};

interface WorkflowSectionProps {
  workflowSteps: WorkflowStep[];
  activeWorkflow: WorkflowStep;
  activeWorkflowIndex: number;
  activeWorkflowTone: ToneStyles;
  onWorkflowChange: (index: number) => void;
  getNextIndex: (event: ReactKeyboardEvent<HTMLElement>, index: number, total: number) => number | null;
  focusRadioAt: (container: HTMLElement, index: number) => void;
  toneClasses: (tone: Tone) => ToneStyles;
}

export function WorkflowSection({
  workflowSteps,
  activeWorkflow,
  activeWorkflowIndex,
  activeWorkflowTone,
  onWorkflowChange,
  getNextIndex,
  focusRadioAt,
  toneClasses,
}: WorkflowSectionProps) {
  return (
    <section id="workflow" tabIndex={-1} className="scroll-mt-32 sm:scroll-mt-24">
      <div className="panel-surface relative overflow-hidden rounded-[32px] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.014),transparent)]" />
        <div className="panel-shell-fade-medium" />
        <div className="panel-shell-content">
          <SectionHeader
            eyebrow="作战流程"
            title="从判断到执行，最好像走流程一样，而不是像临场起意"
            description="2.0 最想补的不是更多表，而是完整的决策路径。下面这四步，就是把“我感觉可以做”变成“我知道为什么现在做”。"
          />
        </div>

        <div className="panel-shell-content mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div role="radiogroup" aria-label="作战流程切换" className="relative space-y-3 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-3">
            <div className="pointer-events-none absolute left-[1.85rem] top-8 bottom-8 w-px bg-gradient-to-b from-cyan-300/28 via-white/10 to-transparent" />
            {workflowSteps.map((step, index) => {
              const tone = toneClasses(step.tone);
              const isActive = index === activeWorkflowIndex;
              const isPassed = index < activeWorkflowIndex;
              return (
                <button
                  key={step.title}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => onWorkflowChange(index)}
                  onKeyDown={(event) => {
                    const nextIndex = getNextIndex(event, index, workflowSteps.length);
                    if (nextIndex == null) {
                      return;
                    }

                    onWorkflowChange(nextIndex);
                    focusRadioAt(event.currentTarget.parentElement as HTMLElement, nextIndex);
                  }}
                  className={`group relative w-full overflow-hidden rounded-[26px] border p-4 pl-12 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
                    isActive
                      ? `border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[0_24px_48px_-28px_rgba(34,211,238,0.5)] ring-1 ${tone.ring}`
                      : "border-white/8 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className={`absolute left-4 top-5 inline-flex size-8 items-center justify-center rounded-full border text-[11px] transition ${
                    isActive
                      ? `${tone.badge}`
                      : isPassed
                        ? "border-white/12 bg-white/[0.05] text-slate-200"
                        : "border-white/10 bg-[#07111d] text-slate-500"
                  }`}>
                    0{index + 1}
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${isActive ? tone.badge : "border-white/8 bg-white/[0.03] text-slate-400"}`}>
                      {isActive ? "当前推进" : isPassed ? "已过步骤" : "待推进"}
                    </span>
                    <ChevronRight className={`size-4 transition ${isActive ? tone.accent : "text-slate-500 group-hover:text-slate-300"}`} />
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{step.description}</p>
                </button>
              );
            })}
          </div>

          <article className="metric-tile relative overflow-hidden rounded-[28px] p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.016),transparent)]" />
            <div className="panel-shell-fade-medium" />
            <div className="panel-shell-content flex flex-wrap items-center justify-between gap-3">
              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${activeWorkflowTone.badge}`}>当前推进</span>
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">步骤 0{activeWorkflowIndex + 1} / {workflowSteps.length}</span>
            </div>
            <h3 className="relative mt-4 text-[2rem] font-semibold tracking-[-0.03em] text-white">{activeWorkflow.title}</h3>
            <p className="relative mt-3 text-sm leading-8 text-slate-300">{activeWorkflow.description}</p>
            <div className="relative mt-5 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">此步产出</p>
              <p className="mt-3 text-sm leading-7 text-slate-100">{activeWorkflow.output}</p>
            </div>
            <div className="relative mt-4 rounded-[20px] border border-amber-400/14 bg-amber-500/[0.06] px-4 py-3 text-sm leading-7 text-amber-100/90">
              提醒：{activeWorkflow.warning}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
