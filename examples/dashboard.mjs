import {
  Gateway,
  GatewayError,
  InMemoryTraceSink,
  PricingCatalog,
  ScriptedMockAdapter,
  createEchoMockAdapter,
  renderTraceDashboard,
  summarizeTraceEvents,
} from "../dist/src/index.js";

function response(id, outputTokens) {
  return {
    id,
    model: "mock-small",
    message: { role: "assistant", content: "mock output" },
    finishReason: "stop",
    usage: { inputTokens: 3, outputTokens },
  };
}

const traces = new InMemoryTraceSink({ maxEvents: 100 });
const primary = new ScriptedMockAdapter("primary", [
  response("primary-1", 2),
  new GatewayError("unavailable", "planned mock outage"),
  response("primary-3", 4),
]);
let clockMs = 0;
let requestNumber = 0;
const gateway = new Gateway(
  [primary, createEchoMockAdapter("fallback", "fallback: ")],
  {
    maxAttemptsPerProvider: 1,
    now: () => {
      clockMs += 5;
      return clockMs;
    },
    createRequestId: () => `dashboard-${++requestNumber}`,
    traceSink: traces,
    pricingCatalog: new PricingCatalog([
      {
        provider: "primary",
        model: "mock-small",
        inputUsdPerMillionTokens: 2,
        outputUsdPerMillionTokens: 8,
      },
      {
        provider: "fallback",
        model: "mock-small",
        inputUsdPerMillionTokens: 1,
        outputUsdPerMillionTokens: 4,
      },
    ]),
  },
);

for (let index = 1; index <= 3; index += 1) {
  await gateway.generate({
    model: "mock-small",
    messages: [{ role: "user", content: `local request ${index}` }],
  });
}

console.log(
  renderTraceDashboard(summarizeTraceEvents(traces.snapshot()), {
    title: "Deterministic local mock dashboard",
  }),
);
