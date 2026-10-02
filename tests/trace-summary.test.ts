import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayTraceEvent } from "../src/observability.js";
import { summarizeTraceEvents } from "../src/trace-summary.js";

const events: readonly GatewayTraceEvent[] = [
  {
    type: "request.started",
    timestampMs: 100,
    requestId: "request-1",
    operation: "generate",
    model: "mock-small",
  },
  {
    type: "request.completed",
    timestampMs: 120,
    requestId: "request-1",
    operation: "generate",
    model: "mock-small",
    provider: "primary",
    durationMs: 20,
    usage: { inputTokens: 10, outputTokens: 4 },
    cost: {
      currency: "USD",
      inputUsd: 0.00002,
      outputUsd: 0.000032,
      totalUsd: 0.000052,
    },
  },
  {
    type: "request.completed",
    timestampMs: 140,
    requestId: "request-2",
    operation: "stream",
    model: "mock-large",
    provider: "fallback",
    durationMs: 15,
    usage: { inputTokens: 6, outputTokens: 3 },
  },
  {
    type: "request.failed",
    timestampMs: 160,
    requestId: "request-3",
    operation: "generate",
    model: "mock-small",
    provider: "primary",
    durationMs: 30,
    failureKind: "unavailable",
  },
];

test("aggregates terminal request, token, and estimated cost totals", () => {
  assert.deepEqual(summarizeTraceEvents(events), {
    requests: {
      requests: 3,
      completed: 2,
      failed: 1,
      successRate: 2 / 3,
    },
    tokens: { input: 16, output: 7, total: 23 },
    cost: { currency: "USD", estimatedUsd: 0.000052, pricedRequests: 1 },
  });
});

test("returns explicit zero totals when no request has terminated", () => {
  assert.deepEqual(summarizeTraceEvents(events.slice(0, 1)), {
    requests: { requests: 0, completed: 0, failed: 0, successRate: 0 },
    tokens: { input: 0, output: 0, total: 0 },
    cost: { currency: "USD", estimatedUsd: 0, pricedRequests: 0 },
  });
});
