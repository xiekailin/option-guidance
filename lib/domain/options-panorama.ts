import { roundTo } from "./calculations";
import type {
  ExpiryCalendarDay,
  MaxPainPoint,
  OiHeatmapCell,
  OptionContract,
  OptionsPanorama,
  PutCallRatioPoint,
} from "@/lib/types/option";

/**
 * 按 expirationTimestamp 分组期权合约
 */
function groupByExpiration(options: OptionContract[]): Map<number, OptionContract[]> {
  const map = new Map<number, OptionContract[]>();
  for (const opt of options) {
    const group = map.get(opt.expirationTimestamp);
    if (group) {
      group.push(opt);
    } else {
      map.set(opt.expirationTimestamp, [opt]);
    }
  }
  return map;
}

/**
 * Max Pain 计算：找到使期权买方总亏损最大化的行权价
 *
 * 对每个行权价，假设 BTC 到期价恰好等于该行权价，计算所有 ITM 期权的内在价值总和。
 * 内在价值最大的 strike = max pain。
 */
export function computeMaxPain(options: OptionContract[]): MaxPainPoint[] {
  const groups = groupByExpiration(options);
  const results: MaxPainPoint[] = [];

  for (const [expTs, contracts] of groups) {
    // 只处理有 OI 的到期日
    const totalOi = contracts.reduce((s, c) => s + c.openInterest, 0);
    if (totalOi <= 0) continue;

    // 按 optionType 分组
    const callsByStrike = new Map<number, number>();
    const putsByStrike = new Map<number, number>();

    for (const c of contracts) {
      if (c.openInterest <= 0) continue;
      const target = c.optionType === "call" ? callsByStrike : putsByStrike;
      target.set(c.strike, (target.get(c.strike) ?? 0) + c.openInterest);
    }

    // 收集所有唯一行权价
    const allStrikes = new Set([...callsByStrike.keys(), ...putsByStrike.keys()]);
    if (allStrikes.size === 0) continue;

    const first = contracts[0]!;
    const strikeValues: MaxPainPoint["strikes"] = [];

    for (const testStrike of allStrikes) {
      let totalIntrinsic = 0;
      // Call 买方亏损：行权价低于测试价的 call 都 ITM
      for (const [strike, oi] of callsByStrike) {
        if (testStrike > strike) {
          totalIntrinsic += (testStrike - strike) * oi;
        }
      }
      // Put 买方亏损：行权价高于测试价的 put 都 ITM
      for (const [strike, oi] of putsByStrike) {
        if (testStrike < strike) {
          totalIntrinsic += (strike - testStrike) * oi;
        }
      }
      strikeValues.push({ strike: testStrike, totalIntrinsicValue: roundTo(totalIntrinsic, 2) });
    }

    // 排序找到 max pain（内在价值最大的 strike）
    strikeValues.sort((a, b) => a.strike - b.strike);
    const maxPainEntry = strikeValues.reduce((max, cur) =>
      cur.totalIntrinsicValue > max.totalIntrinsicValue ? cur : max,
    );

    results.push({
      expiration: first.expiration,
      expirationTimestamp: expTs,
      daysToExpiry: first.daysToExpiry,
      maxPainStrike: maxPainEntry.strike,
      strikes: strikeValues,
    });
  }

  // 按到期日升序，最多 8 个
  results.sort((a, b) => a.expirationTimestamp - b.expirationTimestamp);
  return results.slice(0, 8);
}

/**
 * Put/Call Ratio 计算：按到期日分别统计 OI 和 Volume
 */
export function computePutCallRatios(options: OptionContract[]): PutCallRatioPoint[] {
  const groups = groupByExpiration(options);
  const results: PutCallRatioPoint[] = [];

  for (const [expTs, contracts] of groups) {
    let callOi = 0;
    let putOi = 0;
    let callVolume = 0;
    let putVolume = 0;

    for (const c of contracts) {
      if (c.optionType === "call") {
        callOi += c.openInterest;
        callVolume += c.volume;
      } else {
        putOi += c.openInterest;
        putVolume += c.volume;
      }
    }

    // 跳过没有 OI 的到期日
    if (callOi + putOi <= 0) continue;

    const first = contracts[0]!;
    const oiRatio = callOi > 0 ? roundTo(putOi / callOi, 3) : Infinity;
    const volumeRatio = callVolume > 0 ? roundTo(putVolume / callVolume, 3) : Infinity;

    let sentiment: PutCallRatioPoint["sentiment"] = "中性";
    if (oiRatio < 0.7) sentiment = "偏多";
    else if (oiRatio > 1.3) sentiment = "偏空";

    results.push({
      expiration: first.expiration,
      expirationTimestamp: expTs,
      daysToExpiry: first.daysToExpiry,
      callOi: roundTo(callOi, 2),
      putOi: roundTo(putOi, 2),
      callVolume: roundTo(callVolume, 2),
      putVolume: roundTo(putVolume, 2),
      oiRatio,
      volumeRatio,
      sentiment,
    });
  }

  results.sort((a, b) => a.expirationTimestamp - b.expirationTimestamp);
  return results;
}

/**
 * OI 热力图数据：按 (strike, expiration) 聚合
 * 只保留距现价 ±30% 范围内的 strike，避免矩阵过大
 */
export function buildOiHeatmap(
  options: OptionContract[],
  spotPrice: number,
): Pick<OptionsPanorama, "heatmap" | "heatmapStrikes" | "heatmapExpirations"> {
  if (spotPrice <= 0) {
    return { heatmap: [], heatmapStrikes: [], heatmapExpirations: [] };
  }

  const lowerBound = spotPrice * 0.7;
  const upperBound = spotPrice * 1.3;

  // 筛选范围内的合约
  const filtered = options.filter(
    (c) => c.strike >= lowerBound && c.strike <= upperBound && c.openInterest > 0,
  );

  // 按 (strike, expiration) 聚合
  const cellMap = new Map<string, OiHeatmapCell>();

  for (const c of filtered) {
    const key = `${c.strike}-${c.expirationTimestamp}`;
    const existing = cellMap.get(key);
    if (existing) {
      if (c.optionType === "call") {
        existing.callOi += c.openInterest;
      } else {
        existing.putOi += c.openInterest;
      }
      existing.totalOi += c.openInterest;
    } else {
      const cell: OiHeatmapCell = {
        strike: c.strike,
        expiration: c.expiration,
        expirationTimestamp: c.expirationTimestamp,
        callOi: c.optionType === "call" ? c.openInterest : 0,
        putOi: c.optionType === "put" ? c.openInterest : 0,
        totalOi: c.openInterest,
      };
      cellMap.set(key, cell);
    }
  }

  const heatmap = Array.from(cellMap.values());
  const heatmapStrikes = [...new Set(heatmap.map((c) => c.strike))].sort((a, b) => a - b);
  const heatmapExpirations = [...new Set(heatmap.map((c) => c.expiration))].sort();

  return { heatmap, heatmapStrikes, heatmapExpirations };
}

/**
 * 总入口：生成期权全景数据
 */
export function analyzeOptionsPanorama(
  options: OptionContract[],
  spotPrice: number,
): OptionsPanorama {
  const maxPainPoints = computeMaxPain(options);
  const putCallRatios = computePutCallRatios(options);
  const heatmapData = buildOiHeatmap(options, spotPrice);

  // 全局 P/C Ratio
  let totalCallOi = 0;
  let totalPutOi = 0;
  let totalCallVol = 0;
  let totalPutVol = 0;

  for (const c of options) {
    if (c.optionType === "call") {
      totalCallOi += c.openInterest;
      totalCallVol += c.volume;
    } else {
      totalPutOi += c.openInterest;
      totalPutVol += c.volume;
    }
  }

  const overallOiRatio = totalCallOi > 0 ? roundTo(totalPutOi / totalCallOi, 3) : Infinity;
  const overallVolumeRatio = totalCallVol > 0 ? roundTo(totalPutVol / totalCallVol, 3) : Infinity;

  return {
    maxPainPoints,
    putCallRatios,
    overallOiRatio,
    overallVolumeRatio,
    totalCallOi: roundTo(totalCallOi, 2),
    totalPutOi: roundTo(totalPutOi, 2),
    ...heatmapData,
  };
}

/**
 * 按到期日聚合数据，生成日历视图所需的每日摘要
 */
export function buildExpiryCalendarDays(
  options: OptionContract[],
  maxPainPoints: MaxPainPoint[],
  spotPrice: number,
): ExpiryCalendarDay[] {
  const groups = groupByExpiration(options);
  const maxPainMap = new Map(maxPainPoints.map((mp) => [mp.expirationTimestamp, mp.maxPainStrike]));
  const dateFormatter = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", timeZone: "UTC" });
  const results: ExpiryCalendarDay[] = [];

  for (const [expTs, contracts] of groups) {
    let callOi = 0;
    let putOi = 0;
    let totalVolume = 0;
    const strikeSet = new Set<number>();

    for (const c of contracts) {
      if (c.openInterest > 0) strikeSet.add(c.strike);
      if (c.optionType === "call") {
        callOi += c.openInterest;
      } else {
        putOi += c.openInterest;
      }
      totalVolume += c.volume;
    }

    const totalOi = callOi + putOi;
    if (totalOi <= 0) continue;

    const oiRatio = callOi > 0 ? roundTo(putOi / callOi, 3) : Infinity;
    let sentiment: ExpiryCalendarDay["sentiment"] = "中性";
    if (oiRatio < 0.7) sentiment = "偏多";
    else if (oiRatio > 1.3) sentiment = "偏空";

    const maxPainStrike = maxPainMap.get(expTs) ?? null;
    const maxPainDeviationPercent = maxPainStrike != null && spotPrice > 0
      ? roundTo(((spotPrice - maxPainStrike) / spotPrice) * 100, 1)
      : null;

    const first = contracts[0]!;
    const date = new Date(expTs);

    results.push({
      expirationTimestamp: expTs,
      dateLabel: dateFormatter.format(date),
      day: date.getUTCDate(),
      month: date.getUTCMonth(),
      year: date.getUTCFullYear(),
      totalOi: roundTo(totalOi, 2),
      callOi: roundTo(callOi, 2),
      putOi: roundTo(putOi, 2),
      oiRatio,
      sentiment,
      maxPainStrike,
      maxPainDeviationPercent,
      uniqueStrikes: strikeSet.size,
      totalVolume: roundTo(totalVolume, 2),
      daysToExpiry: first.daysToExpiry,
    });
  }

  results.sort((a, b) => a.expirationTimestamp - b.expirationTimestamp);
  return results;
}
