# Foundation verification

Observed locally on 2026-09-29 with Node.js `v25.2.1` and npm `11.6.2`:

```text
npm run check  -> passed
npm test       -> 21 passed, 0 failed
git diff --check -> passed
```

The test suite includes contract compatibility, failure classification, capped
retry delays, timeout containment, two-provider fallback, deterministic token
refill, circuit opening/recovery, and composed chaos scenarios. The chaos tests
verify both open-circuit traffic shedding and fallback after a primary provider
hangs.

These are local mock measurements. They do not establish external provider
availability, throughput, latency, cost, or production readiness.

