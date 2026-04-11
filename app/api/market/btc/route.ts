import { DERIBIT_REVALIDATE_SECONDS, DeribitApiError, fetchBtcIndexPrice } from "@/lib/market/deribit";
import type { ApiErrorResponse, MarketTickerResponse } from "@/lib/types/option";

export const revalidate = 20;

export async function GET() {
  try {
    const price = await fetchBtcIndexPrice();
    const payload: MarketTickerResponse = {
      price,
      source: "Deribit public API",
      updatedAt: new Date().toISOString(),
    };

    return Response.json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${DERIBIT_REVALIDATE_SECONDS}, stale-while-revalidate=${DERIBIT_REVALIDATE_SECONDS * 2}`,
      },
    });
  } catch (error) {
    const response = toApiErrorResponse(error, "暂时无法获取 BTC 价格，请稍后再试。");
    return Response.json(response.body satisfies ApiErrorResponse, { status: response.status });
  }
}

function toApiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof DeribitApiError) {
    if (error.code === "UPSTREAM_TIMEOUT") {
      return {
        status: 504,
        body: { code: error.code, message: "Deribit 请求超时，请稍后再试。" },
      };
    }

    if (error.code === "UPSTREAM_BAD_STATUS") {
      return {
        status: 502,
        body: { code: error.code, message: fallbackMessage },
      };
    }

    return {
      status: 502,
      body: { code: error.code, message: "上游行情数据格式异常，请稍后再试。" },
    };
  }

  return {
    status: 500,
    body: { code: "INTERNAL_ERROR", message: fallbackMessage },
  };
}
