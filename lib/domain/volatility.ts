import { roundTo } from "./calculations";
import type { HistoricalPricePoint, OptionContract, SkewPoint, TermStructurePoint, VolatilityAnalysis } from "../types/option";

export function analyzeVolatility(
  options: OptionContract[],
  underlyingPrice: number | null,
  historicalPrices: HistoricalPricePoint[] = [],
): VolatilityAnalysis {
  if (!underlyingPrice || options.length === 0) {
    return emptyAnalysis();
  }

  const withIv = options.filter((o) => o.markIv != null);
  if (withIv.length === 0) {
    return emptyAnalysis();
  }

  const atmIv = findAtmIv(withIv, underlyingPrice);
  const termStructure = buildTermStructure(withIv, underlyingPrice);
  const skew = buildSkew(withIv);
  const ivValues = withIv.map((o) => o.markIv!);
  const ivMin = Math.min(...ivValues);
  const ivMax = Math.max(...ivValues);
  const ivMedian = roundTo(median(ivValues), 1);
  const dailyHistoricalPrices = toDailyCloses(historicalPrices);
  const historicalVol7d = calculateHistoricalVolatility(dailyHistoricalPrices, 7);
  const historicalVol30d = calculateHistoricalVolatility(dailyHistoricalPrices, 30);
  const historicalVol90d = calculateHistoricalVolatility(dailyHistoricalPrices, 90);
  const ivHvSpread30d = atmIv != null && historicalVol30d != null ? roundTo(atmIv - historicalVol30d, 1) : null;

  const ivLevel = getIvLevel(atmIv, ivMin, ivMax);
  const verdict = buildVerdict(atmIv, historicalVol30d, ivHvSpread30d);
  const summary = buildSummary(atmIv, ivLevel, ivMedian, historicalVol30d, ivHvSpread30d);

  return {
    atmIv: atmIv != null ? roundTo(atmIv, 1) : null,
    atmLabel: atmIv != null ? `${roundTo(atmIv, 1)}%` : "--",
    ivLevel,
    termStructure,
    skew,
    ivMin: roundTo(ivMin, 1),
    ivMax: roundTo(ivMax, 1),
    ivMedian,
    historicalVol7d,
    historicalVol30d,
    historicalVol90d,
    ivHvSpread30d,
    verdict,
    summary,
  };
}

function emptyAnalysis(): VolatilityAnalysis {
  return {
    atmIv: null,
    atmLabel: "--",
    ivLevel: "normal",
    termStructure: [],
    skew: [],
    ivMin: 0,
    ivMax: 0,
    ivMedian: 0,
    historicalVol7d: null,
    historicalVol30d: null,
    historicalVol90d: null,
    ivHvSpread30d: null,
    verdict: "暂无足够数据。",
    summary: "暂无足够的隐波数据。",
  };
}

function findAtmIv(options: OptionContract[], underlyingPrice: number): number | null {
  let closest = options[0];
  let minDistance = Infinity;

  for (const opt of options) {
    const distance = Math.abs(opt.strike - underlyingPrice);
    if (distance < minDistance) {
      minDistance = distance;
      closest = opt;
    }
  }

  return closest.markIv;
}

function buildTermStructure(
  options: OptionContract[],
  underlyingPrice: number,
): TermStructurePoint[] {
  const nearAtm = options.filter((o) => Math.abs(o.strike - underlyingPrice) / underlyingPrice < 0.05);
  const byExpiry = new Map<number, { days: number; ivs: number[]; exp: string }>();

  for (const opt of nearAtm) {
    if (opt.markIv == null) continue;
    const existing = byExpiry.get(opt.expirationTimestamp);
    if (existing) {
      existing.ivs.push(opt.markIv);
    } else {
      byExpiry.set(opt.expirationTimestamp, {
        days: opt.daysToExpiry,
        ivs: [opt.markIv],
        exp: opt.expiration,
      });
    }
  }

  return Array.from(byExpiry.entries())
    .sort((a, b) => a[1].days - b[1].days)
    .map(([, data]) => ({
      label: data.exp,
      daysToExpiry: data.days,
      iv: roundTo(data.ivs.reduce((s, v) => s + v, 0) / data.ivs.length, 1),
    }))
    .slice(0, 6);
}

function buildSkew(
  options: OptionContract[],
): SkewPoint[] {
  const nearestExpiry = findNearestExpiry(options);
  if (!nearestExpiry) return [];

  return options
    .filter((o): o is OptionContract & { markIv: number; otmPercent: number } =>
      o.expirationTimestamp === nearestExpiry && o.markIv != null && o.otmPercent != null)
    .filter((o) => o.otmPercent < 15 && o.otmPercent > 0)
    .map((o) => ({
      strike: o.strike,
      optionType: o.optionType,
      otmPercent: o.otmPercent,
      iv: o.markIv,
    }))
    .sort((a, b) => a.strike - b.strike)
    .slice(0, 20);
}

function findNearestExpiry(options: OptionContract[]): number | null {
  const expiries = new Set(options.map((o) => o.expirationTimestamp));
  let nearest = Infinity;
  let nearestTs: number | null = null;
  const now = Date.now();

  for (const ts of expiries) {
    const distance = Math.abs(ts - now);
    if (distance < nearest && ts > now) {
      nearest = distance;
      nearestTs = ts;
    }
  }

  return nearestTs;
}

function getIvLevel(atmIv: number | null, ivMin: number, ivMax: number): "high" | "normal" | "low" {
  if (atmIv == null) return "normal";
  const range = ivMax - ivMin;
  if (range <= 0) return "normal";
  const percentile = (atmIv - ivMin) / range;
  if (percentile > 0.65) return "high";
  if (percentile < 0.35) return "low";
  return "normal";
}

function toDailyCloses(points: HistoricalPricePoint[]): HistoricalPricePoint[] {
  const byDay = new Map<string, HistoricalPricePoint>();

  for (const point of points) {
    const day = new Date(point.timestamp).toISOString().slice(0, 10);
    const previous = byDay.get(day);
    if (!previous || point.timestamp > previous.timestamp) {
      byDay.set(day, point);
    }
  }

  return Array.from(byDay.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function calculateHistoricalVolatility(points: HistoricalPricePoint[], windowDays: number): number | null {
  if (points.length < windowDays + 1) {
    return null;
  }

  const closes = points.slice(-windowDays - 1).map((point) => point.price).filter((price) => price > 0);
  if (closes.length < windowDays + 1) {
    return null;
  }

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    returns.push(Math.log(closes[i]! / closes[i - 1]!));
  }

  if (returns.length === 0) {
    return null;
  }

  const avg = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / returns.length;
  const dailyStd = Math.sqrt(variance);
  return roundTo(dailyStd * Math.sqrt(365) * 100, 1);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function buildVerdict(atmIv: number | null, historicalVol30d: number | null, spread30d: number | null): string {
  if (atmIv == null || historicalVol30d == null || spread30d == null) {
    return "现在只能看到隐含波动率，历史对比还不够完整。";
  }

  if (spread30d >= 8) {
    return "现在期权偏贵，收租卖方更舒服。";
  }

  if (spread30d <= -5) {
    return "现在期权不算贵，买方更容易拿到便宜价格。";
  }

  return "现在期权价格大体正常，没有明显贵很多或便宜很多。";
}

function buildSummary(
  atmIv: number | null,
  level: "high" | "normal" | "low",
  ivMedian: number,
  historicalVol30d: number | null,
  spread30d: number | null,
): string {
  if (atmIv == null) return "暂无足够的隐波数据。";

  const levelText = level === "high"
    ? "隐含波动率偏高，权利金通常更贵。"
    : level === "low"
      ? "隐含波动率偏低，权利金通常更便宜。"
      : "隐含波动率处于中间位置。";

  if (historicalVol30d == null || spread30d == null) {
    return `当前隐含波动率 ${roundTo(atmIv, 1)}%，全部合约中位数 ${ivMedian}%。${levelText}`;
  }

  return `当前隐含波动率 ${roundTo(atmIv, 1)}%，30天历史波动率 ${historicalVol30d}%，两者相差 ${spread30d >= 0 ? "+" : ""}${spread30d}%。${levelText}`;
}
