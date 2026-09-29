import { GatewayError } from "./errors.js";

export interface RateLimiter {
  acquire(tokens?: number): void;
}

export interface TokenBucketOptions {
  readonly capacity: number;
  readonly refillPerSecond: number;
  readonly now?: () => number;
}

export class TokenBucketRateLimiter implements RateLimiter {
  readonly #capacity: number;
  readonly #refillPerMillisecond: number;
  readonly #now: () => number;
  #available: number;
  #lastRefill: number;

  constructor(options: TokenBucketOptions) {
    if (!Number.isFinite(options.capacity) || options.capacity <= 0) {
      throw new GatewayError("invalid_request", "Rate-limit capacity must be positive");
    }
    if (!Number.isFinite(options.refillPerSecond) || options.refillPerSecond <= 0) {
      throw new GatewayError(
        "invalid_request",
        "Rate-limit refillPerSecond must be positive",
      );
    }

    this.#capacity = options.capacity;
    this.#available = options.capacity;
    this.#refillPerMillisecond = options.refillPerSecond / 1_000;
    this.#now = options.now ?? Date.now;
    this.#lastRefill = this.#now();
  }

  get remaining(): number {
    this.#refill();
    return this.#available;
  }

  acquire(tokens = 1): void {
    if (!Number.isFinite(tokens) || tokens <= 0 || tokens > this.#capacity) {
      throw new GatewayError(
        "invalid_request",
        "Requested tokens must be positive and no greater than capacity",
      );
    }

    this.#refill();
    if (this.#available < tokens) {
      throw new GatewayError("rate_limited", "Gateway rate limit exceeded");
    }
    this.#available -= tokens;
  }

  #refill(): void {
    const now = this.#now();
    const elapsed = Math.max(0, now - this.#lastRefill);
    this.#available = Math.min(
      this.#capacity,
      this.#available + elapsed * this.#refillPerMillisecond,
    );
    this.#lastRefill = now;
  }
}

