import {
  calculateAnnualizedYield,
  calculateOtmPercent,
  calculatePremiumReturnPercent,
  calculatePremiumUsdPerBtc,
  roundTo,
} from "../domain/calculations";
import type { OptionContract } from "../types/option";

const DERIBIT_API_BASE = "https://www.deribit.com/api/v2/public";

export class DeribitApiError extends Error {
  constructor(
    public readonly code: "UPSTREAM_TIMEOUT" | "UPSTREAM_BAD_STATUS" | "UPSTREAM_INVALID_PAYLOAD",
    message: string,
  ) {
    super(message);
    this.name = "DeribitApiError";
  }
}

interface DeribitResult<T> {
  result: T;
}

interface DeribitTickerResult {
  index_price: number;
}

interface DeribitBookSummary {
  instrument_name: string;
  bid_price: number | null;
  ask_price: number | null;
  mark_price: number | null;
  mid_price: number | null;
  open_interest: number;
  volume: number;
  mark_iv: number | null;
  underlying_price: number | null;
  interest_rate: number;
}

const expirationFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export async function fetchDeribitJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(`${DERIBIT_API_BASE}${path}`, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new DeribitApiError("UPSTREAM_BAD_STATUS", `Deribit API request failed: ${response.status}`);
    }

    const payload = (await response.json()) as Partial<DeribitResult<T>>;
    if (!("result" in payload)) {
      throw new DeribitApiError("UPSTREAM_INVALID_PAYLOAD", "Deribit API response missing result field");
    }

    return payload.result as T;
  } catch (error) {
    if (error instanceof DeribitApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new DeribitApiError("UPSTREAM_TIMEOUT", "Deribit API request timed out");
    }

    throw new DeribitApiError("UPSTREAM_BAD_STATUS", "Deribit API request failed");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchBtcIndexPrice(): Promise<number> {
  const result = await fetchDeribitJson<DeribitTickerResult>("/get_index_price?index_name=btc_usd");
  if (typeof result?.index_price !== "number") {
    throw new DeribitApiError("UPSTREAM_INVALID_PAYLOAD", "Deribit index price payload is invalid");
  }

  return roundTo(result.index_price, 2);
}

export async function fetchOptionChain(): Promise<OptionContract[]> {
  const summaries = await fetchDeribitJson<DeribitBookSummary[]>("/get_book_summary_by_currency?currency=BTC&kind=option");
  if (!Array.isArray(summaries)) {
    throw new DeribitApiError("UPSTREAM_INVALID_PAYLOAD", "Deribit option chain payload is invalid");
  }

  return summaries
    .map(normalizeDeribitOption)
    .filter((option): option is OptionContract => option !== null)
    .sort((left, right) => left.expirationTimestamp - right.expirationTimestamp || left.strike - right.strike);
}

function normalizeDeribitOption(summary: DeribitBookSummary): OptionContract | null {
  try {
    if (!summary || typeof summary.instrument_name !== "string") {
      return null;
    }

    const parsed = parseInstrumentName(summary.instrument_name);
    if (!parsed) {
      return null;
    }

    const daysToExpiry = roundTo((parsed.expirationTimestamp - Date.now()) / 1000 / 60 / 60 / 24, 1);
    if (daysToExpiry <= 0) {
      return null;
    }

    const delta = estimateDelta({
      optionType: parsed.optionType,
      strike: parsed.strike,
      underlyingPrice: summary.underlying_price,
      annualizedIv: summary.mark_iv,
      interestRate: summary.interest_rate,
      daysToExpiry,
    });

    return {
      instrumentName: summary.instrument_name,
      optionType: parsed.optionType,
      strike: parsed.strike,
      expirationCode: parsed.expirationCode,
      expiration: expirationFormatter.format(parsed.expirationTimestamp),
      expirationTimestamp: parsed.expirationTimestamp,
      daysToExpiry,
      bidPrice: normalizeNullable(summary.bid_price),
      askPrice: normalizeNullable(summary.ask_price),
      markPrice: normalizeNullable(summary.mark_price),
      midPrice: normalizeNullable(summary.mid_price),
      underlyingPrice: normalizeNullable(summary.underlying_price),
      markIv: normalizeNullable(summary.mark_iv),
      interestRate: summary.interest_rate ?? 0,
      openInterest: roundTo(summary.open_interest ?? 0, 2),
      volume: roundTo(summary.volume ?? 0, 2),
      delta,
      otmPercent: calculateOtmPercent(parsed.optionType, parsed.strike, summary.underlying_price),
      premiumReturnPercent: calculatePremiumReturnPercent(summary.mark_price),
      annualizedYieldPercent: calculateAnnualizedYield(summary.mark_price, daysToExpiry),
      premiumUsdPerBtc: calculatePremiumUsdPerBtc(summary.mark_price, summary.underlying_price),
    };
  } catch {
    return null;
  }
}

function normalizeNullable(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return roundTo(value, 4);
}

function parseInstrumentName(instrumentName: string): {
  optionType: "call" | "put";
  strike: number;
  expirationCode: string;
  expirationTimestamp: number;
} | null {
  const parts = instrumentName.split("-");
  if (parts.length !== 4) {
    return null;
  }

  const [, expirationCode, strikeCode, optionCode] = parts;
  const strike = Number.parseFloat(strikeCode);
  const optionType = optionCode === "C" ? "call" : optionCode === "P" ? "put" : null;
  const expirationTimestamp = Date.parse(`${formatExpirationCode(expirationCode)}T08:00:00Z`);

  if (!optionType || !Number.isFinite(strike) || Number.isNaN(expirationTimestamp)) {
    return null;
  }

  return {
    optionType,
    strike,
    expirationCode,
    expirationTimestamp,
  };
}

function formatExpirationCode(code: string): string {
  const match = code.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) {
    throw new Error(`Unsupported expiration code: ${code}`);
  }

  const [, day, monthRaw, year] = match;
  const monthMap: Record<string, string> = {
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12",
  };
  const month = monthMap[monthRaw];
  if (!month) {
    throw new Error(`Unsupported month code: ${monthRaw}`);
  }

  return `20${year}-${month}-${day.padStart(2, "0")}`;
}

function estimateDelta({
  optionType,
  strike,
  underlyingPrice,
  annualizedIv,
  interestRate,
  daysToExpiry,
}: {
  optionType: "call" | "put";
  strike: number;
  underlyingPrice: number | null;
  annualizedIv: number | null;
  interestRate: number;
  daysToExpiry: number;
}): number | null {
  if (!underlyingPrice || underlyingPrice <= 0 || !annualizedIv || daysToExpiry <= 0) {
    return null;
  }

  const volatility = annualizedIv / 100;
  const time = daysToExpiry / 365;
  if (volatility <= 0 || time <= 0) {
    return null;
  }

  const sigmaRootT = volatility * Math.sqrt(time);
  if (sigmaRootT === 0) {
    return null;
  }

  const d1 =
    (Math.log(underlyingPrice / strike) + (interestRate + (volatility * volatility) / 2) * time) /
    sigmaRootT;
  const callDelta = standardNormalCdf(d1);
  const raw = optionType === "call" ? callDelta : callDelta - 1;
  return roundTo(raw, 4);
}

function standardNormalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const approximation = erf(x);
  return 0.5 * (1 + sign * approximation);
}

function erf(value: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + p * x);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-x * x);

  return sign * y;
}
