#!/usr/bin/env node
// Keenable MCP — thin stdio bridge to the hosted Keenable MCP server.
//
// The real server runs remotely at https://api.keenable.ai/mcp (Streamable
// HTTP). This wrapper exists so stdio-only clients (Claude Desktop, Cursor,
// Cline, ...) can use it with a plain `npx` command. It forwards every tool
// the remote exposes, so it stays correct as the server adds tools.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import { serverInfo } from "./metadata.js";
import { describeError, isRetryable } from "./errors.js";
import { TOOLS } from "./tools.js";

// package.json is the single source of the version; a release bumps it there.
const { version: VERSION } = createRequire(import.meta.url)("../package.json");

const REMOTE_URL =
  process.env.KEENABLE_MCP_URL || "https://api.keenable.ai/mcp?keenable_title=npm";
const API_KEY = process.env.KEENABLE_API_KEY;

const requestInit = {};
if (API_KEY) requestInit.headers = { "X-API-Key": API_KEY };

const STARTUP_ATTEMPTS = 3;

// One connection to the hosted server, made on demand. A failed attempt is
// forgotten so the next request tries again: a laptop that starts the client
// offline, or a blip in the network, must not leave the bridge dead until the
// user restarts their MCP client.
let connection = null;

function connect() {
  connection ??= (async () => {
    const client = new Client({ name: "keenable-mcp", version: VERSION }, { capabilities: {} });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(REMOTE_URL), { requestInit }),
    );
    return client;
  })().catch((err) => {
    connection = null;
    throw err;
  });
  return connection;
}

function dropConnection(client) {
  connection = null;
  client?.close().catch(() => {});
}

// Run `fn` against the remote; on a transient failure (network, 5xx) reconnect
// and try once more. Both tools are read-only and idempotent, so a retry is safe.
async function withRemote(fn) {
  for (let attempt = 1; ; attempt++) {
    let client;
    try {
      client = await connect();
      return await fn(client);
    } catch (err) {
      if (err instanceof McpError || !isRetryable(err) || attempt >= 2) throw err;
      dropConnection(client);
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The stdio server passes the hosted server's `instructions` (how to search
// well, what query_time means) and its title, description, website and icon
// through to the client. Without them, npx users never see that guidance or
// branding. If the remote is unreachable at startup, the bridge still starts:
// it lists the bundled tool schemas and connects on the first call.
function bridgeServer(instructions, remoteInfo) {
  const server = new Server(
    serverInfo(VERSION, remoteInfo),
    { capabilities: { tools: {} }, ...(instructions ? { instructions } : {}) },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      return await withRemote((client) => client.listTools());
    } catch (err) {
      if (err instanceof McpError) throw err;
      return { tools: TOOLS };
    }
  });
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await withRemote((client) => client.callTool(request.params));
    } catch (err) {
      // Protocol errors keep their JSON-RPC shape. Transport failures become a
      // tool error the agent can read, instead of a bare "fetch failed".
      if (err instanceof McpError) throw err;
      return {
        content: [{ type: "text", text: `Error: ${describeError(err, REMOTE_URL)}` }],
        isError: true,
      };
    }
  });
  return server;
}

async function main() {
  let client;
  for (let attempt = 1; ; attempt++) {
    try {
      client = await connect();
      break;
    } catch (err) {
      // A bad API key or a wrong URL will not fix itself: fail now, loudly.
      if (!isRetryable(err)) throw new Error(describeError(err, REMOTE_URL));
      if (attempt >= STARTUP_ATTEMPTS) {
        console.error(
          `keenable-mcp: ${describeError(err, REMOTE_URL)} Starting anyway; will connect on the first request.`,
        );
        break;
      }
      await sleep(500 * attempt);
    }
  }
  // getInstructions() exists in every MCP SDK release this package accepts
  // (^1.12.0); the optional call just keeps a broken install from crashing.
  const server = bridgeServer(client?.getInstructions?.(), client?.getServerVersion?.());
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("keenable-mcp: failed to start:", err?.message || err);
  process.exit(1);
});
