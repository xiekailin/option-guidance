import { DERIBIT_REVALIDATE_SECONDS, DeribitApiError, fetchOptionChain } from "@/lib/market/deribit";
import type { ApiErrorResponse, OptionsChainResponse } from "@/lib/types/option";

export const revalidate = 20;

export async function GET() {
  try {
    const options = await fetchOptionChain();
    const payload: OptionsChainResponse = {
      source: "Deribit public API",
      updatedAt: new Date().toISOString(),
      options,
    };

    return Response.json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${DERIBIT_REVALIDATE_SECONDS}, stale-while-revalidate=${DERIBIT_REVALIDATE_SECONDS * 2}`,
      },
    });
  } catch (error) {
    const response = toApiErrorResponse(error);
    return Response.json(response.body satisfies ApiErrorResponse, { status: response.status });
  }
}

function toApiErrorResponse(error: unknown) {
  if (error instanceof DeribitApiError) {
    if (error.code === "UPSTREAM_TIMEOUT") {
      return {
        status: 504,
        body: { code: error.code, message: "Deribit 期权链请求超时，请稍后再试。" },
      };
    }

    if (error.code === "UPSTREAM_BAD_STATUS") {
      return {
        status: 502,
        body: { code: error.code, message: "暂时无法获取期权链，请稍后再试。" },
      };
    }

    return {
      status: 502,
      body: { code: error.code, message: "上游期权链数据格式异常，请稍后再试。" },
    };
  }

  return {
    status: 500,
    body: { code: "INTERNAL_ERROR", message: "暂时无法获取期权链，请稍后再试。" },
  };
}
