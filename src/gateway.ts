import { randomUUID } from "node:crypto";

import type {
  GatewayRequest,
  GatewayResponse,
  ProviderAdapter,
} from "./contracts.js";
import { GatewayError, normalizeProviderError } from "./errors.js";
import { executeWithRetry } from "./retry.js";

export interface GatewayOptions {
  readonly timeoutMs?: number;
  readonly maxAttemptsPerProvider?: number;
  readonly initialBackoffMs?: number;
  readonly maxBackoffMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly createRequestId?: () => string;
}

const DEFAULT_OPTIONS = {
  timeoutMs: 10_000,
  maxAttemptsPerProvider: 2,
  initialBackoffMs: 100,
  maxBackoffMs: 2_000,
} as const;

export class Gateway {
  readonly #adapters: readonly ProviderAdapter[];
  readonly #options: Required<Omit<GatewayOptions, "sleep">> &
    Pick<GatewayOptions, "sleep">;

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
      ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
    };
  }

  async generate(
    request: GatewayRequest,
    signal?: AbortSignal,
  ): Promise<GatewayResponse> {
    const requestId = this.#options.createRequestId();
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
        });
        return { ...response, provider: adapter.name };
      } catch (error) {
        const failure = normalizeProviderError(adapter.name, error);
        if (failure.kind === "aborted" || failure.kind === "invalid_request") {
          throw failure;
        }
        failures.push(failure);
      }
    }

    throw new GatewayError(
      "unavailable",
      `All providers failed: ${failures.map((failure) => failure.provider).join(", ")}`,
      { cause: new AggregateError(failures), retryable: true },
    );
  }
}

