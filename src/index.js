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
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import { serverInfo } from "./metadata.js";
import { bridgeUserAgent } from "./client-agent.js";
import { describeError } from "./errors.js";
import { TOOLS } from "./tools.js";

// package.json is the single source of the version; a release bumps it there.
const { version: VERSION } = createRequire(import.meta.url)("../package.json");

const REMOTE_URL =
  process.env.KEENABLE_MCP_URL || "https://api.keenable.ai/mcp?keenable_title=npm";
// Trimmed: a key pasted with a trailing newline is not a valid header value.
const API_KEY = process.env.KEENABLE_API_KEY?.trim();

// How long the host's `initialize` waits for the remote handshake before the
// bridge answers with its built-in metadata instead.
const STARTUP_TIMEOUT_MS = 10_000;

let remoteUrl;
try {
  remoteUrl = new URL(REMOTE_URL);
} catch {
  console.error(`keenable-mcp: KEENABLE_MCP_URL is not a valid URL: ${REMOTE_URL}`);
  process.exit(1);
}

const requestInit = { headers: { "User-Agent": bridgeUserAgent(VERSION) } };
if (API_KEY) requestInit.headers["X-API-Key"] = API_KEY;

// One shared connection to the hosted server. A failed attempt is forgotten,
// so the next request tries again: a laptop that was offline when the host
// launched the bridge works as soon as the network is back.
let remote;
function connectRemote() {
  remote ??= (async () => {
    const client = new Client({ name: "keenable-mcp", version: VERSION }, { capabilities: {} });
    await client.connect(new StreamableHTTPClientTransport(remoteUrl, { requestInit }));
    return client;
  })().catch((err) => {
    remote = undefined;
    throw err;
  });
  return remote;
}

// An error the hosted server returned for this request is passed through. A
// request that never got an answer (no network, a rejected key, a timeout) is
// not: see the handlers below.
function isRemoteAnswer(err) {
  return (
    err instanceof McpError &&
    err.code !== ErrorCode.RequestTimeout &&
    err.code !== ErrorCode.ConnectionClosed
  );
}

// The stdio server is built after the remote handshake so it can pass the
// hosted server's `instructions` (how to search well, what query_time means)
// and its title, description, website and icon through to the client.
// Without them, npx users never see that guidance or branding.
function bridgeServer(instructions, remoteInfo) {
  const server = new Server(
    serverInfo(VERSION, remoteInfo),
    { capabilities: { tools: {} }, ...(instructions ? { instructions } : {}) },
  );
  // The transport reads these headers on every request, so tool calls made
  // after the host's handshake carry its name.
  server.oninitialized = () => {
    requestInit.headers["User-Agent"] = bridgeUserAgent(VERSION, server.getClientVersion());
  };
  // When the hosted server can't be reached, list the built-in copy of its
  // tools so the host still shows them; calling one then explains what failed.
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    try {
      return await (await connectRemote()).listTools(request.params);
    } catch (err) {
      if (isRemoteAnswer(err)) throw err;
      return { tools: TOOLS };
    }
  });
  // A failed call comes back as a tool error, which the model reads and can
  // tell the user about; a protocol error is hidden by most hosts.
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
      const client = await connectRemote();
      // The signal cancels the remote call when the host cancels its request.
      return await client.callTool(request.params, undefined, { signal: extra?.signal });
    } catch (err) {
      if (isRemoteAnswer(err)) throw err;
      return {
        content: [{ type: "text", text: `Keenable request failed: ${describeError(err)}` }],
        isError: true,
      };
    }
  });
  return server;
}

async function main() {
  let client;
  let timer;
  try {
    client = await Promise.race([
      connectRemote(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`no answer within ${STARTUP_TIMEOUT_MS / 1000}s`)),
          STARTUP_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (err) {
    console.error(
      `keenable-mcp: could not connect to ${remoteUrl.origin}: ${describeError(err)}. ` +
        "Starting anyway; each tool call will try again.",
    );
  } finally {
    clearTimeout(timer);
  }
  // getInstructions() exists in every MCP SDK release this package accepts
  // (^1.12.0); the optional call just keeps a broken install from crashing.
  const server = bridgeServer(client?.getInstructions?.(), client?.getServerVersion?.());
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("keenable-mcp: failed to start:", describeError(err));
  process.exit(1);
});
