import {
  EnvironmentCredentialSource,
  Gateway,
  GatewayError,
} from "../dist/src/index.js";

const source = new EnvironmentCredentialSource({
  providers: { local: "LOCAL_EXAMPLE_KEY" },
  environment: { LOCAL_EXAMPLE_KEY: "local-example-secret" },
});
const credential = source.get("local");
let providerCalls = 0;
const adapter = {
  name: "local",
  async generate(request) {
    providerCalls += 1;
    return {
      id: "unexpected",
      model: request.model,
      message: { role: "assistant", content: "unexpected" },
      finishReason: "stop",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  },
};
const gateway = new Gateway([adapter], {
  requestLimits: { maxMessageCharacters: 8 },
});

let oversizedRequestRejected = false;
try {
  await gateway.generate({
    model: "mock-small",
    messages: [{ role: "user", content: "too many characters" }],
  });
} catch (error) {
  oversizedRequestRejected =
    error instanceof GatewayError && error.kind === "invalid_request";
}

console.log(
  JSON.stringify(
    {
      credentialRedacted:
        JSON.stringify({ credential }) === '{"credential":"[REDACTED]"}',
      oversizedRequestRejected,
      providerCalls,
    },
    null,
    2,
  ),
);
