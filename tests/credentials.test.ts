import assert from "node:assert/strict";
import { inspect } from "node:util";
import test from "node:test";

import {
  EnvironmentCredentialSource,
  SecretValue,
} from "../src/credentials.js";
import { GatewayError } from "../src/errors.js";

test("resolves only explicitly mapped environment credentials", () => {
  const source = new EnvironmentCredentialSource({
    providers: { primary: "PRIMARY_API_KEY" },
    environment: {
      PRIMARY_API_KEY: "super-secret",
      UNRELATED_API_KEY: "must-not-be-copied",
    },
  });

  assert.equal(source.get("primary").use((value) => value), "super-secret");
  assert.throws(
    () => source.get("unrelated"),
    (error: unknown) =>
      error instanceof GatewayError &&
      error.kind === "authentication" &&
      error.provider === "unrelated",
  );
});

test("redacts credentials from strings, JSON, and Node inspection", () => {
  const credential = new SecretValue("super-secret");

  assert.equal(String(credential), "[REDACTED]");
  assert.equal(JSON.stringify({ credential }), '{"credential":"[REDACTED]"}');
  assert.equal(inspect(credential), "[REDACTED]");
  assert.doesNotMatch(inspect(credential), /super-secret/u);
});

test("fails closed for missing or empty credentials", () => {
  const source = new EnvironmentCredentialSource({
    providers: { primary: "PRIMARY_API_KEY" },
    environment: { PRIMARY_API_KEY: "" },
  });

  assert.throws(
    () => source.get("primary"),
    (error: unknown) =>
      error instanceof GatewayError &&
      error.kind === "authentication" &&
      !error.message.includes("PRIMARY_API_KEY"),
  );
  assert.throws(() => new SecretValue(""), GatewayError);
});

test("rejects unsafe environment variable mappings", () => {
  assert.throws(
    () =>
      new EnvironmentCredentialSource({
        providers: { primary: "primary-key" },
        environment: {},
      }),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
});
