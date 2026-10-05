import { GatewayError } from "./errors.js";

export interface ModelRoute {
  readonly model: string;
  readonly inputUsdPerMillionTokens: number;
  readonly outputUsdPerMillionTokens: number;
  readonly estimatedLatencyMs: number;
}

export interface RoutingEstimate {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type ModelRoutingStrategy =
  | "ordered"
  | "lowest_estimated_cost"
  | "lowest_estimated_latency";

export interface ModelRouteSelection {
  readonly route: ModelRoute;
  readonly estimatedCostUsd: number;
}

function assertNonNegativeFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new GatewayError(
      "invalid_request",
      `${field} must be a finite non-negative number`,
    );
  }
}

function estimateCost(route: ModelRoute, estimate: RoutingEstimate): number {
  return (
    (route.inputUsdPerMillionTokens * estimate.inputTokens +
      route.outputUsdPerMillionTokens * estimate.outputTokens) /
    1_000_000
  );
}

export function selectModelRoute(
  routes: readonly ModelRoute[],
  estimate: RoutingEstimate,
  strategy: ModelRoutingStrategy,
): ModelRouteSelection {
  if (routes.length === 0) {
    throw new GatewayError("invalid_request", "At least one model route is required");
  }
  assertNonNegativeFinite(estimate.inputTokens, "Estimated input tokens");
  assertNonNegativeFinite(estimate.outputTokens, "Estimated output tokens");

  for (const [index, route] of routes.entries()) {
    if (route.model.length === 0) {
      throw new GatewayError(
        "invalid_request",
        `Model route ${index} must have a non-empty model`,
      );
    }
    assertNonNegativeFinite(
      route.inputUsdPerMillionTokens,
      `Input price for ${route.model}`,
    );
    assertNonNegativeFinite(
      route.outputUsdPerMillionTokens,
      `Output price for ${route.model}`,
    );
    assertNonNegativeFinite(
      route.estimatedLatencyMs,
      `Estimated latency for ${route.model}`,
    );
  }

  let selected = routes[0] as ModelRoute;
  if (strategy === "lowest_estimated_cost") {
    for (const route of routes.slice(1)) {
      if (estimateCost(route, estimate) < estimateCost(selected, estimate)) {
        selected = route;
      }
    }
  } else if (strategy === "lowest_estimated_latency") {
    for (const route of routes.slice(1)) {
      if (route.estimatedLatencyMs < selected.estimatedLatencyMs) {
        selected = route;
      }
    }
  }

  return {
    route: { ...selected },
    estimatedCostUsd: estimateCost(selected, estimate),
  };
}
