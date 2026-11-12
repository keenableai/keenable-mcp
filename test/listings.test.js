import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const text = (p) => readFileSync(new URL(p, root), "utf8");
const json = (p) => JSON.parse(text(p));
const titleOf = (url) => new URL(url).searchParams.get("keenable_title");

const STORES = {
  "claude-plugin": {
    marketplace: ".claude-plugin/marketplace.json",
    manifest: "listings/claude-code/.claude-plugin/plugin.json",
    mcp: "listings/claude-code/.mcp.json",
  },
  cursor: {
    marketplace: ".cursor-plugin/marketplace.json",
    manifest: "listings/cursor/.cursor-plugin/plugin.json",
    mcp: "listings/cursor/mcp.json",
  },
};

const webLinks = (s) => s.match(/https:\/\/(?:app\.)?keenable\.ai\/[^\s)"'>]*/g) ?? [];

for (const [tag, files] of Object.entries(STORES)) {
  test(`${tag}: the MCP server carries keenable_title=${tag}`, () => {
    const servers = Object.values(json(files.mcp).mcpServers);
    assert.equal(servers.length, 1);
    assert.equal(new URL(servers[0].url).origin, "https://api.keenable.ai");
    assert.equal(titleOf(servers[0].url), tag);
    assert.equal(servers[0].headers, undefined);
  });

  test(`${tag}: every keenable.ai link carries utm_source=${tag}&utm_medium=registry`, () => {
    const dir = files.manifest.split("/").slice(0, 2).join("/");
    const links = [...webLinks(text(files.manifest)), ...webLinks(text(`${dir}/README.md`))];
    assert.ok(links.length > 0);
    for (const link of links) {
      if (new URL(link).pathname.match(/^\/(privacy|terms)$/)) continue;
      const params = new URL(link).searchParams;
      assert.equal(params.get("utm_source"), tag, link);
      assert.equal(params.get("utm_medium"), "registry", link);
    }
  });

  test(`${tag}: the marketplace entry points at its own listing folder`, () => {
    const market = json(files.marketplace);
    const manifest = json(files.manifest);
    assert.equal(market.plugins.length, 1);
    assert.equal(market.plugins[0].name, manifest.name);
    const source = market.plugins[0].source.replace(/^\.\//, "");
    assert.equal(files.manifest.startsWith(`${source}/`), true);
  });
}

test("each store has its own listing folder (no shared bundle)", () => {
  const dirs = Object.values(STORES).map((f) => f.mcp.split("/").slice(0, 2).join("/"));
  assert.equal(new Set(dirs).size, dirs.length);
  assert.equal(existsSync(new URL(".mcp.json", root)), false);
  assert.equal(existsSync(new URL("mcp.json", root)), false);
});

test("the Claude plugin icon is a square PNG of 512-2048 px", () => {
  const manifest = json(STORES["claude-plugin"].manifest);
  const png = readFileSync(new URL(`listings/claude-code/${manifest.icon}`, root));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  const w = png.readUInt32BE(16);
  assert.equal(w, png.readUInt32BE(20));
  assert.ok(w >= 512 && w <= 2048);
});

test("Cline install guide connects to the URL with keenable_title=cline and tags its link with utm", () => {
  const guide = text("llms-install.md");
  assert.match(guide.split("\n")[0], /^# Installation guide for Cline$/);
  const configs = [...guide.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
  assert.equal(configs.length, 2);
  for (const config of configs) {
    const server = config.mcpServers.keenable;
    assert.equal(server.type, "streamableHttp");
    assert.equal(server.command, undefined);
    assert.equal(new URL(server.url).origin, "https://api.keenable.ai");
    assert.equal(titleOf(server.url), "cline");
  }
  assert.equal(new URL(configs[0].mcpServers.keenable.url).pathname, "/mcp-public");
  assert.equal(new URL(configs[1].mcpServers.keenable.url).pathname, "/mcp");
  assert.ok(configs[1].mcpServers.keenable.headers["X-API-Key"]);
  for (const link of webLinks(guide)) {
    assert.equal(new URL(link).searchParams.get("utm_source"), "cline", link);
    assert.equal(new URL(link).searchParams.get("utm_medium"), "registry", link);
  }
});

test("server.json is the MCP Registry entry", () => {
  const server = json("server.json");
  assert.equal(server.name, "ai.keenable/web-search");
  assert.equal(server.version, "0.2.2");
  assert.deepEqual(
    server.remotes.map((r) => r.url),
    ["https://api.keenable.ai/mcp-public?keenable_title=mcp-registry"],
  );
  assert.ok(server.description.length <= 100);
  const optional = [
    ...server.remotes.flatMap((r) => r.headers),
    ...server.packages.flatMap((p) => p.environmentVariables),
  ];
  for (const field of optional) assert.equal("isRequired" in field, false, field.name);
});

test("the npm bridge default endpoint is unchanged", () => {
  assert.match(
    text("src/index.js"),
    /process\.env\.KEENABLE_MCP_URL \|\| "https:\/\/api\.keenable\.ai\/mcp\?keenable_title=npm"/,
  );
});

test("the skill script keeps its existing attribution title", () => {
  assert.match(
    text("skills/keenable-web-search/scripts/search.py"),
    /APP_TITLE = "OpenClaw Skill"/,
  );
});
