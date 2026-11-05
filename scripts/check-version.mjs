#!/usr/bin/env node
// package.json is the source of truth for the npm version; src/*.js read it at
// runtime. server.json (MCP Registry manifest) must name that version as a
// literal for the npm package entry, so this fails if the two disagree.
// Runs before `npm publish` (prepublishOnly).

import { readFileSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const pkg = read("package.json");
const server = read("server.json");

const entry = (server.packages || []).find(
  (p) => p.registryType === "npm" && p.identifier === pkg.name,
);
if (!entry) {
  console.error(`server.json has no npm package entry for ${pkg.name}`);
  process.exit(1);
}
if (entry.version !== pkg.version) {
  console.error(
    `Version mismatch: package.json is ${pkg.version} but server.json ` +
      `packages[${pkg.name}].version is ${entry.version}. Update server.json.`,
  );
  process.exit(1);
}
console.log(`server.json npm package version matches package.json (${pkg.version}).`);
