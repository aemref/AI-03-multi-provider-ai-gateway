import assert from "node:assert/strict";
import test from "node:test";

import type { ModelRoute } from "../src/model-router.js";
import { selectModelRoute } from "../src/model-router.js";
import { GatewayError } from "../src/errors.js";

const routes: readonly ModelRoute[] = [
  {
    model: "mock-balanced",
    inputUsdPerMillionTokens: 2,
    outputUsdPerMillionTokens: 6,
    estimatedLatencyMs: 40,
  },
  {
    model: "mock-economy",
    inputUsdPerMillionTokens: 0.5,
    outputUsdPerMillionTokens: 1,
    estimatedLatencyMs: 70,
  },
  {
    model: "mock-fast",
    inputUsdPerMillionTokens: 4,
    outputUsdPerMillionTokens: 10,
    estimatedLatencyMs: 15,
  },
];

const estimate = { inputTokens: 1_000, outputTokens: 500 };

test("ordered routing keeps the caller-defined first route", () => {
  const selection = selectModelRoute(routes, estimate, "ordered");

  assert.equal(selection.route.model, "mock-balanced");
  assert.equal(selection.estimatedCostUsd, 0.005);
});

test("cost routing selects the lowest estimated token cost", () => {
  const selection = selectModelRoute(
    routes,
    estimate,
    "lowest_estimated_cost",
  );

  assert.equal(selection.route.model, "mock-economy");
  assert.equal(selection.estimatedCostUsd, 0.001);
});

test("latency routing selects the lowest configured estimate", () => {
  const selection = selectModelRoute(
    routes,
    estimate,
    "lowest_estimated_latency",
  );

  assert.equal(selection.route.model, "mock-fast");
  assert.equal(selection.route.estimatedLatencyMs, 15);
});

test("equal estimates retain deterministic route order", () => {
  const tied = [routes[0] as ModelRoute, { ...(routes[0] as ModelRoute), model: "tie" }];

  assert.equal(
    selectModelRoute(tied, estimate, "lowest_estimated_cost").route.model,
    "mock-balanced",
  );
  assert.equal(
    selectModelRoute(tied, estimate, "lowest_estimated_latency").route.model,
    "mock-balanced",
  );
});

test("rejects empty routes and malformed benchmark estimates", () => {
  assert.throws(
    () => selectModelRoute([], estimate, "ordered"),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
  assert.throws(
    () =>
      selectModelRoute(
        [{ ...(routes[0] as ModelRoute), estimatedLatencyMs: Number.NaN }],
        estimate,
        "ordered",
      ),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
});
