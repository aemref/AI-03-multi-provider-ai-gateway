# AI-03 Multi-Provider AI Gateway

[![CI](https://github.com/aemref/AI-03-multi-provider-ai-gateway/actions/workflows/ci.yml/badge.svg)](https://github.com/aemref/AI-03-multi-provider-ai-gateway/actions/workflows/ci.yml)

A provider-neutral TypeScript gateway focused on explicit contracts, bounded
retries, observable failures, and deterministic resilience tests. The project
uses mock providers only: it needs no API keys, paid services, or network calls
at runtime.

## Development

Requirements: Node.js 20 or newer.

```bash
npm ci
npm run verify
npm run pack:check
```

## Local example

```ts
import {
  CircuitBreaker,
  Gateway,
  TokenBucketRateLimiter,
  createEchoMockAdapter,
  withCircuitBreaker,
} from "multi-provider-ai-gateway";

const primary = withCircuitBreaker(
  createEchoMockAdapter("primary", "primary: "),
  new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 30_000 }),
);
const fallback = createEchoMockAdapter("fallback", "fallback: ");
const gateway = new Gateway([primary, fallback], {
  timeoutMs: 2_000,
  maxAttemptsPerProvider: 2,
  rateLimiter: new TokenBucketRateLimiter({
    capacity: 10,
    refillPerSecond: 2,
  }),
});

const response = await gateway.generate({
  model: "mock-small",
  messages: [{ role: "user", content: "hello" }],
});
console.log(response.provider, response.message.content);
```

See the [architecture](docs/architecture.md) for policy order, failure semantics,
and limitations. The [OpenAPI description](docs/openapi.yaml) specifies the HTTP
boundary a host application can expose. Runnable [curl](examples/curl-client.sh)
and [Node.js](examples/node-client.mjs) streaming clients target that boundary.
The package deliberately does not start a server.

## Streaming and validation

`Gateway.stream()` emits provider-labelled `delta`, `usage`, and `done` events.
`createSseResponse()` converts that async iterable into an unbuffered UTF-8 SSE
response and closes the upstream iterator when the client disconnects. Fallback
is allowed only before the first event, preventing two providers from being
spliced into one answer.

`parseStructuredOutput()` validates JSON against the documented schema subset:
types, objects, required properties, additional-property policy, arrays, enums,
string lengths, and numeric bounds. `ToolRegistry` applies the same validation
to registered tool calls and rejects unknown tool names before execution. This
is intentionally a focused subset, not a complete JSON Schema implementation.

## Current foundation

- Shared provider request, response, context, and failure contracts.
- Bounded timeout and capped exponential retry behavior.
- Ordered fallback with two deterministic mock adapter implementations.
- Process-local token-bucket rate limiting.
- Closed/open/half-open circuit breaking with a single recovery probe.
- Chaos tests for outage, circuit recovery, and a provider that hangs.
- Bounded streaming with caller cancellation and safe pre-output fallback.
- SSE response encoding with deterministic event contracts.
- Structured-output and registered tool-call validation.

Cost observability, routing benchmarks, and real provider adapters remain
explicitly tracked in the [technical roadmap](docs/roadmap.md).

## License

MIT
