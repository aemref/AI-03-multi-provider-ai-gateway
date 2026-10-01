import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayRequest, ProviderResponse } from "../src/contracts.js";
import { GatewayError } from "../src/errors.js";
import { Gateway } from "../src/gateway.js";
import {
  createEchoMockAdapter,
  ScriptedMockAdapter,
} from "../src/mock-adapters.js";

const request: GatewayRequest = {
  model: "mock-small",
  messages: [{ role: "user", content: "hello" }],
};

const response: ProviderResponse = {
  id: "response-1",
  model: "mock-small",
  message: { role: "assistant", content: "primary result" },
  finishReason: "stop",
  usage: { inputTokens: 1, outputTokens: 2 },
};

test("returns the first provider response without calling fallback", async () => {
  const primary = new ScriptedMockAdapter("primary", [response]);
  const secondary = new ScriptedMockAdapter("secondary", [response]);
  const gateway = new Gateway([primary, secondary], {
    createRequestId: () => "request-1",
  });

  const result = await gateway.generate(request);

  assert.equal(result.provider, "primary");
  assert.equal(result.requestId, "request-1");
  assert.equal(primary.calls.length, 1);
  assert.equal(primary.calls[0]?.requestId, "request-1");
  assert.equal(secondary.calls.length, 0);
});

test("falls back to a second mock after primary exhaustion", async () => {
  const primary = new ScriptedMockAdapter("primary", [
    new GatewayError("unavailable", "down"),
  ]);
  const secondary = createEchoMockAdapter("secondary", "echo: ");
  const gateway = new Gateway([primary, secondary], {
    maxAttemptsPerProvider: 1,
    createRequestId: () => "request-2",
  });

  const result = await gateway.generate(request);

  assert.equal(result.provider, "secondary");
  assert.equal(result.message.content, "echo: hello");
  assert.equal(primary.calls.length, 1);
});

test("reports all exhausted providers without hiding individual failures", async () => {
  const first = new ScriptedMockAdapter("first", [
    new GatewayError("authentication", "bad credential"),
  ]);
  const second = new ScriptedMockAdapter("second", [new Error("broken")]);
  const gateway = new Gateway([first, second], { maxAttemptsPerProvider: 1 });

  await assert.rejects(
    gateway.generate(request),
    (error: unknown) =>
      error instanceof GatewayError &&
      error.kind === "unavailable" &&
      error.message === "All providers failed: first, second" &&
      error.cause instanceof AggregateError &&
      error.cause.errors.length === 2,
  );
});

test("requires unique named providers", () => {
  assert.throws(
    () =>
      new Gateway([
        createEchoMockAdapter("duplicate", "one"),
        createEchoMockAdapter("duplicate", "two"),
      ]),
    (error: unknown) => error instanceof GatewayError && error.kind === "invalid_request",
  );
});
