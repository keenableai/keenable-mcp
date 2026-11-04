// Offline check of the static schemas catalog scanners read (src/discovery.js).
// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "../src/discovery-tools.js";

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
  });
}

test("domain lists stay optional; only query is required", () => {
  assert.deepEqual(search.inputSchema.required, ["query"]);
});

test("catalog still lists both tools", () => {
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), ["fetch_page_content", "search_web_pages"]);
});
