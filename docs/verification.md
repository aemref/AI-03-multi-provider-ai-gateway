# Local verification

Observed locally on 2026-09-30 with Node.js `v25.2.1` and npm `11.6.2`:

```text
npm run verify -> typecheck, build, 39 passed, 0 failed
npm run pack:check -> 42 files, 18.8 kB tarball
node --check examples/node-client.mjs -> passed
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

These are local mock measurements. They do not establish external provider
availability, throughput, latency, cost, or production readiness.
