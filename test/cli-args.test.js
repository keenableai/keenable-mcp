import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseArgs } from "../src/cli-args.js";

const ENTRY = fileURLToPath(new URL("../src/index.js", import.meta.url));
const { version } = createRequire(import.meta.url)("../package.json");

const run = (...args) =>
  spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8", input: "", timeout: 10_000 });

test("no arguments starts the bridge", () => {
  assert.deepEqual(parseArgs([]), { action: "serve" });
});

test("--help prints usage on stdout and exits 0", () => {
  const r = run("--help");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^Usage: npx -y @keenable\/mcp/);
  assert.match(r.stdout, /KEENABLE_API_KEY/);
  assert.equal(r.stderr, "");
});

test("-h is the same as --help", () => {
  assert.equal(parseArgs(["-h"]).action, "help");
});

test("--version prints the package version and exits 0", () => {
  const r = run("--version");
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), version);
});

test("an unknown argument exits 2 with a fix on stderr", () => {
  const r = run("--api-key", "x");
  assert.equal(r.status, 2);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /unknown argument "--api-key"/);
  assert.match(r.stderr, /KEENABLE_API_KEY/);
  assert.match(r.stderr, /--help/);
});
