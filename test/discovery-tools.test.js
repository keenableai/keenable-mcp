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
