import type { TraceLatencySummary, TraceSummary } from "./trace-summary.js";

export interface TraceDashboardOptions {
  readonly title?: string;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function usd(value: number): string {
  return `$${value.toFixed(12)}`;
}

function milliseconds(value: number | null): string {
  return value === null ? "n/a" : `${value} ms`;
}

function latencyLine(latency: TraceLatencySummary): string {
  return `p50 ${milliseconds(latency.p50Ms)} · p95 ${milliseconds(latency.p95Ms)} · max ${milliseconds(latency.maxMs)} (${latency.samples} samples)`;
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderTraceDashboard(
  summary: TraceSummary,
  options: TraceDashboardOptions = {},
): string {
  const lines = [
    `# ${options.title ?? "Gateway trace dashboard"}`,
    "",
    `- Requests: ${summary.requests.requests} total · ${summary.requests.completed} completed · ${summary.requests.failed} failed · ${percent(summary.requests.successRate)} success`,
    `- Tokens: ${summary.tokens.total} total (${summary.tokens.input} input / ${summary.tokens.output} output)`,
    `- Estimated cost: ${usd(summary.cost.estimatedUsd)} USD (${summary.cost.pricedRequests}/${summary.requests.completed} completed requests priced)`,
    `- Request latency: ${latencyLine(summary.latency)}`,
    "",
    "| Provider | Attempts | Attempt success | Completed | Tokens | Estimated cost | Attempt latency |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  if (summary.providers.length === 0) {
    lines.push("| _none_ | 0 | 0.0% | 0 | 0 | $0.000000000000 | n/a |");
  } else {
    for (const provider of summary.providers) {
      lines.push(
        `| ${markdownCell(provider.provider)} | ${provider.attempts} | ${percent(provider.attemptSuccessRate)} | ${provider.completedRequests} | ${provider.tokens.total} | ${usd(provider.cost.estimatedUsd)} | ${latencyLine(provider.latency)} |`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
