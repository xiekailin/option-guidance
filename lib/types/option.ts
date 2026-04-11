export type StrategyType = "covered-call" | "cash-secured-put" | "synthetic-long";

export type CyclePreference = "weekly" | "monthly";

export type RiskTolerance = "conservative" | "balanced" | "aggressive";

export type RecommendationLevel = "优先考虑" | "可接受" | "谨慎考虑";

export type RecommendationTone = "safe" | "balanced" | "aggressive";

export interface RecommendationInput {
  strategy: StrategyType;
  availableBtc: number;
  availableCashUsd: number;
  cycle: CyclePreference;
  riskTolerance: RiskTolerance;
  acceptAssignment: boolean;
  minPremiumPercent: number;
}

export interface SyntheticLongPair {
  expirationCode: string;
  expiration: string;
  expirationTimestamp: number;
  daysToExpiry: number;
  underlyingPrice: number | null;
  call: OptionContract;
  put: OptionContract;
  netPremiumUsdPerMinContract: number | null;
  premiumBalanceUsd: number | null;
  downsideObligationUsd: number;
}

export interface SyntheticLongRecommendation {
  pair: SyntheticLongPair;
  score: number;
  level: RecommendationLevel;
  tone: RecommendationTone;
  maxLots: number;
  maxTradeAmountBtc: number;
  summary: string;
  reasons: string[];
  risks: string[];
  algorithmTags: string[];
  unsuitableScenarios: string[];
  expiryPayoff: ExpiryPayoff;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
}

export interface MarketTickerResponse {
  price: number;
  source: string;
  updatedAt: string;
}

export interface OptionContract {
  instrumentName: string;
  optionType: "call" | "put";
  strike: number;
  expirationCode: string;
  expiration: string;
  expirationTimestamp: number;
  daysToExpiry: number;
  bidPrice: number | null;
  askPrice: number | null;
  markPrice: number | null;
  midPrice: number | null;
  underlyingPrice: number | null;
  markIv: number | null;
  interestRate: number;
  openInterest: number;
  volume: number;
  delta: number | null;
  otmPercent: number | null;
  premiumReturnPercent: number | null;
  annualizedYieldPercent: number | null;
  premiumUsdPerBtc: number | null;
}

export interface OptionsChainResponse {
  source: string;
  updatedAt: string;
  options: OptionContract[];
}

export interface RecommendationScoreBreakdownItem {
  key:
    | "delta-fit"
    | "cycle-fit"
    | "premium"
    | "safety"
    | "liquidity"
    | "assignment";
  label: string;
  scorePercent: number;
  weightPercent: number;
  contribution: number;
  explanation: string;
}

export interface RecommendationScenario {
  title: string;
  description: string;
}

export interface ExpiryPayoffScenario {
  title: string;
  description: string;
  amountUsd: number | null;
}

export interface ExpiryPayoff {
  premiumPerContractUsd: number | null;
  breakEvenPrice: number | null;
  /** 估算月收入：单期权利金 × (30 / 剩余天数)，基于不被行权假设 */
  estimatedMonthlyUsd: number | null;
  /** 估算年收入：单期权利金 × (365 / 剩余天数)，基于不被行权假设 */
  estimatedAnnualUsd: number | null;
  scenarios: ExpiryPayoffScenario[];
}

export interface Recommendation {
  contract: OptionContract;
  strategy: StrategyType;
  score: number;
  level: RecommendationLevel;
  tone: RecommendationTone;
  maxLots: number;
  maxTradeAmountBtc: number;
  premiumPerMinContractBtc: number;
  premiumPerMinContractUsd: number | null;
  effectiveBuyCostPerBtc: number | null;
  summary: string;
  algorithmTags: string[];
  reasons: string[];
  risks: string[];
  scoreBreakdown: RecommendationScoreBreakdownItem[];
  scenarios: RecommendationScenario[];
  unsuitableScenarios: string[];
  assignmentText: string;
  expiryPayoff: ExpiryPayoff;
}

// --- Payoff Calculator ---

export interface PayoffPoint {
  priceAtExpiry: number;
  pnl: number;
}

export interface PayoffLeg {
  direction: "long" | "short";
  optionType: "call" | "put";
  strike: number;
  premium: number;
  contractSize: number;
}

export interface PayoffCurve {
  points: PayoffPoint[];
  maxProfit: number;
  maxLoss: number;
  breakEvenPrice: number | null;
}

// --- Volatility Analysis ---

export interface TermStructurePoint {
  label: string;
  daysToExpiry: number;
  iv: number;
}

export interface SkewPoint {
  strike: number;
  optionType: "call" | "put";
  otmPercent: number;
  iv: number;
}

export interface VolatilityAnalysis {
  atmIv: number | null;
  atmLabel: string;
  ivLevel: "high" | "normal" | "low";
  termStructure: TermStructurePoint[];
  skew: SkewPoint[];
  ivMin: number;
  ivMax: number;
  ivMedian: number;
  summary: string;
}
