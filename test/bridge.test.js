import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const KEY = "keen_bridge_test_key_abcdef";
const REMOTE_TOOLS = [
  { name: "search_web_pages", description: "search", inputSchema: { type: "object", properties: {} } },
  { name: "fetch_page_content", description: "fetch", inputSchema: { type: "object", properties: {} } },
];

// Minimal hosted server: MCP over JSON responses plus the agent device flow.
async function startRemote() {
  const state = { approved: false, toolCalls: [], codeRequests: [] };
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const json = (status, body) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      const path = new URL(req.url, "http://x").pathname;
      if (path === "/v1/auth/agent/code") {
        state.codeRequests.push(JSON.parse(raw));
        return json(200, {
          agent_code: "agent-1",
          user_code: "WXYZ-2345",
          verification_uri: "https://app.keenable.ai/link?code=WXYZ-2345",
          expires_in: 600,
          interval: 1,
        });
      }
      if (path === "/v1/auth/agent/token") {
        return json(200, state.approved ? { api_key: KEY } : { error: "authorization_pending" });
      }
      if (path !== "/mcp") return json(404, {});
      if (req.method !== "POST") {
        res.writeHead(405).end();
        return;
      }
      const msg = JSON.parse(raw);
      if (msg.id === undefined) {
        res.writeHead(202).end();
        return;
      }
      const reply = (result) => json(200, { jsonrpc: "2.0", id: msg.id, result });
      if (msg.method === "initialize") {
        return reply({
          protocolVersion: msg.params.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: "mock-remote", version: "1.0.0" },
        });
      }
      if (msg.method === "tools/list") return reply({ tools: REMOTE_TOOLS });
      if (msg.method === "tools/call") {
        const keyed = req.headers["x-api-key"] === KEY;
        state.toolCalls.push({ name: msg.params.name, keyed });
        return reply({ content: [{ type: "text", text: `remote ${msg.params.name} keyed=${keyed}` }] });
      }
      return json(200, { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "nope" } });
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return { state, url: `http://127.0.0.1:${port}/mcp`, close: () => server.close() };
}

function startBridge(env) {
  const child = spawn(process.execPath, [fileURLToPath(new URL("../src/index.js", import.meta.url))], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, KEENABLE_API_KEY: "", KEENABLE_GET_API_KEY: "", ...env },
  });
  const waiting = new Map();
  let buffer = "";
  let stderr = "";
  let stdout = "";
  child.stderr.on("data", (c) => (stderr += c));
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const message = JSON.parse(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
      waiting.get(message.id)?.(message);
    }
  });
  let nextId = 1;
  const request = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => reject(new Error(`no reply to ${method}`)), 30_000);
      waiting.set(id, (m) => {
        clearTimeout(timer);
        resolve(m);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  return {
    request,
    async init() {
      await request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    },
    output: () => stdout + stderr,
    stop: () => child.kill(),
  };
}

const callTool = (bridge, name) => bridge.request("tools/call", { name, arguments: {} });

test("flag off: tools/list and tools/call are forwarded unchanged", async () => {
  const remote = await startRemote();
  const bridge = startBridge({ KEENABLE_MCP_URL: remote.url });
  try {
    await bridge.init();
    const list = await bridge.request("tools/list");
    assert.deepEqual(list.result, { tools: REMOTE_TOOLS });

    const call = await callTool(bridge, "get_api_key");
    assert.deepEqual(call.result, { content: [{ type: "text", text: "remote get_api_key keyed=false" }] });
    assert.deepEqual(remote.state.codeRequests, []);
  } finally {
    bridge.stop();
    remote.close();
  }
});

test("flag on with KEENABLE_API_KEY set: the tool is not added", async () => {
  const remote = await startRemote();
  const bridge = startBridge({ KEENABLE_MCP_URL: remote.url, KEENABLE_GET_API_KEY: "1", KEENABLE_API_KEY: "keen_x" });
  try {
    await bridge.init();
    const list = await bridge.request("tools/list");
    assert.deepEqual(list.result, { tools: REMOTE_TOOLS });
  } finally {
    bridge.stop();
    remote.close();
  }
});

test("flag on: get_api_key returns the link, and after approval the next search is keyed", async () => {
  const remote = await startRemote();
  const bridge = startBridge({ KEENABLE_MCP_URL: remote.url, KEENABLE_GET_API_KEY: "1" });
  try {
    await bridge.init();
    const list = await bridge.request("tools/list");
    assert.deepEqual(
      list.result.tools.map((t) => t.name),
      ["search_web_pages", "fetch_page_content", "get_api_key"],
    );

    const before = await callTool(bridge, "search_web_pages");
    assert.equal(before.result.content[0].text, "remote search_web_pages keyed=false");

    const link = await callTool(bridge, "get_api_key");
    assert.equal(link.result.isError, undefined);
    assert.match(link.result.content[0].text, /Open: https:\/\/app\.keenable\.ai\/link\?code=WXYZ-2345/);
    assert.equal(remote.state.codeRequests[0].client_id, "keenable-mcp");

    remote.state.approved = true;
    const approved = await callTool(bridge, "get_api_key");
    assert.equal(approved.result.isError, undefined);
    assert.match(approved.result.content[0].text, /approved/);

    const after = await callTool(bridge, "search_web_pages");
    assert.equal(after.result.content[0].text, "remote search_web_pages keyed=true");
    assert.ok(!bridge.output().includes(KEY), "the key must never reach stdout or stderr");
  } finally {
    bridge.stop();
    remote.close();
  }
});
