import assert from "node:assert/strict";
import test from "node:test";
import { buildPayoffLegsForStrategy, calculatePayoffCurve } from "../lib/domain/payoff";

test("short call at-or-below strike keeps BTC premium as profit in USD", () => {
  const curve = calculatePayoffCurve(
    [
      {
        direction: "short",
        optionType: "call",
        strike: 81_000,
        premium: 0.005,
        contractSize: 0.1,
      },
    ],
    76_000,
  );

  const pointAtSpot = curve.points.find((point) => point.priceAtExpiry === 76_000);
  assert.ok(pointAtSpot);
  assert.equal(pointAtSpot.pnl, 38);
});

test("short call break-even is strike plus premium per BTC", () => {
  const curve = calculatePayoffCurve(
    [
      {
        direction: "short",
        optionType: "call",
        strike: 81_000,
        premium: 0.005,
        contractSize: 0.1,
      },
    ],
    76_000,
  );

  assert.equal(curve.breakEvenPrice, 81_380);
});

test("long call pays full BTC premium in USD before break-even", () => {
  const curve = calculatePayoffCurve(
    [
      {
        direction: "long",
        optionType: "call",
        strike: 81_000,
        premium: 0.005,
        contractSize: 0.1,
      },
    ],
    76_000,
  );

  const pointAtSpot = curve.points.find((point) => point.priceAtExpiry === 76_000);
  assert.ok(pointAtSpot);
  assert.equal(pointAtSpot.pnl, -38);
});

test("cash-secured put break-even stays close to strike minus BTC premium in USD", () => {
  const curve = calculatePayoffCurve(
    [
      {
        direction: "short",
        optionType: "put",
        strike: 81_000,
        premium: 0.005,
        contractSize: 0.1,
      },
    ],
    76_000,
  );

  assert.ok(curve.breakEvenPrice != null);
  assert.ok(Math.abs(curve.breakEvenPrice - 80_620) <= 60);
});

test("synthetic long combines call cost and put credit correctly at spot", () => {
  const curve = calculatePayoffCurve(
    [
      {
        direction: "long",
        optionType: "call",
        strike: 76_000,
        premium: 0.005,
        contractSize: 0.1,
      },
      {
        direction: "short",
        optionType: "put",
        strike: 76_000,
        premium: 0.004,
        contractSize: 0.1,
      },
    ],
    76_000,
  );

  const pointAtSpot = curve.points.find((point) => point.priceAtExpiry === 76_000);
  assert.ok(pointAtSpot);
  assert.equal(pointAtSpot.pnl, -7.6);
});

test("covered-call legs keep premium in BTC and spot exposure separate", () => {
  const legs = buildPayoffLegsForStrategy("covered-call", 81_000, 0.005, 76_000);

  assert.deepEqual(legs, [
    { direction: "long", optionType: "call", strike: 76_000, premium: 0, contractSize: 0.1 },
    { direction: "short", optionType: "call", strike: 81_000, premium: 0.005, contractSize: 0.1 },
  ]);
});
