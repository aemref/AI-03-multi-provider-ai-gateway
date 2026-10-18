import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
const source = readFileSync("src/index.ts", "utf8");
const openapi = readFileSync("docs/openapi.yaml", "utf8");
const changelog = readFileSync("CHANGELOG.md", "utf8");

assert.match(manifest.version, /^[1-9]\d*\.\d+\.\d+$/u, "release must be stable SemVer");
assert.equal(lockfile.version, manifest.version, "lockfile version differs from package");
assert.equal(
  lockfile.packages[""].version,
  manifest.version,
  "root lockfile package version differs from package",
);
assert.match(
  source,
  new RegExp(`export const VERSION = "${manifest.version.replaceAll(".", "\\.")}";`, "u"),
  "exported version differs from package",
);
assert.match(
  openapi,
  new RegExp(`^  version: ${manifest.version.replaceAll(".", "\\.")}$`, "mu"),
  "OpenAPI version differs from package",
);
assert.match(
  changelog,
  new RegExp(`^## \\[${manifest.version.replaceAll(".", "\\.")}\\] - \\d{4}-\\d{2}-\\d{2}$`, "mu"),
  "changelog lacks a dated release heading",
);

const expectedTag = `v${manifest.version}`;
const requestedTag = process.argv[2] ?? expectedTag;
assert.equal(requestedTag, expectedTag, `release tag ${requestedTag} does not match ${expectedTag}`);
assert.match(
  changelog,
  new RegExp(
    `^\\[${manifest.version.replaceAll(".", "\\.")}\\]: https://github\\.com/aemref/AI-03-multi-provider-ai-gateway/releases/tag/${expectedTag}$`,
    "mu",
  ),
  "changelog lacks the GitHub release link",
);

console.log(`release metadata verified for ${manifest.name}@${manifest.version} (${expectedTag})`);
