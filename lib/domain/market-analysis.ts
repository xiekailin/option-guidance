import { roundTo } from "./calculations";
import type { HistoricalPricePoint, OptionContract, VolatilityAnalysis } from "../types/option";

export type TrendDirection = "bullish" | "bearish" | "neutral";
export type PremiumRegime = "expensive" | "fair" | "cheap";
export type SkewBias = "defensive" | "balanced" | "risk-on";
export type TermStructureBias = "short-stress" | "flat" | "forward-rich";

export interface TrendMomentumAnalysis {
  shortTrend: TrendDirection;
  mediumTrend: TrendDirection;
  return7d: number | null;
  return30d: number | null;
  return90d: number | null;
  sma20: number | null;
  sma50: number | null;
  sma90: number | null;
  priceVsSma20Percent: number | null;
  priceVsSma50Percent: number | null;
  summary: string;
}

export interface KeyLevelsAnalysis {
  support: number | null;
  resistance: number | null;
  supportDistancePercent: number | null;
  resistanceDistancePercent: number | null;
  rangeLow30d: number | null;
  rangeHigh30d: number | null;
  oiSupportStrike: number | null;
  oiResistanceStrike: number | null;
  supportSource: "oi-put" | "range-low" | "none";
  resistanceSource: "oi-call" | "range-high" | "none";
  supportPlain: string;
  resistancePlain: string;
  distancePlain: string;
  oiZonePlain: string;
  actionHint: string;
}

export interface DerivativesSentimentAnalysis {
  premiumRegime: PremiumRegime;
  skewBias: SkewBias;
  termStructureBias: TermStructureBias;
  putCallSkewSpread: number | null;
  summary: string;
}

export interface StrategyModeAdvice {
  mode: "covered-call" | "cash-secured-put" | "synthetic-long" | "wait";
  label: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  summary: string;
  riskNote: string;
}

export interface MarketBrief {
  title: string;
  summary: string;
  tags: string[];
  riskNote: string;
}

export interface MarketOverviewAnalysis {
  brief: MarketBrief;
  advice: StrategyModeAdvice;
  trendMomentum: TrendMomentumAnalysis;
  keyLevels: KeyLevelsAnalysis;
  derivativesSentiment: DerivativesSentimentAnalysis;
}

interface AnalyzeMarketOverviewInput {
  currentPrice: number | null;
  historicalPrices: HistoricalPricePoint[];
  options: OptionContract[];
  volatility: VolatilityAnalysis;
}

export function analyzeMarketOverview({
  currentPrice,
  historicalPrices,
  options,
  volatility,
}: AnalyzeMarketOverviewInput): MarketOverviewAnalysis {
  const trendMomentum = analyzeTrendMomentum(currentPrice, historicalPrices);
  const keyLevels = extractKeyLevels(currentPrice, historicalPrices, options);
  const derivativesSentiment = analyzeDerivativesSentiment(volatility, options);
  const advice = recommendStrategyMode({
    trendMomentum,
    keyLevels,
    derivativesSentiment,
  });
  const brief = buildMarketBrief(currentPrice, trendMomentum, keyLevels, derivativesSentiment);

  return {
    brief,
    advice,
    trendMomentum,
    keyLevels,
    derivativesSentiment,
  };
}

export function analyzeTrendMomentum(
  currentPrice: number | null,
  historicalPrices: HistoricalPricePoint[],
): TrendMomentumAnalysis {
  const closes = toDailyCloses(historicalPrices).map((point) => point.price).filter((price) => price > 0);
  const latestPrice = currentPrice && currentPrice > 0 ? currentPrice : closes.at(-1) ?? null;

  const return7d = latestPrice != null ? calculateReturn(latestPrice, closes, 7) : null;
  const return30d = latestPrice != null ? calculateReturn(latestPrice, closes, 30) : null;
  const return90d = latestPrice != null ? calculateReturn(latestPrice, closes, 90) : null;
  const sma20 = calculateSma(closes, 20);
  const sma50 = calculateSma(closes, 50);
  const sma90 = calculateSma(closes, 90);
  const priceVsSma20Percent = latestPrice != null ? distancePercent(latestPrice, sma20) : null;
  const priceVsSma50Percent = latestPrice != null ? distancePercent(latestPrice, sma50) : null;

  const shortTrend = classifyTrend(return7d, priceVsSma20Percent);
  const mediumTrend = classifyTrend(return30d, priceVsSma50Percent);

  return {
    shortTrend,
    mediumTrend,
    return7d,
    return30d,
    return90d,
    sma20,
    sma50,
    sma90,
    priceVsSma20Percent,
    priceVsSma50Percent,
    summary: buildTrendSummary(shortTrend, mediumTrend, return7d, return30d),
  };
}

export function extractKeyLevels(
  currentPrice: number | null,
  historicalPrices: HistoricalPricePoint[],
  options: OptionContract[],
): KeyLevelsAnalysis {
  const closes = toDailyCloses(historicalPrices).map((point) => point.price).filter((price) => price > 0);
  const recentCloses = closes.slice(-30);
  const rangeLow30d = recentCloses.length > 0 ? Math.min(...recentCloses) : null;
  const rangeHigh30d = recentCloses.length > 0 ? Math.max(...recentCloses) : null;

  const oiSupportStrike = findHighestStrike(options.filter((option) => option.optionType === "put" && option.strike < (currentPrice ?? Infinity)));
  const oiResistanceStrike = findHighestStrike(options.filter((option) => option.optionType === "call" && option.strike > (currentPrice ?? -Infinity)));

  const support = oiSupportStrike ?? rangeLow30d;
  const resistance = oiResistanceStrike ?? rangeHigh30d;
  const supportDistancePercent = currentPrice != null ? distancePercent(support, currentPrice) : null;
  const resistanceDistancePercent = currentPrice != null ? distancePercent(resistance, currentPrice) : null;
  const supportSource = oiSupportStrike != null ? "oi-put" : rangeLow30d != null ? "range-low" : "none";
  const resistanceSource = oiResistanceStrike != null ? "oi-call" : rangeHigh30d != null ? "range-high" : "none";

  return {
    support,
    resistance,
    supportDistancePercent,
    resistanceDistancePercent,
    rangeLow30d,
    rangeHigh30d,
    oiSupportStrike,
    oiResistanceStrike,
    supportSource,
    resistanceSource,
    supportPlain: buildSupportPlain(support, supportSource),
    resistancePlain: buildResistancePlain(resistance, resistanceSource),
    distancePlain: buildDistancePlain(supportDistancePercent, resistanceDistancePercent),
    oiZonePlain: buildOiZonePlain(oiSupportStrike, oiResistanceStrike),
    actionHint: buildActionHint(currentPrice, support, resistance),
  };
}

export function analyzeDerivativesSentiment(
  volatility: VolatilityAnalysis,
  options: OptionContract[],
): DerivativesSentimentAnalysis {
  const premiumRegime: PremiumRegime =
    volatility.ivHvSpread30d != null
      ? volatility.ivHvSpread30d >= 8
        ? "expensive"
        : volatility.ivHvSpread30d <= -5
          ? "cheap"
          : "fair"
      : volatility.ivLevel === "high"
        ? "expensive"
        : volatility.ivLevel === "low"
          ? "cheap"
          : "fair";

  const nearestExpiry = findNearestExpiry(options);
  const nearestOptions = nearestExpiry == null
    ? []
    : options.filter((option) => option.expirationTimestamp === nearestExpiry && option.markIv != null && option.otmPercent != null);

  const nearPuts = nearestOptions.filter((option) => option.optionType === "put" && option.otmPercent! > 0 && option.otmPercent! <= 8);
  const nearCalls = nearestOptions.filter((option) => option.optionType === "call" && option.otmPercent! > 0 && option.otmPercent! <= 8);

  const putAvgIv = average(nearPuts.map((option) => option.markIv ?? 0));
  const callAvgIv = average(nearCalls.map((option) => option.markIv ?? 0));
  const putCallSkewSpread = putAvgIv != null && callAvgIv != null ? roundTo(putAvgIv - callAvgIv, 1) : null;

  const skewBias: SkewBias =
    putCallSkewSpread != null
      ? putCallSkewSpread >= 4
        ? "defensive"
        : putCallSkewSpread <= -4
          ? "risk-on"
          : "balanced"
      : "balanced";

  const termStructureBias: TermStructureBias =
    volatility.termStructure.length >= 2
      ? volatility.termStructure[0]!.iv - volatility.termStructure[volatility.termStructure.length - 1]!.iv >= 4
        ? "short-stress"
        : volatility.termStructure[volatility.termStructure.length - 1]!.iv - volatility.termStructure[0]!.iv >= 4
          ? "forward-rich"
          : "flat"
      : "flat";

  return {
    premiumRegime,
    skewBias,
    termStructureBias,
    putCallSkewSpread,
    summary: buildDerivativesSummary(premiumRegime, skewBias, termStructureBias),
  };
}

export function recommendStrategyMode({
  trendMomentum,
  keyLevels,
  derivativesSentiment,
}: {
  trendMomentum: TrendMomentumAnalysis;
  keyLevels: KeyLevelsAnalysis;
  derivativesSentiment: DerivativesSentimentAnalysis;
}): StrategyModeAdvice {
  if (trendMomentum.shortTrend === "bearish" && derivativesSentiment.termStructureBias === "short-stress") {
    return {
      mode: "wait",
      label: "先别急着开仓",
      confidence: "high",
      reasons: [
        "短线和中线都偏弱，逆着市场做更容易挨打。",
        "短端 IV 更高，说明市场对眼前波动更紧张。",
        keyLevels.support != null ? `就算下方有 ${Math.round(keyLevels.support).toLocaleString()} 支撑，也要先看能不能守住。` : "关键支撑还没有完全稳住。",
      ],
      summary: "现在更像先防守、少动手的阶段，别急着为了收租硬上仓位。",
      riskNote: "这时候最大的风险不是赚少了，而是市场继续加速下跌。",
    };
  }

  if (
    trendMomentum.shortTrend === "bullish"
    && trendMomentum.mediumTrend === "bullish"
    && derivativesSentiment.premiumRegime === "expensive"
  ) {
    return {
      mode: "covered-call",
      label: "更适合持有 BTC 卖看涨",
      confidence: "high",
      reasons: [
        "趋势偏强，说明你手里的 BTC 仍有底气继续拿着。",
        "现在期权偏贵，卖方更容易收比较厚的权利金。",
        keyLevels.resistance != null ? `上方 ${Math.round(keyLevels.resistance).toLocaleString()} 一带本来就更容易先放慢，卖看涨更顺势。` : "上方压力还没完全消失，卖看涨更容易占到节奏。",
      ],
      summary: "现在更适合拿着 BTC 收租，优先考虑卖看涨，而不是继续追方向。",
      riskNote: "最大代价不是亏损无限，而是如果 BTC 突然暴冲，你会卖飞。",
    };
  }

  if (
    derivativesSentiment.premiumRegime === "expensive"
    && keyLevels.support != null
    && (trendMomentum.shortTrend === "neutral" || trendMomentum.shortTrend === "bearish")
  ) {
    return {
      mode: "cash-secured-put",
      label: "更适合卖看跌准备接货",
      confidence: trendMomentum.shortTrend === "neutral" ? "high" : "medium",
      reasons: [
        "现在期权偏贵，卖看跌先收租更划算。",
        keyLevels.supportDistancePercent != null && Math.abs(keyLevels.supportDistancePercent) <= 5
          ? "下方支撑离现价不远，真回落也更像在你愿意接的区域。"
          : "下方已经有一个比较明确的支撑位，不是盲接。",
        derivativesSentiment.skewBias === "defensive"
          ? "put 保护需求更强，说明卖看跌能拿到更厚一点的补偿。"
          : "市场更像震荡整理，卖看跌接货比追涨更稳。",
      ],
      summary: "现在更适合卖看跌先收租，等市场给你更便宜的位置再接货。",
      riskNote: "别把它当成白捡租金，一旦真的跌穿支撑，你还是要按约定价接货。",
    };
  }

  if (
    trendMomentum.shortTrend === "bullish"
    && trendMomentum.mediumTrend === "bullish"
    && derivativesSentiment.premiumRegime !== "expensive"
    && derivativesSentiment.skewBias !== "defensive"
  ) {
    return {
      mode: "synthetic-long",
      label: "更适合合成现货",
      confidence: derivativesSentiment.premiumRegime === "fair" ? "high" : "medium",
      reasons: [
        "短中期都偏强，更像顺势看涨而不是只想收租。",
        derivativesSentiment.premiumRegime === "cheap" ? "现在期权不算贵，更适合做方向性表达。" : "现在期权不算特别贵，做方向性组合不会太吃亏。",
        derivativesSentiment.skewBias === "risk-on" ? "call 一侧更活跃，市场对上行更愿意定价。" : "情绪没有明显偏防守，合成现货的阻力更小。",
      ],
      summary: "现在更适合用合成现货去表达偏多观点，而不是只做收租。",
      riskNote: "这个模式最怕突然转弱，尤其是跌的时候，下方义务会比看起来更疼。",
    };
  }

  return {
    mode: "covered-call",
    label: "先按稳健收租思路看",
    confidence: "low",
    reasons: [
      "当前信号没有强到足以明确押单边方向。",
      "先用更稳一点的收租思路观察，比盲目切激进策略更安全。",
      keyLevels.actionHint,
    ],
    summary: "现在市场信号还不够统一，先按稳健思路做，比硬猜方向更合适。",
    riskNote: "如果后面趋势和情绪继续朝一个方向走，再切模式会更舒服。",
  };
}

function buildMarketBrief(
  currentPrice: number | null,
  trendMomentum: TrendMomentumAnalysis,
  keyLevels: KeyLevelsAnalysis,
  derivativesSentiment: DerivativesSentimentAnalysis,
): MarketBrief {
  const trendText =
    trendMomentum.shortTrend === "bullish"
      ? "短线偏强"
      : trendMomentum.shortTrend === "bearish"
        ? "短线偏弱"
        : "短线震荡";
  const pricingText =
    derivativesSentiment.premiumRegime === "expensive"
      ? "期权偏贵"
      : derivativesSentiment.premiumRegime === "cheap"
        ? "期权偏便宜"
        : "期权定价中性";
  const levelText =
    keyLevels.resistance != null && currentPrice != null && currentPrice < keyLevels.resistance
      ? `上方先看 ${Math.round(keyLevels.resistance).toLocaleString()}`
      : keyLevels.support != null
        ? `下方关注 ${Math.round(keyLevels.support).toLocaleString()}`
        : "关键位仍需观察";

  return {
    title: `${trendText}，${pricingText}`,
    summary: `${trendMomentum.summary}。${buildLevelSummary(currentPrice, keyLevels)}。${derivativesSentiment.summary}`,
    tags: [
      trendText,
      pricingText,
      derivativesSentiment.skewBias === "defensive" ? "期权偏防守" : derivativesSentiment.skewBias === "risk-on" ? "期权偏进攻" : "情绪中性",
      levelText,
    ],
    riskNote: buildRiskNote(trendMomentum, keyLevels, derivativesSentiment),
  };
}

function buildTrendSummary(
  shortTrend: TrendDirection,
  mediumTrend: TrendDirection,
  return7d: number | null,
  return30d: number | null,
): string {
  if (shortTrend === "neutral" && mediumTrend === "neutral") {
    return "价格暂时更像区间震荡，方向没有明显单边优势";
  }

  if (shortTrend === "bullish" && mediumTrend === "bullish") {
    return `短中期都偏强，近 7 天 ${formatSignedPercent(return7d)}、近 30 天 ${formatSignedPercent(return30d)}`;
  }

  if (shortTrend === "bearish" && mediumTrend === "bearish") {
    return `短中期都偏弱，近 7 天 ${formatSignedPercent(return7d)}、近 30 天 ${formatSignedPercent(return30d)}`;
  }

  if (shortTrend === "bullish") {
    return `短线有反弹迹象，但中线趋势还没完全转强，近 7 天 ${formatSignedPercent(return7d)}`;
  }

  if (shortTrend === "bearish") {
    return `短线在回落，中线方向还需要继续确认，近 7 天 ${formatSignedPercent(return7d)}`;
  }

  return "趋势信号暂时不够一致。";
}

function buildDerivativesSummary(
  premiumRegime: PremiumRegime,
  skewBias: SkewBias,
  termStructureBias: TermStructureBias,
): string {
  const pricing = premiumRegime === "expensive" ? "当前期权整体偏贵" : premiumRegime === "cheap" ? "当前期权整体不算贵" : "当前期权定价大体正常";
  const skew = skewBias === "defensive" ? "put 保护需求更强" : skewBias === "risk-on" ? "call 一侧更活跃" : "近月 skew 比较平";
  const term = termStructureBias === "short-stress" ? "短端 IV 更高，说明短线更紧张" : termStructureBias === "forward-rich" ? "远端 IV 更高，市场更在意后续波动" : "期限结构比较平";
  return `${pricing}，${skew}，${term}`;
}

function buildLevelSummary(currentPrice: number | null, keyLevels: KeyLevelsAnalysis): string {
  if (currentPrice == null || (keyLevels.support == null && keyLevels.resistance == null)) {
    return "当前关键价位信息不足";
  }

  if (keyLevels.resistance != null && currentPrice < keyLevels.resistance) {
    return `上方最近压力位在 ${Math.round(keyLevels.resistance).toLocaleString()}`;
  }

  if (keyLevels.support != null && currentPrice > keyLevels.support) {
    return `下方最近支撑位在 ${Math.round(keyLevels.support).toLocaleString()}`;
  }

  return "当前价格就在关键位附近";
}

function buildSupportPlain(support: number | null, source: KeyLevelsAnalysis["supportSource"]): string {
  if (support == null) {
    return "下方暂时还没有足够清楚的支撑参考位。";
  }

  if (source === "oi-put") {
    return `下方 ${Math.round(support).toLocaleString()} 更像一层垫子，因为 put 仓位更集中，价格跌到这附近时更容易先被接住，但不代表一定守得住。`;
  }

  if (source === "range-low") {
    return `下方 ${Math.round(support).toLocaleString()} 是最近 30 天更像下沿的位置，说明市场之前跌到这附近时，通常就不太愿意继续往下砸。`;
  }

  return "下方支撑还不够明确。";
}

function buildResistancePlain(resistance: number | null, source: KeyLevelsAnalysis["resistanceSource"]): string {
  if (resistance == null) {
    return "上方暂时还没有足够清楚的压力参考位。";
  }

  if (source === "oi-call") {
    return `上方 ${Math.round(resistance).toLocaleString()} 更像一堵墙，因为 call 仓位更集中，价格涨到这附近时常见情况是先放慢，不一定一次就能冲过去。`;
  }

  if (source === "range-high") {
    return `上方 ${Math.round(resistance).toLocaleString()} 是最近 30 天更像上沿的位置，说明市场此前涨到这附近时，通常就容易遇到抛压。`;
  }

  return "上方压力还不够明确。";
}

function buildDistancePlain(supportDistancePercent: number | null, resistanceDistancePercent: number | null): string {
  const nearestDistance = [
    supportDistancePercent != null ? Math.abs(supportDistancePercent) : null,
    resistanceDistancePercent != null ? Math.abs(resistanceDistancePercent) : null,
  ].filter((value): value is number => value != null).sort((left, right) => left - right)[0];

  if (nearestDistance == null) {
    return "现在还判断不出离关键位到底近不近。";
  }

  if (nearestDistance <= 2) {
    return `离现价已经很近了，短线再走一点就可能碰到，今天到明天就值得重点盯。`;
  }

  if (nearestDistance <= 5) {
    return `离现价不算特别近，但也不远，正常波动再走一段就可能测试到。`;
  }

  return `离现价还有一段距离，暂时不是眼前第一分钟就要处理的问题。`;
}

function buildOiZonePlain(oiSupportStrike: number | null, oiResistanceStrike: number | null): string {
  if (oiSupportStrike == null && oiResistanceStrike == null) {
    return "期权仓位暂时没有形成特别明显的热区。";
  }

  if (oiSupportStrike != null && oiResistanceStrike != null) {
    return `期权热区大致夹在 ${Math.round(oiSupportStrike).toLocaleString()} 和 ${Math.round(oiResistanceStrike).toLocaleString()} 之间，价格靠近这些位置时，更容易来回拉扯，不一定走得很顺。`;
  }

  if (oiSupportStrike != null) {
    return `下方 ${Math.round(oiSupportStrike).toLocaleString()} 一带是 put 仓位更集中的地方，市场通常会更在意这里的防守。`;
  }

  return `上方 ${Math.round(oiResistanceStrike!).toLocaleString()} 一带是 call 仓位更集中的地方，价格靠近这里时更容易先遇到阻力。`;
}

function buildActionHint(currentPrice: number | null, support: number | null, resistance: number | null): string {
  if (currentPrice == null) {
    return "先等现价稳定出来，再看关键位判断。";
  }

  if (resistance != null && currentPrice < resistance) {
    return `接下来先看 ${Math.round(resistance).toLocaleString()} 能不能一次站上；如果冲不过去，短线更容易先转成震荡。`;
  }

  if (support != null && currentPrice > support) {
    return `如果价格回落，先看 ${Math.round(support).toLocaleString()} 附近有没有明显承接；守不住的话，短线会更弱。`;
  }

  return "先看价格会不会继续靠近下一个关键位。";
}

function buildRiskNote(
  trendMomentum: TrendMomentumAnalysis,
  keyLevels: KeyLevelsAnalysis,
  derivativesSentiment: DerivativesSentimentAnalysis,
): string {
  if (derivativesSentiment.premiumRegime === "expensive" && trendMomentum.shortTrend === "bullish") {
    return "短线偏强但权利金已经不便宜，追高前先看压力位附近是否放缓。";
  }

  if (trendMomentum.shortTrend === "bearish" && keyLevels.support != null) {
    return `如果继续走弱，要重点看 ${Math.round(keyLevels.support).toLocaleString()} 一带能不能守住。`;
  }

  return "当前更适合先看趋势和关键位，再决定是追方向还是做区间。";
}

function toDailyCloses(points: HistoricalPricePoint[]): HistoricalPricePoint[] {
  const byDay = new Map<string, HistoricalPricePoint>();

  for (const point of points) {
    const dayKey = new Date(point.timestamp).toISOString().slice(0, 10);
    const existing = byDay.get(dayKey);
    if (!existing || point.timestamp > existing.timestamp) {
      byDay.set(dayKey, point);
    }
  }

  return Array.from(byDay.values()).sort((left, right) => left.timestamp - right.timestamp);
}

function calculateReturn(currentPrice: number, closes: number[], lookbackDays: number): number | null {
  if (closes.length <= lookbackDays) {
    return null;
  }
  const basePrice = closes[closes.length - lookbackDays - 1];
  if (!basePrice || basePrice <= 0) {
    return null;
  }
  return roundTo(((currentPrice - basePrice) / basePrice) * 100, 1);
}

function calculateSma(values: number[], window: number): number | null {
  if (values.length < window) {
    return null;
  }
  const slice = values.slice(-window);
  return roundTo(slice.reduce((sum, value) => sum + value, 0) / slice.length, 0);
}

function classifyTrend(returnValue: number | null, distanceFromSma: number | null): TrendDirection {
  if (returnValue == null || distanceFromSma == null) {
    return "neutral";
  }

  if (returnValue >= 1.5 && distanceFromSma >= 1.5) {
    return "bullish";
  }

  if (returnValue <= -1.5 && distanceFromSma <= -1.5) {
    return "bearish";
  }

  return "neutral";
}

function findHighestStrike(options: OptionContract[]): number | null {
  if (options.length === 0) {
    return null;
  }

  return options
    .filter((option) => option.strike > 0)
    .sort((left, right) => (right.openInterest + right.volume) - (left.openInterest + left.volume))[0]?.strike ?? null;
}

function findNearestExpiry(options: OptionContract[]): number | null {
  const timestamps = [...new Set(options.map((option) => option.expirationTimestamp))].filter((ts) => ts > Date.now());
  return timestamps.sort((left, right) => left - right)[0] ?? null;
}

function average(values: number[]): number | null {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) {
    return null;
  }
  return roundTo(valid.reduce((sum, value) => sum + value, 0) / valid.length, 1);
}

function distancePercent(target: number | null, base: number | null): number | null {
  if (target == null || base == null || base <= 0) {
    return null;
  }
  return roundTo(((target - base) / base) * 100, 1);
}

function formatSignedPercent(value: number | null): string {
  if (value == null) {
    return "--";
  }
  return `${value >= 0 ? "+" : ""}${value}%`;
}
