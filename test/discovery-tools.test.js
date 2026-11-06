import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as toolsModule from "../src/tools.js";

const { TOOLS } = toolsModule;
const search = TOOLS.find((t) => t.name === "search_web_pages");

test("search_web_pages keeps site as a string", () => {
  assert.equal(search.inputSchema.properties.site.type, "string");
});

for (const name of ["include_domains", "exclude_domains"]) {
  test(`search_web_pages declares ${name} as an array of strings`, () => {
    const prop = search.inputSchema.properties[name];
    assert.ok(prop, `${name} missing`);
    assert.equal(prop.type, "array");
    assert.deepEqual(prop.items, { type: "string" });
    assert.ok(prop.description.length > 0);
    assert.equal("default" in prop, false);
  });
}

test("descriptions point to include_domains and exclude_domains", () => {
  const props = search.inputSchema.properties;
  assert.match(search.description, /include_domains/);
  assert.match(search.description, /exclude_domains/);
  assert.match(props.site.description, /include_domains/);
  assert.match(props.include_domains.description, /site/);
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

test("domain lists stay optional; only query is required", () => {
  assert.deepEqual(search.inputSchema.required, ["query"]);
});

test("catalog still lists both tools", () => {
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), ["fetch_page_content", "search_web_pages"]);
});
