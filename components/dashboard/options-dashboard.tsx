"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import useSWR from "swr";
import { Activity, AlertTriangle, ArrowUpRight, BookOpen, HelpCircle, RefreshCw } from "lucide-react";
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
import { StrategyExpiryCalendarPanel } from "@/components/dashboard/strategy-expiry-calendar-panel";
import { PageSidebar, PageTabs, navItems, type SectionKey } from "@/components/dashboard/page-sidebar";
import { buildRecommendations, getRecommendationMethodology } from "@/lib/domain/recommendation";
import {
  buildSyntheticLongRecommendations,
  getSyntheticLongMethodology,
} from "@/lib/domain/synthetic-long";
import { buildLongCallRecommendations, getLongCallMethodology } from "@/lib/domain/long-call";
import { analyzeMarketOverview } from "@/lib/domain/market-analysis";
import { analyzeVolatility } from "@/lib/domain/volatility";
import { analyzeOptionsPanorama, buildExpiryCalendarDays } from "@/lib/domain/options-panorama";
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

const sectionKeys = navItems.map((item) => item.key);
const mobileSectionOffset = 128;
const desktopSectionOffset = 96;
const sectionAlignmentTolerance = 24;

function isSectionKey(value: string): value is SectionKey {
  return sectionKeys.includes(value as SectionKey);
}

function getSectionScrollOffset() {
  return window.matchMedia("(min-width: 640px)").matches ? desktopSectionOffset : mobileSectionOffset;
}

function getSectionScrollBehavior(forceDesktopPrecision = false): ScrollBehavior {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "instant";
  }

  if (forceDesktopPrecision && window.matchMedia("(min-width: 640px)").matches) {
    return "instant";
  }

  return window.matchMedia("(max-width: 639px)").matches ? "instant" : "smooth";
}

export function OptionsDashboard() {
  const [input, setInput] = useState<RecommendationInput>(defaultInput);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [selectedLongCall, setSelectedLongCall] = useState<LongCallRecommendation | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>("recommendations");
  const [showMethodology, setShowMethodology] = useState(false);
  const [showReadingGuide, setShowReadingGuide] = useState(false);
  const [isDesktopSectionViewport, setIsDesktopSectionViewport] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.matchMedia("(min-width: 640px)").matches;
  });
  const pendingSectionRef = useRef<SectionKey | null>(null);
  const initialHashLockRef = useRef<SectionKey | null>(null);
  const lockReleaseTimeoutRef = useRef<number | null>(null);

  const cancelLockRelease = useCallback(() => {
    if (lockReleaseTimeoutRef.current != null) {
      window.clearTimeout(lockReleaseTimeoutRef.current);
      lockReleaseTimeoutRef.current = null;
    }
  }, []);

  const clearSectionLocks = useCallback(() => {
    pendingSectionRef.current = null;
    initialHashLockRef.current = null;
    cancelLockRelease();
  }, [cancelLockRelease]);

  const scheduleLockRelease = useCallback((delay?: number) => {
    cancelLockRelease();
    const resolvedDelay = delay ?? (window.matchMedia("(max-width: 639px)").matches ? 220 : 1200);
    lockReleaseTimeoutRef.current = window.setTimeout(() => {
      pendingSectionRef.current = null;
      initialHashLockRef.current = null;
      lockReleaseTimeoutRef.current = null;
    }, resolvedDelay);
  }, [cancelLockRelease]);

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
  const calendarDays = useMemo(
    () => chain ? buildExpiryCalendarDays(chain.options, panorama?.maxPainPoints ?? [], ticker?.price ?? 0) : [],
    [chain, panorama?.maxPainPoints, ticker?.price],
  );
  const marketOverview = !ticker?.price || !(chain?.options?.length)
    ? null
    : analyzeMarketOverview({
        currentPrice: ticker.price,
        historicalPrices: historicalSeries?.points ?? [],
        options: chain.options,
        volatility,
      });
  const handleNavigate = useCallback((section: SectionKey, event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    const scrollToSection = (target: HTMLElement, behavior: ScrollBehavior) => {
      const offset = getSectionScrollOffset();
      const top = window.scrollY + target.getBoundingClientRect().top - offset;
      window.scrollTo({ top: Math.max(top, 0), behavior });
    };

    const target = document.getElementById(section);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    initialHashLockRef.current = null;
    pendingSectionRef.current = section;
    setActiveSection(section);
    window.history.pushState(null, "", `#${section}`);
    scrollToSection(target, getSectionScrollBehavior(true));
    scheduleLockRelease();
  }, [scheduleLockRelease]);
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

  useEffect(() => {
    const viewportQuery = window.matchMedia("(min-width: 640px)");
    const syncViewport = () => {
      setIsDesktopSectionViewport((current) => (current === viewportQuery.matches ? current : viewportQuery.matches));
    };

    syncViewport();
    viewportQuery.addEventListener("change", syncViewport);

    const sections = sectionKeys
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node instanceof HTMLElement);

    if (sections.length === 0) {
      return () => {
        viewportQuery.removeEventListener("change", syncViewport);
      };
    }

    const scrollToSection = (target: HTMLElement, behavior: ScrollBehavior) => {
      const offset = getSectionScrollOffset();
      const top = window.scrollY + target.getBoundingClientRect().top - offset;
      window.scrollTo({ top: Math.max(top, 0), behavior });
    };

    const updateActiveSection = () => {
      const offset = getSectionScrollOffset();
      const maxScrollTop = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      const hasReachedStableTarget = (rect: DOMRect) => {
        const desiredTop = window.scrollY + rect.top - offset;
        const canAlignExactly = desiredTop >= 0 && desiredTop <= maxScrollTop;
        const isAligned = Math.abs(rect.top - offset) <= sectionAlignmentTolerance;
        const isVisibleAtViewportAnchor = rect.top <= window.innerHeight * 0.55 && rect.bottom > offset;
        return isAligned || (!canAlignExactly && isVisibleAtViewportAnchor);
      };

      const initialHashLock = initialHashLockRef.current;
      if (initialHashLock) {
        const lockedTarget = document.getElementById(initialHashLock);
        if (lockedTarget instanceof HTMLElement) {
          if (hasReachedStableTarget(lockedTarget.getBoundingClientRect())) {
            setActiveSection(initialHashLock);
            pendingSectionRef.current = null;
            initialHashLockRef.current = null;
            return;
          }
          return;
        }
        initialHashLockRef.current = null;
      }

      const pendingSection = pendingSectionRef.current;
      if (pendingSection) {
        const pendingTarget = document.getElementById(pendingSection);
        if (pendingTarget instanceof HTMLElement) {
          if (hasReachedStableTarget(pendingTarget.getBoundingClientRect())) {
            setActiveSection(pendingSection);
            pendingSectionRef.current = null;
            return;
          }
          return;
        }
        pendingSectionRef.current = null;
      }

      const anchoredSection = [...sections]
        .filter((section) => {
          const rect = section.getBoundingClientRect();
          return rect.top <= offset + sectionAlignmentTolerance && rect.bottom > offset + sectionAlignmentTolerance;
        })
        .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];

      const visibleSections = sections.filter((section) => {
        const rect = section.getBoundingClientRect();
        return rect.bottom > offset && rect.top < window.innerHeight * 0.55;
      });
      const nextSection = anchoredSection ?? [...(visibleSections.length > 0 ? visibleSections : sections)]
        .sort((a, b) => {
          const aTop = Math.abs(a.getBoundingClientRect().top - offset);
          const bTop = Math.abs(b.getBoundingClientRect().top - offset);
          return aTop - bTop;
        })[0];

      const nextId = nextSection?.id;
      if (nextId && isSectionKey(nextId)) {
        setActiveSection(nextId);
      }
    };

    const observer = new IntersectionObserver(
      () => {
        updateActiveSection();
      },
      {
        rootMargin: `${-(isDesktopSectionViewport ? desktopSectionOffset : mobileSectionOffset)}px 0px -55% 0px`,
        threshold: [0, 0.2, 0.45, 0.7],
      },
    );

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (!isSectionKey(hash)) {
        return;
      }

      const target = document.getElementById(hash);
      if (!(target instanceof HTMLElement)) {
        return;
      }

      initialHashLockRef.current = null;
      pendingSectionRef.current = hash;
      setActiveSection(hash);
      scrollToSection(target, getSectionScrollBehavior(true));
      scheduleLockRelease();
    };

    sections.forEach((section) => {
      observer.observe(section);
    });

    let scrollSyncFrame: number | null = null;
    const syncActiveSection = () => {
      if (scrollSyncFrame != null) {
        return;
      }
      scrollSyncFrame = window.requestAnimationFrame(() => {
        scrollSyncFrame = null;
        updateActiveSection();
      });
    };

    const handleManualScrollIntent = () => {
      clearSectionLocks();
      syncActiveSection();
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("resize", syncActiveSection, { passive: true });
    window.addEventListener("wheel", handleManualScrollIntent, { passive: true });
    window.addEventListener("touchmove", handleManualScrollIntent, { passive: true });
    window.addEventListener("pointerdown", handleManualScrollIntent, { passive: true });

    const initialHash = window.location.hash.slice(1);
    const timeoutIds: number[] = [];
    const frame = window.requestAnimationFrame(() => {
      if (isSectionKey(initialHash)) {
        initialHashLockRef.current = initialHash;
        pendingSectionRef.current = initialHash;
        setActiveSection(initialHash);
        const target = document.getElementById(initialHash);
        if (target instanceof HTMLElement) {
          scrollToSection(target, "instant");
        }
        timeoutIds.push(window.setTimeout(() => updateActiveSection(), 120));
        timeoutIds.push(window.setTimeout(() => updateActiveSection(), 480));
        return;
      }

      updateActiveSection();
    });

    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
      window.cancelAnimationFrame(frame);
      if (scrollSyncFrame != null) {
        window.cancelAnimationFrame(scrollSyncFrame);
      }
      observer.disconnect();
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("resize", syncActiveSection);
      window.removeEventListener("wheel", handleManualScrollIntent);
      window.removeEventListener("touchmove", handleManualScrollIntent);
      window.removeEventListener("pointerdown", handleManualScrollIntent);
      viewportQuery.removeEventListener("change", syncViewport);
      cancelLockRelease();
    };
  }, [cancelLockRelease, clearSectionLocks, isDesktopSectionViewport, scheduleLockRelease]);

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto w-full max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="relative flex flex-col gap-4 sm:gap-5 xl:pl-[5.9rem]">
          <PageSidebar
            activeSection={activeSection}
            onNavigate={handleNavigate}
          />
          <PageTabs activeSection={activeSection} onNavigate={handleNavigate} />

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
                <div className="flex items-center gap-3">
                  <Link
                    href="/newPages2"
                    className="flex h-[52px] items-center gap-2 rounded-[20px] border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:border-cyan-300/35 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
                  >
                    <span>进入 2.0</span>
                    <ArrowUpRight className="size-4" />
                  </Link>
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
          loading={isLoading}
          refreshing={isValidating && !isLoading}
        />

          <div className="min-w-0 space-y-5 pb-24 sm:pb-32 xl:pb-40">
            <MarketOverviewPanel
              underlyingPrice={ticker?.price}
              volatility={volatility}
              overview={marketOverview}
              historicalLoading={historicalLoading}
              historicalError={Boolean(historicalError)}
            />

            <section id="recommendations" className="scroll-mt-32 sm:scroll-mt-24">
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <section className="xl:sticky xl:top-6 xl:self-start">
                  <StrategyForm input={input} onChange={setInput} />
                </section>

                <section className="space-y-5">
                  <div className="sticky top-[calc(env(safe-area-inset-top)+4.75rem)] z-20 -mx-1 rounded-[28px] px-1 py-1 xl:top-[calc(env(safe-area-inset-top)+0.75rem)]">
                    <div className="panel-surface flex flex-wrap items-center justify-between gap-3 rounded-[24px] p-2.5 shadow-[0_10px_24px_-16px_rgba(2,6,23,0.8)]">
                      <div className="flex flex-wrap gap-2">
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
                      <div className="flex min-h-[36px] items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400" aria-live="polite">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 ${isLoading ? "border-white/10 bg-white/[0.04] text-slate-300" : isValidating ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"}`}>
                          {isLoading ? "加载中" : isValidating ? "刷新中" : "已同步"}
                        </span>
                        <span className="hidden text-slate-500 sm:inline">
                          {isLoading ? "正在拉取价格与期权链" : isValidating ? "保留当前内容并后台更新" : "当前结果已是最新一轮"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isLongCallMode ? <LongCallStoryPanel /> : null}

                  {isSyntheticMode ? (
                    <TopSyntheticPanel recommendation={topSyntheticRecommendation} />
                  ) : isLongCallMode ? (
                    <TopLongCallPanel recommendation={topLongCallRecommendation} />
                  ) : (
                    <TopRecommendationPanel recommendation={topRecommendation} strategy={input.strategy} />
                  )}

                  {hasError ? (
                    <ErrorPanel message={getDisplayErrorMessage(tickerError, chainError)} />
                  ) : isLoading ? (
                    <LoadingPanel mode={isLongCallMode ? "long-call" : isSyntheticMode ? "synthetic" : "standard"} />
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
            </section>

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

            <VolatilityPanel
              options={chain?.options ?? []}
              underlyingPrice={ticker?.price}
              historicalPrices={historicalSeries?.points ?? []}
              historicalLoading={historicalLoading}
              historicalError={Boolean(historicalError)}
            />

            <OptionsPanoramaPanel panorama={panorama} underlyingPrice={ticker?.price} />

            <StrategyExpiryCalendarPanel
              calendarDays={calendarDays}
              panorama={panorama}
            />

            <section id="risk" className="scroll-mt-32 pb-[calc(100vh-18rem)] sm:scroll-mt-24 sm:pb-[calc(100vh-16rem)] xl:pb-[calc(100vh-12rem)]">
              <RiskPanel
                strategy={input.strategy}
                recommendation={isSyntheticMode ? topSyntheticRecommendation : isLongCallMode ? topLongCallRecommendation : topRecommendation}
              />
            </section>

            <Dialog open={showReadingGuide} onClose={() => setShowReadingGuide(false)} title={isSyntheticMode ? "这张组合怎么读" : isLongCallMode ? "这张 Call 怎么读" : "推荐结果怎么读"}>
              {isSyntheticMode ? (
                <SyntheticInterpretationPanel methodology={syntheticMethodology} recommendation={topSyntheticRecommendation} />
              ) : isLongCallMode ? (
                <LongCallInterpretationPanel methodology={longCallMethodology} recommendation={topLongCallRecommendation} />
              ) : (
                <ResultInterpretationPanel methodology={standardMethodology} recommendation={topRecommendation} />
              )}
            </Dialog>

            <Dialog open={showMethodology} onClose={() => setShowMethodology(false)} title={isSyntheticMode ? "组合算法说明" : isLongCallMode ? "佩洛西打法说明" : "算法说明"}>
              {isSyntheticMode ? (
                <SyntheticMethodologyPanel methodology={syntheticMethodology} />
              ) : isLongCallMode ? (
                <LongCallMethodologyPanel methodology={longCallMethodology} />
              ) : (
                <MethodologyPanel methodology={standardMethodology} />
              )}
            </Dialog>
          </div>
        </div>
      </div>

      {!isSyntheticMode && !isLongCallMode ? (
        <OptionDetailDrawer
          recommendation={selected}
          onClose={() => setSelected(null)}
          availableBtc={input.availableBtc}
          availableCashUsd={input.availableCashUsd}
        />
      ) : null}
      {isLongCallMode ? (
        <LongCallDetailDrawer
          recommendation={selectedLongCall}
          onClose={() => setSelectedLongCall(null)}
          availableBtc={input.availableBtc}
          availableCashUsd={input.availableCashUsd}
        />
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

function LoadingPanel({ mode }: { mode: "standard" | "synthetic" | "long-call" }) {
  if (mode === "synthetic") {
    return (
      <div className="space-y-4" aria-live="polite">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="panel-surface rounded-[32px] p-5">
            <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
            <div className="mt-4 h-8 w-3/4 animate-pulse rounded-full bg-white/10" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-white/10" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((__, metricIndex) => (
                <div key={metricIndex} className="metric-tile rounded-[20px] p-4">
                  <div className="h-3 w-16 animate-pulse rounded-full bg-white/10" />
                  <div className="mt-3 h-6 w-24 animate-pulse rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="panel-surface rounded-[32px] p-5" aria-live="polite">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="h-8 w-3/4 animate-pulse rounded-full bg-white/10" />
          <div className="h-4 w-full animate-pulse rounded-full bg-white/10" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="metric-tile rounded-[20px] p-4">
              <div className="h-3 w-16 animate-pulse rounded-full bg-white/10" />
              <div className="mt-3 h-6 w-24 animate-pulse rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3 sm:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="metric-tile rounded-[24px] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-white/10" />
                <div className="mt-3 h-3 w-24 animate-pulse rounded-full bg-white/10" />
              </div>
              <div className="h-10 w-16 animate-pulse rounded-full bg-white/10" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((__, metricIndex) => (
                <div key={metricIndex} className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3">
                  <div className="h-3 w-12 animate-pulse rounded-full bg-white/10" />
                  <div className="mt-2 h-5 w-16 animate-pulse rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 hidden overflow-hidden rounded-[24px] border border-white/6 sm:block">
        <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1fr_0.8fr] gap-0 bg-white/[0.04] px-5 py-4 text-xs uppercase tracking-[0.2em] text-slate-500">
          {(mode === "long-call"
            ? ["合约", "执行价", "到期", "单张权利金", "可开 / 总成本", "操作"]
            : ["合约", "执行价", "到期", "单张租金", "可开 / 总收益", "操作"]
          ).map((label) => <div key={label}>{label}</div>)}
        </div>
        {Array.from({ length: 4 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1fr_0.8fr] gap-0 border-t border-white/6 px-5 py-4">
            {Array.from({ length: 6 }).map((__, cellIndex) => (
              <div key={cellIndex} className="pr-4">
                <div className={`animate-pulse rounded-full bg-white/10 ${cellIndex === 0 ? "h-4 w-3/4" : cellIndex === 5 ? "h-10 w-16" : "h-4 w-20"}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
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

interface RiskScenarioCard {
  id: string;
  title: string;
  description: string;
  tone: "rose" | "amber" | "cyan" | "fuchsia" | "emerald";
  signalLabel: string;
  linkedRisk: string;
  linkedCheck: string;
}

interface RiskViewModel {
  summary: string;
  coreRisks: string[];
  scenarioReminders: Array<{ title: string; description: string }>;
  disciplineChecks: string[];
  scenarioCards: RiskScenarioCard[];
}

function RiskPanel({
  strategy,
  recommendation,
}: {
  strategy: RecommendationInput["strategy"];
  recommendation?: Recommendation | LongCallRecommendation | SyntheticLongRecommendation;
}) {
  const fallback = getDefaultRiskView(strategy);
  const riskView = buildRiskViewModel(strategy, recommendation) ?? fallback;

  return (
    <RiskPanelStage
      key={`${strategy}-${recommendationKey(recommendation)}`}
      riskView={riskView}
    />
  );
}

function RiskPanelStage({ riskView }: { riskView: RiskViewModel }) {
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
  const scenarioButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeScenario = riskView.scenarioCards[activeScenarioIndex] ?? riskView.scenarioCards[0];
  const activeTabId = `risk-scenario-tab-${activeScenario.id}`;
  const activePanelId = `risk-scenario-panel-${activeScenario.id}`;

  const handleScenarioKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }

    event.preventDefault();
    const lastIndex = riskView.scenarioCards.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowRight"
            ? (index + 1) % riskView.scenarioCards.length
            : (index - 1 + riskView.scenarioCards.length) % riskView.scenarioCards.length;

    setActiveScenarioIndex(nextIndex);
    scenarioButtonRefs.current[nextIndex]?.focus();
  };

  return (
    <section className="panel-surface rounded-[32px] p-6 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200/75">风险演练台</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">下单前先过一遍最坏剧本</h2>
          <div className="mt-3 rounded-[24px] border border-amber-400/18 bg-amber-400/[0.07] px-4 py-3.5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/70">一句话结论</p>
            <p className="mt-2 text-sm leading-7 text-slate-100">{riskView.summary}</p>
          </div>
        </div>
        <div className="rounded-[22px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-6 text-amber-50/90 lg:max-w-[320px]">
          先接受最坏路径，再决定要不要下单。
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/75">风险剧本卡</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">切换不同路径，看看这笔仓位会先在哪个环节让你难受。</p>
          </div>
          <p className="text-xs text-slate-500">左右键也可以切换剧本</p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3" role="tablist" aria-label="风险剧本卡">
          {riskView.scenarioCards.map((scenario, index) => {
            const tone = getRiskScenarioToneClasses(scenario.tone);
            const isActive = index === activeScenarioIndex;
            const tabId = `risk-scenario-tab-${scenario.id}`;
            const panelId = `risk-scenario-panel-${scenario.id}`;
            return (
              <button
                key={scenario.id}
                id={tabId}
                ref={(node) => {
                  scenarioButtonRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveScenarioIndex(index)}
                onKeyDown={(event) => handleScenarioKeyDown(event, index)}
                className={`rounded-[24px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
                  isActive ? tone.active : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-[11px] uppercase tracking-[0.22em] ${isActive ? tone.subtitle : "text-slate-500"}`}>{scenario.signalLabel}</p>
                    <p className="mt-2 text-sm font-medium text-white">{scenario.title}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${isActive ? tone.badge : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
                    剧本 {index + 1}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">{scenario.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <section
          id={activePanelId}
          className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5"
          role="tabpanel"
          aria-labelledby={activeTabId}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/75">当前剧本</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{activeScenario.title}</h3>
            </div>
            <span className="rounded-full border border-cyan-400/18 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
              {activeScenario.signalLabel}
            </span>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-100">{activeScenario.description}</p>
          <div className="mt-4 rounded-[22px] border border-rose-400/18 bg-rose-400/[0.08] px-4 py-3.5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-rose-200/70">这条路径会怎么让你难受</p>
            <p className="mt-2 text-sm leading-7 text-slate-100">{activeScenario.linkedRisk}</p>
          </div>
        </section>

        <section className="space-y-3">
          <article className="metric-tile rounded-[24px] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-rose-300/80">当前最相关的核心风险</p>
            <p className="mt-2.5 text-sm leading-7 text-slate-100">{activeScenario.linkedRisk}</p>
          </article>
          <article className="rounded-[24px] border border-amber-400/20 bg-amber-400/8 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/80">当前最该执行的动作</p>
            <p className="mt-2.5 text-sm leading-7 text-amber-50/95">{activeScenario.linkedCheck}</p>
          </article>
          <article className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">核心风险总览</p>
            <div className="mt-3 space-y-2">
              {riskView.coreRisks.map((risk, index) => (
                <div key={`${index}-${risk}`} className={`rounded-xl border px-3.5 py-3 text-sm leading-7 ${risk === activeScenario.linkedRisk ? "border-rose-400/18 bg-rose-400/[0.08] text-slate-100" : "border-white/6 bg-white/[0.03] text-slate-300"}`}>
                  {risk}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>

      <div className="mt-5 rounded-[28px] border border-amber-400/20 bg-amber-400/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/80">操作纪律</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">先执行当前剧本最关键的一条，再回头检查完整清单。</p>
          </div>
        </div>
        <div className="mt-4 rounded-[22px] border border-amber-300/18 bg-amber-400/[0.08] px-4 py-3.5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/70">当前剧本优先动作</p>
          <p className="mt-2 text-sm leading-7 text-amber-50/95">{activeScenario.linkedCheck}</p>
        </div>
        <div className="mt-4 space-y-2">
          {riskView.disciplineChecks.map((check, index) => (
            <div key={`${index}-${check}`} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${check === activeScenario.linkedCheck ? "border-amber-300/18 bg-amber-400/[0.06] text-slate-100" : "border-white/6 bg-white/[0.03] text-slate-200"}`}>
              <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/10 text-[11px] font-medium text-amber-100">
                {index + 1}
              </div>
              <span className="leading-7">{check}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function buildRiskViewModel(
  strategy: RecommendationInput["strategy"],
  recommendation?: Recommendation | LongCallRecommendation | SyntheticLongRecommendation,
): RiskViewModel | null {
  if (!recommendation || ("strategy" in recommendation && recommendation.strategy !== strategy)) {
    return null;
  }

  const fallback = getDefaultRiskView(strategy);
  const summary = recommendation.summary || fallback.summary;
  const coreRisks = takeUniqueStrings(recommendation.risks, 3, fallback.coreRisks);
  const scenarioReminders = fallback.scenarioReminders;
  const disciplineChecks = fallback.disciplineChecks;

  return {
    summary,
    coreRisks,
    scenarioReminders,
    disciplineChecks,
    scenarioCards: buildRiskScenarioCards(strategy, scenarioReminders, coreRisks, disciplineChecks),
  };
}

function getDefaultRiskView(strategy: RecommendationInput["strategy"]): RiskViewModel {
  if (strategy === "covered-call") {
    const riskView = {
      summary: "备兑看涨最容易让人心态崩的，不是 BTC 小跌小涨，而是它突然狠狠干上去。你账上确实收到了权利金，但真正最香的那一段上涨，被你提前签字让出去了，到时候很容易一边赚钱一边难受。",
      coreRisks: [
        "最大的代价不是亏到没边，而是涨得越猛，你越会发现自己明显跑输什么都不做、直接拿着币的人。",
        "越靠近到期、越靠近执行价，仓位就越不安静。前几天你可能觉得这是轻松收租，最后两天却会变成频繁盯盘、随时想处理。",
        "如果这张合约盘口本来就薄，你看到的价格未必真能成交。等你想买回来或者滚到下一期时，价差和滑点会把你收的租金吃掉一块。",
      ],
      scenarioReminders: [
        { title: "强趋势逼空", description: "最烦的是 BTC 连续拉升，而且不是慢慢涨，是几根大阳线直接往执行价脸上怼。这个时候你会很想继续扛，希望它别再涨了，但越犹豫，买回成本通常越高。" },
        { title: "假平静后跳涨", description: "更坑人的情况是前几天特别安静，让你觉得这笔租金像白捡的一样，结果临近到期突然来一脚急拉。表面上你之前都很舒服，真正的压力却集中在最后那一小段时间爆发。" },
        { title: "低流动性滚仓", description: "还有一种亏法不是方向错，而是执行差。你想把旧仓平掉再卖下一期，但盘口太薄，结果旧仓买贵了、新仓又卖便宜了，忙一圈之后发现赚的钱没有想象中多。" },
      ],
      disciplineChecks: [
        "下单前先问自己一句最现实的话：如果 BTC 两天内直接冲到执行价上面，我能不能真心接受“这段涨幅不归我了”？",
        "别只看年化和权利金好不好看，顺手把执行价离现价有多远、还剩几天到期、盘口厚不厚一起看掉，不然很容易被表面收益骗进去。",
        "只要价格开始贴近执行价，就别再拖着不想。提前想好是买回来、滚到下一期，还是干脆接受被行权，不要等最后一天情绪上头再决定。",
        "这种收租仓别一口气压太重，尤其不要把大部分现货都锁在同一个到期日里，不然行情一来你会发现自己几乎没有回旋空间。",
      ],
    } satisfies Omit<RiskViewModel, "scenarioCards">;

    return {
      ...riskView,
      scenarioCards: buildRiskScenarioCards(strategy, riskView.scenarioReminders, riskView.coreRisks, riskView.disciplineChecks),
    };
  }

  if (strategy === "cash-secured-put") {
    const riskView = {
      summary: "现金担保卖看跌说白了就是：你先收一笔钱，答应如果价格跌下来，你就按约定价把币接走。真正难受的点不是没收到租金，而是市场真跌起来时，你会发现自己像是在接一把还在往下掉的刀。",
      coreRisks: [
        "BTC 一旦快速下跌，你虽然收了权利金，但那点收入很快就会被更大的账面亏损盖过去，心理上会很难受。",
        "很多人看到 IV 高、权利金厚就觉得很划算，但市场给这么多钱，通常不是做慈善，而是在提前给大波动定价。",
        "如果你嘴上说自己愿意接货，心里其实只是想收租，那这个策略最容易在暴跌时把你的真实想法逼出来。",
      ],
      scenarioReminders: [
        { title: "下跌加速破位", description: "最典型的坑是价格跌破关键位置以后还在继续放量往下砸。你原本以为是“稍微便宜一点接货”，结果很快变成“接得太早，现在一接就是套”。" },
        { title: "IV 很高但方向不稳", description: "还有一种常见误区，是看到权利金特别厚就手痒。可权利金厚往往说明市场已经在担心后面会有大波动，你拿到的不是白送的钱，而是在替别人扛他们不想扛的风险。" },
        { title: "资金占用过满", description: "如果你同时卖了好几笔 Put，看起来像是在多点收租，实际上是把现金一层层锁死。真等更好的接货位置来了，你反而可能没子弹再补。" },
      ],
      disciplineChecks: [
        "只在你真心愿意买币的价格卖 Put，别为了多收一点租金，把执行价抬到你自己其实都嫌贵的位置。",
        "下单前先把最坏情况想透：真被指派以后，你是愿意继续拿着，还是到时候会因为害怕继续跌而马上砍掉？如果答案是后者，那这单大概率不该做。",
        "看这类仓位时，别只盯一张单能收多少钱，还要顺手看总共占了多少现金，别把全部接货预算一次性锁在同一批到期里。",
        "IV 突然飙起来时，先问自己是不是市场在等一个大事件，而不是看到租金变厚就条件反射觉得“现在更划算”。",
      ],
    } satisfies Omit<RiskViewModel, "scenarioCards">;

    return {
      ...riskView,
      scenarioCards: buildRiskScenarioCards(strategy, riskView.scenarioReminders, riskView.coreRisks, riskView.disciplineChecks),
    };
  }

  if (strategy === "long-call") {
    const riskView = {
      summary: "买长期 Call 听上去很舒服，因为最惨也就是亏掉权利金，但真正折磨人的地方在于：你不光要看对方向，还要看对时间、别买在太贵的时候。三件事里错两件，这张单就会越拿越憋屈。",
      coreRisks: [
        "最大亏损虽然是有限的，但有限不代表少。最坏情况就是这张 Call 最后几乎归零，你交出去的那笔权利金可以完整亏掉。",
        "很多人方向其实看对了，可涨得不够快、不够早，时间价值会一天天往下掉，所以你会遇到“观点没错，账户先亏”的痛苦阶段。",
        "如果你是在 IV 很高的时候买进去，后面哪怕币价没怎么跌，只要市场情绪降温、IV 回落，这张 Call 也可能自己瘦下去。",
      ],
      scenarioReminders: [
        { title: "方向对，时间错", description: "最气人的情况是：你最后真的看对了，BTC 也确实涨了，但涨得太晚。你本来是赌半年行情，结果市场先横几个月，等它真的发力时，你这张票已经被时间磨掉大半。" },
        { title: "高 IV 追涨", description: "如果你是在大家最兴奋、市场最热的时候冲进去买 Call，那你其实是在高价买情绪。后面就算币价没立刻掉，单是 IV 回落，就足够让你的持仓先瘪一圈。" },
        { title: "短线回撤洗掉信心", description: "长期看涨不代表中间不回撤。很常见的路径是先跌一段，把你的浮亏打出来，等你受不了砍掉以后，它才慢慢走回你原来判断的方向。" },
      ],
      disciplineChecks: [
        "先把最坏结果想得特别现实一点：如果这笔权利金最后一分钱都拿不回来，你是不是依然睡得着？如果睡不着，就说明仓位已经大了。",
        "宁可把到期时间拉长一点，也别拿太短的期限去赌一个本来就偏中长期的逻辑，不然你会被时间站在对立面。",
        "下单前别只想着“我看涨”，还要顺手问一句“我是不是买贵了”。方向对和买点对，是两回事。",
        "在开仓前就写好退出条件，比如亏到哪一档减仓、逻辑失效怎么认错，不要等仓位开始痛的时候才临场决定。",
      ],
    } satisfies Omit<RiskViewModel, "scenarioCards">;

    return {
      ...riskView,
      scenarioCards: buildRiskScenarioCards(strategy, riskView.scenarioReminders, riskView.coreRisks, riskView.disciplineChecks),
    };
  }

  const riskView = {
    summary: "合成现货不是“高级版收租”，它更像是把你很强的看涨观点做成一张更猛的组合票。真涨起来它会很爽，但只要先跌，卖 Put 那条腿就会第一时间让你感受到：这不是轻松玩法。",
    coreRisks: [
      "真正会让你疼的，不是买进的 Call，而是卖出去的 Put。BTC 越往下掉，你越会有一种“我像提前接了现货而且还接得不轻”的感觉。",
      "如果账户不是全现金担保，而是靠保证金扛着，那下跌带来的压力就不只是浮亏，还可能变成“保证金越来越紧、仓位越来越难拿”的双重挤压。",
      "这不是一条腿的交易，而是两条腿一起动。开仓、平仓、滚动都得同时看两边的盘口和价差，执行稍微差一点，损耗就会被放大。",
    ],
    scenarioReminders: [
      { title: "先跌后涨", description: "最典型的折磨不是一路走坏，而是你最后其实看对了，BTC 后来真的涨回去了，可前面先来一段急跌，把你的情绪和资金缓冲先打残。很多人不是死在方向，而是死在方向兑现之前。" },
      { title: "波动率塌陷", description: "这类组合看着像接近现货，但它毕竟还是期权组合。行情如果不够强、只是软绵绵地往上蹭，IV 又同时掉下去，结果可能是你以为自己在吃上涨，实际组合表现却没有想象中跟得那么紧。" },
      { title: "保证金环境收紧", description: "如果你不是全担保玩法，最怕的就是价格和保证金环境一起变坏。到那个时候，问题就不只是账面亏多少，而是你还有没有空间继续扛、会不会被迫在最差的位置处理仓位。" },
    ],
    disciplineChecks: [
      "只有在你是真的强看涨，而且也愿意承受类似接现货下跌风险的时候，才考虑这类组合。别把它当成名字高级一点的收租玩法。",
      "开仓前先把现金和保证金缓冲留够，不要把仓位建在边缘，不然市场一颠簸，你会先被风控和情绪打掉。",
      "两条腿的流动性、价差、成交都要一起看，不要只盯着净权利金顺不顺眼。很多时候纸面上好看，真正执行时会打折。",
      "进场前就写好失效条件：如果行情不再强、IV 结构开始变坏、保证金明显吃紧，你准备怎么退，不要等到真的出事才临时反应。",
    ],
  } satisfies Omit<RiskViewModel, "scenarioCards">;

  return {
    ...riskView,
    scenarioCards: buildRiskScenarioCards(strategy, riskView.scenarioReminders, riskView.coreRisks, riskView.disciplineChecks),
  };
}

function recommendationKey(recommendation?: Recommendation | LongCallRecommendation | SyntheticLongRecommendation): string {
  if (!recommendation) {
    return "fallback";
  }

  if ("pair" in recommendation) {
    return `synthetic-long-${recommendation.pair.call.instrumentName}-${recommendation.pair.put.instrumentName}`;
  }

  return `${recommendation.strategy}-${recommendation.contract.instrumentName}`;
}

function buildRiskScenarioCards(
  strategy: RecommendationInput["strategy"],
  scenarioReminders: Array<{ title: string; description: string }>,
  coreRisks: string[],
  disciplineChecks: string[],
): RiskScenarioCard[] {
  return scenarioReminders.map((scenario, index) => ({
    id: `${strategy}-${index}`,
    title: scenario.title,
    description: scenario.description,
    tone: getRiskScenarioTone(strategy, index),
    signalLabel: getRiskScenarioSignalLabel(strategy, index),
    linkedRisk: coreRisks[index] ?? coreRisks[coreRisks.length - 1] ?? "先看仓位最坏路径。",
    linkedCheck: disciplineChecks[index] ?? disciplineChecks[disciplineChecks.length - 1] ?? "先确认自己能承受最坏结果。",
  }));
}

function getRiskScenarioTone(
  strategy: RecommendationInput["strategy"],
  index: number,
): RiskScenarioCard["tone"] {
  if (strategy === "synthetic-long") {
    return index === 0 ? "fuchsia" : index === 1 ? "rose" : "amber";
  }

  if (strategy === "long-call") {
    return index === 0 ? "emerald" : index === 1 ? "amber" : "rose";
  }

  return index === 0 ? "rose" : index === 1 ? "amber" : "cyan";
}

function getRiskScenarioSignalLabel(strategy: RecommendationInput["strategy"], index: number): string {
  if (strategy === "covered-call") {
    return ["最怕逼空", "最怕急拉", "最怕滑点"][index] ?? "重点路径";
  }

  if (strategy === "cash-secured-put") {
    return ["最怕阴跌", "最怕高 IV", "最怕占资"][index] ?? "重点路径";
  }

  if (strategy === "long-call") {
    return ["最怕时间错", "最怕 IV 贵", "最怕回撤洗仓"][index] ?? "重点路径";
  }

  return ["最怕先跌", "最怕 IV 塌", "最怕保证金挤压"][index] ?? "重点路径";
}

function getRiskScenarioToneClasses(tone: RiskScenarioCard["tone"]) {
  if (tone === "fuchsia") {
    return {
      active: "border-fuchsia-400/30 bg-[linear-gradient(135deg,rgba(217,70,239,0.18),rgba(217,70,239,0.06))] text-white shadow-[0_6px_20px_-6px_rgba(217,70,239,0.35)]",
      subtitle: "text-fuchsia-200/75",
      badge: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100",
    };
  }

  if (tone === "emerald") {
    return {
      active: "border-emerald-400/30 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(16,185,129,0.06))] text-white shadow-[0_6px_20px_-6px_rgba(16,185,129,0.35)]",
      subtitle: "text-emerald-200/75",
      badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    };
  }

  if (tone === "rose") {
    return {
      active: "border-rose-400/30 bg-[linear-gradient(135deg,rgba(251,113,133,0.18),rgba(251,113,133,0.06))] text-white shadow-[0_6px_20px_-6px_rgba(251,113,133,0.35)]",
      subtitle: "text-rose-200/75",
      badge: "border-rose-400/20 bg-rose-400/10 text-rose-100",
    };
  }

  if (tone === "amber") {
    return {
      active: "border-amber-400/30 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(251,191,36,0.06))] text-white shadow-[0_6px_20px_-6px_rgba(251,191,36,0.35)]",
      subtitle: "text-amber-200/75",
      badge: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    };
  }

  return {
    active: "border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,211,238,0.06))] text-white shadow-[0_6px_20px_-6px_rgba(34,211,238,0.35)]",
    subtitle: "text-cyan-200/75",
    badge: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
  };
}

function takeUniqueStrings(items: string[] | undefined, limit: number, fallback: string[]): string[] {
  const merged = [...(items ?? []), ...fallback].map((item) => item.trim()).filter(Boolean);
  return Array.from(new Set(merged)).slice(0, limit);
}

