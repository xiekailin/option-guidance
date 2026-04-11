import { roundTo } from "./calculations";
import type { OptionContract, SkewPoint, TermStructurePoint, VolatilityAnalysis } from "../types/option";

export function analyzeVolatility(
  options: OptionContract[],
  underlyingPrice: number | null,
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

  const ivLevel = getIvLevel(atmIv, ivMin, ivMax);
  const summary = buildSummary(atmIv, ivLevel, ivMedian);

  return {
    atmIv: atmIv != null ? roundTo(atmIv, 1) : null,
    atmLabel: atmIv != null ? `${roundTo(atmIv, 1)}%` : "--",
    ivLevel,
    termStructure,
    skew,
    ivMin: roundTo(ivMin, 1),
    ivMax: roundTo(ivMax, 1),
    ivMedian,
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildSummary(atmIv: number | null, level: "high" | "normal" | "low", ivMedian: number): string {
  if (atmIv == null) return "暂无足够的隐波数据。";

  const levelText = level === "high"
    ? "隐波偏高，权利金比较贵，适合卖方收租。"
    : level === "low"
      ? "隐波偏低，权利金比较便宜，适合买方建仓。"
      : "隐波处于中等水平，权利金定价合理。";

  return `ATM 隐波 ${roundTo(atmIv, 1)}%，全部合约中位数 ${ivMedian}%。${levelText}`;
}
