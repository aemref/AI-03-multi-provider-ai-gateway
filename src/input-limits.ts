import type { GatewayRequest } from "./contracts.js";
import { GatewayError } from "./errors.js";

export interface GatewayRequestLimits {
  readonly maxModelCharacters: number;
  readonly maxMessages: number;
  readonly maxMessageCharacters: number;
  readonly maxTotalMessageCharacters: number;
  readonly maxMessageNameCharacters: number;
  readonly maxOutputTokens: number;
  readonly maxMetadataEntries: number;
  readonly maxMetadataKeyCharacters: number;
  readonly maxMetadataValueCharacters: number;
}

export const DEFAULT_GATEWAY_REQUEST_LIMITS: Readonly<GatewayRequestLimits> =
  Object.freeze({
    maxModelCharacters: 128,
    maxMessages: 50,
    maxMessageCharacters: 32_000,
    maxTotalMessageCharacters: 128_000,
    maxMessageNameCharacters: 64,
    maxOutputTokens: 32_768,
    maxMetadataEntries: 20,
    maxMetadataKeyCharacters: 64,
    maxMetadataValueCharacters: 512,
  });

function invalidRequest(message: string): never {
  throw new GatewayError("invalid_request", message);
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    invalidRequest(`${name} must be a positive safe integer`);
  }
}

export function createGatewayRequestLimits(
  overrides: Partial<GatewayRequestLimits> = {},
): Readonly<GatewayRequestLimits> {
  const limits = { ...DEFAULT_GATEWAY_REQUEST_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    assertPositiveInteger(name, value);
  }
  return Object.freeze(limits);
}

export function assertGatewayRequestWithinLimits(
  request: GatewayRequest,
  limits: GatewayRequestLimits = DEFAULT_GATEWAY_REQUEST_LIMITS,
): void {
  if (request.model.trim().length === 0) {
    invalidRequest("Model must not be empty");
  }
  if (request.model.length > limits.maxModelCharacters) {
    invalidRequest("Model exceeds the configured character limit");
  }
  if (request.messages.length === 0) {
    invalidRequest("At least one message is required");
  }
  if (request.messages.length > limits.maxMessages) {
    invalidRequest("Messages exceed the configured count limit");
  }

  let totalMessageCharacters = 0;
  for (const message of request.messages) {
    if (message.content.length > limits.maxMessageCharacters) {
      invalidRequest("A message exceeds the configured character limit");
    }
    totalMessageCharacters += message.content.length;
    if (totalMessageCharacters > limits.maxTotalMessageCharacters) {
      invalidRequest("Messages exceed the configured total character limit");
    }
    if (
      message.name !== undefined &&
      message.name.length > limits.maxMessageNameCharacters
    ) {
      invalidRequest("A message name exceeds the configured character limit");
    }
  }

  if (request.maxTokens !== undefined) {
    if (!Number.isSafeInteger(request.maxTokens) || request.maxTokens <= 0) {
      invalidRequest("maxTokens must be a positive safe integer");
    }
    if (request.maxTokens > limits.maxOutputTokens) {
      invalidRequest("maxTokens exceeds the configured output-token limit");
    }
  }
  if (
    request.temperature !== undefined &&
    (!Number.isFinite(request.temperature) || request.temperature < 0)
  ) {
    invalidRequest("temperature must be a non-negative finite number");
  }

  const metadata = Object.entries(request.metadata ?? {});
  if (metadata.length > limits.maxMetadataEntries) {
    invalidRequest("Metadata exceeds the configured entry limit");
  }
  for (const [key, value] of metadata) {
    if (key.length > limits.maxMetadataKeyCharacters) {
      invalidRequest("A metadata key exceeds the configured character limit");
    }
    if (value.length > limits.maxMetadataValueCharacters) {
      invalidRequest("A metadata value exceeds the configured character limit");
    }
  }
}
