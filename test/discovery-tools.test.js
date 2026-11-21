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

const fetchTool = TOOLS.find((t) => t.name === "fetch_page_content");

test("fetch_page_content takes urls as an array of 1 to 20 strings", () => {
  const prop = fetchTool.inputSchema.properties.urls;
  assert.equal(prop.type, "array");
  assert.deepEqual(prop.items, { type: "string" });
  assert.equal(prop.minItems, 1);
  assert.equal(prop.maxItems, 20);
});

test("fetch_page_content reads live with max_age_hours 0 to 720", () => {
  const prop = fetchTool.inputSchema.properties.max_age_hours;
  assert.equal(prop.type, "number");
  assert.equal(prop.minimum, 0);
  assert.equal(prop.maximum, 720);
});

test("fetch_page_content requires urls and has no url or live", () => {
  const { properties, required } = fetchTool.inputSchema;
  assert.deepEqual(required, ["urls"]);
  assert.equal("url" in properties, false);
  assert.equal("live" in properties, false);
});
