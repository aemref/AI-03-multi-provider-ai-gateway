import assert from "node:assert/strict";
import test from "node:test";

import type {
  GatewayRequest,
  ProviderContext,
  ProviderResponse,
  ProviderStreamEvent,
  StreamingProviderAdapter,
} from "../src/contracts.js";
import { GatewayError } from "../src/errors.js";
import { Gateway } from "../src/gateway.js";

const request: GatewayRequest = {
  model: "mock-small",
  messages: [{ role: "user", content: "hello" }],
};

function streamingAdapter(
  name: string,
  stream: (
    context: ProviderContext,
  ) => AsyncIterable<ProviderStreamEvent>,
): StreamingProviderAdapter {
  return {
    name,
    async generate(): Promise<ProviderResponse> {
      throw new Error("generate is not used in streaming tests");
    },
    stream(_request, context) {
      return stream(context);
    },
  };
}

test("streams provider events with provider identity", async () => {
  const adapter = streamingAdapter("primary", async function* (context) {
    assert.equal(context.requestId, "stream-1");
    yield { type: "delta", content: "hel" };
    yield { type: "delta", content: "lo" };
    yield { type: "done", finishReason: "stop" };
  });
  const gateway = new Gateway([adapter], {
    createRequestId: () => "stream-1",
  });

  const events = [];
  for await (const event of gateway.stream(request)) {
    events.push(event);
  }

  assert.deepEqual(events, [
    { type: "delta", content: "hel", provider: "primary" },
    { type: "delta", content: "lo", provider: "primary" },
    { type: "done", finishReason: "stop", provider: "primary" },
  ]);
});

test("falls back when a stream fails before emitting data", async () => {
  const primary = streamingAdapter("primary", async function* () {
    throw new GatewayError("unavailable", "offline");
  });
  const fallback = streamingAdapter("fallback", async function* () {
    yield { type: "delta", content: "served" };
    yield { type: "done", finishReason: "stop" };
  });
  const gateway = new Gateway([primary, fallback]);

  const events = [];
  for await (const event of gateway.stream(request)) {
    events.push(event);
  }

  assert.equal(events[0]?.provider, "fallback");
});

test("does not splice a fallback into a partially emitted stream", async () => {
  let fallbackCalled = false;
  const primary = streamingAdapter("primary", async function* () {
    yield { type: "delta", content: "partial" };
    throw new GatewayError("unavailable", "connection lost");
  });
  const fallback = streamingAdapter("fallback", async function* () {
    fallbackCalled = true;
    yield { type: "delta", content: "unsafe continuation" };
  });
  const gateway = new Gateway([primary, fallback]);

  await assert.rejects(
    async () => {
      for await (const _event of gateway.stream(request)) {
        // Consume until the provider failure is surfaced.
      }
    },
    (error: unknown) =>
      error instanceof GatewayError && error.provider === "primary",
  );
  assert.equal(fallbackCalled, false);
});

test("cancels a provider that is waiting for its first event", async () => {
  const controller = new AbortController();
  let providerObservedAbort = false;
  const adapter = streamingAdapter("slow", async function* (context) {
    await new Promise<void>((resolve) => {
      context.signal.addEventListener(
        "abort",
        () => {
          providerObservedAbort = true;
          resolve();
        },
        { once: true },
      );
    });
    yield { type: "delta", content: "too late" };
  });
  const gateway = new Gateway([adapter], { timeoutMs: 1_000 });

  const pending = (async () => {
    for await (const _event of gateway.stream(request, controller.signal)) {
      // The request is cancelled before an event arrives.
    }
  })();
  controller.abort(new Error("client disconnected"));

  await assert.rejects(
    pending,
    (error: unknown) => error instanceof GatewayError && error.kind === "aborted",
  );
  assert.equal(providerObservedAbort, true);
});
