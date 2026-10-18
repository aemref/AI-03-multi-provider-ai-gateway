import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("release check accepts the synchronized v1.0.0 tag", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/check-release.mjs", "v1.0.0"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /release metadata verified for multi-provider-ai-gateway@1\.0\.0 \(v1\.0\.0\)/u,
  );
});

test("release check rejects a tag that differs from package metadata", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/check-release.mjs", "v1.0.1"],
    { encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /release tag v1\.0\.1 does not match v1\.0\.0/u);
});
