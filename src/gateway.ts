import { randomUUID } from "node:crypto";

import type {
  GatewayRequest,
  GatewayResponse,
  GatewayStreamEvent,
  ProviderAdapter,
  TokenUsage,
} from "./contracts.js";
import type { PricingCatalog } from "./cost.js";
import { GatewayError, normalizeProviderError } from "./errors.js";
import { recordTrace, type TraceSink } from "./observability.js";
import type { RateLimiter } from "./rate-limiter.js";
import { executeWithRetry, type RetryAttemptEvent } from "./retry.js";
import { streamFromProvider, supportsStreaming } from "./stream.js";

export interface GatewayOptions {
  readonly timeoutMs?: number;
  readonly maxAttemptsPerProvider?: number;
  readonly initialBackoffMs?: number;
  readonly maxBackoffMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly createRequestId?: () => string;
  readonly rateLimiter?: RateLimiter;
  readonly now?: () => number;
  readonly traceSink?: TraceSink;
  readonly pricingCatalog?: PricingCatalog;
}

const DEFAULT_OPTIONS = {
  timeoutMs: 10_000,
  maxAttemptsPerProvider: 2,
  initialBackoffMs: 100,
  maxBackoffMs: 2_000,
} as const;

export class Gateway {
  readonly #adapters: readonly ProviderAdapter[];
  readonly #options: Required<
    Omit<
      GatewayOptions,
      "sleep" | "rateLimiter" | "traceSink" | "pricingCatalog"
    >
  > &
    Pick<
      GatewayOptions,
      "sleep" | "rateLimiter" | "traceSink" | "pricingCatalog"
    >;

  constructor(adapters: readonly ProviderAdapter[], options: GatewayOptions = {}) {
    if (adapters.length === 0) {
      throw new GatewayError("invalid_request", "At least one provider is required");
    }
    const names = adapters.map((adapter) => adapter.name);
    if (new Set(names).size !== names.length) {
      throw new GatewayError("invalid_request", "Provider names must be unique");
    }

    this.#adapters = [...adapters];
    this.#options = {
      timeoutMs: options.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs,
      maxAttemptsPerProvider:
        options.maxAttemptsPerProvider ?? DEFAULT_OPTIONS.maxAttemptsPerProvider,
      initialBackoffMs:
        options.initialBackoffMs ?? DEFAULT_OPTIONS.initialBackoffMs,
      maxBackoffMs: options.maxBackoffMs ?? DEFAULT_OPTIONS.maxBackoffMs,
      createRequestId: options.createRequestId ?? randomUUID,
      now: options.now ?? Date.now,
      ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
      ...(options.rateLimiter === undefined
        ? {}
        : { rateLimiter: options.rateLimiter }),
      ...(options.traceSink === undefined
        ? {}
        : { traceSink: options.traceSink }),
      ...(options.pricingCatalog === undefined
        ? {}
        : { pricingCatalog: options.pricingCatalog }),
    };
  }

  async generate(
    request: GatewayRequest,
    signal?: AbortSignal,
  ): Promise<GatewayResponse> {
    this.#options.rateLimiter?.acquire();
    const requestId = this.#options.createRequestId();
    const startedAt = this.#options.now();
    const traceBase = {
      requestId,
      operation: "generate" as const,
      model: request.model,
    };
    recordTrace(this.#options.traceSink, {
      ...traceBase,
      type: "request.started",
      timestampMs: startedAt,
    });
    const failures: GatewayError[] = [];

    for (const adapter of this.#adapters) {
      try {
        const response = await executeWithRetry(adapter, request, {
          requestId,
          timeoutMs: this.#options.timeoutMs,
          maxAttempts: this.#options.maxAttemptsPerProvider,
          initialBackoffMs: this.#options.initialBackoffMs,
          maxBackoffMs: this.#options.maxBackoffMs,
          ...(signal === undefined ? {} : { signal }),
          ...(this.#options.sleep === undefined ? {} : { sleep: this.#options.sleep }),
          now: this.#options.now,
          onAttempt: (event) => {
            this.#recordAttemptTrace(traceBase, event);
          },
        });
        const finishedAt = this.#options.now();
        const cost = this.#options.pricingCatalog?.estimate(
          adapter.name,
          response.model,
          response.usage,
        );
        recordTrace(this.#options.traceSink, {
          ...traceBase,
          type: "request.completed",
          timestampMs: finishedAt,
          provider: adapter.name,
          durationMs: Math.max(0, finishedAt - startedAt),
          usage: response.usage,
          ...(cost === undefined ? {} : { cost }),
        });
        return { ...response, provider: adapter.name, requestId };
      } catch (error) {
        const failure = normalizeProviderError(adapter.name, error);
        if (failure.kind === "aborted" || failure.kind === "invalid_request") {
          this.#recordRequestFailure(traceBase, startedAt, failure);
          throw failure;
        }
        failures.push(failure);
      }
    }

    const failure = new GatewayError(
      "unavailable",
      `All providers failed: ${failures.map((failure) => failure.provider).join(", ")}`,
      { cause: new AggregateError(failures), retryable: true },
    );
    this.#recordRequestFailure(traceBase, startedAt, failure);
    throw failure;
  }

  async *stream(
    request: GatewayRequest,
    signal?: AbortSignal,
  ): AsyncIterable<GatewayStreamEvent> {
    this.#options.rateLimiter?.acquire();
    const requestId = this.#options.createRequestId();
    const startedAt = this.#options.now();
    const traceBase = {
      requestId,
      operation: "stream" as const,
      model: request.model,
    };
    recordTrace(this.#options.traceSink, {
      ...traceBase,
      type: "request.started",
      timestampMs: startedAt,
    });
    const failures: GatewayError[] = [];
    let foundStreamingAdapter = false;

    for (const adapter of this.#adapters) {
      if (!supportsStreaming(adapter)) {
        continue;
      }
      foundStreamingAdapter = true;
      let emitted = false;
      let usage: TokenUsage | undefined;
      const attemptStartedAt = this.#options.now();
      recordTrace(this.#options.traceSink, {
        ...traceBase,
        type: "provider.attempt.started",
        timestampMs: attemptStartedAt,
        provider: adapter.name,
        attempt: 1,
      });

      try {
        for await (const event of streamFromProvider(adapter, request, {
          requestId,
          timeoutMs: this.#options.timeoutMs,
          ...(signal === undefined ? {} : { signal }),
        })) {
          emitted = true;
          if (event.type === "usage") {
            usage = event.usage;
          }
          yield { ...event, provider: adapter.name, requestId };
        }
        const finishedAt = this.#options.now();
        const cost =
          usage === undefined
            ? undefined
            : this.#options.pricingCatalog?.estimate(
                adapter.name,
                request.model,
                usage,
              );
        recordTrace(this.#options.traceSink, {
          ...traceBase,
          type: "provider.attempt.succeeded",
          timestampMs: finishedAt,
          provider: adapter.name,
          attempt: 1,
          durationMs: Math.max(0, finishedAt - attemptStartedAt),
        });
        recordTrace(this.#options.traceSink, {
          ...traceBase,
          type: "request.completed",
          timestampMs: finishedAt,
          provider: adapter.name,
          durationMs: Math.max(0, finishedAt - startedAt),
          ...(usage === undefined ? {} : { usage }),
          ...(cost === undefined ? {} : { cost }),
        });
        return;
      } catch (error) {
        const failure = normalizeProviderError(adapter.name, error);
        const finishedAt = this.#options.now();
        recordTrace(this.#options.traceSink, {
          ...traceBase,
          type: "provider.attempt.failed",
          timestampMs: finishedAt,
          provider: adapter.name,
          attempt: 1,
          durationMs: Math.max(0, finishedAt - attemptStartedAt),
          failureKind: failure.kind,
          retryable: failure.retryable,
        });
        if (emitted || failure.kind === "aborted" || failure.kind === "invalid_request") {
          this.#recordRequestFailure(traceBase, startedAt, failure);
          throw failure;
        }
        failures.push(failure);
      }
    }

    if (!foundStreamingAdapter) {
      const failure = new GatewayError(
        "invalid_request",
        "At least one provider must support streaming",
      );
      this.#recordRequestFailure(traceBase, startedAt, failure);
      throw failure;
    }
    const failure = new GatewayError(
      "unavailable",
      `All streaming providers failed: ${failures
        .map((failure) => failure.provider)
        .join(", ")}`,
      { cause: new AggregateError(failures), retryable: true },
    );
    this.#recordRequestFailure(traceBase, startedAt, failure);
    throw failure;
  }

  #recordAttemptTrace(
    traceBase: {
      readonly requestId: string;
      readonly operation: "generate" | "stream";
      readonly model: string;
    },
    event: RetryAttemptEvent,
  ): void {
    if (event.type === "started") {
      recordTrace(this.#options.traceSink, {
        ...traceBase,
        type: "provider.attempt.started",
        timestampMs: event.timestampMs,
        provider: event.provider,
        attempt: event.attempt,
      });
      return;
    }

    if (event.type === "succeeded") {
      recordTrace(this.#options.traceSink, {
        ...traceBase,
        type: "provider.attempt.succeeded",
        timestampMs: event.timestampMs,
        provider: event.provider,
        attempt: event.attempt,
        durationMs: event.durationMs,
      });
      return;
    }

    recordTrace(this.#options.traceSink, {
      ...traceBase,
      type: "provider.attempt.failed",
      timestampMs: event.timestampMs,
      provider: event.provider,
      attempt: event.attempt,
      durationMs: event.durationMs,
      failureKind: event.failure.kind,
      retryable: event.failure.retryable,
    });
  }

  #recordRequestFailure(
    traceBase: {
      readonly requestId: string;
      readonly operation: "generate" | "stream";
      readonly model: string;
    },
    startedAt: number,
    failure: GatewayError,
  ): void {
    const finishedAt = this.#options.now();
    recordTrace(this.#options.traceSink, {
      ...traceBase,
      type: "request.failed",
      timestampMs: finishedAt,
      durationMs: Math.max(0, finishedAt - startedAt),
      failureKind: failure.kind,
      ...(failure.provider === undefined ? {} : { provider: failure.provider }),
    });
  }
}
