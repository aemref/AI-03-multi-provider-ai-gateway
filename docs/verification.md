# Local verification

Observed locally on 2026-10-11 with Node.js `v25.2.1` and npm `11.6.2`:

```text
npm ci -> 3 packages installed from the lockfile
npm audit --audit-level=high -> 0 vulnerabilities
npm run verify -> typecheck, build, 87 passed, 0 failed
npm run demo:observability -> request, usage, latency, cost, and trace emitted
npm run demo:dashboard -> 3 requests, 1 fallback, 14 tokens, $0.000065 estimated
npm run demo:benchmark -> 50% cache hit rate; 3 routing strategies compared
npm run demo:security -> credential redacted; oversized input rejected; 0 provider calls
npm run pack:check -> 82 files, 42.0 kB tarball
node --check examples/node-client.mjs -> passed
node --check examples/observability.mjs -> passed
node --check examples/dashboard.mjs -> passed
node --check examples/strategy-benchmark.mjs -> passed
node --check examples/security.mjs -> passed
sh -n examples/curl-client.sh -> passed
Ruby YAML parse + OpenAPI path assertion -> passed
git diff --check -> passed
```

The test suite includes contract compatibility, failure classification, capped
retry delays, timeout containment, two-provider fallback, deterministic token
refill, circuit opening/recovery, and composed chaos scenarios. The chaos tests
verify both open-circuit traffic shedding and fallback after a primary provider
hangs. Streaming tests cover pre-output fallback, partial-output isolation,
caller cancellation, SSE framing, and iterator cleanup. Validation tests cover
nested structured output, actionable error paths, enums, numeric constraints,
unknown tools, and invalid tool arguments.

Observability tests verify public request IDs, deterministic attempt and
end-to-end timings, generate and stream usage, provider/model cost selection,
fallback failures, cancellation, bounded trace retention, trace-sink isolation,
and the absence of prompt or metadata fields from trace contracts. Aggregation
tests cover terminal counts, pricing coverage, provider attempts, nearest-rank
latency percentiles, empty inputs, and deterministic Markdown rendering. Both
runnable examples use only local mock adapters; their observed latency is
smoke-test evidence, not a benchmark.

Cache tests cover TTL expiry, LRU eviction, canonical metadata keys, successful
response reuse, fresh request IDs, failure exclusion, and pre-aborted callers.
Routing tests cover ordered, estimated-cost, and estimated-latency selection,
deterministic ties, malformed profiles, summary percentiles, and stable Markdown.
The checked-in strategy workload uses explicit simulated latency and catalog
cost inputs; it is reproducibility evidence for policy behavior, not a provider
performance measurement.

Security tests cover explicit provider-to-environment mapping, missing and empty
credentials, redaction from strings, JSON, and Node inspection, limit
configuration, individual and aggregate message bounds, numeric controls,
metadata limits, and rejection before rate limiting, traces, or provider calls.
The OpenAPI checks pin the matching HTTP boundary and response request ID.

These are local mock measurements. They do not establish external provider
availability, throughput, latency, cost, or production readiness.
