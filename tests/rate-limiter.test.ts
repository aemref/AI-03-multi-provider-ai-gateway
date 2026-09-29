import assert from "node:assert/strict";
import test from "node:test";

import { GatewayError } from "../src/errors.js";
import { Gateway } from "../src/gateway.js";
import { createEchoMockAdapter } from "../src/mock-adapters.js";
import { TokenBucketRateLimiter } from "../src/rate-limiter.js";

test("token bucket rejects excess requests and refills by elapsed time", () => {
  let now = 1_000;
  const limiter = new TokenBucketRateLimiter({
    capacity: 2,
    refillPerSecond: 2,
    now: () => now,
  });

  limiter.acquire();
  limiter.acquire();
  assert.equal(limiter.remaining, 0);
  assert.throws(
    () => limiter.acquire(),
    (error: unknown) => error instanceof GatewayError && error.kind === "rate_limited",
  );

  now += 500;
  assert.equal(limiter.remaining, 1);
  limiter.acquire();
  assert.equal(limiter.remaining, 0);
});

test("gateway applies its local limit before calling a provider", async () => {
  const limiter = new TokenBucketRateLimiter({
    capacity: 1,
    refillPerSecond: 1,
    now: () => 0,
  });
  let calls = 0;
  const base = createEchoMockAdapter("primary", "echo: ");
  const gateway = new Gateway(
    [
      {
        name: base.name,
        async generate(request, context) {
          calls += 1;
          return await base.generate(request, context);
        },
      },
    ],
    { rateLimiter: limiter },
  );
  const request = {
    model: "mock-small",
    messages: [{ role: "user" as const, content: "hello" }],
  };

  await gateway.generate(request);
  await assert.rejects(
    gateway.generate(request),
    (error: unknown) => error instanceof GatewayError && error.kind === "rate_limited",
  );
  assert.equal(calls, 1);
});

test("token bucket rejects impossible token requests", () => {
  const limiter = new TokenBucketRateLimiter({
    capacity: 2,
    refillPerSecond: 1,
  });

  assert.throws(
    () => limiter.acquire(3),
    (error: unknown) => error instanceof GatewayError && error.kind === "invalid_request",
  );
});

