import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const compiledTests = readdirSync("coverage/tests")
  .filter((name) => name.endsWith(".test.js"))
  .sort();
assert.ok(
  compiledTests.includes("package.test.js"),
  "compiled package smoke tests are missing",
);

// Node 20 cannot reliably merge coverage from the child processes used by the
// package smoke tests. `npm run verify` still runs them before this isolated
// in-process coverage pass.
const testFiles = compiledTests
  .filter((name) => name !== "package.test.js")
  .map((name) => `coverage/tests/${name}`);

assert.ok(testFiles.length > 0, "compiled test suite is empty");

const result = spawnSync(
  process.execPath,
  [
    "--test",
    "--experimental-test-coverage",
    "--test-reporter=lcov",
    ...testFiles,
  ],
  { encoding: "utf8" },
);

if (result.status !== 0) {
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const sourceRecords = result.stdout
  .split("end_of_record")
  .filter((record) => /^SF:.*coverage\/src\/.*\.js$/mu.test(record));
assert.ok(sourceRecords.length > 0, "LCOV report contains no source modules");

function sum(label) {
  return sourceRecords.reduce((total, record) => {
    const match = record.match(new RegExp(`^${label}:(\\d+)$`, "mu"));
    assert.ok(match, `LCOV source record is missing ${label}`);
    return total + Number(match[1]);
  }, 0);
}

function percent(covered, found) {
  assert.ok(found > 0, "LCOV metric contains no measurable items");
  return Number(((covered / found) * 100).toFixed(2));
}

const observed = {
  lines: percent(sum("LH"), sum("LF")),
  branches: percent(sum("BRH"), sum("BRF")),
  functions: percent(sum("FNH"), sum("FNF")),
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
