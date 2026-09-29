import type {
  GatewayRequest,
  ProviderAdapter,
  ProviderContext,
  ProviderResponse,
} from "./contracts.js";

export type MockOutcome =
  | ProviderResponse
  | Error
  | ((
      request: GatewayRequest,
      context: ProviderContext,
    ) => ProviderResponse | Promise<ProviderResponse>);

export interface MockCall {
  readonly request: GatewayRequest;
  readonly requestId: string;
}

export class ScriptedMockAdapter implements ProviderAdapter {
  readonly calls: MockCall[] = [];
  readonly #outcomes: MockOutcome[];
  #cursor = 0;

  constructor(
    readonly name: string,
    outcomes: readonly MockOutcome[],
  ) {
    this.#outcomes = [...outcomes];
  }

  async generate(
    request: GatewayRequest,
    context: ProviderContext,
  ): Promise<ProviderResponse> {
    this.calls.push({ request, requestId: context.requestId });
    const outcome = this.#outcomes[this.#cursor];
    this.#cursor += 1;

    if (outcome === undefined) {
      throw new Error(`Mock provider ${this.name} exhausted its script`);
    }
    if (outcome instanceof Error) {
      throw outcome;
    }
    if (typeof outcome === "function") {
      return await outcome(request, context);
    }
    return outcome;
  }
}

export function createEchoMockAdapter(
  name: string,
  prefix: string,
): ProviderAdapter {
  return {
    name,
    async generate(request, context) {
      const lastMessage = request.messages.at(-1);
      return {
        id: `${name}-${context.requestId}`,
        model: request.model,
        message: {
          role: "assistant",
          content: `${prefix}${lastMessage?.content ?? ""}`,
        },
        finishReason: "stop",
        usage: {
          inputTokens: request.messages.length,
          outputTokens: 1,
        },
      };
    },
  };
}

