import type { GatewayRequest } from "./contracts.js";
import { GatewayError } from "./errors.js";

export interface ExactRequestCacheOptions {
  readonly capacity: number;
  readonly ttlMs: number;
  readonly now?: () => number;
}

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

function requestKey(request: GatewayRequest): string {
  const metadata =
    request.metadata === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(request.metadata).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        );

  return JSON.stringify({
    model: request.model,
    messages: request.messages,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
    metadata,
  });
}

export class ExactRequestCache<T> {
  readonly #capacity: number;
  readonly #ttlMs: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, CacheEntry<T>>();

  constructor(options: ExactRequestCacheOptions) {
    if (!Number.isInteger(options.capacity) || options.capacity <= 0) {
      throw new GatewayError(
        "invalid_request",
        "Cache capacity must be a positive integer",
      );
    }
    if (!Number.isFinite(options.ttlMs) || options.ttlMs < 0) {
      throw new GatewayError(
        "invalid_request",
        "Cache TTL must be a finite non-negative number",
      );
    }

    this.#capacity = options.capacity;
    this.#ttlMs = options.ttlMs;
    this.#now = options.now ?? Date.now;
  }

  get size(): number {
    return this.#entries.size;
  }

  get(request: GatewayRequest): T | undefined {
    const key = requestKey(request);
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }

    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(request: GatewayRequest, value: T): void {
    const key = requestKey(request);
    this.#entries.delete(key);
    this.#entries.set(key, {
      value,
      expiresAt: this.#now() + this.#ttlMs,
    });

    while (this.#entries.size > this.#capacity) {
      const oldestKey = this.#entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        break;
      }
      this.#entries.delete(oldestKey);
    }
  }

  clear(): void {
    this.#entries.clear();
  }
}
