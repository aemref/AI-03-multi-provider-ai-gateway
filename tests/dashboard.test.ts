import assert from "node:assert/strict";
import test from "node:test";

import { renderTraceDashboard } from "../src/dashboard.js";
import type { TraceSummary } from "../src/trace-summary.js";

const summary: TraceSummary = {
  requests: { requests: 3, completed: 2, failed: 1, successRate: 2 / 3 },
  tokens: { input: 16, output: 7, total: 23 },
  cost: { currency: "USD", estimatedUsd: 0.000052, pricedRequests: 1 },
  latency: { samples: 3, minMs: 15, p50Ms: 20, p95Ms: 30, maxMs: 30 },
  providers: [
    {
      provider: "primary|mock",
      attempts: 2,
      succeededAttempts: 1,
      failedAttempts: 1,
      attemptSuccessRate: 0.5,
      completedRequests: 1,
      tokens: { input: 10, output: 4, total: 14 },
      cost: { currency: "USD", estimatedUsd: 0.000052, pricedRequests: 1 },
      latency: { samples: 2, minMs: 12, p50Ms: 12, p95Ms: 25, maxMs: 25 },
    },
  ],
};

test("renders a deterministic local Markdown dashboard", () => {
  const dashboard = renderTraceDashboard(summary, { title: "Local evidence" });

  assert.match(dashboard, /^# Local evidence$/m);
  assert.match(dashboard, /3 total · 2 completed · 1 failed · 66\.7% success/);
  assert.match(dashboard, /\$0\.000052000000 USD \(1\/2 completed requests priced\)/);
  assert.match(dashboard, /p50 20 ms · p95 30 ms · max 30 ms \(3 samples\)/);
  assert.match(dashboard, /\| primary\\\|mock \| 2 \| 50\.0% \| 1 \| 14 \|/);
  assert.equal(dashboard.endsWith("\n"), true);
});

test("renders empty summaries without NaN or Infinity", () => {
  const dashboard = renderTraceDashboard({
    requests: { requests: 0, completed: 0, failed: 0, successRate: 0 },
    tokens: { input: 0, output: 0, total: 0 },
    cost: { currency: "USD", estimatedUsd: 0, pricedRequests: 0 },
    latency: {
      samples: 0,
      minMs: null,
      p50Ms: null,
      p95Ms: null,
      maxMs: null,
    },
    providers: [],
  });

  assert.match(dashboard, /Request latency: p50 n\/a · p95 n\/a · max n\/a/);
  assert.match(dashboard, /\| _none_ \|/);
  assert.doesNotMatch(dashboard, /NaN|Infinity/);
});
