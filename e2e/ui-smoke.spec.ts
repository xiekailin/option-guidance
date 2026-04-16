import { expect, test, type Page } from "@playwright/test";

const UNDERLYING_PRICE = 74_655.47;
const APP_ROUTE = "/option-guidance/";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

interface MockControls {
  delayMs: number;
}

interface MockOptionSummaryInput {
  daysAhead: number;
  strike: number;
  optionType: "call" | "put";
  markPrice: number;
  markIv: number;
  openInterest: number;
  volume: number;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatExpirationCode(daysAhead: number) {
  const date = new Date();
  date.setUTCHours(8, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysAhead);

  const day = String(date.getUTCDate());
  const month = MONTHS[date.getUTCMonth()];
  const year = String(date.getUTCFullYear()).slice(-2);

  return `${day}${month}${year}`;
}

function roundTo(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildOptionSummary({
  daysAhead,
  strike,
  optionType,
  markPrice,
  markIv,
  openInterest,
  volume,
}: MockOptionSummaryInput) {
  return {
    instrument_name: `BTC-${formatExpirationCode(daysAhead)}-${strike}-${optionType === "call" ? "C" : "P"}`,
    bid_price: roundTo(markPrice * 0.97),
    ask_price: roundTo(markPrice * 1.03),
    mark_price: markPrice,
    mid_price: markPrice,
    open_interest: openInterest,
    volume,
    mark_iv: markIv,
    underlying_price: UNDERLYING_PRICE,
    interest_rate: 0,
  };
}

function buildOptionChain() {
  return [
    buildOptionSummary({
      daysAhead: 8,
      strike: 80_000,
      optionType: "call",
      markPrice: 0.0068,
      markIv: 55,
      openInterest: 1_400,
      volume: 390,
    }),
    buildOptionSummary({
      daysAhead: 8,
      strike: 81_000,
      optionType: "call",
      markPrice: 0.0061,
      markIv: 55,
      openInterest: 980,
      volume: 280,
    }),
    buildOptionSummary({
      daysAhead: 8,
      strike: 70_000,
      optionType: "put",
      markPrice: 0.0068,
      markIv: 55,
      openInterest: 1_300,
      volume: 360,
    }),
    buildOptionSummary({
      daysAhead: 8,
      strike: 69_500,
      optionType: "put",
      markPrice: 0.0063,
      markIv: 55,
      openInterest: 1_050,
      volume: 300,
    }),
    buildOptionSummary({
      daysAhead: 6,
      strike: 75_600,
      optionType: "call",
      markPrice: 0.0072,
      markIv: 15,
      openInterest: 1_020,
      volume: 260,
    }),
    buildOptionSummary({
      daysAhead: 6,
      strike: 73_400,
      optionType: "put",
      markPrice: 0.0073,
      markIv: 20,
      openInterest: 1_010,
      volume: 245,
    }),
  ];
}

function buildHistoricalSeries() {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, index) => [
    now - (29 - index) * 24 * 60 * 60 * 1000,
    roundTo(UNDERLYING_PRICE - 1_500 + index * 40, 2),
  ]);
}

async function mockDeribit(page: Page, controls: MockControls) {
  await page.route("https://www.deribit.com/api/v2/public/**", async (route) => {
    if (controls.delayMs > 0) {
      await wait(controls.delayMs);
    }

    const url = route.request().url();

    if (url.includes("/get_index_price?index_name=btc_usd")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { index_price: UNDERLYING_PRICE } }),
      });
      return;
    }

    if (url.includes("/get_book_summary_by_currency?currency=BTC&kind=option")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: buildOptionChain() }),
      });
      return;
    }

    if (url.includes("/get_index_chart_data?index_name=btc_usd&range=1y")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: buildHistoricalSeries() }),
      });
      return;
    }

    await route.continue();
  });
}

test("covered call 主路径可用，并且刷新时会出现验证动画", async ({ page }) => {
  const controls: MockControls = { delayMs: 0 };
  await mockDeribit(page, controls);

  await page.goto(APP_ROUTE);

  await expect(page.getByRole("heading", { name: "BTC 期权收租指导" })).toBeVisible();
  await expect(page.getByText("输入你的条件")).toBeVisible();
  await expect(page.getByText("BTC 现价")).toBeVisible();
  await expect(page.locator('button[title="刷新数据"]')).toBeVisible();

  await expect(page.getByRole("button", { name: "卖看涨", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "卖看跌", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "合成现货", exact: true })).toBeVisible();

  await expect(page.getByText("当前首选建议")).toBeVisible();
  await expect(page.getByText("盈亏平衡价")).toBeVisible();

  await expect(page.getByRole("columnheader", { name: "合约" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "执行价" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "到期" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "单张租金" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "等级" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "操作" })).toBeVisible();

  const detailButton = page.getByRole("button", { name: "详情" }).first();
  await expect(detailButton).toBeVisible();
  await detailButton.click();

  const detailDrawer = page.getByRole("dialog", { name: "期权推荐详情" });
  await expect(detailDrawer).toBeVisible();
  await expect(detailDrawer.getByText("评分拆解")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(detailDrawer).toBeHidden();

  controls.delayMs = 350;
  const refreshButton = page.locator('button[title="刷新数据"]');
  const refreshIcon = refreshButton.locator("svg");

  await refreshButton.click();
  await expect(refreshIcon).toHaveClass(/animate-spin/);
  await expect(refreshIcon).not.toHaveClass(/animate-spin/);
});

test("切到合成现货后会显示模式专属字段和组合结果", async ({ page }) => {
  const controls: MockControls = { delayMs: 0 };
  await mockDeribit(page, controls);

  await page.goto(APP_ROUTE);

  await page.getByRole("button", { name: "合成现货" }).click();
  await page.getByRole("button", { name: /进取/ }).click();

  await expect(page.getByText("净权利金目标", { exact: true })).toBeVisible();
  await expect(page.getByText("下跌义务", { exact: true })).toBeVisible();
  await expect(page.getByText("合成现货模式提示", { exact: true })).toBeVisible();
  await expect(page.getByText("当前首选组合", { exact: true })).toBeVisible();
  await expect(page.getByText("首选买 Call", { exact: true })).toBeVisible();
  await expect(page.getByText("首选卖 Put", { exact: true })).toBeVisible();
  await expect(page.getByText("净权利金", { exact: true }).first()).toBeVisible();
});

test("策略对比和风险页能正常切换，并显示关键内容", async ({ page }) => {
  const controls: MockControls = { delayMs: 0 };
  await mockDeribit(page, controls);

  await page.goto(APP_ROUTE);

  await page.getByRole("button", { name: "策略对比" }).click();
  await expect(page.getByRole("heading", { name: "三种策略对比" })).toBeVisible();
  await expect(page.getByText("收益率", { exact: true })).toBeVisible();
  await expect(page.getByText("安全性", { exact: true })).toBeVisible();
  await expect(page.getByText("资金效率", { exact: true })).toBeVisible();
  await expect(page.getByText("灵活性", { exact: true })).toBeVisible();
  await expect(page.getByText("简单程度", { exact: true })).toBeVisible();
  await expect(page.getByText("持有 BTC 卖看涨（Covered Call）")).toBeVisible();
  await expect(page.getByText("卖看跌准备接货（Cash-Secured Put）")).toBeVisible();
  await expect(page.getByText("模拟持有 BTC（Synthetic Long）")).toBeVisible();

  await page.getByRole("button", { name: "风险提示" }).click();
  await expect(page.getByText("你必须先接受这些风险")).toBeVisible();
  await expect(page.getByText("持有 BTC 卖看涨的核心代价不是亏损无限，而是 BTC 大涨时你的上涨收益会被封顶。")).toBeVisible();
});
