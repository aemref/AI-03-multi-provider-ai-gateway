import assert from "node:assert/strict";
import test from "node:test";

import { GatewayError } from "../src/errors.js";
import { ToolRegistry, type ToolDefinition } from "../src/tools.js";

const weatherTool: ToolDefinition = {
  name: "get_weather",
  description: "Read a local weather fixture",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["city", "units"],
    properties: {
      city: { type: "string", minLength: 1 },
      units: { type: "string", enum: ["metric", "imperial"] },
    },
  },
};

test("parses and validates arguments for a registered tool", () => {
  const registry = new ToolRegistry([weatherTool]);

  assert.deepEqual(
    registry.validate({
      id: "call-1",
      name: "get_weather",
      argumentsJson: '{"city":"Istanbul","units":"metric"}',
    }),
    {
      id: "call-1",
      name: "get_weather",
      arguments: { city: "Istanbul", units: "metric" },
    },
  );
});

test("rejects unknown tools before any execution boundary", () => {
  const registry = new ToolRegistry([weatherTool]);

  assert.throws(
    () =>
      registry.validate({
        id: "call-2",
        name: "delete_everything",
        argumentsJson: "{}",
      }),
    (error: unknown) =>
      error instanceof GatewayError &&
      error.kind === "invalid_response" &&
      error.message.includes("unknown tool"),
  );
});

test("rejects tool arguments that violate the declared schema", () => {
  const registry = new ToolRegistry([weatherTool]);

  assert.throws(
    () =>
      registry.validate({
        id: "call-3",
        name: "get_weather",
        argumentsJson: '{"city":"Istanbul","units":"kelvin","admin":true}',
      }),
    (error: unknown) =>
      error instanceof GatewayError &&
      error.kind === "invalid_response" &&
      error.cause instanceof GatewayError,
  );
});

test("requires unique portable tool names", () => {
  assert.throws(
    () => new ToolRegistry([weatherTool, weatherTool]),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
  assert.throws(
    () =>
      new ToolRegistry([
        { ...weatherTool, name: "name with spaces" },
      ]),
    (error: unknown) =>
      error instanceof GatewayError && error.kind === "invalid_request",
  );
});
