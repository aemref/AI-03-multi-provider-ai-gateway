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
npm run coverage:check
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

## Cost and observability

Every accepted request has a caller-visible request ID. An optional `TraceSink`
records request and provider-attempt timing for generation and streaming without
capturing prompts, generated text, metadata, credentials, or raw errors. A
host-supplied `PricingCatalog` converts reported tokens into an estimated USD
cost without baking changeable vendor prices into the package.

See the [observability contract](docs/observability.md) for the event sequence,
privacy boundary, aggregation rules, cost limitations, and runnable mock traces.
`npm run demo:dashboard` renders a bounded local Markdown dashboard with request,
token, estimated-cost, latency, and provider-attempt evidence.

`npm run demo:benchmark` compares an exact-request cache with an uncached local
mock workload and compares ordered, lowest-cost, and lowest-latency model
routing. See the [strategy benchmark](docs/strategy-benchmark.md) for its fixed
inputs, measured output, and limits.

## Security boundaries

`EnvironmentCredentialSource` resolves only explicitly mapped provider
credentials and wraps them in a `SecretValue` that redacts common string, JSON,
and inspection output. `Gateway` applies configurable message, metadata, model,
and output-token limits before any rate-limit, trace, or provider side effect.
Run `npm run demo:security` for local evidence and review the [security
checklist](docs/security.md) before integrating a real adapter.

## Release readiness

Version `1.0.0` is published as a verified [GitHub
release](https://github.com/aemref/AI-03-multi-provider-ai-gateway/releases/tag/v1.0.0)
with an attached npm-format package. The matching tag passed the [release
policy](docs/releasing.md), deterministic package inspection, and enforced [test
coverage report](docs/test-coverage.md). Publication to the npm registry is not
claimed because this repository has no authenticated registry publisher.

The [RAG and agent integration guide](docs/integration-guide.md) separates
gateway responsibilities from retrieval, citation, authorization, and tool
execution. Run `npm run demo:integration` for its local mock evidence.

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
- Request IDs plus content-safe latency, usage, cost, retry, and failure traces.
- Bounded local trace retention, aggregation, and a Markdown cost/latency dashboard.
- Bounded exact-request caching and deterministic model-routing benchmarks.
- Redacted environment credentials and fail-closed credential lookup.
- Default request limits enforced before gateway side effects.
- Synchronized SemVer metadata and bounded dry-run package inspection.
- Enforced coverage thresholds and an executable RAG/agent boundary example.

Real provider adapters and npm registry publication remain explicitly outside
the verified local mock and GitHub release scope.

## License

MIT
