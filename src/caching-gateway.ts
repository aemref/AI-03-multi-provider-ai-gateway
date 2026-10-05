import { randomUUID } from "node:crypto";

import { ExactRequestCache } from "./cache.js";
import type { GatewayRequest, GatewayResponse } from "./contracts.js";
import { GatewayError } from "./errors.js";

export interface GatewayGenerator {
  generate(
    request: GatewayRequest,
    signal?: AbortSignal,
  ): Promise<GatewayResponse>;
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
}

export interface CachingGatewayOptions {
  readonly createRequestId?: () => string;
}

type CachedGatewayResponse = Omit<GatewayResponse, "requestId">;

export class CachingGateway implements GatewayGenerator {
  readonly #gateway: GatewayGenerator;
  readonly #cache: ExactRequestCache<CachedGatewayResponse>;
  readonly #createRequestId: () => string;
  #hits = 0;
  #misses = 0;

  constructor(
    gateway: GatewayGenerator,
    cache: ExactRequestCache<CachedGatewayResponse>,
    options: CachingGatewayOptions = {},
  ) {
    this.#gateway = gateway;
    this.#cache = cache;
    this.#createRequestId = options.createRequestId ?? randomUUID;
  }

  get stats(): CacheStats {
    return { hits: this.#hits, misses: this.#misses };
  }

  async generate(
    request: GatewayRequest,
    signal?: AbortSignal,
  ): Promise<GatewayResponse> {
    if (signal?.aborted === true) {
      throw new GatewayError("aborted", "Gateway request was aborted");
    }

    const cached = this.#cache.get(request);
    if (cached !== undefined) {
      this.#hits += 1;
      return { ...cached, requestId: this.#createRequestId() };
    }

    this.#misses += 1;
    const response = await this.#gateway.generate(request, signal);
    const { requestId: _requestId, ...cacheable } = response;
    this.#cache.set(request, cacheable);
    return response;
  }
}
