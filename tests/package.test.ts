import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { VERSION } from "../src/index.js";

test("package exposes its version", () => {
  assert.equal(VERSION, "0.1.0");
});

test("OpenAPI request bounds match the gateway security defaults", () => {
  const openapi = readFileSync("docs/openapi.yaml", "utf8");

  assert.match(openapi, /maxLength: 128\n/u);
  assert.match(openapi, /maxItems: 50\n/u);
  assert.match(openapi, /x-max-total-content-characters: 128000\n/u);
  assert.match(openapi, /maximum: 32768\n/u);
  assert.match(openapi, /maxProperties: 20\n/u);
  assert.match(
    openapi,
    /required: \[id, model, message, finishReason, usage, provider, requestId\]/u,
  );
});

test("local dashboard example renders aggregate mock evidence", () => {
  const result = spawnSync(process.execPath, ["examples/dashboard.mjs"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Deterministic local mock dashboard/);
  assert.match(result.stdout, /Requests: 3 total · 3 completed · 0 failed/);
  assert.match(result.stdout, /\| fallback \| 1 \| 100\.0%/);
  assert.match(result.stdout, /\| primary \| 3 \| 66\.7%/);
  assert.doesNotMatch(result.stdout, /local request|mock output/);
});

test("strategy benchmark runs the cache and routing workloads", () => {
  const result = spawnSync(process.execPath, ["examples/strategy-benchmark.mjs"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Deterministic local strategy benchmark/);
  assert.match(
    result.stdout,
    /\| exact_cache \| 6 \| 3 \| 50\.0% \| 1 \| 40 \| \$0\.015000 \|/,
  );
  assert.match(
    result.stdout,
    /\| lowest_estimated_cost \| 3 \| 0 \| 0\.0% \| 70 \| 70 \| \$0\.003450 \|/,
  );
  assert.match(
    result.stdout,
    /\| lowest_estimated_latency \| 3 \| 0 \| 0\.0% \| 15 \| 15 \| \$0\.029300 \|/,
  );
  assert.match(result.stdout, /no external provider was contacted/);
});

test("security demo rejects oversized input without printing its fake secret", () => {
  const result = spawnSync(process.execPath, ["examples/security.mjs"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"credentialRedacted": true/u);
  assert.match(result.stdout, /"oversizedRequestRejected": true/u);
  assert.match(result.stdout, /"providerCalls": 0/u);
  assert.doesNotMatch(result.stdout, /local-example-secret/u);
});
