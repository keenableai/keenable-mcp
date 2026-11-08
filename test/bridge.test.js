import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { describeError, isRetryable, displayUrl } from "../src/errors.js";
import { TOOLS } from "../src/tools.js";

const URL_ = "https://api.keenable.ai/mcp?keenable_title=npm";

function httpError(status, message) {
  return Object.assign(new Error(`Streamable HTTP error: ${message}`), { code: status });
}

function fetchFailed(code) {
  return Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code), { code }) });
}

test("network failures and 5xx are retryable; 4xx and JSON-RPC errors are not", () => {
  assert.equal(isRetryable(fetchFailed("ECONNRESET")), true);
  assert.equal(isRetryable(httpError(503, "Error POSTing to endpoint: busy")), true);
  assert.equal(isRetryable(httpError(401, "Error POSTing to endpoint: {}")), false);
  // MCP SDK 1.12 reports the status only in the message.
  assert.equal(isRetryable(new Error("Error POSTing to endpoint (HTTP 502): bad gateway")), true);
  assert.equal(isRetryable(new Error("Error POSTing to endpoint (HTTP 401): {}")), false);
  assert.equal(isRetryable(Object.assign(new Error("Invalid params"), { code: -32602 })), false);
});

test("describeError passes through the hosted server's own message", () => {
  const err = httpError(
    401,
    'Error POSTing to endpoint: {"error":"requires_auth","message":"Malformed API key."}',
  );
  assert.equal(describeError(err, URL_), "Malformed API key.");
});

test("describeError names the endpoint, without its query, on network failures", () => {
  const text = describeError(fetchFailed("ENOTFOUND"), URL_);
  assert.match(text, /Could not reach the Keenable server at https:\/\/api\.keenable\.ai\/mcp \(ENOTFOUND\)/);
  assert.equal(displayUrl(URL_), "https://api.keenable.ai/mcp");
});

// Drive src/index.js over stdio. Resolves with the responses by id once all arrive.
function bridge(env, requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("../src/index.js", import.meta.url))], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const responses = {};
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`no response within 15s; stderr: ${stderr}`));
    }, 15_000);
    child.stderr.on("data", (d) => (stderr += d));
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      let i;
      while ((i = stdout.indexOf("\n")) >= 0) {
        const message = JSON.parse(stdout.slice(0, i));
        stdout = stdout.slice(i + 1);
        responses[message.id] = message;
      }
      if (requests.every((r) => r.id === undefined || responses[r.id])) {
        clearTimeout(timer);
        child.kill();
        resolve({ responses, stderr });
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ responses, stderr, code });
    });
    for (const r of requests) child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...r }) + "\n");
  });
}

const INIT = {
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
};

function listen(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler).listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("bridge starts with the bundled tools when the remote is unreachable", async () => {
  // Grab a free port, then close it so nothing listens there.
  const closed = await listen(() => {});
  const { port } = closed.address();
  await new Promise((r) => closed.close(r));

  const { responses, stderr } = await bridge({ KEENABLE_MCP_URL: `http://127.0.0.1:${port}/mcp` }, [
    INIT,
    { method: "notifications/initialized" },
    { id: 2, method: "tools/list", params: {} },
    { id: 3, method: "tools/call", params: { name: "search_web_pages", arguments: { query: "x" } } },
  ]);
  assert.match(stderr, /Could not reach the Keenable server/);
  assert.deepEqual(responses[2].result.tools, TOOLS);
  assert.equal(responses[3].result.isError, true);
  assert.match(responses[3].result.content[0].text, /^Error: Could not reach the Keenable server at http:\/\/127\.0\.0\.1:\d+\/mcp/);
});

test("bridge fails fast with the server's message on a rejected API key", async () => {
  const server = await listen((req, res) => {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "requires_auth", message: "Malformed API key." }));
  });
  try {
    const { code, stderr } = await bridge(
      { KEENABLE_MCP_URL: `http://127.0.0.1:${server.address().port}/mcp`, KEENABLE_API_KEY: "bogus" },
      [INIT],
    );
    assert.equal(code, 1);
    assert.match(stderr, /failed to start: Malformed API key\./);
  } finally {
    server.close();
  }
});
