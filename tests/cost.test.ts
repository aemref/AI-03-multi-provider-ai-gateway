import assert from "node:assert/strict";
import test from "node:test";

import { PricingCatalog } from "../src/cost.js";
import { GatewayError } from "../src/errors.js";

test("estimates input and output cost from provider-specific pricing", () => {
  const catalog = new PricingCatalog([
    {
      provider: "mock-a",
      model: "small",
      inputUsdPerMillionTokens: 2,
      outputUsdPerMillionTokens: 8,
    },
  ]);

  assert.deepEqual(
    catalog.estimate("mock-a", "small", {
      inputTokens: 250_000,
      outputTokens: 125_000,
    }),
    {
      currency: "USD",
      inputUsd: 0.5,
      outputUsd: 1,
      totalUsd: 1.5,
    },
  );
});

test("returns no estimate when a provider and model price is unknown", () => {
  const catalog = new PricingCatalog([]);

  assert.equal(
    catalog.estimate("unknown", "small", {
      inputTokens: 1,
      outputTokens: 1,
    }),
    undefined,
  );
});

test("rejects duplicate, negative, and malformed pricing inputs", () => {
  const entry = {
    provider: "mock-a",
    model: "small",
    inputUsdPerMillionTokens: 1,
    outputUsdPerMillionTokens: 2,
  };

  assert.throws(
    () => new PricingCatalog([entry, entry]),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
  assert.throws(
    () =>
      new PricingCatalog([
        { ...entry, outputUsdPerMillionTokens: Number.NaN },
      ]),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
});

test("rejects invalid provider token accounting", () => {
  const catalog = new PricingCatalog([
    {
      provider: "mock-a",
      model: "small",
      inputUsdPerMillionTokens: 1,
      outputUsdPerMillionTokens: 2,
    },
  ]);

  assert.throws(
    () =>
      catalog.estimate("mock-a", "small", {
        inputTokens: -1,
        outputTokens: 2,
      }),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_response",
  );
});
