"use client";

import { validateRecommendationInput } from "@/lib/domain/calculations";
import type { RecommendationInput } from "@/lib/types/option";

interface StrategyFormProps {
  input: RecommendationInput;
  onChange: (next: RecommendationInput) => void;
}

const defaultRiskOptions = [
  { value: "conservative", label: "保守", hint: "优先选更不容易被触发的、约定价格更远的" },
  { value: "balanced", label: "平衡", hint: "在租金和安全边际之间折中" },
  { value: "aggressive", label: "进取", hint: "追求更厚的租金，但更容易被触发执行" },
] as const;

const longCallRiskOptions = [
  { value: "conservative", label: "保守", hint: "优先选更接近现价、Delta 更高的 Call，赢面更高但权利金更贵" },
  { value: "balanced", label: "平衡", hint: "在上涨弹性、兑现概率和权利金成本之间折中" },
  { value: "aggressive", label: "进取", hint: "允许更轻度 OTM 的 Call，成本更低，但更依赖 BTC 快速上涨" },
] as const;

type Tone = "cyan" | "fuchsia" | "emerald";

export function StrategyForm({ input, onChange }: StrategyFormProps) {
  const errors = validateRecommendationInput(input);
  const assignmentLocked = input.strategy === "cash-secured-put";
  const isSyntheticMode = input.strategy === "synthetic-long";
  const isLongCallMode = input.strategy === "long-call";
  const riskOptions = isLongCallMode ? longCallRiskOptions : defaultRiskOptions;
  const tone: Tone = isSyntheticMode ? "fuchsia" : isLongCallMode ? "emerald" : "cyan";
  const toneClasses = getToneClasses(tone);

  return (
    <section className="panel-surface relative overflow-hidden rounded-[24px] p-4 sm:rounded-[32px] sm:p-6">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      <div className="relative">
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.28em] ${toneClasses.badge}`}>
              输入你的条件
            </span>
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-slate-400">
              实时筛选
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">生成个性化期权建议</h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            {isSyntheticMode
              ? "页面会根据你的周期偏好、可用现金和风险偏好，实时筛出更适合的买看涨 + 卖看跌，强烈看涨的组合。"
              : isLongCallMode
                ? "页面会根据你的可用现金和风险偏好，筛出更适合用半年到一年 BTC Call 表达长期看涨观点的仓位。"
                : "页面会根据你的持仓、可用资金、周期偏好和风险偏好，实时筛出更适合的持有 BTC 卖看涨，或卖看跌准备接货。"}
          </p>
        </div>

        <div className="grid gap-4">
          <div>
            <label className="mb-3 block text-sm font-medium text-slate-200">策略类型</label>
            <div className="grid gap-2">
              <ToggleButton
                active={input.strategy === "covered-call"}
                title="持有 BTC 卖看涨"
                subtitle="Covered Call"
                description="适合已经持有 BTC 的收租"
                tone="cyan"
                onClick={() => onChange({ ...input, strategy: "covered-call" })}
              />
              <ToggleButton
                active={input.strategy === "cash-secured-put"}
                title="卖看跌准备接货"
                subtitle="Cash-Secured Put"
                description="适合愿意低位接货的收租"
                tone="cyan"
                onClick={() => onChange({ ...input, strategy: "cash-secured-put", acceptAssignment: true })}
              />
              <ToggleButton
                active={input.strategy === "synthetic-long"}
                title="模拟持有 BTC"
                subtitle="Synthetic Long"
                description="买看涨 + 卖看跌的强烈看涨组合"
                tone="fuchsia"
                onClick={() => onChange({ ...input, strategy: "synthetic-long", acceptAssignment: true })}
              />
              <ToggleButton
                active={input.strategy === "long-call"}
                title="佩洛西打法"
                subtitle="Long Call"
                description="买半年到一年 BTC Call，用有限亏损换上涨弹性"
                tone="emerald"
                onClick={() => onChange({ ...input, strategy: "long-call", acceptAssignment: false, cycle: "monthly" })}
              />
            </div>
          </div>

          {!isLongCallMode ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="可用 BTC"
                value={input.availableBtc}
                step="0.001"
                tone={tone}
                onChange={(value) => onChange({ ...input, availableBtc: value })}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="可用现金（USD）"
              value={input.availableCashUsd}
              step="100"
              tone={tone}
              onChange={(value) => onChange({ ...input, availableCashUsd: value })}
            />
            {isSyntheticMode ? (
              <StaticInfoField
                label="净权利金目标"
                value="尽量接近 0"
                hint="模型会优先找卖看跌赚的钱能覆盖买看涨成本的组合，但这不代表无风险。"
                tone={tone}
              />
            ) : isLongCallMode ? (
              <StaticInfoField
                label="最大亏损"
                value="权利金 = 全部风险"
                hint="你买入的是权利，最坏情况就是这张 Call 到期归零，亏掉全部权利金。"
                tone={tone}
              />
            ) : (
              <NumberField
                label="最低单期权利金 %"
                value={input.minPremiumPercent}
                step="0.1"
                tone={tone}
                onChange={(value) => onChange({ ...input, minPremiumPercent: value })}
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {isLongCallMode ? (
              <StaticInfoField
                label="到期范围"
                value="固定筛选 180-365 天"
                hint="这是这次“佩洛西打法”的产品定义：用半年到一年的 BTC Call 表达长期看涨观点。"
                tone={tone}
              />
            ) : (
              <SelectField
                label="周期偏好"
                value={input.cycle}
                tone={tone}
                options={[
                  { value: "weekly", label: isSyntheticMode ? "周度组合" : "周度收租" },
                  { value: "monthly", label: isSyntheticMode ? "月度组合" : "月度收租" },
                ]}
                onChange={(value) =>
                  onChange({ ...input, cycle: value as RecommendationInput["cycle"] })
                }
              />
            )}
            {assignmentLocked ? (
              <StaticInfoField
                label="接受被动接货"
                value="默认接受"
                hint="卖看跌的前提就是你愿意在约定价格买入 BTC；低触发概率只能降低被触发的可能，不会取消这项义务。"
                tone={tone}
              />
            ) : isSyntheticMode ? (
              <StaticInfoField
                label="下跌义务"
                value="必须接受"
                hint="这个策略的核心风险来自卖出的看跌期权；即使买了看涨，也不能抵消暴跌时被迫买入和追加押金的压力。"
                tone={tone}
              />
            ) : isLongCallMode ? (
              <StaticInfoField
                label="展期方式"
                value="首版不自动滚动"
                hint="临近到期时需要你自己决定平仓、展期或放弃，当前页面只负责帮你选仓和看风险。"
                tone={tone}
              />
            ) : (
              <SelectField
                label="接受 BTC 被按约定价卖出"
                value={String(input.acceptAssignment)}
                tone={tone}
                options={[
                  { value: "true", label: "接受" },
                  { value: "false", label: "尽量避免" },
                ]}
                onChange={(value) => onChange({ ...input, acceptAssignment: value === "true" })}
              />
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">风险偏好</label>
            <div className="grid gap-3 sm:grid-cols-3">
              {riskOptions.map((option) => {
                const active = input.riskTolerance === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...input,
                        riskTolerance: option.value,
                      })
                    }
                    className={`rounded-[24px] border p-4 text-left transition ${
                      active ? toneClasses.cardActive : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="font-medium text-white">{option.label}</div>
                    <div className="mt-2 text-xs leading-6 text-slate-400">{option.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {isSyntheticMode ? (
            <div className="rounded-[26px] border border-fuchsia-400/20 bg-fuchsia-400/8 p-4 text-sm leading-7 text-fuchsia-50/95">
              <p className="font-medium text-fuchsia-100">合成现货模式提示</p>
              <ul className="mt-2 space-y-1">
                <li>- 这是方向性强看涨组合，不是稳定收租。</li>
                <li>- &ldquo;净权利金接近 0&rdquo; 只是入场成本接近 0，不代表没有尾部风险。</li>
                <li>- 暴跌时风险主要来自卖出的看跌期权，而不是买入的看涨。</li>
              </ul>
            </div>
          ) : null}

          {errors.length > 0 ? (
            <div className="rounded-[26px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
              <p className="font-medium text-amber-200">先修正这些输入问题</p>
              <ul className="mt-2 space-y-1">
                {errors.map((error) => (
                  <li key={error}>- {error}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function getToneClasses(tone: Tone) {
  if (tone === "fuchsia") {
    return {
      glow: "bg-fuchsia-500/20",
      badge: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100",
      cardActive: "border-fuchsia-400/30 bg-[linear-gradient(135deg,rgba(217,70,239,0.18),rgba(217,70,239,0.06))] text-white shadow-[0_6px_20px_-6px_rgba(217,70,239,0.35)]",
      input: "border-fuchsia-400/20 bg-slate-950/70 text-white placeholder:text-slate-500 focus:border-fuchsia-300",
      staticField: "border-fuchsia-400/18 bg-[linear-gradient(180deg,rgba(217,70,239,0.12),rgba(255,255,255,0.03))] text-white",
      subtitle: "text-fuchsia-200/70",
      focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]",
    };
  }

  if (tone === "emerald") {
    return {
      glow: "bg-emerald-500/20",
      badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      cardActive: "border-emerald-400/30 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(16,185,129,0.06))] text-white shadow-[0_6px_20px_-6px_rgba(16,185,129,0.35)]",
      input: "border-emerald-400/20 bg-slate-950/70 text-white placeholder:text-slate-500 focus:border-emerald-300",
      staticField: "border-emerald-400/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(255,255,255,0.03))] text-white",
      subtitle: "text-emerald-200/70",
      focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]",
    };
  }

  return {
    glow: "bg-cyan-500/20",
    badge: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
    cardActive: "border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,211,238,0.06))] text-white shadow-[0_6px_20px_-6px_rgba(34,211,238,0.35)]",
    input: "border-cyan-400/20 bg-slate-950/70 text-white placeholder:text-slate-500 focus:border-cyan-300",
    staticField: "border-cyan-400/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(255,255,255,0.03))] text-white",
    subtitle: "text-cyan-200/70",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]",
  };
}

function ToggleButton({
  active,
  title,
  subtitle,
  description,
  tone,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  description: string;
  tone: Tone;
  onClick: () => void;
}) {
  const toneClasses = getToneClasses(tone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-4 text-left transition ${toneClasses.focus} ${
        active ? toneClasses.cardActive : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-baseline gap-2">
        <div className="font-medium text-white">{title}</div>
        {subtitle ? <div className={`text-[11px] uppercase tracking-[0.24em] ${active ? toneClasses.subtitle : "text-slate-500"}`}>{subtitle}</div> : null}
      </div>
      <div className="mt-2 text-xs leading-6 text-slate-400">{description}</div>
    </button>
  );
}

function NumberField({
  label,
  value,
  step,
  min = 0,
  tone,
  onChange,
}: {
  label: string;
  value: number;
  step: string;
  min?: number;
  tone: Tone;
  onChange: (value: number) => void;
}) {
  const toneClasses = getToneClasses(tone);

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? Math.max(parsed, min) : min);
        }}
        className={`w-full rounded-[24px] border px-4 py-3 outline-none transition ${toneClasses.input}`}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  tone,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  tone: Tone;
  onChange: (value: string) => void;
}) {
  const toneClasses = getToneClasses(tone);

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-[24px] border px-4 py-3 outline-none transition ${toneClasses.input}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StaticInfoField({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: Tone }) {
  const toneClasses = getToneClasses(tone);

  return (
    <div className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <div className={`rounded-[24px] border px-4 py-3 font-medium ${toneClasses.staticField}`}>{value}</div>
      <p className="mt-2 text-xs leading-6 text-slate-400">{hint}</p>
    </div>
  );
}
