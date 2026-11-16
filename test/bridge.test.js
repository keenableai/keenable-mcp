// Runs the real bridge (src/index.js) over stdio against a local stand-in for
// the hosted server, so no test touches the network.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SERVER_METADATA, SERVER_NAME } from "../src/metadata.js";
import { TOOLS } from "../src/tools.js";

const BRIDGE = fileURLToPath(new URL("../src/index.js", import.meta.url));
const REMOTE_TOOL = { name: "echo", description: "Echo.", inputSchema: { type: "object" } };

// A stateless Streamable HTTP MCP server that answers in plain JSON, like the
// hosted one. `reject` makes it refuse every request the way a bad key does,
// `rpcError` makes it answer every request with a JSON-RPC error, and while
// `hang` is set it accepts requests and never answers them. `issue` is the
// X-Keenable-Client value it puts on a response to a request that has none.
function fakeRemote({ reject, rpcError, issue } = {}) {
  const seen = [];
  const remote = { hang: false };
  const server = createServer(async (req, res) => {
    if (issue && !req.headers["x-keenable-client"]) res.setHeader("X-Keenable-Client", issue);
    if (req.method !== "POST") return res.writeHead(405).end();
    let body = "";
    for await (const chunk of req) body += chunk;
    const message = JSON.parse(body);
    seen.push({ method: message.method, headers: req.headers });
    if (reject) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "requires_auth", message: reject }));
    }
    if (remote.hang) return;
    if (message.id === undefined) return res.writeHead(202).end();
    if (rpcError) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32000, message: rpcError } }));
    }
    const results = {
      initialize: () => ({
        protocolVersion: message.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "fake", version: "9", title: "Remote Title" },
        instructions: "remote instructions",
      }),
      "tools/list": () => ({ tools: [REMOTE_TOOL] }),
      "tools/call": () => ({ content: [{ type: "text", text: JSON.stringify(message.params.arguments) }] }),
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: results[message.method]() }));
  });
  return Object.assign(remote, {
    seen,
    async listen(port = 0) {
      server.listen(port, "127.0.0.1");
      await once(server, "listening");
      return server.address().port;
    },
    async close() {
      server.closeAllConnections?.();
      server.close();
      await once(server, "close");
    },
  });
}

// Every bridge gets a config dir under here, so no test reads or writes the
// real client-id file.
const CONFIG_ROOT = mkdtempSync(path.join(tmpdir(), "keenable-mcp-test-"));
after(() => rmSync(CONFIG_ROOT, { recursive: true, force: true }));
const configDir = () => mkdtempSync(path.join(CONFIG_ROOT, "config-"));
const clientIdFile = (dir) => path.join(dir, "keenable", "client-id");

// The bridge as a host sees it: `request` sends one JSON-RPC request and
// resolves with its response.
function startBridge(env) {
  const child = spawn(process.execPath, [BRIDGE], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      // A proxy configured for the machine must not swallow the loopback calls.
      NO_PROXY: "127.0.0.1",
      no_proxy: "127.0.0.1",
      KEENABLE_API_KEY: "",
      KEENABLE_NO_CLIENT_ID: "",
      XDG_CONFIG_HOME: configDir(),
      ...env,
    },
  });
  const waiting = new Map();
  let buffer = "";
  let stderr = "";
  let nextId = 1;
  child.stderr.on("data", (chunk) => (stderr += chunk));
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const message = JSON.parse(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      waiting.get(message.id)?.(message);
      waiting.delete(message.id);
    }
  });
  const send = (message) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
  const request = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => reject(new Error(`no response to ${method} within 20s\n${stderr}`)), 20_000);
      waiting.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      send({ id, method, params });
    });
  return {
    request,
    stderr: () => stderr,
    exited: once(child, "exit"),
    async initialize() {
      const response = await request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-host", version: "1.0" },
      });
      send({ method: "notifications/initialized" });
      return response.result;
    },
    stop: () => child.kill(),
  };
}

const call = (bridge, args) => bridge.request("tools/call", { name: "echo", arguments: args });

test("forwards the remote's instructions, metadata, tools and tool results", async () => {
  const remote = fakeRemote();
  const port = await remote.listen();
  const bridge = startBridge({ KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp`, KEENABLE_API_KEY: " key-123\n" });
  try {
    const init = await bridge.initialize();
    assert.equal(init.instructions, "remote instructions");
    assert.equal(init.serverInfo.name, SERVER_NAME);
    assert.equal(init.serverInfo.title, "Remote Title");
    assert.equal(init.serverInfo.description, SERVER_METADATA.description);

    assert.deepEqual((await bridge.request("tools/list")).result.tools, [REMOTE_TOOL]);

    const { result } = await call(bridge, { query: "hello" });
    assert.equal(result.isError, undefined);
    assert.equal(result.content[0].text, '{"query":"hello"}');

    const sent = remote.seen.find((r) => r.method === "tools/call").headers;
    assert.match(sent["user-agent"], /^keenable-mcp\/\S+ \(test-host\/1\.0\)$/);
    assert.equal(sent["x-api-key"], "key-123");
  } finally {
    bridge.stop();
    await remote.close();
  }
});

test("starts without the remote, then works once it is reachable", async () => {
  const remote = fakeRemote();
  const port = await remote.listen();
  await remote.close();
  const bridge = startBridge({ KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  const back = fakeRemote();
  try {
    const init = await bridge.initialize();
    assert.equal(init.serverInfo.title, SERVER_METADATA.title);
    assert.equal(init.instructions, undefined);
    assert.match(bridge.stderr(), /could not connect to http:\/\/127\.0\.0\.1:\d+: fetch failed \(ECONNREFUSED\)/);

    const offline = (await bridge.request("tools/list")).result.tools;
    assert.deepEqual(offline, JSON.parse(JSON.stringify(TOOLS)));

    const failed = (await call(bridge, { query: "hello" })).result;
    assert.equal(failed.isError, true);
    assert.equal(failed.content[0].text, "Keenable request failed: fetch failed (ECONNREFUSED)");

    await back.listen(port);
    assert.equal((await call(bridge, { query: "again" })).result.content[0].text, '{"query":"again"}');
    assert.deepEqual((await bridge.request("tools/list")).result.tools, [REMOTE_TOOL]);
  } finally {
    bridge.stop();
    await back.close().catch(() => {});
  }
});

test("a rejected API key reaches the model as the server's own message", async () => {
  const remote = fakeRemote({ reject: "Malformed API key. Check the API key." });
  const port = await remote.listen();
  const bridge = startBridge({ KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp`, KEENABLE_API_KEY: "bad" });
  try {
    await bridge.initialize();
    const { result } = await call(bridge, { query: "hello" });
    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, "Keenable request failed: Malformed API key. Check the API key.");
  } finally {
    bridge.stop();
    await remote.close();
  }
});

test("a remote that answers the handshake with an error still gets the fallbacks", async () => {
  const remote = fakeRemote({ rpcError: "handshake refused" });
  const port = await remote.listen();
  const bridge = startBridge({ KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    await bridge.initialize();
    assert.deepEqual((await bridge.request("tools/list")).result.tools, JSON.parse(JSON.stringify(TOOLS)));
    const { result } = await call(bridge, { query: "hello" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^Keenable request failed: .*handshake refused/);
  } finally {
    bridge.stop();
    await remote.close();
  }
});

test("a handshake that never answers is given up on, and the next call starts a new one", async () => {
  const remote = fakeRemote();
  remote.hang = true;
  const port = await remote.listen();
  const bridge = startBridge({ KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp` });
  try {
    const init = await bridge.initialize();
    assert.equal(init.instructions, undefined);
    assert.match(bridge.stderr(), /could not connect to .*timed out/i);

    remote.hang = false;
    assert.equal((await call(bridge, { query: "hello" })).result.content[0].text, '{"query":"hello"}');
  } finally {
    bridge.stop();
    await remote.close();
  }
});

test("an invalid KEENABLE_MCP_URL exits with a one-line explanation", async () => {
  const bridge = startBridge({ KEENABLE_MCP_URL: "not a url" });
  const [code] = await bridge.exited;
  assert.equal(code, 1);
  assert.equal(bridge.stderr().trim(), "keenable-mcp: KEENABLE_MCP_URL is not a valid URL: not a url");
});

// What each request the fake remote saw carried as its client ID.
const clientIds = (remote) => remote.seen.map((r) => r.headers["x-keenable-client"]);

test("keyless: an ID the server issues is sent on later requests and saved", async () => {
  const remote = fakeRemote({ issue: "issued-1.A_b" });
  const port = await remote.listen();
  const dir = configDir();
  const bridge = startBridge({ KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp`, XDG_CONFIG_HOME: dir });
  try {
    await bridge.initialize();
    await call(bridge, { query: "hello" });
    const ids = clientIds(remote);
    assert.equal(ids[0], undefined);
    assert.equal(ids.at(-1), "issued-1.A_b");
    assert.equal(remote.seen.at(-1).method, "tools/call");
    assert.equal(readFileSync(clientIdFile(dir), "utf8"), "issued-1.A_b\n");
    if (process.platform !== "win32") {
      assert.equal(statSync(clientIdFile(dir)).mode & 0o777, 0o600);
      assert.equal(statSync(path.dirname(clientIdFile(dir))).mode & 0o777, 0o700);
    }
    assert.deepEqual(readdirSync(path.dirname(clientIdFile(dir))), ["client-id"]);
    assert.equal(bridge.stderr(), "");
  } finally {
    bridge.stop();
    await remote.close();
  }
});

test("keyless: a stored ID is sent from the first request", async () => {
  const remote = fakeRemote();
  const port = await remote.listen();
  const dir = configDir();
  mkdirSync(path.dirname(clientIdFile(dir)), { recursive: true });
  writeFileSync(clientIdFile(dir), "  stored-id\n");
  const bridge = startBridge({ KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp`, XDG_CONFIG_HOME: dir });
  try {
    await bridge.initialize();
    await call(bridge, { query: "hello" });
    assert.ok(remote.seen.length >= 3);
    assert.deepEqual([...new Set(clientIds(remote))], ["stored-id"]);
    assert.equal(readFileSync(clientIdFile(dir), "utf8"), "  stored-id\n");
  } finally {
    bridge.stop();
    await remote.close();
  }
});

test("keyless: an ID that cannot be saved is still used for the session", async () => {
  const remote = fakeRemote({ issue: "memory-only" });
  const port = await remote.listen();
  const dir = configDir();
  // A file where the directory should be: every write under it fails.
  writeFileSync(path.join(dir, "keenable"), "");
  const bridge = startBridge({ KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp`, XDG_CONFIG_HOME: dir });
  try {
    await bridge.initialize();
    assert.equal((await call(bridge, { query: "hello" })).result.content[0].text, '{"query":"hello"}');
    assert.equal(clientIds(remote).at(-1), "memory-only");
    assert.equal(bridge.stderr(), "");
  } finally {
    bridge.stop();
    await remote.close();
  }
});

test("with an API key no client ID is sent, read or stored", async () => {
  const remote = fakeRemote({ issue: "issued-to-keyed" });
  const port = await remote.listen();
  const dir = configDir();
  mkdirSync(path.dirname(clientIdFile(dir)), { recursive: true });
  writeFileSync(clientIdFile(dir), "stored-id\n");
  const bridge = startBridge({
    KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp`,
    KEENABLE_API_KEY: "key-123",
    XDG_CONFIG_HOME: dir,
  });
  try {
    await bridge.initialize();
    await call(bridge, { query: "hello" });
    await call(bridge, { query: "again" });
    assert.deepEqual([...new Set(clientIds(remote))], [undefined]);
    assert.equal(readFileSync(clientIdFile(dir), "utf8"), "stored-id\n");
  } finally {
    bridge.stop();
    await remote.close();
  }
});

test("KEENABLE_NO_CLIENT_ID turns the client ID off", async () => {
  const remote = fakeRemote({ issue: "issued-anyway" });
  const port = await remote.listen();
  const dir = configDir();
  const stored = configDir();
  mkdirSync(path.dirname(clientIdFile(stored)), { recursive: true });
  writeFileSync(clientIdFile(stored), "stored-id\n");
  const url = `http://127.0.0.1:${port}/mcp`;
  const fresh = startBridge({ KEENABLE_MCP_URL: url, KEENABLE_NO_CLIENT_ID: "1", XDG_CONFIG_HOME: dir });
  const existing = startBridge({ KEENABLE_MCP_URL: url, KEENABLE_NO_CLIENT_ID: "1", XDG_CONFIG_HOME: stored });
  try {
    for (const bridge of [fresh, existing]) {
      await bridge.initialize();
      await call(bridge, { query: "hello" });
      await call(bridge, { query: "again" });
    }
    assert.deepEqual([...new Set(clientIds(remote))], [undefined]);
    assert.equal(existsSync(path.join(dir, "keenable")), false);
    assert.equal(readFileSync(clientIdFile(stored), "utf8"), "stored-id\n");
  } finally {
    fresh.stop();
    existing.stop();
    await remote.close();
  }
});

test("keyless: a malformed ID from the server is ignored", async () => {
  for (const issue of ["has space", "semi;colon", "a".repeat(129)]) {
    const remote = fakeRemote({ issue });
    const port = await remote.listen();
    const dir = configDir();
    const bridge = startBridge({ KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp`, XDG_CONFIG_HOME: dir });
    try {
      await bridge.initialize();
      assert.equal((await call(bridge, { query: "hello" })).result.content[0].text, '{"query":"hello"}');
      assert.deepEqual([...new Set(clientIds(remote))], [undefined]);
      assert.equal(existsSync(path.join(dir, "keenable")), false);
    } finally {
      bridge.stop();
      await remote.close();
    }
  }
});
