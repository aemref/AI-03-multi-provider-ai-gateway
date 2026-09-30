import { GatewayError } from "./errors.js";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonSchemaType =
  | "array"
  | "boolean"
  | "integer"
  | "null"
  | "number"
  | "object"
  | "string";

export interface JsonSchema {
  readonly type?: JsonSchemaType;
  readonly enum?: readonly JsonValue[];
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: JsonSchema;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

function valueType(value: unknown): JsonSchemaType | undefined {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      if (!Number.isFinite(value)) return undefined;
      return Number.isInteger(value) ? "integer" : "number";
    case "object":
      return "object";
    case "string":
      return "string";
    default:
      return undefined;
  }
}

function sameJsonValue(left: JsonValue, right: unknown): boolean {
  if (left === null || typeof left !== "object") return Object.is(left, right);
  if (Array.isArray(left)) {
    return (
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => sameJsonValue(item, right[index]))
    );
  }
  if (right === null || typeof right !== "object" || Array.isArray(right)) {
    return false;
  }
  const leftEntries = Object.entries(left);
  const rightRecord = right as Record<string, unknown>;
  return (
    leftEntries.length === Object.keys(rightRecord).length &&
    leftEntries.every(
      ([key, item]) =>
        Object.hasOwn(rightRecord, key) && sameJsonValue(item, rightRecord[key]),
    )
  );
}

function inspect(
  value: unknown,
  schema: JsonSchema,
  path: string,
  issues: ValidationIssue[],
): void {
  const actualType = valueType(value);
  if (actualType === undefined) {
    issues.push({ path, message: "must be a JSON value" });
    return;
  }
  if (
    schema.type !== undefined &&
    schema.type !== actualType &&
    !(schema.type === "number" && actualType === "integer")
  ) {
    issues.push({ path, message: `must be ${schema.type}, received ${actualType}` });
    return;
  }
  if (
    schema.enum !== undefined &&
    !schema.enum.some((candidate) => sameJsonValue(candidate, value))
  ) {
    issues.push({ path, message: "must match an allowed enum value" });
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push({ path, message: `must contain at least ${schema.minLength} characters` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      issues.push({ path, message: `must contain at most ${schema.maxLength} characters` });
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push({ path, message: `must be at least ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push({ path, message: `must be at most ${schema.maximum}` });
    }
  }
  if (Array.isArray(value) && schema.items !== undefined) {
    value.forEach((item, index) => inspect(item, schema.items!, `${path}[${index}]`, issues));
  }
  if (actualType === "object" && !Array.isArray(value) && value !== null) {
    const record = value as Record<string, unknown>;
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(record, required)) {
        issues.push({ path: `${path}.${required}`, message: "is required" });
      }
    }
    for (const [key, item] of Object.entries(record)) {
      const propertySchema = schema.properties?.[key];
      if (propertySchema !== undefined) {
        inspect(item, propertySchema, `${path}.${key}`, issues);
      } else if (schema.additionalProperties === false) {
        issues.push({ path: `${path}.${key}`, message: "is not allowed" });
      } else {
        inspect(item, {}, `${path}.${key}`, issues);
      }
    }
  }
}

export function validateStructuredOutput(
  value: unknown,
  schema: JsonSchema,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  inspect(value, schema, "$", issues);
  return { valid: issues.length === 0, issues };
}

export function parseStructuredOutput(
  text: string,
  schema: JsonSchema,
): JsonValue {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (cause) {
    throw new GatewayError("invalid_response", "Provider returned invalid JSON", {
      cause,
      retryable: false,
    });
  }

  const result = validateStructuredOutput(value, schema);
  if (!result.valid) {
    throw new GatewayError(
      "invalid_response",
      `Structured output failed validation: ${result.issues
        .map((issue) => `${issue.path} ${issue.message}`)
        .join("; ")}`,
      { cause: result, retryable: false },
    );
  }
  return value as JsonValue;
}
