import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "../src/tools.js";

const search = TOOLS.find((t) => t.name === "search_web_pages");

test("search_web_pages keeps site as a deprecated string", () => {
  const prop = search.inputSchema.properties.site;
  assert.equal(prop.type, "string");
  assert.equal(prop.deprecated, true);
  assert.match(prop.description, /2027-02-15/);
  assert.match(prop.description, /include_domains/);
});

test("search_web_pages declares include_domains as an array of up to 50 strings", () => {
  const prop = search.inputSchema.properties.include_domains;
  assert.ok(prop, "include_domains missing");
  assert.equal(prop.type, "array");
  assert.deepEqual(prop.items, { type: "string" });
  assert.equal(prop.maxItems, 50);
  assert.equal("default" in prop, false);
  assert.match(prop.description, /"\.gov"/);
});

test("the search description points at include_domains, not the site filter", () => {
  assert.match(search.description, /use include_domains to search only some sites/);
  assert.doesNotMatch(search.description, /site filter/);
});

test("exclude_domains accepts public suffixes with a leading dot", () => {
  const { description } = search.inputSchema.properties.exclude_domains;
  assert.match(description, /A public suffix written with a leading dot, such as "\.gov", excludes every host under it\./);
  assert.doesNotMatch(description, /No paths, suffixes/);
});

test("search_web_pages declares exclude_domains as an array of strings", () => {
  const prop = search.inputSchema.properties.exclude_domains;
  assert.ok(prop, "exclude_domains missing");
  assert.equal(prop.type, "array");
  assert.deepEqual(prop.items, { type: "string" });
  assert.equal("default" in prop, false);
});

test("include_domains and exclude_domains stay optional; only query is required", () => {
  assert.deepEqual(search.inputSchema.required, ["query"]);
});
