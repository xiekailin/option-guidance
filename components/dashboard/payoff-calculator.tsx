"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { calculatePayoffCurve, buildPayoffLegsForStrategy } from "@/lib/domain/payoff";
import type { OptionContract, PayoffCurve, PayoffPoint, StrategyType } from "@/lib/types/option";

interface PayoffCalculatorProps {
  selectedContract: OptionContract | null;
  syntheticPut?: OptionContract | null;
  underlyingPrice: number | undefined;
  strategy: StrategyType;
  availableBtc: number;
  availableCashUsd: number;
}

export function PayoffCalculator({
  selectedContract,
  syntheticPut,
  underlyingPrice,
  strategy,
}: PayoffCalculatorProps) {
  const [manualMode, setManualMode] = useState(false);
  const [manualOptionType, setManualOptionType] = useState<"call" | "put">("call");
  const [manualDirection, setManualDirection] = useState<"long" | "short">("short");
  const [manualStrike, setManualStrike] = useState(76000);
  const [manualPremium, setManualPremium] = useState(0.005);
  const [manualUnderlying, setManualUnderlying] = useState(73000);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  const effectiveManualOptionType = strategy === "long-call"
    ? "call"
    : strategy === "cash-secured-put"
      ? "put"
      : manualOptionType;
  const effectiveManualDirection = strategy === "long-call" || strategy === "synthetic-long"
    ? "long"
    : manualDirection;

  const price = underlyingPrice ?? manualUnderlying;
  const payoffProfile = getPayoffProfile(strategy, manualMode, effectiveManualDirection, effectiveManualOptionType);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const syncPointerMode = () => setIsCoarsePointer(mediaQuery.matches);

    syncPointerMode();
    mediaQuery.addEventListener("change", syncPointerMode);
    return () => mediaQuery.removeEventListener("change", syncPointerMode);
  }, []);

  const legs = useMemo(() => {
    if (manualMode) {
      return [
        {
          direction: effectiveManualDirection,
          optionType: effectiveManualOptionType,
          strike: manualStrike,
          premium: manualPremium,
          contractSize: 0.1,
        },
      ];
    }

    if (!selectedContract || !underlyingPrice) {
      return null;
    }

    const premium = selectedContract.markPrice ?? selectedContract.midPrice ?? 0;
    const putPremium = syntheticPut?.markPrice ?? syntheticPut?.midPrice ?? undefined;

    return buildPayoffLegsForStrategy(
      strategy,
      selectedContract.strike,
      premium,
      underlyingPrice,
      syntheticPut?.strike,
      putPremium,
    );
  }, [effectiveManualDirection, manualMode, effectiveManualOptionType, manualPremium, manualStrike, selectedContract, strategy, syntheticPut, underlyingPrice]);

  const curve: PayoffCurve | null = useMemo(() => {
    if (!legs) {
      return null;
    }

    return calculatePayoffCurve(legs, price);
  }, [legs, price]);

  const defaultActiveIndex = useMemo(() => {
    if (!curve) {
      return 0;
    }

    return findNearestPointIndex(curve.points, price);
  }, [curve, price]);

  const resolvedActiveIndex = curve
    ? activeIndex == null
      ? defaultActiveIndex
      : Math.min(activeIndex, Math.max(curve.points.length - 1, 0))
    : 0;

  const activePoint = curve?.points[resolvedActiveIndex] ?? null;

  return (
    <section id="calculator" className="scroll-mt-32 sm:scroll-mt-24">
      <div className="panel-surface rounded-[32px] p-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="size-5 text-cyan-300" />
          <div>
            <h2 className="text-xl font-semibold text-white">到期损益计算器</h2>
            <p className="mt-1 text-xs text-slate-400">输入合约参数，看到期时 BTC 在不同价格下你能赚多少或亏多少</p>
          </div>
        </div>

        <div className="mt-5 metric-tile rounded-[24px] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-200">合约来源</p>
            <button
              type="button"
              onClick={() => setManualMode(!manualMode)}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
            >
              {manualMode ? "自动填充" : "手动输入"}
            </button>
          </div>

          {manualMode ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {strategy === "long-call" ? (
                <StaticField label="策略结构" value="只看 long call" hint="佩洛西打法下，手动模式固定为买入看涨期权。" />
              ) : (
                <SelectField
                  label="方向"
                  value={effectiveManualDirection}
                  onChange={(value) => setManualDirection(value as "long" | "short")}
                  options={[
                    { value: "long", label: "买入（Long）" },
                    { value: "short", label: "卖出（Short）" },
                  ]}
                />
              )}
              <SelectField
                label="期权类型"
                value={effectiveManualOptionType}
                onChange={(value) => setManualOptionType(value as "call" | "put")}
                options={
                  strategy === "long-call"
                    ? [{ value: "call", label: "看涨（Call）" }]
                    : [
                        { value: "call", label: "看涨（Call）" },
                        { value: "put", label: "看跌（Put）" },
                      ]
                }
              />
              <NumberField label="执行价 ($)" value={manualStrike} step="1000" onChange={setManualStrike} />
              <NumberField label="权利金 (BTC)" value={manualPremium} step="0.001" onChange={setManualPremium} />
              <NumberField label="BTC 现价 ($)" value={manualUnderlying} step="100" onChange={setManualUnderlying} />
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-300">
              {selectedContract ? (
                <p>
                  当前选中：<span className="font-medium text-white">{selectedContract.instrumentName}</span>
                  ，权利金 {selectedContract.premiumReturnPercent}% ，执行价 ${selectedContract.strike.toLocaleString()}
                  {syntheticPut ? ` / 卖 ${syntheticPut.instrumentName}` : ""}
                </p>
              ) : (
                <p className="text-slate-400">从推荐列表点选一张合约，自动填充参数。或切换到“手动输入”。</p>
              )}
            </div>
          )}
        </div>

        {curve && curve.points.length > 0 && activePoint ? (
          <div className="mt-5">
            <div className="metric-tile rounded-[28px] p-4">
              <PayoffSvg
                curve={curve}
                underlyingPrice={price}
                activeIndex={resolvedActiveIndex}
                defaultIndex={defaultActiveIndex}
                isInspecting={isInspecting}
                isCoarsePointer={isCoarsePointer}
                onActiveIndexChange={setActiveIndex}
                onInspectingChange={setIsInspecting}
              />
            </div>

            <ActivePointSummary
              point={activePoint}
              underlyingPrice={price}
              breakEvenPrice={curve.breakEvenPrice}
              isInspecting={isInspecting}
              isCoarsePointer={isCoarsePointer}
              onReset={() => {
                setActiveIndex(null);
                setIsInspecting(false);
              }}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MetricCard
                icon={<TrendingUp className="size-4 text-emerald-400" />}
                label="最大盈利"
                value={payoffProfile.upsideUnlimited ? "理论上无限" : `$${curve.maxProfit.toLocaleString()}`}
                hint={payoffProfile.upsideUnlimited ? payoffProfile.upsideHint : "到期时能赚到的最多钱（每张 0.1 BTC）"}
              />
              <MetricCard
                icon={<TrendingDown className="size-4 text-rose-400" />}
                label="最大亏损"
                value={payoffProfile.downsideUnlimited ? "理论上无限" : `$${Math.abs(curve.maxLoss).toLocaleString()}`}
                hint={payoffProfile.downsideUnlimited ? payoffProfile.downsideHint : "到期时最多亏的钱（每张 0.1 BTC）"}
              />
              <MetricCard
                label="盈亏平衡价"
                value={curve.breakEvenPrice != null ? `$${curve.breakEvenPrice.toLocaleString()}` : "--"}
                hint={curve.breakEvenPrice != null ? "到期时 BTC 在这个价格附近，你大致不赚不亏" : "找不到明确的盈亏平衡点"}
              />
            </div>

            <div className="mt-4 rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-50/95">
              <p className="font-medium text-amber-200">怎么看这张图</p>
              <ul className="mt-2 space-y-1">
                <li>- <span className="text-emerald-300">绿色区域</span>是你赚钱的部分，<span className="text-rose-300">红色区域</span>是你亏钱的部分。</li>
                <li>- 现在支持交互查看：桌面端可悬停或拖动，移动端可点击或横向滑动。</li>
                <li>- 横线是“不赚不亏”的分界线，交点就是盈亏平衡价。</li>
                <li>- 这只是到期时的理论损益，不考虑中间波动、IV 变化和手续费。</li>
                <li>- 每张合约 = 0.1 BTC，如果你做多张，收益和亏损按倍数放大。</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
            等待合约数据加载...
          </div>
        )}
      </div>
    </section>
  );
}

function getPayoffProfile(
  strategy: StrategyType,
  manualMode: boolean,
  effectiveManualDirection: "long" | "short",
  effectiveManualOptionType: "call" | "put",
) {
  if (!manualMode) {
    if (strategy === "synthetic-long") {
      return {
        upsideUnlimited: true,
        downsideUnlimited: false,
        upsideHint: "BTC 涨得越多，买的看涨腿赚得越多",
        downsideHint: "",
      };
    }

    if (strategy === "long-call") {
      return {
        upsideUnlimited: true,
        downsideUnlimited: false,
        upsideHint: "BTC 涨得越多，这张 Call 的理论收益上限越高",
        downsideHint: "",
      };
    }

    return {
      upsideUnlimited: false,
      downsideUnlimited: false,
      upsideHint: "",
      downsideHint: "",
    };
  }

  const upsideUnlimited =
    (effectiveManualDirection === "long" && effectiveManualOptionType === "call") ||
    (effectiveManualDirection === "short" && effectiveManualOptionType === "put");
  const downsideUnlimited =
    (effectiveManualDirection === "short" && effectiveManualOptionType === "call") ||
    (effectiveManualDirection === "short" && effectiveManualOptionType === "put");

  return {
    upsideUnlimited,
    downsideUnlimited,
    upsideHint: upsideUnlimited ? "价格继续朝有利方向走，收益理论上没有固定上限" : "",
    downsideHint: downsideUnlimited ? "价格继续朝不利方向走，亏损理论上没有固定下限" : "",
  };
}

interface PayoffSvgProps {
  curve: PayoffCurve;
  underlyingPrice: number;
  activeIndex: number;
  defaultIndex: number;
  isInspecting: boolean;
  isCoarsePointer: boolean;
  onActiveIndexChange: (index: number) => void;
  onInspectingChange: (value: boolean) => void;
}

function PayoffSvg({
  curve,
  underlyingPrice,
  activeIndex,
  defaultIndex,
  isInspecting,
  isCoarsePointer,
  onActiveIndexChange,
  onInspectingChange,
}: PayoffSvgProps) {
  const { points } = curve;
  const width = 700;
  const height = isCoarsePointer ? 380 : 280;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const gradientIdBase = useId().replace(/:/g, "");
  const descriptionId = `${gradientIdBase}-description`;
  const frameRef = useRef<number | null>(null);
  const queuedIndexRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const prices = points.map((p) => p.priceAtExpiry);
  const pnls = points.map((p) => p.pnl);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minPnl = Math.min(...pnls, 0);
  const maxPnl = Math.max(...pnls, 0);
  const pnlRange = maxPnl - minPnl || 1;

  const toX = (priceAtExpiry: number) => padding.left + ((priceAtExpiry - minPrice) / (maxPrice - minPrice || 1)) * plotWidth;
  const toY = (pnl: number) => padding.top + ((maxPnl - pnl) / pnlRange) * plotHeight;
  const zeroY = toY(0);
  const activePoint = points[Math.min(activeIndex, points.length - 1)] ?? points[defaultIndex] ?? points[0];
  const activeX = toX(activePoint.priceAtExpiry);
  const activeY = toY(activePoint.pnl);
  const showActiveOverlay = isInspecting;
  const showFloatingTooltip = showActiveOverlay && !isCoarsePointer;
  const activePriceChangePercent = underlyingPrice > 0
    ? ((activePoint.priceAtExpiry - underlyingPrice) / underlyingPrice) * 100
    : null;
  const sliderValueText = `到期价格 ${formatCompactUsd(activePoint.priceAtExpiry)}，理论盈亏 ${formatSignedCompactUsd(activePoint.pnl)}${activePriceChangePercent == null ? "" : `，相对现价 ${formatSignedPercent(activePriceChangePercent)}`}`;

  const resetInspection = () => {
    draggingRef.current = false;
    onInspectingChange(false);
    onActiveIndexChange(defaultIndex);
  };

  const releaseDrag = () => {
    draggingRef.current = false;
  };

  useEffect(() => () => {
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current);
    }
  }, []);

  const areaPath =
    points.map((point, index) => `${index === 0 ? "M" : "L"}${toX(point.priceAtExpiry)},${toY(point.pnl)}`).join(" ") +
    ` L${toX(points[points.length - 1].priceAtExpiry)},${zeroY} L${toX(points[0].priceAtExpiry)},${zeroY} Z`;

  const queueIndexUpdate = (nextIndex: number) => {
    queuedIndexRef.current = nextIndex;
    if (frameRef.current != null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const resolvedIndex = queuedIndexRef.current;
      queuedIndexRef.current = null;
      if (resolvedIndex == null || resolvedIndex === activeIndex) {
        return;
      }
      onActiveIndexChange(resolvedIndex);
    });
  };

  const getIndexFromClientX = (clientX: number, rect: DOMRect) => {
    const relativeX = clamp(clientX - rect.left, 0, rect.width);
    const ratio = rect.width === 0 ? 0 : relativeX / rect.width;
    return clamp(Math.round(ratio * (points.length - 1)), 0, points.length - 1);
  };

  const updateFromPointer = (event: ReactPointerEvent<SVGRectElement>) => {
    updateFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
  };

  const updateFromTouch = (event: ReactTouchEvent<SVGRectElement>) => {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (!touch) {
      return;
    }
    updateFromClientX(touch.clientX, event.currentTarget.getBoundingClientRect());
  };

  const updateFromClientX = (clientX: number, rect: DOMRect) => {
    const nextIndex = getIndexFromClientX(clientX, rect);
    queueIndexUpdate(nextIndex);
  };

  const handlePointerEnter = (event: ReactPointerEvent<SVGRectElement>) => {
    if (event.pointerType !== "mouse") {
      return;
    }
    onInspectingChange(true);
    updateFromPointer(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    if (event.pointerType !== "mouse" && !draggingRef.current) {
      return;
    }
    onInspectingChange(true);
    updateFromPointer(event);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onInspectingChange(true);
    updateFromPointer(event);
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGRectElement>) => {
    releaseDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (event.pointerType === "mouse") {
      return;
    }
    onInspectingChange(true);
    updateFromPointer(event);
  };

  const handlePointerLeave = (event: ReactPointerEvent<SVGRectElement>) => {
    if (event.pointerType !== "mouse" || draggingRef.current) {
      return;
    }
    resetInspection();
  };

  const handleLostPointerCapture = () => {
    releaseDrag();
  };

  const handlePointerCancel = () => {
    releaseDrag();
    onInspectingChange(true);
  };

  const handleTouchStart = (event: ReactTouchEvent<SVGRectElement>) => {
    if (!isCoarsePointer) {
      return;
    }
    draggingRef.current = true;
    onInspectingChange(true);
    updateFromTouch(event);
  };

  const handleTouchMove = (event: ReactTouchEvent<SVGRectElement>) => {
    if (!isCoarsePointer) {
      return;
    }
    event.preventDefault();
    onInspectingChange(true);
    updateFromTouch(event);
  };

  const handleTouchEnd = (event: ReactTouchEvent<SVGRectElement>) => {
    if (!isCoarsePointer) {
      return;
    }
    releaseDrag();
    onInspectingChange(true);
    updateFromTouch(event);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onInspectingChange(true);
      onActiveIndexChange(Math.min(activeIndex + 1, points.length - 1));
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onInspectingChange(true);
      onActiveIndexChange(Math.max(activeIndex - 1, 0));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onInspectingChange(true);
      onActiveIndexChange(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onInspectingChange(true);
      onActiveIndexChange(points.length - 1);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onInspectingChange(false);
      onActiveIndexChange(defaultIndex);
    }
  };

  const tooltipWidth = 176;
  const tooltipHeight = 78;
  const tooltipLeft = clamp(activeX - tooltipWidth / 2, padding.left, width - padding.right - tooltipWidth);
  const tooltipTop = activeY <= padding.top + tooltipHeight ? activeY + 16 : activeY - tooltipHeight - 14;

  return (
    <div
      role="slider"
      tabIndex={0}
      onFocus={() => {
        onInspectingChange(true);
      }}
      onBlur={() => {
        resetInspection();
      }}
      onKeyDown={handleKeyDown}
      aria-label="到期损益图探索器"
      aria-describedby={descriptionId}
      aria-orientation="horizontal"
      aria-valuemin={minPrice}
      aria-valuemax={maxPrice}
      aria-valuenow={activePoint.priceAtExpiry}
      aria-valuetext={sliderValueText}
      className="relative rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
      style={{ touchAction: isCoarsePointer ? "none" : undefined }}
    >
      <span id={descriptionId} className="sr-only">
        可用左右方向键切换不同到期价格点，查看对应理论盈亏。
      </span>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`${gradientIdBase}-profit-gradient`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id={`${gradientIdBase}-loss-gradient`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgb(251 113 133)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(251 113 133)" stopOpacity="0.05" />
          </linearGradient>
          <clipPath id={`${gradientIdBase}-loss-clip`}>
            <rect x="0" y={zeroY} width={width} height={height - zeroY} />
          </clipPath>
        </defs>

        <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="rgb(148 163 184)" strokeWidth="1" strokeDasharray="4 4" />
        <path d={areaPath} fill={`url(#${gradientIdBase}-profit-gradient)`} />
        <path d={areaPath} fill={`url(#${gradientIdBase}-loss-gradient)`} clipPath={`url(#${gradientIdBase}-loss-clip)`} />

        <polyline
          points={points.map((point) => `${toX(point.priceAtExpiry)},${toY(point.pnl)}`).join(" ")}
          fill="none"
          stroke="rgb(148 163 184)"
          strokeWidth="2"
        />

        {underlyingPrice >= minPrice && underlyingPrice <= maxPrice ? (
          <g>
            <line x1={toX(underlyingPrice)} y1={padding.top} x2={toX(underlyingPrice)} y2={height - padding.bottom} stroke="rgb(6 182 212)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={toX(underlyingPrice)} y={height - padding.bottom + 16} textAnchor="middle" fill="rgb(103 232 249)" fontSize="11" fontFamily="sans-serif">
              现价 ${underlyingPrice.toLocaleString()}
            </text>
          </g>
        ) : null}

        {curve.breakEvenPrice != null && curve.breakEvenPrice >= minPrice && curve.breakEvenPrice <= maxPrice ? (
          <g>
            <circle cx={toX(curve.breakEvenPrice)} cy={zeroY} r="4" fill="rgb(250 204 21)" />
            <text x={toX(curve.breakEvenPrice)} y={zeroY - 10} textAnchor="middle" fill="rgb(250 204 21)" fontSize="10" fontFamily="sans-serif">
              盈亏平衡 ${curve.breakEvenPrice.toLocaleString()}
            </text>
          </g>
        ) : null}

        {showActiveOverlay ? (
          <g>
            <line x1={activeX} y1={padding.top} x2={activeX} y2={height - padding.bottom} stroke="rgb(34 211 238)" strokeWidth="1" strokeDasharray="4 4" opacity="0.9" />
            <line x1={padding.left} y1={activeY} x2={width - padding.right} y2={activeY} stroke="rgb(148 163 184)" strokeWidth="1" strokeDasharray="4 4" opacity="0.55" />
            <circle cx={activeX} cy={activeY} r="5.5" fill="rgb(8 16 28)" stroke="rgb(34 211 238)" strokeWidth="2" />
          </g>
        ) : null}

        <rect
          x={padding.left}
          y={padding.top}
          width={plotWidth}
          height={plotHeight}
          fill="rgba(8,16,28,0.001)"
          pointerEvents="all"
          onPointerEnter={handlePointerEnter}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={handleLostPointerCapture}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        <text x={toX(minPrice)} y={height - 8} textAnchor="middle" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
          ${Math.round(minPrice).toLocaleString()}
        </text>
        <text x={toX(maxPrice)} y={height - 8} textAnchor="middle" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
          ${Math.round(maxPrice).toLocaleString()}
        </text>

        <text x={padding.left - 8} y={toY(maxPnl) + 4} textAnchor="end" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
          +${Math.round(maxPnl).toLocaleString()}
        </text>
        <text x={padding.left - 8} y={zeroY + 4} textAnchor="end" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
          0
        </text>
        <text x={padding.left - 8} y={toY(minPnl) + 4} textAnchor="end" fill="rgb(148 163 184)" fontSize="10" fontFamily="sans-serif">
          {Math.round(minPnl).toLocaleString()}
        </text>
      </svg>

      {showFloatingTooltip ? (
        <div
          className="pointer-events-none absolute z-10 w-44 rounded-[16px] border border-cyan-400/18 bg-[#07111d]/92 p-3 shadow-[0_12px_28px_-16px_rgba(2,6,23,0.88)] backdrop-blur-sm"
          style={{
            left: `${(tooltipLeft / width) * 100}%`,
            top: `${(tooltipTop / height) * 100}%`,
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">当前到期价</p>
          <p className="mt-1 text-sm font-semibold text-white">{formatCompactUsd(activePoint.priceAtExpiry)}</p>
          <div className="mt-2 grid gap-2">
            <div>
              <p className="text-[11px] text-slate-500">理论盈亏</p>
              <p className={`text-sm font-medium ${activePoint.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {formatSignedCompactUsd(activePoint.pnl)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">相对现价</p>
              <p className="text-sm text-slate-200">{activePriceChangePercent == null ? "--" : formatSignedPercent(activePriceChangePercent)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActivePointSummary({
  point,
  underlyingPrice,
  breakEvenPrice,
  isInspecting,
  isCoarsePointer,
  onReset,
}: {
  point: PayoffPoint;
  underlyingPrice: number;
  breakEvenPrice: number | null;
  isInspecting: boolean;
  isCoarsePointer: boolean;
  onReset: () => void;
}) {
  const priceChangePercent = underlyingPrice > 0 ? ((point.priceAtExpiry - underlyingPrice) / underlyingPrice) * 100 : null;
  const breakEvenDelta = breakEvenPrice == null ? null : point.priceAtExpiry - breakEvenPrice;

  return (
    <div className="mt-4 rounded-[24px] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(8,18,30,0.9),rgba(6,13,24,0.84))] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-100">当前探索点</p>
          <p className="mt-1 text-xs leading-6 text-slate-400">
            {isInspecting
              ? isCoarsePointer
                ? "已锁定图上当前点，横向拖动可连续查看不同到期价格；点右侧按钮可回到现价。"
                : "鼠标继续横向移动，就能丝滑查看每个价格点的盈亏变化。"
              : "默认落在最接近现价的位置；聚焦或悬停后会实时联动更新。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCoarsePointer ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium tracking-[0.08em] text-slate-200 transition hover:border-cyan-400/35 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
            >
              回到现价
            </button>
          ) : null}
          <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] ${point.pnl >= 0 ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200"}`}>
            {point.pnl >= 0 ? "盈利区" : "亏损区"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ActivePointMetric label="到期价格" value={formatCompactUsd(point.priceAtExpiry)} hint="这是假设 BTC 到期时落在这个价格。" />
        <ActivePointMetric label="理论盈亏" value={formatSignedCompactUsd(point.pnl)} hint="按每张 0.1 BTC 的到期理论结果估算。" tone={point.pnl >= 0 ? "profit" : "loss"} />
        <ActivePointMetric label="相对现价" value={priceChangePercent == null ? "--" : formatSignedPercent(priceChangePercent)} hint="相对当前现价的涨跌幅。" />
        <ActivePointMetric label="相对盈亏平衡" value={breakEvenDelta == null ? "--" : formatSignedCompactUsd(breakEvenDelta)} hint={breakEvenPrice == null ? "当前曲线没有明确盈亏平衡点。" : `相对盈亏平衡价 ${formatCompactUsd(breakEvenPrice)} 的差值。`} />
      </div>
    </div>
  );
}

function ActivePointMetric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "profit" | "loss";
}) {
  return (
    <div className="metric-tile rounded-[20px] p-3.5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold tabular-nums ${tone === "profit" ? "text-emerald-300" : tone === "loss" ? "text-rose-300" : "text-white"}`}>
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

function MetricCard({ icon, label, value, hint }: { icon?: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="metric-tile rounded-[24px] p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

function StaticField({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <div className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white">{value}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
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

function NumberField({ label, value, step, onChange, min = 0 }: { label: string; value: number; step: string; onChange: (v: number) => void; min?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value);
          onChange(Number.isFinite(next) ? Math.max(next, min) : min);
        }}
        className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
      />
    </label>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function findNearestPointIndex(points: PayoffPoint[], targetPrice: number) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  points.forEach((point, index) => {
    const distance = Math.abs(point.priceAtExpiry - targetPrice);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function formatCompactUsd(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatSignedCompactUsd(value: number) {
  const absValue = Math.abs(value);
  return `${value >= 0 ? "+" : "-"}$${Math.round(absValue).toLocaleString()}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
