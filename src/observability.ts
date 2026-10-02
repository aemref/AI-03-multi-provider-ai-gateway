import type { TokenUsage } from "./contracts.js";
import type { FailureKind } from "./errors.js";
import type { UsageCost } from "./cost.js";

export type GatewayOperation = "generate" | "stream";

interface TraceBase {
  readonly timestampMs: number;
  readonly requestId: string;
  readonly operation: GatewayOperation;
  readonly model: string;
}

export interface RequestStartedTrace extends TraceBase {
  readonly type: "request.started";
}

export interface ProviderAttemptStartedTrace extends TraceBase {
  readonly type: "provider.attempt.started";
  readonly provider: string;
  readonly attempt: number;
}

export interface ProviderAttemptSucceededTrace extends TraceBase {
  readonly type: "provider.attempt.succeeded";
  readonly provider: string;
  readonly attempt: number;
  readonly durationMs: number;
}

export interface ProviderAttemptFailedTrace extends TraceBase {
  readonly type: "provider.attempt.failed";
  readonly provider: string;
  readonly attempt: number;
  readonly durationMs: number;
  readonly failureKind: FailureKind;
  readonly retryable: boolean;
}

export interface RequestCompletedTrace extends TraceBase {
  readonly type: "request.completed";
  readonly provider: string;
  readonly durationMs: number;
  readonly usage?: TokenUsage;
  readonly cost?: UsageCost;
}

export interface RequestFailedTrace extends TraceBase {
  readonly type: "request.failed";
  readonly durationMs: number;
  readonly failureKind: FailureKind;
  readonly provider?: string;
}

export type GatewayTraceEvent =
  | RequestStartedTrace
  | ProviderAttemptStartedTrace
  | ProviderAttemptSucceededTrace
  | ProviderAttemptFailedTrace
  | RequestCompletedTrace
  | RequestFailedTrace;

export interface TraceSink {
  record(event: GatewayTraceEvent): void;
}

export interface InMemoryTraceSinkOptions {
  readonly maxEvents?: number;
}

export class InMemoryTraceSink implements TraceSink {
  readonly #events: GatewayTraceEvent[] = [];
  readonly #maxEvents: number;
  #droppedEvents = 0;

  constructor(options: InMemoryTraceSinkOptions = {}) {
    const maxEvents = options.maxEvents ?? 1_000;
    if (!Number.isSafeInteger(maxEvents) || maxEvents <= 0) {
      throw new RangeError("maxEvents must be a positive safe integer");
    }
    this.#maxEvents = maxEvents;
  }

  record(event: GatewayTraceEvent): void {
    if (this.#events.length === this.#maxEvents) {
      this.#events.shift();
      this.#droppedEvents += 1;
    }
    this.#events.push(structuredClone(event));
  }

  snapshot(): readonly GatewayTraceEvent[] {
    return structuredClone(this.#events);
  }

  clear(): void {
    this.#events.length = 0;
    this.#droppedEvents = 0;
  }

  get droppedEvents(): number {
    return this.#droppedEvents;
  }
}

export function recordTrace(
  sink: TraceSink | undefined,
  event: GatewayTraceEvent,
): void {
  try {
    sink?.record(event);
  } catch {
    // Telemetry is intentionally best-effort and cannot break gateway traffic.
  }
}
