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

export interface TraceLatencySummary {
  readonly samples: number;
  readonly minMs: number | null;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly maxMs: number | null;
}

export interface ProviderTraceSummary {
  readonly provider: string;
  readonly attempts: number;
  readonly succeededAttempts: number;
  readonly failedAttempts: number;
  readonly attemptSuccessRate: number;
  readonly completedRequests: number;
  readonly tokens: TraceTokenTotals;
  readonly cost: TraceCostTotals;
  readonly latency: TraceLatencySummary;
}

export interface TraceSummary {
  readonly requests: TraceRequestTotals;
  readonly tokens: TraceTokenTotals;
  readonly cost: TraceCostTotals;
  readonly latency: TraceLatencySummary;
  readonly providers: readonly ProviderTraceSummary[];
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function percentile(sorted: readonly number[], fraction: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.max(0, Math.ceil(fraction * sorted.length) - 1);
  return sorted[index] ?? null;
}

function summarizeLatency(durations: readonly number[]): TraceLatencySummary {
  const sorted = [...durations].sort((left, right) => left - right);
  return {
    samples: sorted.length,
    minMs: sorted[0] ?? null,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted.at(-1) ?? null,
  };
}

interface MutableProviderSummary {
  attempts: number;
  succeededAttempts: number;
  failedAttempts: number;
  completedRequests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  pricedRequests: number;
  durations: number[];
}

function createProviderSummary(): MutableProviderSummary {
  return {
    attempts: 0,
    succeededAttempts: 0,
    failedAttempts: 0,
    completedRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedUsd: 0,
    pricedRequests: 0,
    durations: [],
  };
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
  const durations: number[] = [];
  const providers = new Map<string, MutableProviderSummary>();

  for (const event of events) {
    if (
      event.type === "provider.attempt.succeeded" ||
      event.type === "provider.attempt.failed"
    ) {
      const provider = providers.get(event.provider) ?? createProviderSummary();
      provider.attempts += 1;
      provider.durations.push(event.durationMs);
      if (event.type === "provider.attempt.succeeded") {
        provider.succeededAttempts += 1;
      } else {
        provider.failedAttempts += 1;
      }
      providers.set(event.provider, provider);
      continue;
    }
    if (event.type === "request.failed") {
      failed += 1;
      durations.push(event.durationMs);
      continue;
    }
    if (event.type !== "request.completed") {
      continue;
    }

    completed += 1;
    durations.push(event.durationMs);
    inputTokens += event.usage?.inputTokens ?? 0;
    outputTokens += event.usage?.outputTokens ?? 0;
    const provider = providers.get(event.provider) ?? createProviderSummary();
    provider.completedRequests += 1;
    provider.inputTokens += event.usage?.inputTokens ?? 0;
    provider.outputTokens += event.usage?.outputTokens ?? 0;
    if (event.cost !== undefined) {
      estimatedUsd += event.cost.totalUsd;
      pricedRequests += 1;
      provider.estimatedUsd += event.cost.totalUsd;
      provider.pricedRequests += 1;
    }
    providers.set(event.provider, provider);
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
    latency: summarizeLatency(durations),
    providers: [...providers.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([provider, summary]) => ({
        provider,
        attempts: summary.attempts,
        succeededAttempts: summary.succeededAttempts,
        failedAttempts: summary.failedAttempts,
        attemptSuccessRate:
          summary.attempts === 0
            ? 0
            : summary.succeededAttempts / summary.attempts,
        completedRequests: summary.completedRequests,
        tokens: {
          input: summary.inputTokens,
          output: summary.outputTokens,
          total: summary.inputTokens + summary.outputTokens,
        },
        cost: {
          currency: "USD",
          estimatedUsd: roundUsd(summary.estimatedUsd),
          pricedRequests: summary.pricedRequests,
        },
        latency: summarizeLatency(summary.durations),
      })),
  };
}
