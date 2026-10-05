import assert from "node:assert/strict";
import test from "node:test";

import { ExactRequestCache } from "../src/cache.js";
import { CachingGateway } from "../src/caching-gateway.js";
import type { GatewayRequest, ProviderResponse } from "../src/contracts.js";
import { GatewayError } from "../src/errors.js";
import { Gateway } from "../src/gateway.js";
import { ScriptedMockAdapter } from "../src/mock-adapters.js";

const request: GatewayRequest = {
  model: "mock-small",
  messages: [{ role: "user", content: "repeatable" }],
};

const response: ProviderResponse = {
  id: "provider-response-1",
  model: "mock-small",
  message: { role: "assistant", content: "cached result" },
  finishReason: "stop",
  usage: { inputTokens: 2, outputTokens: 3 },
};

test("serves an exact repeat without a second provider call", async () => {
  const adapter = new ScriptedMockAdapter("primary", [response]);
  const gateway = new Gateway([adapter], {
    createRequestId: () => "request-miss",
  });
  const ids = ["request-hit"];
  const cached = new CachingGateway(
    gateway,
    new ExactRequestCache({ capacity: 2, ttlMs: 1_000 }),
    { createRequestId: () => ids.shift() ?? "unexpected" },
  );

  const miss = await cached.generate(request);
  const hit = await cached.generate(request);

  assert.equal(miss.requestId, "request-miss");
  assert.equal(hit.requestId, "request-hit");
  assert.equal(hit.id, miss.id);
  assert.equal(hit.provider, "primary");
  assert.equal(adapter.calls.length, 1);
  assert.deepEqual(cached.stats, { hits: 1, misses: 1 });
});

test("does not cache failed requests", async () => {
  const adapter = new ScriptedMockAdapter("primary", [
    new GatewayError("unavailable", "planned failure"),
    response,
  ]);
  const cached = new CachingGateway(
    new Gateway([adapter], { maxAttemptsPerProvider: 1 }),
    new ExactRequestCache({ capacity: 2, ttlMs: 1_000 }),
  );

  await assert.rejects(cached.generate(request), GatewayError);
  const recovered = await cached.generate(request);

  assert.equal(recovered.message.content, "cached result");
  assert.equal(adapter.calls.length, 2);
  assert.deepEqual(cached.stats, { hits: 0, misses: 2 });
});

test("rejects an aborted caller before consulting the cache", async () => {
  const gateway = new Gateway([new ScriptedMockAdapter("primary", [response])]);
  const cached = new CachingGateway(
    gateway,
    new ExactRequestCache({ capacity: 1, ttlMs: 1_000 }),
  );
  await cached.generate(request);
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    cached.generate(request, controller.signal),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "aborted",
  );
  assert.deepEqual(cached.stats, { hits: 0, misses: 1 });
});
