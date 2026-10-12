# Contract and integration test coverage

The release gate uses Node's built-in test coverage and fails below 85% lines,
75% branches, or 80% functions. Run it after a locked install:

```bash
npm run coverage:check
```

The command compiles the TypeScript project into a temporary source-map-free
`coverage/` tree, runs the in-process compiled tests with
`--experimental-test-coverage`, parses LCOV records only for `coverage/src/`,
and enforces all three thresholds on Node 20 or newer. Filtering source records
keeps test-file coverage out of the aggregate even on Node versions that report
it by default. The dedicated build avoids a Node 20 coverage reporter failure
on TypeScript source maps without changing the distributable build.
`package.test.js` is run by
`npm run verify` but excluded from this second pass because its child-process
examples trigger a Node 20 coverage-reporting failure. The examples are still
exercised as release smoke tests; their process coverage is not merged into the
reported percentages.

## Measured result

Observed locally on 2026-10-12 with Node.js `v25.2.1`:

| Scope | Tests | Lines | Branches | Functions |
| --- | ---: | ---: | ---: | ---: |
| Executed source modules | 82 passed | 92.17% | 85.71% | 95.04% |

The report includes only modules executed by this suite. It must not be read as
evidence for real-provider adapters, a production HTTP host, external retrieval
quality, or authorized tool execution, none of which this repository claims to
implement.

## Contract coverage

- Request, response, streaming-event, error, retry, schema, and tool-call shapes.
- Package version synchronization, ESM exports, TypeScript declarations, and
  OpenAPI request-limit compatibility.
- SSE framing, cancellation, trace privacy, pricing, request IDs, and bounded
  input behavior.

## Integration coverage

- Two-provider fallback during failures, timeouts, and open circuits.
- Gateway composition with rate limiting, tracing, pricing, caching, and model
  routing using deterministic local adapters.
- Runnable dashboard, strategy, security, and RAG/agent-boundary examples.
- Dry-run npm archive inspection for runtime entry points and exclusion of tests,
  source, scripts, CI internals, and environment files.

The CI matrix runs the coverage gate on Node 20 and Node 22. Percentage changes
across V8 versions are acceptable only while all explicit minimums pass.
