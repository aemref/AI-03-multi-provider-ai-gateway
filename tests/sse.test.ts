import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayStreamEvent } from "../src/contracts.js";
import {
  createSseResponse,
  encodeServerSentEvent,
  SSE_HEADERS,
} from "../src/sse.js";

test("encodes one JSON payload per SSE frame", () => {
  const event: GatewayStreamEvent = {
    type: "delta",
    content: "hello\nworld 👋",
    provider: "mock-a",
    requestId: "request-1",
  };

  assert.equal(
    encodeServerSentEvent(event),
    `event: delta\ndata: ${JSON.stringify(event)}\n\n`,
  );
});

test("creates an unbuffered UTF-8 event-stream response", async () => {
  async function* events(): AsyncIterable<GatewayStreamEvent> {
    yield {
      type: "delta",
      content: "merhaba",
      provider: "mock-a",
      requestId: "request-1",
    };
    yield {
      type: "usage",
      usage: { inputTokens: 2, outputTokens: 1 },
      provider: "mock-a",
      requestId: "request-1",
    };
    yield {
      type: "done",
      finishReason: "stop",
      provider: "mock-a",
      requestId: "request-1",
    };
  }

  const response = createSseResponse(events());

  assert.equal(response.status, 200);
  for (const [name, value] of Object.entries(SSE_HEADERS)) {
    assert.equal(response.headers.get(name), value);
  }
  assert.equal(
    await response.text(),
    [
      'event: delta\ndata: {"type":"delta","content":"merhaba","provider":"mock-a","requestId":"request-1"}\n\n',
      'event: usage\ndata: {"type":"usage","usage":{"inputTokens":2,"outputTokens":1},"provider":"mock-a","requestId":"request-1"}\n\n',
      'event: done\ndata: {"type":"done","finishReason":"stop","provider":"mock-a","requestId":"request-1"}\n\n',
    ].join(""),
  );
});

test("cancelling the response closes the upstream iterator", async () => {
  let closed = false;
  async function* events(): AsyncIterable<GatewayStreamEvent> {
    try {
      yield {
        type: "delta",
        content: "first",
        provider: "mock-a",
        requestId: "request-1",
      };
      await new Promise(() => undefined);
    } finally {
      closed = true;
    }
  }

  const reader = createSseResponse(events()).body?.getReader();
  assert.ok(reader);
  await reader.read();
  await reader.cancel("client disconnected");

  assert.equal(closed, true);
});
