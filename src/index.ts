export const VERSION = "0.1.0";

export type {
  FinishReason,
  GatewayMessage,
  GatewayRequest,
  GatewayResponse,
  MessageRole,
  ProviderAdapter,
  ProviderContext,
  ProviderResponse,
  TokenUsage,
} from "./contracts.js";
export {
  GatewayError,
  normalizeProviderError,
  type FailureKind,
  type GatewayErrorOptions,
} from "./errors.js";
export { executeWithRetry, type RetryOptions } from "./retry.js";
