import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { VERSION } from "../src/index.js";

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly type: string;
  readonly main: string;
  readonly types: string;
  readonly exports: {
    readonly ".": {
      readonly types: string;
      readonly import: string;
    };
  };
  readonly files: readonly string[];
  readonly engines: { readonly node: string };
}

interface PackageLock {
  readonly version: string;
  readonly packages: {
    readonly "": { readonly version: string };
  };
}

const packageManifest = JSON.parse(
  readFileSync("package.json", "utf8"),
) as PackageManifest;
const packageLock = JSON.parse(
  readFileSync("package-lock.json", "utf8"),
) as PackageLock;
const changelog = readFileSync("CHANGELOG.md", "utf8");

test("stable release metadata identifies the v1.0.0 release", () => {
  assert.equal(packageManifest.version, "1.0.0");
  assert.equal(VERSION, "1.0.0");
  assert.match(changelog, /^## \[1\.0\.0\] - 2026-10-18$/mu);
  assert.match(
    changelog,
    /^\[Unreleased\]: https:\/\/github\.com\/aemref\/AI-03-multi-provider-ai-gateway\/compare\/v1\.0\.0\.\.\.HEAD$/mu,
  );
  assert.match(
    changelog,
    /^\[1\.0\.0\]: https:\/\/github\.com\/aemref\/AI-03-multi-provider-ai-gateway\/releases\/tag\/v1\.0\.0$/mu,
  );
});

test("release version stays synchronized across public metadata", () => {
  const openapi = readFileSync("docs/openapi.yaml", "utf8");

  assert.match(packageManifest.version, /^\d+\.\d+\.\d+$/u);
  assert.equal(packageManifest.version, VERSION);
  assert.equal(packageLock.version, VERSION);
  assert.equal(packageLock.packages[""].version, VERSION);
  assert.match(openapi, new RegExp(`version: ${VERSION.replaceAll(".", "\\.")}`));
});

test("package manifest exposes one ESM entry point and bounded release files", () => {
  assert.equal(packageManifest.name, "multi-provider-ai-gateway");
  assert.equal(packageManifest.type, "module");
  assert.equal(packageManifest.main, "./dist/src/index.js");
  assert.equal(packageManifest.types, "./dist/src/index.d.ts");
  assert.deepEqual(packageManifest.exports["."], {
    types: "./dist/src/index.d.ts",
    import: "./dist/src/index.js",
  });
  assert.deepEqual(packageManifest.files, [
    "dist/src",
    "docs",
    "examples",
    "CHANGELOG.md",
    "README.md",
    "LICENSE",
  ]);
  assert.equal(packageManifest.engines.node, ">=20");
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

test("RAG and agent example keeps tool execution outside the gateway", () => {
  const result = spawnSync(
    process.execPath,
    ["examples/rag-agent-integration.mjs"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"requestId": "rag-request-001"/u);
  assert.match(result.stdout, /"provider": "local-rag-mock"/u);
  assert.match(result.stdout, /"citationIds": \[/u);
  assert.match(result.stdout, /"name": "fetch_lesson"/u);
  assert.match(result.stdout, /"lessonId": "lesson-42"/u);
  assert.match(result.stdout, /"toolExecuted": false/u);
});
