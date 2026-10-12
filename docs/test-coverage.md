# Contract and integration test coverage

The release gate uses Node's built-in test coverage and fails below 85% lines,
75% branches, or 80% functions. Run it after a locked install:

```bash
npm run coverage:check
```

The command compiles the TypeScript project, discovers every compiled
`dist/tests/*.test.js` file, runs the suite with
`--experimental-test-coverage`, parses the aggregate row, and enforces all three
thresholds on Node 20 or newer.

## Measured result

Observed locally on 2026-10-12 with Node.js `v25.2.1`:

| Scope | Tests | Lines | Branches | Functions |
| --- | ---: | ---: | ---: | ---: |
| Executed source and examples | 89 passed | 93.54% | 86.69% | 94.94% |

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
