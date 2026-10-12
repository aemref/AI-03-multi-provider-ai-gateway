import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const testFiles = readdirSync("dist/tests")
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => `dist/tests/${name}`);

assert.ok(testFiles.length > 0, "compiled test suite is empty");

const result = spawnSync(
  process.execPath,
  ["--test", "--experimental-test-coverage", ...testFiles],
  { encoding: "utf8" },
);

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const summary = result.stdout.match(
  /all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/u,
);
assert.ok(summary, "Node test runner did not emit an aggregate coverage row");

const observed = {
  lines: Number(summary[1]),
  branches: Number(summary[2]),
  functions: Number(summary[3]),
};
const minimum = { lines: 85, branches: 75, functions: 80 };

for (const metric of Object.keys(minimum)) {
  assert.ok(
    observed[metric] >= minimum[metric],
    `${metric} coverage ${observed[metric]}% is below ${minimum[metric]}%`,
  );
}

console.log(
  `coverage gate passed: ${observed.lines}% lines, ${observed.branches}% branches, ${observed.functions}% functions`,
);
