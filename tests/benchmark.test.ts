import assert from "node:assert/strict";
import test from "node:test";

import {
  renderStrategyBenchmark,
  summarizeStrategyBenchmark,
} from "../src/benchmark.js";
import { GatewayError } from "../src/errors.js";

test("summarizes strategy distributions and cache effectiveness", () => {
  const summary = summarizeStrategyBenchmark([
    { strategy: "exact_cache", latencyMs: 40, estimatedCostUsd: 0.004 },
    { strategy: "exact_cache", latencyMs: 1, estimatedCostUsd: 0, cacheHit: true },
    { strategy: "exact_cache", latencyMs: 20, estimatedCostUsd: 0.002 },
    { strategy: "baseline", latencyMs: 50, estimatedCostUsd: 0.005 },
  ]);

  assert.deepEqual(summary, [
    {
      strategy: "baseline",
      requests: 1,
      cacheHits: 0,
      cacheHitRate: 0,
      latencyP50Ms: 50,
      latencyP95Ms: 50,
      estimatedCostUsd: 0.005,
    },
    {
      strategy: "exact_cache",
      requests: 3,
      cacheHits: 1,
      cacheHitRate: 1 / 3,
      latencyP50Ms: 20,
      latencyP95Ms: 40,
      estimatedCostUsd: 0.006,
    },
  ]);
});

test("renders stable Markdown with escaped strategy names", () => {
  const markdown = renderStrategyBenchmark(
    "Local benchmark",
    summarizeStrategyBenchmark([
      {
        strategy: "cache|exact",
        latencyMs: 5,
        estimatedCostUsd: 0.000001,
        cacheHit: true,
      },
    ]),
  );

  assert.match(markdown, /^## Local benchmark/m);
  assert.match(markdown, /\| cache\\\|exact \| 1 \| 1 \| 100\.0% \| 5 \| 5 \| \$0\.000001 \|/);
});

test("rejects invalid local benchmark samples", () => {
  assert.throws(
    () =>
      summarizeStrategyBenchmark([
        { strategy: "invalid", latencyMs: -1, estimatedCostUsd: 0 },
      ]),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
});
