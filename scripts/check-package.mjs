import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npm",
  ["pack", "--dry-run", "--json", "--ignore-scripts"],
  {
    encoding: "utf8",
    env: { ...process.env, npm_config_cache: ".cache/npm" },
  },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

let reports;
try {
  reports = JSON.parse(result.stdout);
} catch (error) {
  throw new Error("npm pack did not return valid JSON", { cause: error });
}

assert.equal(reports.length, 1, "npm pack must describe exactly one archive");
const [report] = reports;
const paths = new Set(report.files.map((file) => file.path));

assert.equal(report.name, "multi-provider-ai-gateway");
assert.match(report.version, /^\d+\.\d+\.\d+$/u);
assert.ok(report.size > 0 && report.size <= 100_000, "archive must stay under 100 kB");
assert.ok(
  report.unpackedSize > 0 && report.unpackedSize <= 250_000,
  "unpacked archive must stay under 250 kB",
);

for (const path of [
  "LICENSE",
  "README.md",
  "package.json",
  "dist/src/index.js",
  "dist/src/index.d.ts",
  "docs/architecture.md",
  "docs/roadmap.md",
  "examples/node-client.mjs",
]) {
  assert.ok(paths.has(path), `publishable archive is missing ${path}`);
}

for (const path of paths) {
  assert.doesNotMatch(
    path,
    /^(?:\.github|scripts|src|tests|dist\/tests)(?:\/|$)|(?:^|\/)\.env(?:\.|$)/u,
    `development-only or secret-bearing path leaked into archive: ${path}`,
  );
}

const kilobytes = (report.size / 1000).toFixed(1);
console.log(
  `verified ${report.name}@${report.version}: ${report.entryCount} files, ${kilobytes} kB`,
);
