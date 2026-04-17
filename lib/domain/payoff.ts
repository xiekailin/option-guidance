import { roundTo } from "./calculations";
import type { PayoffCurve, PayoffLeg, PayoffPoint } from "../types/option";

const DEFAULT_STEP_COUNT = 80;

export function calculatePayoffCurve(
  legs: PayoffLeg[],
  underlyingPrice: number,
  stepCount: number = DEFAULT_STEP_COUNT,
): PayoffCurve {
  const priceRange = underlyingPrice * 0.4;
  const minPrice = roundTo(underlyingPrice - priceRange, 0);
  const maxPrice = roundTo(underlyingPrice + priceRange, 0);
  const step = (maxPrice - minPrice) / stepCount;

  const points: PayoffPoint[] = [];
  let maxProfit = -Infinity;
  let maxLoss = Infinity;

  for (let i = 0; i <= stepCount; i++) {
    const priceAtExpiry = roundTo(minPrice + step * i, 0);
    let totalPnl = 0;

    for (const leg of legs) {
      const legPnl = calculateLegPayoff(leg, priceAtExpiry);
      totalPnl += legPnl;
    }

    if (totalPnl > maxProfit) maxProfit = totalPnl;
    if (totalPnl < maxLoss) maxLoss = totalPnl;

    points.push({ priceAtExpiry, pnl: roundTo(totalPnl, 2) });
  }

  const breakEvenPrice = findBreakEven(points);

  return {
    points,
    maxProfit: roundTo(maxProfit, 2),
    maxLoss: roundTo(maxLoss, 2),
    breakEvenPrice,
  };
}

function calculateLegPayoff(leg: PayoffLeg, priceAtExpiry: number): number {
  const { direction, optionType, strike, premium, contractSize } = leg;
  const premiumUsd = premium * contractSize;
  const sign = direction === "long" ? 1 : -1;

  let intrinsicValue = 0;
  if (optionType === "call" && priceAtExpiry > strike) {
    intrinsicValue = priceAtExpiry - strike;
  } else if (optionType === "put" && priceAtExpiry < strike) {
    intrinsicValue = strike - priceAtExpiry;
  }

  return sign * (intrinsicValue * contractSize) - sign * premiumUsd;
}

function findBreakEven(points: PayoffPoint[]): number | null {
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].pnl;
    const curr = points[i].pnl;
    if ((prev <= 0 && curr >= 0) || (prev >= 0 && curr <= 0)) {
      const fraction = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr) || 1);
      return roundTo(points[i - 1].priceAtExpiry + fraction * (points[i].priceAtExpiry - points[i - 1].priceAtExpiry), 0);
    }
  }

  return null;
}

export function buildPayoffLegsForStrategy(
  strategy: "covered-call" | "cash-secured-put" | "synthetic-long" | "long-call",
  strike: number,
  premiumPerBtc: number,
  underlyingPrice: number,
  putStrike?: number,
  putPremiumPerBtc?: number,
  contractSize: number = 0.1,
): PayoffLeg[] {
  if (strategy === "covered-call") {
    return [
      { direction: "long", optionType: "call", strike: underlyingPrice, premium: 0, contractSize },
      { direction: "short", optionType: "call", strike, premium: premiumPerBtc, contractSize },
    ];
  }

  if (strategy === "cash-secured-put") {
    return [
      { direction: "short", optionType: "put", strike, premium: premiumPerBtc, contractSize },
    ];
  }

  if (strategy === "long-call") {
    return [
      { direction: "long", optionType: "call", strike, premium: premiumPerBtc, contractSize },
    ];
  }

  // synthetic-long
  return [
    { direction: "long", optionType: "call", strike, premium: premiumPerBtc, contractSize },
    { direction: "short", optionType: "put", strike: putStrike ?? strike, premium: putPremiumPerBtc ?? premiumPerBtc, contractSize },
  ];
}
