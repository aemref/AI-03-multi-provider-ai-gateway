export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface GatewayMessage {
  readonly role: MessageRole;
  readonly content: string;
  readonly name?: string;
}

export interface GatewayRequest {
  readonly model: string;
  readonly messages: readonly GatewayMessage[];
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type FinishReason = "stop" | "length" | "tool_call";

export interface ProviderResponse {
  readonly id: string;
  readonly model: string;
  readonly message: GatewayMessage;
  readonly finishReason: FinishReason;
  readonly usage: TokenUsage;
}

export interface GatewayResponse extends ProviderResponse {
  readonly provider: string;
}

export interface ProviderContext {
  readonly requestId: string;
  readonly signal: AbortSignal;
}

export interface ProviderAdapter {
  readonly name: string;
  generate(
    request: GatewayRequest,
    context: ProviderContext,
  ): Promise<ProviderResponse>;
}

export interface StreamDeltaEvent {
  readonly type: "delta";
  readonly content: string;
}

export interface StreamUsageEvent {
  readonly type: "usage";
  readonly usage: TokenUsage;
}

export interface StreamDoneEvent {
  readonly type: "done";
  readonly finishReason: FinishReason;
}

export type ProviderStreamEvent =
  | StreamDeltaEvent
  | StreamUsageEvent
  | StreamDoneEvent;

export type GatewayStreamEvent = ProviderStreamEvent & {
  readonly provider: string;
};

export interface StreamingProviderAdapter extends ProviderAdapter {
  stream(
    request: GatewayRequest,
    context: ProviderContext,
  ): AsyncIterable<ProviderStreamEvent>;
}
