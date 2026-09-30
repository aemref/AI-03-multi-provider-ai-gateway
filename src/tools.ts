import { GatewayError } from "./errors.js";
import {
  parseStructuredOutput,
  type JsonSchema,
  type JsonValue,
} from "./schema.js";

export interface ToolDefinition {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: JsonSchema;
}

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly argumentsJson: string;
}

export interface ValidatedToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: JsonValue;
}

const TOOL_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export class ToolRegistry {
  readonly #definitions: ReadonlyMap<string, ToolDefinition>;

  constructor(definitions: readonly ToolDefinition[]) {
    const byName = new Map<string, ToolDefinition>();
    for (const definition of definitions) {
      if (!TOOL_NAME.test(definition.name)) {
        throw new GatewayError(
          "invalid_request",
          `Invalid tool name: ${definition.name}`,
        );
      }
      if (byName.has(definition.name)) {
        throw new GatewayError(
          "invalid_request",
          `Duplicate tool definition: ${definition.name}`,
        );
      }
      byName.set(definition.name, definition);
    }
    this.#definitions = byName;
  }

  validate(call: ToolCall): ValidatedToolCall {
    if (call.id.length === 0) {
      throw new GatewayError("invalid_response", "Tool call id must not be empty", {
        retryable: false,
      });
    }
    const definition = this.#definitions.get(call.name);
    if (definition === undefined) {
      throw new GatewayError(
        "invalid_response",
        `Provider requested unknown tool: ${call.name}`,
        { retryable: false },
      );
    }

    try {
      const args = parseStructuredOutput(
        call.argumentsJson,
        definition.inputSchema,
      );
      return { id: call.id, name: call.name, arguments: args };
    } catch (cause) {
      throw new GatewayError(
        "invalid_response",
        `Invalid arguments for tool ${call.name}`,
        { cause, retryable: false },
      );
    }
  }
}
