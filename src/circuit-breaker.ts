import type {
  GatewayRequest,
  ProviderAdapter,
  ProviderContext,
  ProviderResponse,
} from "./contracts.js";
import { GatewayError } from "./errors.js";

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
  readonly now?: () => number;
}

export class CircuitBreaker {
  readonly #failureThreshold: number;
  readonly #resetTimeoutMs: number;
  readonly #now: () => number;
  #state: CircuitState = "closed";
  #consecutiveFailures = 0;
  #openedAt = 0;
  #probeInFlight = false;

  constructor(options: CircuitBreakerOptions) {
    if (!Number.isInteger(options.failureThreshold) || options.failureThreshold < 1) {
      throw new GatewayError(
        "invalid_request",
        "Circuit failureThreshold must be at least 1",
      );
    }
    if (!Number.isFinite(options.resetTimeoutMs) || options.resetTimeoutMs <= 0) {
      throw new GatewayError(
        "invalid_request",
        "Circuit resetTimeoutMs must be positive",
      );
    }
    this.#failureThreshold = options.failureThreshold;
    this.#resetTimeoutMs = options.resetTimeoutMs;
    this.#now = options.now ?? Date.now;
  }

  get state(): CircuitState {
    return this.#state;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.#prepareAttempt();
    const isProbe = this.#state === "half_open";
    if (isProbe) {
      this.#probeInFlight = true;
    }

    try {
      const result = await operation();
      this.#recordSuccess();
      return result;
    } catch (error) {
      if (isOperationalFailure(error)) {
        this.#recordFailure();
      }
      throw error;
    } finally {
      if (isProbe) {
        this.#probeInFlight = false;
      }
    }
  }

  #prepareAttempt(): void {
    if (this.#state === "open") {
      if (this.#now() - this.#openedAt < this.#resetTimeoutMs) {
        throw new GatewayError("unavailable", "Provider circuit is open");
      }
      this.#state = "half_open";
    }
    if (this.#state === "half_open" && this.#probeInFlight) {
      throw new GatewayError("unavailable", "Provider circuit probe is in flight");
    }
  }

  #recordSuccess(): void {
    this.#state = "closed";
    this.#consecutiveFailures = 0;
  }

  #recordFailure(): void {
    this.#consecutiveFailures += 1;
    if (
      this.#state === "half_open" ||
      this.#consecutiveFailures >= this.#failureThreshold
    ) {
      this.#state = "open";
      this.#openedAt = this.#now();
    }
  }
}

function isOperationalFailure(error: unknown): boolean {
  if (!(error instanceof GatewayError)) {
    return true;
  }
  return error.retryable;
}

export function withCircuitBreaker(
  adapter: ProviderAdapter,
  breaker: CircuitBreaker,
): ProviderAdapter {
  return {
    name: adapter.name,
    async generate(
      request: GatewayRequest,
      context: ProviderContext,
    ): Promise<ProviderResponse> {
      return await breaker.execute(async () => adapter.generate(request, context));
    },
  };
}

