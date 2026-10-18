# Local verification

Observed locally on 2026-10-18 with Node.js `v25.2.1` and npm `11.6.2`:

```text
npm ci -> 3 packages installed from the lockfile
npm audit --audit-level=high -> 0 vulnerabilities
npm run verify -> typecheck, build, 92 passed, 0 failed
npm run coverage:check -> 84 passed; 92.17% lines, 85.71% branches, 95.04% functions
npm run demo:observability -> request, usage, latency, cost, and trace emitted
npm run demo:dashboard -> 3 requests, 1 fallback, 14 tokens, $0.000065 estimated
npm run demo:benchmark -> 50% cache hit rate; 3 routing strategies compared
npm run demo:security -> credential redacted; oversized input rejected; 0 provider calls
npm run demo:integration -> grounded mock response; tool validated but not executed
npm run pack:check -> 87 files, 46.7 kB tarball
npm run release:check -- v1.0.0 -> synchronized release metadata and tag
node --check for examples/*.mjs and scripts/*.mjs -> 9 passed
sh -n examples/curl-client.sh -> passed
Ruby YAML parse + OpenAPI path assertion -> passed
package.json and package-lock.json JSON parse -> passed
git diff --check -> passed
```

GitHub Actions run `39121876662` passed the Node.js 20 and 22 CI matrix on
commit `4c89b8d`. Tag workflow run `39121930068` repeated the release gates and
published the non-draft, non-prerelease `v1.0.0` GitHub release. Its
`multi-provider-ai-gateway-1.0.0.tgz` asset is 46,785 bytes with GitHub-reported
SHA-256 digest
`c6a647de5e731be2e7ec60e10bc547cd0936165cbdf45447819bae160856e1d0`.
The annotated tag and remote `main` both resolve to `4c89b8d` at release time.

`npm whoami` returned `ENEEDAUTH`, and the registry lookup returned `E404` for
the package name on 2026-10-18. No npm registry publication is claimed.

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

Release tests synchronize the package, lockfile, exported, and OpenAPI versions;
pin the ESM and declaration entry points; and exercise every deterministic local
example. The dry-run archive gate requires runtime code, declarations,
documentation, examples, license, and changelog while excluding TypeScript
source, tests, scripts, CI internals, and environment files. The RAG/agent
example verifies citation-ID propagation and tool-call schema validation while
explicitly proving that no tool was authorized or executed.

These are local mock measurements. They do not establish external provider
availability, throughput, latency, cost, or production readiness.
