import type {
  GatewayRequest,
  ProviderAdapter,
  ProviderContext,
  ProviderResponse,
} from "./contracts.js";
import { GatewayError, normalizeProviderError } from "./errors.js";

export interface RetryOptions {
  readonly requestId: string;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly initialBackoffMs: number;
  readonly maxBackoffMs: number;
  readonly signal?: AbortSignal;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

function validateOptions(options: RetryOptions): void {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new GatewayError("invalid_request", "maxAttempts must be at least 1");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new GatewayError("invalid_request", "timeoutMs must be positive");
  }
  if (!Number.isFinite(options.initialBackoffMs) || options.initialBackoffMs < 0) {
    throw new GatewayError("invalid_request", "initialBackoffMs must be non-negative");
  }
  if (!Number.isFinite(options.maxBackoffMs) || options.maxBackoffMs < 0) {
    throw new GatewayError("invalid_request", "maxBackoffMs must be non-negative");
  }
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runAttempt(
  adapter: ProviderAdapter,
  request: GatewayRequest,
  context: ProviderContext,
  timeoutMs: number,
  upstreamSignal?: AbortSignal,
): Promise<ProviderResponse> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: NodeJS.Timeout | undefined;
  const abortFromUpstream = (): void => controller.abort(upstreamSignal?.reason);

  if (upstreamSignal?.aborted === true) {
    abortFromUpstream();
  } else {
    upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
  }

  const providerContext: ProviderContext = {
    requestId: context.requestId,
    signal: controller.signal,
  };
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("Provider attempt timed out"));
      reject(
        new GatewayError("timeout", `Provider timed out after ${timeoutMs}ms`, {
          provider: adapter.name,
        }),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([adapter.generate(request, providerContext), timeout]);
  } catch (error) {
    if (timedOut) {
      throw error;
    }
    if (upstreamSignal?.aborted === true) {
      throw new GatewayError("aborted", "Gateway request was aborted", {
        cause: error,
        provider: adapter.name,
      });
    }
    throw normalizeProviderError(adapter.name, error);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}

export async function executeWithRetry(
  adapter: ProviderAdapter,
  request: GatewayRequest,
  options: RetryOptions,
): Promise<ProviderResponse> {
  validateOptions(options);
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await runAttempt(
        adapter,
        request,
        { requestId: options.requestId, signal: options.signal ?? new AbortController().signal },
        options.timeoutMs,
        options.signal,
      );
    } catch (error) {
      const failure = normalizeProviderError(adapter.name, error);
      if (!failure.retryable || attempt === options.maxAttempts) {
        throw failure;
      }

      const uncappedDelay = options.initialBackoffMs * 2 ** (attempt - 1);
      await sleep(Math.min(uncappedDelay, options.maxBackoffMs));
    }
  }

  throw new GatewayError("internal", "Retry loop ended unexpectedly", {
    provider: adapter.name,
  });
}

