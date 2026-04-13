import { fetchBtcHistoricalPrices, fetchBtcIndexPrice, fetchOptionChain } from "./deribit";
import type { HistoricalPricePoint, MarketTickerResponse, OptionsChainResponse } from "../types/option";

export async function fetchBtcTicker(): Promise<MarketTickerResponse> {
  const price = await fetchBtcIndexPrice();
  return {
    price,
    source: "Deribit public API",
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchOptionsChain(): Promise<OptionsChainResponse> {
  const options = await fetchOptionChain();
  return {
    source: "Deribit public API",
    updatedAt: new Date().toISOString(),
    options,
  };
}

export async function fetchBtcHistoricalSeries(): Promise<{
  points: HistoricalPricePoint[];
  source: string;
  updatedAt: string;
}> {
  const points = await fetchBtcHistoricalPrices();
  return {
    points,
    source: "Deribit public API",
    updatedAt: new Date().toISOString(),
  };
}
