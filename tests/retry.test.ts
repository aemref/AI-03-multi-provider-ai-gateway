import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayRequest, ProviderAdapter } from "../src/contracts.js";
import { GatewayError } from "../src/errors.js";
import {
  executeWithRetry,
  type RetryAttemptEvent,
} from "../src/retry.js";

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

test("reports deterministic attempt timing without changing retry behavior", async () => {
  const events: RetryAttemptEvent[] = [];
  const times = [100, 105, 110, 119];
  let calls = 0;
  const adapter: ProviderAdapter = {
    name: "observed",
    async generate() {
      calls += 1;
      if (calls === 1) {
        throw new GatewayError("unavailable", "retry once");
      }
      return {
        id: "response-observed",
        model: request.model,
        message: { role: "assistant", content: "ok" },
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
  };

  await executeWithRetry(adapter, request, {
    requestId: "request-observed",
    timeoutMs: 100,
    maxAttempts: 2,
    initialBackoffMs: 0,
    maxBackoffMs: 0,
    sleep: async () => undefined,
    now: () => times.shift() ?? 119,
    onAttempt: (event) => events.push(event),
  });

  assert.deepEqual(
    events.map((event) => ({
      type: event.type,
      attempt: event.attempt,
      timestampMs: event.timestampMs,
      ...(event.type === "started" ? {} : { durationMs: event.durationMs }),
      ...(event.type === "failed"
        ? { failureKind: event.failure.kind }
        : {}),
    })),
    [
      { type: "started", attempt: 1, timestampMs: 100 },
      {
        type: "failed",
        attempt: 1,
        timestampMs: 105,
        durationMs: 5,
        failureKind: "unavailable",
      },
      { type: "started", attempt: 2, timestampMs: 110 },
      {
        type: "succeeded",
        attempt: 2,
        timestampMs: 119,
        durationMs: 9,
      },
    ],
  );
});

test("ignores failures raised by an attempt observer", async () => {
  const adapter: ProviderAdapter = {
    name: "healthy",
    async generate() {
      return {
        id: "response-healthy",
        model: request.model,
        message: { role: "assistant", content: "ok" },
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
  };

  const response = await executeWithRetry(adapter, request, {
    requestId: "request-observer-failure",
    timeoutMs: 100,
    maxAttempts: 1,
    initialBackoffMs: 0,
    maxBackoffMs: 0,
    onAttempt: () => {
      throw new Error("observer unavailable");
    },
  });

  assert.equal(response.id, "response-healthy");
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

test("rejects immediately when the caller signal is already aborted", async () => {
  let called = false;
  const controller = new AbortController();
  controller.abort(new Error("caller left"));
  const adapter: ProviderAdapter = {
    name: "unused",
    async generate() {
      called = true;
      return await new Promise(() => undefined);
    },
  };

  await assert.rejects(
    executeWithRetry(adapter, request, {
      requestId: "request-aborted",
      timeoutMs: 1_000,
      maxAttempts: 1,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
      signal: controller.signal,
    }),
    (error: unknown) =>
      error instanceof GatewayError &&
      error.kind === "aborted" &&
      error.provider === "unused",
  );
  assert.equal(called, false);
});

test("caller cancellation interrupts retry backoff", async () => {
  const controller = new AbortController();
  let calls = 0;
  const adapter: ProviderAdapter = {
    name: "flaky",
    async generate() {
      calls += 1;
      throw new GatewayError("unavailable", "retry me");
    },
  };

  const pending = executeWithRetry(adapter, request, {
    requestId: "request-backoff",
    timeoutMs: 100,
    maxAttempts: 3,
    initialBackoffMs: 10_000,
    maxBackoffMs: 10_000,
    signal: controller.signal,
  });
  controller.abort(new Error("caller left"));

  await assert.rejects(
    pending,
    (error: unknown) => error instanceof GatewayError && error.kind === "aborted",
  );
  assert.equal(calls, 1);
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
