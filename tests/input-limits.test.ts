import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayRequest } from "../src/contracts.js";
import { GatewayError } from "../src/errors.js";
import {
  assertGatewayRequestWithinLimits,
  createGatewayRequestLimits,
  DEFAULT_GATEWAY_REQUEST_LIMITS,
} from "../src/input-limits.js";

const request: GatewayRequest = {
  model: "mock-small",
  messages: [{ role: "user", content: "hello" }],
  maxTokens: 100,
  temperature: 0,
  metadata: { tenant: "local-test" },
};

test("accepts a bounded gateway request with conservative defaults", () => {
  assert.doesNotThrow(() => assertGatewayRequestWithinLimits(request));
  assert.equal(DEFAULT_GATEWAY_REQUEST_LIMITS.maxMessages, 50);
  assert.equal(DEFAULT_GATEWAY_REQUEST_LIMITS.maxTotalMessageCharacters, 128_000);
});

test("rejects an oversized individual message", () => {
  const oversized: GatewayRequest = {
    ...request,
    messages: [{ role: "user", content: "x".repeat(33) }],
  };

  assert.throws(
    () =>
      assertGatewayRequestWithinLimits(
        oversized,
        createGatewayRequestLimits({ maxMessageCharacters: 32 }),
      ),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
});

test("rejects aggregate message content that exceeds its budget", () => {
  const oversized: GatewayRequest = {
    ...request,
    messages: [
      { role: "system", content: "123456" },
      { role: "user", content: "12345" },
    ],
  };

  assert.throws(() =>
    assertGatewayRequestWithinLimits(
      oversized,
      createGatewayRequestLimits({ maxTotalMessageCharacters: 10 }),
    ),
  );
});

test("rejects invalid numeric controls and excessive metadata", () => {
  assert.throws(() =>
    assertGatewayRequestWithinLimits({ ...request, maxTokens: 32_769 }),
  );
  assert.throws(() =>
    assertGatewayRequestWithinLimits({ ...request, temperature: Number.NaN }),
  );
  assert.throws(() =>
    assertGatewayRequestWithinLimits(
      { ...request, metadata: { one: "1", two: "2" } },
      createGatewayRequestLimits({ maxMetadataEntries: 1 }),
    ),
  );
});

test("rejects non-positive limit configuration", () => {
  assert.throws(
    () => createGatewayRequestLimits({ maxMessages: 0 }),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
});
