import type {
  CyclePreference,
  OptionContract,
  RecommendationInput,
  RiskTolerance,
} from "../types/option";

const DAYS_IN_YEAR = 365;
const MIN_CONTRACT_SIZE_BTC = 0.1;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function getMinContractSizeBtc(): number {
  return MIN_CONTRACT_SIZE_BTC;
}

export function calculateAnnualizedYield(markPrice: number | null, daysToExpiry: number): number | null {
  if (!markPrice || daysToExpiry <= 0) {
    return null;
  }

  return roundTo((markPrice / (daysToExpiry / DAYS_IN_YEAR)) * 100, 2);
}

export function calculatePremiumReturnPercent(markPrice: number | null): number | null {
  if (!markPrice) {
    return null;
  }

  return roundTo(markPrice * 100, 2);
}

export function calculatePremiumUsdPerBtc(markPrice: number | null, underlyingPrice: number | null): number | null {
  if (!markPrice || !underlyingPrice) {
    return null;
  }

  return roundTo(markPrice * underlyingPrice, 2);
}

export function calculateOtmPercent(
  optionType: OptionContract["optionType"],
  strike: number,
  underlyingPrice: number | null,
): number | null {
  if (!underlyingPrice || underlyingPrice <= 0) {
    return null;
  }

  const raw = optionType === "call"
    ? ((strike - underlyingPrice) / underlyingPrice) * 100
    : ((underlyingPrice - strike) / underlyingPrice) * 100;

  return roundTo(raw, 2);
}

export function getCycleDayRange(cycle: CyclePreference): { min: number; max: number } {
  return cycle === "weekly" ? { min: 5, max: 12 } : { min: 18, max: 45 };
}

export function getTargetDeltaRange(riskTolerance: RiskTolerance): { min: number; max: number; target: number } {
  switch (riskTolerance) {
    case "conservative":
      return { min: 0.1, max: 0.18, target: 0.14 };
    case "aggressive":
      return { min: 0.22, max: 0.35, target: 0.28 };
    case "balanced":
    default:
      return { min: 0.15, max: 0.25, target: 0.2 };
  }
}

export function countCoveredCallLots(availableBtc: number): number {
  if (availableBtc < MIN_CONTRACT_SIZE_BTC) {
    return 0;
  }

  return Math.floor(availableBtc / MIN_CONTRACT_SIZE_BTC);
}

export function countCashSecuredPutLots(availableCashUsd: number, strike: number): number {
  if (availableCashUsd <= 0 || strike <= 0) {
    return 0;
  }

  const costPerContract = strike * MIN_CONTRACT_SIZE_BTC;
  return Math.floor(availableCashUsd / costPerContract);
}

export function getMaxLotsForInput(
  input: RecommendationInput,
  option: Pick<OptionContract, "strike">,
): number {
  return input.strategy === "covered-call"
    ? countCoveredCallLots(input.availableBtc)
    : countCashSecuredPutLots(input.availableCashUsd, option.strike);
}

export function validateRecommendationInput(input: RecommendationInput): string[] {
  const errors: string[] = [];

  if (input.availableCashUsd < 0) {
    errors.push("可用现金不能小于 0。");
  }

  if (input.strategy === "synthetic-long") {
    return errors;
  }

  if (input.availableBtc < 0) {
    errors.push("可用 BTC 不能小于 0。");
  }

  if (input.minPremiumPercent < 0) {
    errors.push("最低单期权利金不能小于 0%。");
  }

  return errors;
}

export function formatRelativeCycle(daysToExpiry: number): string {
  if (daysToExpiry <= 8) {
    return "周度";
  }

  if (daysToExpiry <= 45) {
    return "月度";
  }

  return "远期";
}

export function calculateDeltaFitScore(absDelta: number, target: number, min: number, max: number): number {
  if (absDelta < min || absDelta > max) {
    return 0;
  }

  const distance = Math.abs(absDelta - target);
  const maxDistance = Math.max(target - min, max - target) || 0.01;
  return clamp(1 - distance / maxDistance, 0, 1);
}

export function calculateCycleFitScore(daysToExpiry: number, cycle: CyclePreference): number {
  const { min, max } = getCycleDayRange(cycle);
  if (daysToExpiry < min || daysToExpiry > max) {
    return 0;
  }

  const midpoint = (min + max) / 2;
  const halfSpan = (max - min) / 2 || 1;
  return clamp(1 - Math.abs(daysToExpiry - midpoint) / halfSpan, 0, 1);
}
