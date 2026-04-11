"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Activity, AlertTriangle, BadgeDollarSign, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { RecommendationSummary } from "@/components/dashboard/recommendation-summary";
import { OptionDetailDrawer } from "@/components/recommendation/option-detail-drawer";
import { OptionsRecommendationTable } from "@/components/recommendation/options-recommendation-table";
import { StrategyForm } from "@/components/strategy/strategy-form";
import { buildRecommendations, getRecommendationMethodology } from "@/lib/domain/recommendation";
import {
  buildSyntheticLongRecommendations,
  getSyntheticLongMethodology,
} from "@/lib/domain/synthetic-long";
import { validateRecommendationInput } from "@/lib/domain/calculations";
import type {
  ExpiryPayoff,
  MarketTickerResponse,
  OptionsChainResponse,
  Recommendation,
  RecommendationInput,
  SyntheticLongRecommendation,
} from "@/lib/types/option";

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(payload?.message ?? payload?.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const defaultInput: RecommendationInput = {
  strategy: "covered-call",
  availableBtc: 0.145,
  availableCashUsd: 10000,
  cycle: "weekly",
  riskTolerance: "balanced",
  acceptAssignment: true,
  minPremiumPercent: 0.4,
};

const navItems = [
  {
    href: "#strategy-input",
    title: "策略输入",
    description: "先设定仓位、周期、风险偏好",
  },
  {
    href: "#top-pick",
    title: "首选建议",
    description: "看为什么这张合约排第一",
  },
  {
    href: "#recommendation-list",
    title: "推荐列表",
    description: "读表前先看筛选和排序逻辑",
  },
  {
    href: "#algorithm",
    title: "算法说明",
    description: "看过滤规则、评分维度和边界",
  },
] as const;

type StandardMethodology = ReturnType<typeof getRecommendationMethodology>;
type SyntheticMethodology = ReturnType<typeof getSyntheticLongMethodology>;

export function OptionsDashboard() {
  const [input, setInput] = useState<RecommendationInput>(defaultInput);
  const [selected, setSelected] = useState<Recommendation | null>(null);

  const {
    data: ticker,
    error: tickerError,
    isLoading: tickerLoading,
    mutate: refreshTicker,
  } = useSWR<MarketTickerResponse>("/api/market/btc", fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: false,
  });

  const {
    data: chain,
    error: chainError,
    isLoading: chainLoading,
    mutate: refreshChain,
  } = useSWR<OptionsChainResponse>("/api/options/chain", fetcher, {
    refreshInterval: 20_000,
    revalidateOnFocus: false,
  });

  const inputErrors = useMemo(() => validateRecommendationInput(input), [input]);
  const isSyntheticMode = input.strategy === "synthetic-long";
  const standardRecommendations = useMemo(
    () => (!isSyntheticMode && inputErrors.length === 0 ? buildRecommendations(chain?.options ?? [], input) : []),
    [isSyntheticMode, chain?.options, input, inputErrors.length],
  );
  const syntheticRecommendations = useMemo(
    () => (isSyntheticMode && inputErrors.length === 0 ? buildSyntheticLongRecommendations(chain?.options ?? [], input) : []),
    [isSyntheticMode, chain?.options, input, inputErrors.length],
  );
  const standardMethodology = useMemo(() => getRecommendationMethodology(input), [input]);
  const syntheticMethodology = useMemo(() => getSyntheticLongMethodology(input), [input]);
  const topRecommendation = isSyntheticMode ? undefined : standardRecommendations[0];
  const topSyntheticRecommendation = isSyntheticMode ? syntheticRecommendations[0] : undefined;
  const totalCount = isSyntheticMode ? syntheticRecommendations.length : standardRecommendations.length;
  const isLoading = tickerLoading || chainLoading;
  const hasError = tickerError || chainError;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#12385a_0%,#07111d_32%,#020617_70%)] text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/65 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-200">
                <Activity className="size-3.5" />
                BTC Option Rent Desk
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                实时期权指导网页
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                输入你的 BTC 仓位、可用资金、周期偏好和风险承受力，页面会实时拉取 BTC 价格与 Deribit 期权链，给出 Covered Call、Cash-Secured Put，或合成现货 / 看涨风险逆转组合建议。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              <StatusPill
                icon={<BadgeDollarSign className="size-4" />}
                label="BTC 现价"
                value={ticker?.price ? `$${ticker.price.toLocaleString()}` : "加载中"}
              />
              <StatusPill
                icon={<Clock3 className="size-4" />}
                label="数据源"
                value={chain?.source ?? ticker?.source ?? "Deribit public API"}
              />
              <StatusPill
                icon={<ShieldCheck className="size-4" />}
                label="当前模式"
                value={getStrategyModeLabel(input.strategy)}
              />
              <button
                type="button"
                onClick={() => {
                  void refreshTicker();
                  void refreshChain();
                }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
              >
                <RefreshCw className="size-4" />
                手动刷新行情
              </button>
            </div>
          </div>
        </header>

        <RecommendationSummary
          price={ticker?.price}
          recommendation={topRecommendation}
          syntheticRecommendation={topSyntheticRecommendation}
          total={totalCount}
          source={chain?.source ?? ticker?.source}
          updatedAt={chain?.updatedAt ?? ticker?.updatedAt}
        />

        <PageNav />

        <div className="grid gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section id="strategy-input" className="scroll-mt-24">
            <StrategyForm input={input} onChange={setInput} />
          </section>

          <section className="space-y-6">
            <section id="top-pick" className="scroll-mt-24">
              {isSyntheticMode ? (
                <TopSyntheticPanel recommendation={topSyntheticRecommendation} />
              ) : (
                <TopRecommendationPanel recommendation={topRecommendation} strategy={input.strategy} />
              )}
            </section>

            <section id="recommendation-list" className="scroll-mt-24 space-y-6">
              {isSyntheticMode ? (
                <SyntheticInterpretationPanel
                  methodology={syntheticMethodology}
                  recommendation={topSyntheticRecommendation}
                />
              ) : (
                <ResultInterpretationPanel
                  methodology={standardMethodology}
                  recommendation={topRecommendation}
                />
              )}

              {hasError ? (
                <ErrorPanel message={getDisplayErrorMessage(tickerError, chainError)} />
              ) : isLoading ? (
                <LoadingPanel />
              ) : inputErrors.length > 0 ? (
                <ErrorPanel title="输入需要修正" message={inputErrors.join(" ")} />
              ) : isSyntheticMode ? (
                <SyntheticRecommendationList recommendations={syntheticRecommendations} />
              ) : (
                <OptionsRecommendationTable
                  recommendations={standardRecommendations}
                  onSelect={(recommendation) => setSelected(recommendation)}
                />
              )}
            </section>

            <section id="algorithm" className="scroll-mt-24">
              {isSyntheticMode ? (
                <SyntheticMethodologyPanel methodology={syntheticMethodology} />
              ) : (
                <MethodologyPanel methodology={standardMethodology} />
              )}
            </section>

            <RiskPanel strategy={input.strategy} />
          </section>
        </div>
      </div>

      {!isSyntheticMode ? (
        <OptionDetailDrawer recommendation={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

function getStrategyModeLabel(strategy: RecommendationInput["strategy"]): string {
  switch (strategy) {
    case "cash-secured-put":
      return "Cash-Secured Put";
    case "synthetic-long":
      return "Synthetic Long";
    case "covered-call":
    default:
      return "Covered Call";
  }
}

function PageNav() {
  return (
    <nav className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {navItems.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
        >
          <p className="text-sm font-medium text-white">{item.title}</p>
          <p className="mt-2 text-xs leading-6 text-slate-400">{item.description}</p>
        </a>
      ))}
    </nav>
  );
}

function getDisplayErrorMessage(tickerError: unknown, chainError: unknown): string {
  if (tickerError && chainError) {
    return "行情和期权链暂时都没有加载成功，请稍后刷新再试。";
  }

  if (chainError) {
    return "期权链暂时没有加载成功，请稍后刷新再试。";
  }

  if (tickerError) {
    return "BTC 价格暂时没有加载成功，请稍后刷新再试。";
  }

  return "数据暂时没有加载成功，请稍后刷新再试。";
}

function formatUsdAmount(value: number | null): string {
  return value == null ? "--" : `$${value.toLocaleString()}`;
}

function StatusPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-lg shadow-black/10">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function TopRecommendationPanel({
  recommendation,
  strategy,
}: {
  recommendation: Recommendation | undefined;
  strategy: RecommendationInput["strategy"];
}) {
  if (!recommendation) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-sm leading-7 text-slate-400">
        暂时没有满足你条件的候选。你可以降低最低权利金门槛，或者把周度/保守切到月度/平衡试试。
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-cyan-200">当前首选建议</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{recommendation.contract.instrumentName}</h2>
          <p className="mt-3 text-sm leading-7 text-cyan-50/90">{recommendation.summary}</p>
          <p className="mt-3 text-xs leading-6 text-cyan-100/80">
            {strategy === "covered-call"
              ? "这不是单纯按租金最高排序，而是在 Delta、周期、租金和上行留白之间找平衡。"
              : "这不是单纯按租金最高排序，而是在 Delta、周期、租金和接货缓冲之间找平衡。"}
          </p>
        </div>
        <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200 sm:grid-cols-2 md:min-w-[360px]">
          <MiniMetric label="评分" value={`${recommendation.score}`} />
          <MiniMetric label="Delta" value={`${Math.abs(recommendation.contract.delta ?? 0).toFixed(3)}`} />
          <MiniMetric label="单张租金" value={formatUsdAmount(recommendation.premiumPerMinContractUsd)} />
          <MiniMetric
            label={strategy === "covered-call" ? "上行留白" : "接货缓冲"}
            value={`${recommendation.contract.otmPercent}%`}
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">模型优先看的维度</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {recommendation.algorithmTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5 text-xs text-cyan-50/90"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {recommendation.reasons.slice(0, 3).map((reason, index) => (
          <article key={reason} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">原因 {index + 1}</p>
            <p className="mt-3 text-sm leading-7 text-slate-100">{reason}</p>
          </article>
        ))}
      </div>

      <ExpiryPayoffCard payoff={recommendation.expiryPayoff} />
    </section>
  );
}

function TopSyntheticPanel({ recommendation }: { recommendation: SyntheticLongRecommendation | undefined }) {
  if (!recommendation) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-sm leading-7 text-slate-400">
        暂时没有满足你条件的合成现货组合。你可以放宽周期、调整风险偏好，或者增加可用现金后再试。
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-6 shadow-2xl shadow-fuchsia-950/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-fuchsia-200">当前首选组合</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            买 {recommendation.pair.call.instrumentName} / 卖 {recommendation.pair.put.instrumentName}
          </h2>
          <p className="mt-3 text-sm leading-7 text-fuchsia-50/90">{recommendation.summary}</p>
          <p className="mt-3 text-xs leading-6 text-fuchsia-100/80">
            这不是稳定收租，而是用 short put 义务去换取更接近零成本的看涨敞口。
          </p>
        </div>
        <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200 sm:grid-cols-2 md:min-w-[360px]">
          <MiniMetric label="评分" value={`${recommendation.score}`} />
          <MiniMetric label="净权利金" value={formatUsdAmount(recommendation.pair.netPremiumUsdPerMinContract)} />
          <MiniMetric label="可做最大张数" value={`${recommendation.maxLots}`} />
          <MiniMetric label="名义 BTC" value={`${recommendation.maxTradeAmountBtc} BTC`} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {recommendation.reasons.slice(0, 3).map((reason, index) => (
          <article key={reason} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-200">原因 {index + 1}</p>
            <p className="mt-3 text-sm leading-7 text-slate-100">{reason}</p>
          </article>
        ))}
      </div>

      <ExpiryPayoffCard payoff={recommendation.expiryPayoff} />
    </section>
  );
}

function ResultInterpretationPanel({
  methodology,
  recommendation,
}: {
  methodology: StandardMethodology;
  recommendation: Recommendation | undefined;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_1fr]">
      <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-medium text-white">这轮结果先怎么筛</p>
        <div className="mt-4 space-y-3">
          {methodology.filters.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">
              <p className="text-sm font-medium text-slate-200">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-medium text-white">推荐表怎么读</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <ReadingHint label="Delta" description="越高代表越贴近实值，租金通常更厚，但被行权/接货概率也更高。" />
          <ReadingHint label="OTM" description="看你离执行价还有多少缓冲；covered call 看上行留白，put 看接货折价。" />
          <ReadingHint label="年化" description="只是横向比较效率，不代表你每期都能稳定滚出这个复利。" />
          <ReadingHint label="单张租金" description="这里统一按 0.1 BTC/张折算，方便你估算真实能收多少。" />
        </div>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-medium text-white">为什么不是只看权利金最高</p>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          {recommendation?.summary ?? "模型会先过滤方向、Delta、周期和最低权利金，再做加权评分。权利金只是其中一个维度。"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {methodology.scoring.map((item) => (
            <span
              key={item.label}
              className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100"
            >
              {item.label} {item.weightPercent}%
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}

function SyntheticInterpretationPanel({
  methodology,
  recommendation,
}: {
  methodology: SyntheticMethodology;
  recommendation: SyntheticLongRecommendation | undefined;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_1fr]">
      <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-medium text-white">这轮组合先怎么筛</p>
        <div className="mt-4 space-y-3">
          {methodology.filters.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">
              <p className="text-sm font-medium text-slate-200">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-medium text-white">这张组合怎么读</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <ReadingHint label="买 Call" description="给你上涨杠杆；涨得越多，long call 的收益越明显。" />
          <ReadingHint label="卖 Put" description="用 short put 收的权利金去补买 call 的成本，但下跌义务也来自这里。" />
          <ReadingHint label="净权利金" description="越接近 0 越像零成本入场，但这不代表没有风险。" />
          <ReadingHint label="下跌义务" description="卖出 put 让你在暴跌时承受接货或保证金压力。" />
        </div>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-medium text-white">为什么不是免费持有期权</p>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          {recommendation?.summary ?? "你只是把买 call 的成本转移给了卖 put 的下跌义务。入场净成本接近 0，不等于尾部风险消失。"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {methodology.scoring.map((item) => (
            <span
              key={item.label}
              className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 text-xs text-fuchsia-100"
            >
              {item.label} {item.weightPercent}%
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}

function MethodologyPanel({ methodology }: { methodology: StandardMethodology }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-white">算法说明</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          这套推荐不是黑箱 AI，而是先按规则过滤，再按加权评分排序。你可以直接看到过滤口径、权重和模型边界。
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">第一步：过滤掉不合格候选</p>
          <div className="mt-4 grid gap-3">
            {methodology.filters.map((item) => (
              <article key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">第二步：对剩余候选做加权评分</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {methodology.scoring.map((item) => (
              <article key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100">
                    权重 {item.weightPercent}%
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
        <p className="text-sm font-medium text-amber-100">模型边界</p>
        <ul className="mt-3 space-y-3 text-sm leading-7 text-amber-50/90">
          {methodology.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SyntheticMethodologyPanel({ methodology }: { methodology: SyntheticMethodology }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-white">组合算法说明</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          这套组合不是在单腿里挑租金最高，而是在同到期买 call / 卖 put 之间找更接近合成现货的强看涨结构。
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">第一步：过滤掉不合格组合</p>
          <div className="mt-4 grid gap-3">
            {methodology.filters.map((item) => (
              <article key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">第二步：给组合打分</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {methodology.scoring.map((item) => (
              <article key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-2.5 py-1 text-xs text-fuchsia-100">
                    权重 {item.weightPercent}%
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-rose-400/20 bg-rose-400/10 p-5">
        <p className="text-sm font-medium text-rose-100">模型边界</p>
        <ul className="mt-3 space-y-3 text-sm leading-7 text-rose-50/90">
          {methodology.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SyntheticRecommendationList({ recommendations }: { recommendations: SyntheticLongRecommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm leading-7 text-slate-400">
        当前条件下没有找到合适的合成现货组合。你可以放宽周期、调高风险偏好，或增加可用现金后再试。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((item) => (
        <article key={`${item.pair.call.instrumentName}-${item.pair.put.instrumentName}`} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm text-fuchsia-200">{item.level}</p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                买 {item.pair.call.instrumentName} / 卖 {item.pair.put.instrumentName}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.summary}</p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 sm:grid-cols-2 lg:min-w-[360px]">
              <MiniMetric label="净权利金" value={formatUsdAmount(item.pair.netPremiumUsdPerMinContract)} />
              <MiniMetric label="到期" value={item.pair.expiration} />
              <MiniMetric label="最大张数" value={`${item.maxLots}`} />
              <MiniMetric label="下跌义务" value={`$${item.pair.downsideObligationUsd.toLocaleString()}`} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {item.algorithmTags.map((tag) => (
              <span key={tag} className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 text-xs text-fuchsia-100">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <InfoListCard title="为什么这组更靠前" tone="neutral" items={item.reasons} />
            <InfoListCard title="核心风险" tone="risk" items={item.risks} />
            <InfoListCard title="不适合你的场景" tone="warning" items={item.unsuitableScenarios} />
          </div>

          {item.expiryPayoff.scenarios.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-4">
              <p className="text-sm font-medium text-fuchsia-200">到期损益预估（每张 0.1 BTC）</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {item.expiryPayoff.scenarios.map((scenario) => (
                  <div key={scenario.title} className="rounded-xl border border-white/8 bg-slate-950/40 px-3 py-2">
                    <p className="text-xs text-slate-400">{scenario.title}</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {scenario.amountUsd != null
                        ? `${scenario.amountUsd >= 0 ? "+" : ""}$${scenario.amountUsd.toLocaleString()}`
                        : "--"}
                    </p>
                  </div>
                ))}
              </div>
              {item.expiryPayoff.breakEvenPrice != null ? (
                <p className="mt-3 text-xs text-slate-400">
                  盈亏平衡价约 ${item.expiryPayoff.breakEvenPrice.toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function InfoListCard({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "neutral" | "risk" | "warning";
  items: string[];
}) {
  const toneClass =
    tone === "risk"
      ? "border-rose-400/20 bg-rose-400/10 text-rose-50/95"
      : tone === "warning"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-50/95"
        : "border-white/10 bg-white/5 text-slate-300";

  return (
    <article className={`rounded-3xl border p-4 ${toneClass}`}>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-3 space-y-3 text-sm leading-7">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function ReadingHint({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">
      <p className="text-sm font-medium text-slate-200">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function ExpiryPayoffCard({ payoff }: { payoff: ExpiryPayoff }) {
  if (payoff.scenarios.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm font-medium text-emerald-200">到期收益预估（每张 0.1 BTC）</p>
        {(payoff.estimatedMonthlyUsd != null || payoff.estimatedAnnualUsd != null) ? (
          <div className="flex gap-4 text-xs text-emerald-100/80">
            {payoff.estimatedMonthlyUsd != null ? (
              <span>估算月收 ~${payoff.estimatedMonthlyUsd.toLocaleString()}</span>
            ) : null}
            {payoff.estimatedAnnualUsd != null ? (
              <span>估算年收 ~${payoff.estimatedAnnualUsd.toLocaleString()}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {payoff.scenarios.map((scenario) => (
          <div key={scenario.title} className="rounded-xl border border-white/8 bg-slate-950/40 px-4 py-3">
            <p className="text-xs text-slate-400">{scenario.title}</p>
            <p className="mt-1 text-base font-semibold text-white">
              {scenario.amountUsd != null
                ? `${scenario.amountUsd >= 0 ? "赚" : "亏"} $${Math.abs(scenario.amountUsd).toLocaleString()}`
                : "换入现货"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{scenario.description}</p>
          </div>
        ))}
      </div>
      {payoff.breakEvenPrice != null ? (
        <p className="mt-4 text-xs text-emerald-100/80">
          盈亏平衡价约 ${payoff.breakEvenPrice.toLocaleString()}
          {payoff.estimatedMonthlyUsd != null ? (
            <span className="ml-2">（假设每期都不被行权，持续滚仓）</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
      正在拉取 BTC 价格和期权链，请稍等。
    </div>
  );
}

function ErrorPanel({ title = "数据加载失败", message }: { title?: string; message: string }) {
  return (
    <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-6 text-sm leading-7 text-amber-100">
      <div className="flex items-center gap-2 font-medium text-amber-200">
        <AlertTriangle className="size-4" />
        {title}
      </div>
      <p className="mt-3">{message}</p>
    </div>
  );
}

function RiskPanel({ strategy }: { strategy: RecommendationInput["strategy"] }) {
  const items =
    strategy === "covered-call"
      ? [
          "covered call 的核心代价不是亏损无限，而是 BTC 大涨时上涨收益会被封顶。",
          "越短周期的合约，theta 收得更快，但临近到期的价格跳动也更敏感。",
          "标记价不等于真实成交价，流动性低的合约要特别注意盘口价差。",
        ]
      : strategy === "cash-secured-put"
        ? [
            "cash-secured put 的核心风险是 BTC 大跌时，你会在执行价被动接入现货。",
            "低 Delta 只能降低被接货概率，不代表你不会接货。",
            "高隐波确实让权利金更肥，但通常也意味着市场预期接下来波动更大。",
          ]
        : [
            "synthetic long / risk reversal 不是稳定收租，而是方向性极强的看涨表达。",
            "暴跌时风险主要来自 short put，下跌尾部会明显重于单纯买 call。",
            "如果账户不是全现金担保，还要额外考虑保证金波动和追保压力。",
          ];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm font-medium text-slate-300">你必须先接受这些风险</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm leading-7 text-slate-300">
            {item}
          </article>
        ))}
      </div>
    </section>
  );
}
