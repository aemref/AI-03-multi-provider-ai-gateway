import assert from "node:assert/strict";
import test from "node:test";

import { ExactRequestCache } from "../src/cache.js";
import type { GatewayRequest } from "../src/contracts.js";
import { GatewayError } from "../src/errors.js";

const request = (content: string): GatewayRequest => ({
  model: "mock-small",
  messages: [{ role: "user", content }],
});

test("returns exact matches until their TTL expires", () => {
  let now = 100;
  const cache = new ExactRequestCache<string>({
    capacity: 2,
    ttlMs: 10,
    now: () => now,
  });

  cache.set(request("hello"), "cached response");
  assert.equal(cache.get(request("hello")), "cached response");

  now = 110;
  assert.equal(cache.get(request("hello")), undefined);
  assert.equal(cache.size, 0);
});

test("uses least-recently-used eviction within a fixed capacity", () => {
  const cache = new ExactRequestCache<string>({ capacity: 2, ttlMs: 100 });
  cache.set(request("first"), "one");
  cache.set(request("second"), "two");
  assert.equal(cache.get(request("first")), "one");

  cache.set(request("third"), "three");

  assert.equal(cache.get(request("second")), undefined);
  assert.equal(cache.get(request("first")), "one");
  assert.equal(cache.get(request("third")), "three");
});

test("canonicalizes metadata keys without ignoring request controls", () => {
  const cache = new ExactRequestCache<string>({ capacity: 3, ttlMs: 100 });
  cache.set(
    { ...request("hello"), temperature: 0, metadata: { region: "eu", tier: "dev" } },
    "match",
  );

  assert.equal(
    cache.get({
      ...request("hello"),
      temperature: 0,
      metadata: { tier: "dev", region: "eu" },
    }),
    "match",
  );
  assert.equal(
    cache.get({ ...request("hello"), temperature: 1, metadata: { region: "eu", tier: "dev" } }),
    undefined,
  );
});

test("validates bounded cache options", () => {
  assert.throws(
    () => new ExactRequestCache({ capacity: 0, ttlMs: 1 }),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
  assert.throws(
    () => new ExactRequestCache({ capacity: 1, ttlMs: Number.NaN }),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
});
