import {
  CachingGateway,
  ExactRequestCache,
  Gateway,
  renderStrategyBenchmark,
  selectModelRoute,
  summarizeStrategyBenchmark,
} from "../dist/src/index.js";

const prompts = ["alpha", "alpha", "beta", "alpha", "gamma", "gamma"];
const providerLatencyMs = 40;
const cacheLatencyMs = 1;
const providerCostUsd = 0.005;

function createLocalGateway() {
  let calls = 0;
  return {
    gateway: new Gateway(
      [
        {
          name: "local-mock",
          async generate(request, context) {
            calls += 1;
            return {
              id: `response-${calls}`,
              model: request.model,
              message: { role: "assistant", content: "local fixture" },
              finishReason: "stop",
              usage: { inputTokens: 1_000, outputTokens: 500 },
            };
          },
        },
      ],
      { createRequestId: () => `request-${calls + 1}` },
    ),
    calls: () => calls,
  };
}

async function runCacheBenchmark() {
  const samples = [];
  const baseline = createLocalGateway();
  for (const prompt of prompts) {
    await baseline.gateway.generate({
      model: "mock-balanced",
      messages: [{ role: "user", content: prompt }],
    });
    samples.push({
      strategy: "no_cache",
      latencyMs: providerLatencyMs,
      estimatedCostUsd: providerCostUsd,
    });
  }

  const cachedProvider = createLocalGateway();
  const cached = new CachingGateway(
    cachedProvider.gateway,
    new ExactRequestCache({ capacity: 3, ttlMs: 60_000 }),
    { createRequestId: () => `cache-hit-${cached.stats.hits + 1}` },
  );
  for (const prompt of prompts) {
    const hitsBefore = cached.stats.hits;
    await cached.generate({
      model: "mock-balanced",
      messages: [{ role: "user", content: prompt }],
    });
    const cacheHit = cached.stats.hits > hitsBefore;
    samples.push({
      strategy: "exact_cache",
      latencyMs: cacheHit ? cacheLatencyMs : providerLatencyMs,
      estimatedCostUsd: cacheHit ? 0 : providerCostUsd,
      cacheHit,
    });
  }

  if (baseline.calls() !== 6 || cachedProvider.calls() !== 3) {
    throw new Error("Deterministic cache workload produced unexpected call counts");
  }
  return samples;
}

const routes = [
  {
    model: "mock-balanced",
    inputUsdPerMillionTokens: 2,
    outputUsdPerMillionTokens: 6,
    estimatedLatencyMs: 40,
  },
  {
    model: "mock-economy",
    inputUsdPerMillionTokens: 0.5,
    outputUsdPerMillionTokens: 1,
    estimatedLatencyMs: 70,
  },
  {
    model: "mock-fast",
    inputUsdPerMillionTokens: 4,
    outputUsdPerMillionTokens: 10,
    estimatedLatencyMs: 15,
  },
];

const routingWorkload = [
  { inputTokens: 1_000, outputTokens: 500 },
  { inputTokens: 200, outputTokens: 100 },
  { inputTokens: 4_000, outputTokens: 250 },
];

const routingStrategies = [
  "ordered",
  "lowest_estimated_cost",
  "lowest_estimated_latency",
];

function runRoutingBenchmark() {
  return routingStrategies.flatMap((strategy) =>
    routingWorkload.map((estimate) => {
      const selection = selectModelRoute(routes, estimate, strategy);
      return {
        strategy,
        latencyMs: selection.route.estimatedLatencyMs,
        estimatedCostUsd: selection.estimatedCostUsd,
      };
    }),
  );
}

const cacheSamples = await runCacheBenchmark();
const routingSamples = runRoutingBenchmark();

console.log("# Deterministic local strategy benchmark\n");
console.log(
  "Simulated latency and catalog cost estimates over local mock calls; no external provider was contacted.\n",
);
console.log(
  renderStrategyBenchmark(
    "Exact-cache workload",
    summarizeStrategyBenchmark(cacheSamples),
  ),
);
console.log();
console.log(
  renderStrategyBenchmark(
    "Model-routing workload",
    summarizeStrategyBenchmark(routingSamples),
  ),
);
