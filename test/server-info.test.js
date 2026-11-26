import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { serverInfo, SERVER_METADATA, SERVER_NAME } from "../src/metadata.js";

const { version: VERSION } = createRequire(import.meta.url)("../package.json");

test("serverInfo falls back to the static metadata when the remote sends none", () => {
  assert.deepEqual(serverInfo("1.2.3", { name: "keenable-mcp-server", version: "0.2.1" }), {
    name: SERVER_NAME,
    version: "1.2.3",
    ...SERVER_METADATA,
  });
  assert.deepEqual(serverInfo("1.2.3", undefined), { name: SERVER_NAME, version: "1.2.3", ...SERVER_METADATA });
});

test("serverInfo forwards the remote title, description, website and icons", () => {
  const remote = {
    name: "keenable-mcp-server",
    version: "9.9.9",
    title: "Remote Title",
    description: "Remote description.",
    websiteUrl: "https://example.com/docs",
    icons: [{ src: "https://example.com/icon.svg", mimeType: "image/svg+xml", sizes: ["any"] }],
  };
  assert.deepEqual(serverInfo("1.2.3", remote), {
    name: SERVER_NAME,
    version: "1.2.3",
    title: remote.title,
    description: remote.description,
    websiteUrl: remote.websiteUrl,
    icons: remote.icons,
  });
});

test("the static icon is scalable", () => {
  assert.ok(SERVER_METADATA.icons.some((i) => i.mimeType === "image/svg+xml" && i.sizes?.includes("any")));
});

function rpcOverStdio(script, requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    const pending = new Map(requests.map((r) => [r.id, null]));
    let buffer = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("no response within 10s"));
    }, 10_000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const message = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (pending.has(message.id)) pending.set(message.id, message);
      }
      if ([...pending.values()].every(Boolean)) {
        clearTimeout(timer);
        child.kill();
        resolve(Object.fromEntries(pending));
      }
    });
    child.on("error", reject);
    for (const r of requests) child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...r }) + "\n");
  });
}

test("discovery build advertises the metadata and both tools over stdio", async () => {
  const responses = await rpcOverStdio("../src/discovery.js", [
    {
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    },
    { id: 2, method: "tools/list", params: {} },
  ]);
  assert.deepEqual(responses[1].result.serverInfo, { name: SERVER_NAME, version: VERSION, ...SERVER_METADATA });
  assert.deepEqual(
    responses[2].result.tools.map((t) => t.name),
    ["search_web_pages", "fetch_page_content"],
  );
});
