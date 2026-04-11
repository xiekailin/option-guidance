"use client";

import { validateRecommendationInput } from "@/lib/domain/calculations";
import type { RecommendationInput } from "@/lib/types/option";

interface StrategyFormProps {
  input: RecommendationInput;
  onChange: (next: RecommendationInput) => void;
}

const riskOptions = [
  { value: "conservative", label: "保守", hint: "优先更低 Delta 和更远执行价" },
  { value: "balanced", label: "平衡", hint: "在租金和安全边际之间折中" },
  { value: "aggressive", label: "进取", hint: "追求更厚权利金，但更容易被行权" },
] as const;

export function StrategyForm({ input, onChange }: StrategyFormProps) {
  const errors = validateRecommendationInput(input);
  const assignmentLocked = input.strategy === "cash-secured-put";
  const isSyntheticMode = input.strategy === "synthetic-long";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/10 backdrop-blur">
      <div className="mb-6">
        <p className="text-sm font-medium text-cyan-300">输入你的条件</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">生成个性化期权建议</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {isSyntheticMode
            ? "页面会根据你的周期偏好、可用现金和风险偏好，实时筛出更适合的买 call + 卖 put 强看涨组合。"
            : "页面会根据你的持仓、可用资金、周期偏好和风险偏好，实时筛出更适合的 Covered Call 或 Cash-Secured Put。"}
        </p>
      </div>

      <div className="grid gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">策略类型</label>
          <div className="grid gap-3 md:grid-cols-3">
            <ToggleButton
              active={input.strategy === "covered-call"}
              title="Covered Call"
              description="适合已经持有 BTC 的收租"
              onClick={() => onChange({ ...input, strategy: "covered-call" })}
            />
            <ToggleButton
              active={input.strategy === "cash-secured-put"}
              title="Cash-Secured Put"
              description="适合愿意低位接货的收租"
              onClick={() => onChange({ ...input, strategy: "cash-secured-put", acceptAssignment: true })}
            />
            <ToggleButton
              active={input.strategy === "synthetic-long"}
              title="Synthetic Long"
              description="买 call + 卖 put 的强看涨组合"
              onClick={() => onChange({ ...input, strategy: "synthetic-long", acceptAssignment: true })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="可用 BTC"
            value={input.availableBtc}
            step="0.001"
            onChange={(value) => onChange({ ...input, availableBtc: value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="可用现金（USD）"
            value={input.availableCashUsd}
            step="100"
            onChange={(value) => onChange({ ...input, availableCashUsd: value })}
          />
          {!isSyntheticMode ? (
            <NumberField
              label="最低单期权利金 %"
              value={input.minPremiumPercent}
              step="0.1"
              onChange={(value) => onChange({ ...input, minPremiumPercent: value })}
            />
          ) : (
            <StaticInfoField
              label="净权利金目标"
              value="尽量接近 0"
              hint="模型会优先找卖 put 权利金大致覆盖买 call 成本的组合，但这不代表无风险。"
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="周期偏好"
            value={input.cycle}
            options={[
              { value: "weekly", label: isSyntheticMode ? "周度组合" : "周度收租" },
              { value: "monthly", label: isSyntheticMode ? "月度组合" : "月度收租" },
            ]}
            onChange={(value) =>
              onChange({ ...input, cycle: value as RecommendationInput["cycle"] })
            }
          />
          {assignmentLocked ? (
            <StaticInfoField
              label="接受被动接货"
              value="默认接受"
              hint="Cash-secured put 的前提就是愿意在执行价接货；低 Delta 只能降低概率，不会取消这项义务。"
            />
          ) : isSyntheticMode ? (
            <StaticInfoField
              label="下跌义务"
              value="必须接受"
              hint="这个策略的核心风险来自卖 put；即使买了 call，也不能抵消暴跌时的接货或保证金压力。"
            />
          ) : (
            <SelectField
              label="接受被行权卖出"
              value={String(input.acceptAssignment)}
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
                  className={`rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-cyan-400 bg-cyan-400/10 text-white shadow-lg shadow-cyan-900/20"
                      : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-400/60 hover:bg-slate-900"
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">{option.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        {isSyntheticMode ? (
          <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4 text-sm leading-6 text-fuchsia-50/95">
            <p className="font-medium text-fuchsia-100">合成现货模式提示</p>
            <ul className="mt-2 space-y-1">
              <li>- 这是方向性强看涨组合，不是稳定收租。</li>
              <li>- &ldquo;净权利金接近 0&rdquo; 只是入场成本接近 0，不代表没有尾部风险。</li>
              <li>- 暴跌时风险主要来自 short put，而不是 long call。</li>
            </ul>
          </div>
        ) : null}

        {errors.length > 0 ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            <p className="font-medium text-amber-200">先修正这些输入问题</p>
            <ul className="mt-2 space-y-1">
              {errors.map((error) => (
                <li key={error}>- {error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ToggleButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-cyan-400 bg-cyan-400/10 text-white"
          : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-400/60"
      }`}
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
    </button>
  );
}

function NumberField({
  label,
  value,
  step,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  step: string;
  min?: number;
  onChange: (value: number) => void;
}) {
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
        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-400"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
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

function StaticInfoField({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white">{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}
