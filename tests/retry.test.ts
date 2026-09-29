import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayRequest, ProviderAdapter } from "../src/contracts.js";
import { GatewayError } from "../src/errors.js";
import { executeWithRetry } from "../src/retry.js";

const request: GatewayRequest = {
  model: "mock-small",
  messages: [{ role: "user", content: "hello" }],
};

test("retries transient failures with capped exponential backoff", async () => {
  let calls = 0;
  const delays: number[] = [];
  const adapter: ProviderAdapter = {
    name: "flaky",
    async generate() {
      calls += 1;
      if (calls < 3) {
        throw new GatewayError("unavailable", "temporary outage");
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

  const response = await executeWithRetry(adapter, request, {
    requestId: "request-1",
    timeoutMs: 100,
    maxAttempts: 3,
    initialBackoffMs: 10,
    maxBackoffMs: 15,
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  assert.equal(response.message.content, "recovered");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 15]);
});

test("does not retry permanent failures", async () => {
  let calls = 0;
  const adapter: ProviderAdapter = {
    name: "rejecting",
    async generate() {
      calls += 1;
      throw new GatewayError("authentication", "bad key");
    },
  };

  await assert.rejects(
    executeWithRetry(adapter, request, {
      requestId: "request-2",
      timeoutMs: 100,
      maxAttempts: 3,
      initialBackoffMs: 1,
      maxBackoffMs: 2,
    }),
    (error: unknown) => error instanceof GatewayError && error.kind === "authentication",
  );
  assert.equal(calls, 1);
});

test("times out even when a provider ignores cancellation", async () => {
  const adapter: ProviderAdapter = {
    name: "hanging",
    async generate() {
      return await new Promise(() => undefined);
    },
  };

  await assert.rejects(
    executeWithRetry(adapter, request, {
      requestId: "request-3",
      timeoutMs: 5,
      maxAttempts: 1,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
    }),
    (error: unknown) =>
      error instanceof GatewayError &&
      error.kind === "timeout" &&
      error.provider === "hanging",
  );
});

test("rejects invalid retry configuration before calling a provider", async () => {
  let called = false;
  const adapter: ProviderAdapter = {
    name: "unused",
    async generate() {
      called = true;
      throw new Error("must not run");
    },
  };

  await assert.rejects(
    executeWithRetry(adapter, request, {
      requestId: "request-4",
      timeoutMs: 100,
      maxAttempts: 0,
      initialBackoffMs: 1,
      maxBackoffMs: 1,
    }),
    (error: unknown) => error instanceof GatewayError && error.kind === "invalid_request",
  );
  assert.equal(called, false);
});

