import assert from "node:assert/strict";
import test from "node:test";

import { GatewayError } from "../src/errors.js";
import {
  parseStructuredOutput,
  type JsonSchema,
  validateStructuredOutput,
} from "../src/schema.js";

const answerSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "confidence", "citations"],
  properties: {
    answer: { type: "string", minLength: 1, maxLength: 100 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source"],
        properties: { source: { type: "string", minLength: 1 } },
      },
    },
  },
};

test("accepts nested structured output that satisfies the schema", () => {
  const value = {
    answer: "Istanbul",
    confidence: 0.9,
    citations: [{ source: "atlas" }],
  };

  assert.deepEqual(validateStructuredOutput(value, answerSchema), {
    valid: true,
    issues: [],
  });
  assert.deepEqual(parseStructuredOutput(JSON.stringify(value), answerSchema), value);
});

test("reports every actionable path in invalid structured output", () => {
  const result = validateStructuredOutput(
    {
      answer: "",
      confidence: 1.5,
      citations: [{ source: 42, extra: true }],
      debug: "not allowed",
    },
    answerSchema,
  );

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    ["$.answer", "$.confidence", "$.citations[0].source", "$.citations[0].extra", "$.debug"],
  );
});

test("rejects malformed JSON as an invalid provider response", () => {
  assert.throws(
    () => parseStructuredOutput('{"answer":', answerSchema),
    (error: unknown) =>
      error instanceof GatewayError &&
      error.kind === "invalid_response" &&
      error.retryable === false,
  );
});

test("supports exact enum values and integer constraints", () => {
  const schema: JsonSchema = {
    type: "object",
    required: ["status", "count"],
    properties: {
      status: { type: "string", enum: ["ready", "blocked"] },
      count: { type: "integer", minimum: 0 },
    },
  };

  assert.equal(
    validateStructuredOutput({ status: "ready", count: 2 }, schema).valid,
    true,
  );
  assert.equal(
    validateStructuredOutput({ status: "unknown", count: 2.5 }, schema).valid,
    false,
  );
});
