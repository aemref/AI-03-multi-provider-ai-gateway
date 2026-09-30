# Technical roadmap

This repository follows the technical AI-03 scope in the portfolio roadmap.
Certification, speaking, application, and other human-participation goals are
intentionally outside this plan.

## 1. Gateway design and resilience

- [x] Define a provider adapter interface and shared request/response schema.
- [x] Classify failures and add timeout plus retry/backoff policies.
- [x] Verify fallback behavior with two mock adapters.
- [x] Add rate limiting, circuit breaking, and deterministic chaos tests.
- [x] Publish an architecture diagram and measured verification evidence.

## 2. Streaming and structured output

- [x] Add SSE streaming and cancellation support.
- [x] Validate structured output and tool-calling schemas.
- [x] Publish OpenAPI documentation and sample clients.

## 3. Cost and observability

- [ ] Track tokens, cost, latency, request IDs, and traces.
- [ ] Benchmark caching and model-routing strategies.
- [ ] Apply secret-management and input-limit security checks.

## 4. Release

- [ ] Package the gateway for npm with SemVer and a changelog.
- [ ] Report contract and integration test coverage.
- [ ] Publish an integration guide and verified v1.0.0 release.
