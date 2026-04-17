import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeDerivativesSentiment,
  analyzeMarketOverview,
  analyzeTrendMomentum,
  extractKeyLevels,
  recommendStrategyMode,
} from "../lib/domain/market-analysis";
import type { HistoricalPricePoint, OptionContract, VolatilityAnalysis } from "../lib/types/option";

const day = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 0, 1);

function buildHistory(prices: number[]): HistoricalPricePoint[] {
  return prices.map((price, index) => ({
    timestamp: start + index * day,
    price,
  }));
}

function buildOption(partial: Partial<OptionContract>): OptionContract {
  return {
    instrumentName: partial.instrumentName ?? "BTC-31JAN26-78000-C",
    optionType: partial.optionType ?? "call",
    strike: partial.strike ?? 78_000,
    expirationCode: partial.expirationCode ?? "31JAN26",
    expiration: partial.expiration ?? "1月31日 08:00",
    expirationTimestamp: partial.expirationTimestamp ?? (Date.now() + 7 * day),
    daysToExpiry: partial.daysToExpiry ?? 7,
    bidPrice: partial.bidPrice ?? 0.005,
    askPrice: partial.askPrice ?? 0.006,
    markPrice: partial.markPrice ?? 0.0055,
    midPrice: partial.midPrice ?? 0.0055,
    underlyingPrice: partial.underlyingPrice ?? 75_000,
    markIv: partial.markIv ?? 48,
    interestRate: partial.interestRate ?? 0,
    openInterest: partial.openInterest ?? 100,
    volume: partial.volume ?? 30,
    delta: partial.delta ?? 0.2,
    otmPercent: partial.otmPercent ?? 4,
    premiumReturnPercent: partial.premiumReturnPercent ?? 0.6,
    annualizedYieldPercent: partial.annualizedYieldPercent ?? 24,
    premiumUsdPerBtc: partial.premiumUsdPerBtc ?? 420,
  };
}

function buildVolatility(partial: Partial<VolatilityAnalysis> = {}): VolatilityAnalysis {
  return {
    atmIv: partial.atmIv ?? 52,
    atmLabel: partial.atmLabel ?? "52%",
    ivLevel: partial.ivLevel ?? "high",
    termStructure: partial.termStructure ?? [
      { label: "近月", daysToExpiry: 7, iv: 58 },
      { label: "远月", daysToExpiry: 30, iv: 50 },
    ],
    skew: partial.skew ?? [
      { strike: 72_000, optionType: "put", otmPercent: 4, iv: 61 },
      { strike: 78_000, optionType: "call", otmPercent: 4, iv: 49 },
    ],
    ivMin: partial.ivMin ?? 42,
    ivMax: partial.ivMax ?? 64,
    ivMedian: partial.ivMedian ?? 50,
    historicalVol7d: partial.historicalVol7d ?? 38,
    historicalVol30d: partial.historicalVol30d ?? 40,
    historicalVol90d: partial.historicalVol90d ?? 36,
    ivHvSpread30d: partial.ivHvSpread30d ?? 12,
    verdict: partial.verdict ?? "现在期权偏贵，收租卖方更舒服。",
    summary: partial.summary ?? "当前隐含波动率高于 30 天历史波动率。",
  };
}

test("趋势动量分析能识别明显上涨趋势", () => {
  const history = buildHistory(Array.from({ length: 120 }, (_, index) => 60_000 + index * 180));
  const analysis = analyzeTrendMomentum(82_000, history);

  assert.equal(analysis.shortTrend, "bullish");
  assert.equal(analysis.mediumTrend, "bullish");
  assert.ok((analysis.return7d ?? 0) > 0);
  assert.ok((analysis.return30d ?? 0) > 0);
  assert.ok((analysis.priceVsSma20Percent ?? 0) > 0);
  assert.ok(analysis.summary.includes("偏强") || analysis.summary.includes("上涨"));
});

test("趋势动量分析会把窄幅震荡识别为中性", () => {
  const history = buildHistory(Array.from({ length: 120 }, (_, index) => 75_000 + ((index % 4) - 2) * 120));
  const analysis = analyzeTrendMomentum(75_050, history);

  assert.equal(analysis.shortTrend, "neutral");
  assert.equal(analysis.mediumTrend, "neutral");
  assert.ok(analysis.summary.includes("震荡") || analysis.summary.includes("中性"));
});

test("趋势动量分析在数据不足时优雅降级", () => {
  const analysis = analyzeTrendMomentum(75_000, buildHistory([74_800, 75_000, 75_200]));

  assert.equal(analysis.shortTrend, "neutral");
  assert.equal(analysis.mediumTrend, "neutral");
  assert.equal(analysis.return30d, null);
  assert.equal(analysis.sma50, null);
});

test("关键价位会优先识别最近的支撑和压力，并生成大白话解释", () => {
  const history = buildHistory([
    ...Array.from({ length: 60 }, (_, index) => 70_000 + index * 120),
    76_000,
    77_000,
    78_500,
    77_800,
    76_900,
    75_800,
    74_900,
    73_800,
  ]);
  const options = [
    buildOption({ optionType: "put", strike: 72_000, openInterest: 880, volume: 120, delta: -0.18, otmPercent: 4 }),
    buildOption({ instrumentName: "BTC-31JAN26-78000-C", optionType: "call", strike: 78_000, openInterest: 920, volume: 150, delta: 0.21, otmPercent: 4 }),
  ];

  const levels = extractKeyLevels(75_000, history, options);

  assert.equal(levels.support, 72_000);
  assert.equal(levels.resistance, 78_000);
  assert.ok((levels.supportDistancePercent ?? 0) < 0);
  assert.ok((levels.resistanceDistancePercent ?? 0) > 0);
  assert.equal(levels.oiSupportStrike, 72_000);
  assert.equal(levels.oiResistanceStrike, 78_000);
  assert.equal(levels.supportSource, "oi-put");
  assert.equal(levels.resistanceSource, "oi-call");
  assert.ok(levels.supportPlain.includes("垫子") || levels.supportPlain.includes("接住"));
  assert.ok(levels.resistancePlain.includes("墙") || levels.resistancePlain.includes("放慢"));
  assert.ok(levels.distancePlain.includes("现价") || levels.distancePlain.includes("很快"));
  assert.ok(levels.oiZonePlain.includes("仓位") || levels.oiZonePlain.includes("拉扯"));
  assert.ok(levels.actionHint.length > 0);
});

test("关键价位在没有期权热区时仍会回退到历史区间，并说明来源", () => {
  const history = buildHistory(Array.from({ length: 100 }, (_, index) => 68_000 + index * 90));
  const levels = extractKeyLevels(75_000, history, []);

  assert.ok(levels.support != null);
  assert.ok(levels.resistance != null);
  assert.equal(levels.oiSupportStrike, null);
  assert.equal(levels.oiResistanceStrike, null);
  assert.equal(levels.supportSource, "range-low");
  assert.equal(levels.resistanceSource, "range-high");
  assert.ok(levels.supportPlain.includes("30天") || levels.supportPlain.includes("下沿"));
  assert.ok(levels.resistancePlain.includes("30天") || levels.resistancePlain.includes("上沿"));
});

test("衍生品情绪会识别高 IV、put skew 和短端紧张", () => {
  const sentiment = analyzeDerivativesSentiment(buildVolatility(), [
    buildOption({ optionType: "put", strike: 72_000, markIv: 61, openInterest: 900, volume: 200, delta: -0.2 }),
    buildOption({ instrumentName: "BTC-31JAN26-78000-C", optionType: "call", strike: 78_000, markIv: 49, openInterest: 700, volume: 160, delta: 0.18 }),
  ]);

  assert.equal(sentiment.premiumRegime, "expensive");
  assert.equal(sentiment.skewBias, "defensive");
  assert.equal(sentiment.termStructureBias, "short-stress");
  assert.ok((sentiment.putCallSkewSpread ?? 0) > 0);
  assert.ok(sentiment.summary.includes("偏贵") || sentiment.summary.includes("防守"));
});

test("衍生品情绪在波动率信号温和时给出中性判断", () => {
  const sentiment = analyzeDerivativesSentiment(buildVolatility({
    atmIv: 44,
    atmLabel: "44%",
    ivLevel: "normal",
    ivHvSpread30d: 2,
    termStructure: [
      { label: "近月", daysToExpiry: 7, iv: 45 },
      { label: "远月", daysToExpiry: 30, iv: 46 },
    ],
    skew: [
      { strike: 72_000, optionType: "put", otmPercent: 4, iv: 47 },
      { strike: 78_000, optionType: "call", otmPercent: 4, iv: 46 },
    ],
  }), []);

  assert.equal(sentiment.premiumRegime, "fair");
  assert.equal(sentiment.skewBias, "balanced");
  assert.equal(sentiment.termStructureBias, "flat");
});

test("市场概览会整合市场简报、趋势、关键位和衍生品情绪", () => {
  const history = buildHistory(Array.from({ length: 120 }, (_, index) => 60_000 + index * 180));
  const options = [
    buildOption({ optionType: "put", strike: 76_000, openInterest: 1_100, volume: 240, delta: -0.18, otmPercent: 3 }),
    buildOption({ instrumentName: "BTC-31JAN26-84000-C", optionType: "call", strike: 84_000, openInterest: 980, volume: 210, delta: 0.19, otmPercent: 3 }),
  ];
  const overview = analyzeMarketOverview({
    currentPrice: 82_000,
    historicalPrices: history,
    options,
    volatility: buildVolatility(),
  });

  assert.ok(overview.brief.title.length > 0);
  assert.ok(overview.brief.summary.length > 0);
  assert.ok(overview.brief.tags.length >= 3);
  assert.equal(overview.trendMomentum.shortTrend, "bullish");
  assert.ok(overview.keyLevels.support != null);
  assert.ok(overview.keyLevels.resistance != null);
  assert.equal(overview.derivativesSentiment.premiumRegime, "expensive");
});

test("市场环境偏强且期权偏贵时会建议卖看涨", () => {
  const advice = recommendStrategyMode({
    trendMomentum: {
      shortTrend: "bullish",
      mediumTrend: "bullish",
      return7d: 8,
      return30d: 18,
      return90d: 32,
      sma20: 78_000,
      sma50: 73_000,
      sma90: 68_000,
      priceVsSma20Percent: 4.5,
      priceVsSma50Percent: 8.2,
      summary: "短中期都偏强。",
    },
    keyLevels: {
      support: 76_000,
      resistance: 84_000,
      supportDistancePercent: -4,
      resistanceDistancePercent: 3,
      rangeLow30d: 74_000,
      rangeHigh30d: 84_000,
      oiSupportStrike: 76_000,
      oiResistanceStrike: 84_000,
      supportSource: "oi-put",
      resistanceSource: "oi-call",
      supportPlain: "",
      resistancePlain: "",
      distancePlain: "",
      oiZonePlain: "",
      actionHint: "",
    },
    derivativesSentiment: {
      premiumRegime: "expensive",
      skewBias: "balanced",
      termStructureBias: "flat",
      putCallSkewSpread: 1.2,
      summary: "当前期权整体偏贵。",
    },
  });

  assert.equal(advice.mode, "covered-call");
  assert.equal(advice.confidence, "high");
  assert.ok(advice.summary.includes("卖看涨") || advice.label.includes("卖看涨"));
  assert.ok(advice.reasons.length >= 2);
});

test("市场偏震荡且下方有支撑时会建议卖看跌接货", () => {
  const advice = recommendStrategyMode({
    trendMomentum: {
      shortTrend: "neutral",
      mediumTrend: "neutral",
      return7d: -0.8,
      return30d: 1.2,
      return90d: 9,
      sma20: 75_000,
      sma50: 74_500,
      sma90: 72_000,
      priceVsSma20Percent: 0.5,
      priceVsSma50Percent: 1,
      summary: "价格更像震荡。",
    },
    keyLevels: {
      support: 72_000,
      resistance: 79_000,
      supportDistancePercent: -2.2,
      resistanceDistancePercent: 7.4,
      rangeLow30d: 71_000,
      rangeHigh30d: 79_000,
      oiSupportStrike: 72_000,
      oiResistanceStrike: 79_000,
      supportSource: "oi-put",
      resistanceSource: "oi-call",
      supportPlain: "",
      resistancePlain: "",
      distancePlain: "",
      oiZonePlain: "",
      actionHint: "",
    },
    derivativesSentiment: {
      premiumRegime: "expensive",
      skewBias: "defensive",
      termStructureBias: "flat",
      putCallSkewSpread: 6.1,
      summary: "put 保护需求更强。",
    },
  });

  assert.equal(advice.mode, "cash-secured-put");
  assert.ok(advice.summary.includes("卖看跌") || advice.label.includes("卖看跌"));
});

test("市场偏强且期权不贵时会建议合成现货", () => {
  const advice = recommendStrategyMode({
    trendMomentum: {
      shortTrend: "bullish",
      mediumTrend: "bullish",
      return7d: 6.5,
      return30d: 14,
      return90d: 28,
      sma20: 76_000,
      sma50: 72_000,
      sma90: 68_000,
      priceVsSma20Percent: 3.8,
      priceVsSma50Percent: 6.4,
      summary: "趋势偏强。",
    },
    keyLevels: {
      support: 74_000,
      resistance: 86_000,
      supportDistancePercent: -4,
      resistanceDistancePercent: 10,
      rangeLow30d: 73_000,
      rangeHigh30d: 86_000,
      oiSupportStrike: 74_000,
      oiResistanceStrike: 86_000,
      supportSource: "oi-put",
      resistanceSource: "oi-call",
      supportPlain: "",
      resistancePlain: "",
      distancePlain: "",
      oiZonePlain: "",
      actionHint: "",
    },
    derivativesSentiment: {
      premiumRegime: "fair",
      skewBias: "risk-on",
      termStructureBias: "flat",
      putCallSkewSpread: -4.5,
      summary: "call 一侧更活跃。",
    },
  });

  assert.equal(advice.mode, "synthetic-long");
  assert.ok(advice.summary.includes("合成现货") || advice.label.includes("合成现货"));
});

test("市场偏弱且短端紧张时会建议先别急着开仓", () => {
  const advice = recommendStrategyMode({
    trendMomentum: {
      shortTrend: "bearish",
      mediumTrend: "bearish",
      return7d: -7,
      return30d: -16,
      return90d: -22,
      sma20: 77_000,
      sma50: 80_000,
      sma90: 84_000,
      priceVsSma20Percent: -4.2,
      priceVsSma50Percent: -8.6,
      summary: "短中期都偏弱。",
    },
    keyLevels: {
      support: 70_000,
      resistance: 76_000,
      supportDistancePercent: -3,
      resistanceDistancePercent: 5,
      rangeLow30d: 69_000,
      rangeHigh30d: 76_000,
      oiSupportStrike: 70_000,
      oiResistanceStrike: 76_000,
      supportSource: "oi-put",
      resistanceSource: "oi-call",
      supportPlain: "",
      resistancePlain: "",
      distancePlain: "",
      oiZonePlain: "",
      actionHint: "",
    },
    derivativesSentiment: {
      premiumRegime: "expensive",
      skewBias: "defensive",
      termStructureBias: "short-stress",
      putCallSkewSpread: 7.2,
      summary: "短端 IV 更高。",
    },
  });

  assert.equal(advice.mode, "wait");
  assert.equal(advice.confidence, "high");
  assert.ok(advice.label.includes("先别急") || advice.summary.includes("防守") || advice.riskNote.includes("下跌"));
});
