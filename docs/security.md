# Security checklist

This library provides local safety primitives but does not turn a host
application into a complete security boundary. Hosts remain responsible for
authentication, authorization, tenant quotas, network controls, dependency
updates, incident response, and provider-specific credential rotation.

## Credentials

- Map each provider explicitly to one environment variable with
  `EnvironmentCredentialSource`; the source never copies or enumerates the full
  environment.
- Keep credentials inside `SecretValue` until an adapter builds its outbound
  authorization header. `String()`, JSON serialization, and Node inspection are
  redacted, while `use()` is the deliberate access boundary.
- Do not place secrets in request messages, metadata, errors, traces, fixtures,
  command lines, or committed `.env` files.
- Treat process environment variables as a local baseline, not a production
  secret manager. Production hosts should inject short-lived credentials from
  their platform's managed secret service and rotate them outside this package.
- Missing, empty, or unmapped credentials fail closed as `authentication`
  errors without naming the environment variable or exposing its value.

## Request limits

`Gateway` validates every generate and stream request before rate limiting,
request-ID creation, tracing, or provider work. Defaults bound model names,
message count, individual and aggregate message content, message names, output
tokens, and metadata count/key/value sizes. Numeric controls must also be finite
and valid. Hosts can explicitly override these limits with the `requestLimits`
constructor option.

These are character and declared-output-token bounds, not provider tokenization,
HTTP byte limits, or distributed quotas. An HTTP host should also cap body bytes,
enforce content types, authenticate before expensive parsing, and apply
per-tenant concurrency and spend controls.

## Verification

Run the local evidence command after building:

```bash
npm run demo:security
```

It loads an injected fake credential, verifies redacted serialization, rejects
an oversized request, and proves that the provider received zero calls. It uses
no real credential, external provider, network request, or paid resource.
