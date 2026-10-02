import type { GatewayTraceEvent } from "./observability.js";

export interface TraceRequestTotals {
  readonly requests: number;
  readonly completed: number;
  readonly failed: number;
  readonly successRate: number;
}

export interface TraceTokenTotals {
  readonly input: number;
  readonly output: number;
  readonly total: number;
}

export interface TraceCostTotals {
  readonly currency: "USD";
  readonly estimatedUsd: number;
  readonly pricedRequests: number;
}

export interface TraceSummary {
  readonly requests: TraceRequestTotals;
  readonly tokens: TraceTokenTotals;
  readonly cost: TraceCostTotals;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

export function summarizeTraceEvents(
  events: readonly GatewayTraceEvent[],
): TraceSummary {
  let completed = 0;
  let failed = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedUsd = 0;
  let pricedRequests = 0;

  for (const event of events) {
    if (event.type === "request.failed") {
      failed += 1;
      continue;
    }
    if (event.type !== "request.completed") {
      continue;
    }

    completed += 1;
    inputTokens += event.usage?.inputTokens ?? 0;
    outputTokens += event.usage?.outputTokens ?? 0;
    if (event.cost !== undefined) {
      estimatedUsd += event.cost.totalUsd;
      pricedRequests += 1;
    }
  }

  const requests = completed + failed;
  return {
    requests: {
      requests,
      completed,
      failed,
      successRate: requests === 0 ? 0 : completed / requests,
    },
    tokens: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    },
    cost: {
      currency: "USD",
      estimatedUsd: roundUsd(estimatedUsd),
      pricedRequests,
    },
  };
}
