# AI-03 Multi-Provider AI Gateway

A provider-neutral TypeScript gateway focused on explicit contracts, bounded
retries, observable failures, and deterministic resilience tests. The project
uses mock providers only: it needs no API keys, paid services, or network calls
at runtime.

## Development

Requirements: Node.js 20 or newer.

```bash
npm ci
npm run verify
```

The repository is in its first roadmap phase. Provider contracts, fallback,
rate limiting, circuit breaking, and chaos tests will be added as independently
tested increments before any real provider integration.

## License

MIT

