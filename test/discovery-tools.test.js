import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "../src/tools.js";

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

test("exclude_domains stays optional; only query is required", () => {
  assert.deepEqual(search.inputSchema.required, ["query"]);
});

test("lists the account tools after search and fetch", () => {
  assert.deepEqual(
    TOOLS.map((t) => t.name),
    ["search_web_pages", "fetch_page_content", "get_prices", "get_balance"],
  );
});

for (const name of ["get_prices", "get_balance"]) {
  test(`${name} takes no arguments and is read-only`, () => {
    const tool = TOOLS.find((t) => t.name === name);
    assert.deepEqual(tool.inputSchema, { type: "object", properties: {}, additionalProperties: false });
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
  });
}
