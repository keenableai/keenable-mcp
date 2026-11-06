import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as toolsModule from "../src/tools.js";

const { TOOLS } = toolsModule;
const search = TOOLS.find((t) => t.name === "search_web_pages");

test("search_web_pages keeps site as a string", () => {
  assert.equal(search.inputSchema.properties.site.type, "string");
});

test("search_web_pages declares exclude_domains as an array of strings", () => {
  const prop = search.inputSchema.properties.exclude_domains;
  assert.ok(prop, "exclude_domains missing");
  assert.equal(prop.type, "array");
  assert.deepEqual(prop.items, { type: "string" });
  assert.equal("default" in prop, false);
});

test("tool description points to exclude_domains", () => {
  assert.match(search.description, /exclude_domains/);
});

test("exclude_domains description states the host-only contract and limit", () => {
  const desc = search.inputSchema.properties.exclude_domains.description;
  assert.match(desc, /host names/);
  assert.match(desc, /subdomains/);
  assert.match(desc, /up to 1,000 hosts/);
  assert.match(desc, /No paths/);
  assert.match(desc, /wildcards/);
});

test("discovery.js imports only names that tools.js exports", async () => {
  const src = await readFile(new URL("../src/discovery.js", import.meta.url), "utf8");
  const imports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/tools\.js"/g)];
  assert.equal(imports.length, 1, "discovery.js must import from ./tools.js");
  for (const name of imports[0][1].split(",").map((s) => s.trim()).filter(Boolean)) {
    assert.ok(name in toolsModule, `${name} is not exported by tools.js`);
  }
  assert.match(src, /\{ tools: TOOLS \}/);
});

test("exclude_domains stays optional; only query is required", () => {
  assert.deepEqual(search.inputSchema.required, ["query"]);
});

test("catalog still lists both tools", () => {
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), ["fetch_page_content", "search_web_pages"]);
});
