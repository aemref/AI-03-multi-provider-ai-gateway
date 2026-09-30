export const VERSION = "0.1.0";

export {
  CircuitBreaker,
  withCircuitBreaker,
  type CircuitBreakerOptions,
  type CircuitState,
} from "./circuit-breaker.js";

export type {
  FinishReason,
  GatewayMessage,
  GatewayRequest,
  GatewayResponse,
  GatewayStreamEvent,
  MessageRole,
  ProviderAdapter,
  ProviderContext,
  ProviderResponse,
  ProviderStreamEvent,
  StreamDeltaEvent,
  StreamDoneEvent,
  StreamingProviderAdapter,
  StreamUsageEvent,
  TokenUsage,
} from "./contracts.js";
export {
  GatewayError,
  normalizeProviderError,
  type FailureKind,
  type GatewayErrorOptions,
} from "./errors.js";
export { executeWithRetry, type RetryOptions } from "./retry.js";
export {
  streamFromProvider,
  supportsStreaming,
  type ProviderStreamOptions,
} from "./stream.js";
export { Gateway, type GatewayOptions } from "./gateway.js";
export {
  createEchoMockAdapter,
  ScriptedMockAdapter,
  type MockCall,
  type MockOutcome,
} from "./mock-adapters.js";
export {
  TokenBucketRateLimiter,
  type RateLimiter,
  type TokenBucketOptions,
} from "./rate-limiter.js";
