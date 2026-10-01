import {
  Gateway,
  InMemoryTraceSink,
  PricingCatalog,
  createEchoMockAdapter,
} from "../dist/src/index.js";

const traces = new InMemoryTraceSink();
const gateway = new Gateway([createEchoMockAdapter("mock", "echo: ")], {
  traceSink: traces,
  pricingCatalog: new PricingCatalog([
    {
      provider: "mock",
      model: "mock-small",
      inputUsdPerMillionTokens: 2,
      outputUsdPerMillionTokens: 8,
    },
  ]),
});

const response = await gateway.generate({
  model: "mock-small",
  messages: [{ role: "user", content: "hello" }],
});
const completion = traces
  .snapshot()
  .find((event) => event.type === "request.completed");

console.log(
  JSON.stringify(
    {
      requestId: response.requestId,
      provider: response.provider,
      usage: response.usage,
      latencyMs: completion?.durationMs,
      estimatedCost: completion?.cost,
      trace: traces.snapshot(),
    },
    null,
    2,
  ),
);
