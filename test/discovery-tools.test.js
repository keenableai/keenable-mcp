// Offline check of the static schemas catalog scanners read (src/discovery.js).
// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as toolsModule from "../src/discovery-tools.js";

const { TOOLS } = toolsModule;
const search = TOOLS.find((t) => t.name === "search_web_pages");
const fetchPage = TOOLS.find((t) => t.name === "fetch_page_content");

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
    // Clients that fill defaults would send include_domains: [], which the API rejects.
    assert.equal("default" in prop, false);
  });
}

test("descriptions point to include_domains and its limits", () => {
  const props = search.inputSchema.properties;
  assert.match(search.description, /include_domains/);
  assert.match(search.description, /exclude_domains/);
  assert.match(props.site.description, /include_domains/);
  assert.match(props.include_domains.description, /site/);
  assert.match(props.include_domains.description, /200/);
  assert.match(props.include_domains.description, /example\.com\/docs/);
  assert.match(props.include_domains.description, /\.gov/);
  assert.match(props.exclude_domains.description, /wins over include_domains/);
});

const PROPERTY_TYPES = {
  search_web_pages: {
    query: "string",
    mode: "string",
    site: "string",
    include_domains: "array",
    exclude_domains: "array",
    published_after: "string",
    published_before: "string",
    acquired_after: "string",
    acquired_before: "string",
  },
  fetch_page_content: { url: "string", live: "boolean", max_chars: "integer" },
};

for (const tool of TOOLS) {
  test(`${tool.name} keeps its properties, types and annotations`, () => {
    const props = tool.inputSchema.properties;
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.description.length > 0);
    assert.deepEqual(
      Object.fromEntries(Object.entries(props).map(([k, v]) => [k, v.type])),
      PROPERTY_TYPES[tool.name],
    );
    for (const [k, v] of Object.entries(props)) {
      assert.ok(v.description.length > 0, `${k} has no description`);
    }
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    });
  });
}

test("search_web_pages mode only allows pro", () => {
  assert.deepEqual(search.inputSchema.properties.mode.enum, ["pro"]);
});

test("fetch_page_content keeps url required, live default and max_chars minimum", () => {
  const props = fetchPage.inputSchema.properties;
  assert.deepEqual(fetchPage.inputSchema.required, ["url"]);
  assert.equal(props.live.default, false);
  assert.equal(props.max_chars.minimum, 1);
});

test("discovery.js imports only names that discovery-tools.js exports", async () => {
  const src = await readFile(new URL("../src/discovery.js", import.meta.url), "utf8");
  const imports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/discovery-tools\.js"/g)];
  assert.equal(imports.length, 1, "discovery.js must import from ./discovery-tools.js");
  for (const name of imports[0][1].split(",").map((s) => s.trim()).filter(Boolean)) {
    assert.ok(name in toolsModule, `${name} is not exported by discovery-tools.js`);
  }
  assert.match(src, /\{ tools: TOOLS \}/);
});

test("domain lists stay optional; only query is required", () => {
  assert.deepEqual(search.inputSchema.required, ["query"]);
});

test("catalog still lists both tools", () => {
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), ["fetch_page_content", "search_web_pages"]);
});
