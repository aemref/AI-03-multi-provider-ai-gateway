import type { TokenUsage } from "./contracts.js";
import { GatewayError } from "./errors.js";

export interface ModelPricing {
  readonly provider: string;
  readonly model: string;
  readonly inputUsdPerMillionTokens: number;
  readonly outputUsdPerMillionTokens: number;
}

export interface UsageCost {
  readonly currency: "USD";
  readonly inputUsd: number;
  readonly outputUsd: number;
  readonly totalUsd: number;
}

function priceKey(provider: string, model: string): string {
  return `${provider}\u0000${model}`;
}

function validatePricing(pricing: ModelPricing): void {
  if (pricing.provider.length === 0 || pricing.model.length === 0) {
    throw new GatewayError(
      "invalid_request",
      "Pricing provider and model must be non-empty",
    );
  }
  for (const [name, value] of [
    ["inputUsdPerMillionTokens", pricing.inputUsdPerMillionTokens],
    ["outputUsdPerMillionTokens", pricing.outputUsdPerMillionTokens],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new GatewayError(
        "invalid_request",
        `${name} must be a finite non-negative number`,
      );
    }
  }
}

function validateUsage(usage: TokenUsage): void {
  if (
    !Number.isInteger(usage.inputTokens) ||
    usage.inputTokens < 0 ||
    !Number.isInteger(usage.outputTokens) ||
    usage.outputTokens < 0
  ) {
    throw new GatewayError(
      "invalid_response",
      "Token usage must contain non-negative integers",
    );
  }
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

export class PricingCatalog {
  readonly #pricing = new Map<string, ModelPricing>();

  constructor(entries: readonly ModelPricing[]) {
    for (const entry of entries) {
      validatePricing(entry);
      const key = priceKey(entry.provider, entry.model);
      if (this.#pricing.has(key)) {
        throw new GatewayError(
          "invalid_request",
          `Duplicate pricing for ${entry.provider}/${entry.model}`,
        );
      }
      this.#pricing.set(key, { ...entry });
    }
  }

  estimate(
    provider: string,
    model: string,
    usage: TokenUsage,
  ): UsageCost | undefined {
    validateUsage(usage);
    const pricing = this.#pricing.get(priceKey(provider, model));
    if (pricing === undefined) {
      return undefined;
    }

    const inputUsd = roundUsd(
      (usage.inputTokens * pricing.inputUsdPerMillionTokens) / 1_000_000,
    );
    const outputUsd = roundUsd(
      (usage.outputTokens * pricing.outputUsdPerMillionTokens) / 1_000_000,
    );
    return {
      currency: "USD",
      inputUsd,
      outputUsd,
      totalUsd: roundUsd(inputUsd + outputUsd),
    };
  }
}
