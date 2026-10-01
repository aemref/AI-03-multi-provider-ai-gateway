# Observability contract

The gateway emits provider-neutral lifecycle events through an injected
`TraceSink`. Events correlate on `requestId` and report operation, model,
provider, attempt number, elapsed milliseconds, token usage, estimated USD cost,
and normalized failure kinds. Prompt messages, generated text, request metadata,
error messages, credentials, and raw exception causes are deliberately excluded.

## Quick start

```ts
import {
  Gateway,
  InMemoryTraceSink,
  PricingCatalog,
  createEchoMockAdapter,
} from "multi-provider-ai-gateway";

const traceSink = new InMemoryTraceSink();
const gateway = new Gateway([createEchoMockAdapter("mock", "echo: ")], {
  traceSink,
  pricingCatalog: new PricingCatalog([
    {
      provider: "mock",
      model: "mock-small",
      inputUsdPerMillionTokens: 2,
      outputUsdPerMillionTokens: 8,
    },
  ]),
});

await gateway.generate({
  model: "mock-small",
  messages: [{ role: "user", content: "hello" }],
});
console.log(traceSink.snapshot());
```

After `npm run build`, run `npm run demo:observability` for a complete local
trace using the mock adapter. Pricing is configuration supplied by the host; the
package does not ship vendor prices that can silently become stale. Unknown
provider/model pairs still report usage but omit the cost estimate.

## Event sequence

```mermaid
sequenceDiagram
    participant C as Caller
    participant G as Gateway
    participant P as Provider
    participant T as Trace sink
    C->>G: generate or stream
    G->>T: request.started
    G->>T: provider.attempt.started
    G->>P: provider request
    alt provider succeeds
        P-->>G: response or stream
        G->>T: provider.attempt.succeeded
        G->>T: request.completed + usage/cost
        G-->>C: result
    else provider fails
        P-->>G: classified failure
        G->>T: provider.attempt.failed
        G->>T: request.failed if terminal
        G-->>C: fallback or error
    end
```

Trace sinks are best-effort: exceptions thrown by a sink are ignored so a
monitoring outage cannot become a serving outage. `InMemoryTraceSink` is intended
for tests, examples, and bounded local inspection; production hosts should send
events to a bounded, non-blocking collector and define their own retention.

Costs are arithmetic estimates from reported token counts, rounded to 12 decimal
places. They are not invoices and do not include provider-specific discounts,
cached-token rules, taxes, or non-token charges.
