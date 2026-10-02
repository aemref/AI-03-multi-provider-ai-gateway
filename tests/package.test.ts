import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { VERSION } from "../src/index.js";

test("package exposes its version", () => {
  assert.equal(VERSION, "0.1.0");
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
