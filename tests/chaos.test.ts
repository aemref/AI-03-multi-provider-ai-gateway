import assert from "node:assert/strict";
import test from "node:test";

import {
  CircuitBreaker,
  withCircuitBreaker,
} from "../src/circuit-breaker.js";
import type { GatewayRequest, ProviderAdapter } from "../src/contracts.js";
import { GatewayError } from "../src/errors.js";
import { Gateway } from "../src/gateway.js";
import {
  createEchoMockAdapter,
  ScriptedMockAdapter,
} from "../src/mock-adapters.js";

const request: GatewayRequest = {
  model: "mock-small",
  messages: [{ role: "user", content: "survive chaos" }],
};

test("gateway falls back while a circuit is open then restores the primary", async () => {
  let now = 0;
  const primary = new ScriptedMockAdapter("primary", [
    new GatewayError("unavailable", "fault one"),
    new GatewayError("timeout", "fault two"),
    {
      id: "primary-recovered",
      model: request.model,
      message: { role: "assistant", content: "primary recovered" },
      finishReason: "stop",
      usage: { inputTokens: 2, outputTokens: 2 },
    },
  ]);
  const breaker = new CircuitBreaker({
    failureThreshold: 2,
    resetTimeoutMs: 100,
    now: () => now,
  });
  let secondaryCalls = 0;
  const echo = createEchoMockAdapter("secondary", "fallback: ");
  const secondary: ProviderAdapter = {
    name: echo.name,
    async generate(received, context) {
      secondaryCalls += 1;
      return await echo.generate(received, context);
    },
  };
  const gateway = new Gateway(
    [withCircuitBreaker(primary, breaker), secondary],
    {
      maxAttemptsPerProvider: 2,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
      sleep: async () => undefined,
      createRequestId: () => `request-${secondaryCalls + 1}`,
    },
  );

  const first = await gateway.generate(request);
  assert.equal(first.provider, "secondary");
  assert.equal(breaker.state, "open");
  assert.equal(primary.calls.length, 2);

  const second = await gateway.generate(request);
  assert.equal(second.provider, "secondary");
  assert.equal(primary.calls.length, 2, "open circuit must shed provider traffic");

  now = 100;
  const third = await gateway.generate(request);
  assert.equal(third.provider, "primary");
  assert.equal(third.message.content, "primary recovered");
  assert.equal(breaker.state, "closed");
  assert.equal(secondaryCalls, 2);
});

test("gateway contains a hanging primary and serves from fallback", async () => {
  let primarySignalWasAborted = false;
  const hanging: ProviderAdapter = {
    name: "hanging",
    async generate(_request, context) {
      return await new Promise((_resolve, reject) => {
        context.signal.addEventListener(
          "abort",
          () => {
            primarySignalWasAborted = true;
            reject(context.signal.reason);
          },
          { once: true },
        );
      });
    },
  };
  const gateway = new Gateway(
    [hanging, createEchoMockAdapter("healthy", "safe: ")],
    {
      timeoutMs: 5,
      maxAttemptsPerProvider: 1,
      createRequestId: () => "chaos-timeout",
    },
  );

  const response = await gateway.generate(request);

  assert.equal(response.provider, "healthy");
  assert.equal(response.message.content, "safe: survive chaos");
  assert.equal(primarySignalWasAborted, true);
});

