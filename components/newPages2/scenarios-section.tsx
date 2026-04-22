import { ChevronRight, Sparkles } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent } from "react";
import { SectionHeader } from "@/components/newPages2/section-header";

type Tone = "cyan" | "fuchsia" | "amber" | "emerald";

type TerminalScenario = {
  id: string;
  stage: string;
  title: string;
  subtitle: string;
  description: string;
  trigger: string;
  action: string;
  risk: string;
  fit: string;
  evidence: string[];
  bestRoles: string[];
  tone: Tone;
};

type ToneStyles = {
  badge: string;
  glow: string;
  ring: string;
  accent: string;
};

interface ScenariosSectionProps {
  scenarios: TerminalScenario[];
  activeScenario: TerminalScenario;
  activeTone: ToneStyles;
  activeRoleName: string;
  onScenarioChange: (scenarioId: string) => void;
  onRoleSelect: (roleName: string) => void;
  getNextIndex: (event: ReactKeyboardEvent<HTMLElement>, index: number, total: number) => number | null;
  focusRadioAt: (container: HTMLElement, index: number) => void;
  toneClasses: (tone: Tone) => ToneStyles;
}

export function ScenariosSection({
  scenarios,
  activeScenario,
  activeTone,
  activeRoleName,
  onScenarioChange,
  onRoleSelect,
  getNextIndex,
  focusRadioAt,
  toneClasses,
}: ScenariosSectionProps) {
  return (
    <section id="scenarios" tabIndex={-1} className="scroll-mt-32 sm:scroll-mt-24">
      <div className="panel-surface relative overflow-hidden rounded-[32px] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015),transparent)]" />
        <div className="panel-shell-fade-medium" />
        <div className="panel-shell-content flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            eyebrow="市场剧本"
            title="先判断市场在演哪一出，再决定你是哪种角色"
            description="2.0 的核心不是告诉你哪个数字更好看，而是先把市场语气定下来。剧本不清，策略就会一直变形。"
          />
          <div className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs shadow-[0_12px_30px_-18px_rgba(15,23,42,0.9)] ${activeTone.badge}`}>
            <Sparkles className="size-3.5" />
            当前激活：{activeScenario.stage}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div role="radiogroup" aria-label="市场剧本切换" className="space-y-3">
            {scenarios.map((scenario, index) => {
              const isActive = scenario.id === activeScenario.id;
              const tone = toneClasses(scenario.tone);

              return (
                <button
                  key={scenario.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => onScenarioChange(scenario.id)}
                  onKeyDown={(event) => {
                    const nextIndex = getNextIndex(event, index, scenarios.length);
                    if (nextIndex == null) {
                      return;
                    }

                    const nextScenario = scenarios[nextIndex];
                    if (nextScenario) {
                      onScenarioChange(nextScenario.id);
                      focusRadioAt(event.currentTarget.parentElement as HTMLElement, nextIndex);
                    }
                  }}
                  className={`group relative w-full overflow-hidden rounded-[26px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
                    isActive
                      ? `border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[0_24px_48px_-28px_rgba(34,211,238,0.5)] ring-1 ${tone.ring}`
                      : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className={`pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-white/70 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-35"}`} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{scenario.stage}</p>
                      <h3 className="mt-2 text-base font-medium text-white">{scenario.title}</h3>
                    </div>
                    <ChevronRight className={`mt-0.5 size-4 transition ${isActive ? tone.accent : "text-slate-500 group-hover:text-slate-300"}`} />
                  </div>
                  <p className="relative mt-2 text-sm leading-7 text-slate-300">{scenario.subtitle}</p>
                </button>
              );
            })}
          </div>

          <article className="data-grid relative overflow-hidden rounded-[30px] border border-white/8 bg-[#06101d]/90 p-5 shadow-[0_28px_60px_-34px_rgba(8,145,178,0.42)] sm:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,rgba(255,255,255,0.065),rgba(255,255,255,0.018),transparent)]" />
            <div className="panel-shell-fade-large" />
            <div className="pointer-events-none absolute right-0 top-0 h-full w-[24rem] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.09),transparent_62%)]" />
            <div className="panel-shell-content flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.24em] ${activeTone.badge}`}>
                {activeScenario.stage}
              </span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                剧本面板
              </span>
            </div>

            <div className="panel-shell-content mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_320px]">
              <div>
                <p className={`text-sm font-medium ${activeTone.accent}`}>{activeScenario.subtitle}</p>
                <h3 className="mt-3 text-[1.9rem] font-semibold tracking-[-0.035em] text-white sm:text-[2.25rem]">
                  {activeScenario.title}
                </h3>
                <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300">{activeScenario.description}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="metric-tile rounded-[22px] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">适配阶段</p>
                    <p className="mt-3 text-sm leading-7 text-white">{activeScenario.fit}</p>
                  </div>
                  <div className="metric-tile rounded-[22px] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">最该执行</p>
                    <p className="mt-3 text-sm leading-7 text-white">{activeScenario.action}</p>
                  </div>
                  <div className="metric-tile rounded-[22px] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">别踩的坑</p>
                    <p className="mt-3 text-sm leading-7 text-white">{activeScenario.risk}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">触发信号</p>
                  <p className="mt-3 text-sm leading-7 text-slate-100">{activeScenario.trigger}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,30,0.88),rgba(7,12,22,0.92))] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">推荐上场角色</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeScenario.bestRoles.map((role) => {
                      const normalizedRole = role.replace(/^轻仓\s+/, "").trim();
                      const isSelected = normalizedRole === activeRoleName;

                      return (
                        <button
                          key={role}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => onRoleSelect(role)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
                            isSelected
                              ? "border-cyan-300/34 bg-cyan-400/18 text-cyan-50 shadow-[0_10px_24px_-14px_rgba(34,211,238,0.55)]"
                              : `${activeTone.badge} hover:brightness-110`
                          }`}
                        >
                          {role}
                          {isSelected ? <span className="ml-1.5 text-[10px] uppercase tracking-[0.18em] text-cyan-50/80">已选</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="panel-shell-content mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="metric-tile rounded-[24px] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">这个剧本成立时，你通常会看到</p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                  {activeScenario.evidence.map((item, index) => (
                    <li key={item} className="flex gap-3 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-3">
                      <span className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${activeTone.badge}`}>
                        0{index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,15,26,0.92),rgba(6,11,20,0.94))] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">作战提示</p>
                <p className="mt-3 text-sm leading-7 text-slate-200">如果这里的触发信号和证据还没同时站住，就不要急着往后看合约。先把剧本说顺，再决定谁该上场。</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
