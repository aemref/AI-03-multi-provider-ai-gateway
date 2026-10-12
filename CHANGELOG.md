# Changelog

All notable changes to this project are recorded here. The project follows
[Semantic Versioning](https://semver.org/) and keeps pending work under
`Unreleased` until a release tag and package are actually published.

## [Unreleased]

### Added

- Provider-neutral generation and streaming contracts with deterministic mock
  adapters.
- Bounded retry, timeout, rate-limit, circuit-breaker, and fallback policies.
- Structured-output validation, tool-call validation, and SSE encoding.
- Content-safe tracing, cost estimation, local dashboards, caching, and model
  routing benchmarks.
- Redacted environment credentials and request limits enforced before gateway
  side effects.
- Automated package-content, metadata, test, and build checks for the first
  stable release candidate.

### Security

- Provider secrets are resolved only through explicit environment mappings and
  are redacted from common string, JSON, and inspection output.
- Message, model, metadata, and output-token bounds fail before provider calls,
  rate-limit consumption, or telemetry writes.

### Known limitations

- The repository contains deterministic local mock adapters, not integrations
  with external AI providers.
- The package supplies gateway primitives and an HTTP contract but does not run
  an HTTP server.
- Cost and latency examples are reproducibility fixtures, not production
  measurements.

[Unreleased]: https://github.com/aemref/AI-03-multi-provider-ai-gateway/compare/v0.1.0...HEAD
