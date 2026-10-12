# RAG and agent integration guide

This package belongs between an application orchestrator and one or more AI
provider adapters. The application remains responsible for retrieval, prompt
construction, authorization, tool execution, persistence, and user-visible
citations. The gateway owns the bounded provider call, fallback policy, request
identity, validation, and content-safe telemetry.

## RAG request flow

1. Retrieve documents in the host application and retain their stable source
   identifiers, license metadata, and language.
2. Treat retrieved text as untrusted data. Delimit it from instructions, apply
   application-specific size and leakage checks, and never copy credentials into
   messages or metadata.
3. Send the grounded messages through `Gateway.generate()` or `Gateway.stream()`.
   Keep the gateway request limits at or below the HTTP boundary documented in
   `openapi.yaml`.
4. Build user-visible citations from the retrieved source map. Do not treat a
   model-generated citation string as proof that a source was retrieved.
5. Store the caller-visible `requestId` with retrieval and evaluation records so
   failures can be correlated without logging prompt content.

The runnable local example uses one fixed document and a mock provider:

```bash
npm run demo:integration
```

It demonstrates the boundary and output shape only. It does not measure
retrieval quality or contact an external model.

## Agent tool flow

Provider output must not directly invoke application tools. Convert a proposed
tool call into the portable `{ id, name, argumentsJson }` shape, then pass it to
`ToolRegistry.validate()`. An unknown tool or schema violation fails closed.

Validation is not authorization. After validation, the host must independently:

1. map the authenticated user to an allowlist and permission level;
2. require human approval for sensitive or irreversible actions;
3. execute with a timeout, idempotency key, and least-privilege credential;
4. redact the result before adding a `tool` message to model context; and
5. audit the decision and outcome without storing secrets or unnecessary
   personal data.

The example deliberately reports `toolExecuted: false`: it proves schema
validation without pretending that an authorization or execution layer exists.

## Failure and streaming boundaries

- Use a stable adapter order or a documented model-routing policy. Fallback can
  change provider behavior, so evaluation records should include `provider` and
  `model`.
- Streaming fallback is safe only before the first emitted event. Once output is
  visible, an error terminates that stream rather than splicing providers.
- Propagate caller cancellation and set a host-level request deadline in
  addition to the gateway's per-attempt timeout.
- Retry only transient failures. Authentication, invalid input, schema errors,
  and denied tool actions must fail without provider rotation.

## Production checklist

- Supply real adapters outside this package and load credentials through an
  explicit secret manager or environment mapping.
- Apply authentication, quotas, abuse controls, and body-size limits at the HTTP
  host before calling the gateway.
- Configure a pricing catalog rather than assuming the local examples represent
  current provider prices.
- Run retrieval, grounded-answer, tool-misuse, and prompt-injection evaluations
  in the consuming repository. This gateway's local mock suite is not evidence
  for those application-level outcomes.
