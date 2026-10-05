import { GatewayError } from "./errors.js";

export interface StrategyBenchmarkSample {
  readonly strategy: string;
  readonly latencyMs: number;
  readonly estimatedCostUsd: number;
  readonly cacheHit?: boolean;
}

export interface StrategyBenchmarkSummary {
  readonly strategy: string;
  readonly requests: number;
  readonly cacheHits: number;
  readonly cacheHitRate: number;
  readonly latencyP50Ms: number;
  readonly latencyP95Ms: number;
  readonly estimatedCostUsd: number;
}

function percentile(sorted: readonly number[], percentileValue: number): number {
  const index = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function roundUsd(value: number): number {
  return Number(value.toFixed(12));
}

export function summarizeStrategyBenchmark(
  samples: readonly StrategyBenchmarkSample[],
): readonly StrategyBenchmarkSummary[] {
  const grouped = new Map<string, StrategyBenchmarkSample[]>();
  for (const sample of samples) {
    if (sample.strategy.length === 0) {
      throw new GatewayError("invalid_request", "Benchmark strategy is required");
    }
    if (!Number.isFinite(sample.latencyMs) || sample.latencyMs < 0) {
      throw new GatewayError(
        "invalid_request",
        "Benchmark latency must be a finite non-negative number",
      );
    }
    if (!Number.isFinite(sample.estimatedCostUsd) || sample.estimatedCostUsd < 0) {
      throw new GatewayError(
        "invalid_request",
        "Benchmark cost must be a finite non-negative number",
      );
    }
    const strategySamples = grouped.get(sample.strategy) ?? [];
    strategySamples.push(sample);
    grouped.set(sample.strategy, strategySamples);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([strategy, strategySamples]) => {
      const latencies = strategySamples
        .map((sample) => sample.latencyMs)
        .sort((left, right) => left - right);
      const cacheHits = strategySamples.filter(
        (sample) => sample.cacheHit === true,
      ).length;
      return {
        strategy,
        requests: strategySamples.length,
        cacheHits,
        cacheHitRate: cacheHits / strategySamples.length,
        latencyP50Ms: percentile(latencies, 0.5),
        latencyP95Ms: percentile(latencies, 0.95),
        estimatedCostUsd: roundUsd(
          strategySamples.reduce(
            (total, sample) => total + sample.estimatedCostUsd,
            0,
          ),
        ),
      };
    });
}

export function renderStrategyBenchmark(
  title: string,
  summaries: readonly StrategyBenchmarkSummary[],
): string {
  const rows = summaries.map(
    (summary) =>
      `| ${summary.strategy.replaceAll("|", "\\|")} | ${summary.requests} | ${summary.cacheHits} | ${(summary.cacheHitRate * 100).toFixed(1)}% | ${summary.latencyP50Ms} | ${summary.latencyP95Ms} | $${summary.estimatedCostUsd.toFixed(6)} |`,
  );
  return [
    `## ${title}`,
    "",
    "| Strategy | Requests | Cache hits | Hit rate | p50 ms | p95 ms | Estimated USD |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
  ].join("\n");
}
