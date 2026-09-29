export type FailureKind =
  | "authentication"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "invalid_request"
  | "invalid_response"
  | "aborted"
  | "internal";

const RETRYABLE_FAILURES: ReadonlySet<FailureKind> = new Set([
  "rate_limited",
  "timeout",
  "unavailable",
]);

export interface GatewayErrorOptions {
  readonly provider?: string;
  readonly cause?: unknown;
  readonly retryable?: boolean;
}

export class GatewayError extends Error {
  readonly kind: FailureKind;
  readonly provider: string | undefined;
  readonly retryable: boolean;

  constructor(
    kind: FailureKind,
    message: string,
    options: GatewayErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "GatewayError";
    this.kind = kind;
    this.provider = options.provider;
    this.retryable = options.retryable ?? RETRYABLE_FAILURES.has(kind);
  }
}

export function normalizeProviderError(
  provider: string,
  error: unknown,
): GatewayError {
  if (error instanceof GatewayError) {
    if (error.provider !== undefined) {
      return error;
    }
    return new GatewayError(error.kind, error.message, {
      cause: error,
      provider,
      retryable: error.retryable,
    });
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new GatewayError("aborted", "Provider request was aborted", {
      cause: error,
      provider,
      retryable: false,
    });
  }

  const message = error instanceof Error ? error.message : "Unknown provider failure";
  return new GatewayError("internal", message, {
    cause: error,
    provider,
    retryable: false,
  });
}

