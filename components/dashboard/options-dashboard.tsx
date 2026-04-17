"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { Activity, AlertTriangle, BookOpen, HelpCircle, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { RecommendationSummary } from "@/components/dashboard/recommendation-summary";
import { OptionDetailDrawer } from "@/components/recommendation/option-detail-drawer";
import { OptionsRecommendationTable } from "@/components/recommendation/options-recommendation-table";
import { StrategyForm } from "@/components/strategy/strategy-form";
import { PayoffCalculator } from "@/components/dashboard/payoff-calculator";
import { StrategyComparison } from "@/components/dashboard/strategy-comparison";
import { VolatilityPanel } from "@/components/dashboard/volatility-panel";
import { MarketOverviewPanel } from "@/components/dashboard/market-overview-panel";
import { PageSidebar, PageTabs, type TabKey } from "@/components/dashboard/page-sidebar";
import { buildRecommendations, getRecommendationMethodology } from "@/lib/domain/recommendation";
import {
  buildSyntheticLongRecommendations,
  getSyntheticLongMethodology,
} from "@/lib/domain/synthetic-long";
import { analyzeMarketOverview } from "@/lib/domain/market-analysis";
import { analyzeVolatility } from "@/lib/domain/volatility";
import { fetchBtcHistoricalSeries, fetchBtcTicker, fetchOptionsChain } from "@/lib/market/deribit-client";
import { validateRecommendationInput } from "@/lib/domain/calculations";
import type {
  ExpiryPayoff,
  Recommendation,
  RecommendationInput,
  SyntheticLongRecommendation,
} from "@/lib/types/option";

const defaultInput: RecommendationInput = {
  strategy: "covered-call",
  availableBtc: 0.145,
  availableCashUsd: 10000,
  cycle: "weekly",
  riskTolerance: "balanced",
  acceptAssignment: true,
  minPremiumPercent: 0.4,
};

type StandardMethodology = ReturnType<typeof getRecommendationMethodology>;
type SyntheticMethodology = ReturnType<typeof getSyntheticLongMethodology>;

export function OptionsDashboard() {
  const [input, setInput] = useState<RecommendationInput>(defaultInput);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("recommendations");
  const [showMethodology, setShowMethodology] = useState(false);
  const [showReadingGuide, setShowReadingGuide] = useState(false);

  const {
    data: ticker,
    error: tickerError,
    isLoading: tickerLoading,
    isValidating: tickerValidating,
    mutate: refreshTicker,
  } = useSWR("btc-ticker", fetchBtcTicker, {
    refreshInterval: 10_000,
    revalidateOnFocus: false,
  });

  const {
    data: chain,
    error: chainError,
    isLoading: chainLoading,
    isValidating: chainValidating,
    mutate: refreshChain,
  } = useSWR("options-chain", fetchOptionsChain, {
    refreshInterval: 20_000,
    revalidateOnFocus: false,
  });

  const {
    data: historicalSeries,
    error: historicalError,
    isLoading: historicalLoading,
  } = useSWR("btc-historical-series", fetchBtcHistoricalSeries, {
    refreshInterval: 60 * 60 * 1000,
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
  const volatility = useMemo(
    () => analyzeVolatility(chain?.options ?? [], ticker?.price ?? null, historicalSeries?.points ?? []),
    [chain?.options, historicalSeries?.points, ticker?.price],
  );
  const marketOverview = useMemo(() => {
    if (!ticker?.price || !(chain?.options?.length)) {
      return null;
    }

    return analyzeMarketOverview({
      currentPrice: ticker.price,
      historicalPrices: historicalSeries?.points ?? [],
      options: chain.options,
      volatility,
    });
  }, [chain?.options, historicalSeries?.points, ticker?.price, volatility]);
  const handleTabChange = useCallback((tab: TabKey) => setActiveTab(tab), []);
  const handleSelectRecommendation = useCallback((recommendation: Recommendation) => setSelected(recommendation), []);
  const topRecommendation = isSyntheticMode ? undefined : standardRecommendations[0];
  const topSyntheticRecommendation = isSyntheticMode ? syntheticRecommendations[0] : undefined;
  const totalCount = isSyntheticMode ? syntheticRecommendations.length : standardRecommendations.length;
  const isLoading = tickerLoading || chainLoading;
  const isValidating = tickerValidating || chainValidating;
  const hasError = tickerError || chainError;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {/* 紧凑头部：一行搞定标题 + 状态 */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-400/10">
              <Activity className="size-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">BTC 期权收租指导</h1>
              <p className="text-xs text-slate-500">实时拉取 Deribit 行情，给你个性化的策略建议</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-1.5 text-sm shadow-sm shadow-black/10">
              <span className="text-slate-500">BTC</span>{" "}
              <span className="font-semibold text-white">{ticker?.price ? `$${ticker.price.toLocaleString()}` : "..."}</span>
            </span>
            <StrategySegmentedControl strategy={input.strategy} onChange={(s) => setInput({ ...input, strategy: s, ...(s === "cash-secured-put" || s === "synthetic-long" ? { acceptAssignment: true } : {}) })} />
            <button
              type="button"
              onClick={() => { void refreshTicker(); void refreshChain(); }}
              className="rounded-lg border border-white/10 bg-slate-950/70 p-2 text-slate-400 transition hover:border-cyan-400/30 hover:text-white"
              title="刷新数据"
            >
              <RefreshCw className={`size-3.5 ${isValidating ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* 摘要卡片 */}
        <RecommendationSummary
          price={ticker?.price}
          recommendation={topRecommendation}
          syntheticRecommendation={topSyntheticRecommendation}
          total={totalCount}
          source={chain?.source ?? ticker?.source}
          updatedAt={chain?.updatedAt ?? ticker?.updatedAt}
          marketLevel={marketOverview?.brief.title}
          marketHint={marketOverview?.brief.riskNote}
          adviceLabel={marketOverview?.advice.label}
        />

        {/* 移动端标签 + 桌面端侧边栏 */}
        <PageTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="flex gap-6">
          <PageSidebar activeTab={activeTab} onTabChange={handleTabChange} />

          <div className="min-w-0 flex-1 space-y-5">
            {activeTab === "market" && (
              <MarketOverviewPanel
                underlyingPrice={ticker?.price}
                volatility={volatility}
                overview={marketOverview}
                historicalLoading={historicalLoading}
                historicalError={Boolean(historicalError)}
              />
            )}

            {activeTab === "recommendations" && (
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <section>
                  <StrategyForm input={input} onChange={setInput} />
                </section>

                <section className="space-y-5">
                  {/* 操作按钮行 */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReadingGuide(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 transition hover:border-cyan-400/30 hover:text-white"
                    >
                      <HelpCircle className="size-3.5" />
                      结果解读
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMethodology(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 transition hover:border-cyan-400/30 hover:text-white"
                    >
                      <BookOpen className="size-3.5" />
                      算法说明
                    </button>
                  </div>

                  {/* 首选建议 */}
                  {isSyntheticMode ? (
                    <TopSyntheticPanel recommendation={topSyntheticRecommendation} />
                  ) : (
                    <TopRecommendationPanel recommendation={topRecommendation} strategy={input.strategy} />
                  )}

                  {/* 推荐列表 */}
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
                      onSelect={handleSelectRecommendation}
                    />
                  )}
                </section>
              </div>
            )}

            {/* 结果解读弹框 */}
            <Dialog open={showReadingGuide} onClose={() => setShowReadingGuide(false)} title={isSyntheticMode ? "这张组合怎么读" : "推荐结果怎么读"}>
              {isSyntheticMode ? (
                <SyntheticInterpretationPanel methodology={syntheticMethodology} recommendation={topSyntheticRecommendation} />
              ) : (
                <ResultInterpretationPanel methodology={standardMethodology} recommendation={topRecommendation} />
              )}
            </Dialog>

            {/* 算法说明弹框 */}
            <Dialog open={showMethodology} onClose={() => setShowMethodology(false)} title={isSyntheticMode ? "组合算法说明" : "算法说明"}>
              {isSyntheticMode ? (
                <SyntheticMethodologyPanel methodology={syntheticMethodology} />
              ) : (
                <MethodologyPanel methodology={standardMethodology} />
              )}
            </Dialog>

            {activeTab === "calculator" && (
              <PayoffCalculator
                selectedContract={selected?.contract ?? null}
                syntheticPut={isSyntheticMode ? topSyntheticRecommendation?.pair.put : undefined}
                underlyingPrice={ticker?.price}
                strategy={input.strategy}
                availableBtc={input.availableBtc}
                availableCashUsd={input.availableCashUsd}
              />
            )}

            {activeTab === "comparison" && (
              <StrategyComparison
                strategy={input.strategy}
                underlyingPrice={ticker?.price}
                recommendation={topRecommendation}
                syntheticRecommendation={topSyntheticRecommendation}
                availableBtc={input.availableBtc}
                availableCashUsd={input.availableCashUsd}
              />
            )}

            {activeTab === "volatility" && (
              <VolatilityPanel
                options={chain?.options ?? []}
                underlyingPrice={ticker?.price}
                historicalPrices={historicalSeries?.points ?? []}
                historicalLoading={historicalLoading}
                historicalError={Boolean(historicalError)}
              />
            )}

            {activeTab === "risk" && (
              <RiskPanel strategy={input.strategy} />
            )}
          </div>
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
      return "卖看跌准备接货 (Cash-Secured Put)";
    case "synthetic-long":
      return "模拟持有 BTC (Synthetic Long)";
    case "covered-call":
    default:
      return "持有 BTC 卖看涨 (Covered Call)";
  }
}

const strategyOptions = [
  { value: "covered-call" as const, label: "卖看涨", shortLabel: "CC" },
  { value: "cash-secured-put" as const, label: "卖看跌", shortLabel: "CSP" },
  { value: "synthetic-long" as const, label: "合成现货", shortLabel: "SL" },
];

function StrategySegmentedControl({
  strategy,
  onChange,
}: {
  strategy: RecommendationInput["strategy"];
  onChange: (strategy: RecommendationInput["strategy"]) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-slate-950/70 p-0.5 shadow-sm shadow-black/10">
      {strategyOptions.map((opt) => {
        const isActive = opt.value === strategy;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? opt.value === "synthetic-long"
                  ? "bg-fuchsia-400/20 text-fuchsia-200"
                  : "bg-cyan-400/20 text-cyan-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="hidden sm:inline">{opt.label}</span>
            <span className="sm:hidden">{opt.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function getTabLabel(tab: TabKey): string {
  const map: Record<TabKey, string> = {
    market: "市场概览",
    recommendations: "策略推荐",
    calculator: "损益计算",
    comparison: "策略对比",
    volatility: "波动率",
    risk: "风险提示",
  };
  return map[tab];
}

function getDisplayErrorMessage(tickerError: unknown, chainError: unknown): string {
  if (tickerError && chainError) {
    return "行情和期权数据暂时都没有加载成功，请稍后刷新再试。";
  }

  if (chainError) {
    return "期权数据暂时没有加载成功，请稍后刷新再试。";
  }

  if (tickerError) {
    return "BTC 价格暂时没有加载成功，请稍后刷新再试。";
  }

  return "数据暂时没有加载成功，请稍后刷新再试。";
}

function formatUsdAmount(value: number | null): string {
  return value == null ? "--" : `$${value.toLocaleString()}`;
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
        暂时没有满足你条件的候选。你可以降低最低租金门槛，或者把周度/保守切到月度/平衡试试。
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-lg shadow-black/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-200">当前首选建议</div>
          <h2 className="mt-3 text-xl font-semibold text-white">{recommendation.contract.instrumentName}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.summary}</p>
        </div>
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200 sm:grid-cols-2 md:min-w-[340px]">
          <MiniMetric label="评分" value={`${recommendation.score}`} />
          <MiniMetric label="触发概率" value={`${Math.abs(recommendation.contract.delta ?? 0).toFixed(3)}`} />
          <MiniMetric label="单张租金" value={formatUsdAmount(recommendation.premiumPerMinContractUsd)} />
          <MiniMetric
            label={strategy === "covered-call" ? "上涨空间" : "跌价保护"}
            value={`${recommendation.contract.otmPercent}%`}
          />
        </div>
      </div>

      <ExpiryPayoffCard payoff={recommendation.expiryPayoff} />
    </section>
  );
}

function TopSyntheticPanel({ recommendation }: { recommendation: SyntheticLongRecommendation | undefined }) {
  if (!recommendation) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-sm leading-7 text-slate-400">
        暂时没有满足你条件的模拟持有 BTC 组合。你可以放宽周期、调整风险偏好，或者增加可用现金后再试。
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-lg shadow-black/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-[11px] text-fuchsia-200">当前首选组合</div>
          <h2 className="mt-1 text-xl font-semibold text-white">
            买 {recommendation.pair.call.instrumentName} / 卖 {recommendation.pair.put.instrumentName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.summary}</p>
        </div>
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200 sm:grid-cols-2 md:min-w-[340px]">
          <MiniMetric label="评分" value={`${recommendation.score}`} />
          <MiniMetric label="净权利金" value={formatUsdAmount(recommendation.pair.netPremiumUsdPerMinContract)} />
          <MiniMetric label="可做最大张数" value={`${recommendation.maxLots}`} />
          <MiniMetric label="名义 BTC" value={`${recommendation.maxTradeAmountBtc} BTC`} />
        </div>
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
          <ReadingHint label="触发概率" description="越接近 1 说明越容易被触发执行，租金通常更厚，但风险也更大。" />
          <ReadingHint label="距触发价距离" description="看你离约定价格还有多远：卖看涨看上涨空间，卖看跌看跌价保护。" />
          <ReadingHint label="折算年收益" description="只是把单期租金按时间折算成年收益，方便比较，不代表每年都能稳定赚到这个数。" />
          <ReadingHint label="单张租金" description="这里统一按 0.1 BTC/张折算，方便你估算真实能收多少。" />
        </div>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-medium text-white">为什么不是只看权利金最高</p>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          {recommendation?.summary ?? "模型会先按方向、触发概率、到期时间和最低租金筛选，再做综合打分。租金只是其中一个维度。"}
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
          <ReadingHint label="买看涨期权" description="放大上涨收益；BTC 涨得越多，买的看涨期权赚得越多。" />
          <ReadingHint label="卖看跌期权" description="用卖看跌赚的租金去付买看涨的成本，但跌的时候风险也来自这里。" />
          <ReadingHint label="净权利金" description="越接近 0 越像零成本入场，但这不代表没有风险。" />
          <ReadingHint label="下跌义务" description="卖出的看跌期权让你在暴跌时被迫按约定价买入，还要额外准备押金。" />
        </div>
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-medium text-white">为什么不是免费持有期权</p>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          {recommendation?.summary ?? "你只是把买看涨的成本转移给了卖看跌的下跌风险。入场净成本接近 0，不等于极端行情的风险消失。"}
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
          这套推荐不是什么看不懂的 AI，而是先按规则筛选，再按综合打分排序。你可以直接看到筛选条件、权重和模型边界。
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
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">第二步：对剩余候选做综合打分</p>
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
          这套组合不是在单腿里挑租金最高，而是在同一到期日里，找买看涨和卖看跌能组合出接近模拟持有 BTC 的方案。
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
        当前条件下没有找到合适的模拟持有 BTC 组合。你可以放宽周期、调高风险偏好，或增加可用现金后再试。
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
              <MiniMetric label="最大跌价损失" value={`$${item.pair.downsideObligationUsd.toLocaleString()}`} />
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
                <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
                  <p className="text-xs text-amber-200/80">盈亏平衡价</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-amber-100">
                    ${item.expiryPayoff.breakEvenPrice.toLocaleString()}
                  </p>
                </div>
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
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-amber-200/80">盈亏平衡价</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-amber-100">
                ${payoff.breakEvenPrice.toLocaleString()}
              </p>
            </div>
            {payoff.estimatedMonthlyUsd != null ? (
              <p className="text-xs text-amber-200/60">假设每期不被触发，持续做下一期</p>
            ) : null}
          </div>
        </div>
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
      正在拉取 BTC 价格和期权数据，请稍等。
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
          "持有 BTC 卖看涨的核心代价不是亏损无限，而是 BTC 大涨时你的上涨收益会被封顶。",
          "越短周期的合约，时间衰减带来的租金收得更快，但临近到期的价格跳动也更敏感。",
          "参考价不等于真实成交价，流动性低的合约要特别注意买卖价差。",
        ]
      : strategy === "cash-secured-put"
        ? [
            "卖看跌准备接货的核心风险是 BTC 大跌时，你会在约定价被迫按约定价买入 BTC。",
            "低触发概率只能降低被迫接货的可能性，不代表你不会接货。",
            "高波动率预期确实让租金更厚，但通常也意味着市场预期接下来波动更大。",
          ]
        : [
            "模拟持有 BTC 的组合不是稳定收租，而是强烈看涨的操作。",
            "暴跌时风险主要来自卖出的看跌期权，下跌时的亏损会明显大于只买看涨期权。",
            "如果账户不是全现金担保，还要额外考虑押金波动和追加押金的压力。",
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
