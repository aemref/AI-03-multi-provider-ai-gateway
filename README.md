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
and limitations. The [verification record](docs/verification.md) describes the
locally measured test evidence; it makes no external-provider claims.

## Current foundation

- Shared provider request, response, context, and failure contracts.
- Bounded timeout and capped exponential retry behavior.
- Ordered fallback with two deterministic mock adapter implementations.
- Process-local token-bucket rate limiting.
- Closed/open/half-open circuit breaking with a single recovery probe.
- Chaos tests for outage, circuit recovery, and a provider that hangs.

Streaming, structured output, observability, and real provider adapters remain
explicitly tracked in the [technical roadmap](docs/roadmap.md).

## License

MIT
