import type {
  GatewayRequest,
  ProviderAdapter,
  ProviderStreamEvent,
  StreamingProviderAdapter,
} from "./contracts.js";
import { GatewayError, normalizeProviderError } from "./errors.js";

export interface ProviderStreamOptions {
  readonly requestId: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export function supportsStreaming(
  adapter: ProviderAdapter,
): adapter is StreamingProviderAdapter {
  return "stream" in adapter && typeof adapter.stream === "function";
}

function aborted(provider: string, cause?: unknown): GatewayError {
  return new GatewayError("aborted", "Gateway stream was aborted", {
    ...(cause === undefined ? {} : { cause }),
    provider,
    retryable: false,
  });
}

async function nextWithDeadline(
  iterator: AsyncIterator<ProviderStreamEvent>,
  adapter: StreamingProviderAdapter,
  controller: AbortController,
  timeoutMs: number,
): Promise<IteratorResult<ProviderStreamEvent>> {
  let timer: NodeJS.Timeout | undefined;
  let abortListener: (() => void) | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const failure = new GatewayError(
        "timeout",
        `Provider stream stalled for ${timeoutMs}ms`,
        { provider: adapter.name },
      );
      reject(failure);
      controller.abort(failure);
    }, timeoutMs);
  });
  const cancellation = new Promise<never>((_resolve, reject) => {
    abortListener = () => {
      const reason = controller.signal.reason;
      reject(
        reason instanceof GatewayError
          ? reason
          : aborted(adapter.name, reason),
      );
    };
    controller.signal.addEventListener("abort", abortListener, { once: true });
  });

  try {
    return await Promise.race([iterator.next(), timeout, cancellation]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (abortListener !== undefined) {
      controller.signal.removeEventListener("abort", abortListener);
    }
  }
}

export async function* streamFromProvider(
  adapter: StreamingProviderAdapter,
  request: GatewayRequest,
  options: ProviderStreamOptions,
): AsyncIterable<ProviderStreamEvent> {
  const callerAborted = (): boolean => options.signal?.aborted ?? false;
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new GatewayError("invalid_request", "timeoutMs must be positive");
  }
  if (callerAborted()) {
    throw aborted(adapter.name, options.signal?.reason);
  }

  const controller = new AbortController();
  const abortFromCaller = (): void => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const iterator = adapter
    .stream(request, { requestId: options.requestId, signal: controller.signal })
    [Symbol.asyncIterator]();
  let completed = false;

  try {
    while (true) {
      const result = await nextWithDeadline(
        iterator,
        adapter,
        controller,
        options.timeoutMs,
      );
      if (result.done === true) {
        completed = true;
        return;
      }
      yield result.value;
    }
  } catch (error) {
    if (callerAborted()) {
      throw aborted(adapter.name, options.signal?.reason);
    }
    throw normalizeProviderError(adapter.name, error);
  } finally {
    options.signal?.removeEventListener("abort", abortFromCaller);
    if (!completed) {
      controller.abort(new Error("Gateway stream closed"));
      await iterator.return?.();
    }
  }
}
