import assert from "node:assert/strict";
import test from "node:test";

import type {
  GatewayRequest,
  ProviderAdapter,
  ProviderContext,
  StreamingProviderAdapter,
} from "../src/contracts.js";
import { GatewayError, normalizeProviderError } from "../src/errors.js";

const request: GatewayRequest = {
  model: "mock-small",
  messages: [{ role: "user", content: "hello" }],
};

test("provider adapters share one request and response contract", async () => {
  const adapter: ProviderAdapter = {
    name: "contract-mock",
    async generate(received: GatewayRequest, context: ProviderContext) {
      assert.equal(received, request);
      assert.equal(context.requestId, "request-1");
      return {
        id: "response-1",
        model: received.model,
        message: { role: "assistant", content: "hello back" },
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 2 },
      };
    },
  };

  const response = await adapter.generate(request, {
    requestId: "request-1",
    signal: new AbortController().signal,
  });

  assert.equal(response.message.content, "hello back");
  assert.deepEqual(response.usage, { inputTokens: 1, outputTokens: 2 });
});

test("known transient failures are retryable by default", () => {
  for (const kind of ["rate_limited", "timeout", "unavailable"] as const) {
    assert.equal(new GatewayError(kind, "transient").retryable, true);
  }
});

test("authentication and invalid input failures fail closed", () => {
  for (const kind of ["authentication", "invalid_request"] as const) {
    assert.equal(new GatewayError(kind, "permanent").retryable, false);
  }
});

test("unknown provider errors are normalized without leaking an object", () => {
  const normalized = normalizeProviderError("provider-a", new Error("offline"));

  assert.equal(normalized.kind, "internal");
  assert.equal(normalized.provider, "provider-a");
  assert.equal(normalized.message, "offline");
  assert.equal(normalized.retryable, false);
});

test("streaming adapters emit portable delta, usage, and completion events", async () => {
  const adapter: StreamingProviderAdapter = {
    name: "stream-mock",
    async generate() {
      throw new Error("not used by this contract test");
    },
    async *stream(received, context) {
      assert.equal(received, request);
      assert.equal(context.requestId, "stream-1");
      yield { type: "delta", content: "hello" };
      yield { type: "usage", usage: { inputTokens: 1, outputTokens: 1 } };
      yield { type: "done", finishReason: "stop" };
    },
  };

  const events = [];
  for await (const event of adapter.stream(request, {
    requestId: "stream-1",
    signal: new AbortController().signal,
  })) {
    events.push(event);
  }

  assert.deepEqual(events, [
    { type: "delta", content: "hello" },
    { type: "usage", usage: { inputTokens: 1, outputTokens: 1 } },
    { type: "done", finishReason: "stop" },
  ]);
});
