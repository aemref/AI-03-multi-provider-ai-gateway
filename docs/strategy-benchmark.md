# Cache and model-routing benchmark

This benchmark compares gateway strategies with deterministic local fixtures.
It exercises the exported cache, caching gateway, routing, aggregation, and
Markdown rendering APIs. It does not call or emulate the availability of an
external model provider.

Run it with:

```bash
npm run demo:benchmark
```

## Workloads

The exact-cache workload sends six requests with three distinct prompts. The
bounded cache has capacity for all three keys and a 60-second TTL. Cache misses
use a fixed local profile of 40 ms and $0.005; hits use a 1 ms lookup profile
and no provider cost. These are explicit simulation inputs, not wall-clock
measurements or current vendor prices.

The routing workload applies three token estimates to three local model
profiles:

- `ordered` keeps the caller's first route.
- `lowest_estimated_cost` minimizes catalog-priced input and output tokens.
- `lowest_estimated_latency` minimizes the configured latency estimate.

Route order resolves ties, so the result is reproducible. Hosts remain
responsible for refreshing prices and latency profiles and for deciding whether
quality, context length, geography, or compliance rules exclude a route.

## Measured local result

Observed on 2026-10-05 from the checked-in workload:

| Workload | Strategy | Requests | Cache hits | p50 ms | p95 ms | Estimated USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| cache | `no_cache` | 6 | 0 | 40 | 40 | $0.030000 |
| cache | `exact_cache` | 6 | 3 | 1 | 40 | $0.015000 |
| routing | `ordered` | 3 | 0 | 40 | 40 | $0.015500 |
| routing | `lowest_estimated_cost` | 3 | 0 | 70 | 70 | $0.003450 |
| routing | `lowest_estimated_latency` | 3 | 0 | 15 | 15 | $0.029300 |

The cache fixture avoided three of six mock provider calls. The routing fixture
shows the intended trade-off: the lowest configured cost and lowest configured
latency select different routes. Results only prove deterministic policy and
aggregation behavior for the checked-in inputs.

## Cache boundary

The cache key covers model, ordered messages, generation controls, and sorted
metadata keys. Cached values retain the provider response ID but receive a new
gateway request ID on every hit. Failed and already-aborted requests are not
cached. The current cache is process-local and is intended for explicit
exact-match use; it does not provide distributed invalidation, semantic
matching, streaming replay, or tenant isolation.
