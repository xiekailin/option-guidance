"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { Activity, AlertTriangle, BookOpen, HelpCircle, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { RecommendationSummary } from "@/components/dashboard/recommendation-summary";
import { OptionDetailDrawer } from "@/components/recommendation/option-detail-drawer";
import { LongCallDetailDrawer } from "@/components/recommendation/long-call-detail-drawer";
import { LongCallRecommendationTable } from "@/components/recommendation/long-call-recommendation-table";
import { OptionsRecommendationTable } from "@/components/recommendation/options-recommendation-table";
import { StrategyForm } from "@/components/strategy/strategy-form";
import { PayoffCalculator } from "@/components/dashboard/payoff-calculator";
import { StrategyComparison } from "@/components/dashboard/strategy-comparison";
import { VolatilityPanel } from "@/components/dashboard/volatility-panel";
import { MarketOverviewPanel } from "@/components/dashboard/market-overview-panel";
import { OptionsPanoramaPanel } from "@/components/dashboard/options-panorama-panel";
import { PageSidebar, PageTabs, type TabKey } from "@/components/dashboard/page-sidebar";
import { buildRecommendations, getRecommendationMethodology } from "@/lib/domain/recommendation";
import {
  buildSyntheticLongRecommendations,
  getSyntheticLongMethodology,
} from "@/lib/domain/synthetic-long";
import { buildLongCallRecommendations, getLongCallMethodology } from "@/lib/domain/long-call";
import { analyzeMarketOverview } from "@/lib/domain/market-analysis";
import { analyzeVolatility } from "@/lib/domain/volatility";
import { analyzeOptionsPanorama } from "@/lib/domain/options-panorama";
import { fetchBtcHistoricalSeries, fetchBtcTicker, fetchOptionsChain } from "@/lib/market/deribit-client";
import { validateRecommendationInput } from "@/lib/domain/calculations";
import type {
  ExpiryPayoff,
  LongCallRecommendation,
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
type LongCallMethodology = ReturnType<typeof getLongCallMethodology>;

export function OptionsDashboard() {
  const [input, setInput] = useState<RecommendationInput>(defaultInput);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [selectedLongCall, setSelectedLongCall] = useState<LongCallRecommendation | null>(null);
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
  const isLongCallMode = input.strategy === "long-call";
  const coveredCallInput = useMemo(
    () => ({ ...input, strategy: "covered-call" as const }),
    [input],
  );
  const cashSecuredPutInput = useMemo(
    () => ({ ...input, strategy: "cash-secured-put" as const, acceptAssignment: true }),
    [input],
  );
  const syntheticLongInput = useMemo(
    () => ({ ...input, strategy: "synthetic-long" as const, acceptAssignment: true }),
    [input],
  );
  const longCallInput = useMemo(
    () => ({ ...input, strategy: "long-call" as const, acceptAssignment: false, cycle: "monthly" as const }),
    [input],
  );
  const coveredCallRecommendations = useMemo(
    () => buildRecommendations(chain?.options ?? [], coveredCallInput),
    [chain?.options, coveredCallInput],
  );
  const cashSecuredPutRecommendations = useMemo(
    () => buildRecommendations(chain?.options ?? [], cashSecuredPutInput),
    [chain?.options, cashSecuredPutInput],
  );
  const allSyntheticRecommendations = useMemo(
    () => buildSyntheticLongRecommendations(chain?.options ?? [], syntheticLongInput),
    [chain?.options, syntheticLongInput],
  );
  const allLongCallRecommendations = useMemo(
    () => buildLongCallRecommendations(chain?.options ?? [], longCallInput),
    [chain?.options, longCallInput],
  );
  const standardRecommendations = useMemo(() => {
    if (isSyntheticMode || isLongCallMode || inputErrors.length > 0) {
      return [];
    }

    return input.strategy === "covered-call" ? coveredCallRecommendations : cashSecuredPutRecommendations;
  }, [cashSecuredPutRecommendations, coveredCallRecommendations, input.strategy, inputErrors.length, isLongCallMode, isSyntheticMode]);
  const syntheticRecommendations = useMemo(
    () => (isSyntheticMode && inputErrors.length === 0 ? allSyntheticRecommendations : []),
    [allSyntheticRecommendations, inputErrors.length, isSyntheticMode],
  );
  const longCallRecommendations = useMemo(
    () => (isLongCallMode && inputErrors.length === 0 ? allLongCallRecommendations : []),
    [allLongCallRecommendations, inputErrors.length, isLongCallMode],
  );
  const standardMethodology = useMemo(() => getRecommendationMethodology(input), [input]);
  const syntheticMethodology = useMemo(() => getSyntheticLongMethodology(syntheticLongInput), [syntheticLongInput]);
  const longCallMethodology = useMemo(() => getLongCallMethodology(longCallInput), [longCallInput]);
  const volatility = useMemo(
    () => analyzeVolatility(chain?.options ?? [], ticker?.price ?? null, historicalSeries?.points ?? []),
    [chain?.options, historicalSeries?.points, ticker?.price],
  );
  const panorama = useMemo(
    () => chain ? analyzeOptionsPanorama(chain.options, ticker?.price ?? 0) : null,
    [chain, ticker?.price],
  );
  const marketOverview = !ticker?.price || !(chain?.options?.length)
    ? null
    : analyzeMarketOverview({
        currentPrice: ticker.price,
        historicalPrices: historicalSeries?.points ?? [],
        options: chain.options,
        volatility,
      });
  const handleTabChange = useCallback((tab: TabKey) => setActiveTab(tab), []);
  const handleSelectRecommendation = useCallback((recommendation: Recommendation) => setSelected(recommendation), []);
  const handleSelectLongCall = useCallback((recommendation: LongCallRecommendation) => setSelectedLongCall(recommendation), []);
  const topCoveredCallRecommendation = coveredCallRecommendations[0];
  const topCashSecuredPutRecommendation = cashSecuredPutRecommendations[0];
  const topRecommendation = !isSyntheticMode && !isLongCallMode ? standardRecommendations[0] : undefined;
  const topSyntheticRecommendation = isSyntheticMode && inputErrors.length === 0 ? syntheticRecommendations[0] : undefined;
  const topLongCallRecommendation = isLongCallMode && inputErrors.length === 0 ? longCallRecommendations[0] : undefined;
  const comparisonSyntheticRecommendation = allSyntheticRecommendations[0];
  const comparisonLongCallRecommendation = allLongCallRecommendations[0];
  const totalCount = isSyntheticMode
    ? syntheticRecommendations.length
    : isLongCallMode
      ? longCallRecommendations.length
      : standardRecommendations.length;
  const isLoading = tickerLoading || chainLoading;
  const isValidating = tickerValidating || chainValidating;
  const hasError = tickerError || chainError;
  const activeModeMeta = isSyntheticMode
    ? {
        badge: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100",
        glow: "bg-fuchsia-500/20",
        iconWrap: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200",
        highlight: "text-fuchsia-200",
        ticket: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-50",
        action: "border-fuchsia-400/18 bg-fuchsia-400/10 text-fuchsia-100 hover:border-fuchsia-300/40 hover:text-white",
        mode: "合成现货",
        note: "买 Call + 卖 Put，把强看涨观点做成一张组合票。",
      }
    : isLongCallMode
      ? {
          badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
          glow: "bg-emerald-500/20",
          iconWrap: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
          highlight: "text-emerald-200",
          ticket: "border-emerald-400/20 bg-emerald-400/10 text-emerald-50",
          action: "border-emerald-400/18 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300/40 hover:text-white",
          mode: "佩洛西打法",
          note: "先锁死权利金亏损，再用半年到一年 Call 押长期上涨弹性。",
        }
      : {
          badge: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
          glow: "bg-cyan-500/20",
          iconWrap: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
          highlight: "text-cyan-200",
          ticket: "border-cyan-400/20 bg-cyan-400/10 text-cyan-50",
          action: "border-cyan-400/18 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300/40 hover:text-white",
          mode: input.strategy === "cash-secured-put" ? "卖看跌准备接货" : "持有 BTC 卖看涨",
          note:
            input.strategy === "cash-secured-put"
              ? "先收一笔权利金，等价格跌下来再按计划接货。"
              : "用手里的 BTC 持续收租，但接受上涨收益被封顶。",
        };

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="panel-surface-strong data-grid relative overflow-hidden rounded-[24px] p-4 sm:rounded-[36px] sm:p-6 lg:p-7">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.28em] ${activeModeMeta.badge}`}>
                  BTC 期权收租指导
                </span>
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Deribit 实时行情
                </span>
              </div>

              <div className="mt-5 flex items-start gap-3 sm:gap-4">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-[18px] border sm:size-14 sm:rounded-[22px] ${activeModeMeta.iconWrap}`}>
                  <Activity className="size-5 sm:size-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">BTC 期权收租指导</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                    实时拉取 Deribit 行情，按你当前仓位、现金和风险偏好，直接给出更像交易终端而不是表单工具的策略视图。
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="metric-tile rounded-[24px] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">当前模式</p>
                  <p className={`mt-3 text-xl font-semibold tracking-tight ${activeModeMeta.highlight}`}>{activeModeMeta.mode}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-400">{activeModeMeta.note}</p>
                </div>
                <div className="metric-tile rounded-[24px] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">候选数量</p>
                  <p className="mt-3 text-xl font-semibold tracking-tight text-white tabular-nums">{totalCount}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-400">符合当前条件并进入排序的合约或组合数量。</p>
                </div>
                <div className="metric-tile rounded-[24px] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">数据状态</p>
                  <p className="mt-3 text-xl font-semibold tracking-tight text-white">
                    {hasError ? "异常" : isLoading ? "同步中" : isValidating ? "刷新中" : "实时在线"}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-slate-400">{chain?.source ?? ticker?.source ?? "等待连接市场数据源"}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:min-w-[430px] xl:max-w-[460px]">
              <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                <div className={`rounded-[28px] border p-5 shadow-[0_8px_24px_-8px_rgba(2,6,23,0.6)] ${activeModeMeta.ticket}`}>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-current/70">BTC 现价</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-white tabular-nums sm:text-4xl">
                    {ticker?.price ? `$${ticker.price.toLocaleString()}` : "..."}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-current/70">{marketOverview?.brief.title ?? "等待市场简报"}</p>
                </div>
                <div className="metric-tile rounded-[28px] p-5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">最近更新</p>
                  <p className="mt-3 text-lg font-semibold tracking-tight text-white">
                    {chain?.updatedAt ?? ticker?.updatedAt ? new Date(chain?.updatedAt ?? ticker?.updatedAt ?? "").toLocaleTimeString() : "--:--:--"}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-slate-400">{isValidating ? "正在拉取最新价格与期权链" : "手动刷新可强制重新同步"}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <StrategySegmentedControl
                  strategy={input.strategy}
                  onChange={(s) => {
                    setSelected(null);
                    setSelectedLongCall(null);
                    setInput({
                      ...input,
                      strategy: s,
                      ...(s === "cash-secured-put" || s === "synthetic-long" ? { acceptAssignment: true } : { acceptAssignment: false }),
                      ...(s === "long-call" ? { cycle: "monthly" } : {}),
                    });
                  }}
                />
                <button
                  type="button"
                  aria-label="刷新数据"
                  onClick={() => {
                    void refreshTicker();
                    void refreshChain();
                  }}
                  className={`flex h-[52px] shrink-0 items-center justify-center rounded-[20px] border px-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${activeModeMeta.action}`}
                  title="刷新数据"
                >
                  <RefreshCw className={`size-4 ${isValidating ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <RecommendationSummary
          strategy={input.strategy}
          price={ticker?.price}
          recommendation={topRecommendation}
          syntheticRecommendation={topSyntheticRecommendation}
          longCallRecommendation={topLongCallRecommendation}
          total={totalCount}
          source={chain?.source ?? ticker?.source}
          updatedAt={chain?.updatedAt ?? ticker?.updatedAt}
          marketLevel={marketOverview?.brief.title}
          marketHint={marketOverview?.brief.riskNote}
          adviceLabel={marketOverview?.advice.label}
        />

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
                  <div className="panel-surface flex flex-wrap gap-2 rounded-[24px] p-2">
                    <button
                      type="button"
                      onClick={() => setShowReadingGuide(true)}
                      className={`flex items-center gap-1.5 rounded-[18px] border px-3 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${activeModeMeta.action}`}
                    >
                      <HelpCircle className="size-3.5" />
                      结果解读
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMethodology(true)}
                      className={`flex items-center gap-1.5 rounded-[18px] border px-3 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${activeModeMeta.action}`}
                    >
                      <BookOpen className="size-3.5" />
                      算法说明
                    </button>
                  </div>

                  {isLongCallMode ? <LongCallStoryPanel /> : null}

                  {/* 首选建议 */}
                  {isSyntheticMode ? (
                    <TopSyntheticPanel recommendation={topSyntheticRecommendation} />
                  ) : isLongCallMode ? (
                    <TopLongCallPanel recommendation={topLongCallRecommendation} />
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
                  ) : isLongCallMode ? (
                    <LongCallRecommendationTable
                      recommendations={longCallRecommendations}
                      onSelect={handleSelectLongCall}
                    />
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
            <Dialog open={showReadingGuide} onClose={() => setShowReadingGuide(false)} title={isSyntheticMode ? "这张组合怎么读" : isLongCallMode ? "这张 Call 怎么读" : "推荐结果怎么读"}>
              {isSyntheticMode ? (
                <SyntheticInterpretationPanel methodology={syntheticMethodology} recommendation={topSyntheticRecommendation} />
              ) : isLongCallMode ? (
                <LongCallInterpretationPanel methodology={longCallMethodology} recommendation={topLongCallRecommendation} />
              ) : (
                <ResultInterpretationPanel methodology={standardMethodology} recommendation={topRecommendation} />
              )}
            </Dialog>

            {/* 算法说明弹框 */}
            <Dialog open={showMethodology} onClose={() => setShowMethodology(false)} title={isSyntheticMode ? "组合算法说明" : isLongCallMode ? "佩洛西打法说明" : "算法说明"}>
              {isSyntheticMode ? (
                <SyntheticMethodologyPanel methodology={syntheticMethodology} />
              ) : isLongCallMode ? (
                <LongCallMethodologyPanel methodology={longCallMethodology} />
              ) : (
                <MethodologyPanel methodology={standardMethodology} />
              )}
            </Dialog>

            {activeTab === "calculator" && (
              <PayoffCalculator
                selectedContract={isLongCallMode
                  ? selectedLongCall?.contract ?? topLongCallRecommendation?.contract ?? null
                  : isSyntheticMode
                    ? topSyntheticRecommendation?.pair.call ?? null
                    : selected?.contract ?? topRecommendation?.contract ?? null}
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
                coveredCallRecommendation={topCoveredCallRecommendation}
                cashSecuredPutRecommendation={topCashSecuredPutRecommendation}
                syntheticRecommendation={comparisonSyntheticRecommendation}
                longCallRecommendation={comparisonLongCallRecommendation}
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

            {activeTab === "panorama" && (
              <OptionsPanoramaPanel panorama={panorama} underlyingPrice={ticker?.price} />
            )}

            {activeTab === "risk" && (
              <RiskPanel strategy={input.strategy} />
            )}
          </div>
        </div>
      </div>

      {!isSyntheticMode && !isLongCallMode ? (
        <OptionDetailDrawer recommendation={selected} onClose={() => setSelected(null)} />
      ) : null}
      {isLongCallMode ? (
        <LongCallDetailDrawer recommendation={selectedLongCall} onClose={() => setSelectedLongCall(null)} />
      ) : null}
    </div>
  );
}

const strategyOptions = [
  { value: "covered-call" as const, label: "卖看涨", shortLabel: "CC" },
  { value: "cash-secured-put" as const, label: "卖看跌", shortLabel: "CSP" },
  { value: "synthetic-long" as const, label: "合成现货", shortLabel: "SL" },
  { value: "long-call" as const, label: "佩洛西打法", shortLabel: "PL" },
];

function StrategySegmentedControl({
  strategy,
  onChange,
}: {
  strategy: RecommendationInput["strategy"];
  onChange: (strategy: RecommendationInput["strategy"]) => void;
}) {
  return (
    <div className="panel-surface inline-flex flex-wrap gap-1 rounded-[22px] p-1.5 shadow-[0_8px_24px_-8px_rgba(2,6,23,0.6)]">
      {strategyOptions.map((opt) => {
        const isActive = opt.value === strategy;
        const activeClass =
          opt.value === "synthetic-long"
            ? "border-fuchsia-400/25 bg-[linear-gradient(135deg,rgba(217,70,239,0.22),rgba(217,70,239,0.08))] text-fuchsia-100"
            : opt.value === "long-call"
              ? "border-emerald-400/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(16,185,129,0.08))] text-emerald-100"
              : "border-cyan-400/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,211,238,0.08))] text-cyan-100";

        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.value)}
            className={`min-h-[44px] rounded-[16px] border px-3 py-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
              isActive ? activeClass : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-slate-200"
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
      <div className="panel-surface rounded-[32px] border-dashed p-8 text-sm leading-7 text-slate-400">
        暂时没有满足你条件的候选。你可以降低最低租金门槛，或者把周度/保守切到月度/平衡试试。
      </div>
    );
  }

  return (
    <section className="panel-surface relative overflow-hidden rounded-[32px] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-200">当前首选建议</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{recommendation.contract.instrumentName}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">{recommendation.summary}</p>
        </div>
        <div className="grid gap-3 rounded-[26px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200 sm:grid-cols-2 md:min-w-[340px]">
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
      <div className="panel-surface rounded-[32px] border-dashed p-8 text-sm leading-7 text-slate-400">
        暂时没有满足你条件的模拟持有 BTC 组合。你可以放宽周期、调整风险偏好，或者增加可用现金后再试。
      </div>
    );
  }

  return (
    <section className="panel-surface relative overflow-hidden rounded-[32px] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-fuchsia-200">当前首选组合</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            买 {recommendation.pair.call.instrumentName} / 卖 {recommendation.pair.put.instrumentName}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">{recommendation.summary}</p>
        </div>
        <div className="grid gap-3 rounded-[26px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200 sm:grid-cols-2 md:min-w-[340px]">
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

function TopLongCallPanel({ recommendation }: { recommendation: LongCallRecommendation | undefined }) {
  if (!recommendation) {
    return (
      <div className="panel-surface rounded-[32px] border-dashed p-8 text-sm leading-7 text-slate-400">
        暂时没有满足你条件的佩洛西打法候选。你可以提高可用现金，或者把风险偏好从保守调到平衡/进取试试。
      </div>
    );
  }

  return (
    <section className="panel-surface relative overflow-hidden rounded-[32px] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-200">当前首选 Call</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{recommendation.contract.instrumentName}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">{recommendation.summary}</p>
        </div>
        <div className="grid gap-3 rounded-[26px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200 sm:grid-cols-2 md:min-w-[340px]">
          <MiniMetric label="评分" value={`${recommendation.score}`} />
          <MiniMetric label="单张权利金" value={formatUsdAmount(recommendation.premiumPerMinContractUsd)} />
          <MiniMetric label="最大亏损" value={formatUsdAmount(recommendation.maxLossUsd)} />
          <MiniMetric label="盈亏平衡" value={recommendation.breakEvenPrice != null ? `$${recommendation.breakEvenPrice.toLocaleString()}` : "--"} />
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
      <article className="metric-tile rounded-[28px] p-5">
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

      <article className="metric-tile rounded-[28px] p-5">
        <p className="text-sm font-medium text-white">推荐表怎么读</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <ReadingHint label="触发概率" description="越接近 1 说明越容易被触发执行，租金通常更厚，但风险也更大。" />
          <ReadingHint label="距触发价距离" description="看你离约定价格还有多远：卖看涨看上涨空间，卖看跌看跌价保护。" />
          <ReadingHint label="折算年收益" description="只是把单期租金按时间折算成年收益，方便比较，不代表每年都能稳定赚到这个数。" />
          <ReadingHint label="单张租金" description="这里统一按 0.1 BTC/张折算，方便你估算真实能收多少。" />
        </div>
      </article>

      <article className="metric-tile rounded-[28px] p-5">
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
      <article className="metric-tile rounded-[28px] p-5">
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

      <article className="metric-tile rounded-[28px] p-5">
        <p className="text-sm font-medium text-white">这张组合怎么读</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <ReadingHint label="买看涨期权" description="放大上涨收益；BTC 涨得越多，买的看涨期权赚得越多。" />
          <ReadingHint label="卖看跌期权" description="用卖看跌赚的租金去付买看涨的成本，但跌的时候风险也来自这里。" />
          <ReadingHint label="净权利金" description="越接近 0 越像零成本入场，但这不代表没有风险。" />
          <ReadingHint label="下跌义务" description="卖出的看跌期权让你在暴跌时被迫按约定价买入，还要额外准备押金。" />
        </div>
      </article>

      <article className="metric-tile rounded-[28px] p-5">
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

function LongCallInterpretationPanel({
  methodology,
  recommendation,
}: {
  methodology: LongCallMethodology;
  recommendation: LongCallRecommendation | undefined;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_1fr]">
      <article className="metric-tile rounded-[28px] p-5">
        <p className="text-sm font-medium text-white">这轮 Call 先怎么筛</p>
        <div className="mt-4 space-y-3">
          {methodology.filters.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">
              <p className="text-sm font-medium text-slate-200">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="metric-tile rounded-[28px] p-5">
        <p className="text-sm font-medium text-white">这张 Call 怎么读</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <ReadingHint label="单张权利金" description="这是你入场时付出的全部成本，也是这张票理论上的最大亏损。" />
          <ReadingHint label="盈亏平衡价" description="BTC 到期至少要涨到这个价位附近，你才开始真正值回票价。" />
          <ReadingHint label="Delta" description="越高越接近现货替代，越低越偏赔率更大但更依赖大涨。" />
          <ReadingHint label="180-365 天" description="这是本次产品定义里的半年到一年窗口，用来表达更长期的看涨判断。" />
        </div>
      </article>

      <article className="metric-tile rounded-[28px] p-5">
        <p className="text-sm font-medium text-white">为什么它不是稳赚看涨</p>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          {recommendation?.summary ?? "你买的是上涨弹性，不是确定性收益。方向看对但时点不对，时间价值和 IV 回落也会让你亏钱。"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {methodology.scoring.map((item) => (
            <span
              key={item.label}
              className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100"
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
    <section className="panel-surface rounded-[32px] p-6">
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
              <article key={item.label} className="metric-tile rounded-[24px] p-4">
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
              <article key={item.label} className="metric-tile rounded-[24px] p-4">
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

      <div className="mt-6 rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-5">
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
    <section className="panel-surface rounded-[32px] p-6">
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
              <article key={item.label} className="metric-tile rounded-[24px] p-4">
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
              <article key={item.label} className="metric-tile rounded-[24px] p-4">
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

      <div className="mt-6 rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-5">
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

function LongCallStoryPanel() {
  return (
    <section className="panel-surface rounded-[32px] p-5">
      <div className="max-w-4xl">
        <p className="text-sm font-medium text-emerald-200">佩洛西打法是什么</p>
        <p className="mt-3 text-sm leading-7 text-slate-200">
          这里说的“佩洛西打法”，本质上不是收租，也不是神秘内幕模板，而是用一张半年到一年期限的 BTC Call，去表达更长期的看涨判断：先把最大亏损锁在权利金里，等行情自己走出来。
        </p>
      </div>

      <div className="mt-4 metric-tile rounded-[24px] border border-emerald-400/20 bg-emerald-400/8 p-4 text-sm leading-7 text-emerald-50/95">
        <p className="font-medium text-emerald-100">大白话讲解</p>
        <ul className="mt-2 space-y-2">
          <li>- 你不是在收租，你是在花一笔可见的门票钱，买未来半年到一年 BTC 上涨的弹性。</li>
          <li>- 涨得够快、够猛，这张票会明显升值；涨得太慢，票也可能一天天缩水。</li>
          <li>- 最坏情况不是“无限亏”，而是这张 Call 到期没价值，你亏掉整张票的钱。</li>
        </ul>
      </div>
    </section>
  );
}

function LongCallMethodologyPanel({ methodology }: { methodology: LongCallMethodology }) {
  return (
    <section className="panel-surface rounded-[32px] p-6">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-white">佩洛西打法说明</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          这里说的“佩洛西打法”，不是神秘秘籍，而是把民间常说的“买半年到一年的看涨期权，方向对了就吃上涨弹性，临近到期再决定走不走”标准化成一个 BTC 版本。
        </p>
      </div>

      <div className="mt-6 metric-tile rounded-[28px] border border-emerald-400/20 bg-emerald-400/8 p-5 text-sm leading-7 text-emerald-50/95">
        <p className="font-medium text-emerald-100">大白话解释</p>
        <ul className="mt-3 space-y-2">
          <li>- 你不是在收租，而是在花一笔看得见的成本，买未来半年到一年 BTC 上涨的弹性。</li>
          <li>- 它像是“先花小钱买一个看涨门票”，涨得快、涨得够多，这张门票就值钱。</li>
          <li>- 如果 BTC 不涨、涨得太慢，或者波动率回落，这张票就会慢慢缩水，最坏情况直接归零。</li>
        </ul>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">第一步：过滤掉不合格 Call</p>
          <div className="mt-4 grid gap-3">
            {methodology.filters.map((item) => (
              <article key={item.label} className="metric-tile rounded-[24px] p-4">
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">第二步：给候选 Call 打分</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {methodology.scoring.map((item) => (
              <article key={item.label} className="metric-tile rounded-[24px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-100">
                    权重 {item.weightPercent}%
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-5">
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

function SyntheticRecommendationList({ recommendations }: { recommendations: SyntheticLongRecommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <div className="panel-surface rounded-[32px] border-dashed p-8 text-center text-sm leading-7 text-slate-400">
        当前条件下没有找到合适的模拟持有 BTC 组合。你可以放宽周期、调高风险偏好，或增加可用现金后再试。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((item) => (
        <article key={`${item.pair.call.instrumentName}-${item.pair.put.instrumentName}`} className="panel-surface rounded-[32px] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm text-fuchsia-200">{item.level}</p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                买 {item.pair.call.instrumentName} / 卖 {item.pair.put.instrumentName}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.summary}</p>
            </div>
            <div className="grid gap-3 rounded-[26px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200 sm:grid-cols-2 lg:min-w-[360px]">
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
            <div className="mt-5 rounded-[28px] border border-fuchsia-400/20 bg-fuchsia-400/5 p-4">
              <p className="text-sm font-medium text-fuchsia-200">到期损益预估（每张 0.1 BTC）</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {item.expiryPayoff.scenarios.map((scenario) => (
                  <div key={scenario.title} className="metric-tile rounded-[20px] px-4 py-3">
                    <p className="text-xs text-slate-400">{scenario.title}</p>
                    <p className="mt-1 text-base font-semibold text-white">
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
        : "border-white/10 bg-white/[0.03] text-slate-300";

  return (
    <article className={`rounded-[28px] border p-4 ${toneClass}`}>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-3 space-y-3 text-sm leading-7">
        {items.map((item) => (
          <li key={item} className="rounded-[18px] border border-white/8 bg-slate-950/35 px-3.5 py-3">
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function ReadingHint({ label, description }: { label: string; description: string }) {
  return (
    <div className="metric-tile rounded-[20px] px-4 py-3">
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
    <div className="mt-6 rounded-[28px] border border-emerald-400/20 bg-emerald-400/5 p-5">
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
          <div key={scenario.title} className="metric-tile rounded-[20px] px-4 py-3">
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
    <div className="metric-tile rounded-[18px] p-3.5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white tabular-nums">{value}</div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="panel-surface rounded-[32px] p-8 text-sm text-slate-300">
      正在拉取 BTC 价格和期权数据，请稍等。
    </div>
  );
}

function ErrorPanel({ title = "数据加载失败", message }: { title?: string; message: string }) {
  return (
    <div className="rounded-[32px] border border-amber-400/20 bg-amber-400/10 p-6 text-sm leading-7 text-amber-100">
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
        : strategy === "long-call"
          ? [
              "佩洛西打法的最大亏损虽然锁定在权利金，但这笔亏损仍可能是 100% 权利金，不能把“有限亏损”理解成“亏不多”。",
              "方向看对但时间不对也会亏钱；BTC 涨得太慢，时间价值衰减会持续吃掉这张 Call 的价格。",
              "如果你是在高 IV 环境里买入，后面即使 BTC 没怎么跌，IV 回落也会压缩期权价值。",
            ]
          : [
              "模拟持有 BTC 的组合不是稳定收租，而是强烈看涨的操作。",
              "暴跌时风险主要来自卖出的看跌期权，下跌时的亏损会明显大于只买看涨期权。",
              "如果账户不是全现金担保，还要额外考虑押金波动和追加押金的压力。",
            ];

  return (
    <section className="panel-surface rounded-[32px] p-6">
      <p className="text-sm font-medium text-slate-300">你必须先接受这些风险</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item} className="metric-tile rounded-[24px] p-4 text-sm leading-7 text-slate-300">
            {item}
          </article>
        ))}
      </div>
    </section>
  );
}
