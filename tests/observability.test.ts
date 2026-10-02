import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryTraceSink,
  recordTrace,
  type GatewayTraceEvent,
} from "../src/observability.js";

const started: GatewayTraceEvent = {
  type: "request.started",
  timestampMs: 100,
  requestId: "request-1",
  operation: "generate",
  model: "mock-small",
};

test("stores immutable snapshots of content-free trace events", () => {
  const sink = new InMemoryTraceSink();

  sink.record(started);
  const first = sink.snapshot();
  sink.clear();

  assert.deepEqual(first, [started]);
  assert.deepEqual(sink.snapshot(), []);
  assert.equal(JSON.stringify(first).includes("messages"), false);
  assert.equal(JSON.stringify(first).includes("metadata"), false);
});

test("does not let a failing telemetry sink break request handling", () => {
  assert.doesNotThrow(() =>
    recordTrace(
      {
        record() {
          throw new Error("collector unavailable");
        },
      },
      started,
    ),
  );
});

test("keeps only the newest events within its configured bound", () => {
  const sink = new InMemoryTraceSink({ maxEvents: 2 });

  sink.record(started);
  sink.record({ ...started, requestId: "request-2" });
  sink.record({ ...started, requestId: "request-3" });

  assert.deepEqual(
    sink.snapshot().map((event) => event.requestId),
    ["request-2", "request-3"],
  );
  assert.equal(sink.droppedEvents, 1);

  sink.clear();
  assert.equal(sink.droppedEvents, 0);
});

test("rejects invalid in-memory trace bounds", () => {
  assert.throws(
    () => new InMemoryTraceSink({ maxEvents: 0 }),
    /positive safe integer/,
  );
  assert.throws(
    () => new InMemoryTraceSink({ maxEvents: 1.5 }),
    /positive safe integer/,
  );
});
