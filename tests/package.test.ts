import assert from "node:assert/strict";
import test from "node:test";

import { VERSION } from "../src/index.js";

test("package exposes its version", () => {
  assert.equal(VERSION, "0.1.0");
});

