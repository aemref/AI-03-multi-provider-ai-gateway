import assert from "node:assert/strict";
import test from "node:test";

import {
  CircuitBreaker,
  withCircuitBreaker,
} from "../src/circuit-breaker.js";
import type { GatewayRequest, ProviderAdapter } from "../src/contracts.js";
import { GatewayError } from "../src/errors.js";

const request: GatewayRequest = {
  model: "mock-small",
  messages: [{ role: "user", content: "hello" }],
};
const context = {
  requestId: "request-1",
  signal: new AbortController().signal,
};

test("opens after consecutive failures and rejects without calling provider", async () => {
  let calls = 0;
  const adapter: ProviderAdapter = {
    name: "unstable",
    async generate() {
      calls += 1;
      throw new GatewayError("unavailable", "offline");
    },
  };
  const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });
  const protectedAdapter = withCircuitBreaker(adapter, breaker);

  await assert.rejects(protectedAdapter.generate(request, context));
  assert.equal(breaker.state, "closed");
  await assert.rejects(protectedAdapter.generate(request, context));
  assert.equal(breaker.state, "open");
  await assert.rejects(
    protectedAdapter.generate(request, context),
    (error: unknown) =>
      error instanceof GatewayError && error.message === "Provider circuit is open",
  );
  assert.equal(calls, 2);
});

test("successful half-open probe closes the circuit", async () => {
  let now = 0;
  let shouldFail = true;
  const adapter: ProviderAdapter = {
    name: "recovering",
    async generate() {
      if (shouldFail) {
        throw new GatewayError("timeout", "slow");
      }
      return {
        id: "response-1",
        model: request.model,
        message: { role: "assistant", content: "recovered" },
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
  };
  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    resetTimeoutMs: 50,
    now: () => now,
  });
  const protectedAdapter = withCircuitBreaker(adapter, breaker);

  await assert.rejects(protectedAdapter.generate(request, context));
  assert.equal(breaker.state, "open");
  now = 50;
  shouldFail = false;
  const response = await protectedAdapter.generate(request, context);

  assert.equal(response.message.content, "recovered");
  assert.equal(breaker.state, "closed");
});

test("permanent caller failures do not open the provider circuit", async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 100 });

  await assert.rejects(
    breaker.execute(async () => {
      throw new GatewayError("invalid_request", "bad payload");
    }),
  );

  assert.equal(breaker.state, "closed");
});

