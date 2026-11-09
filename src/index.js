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
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import { serverInfo } from "./metadata.js";
import { bridgeUserAgent } from "./client-agent.js";

// package.json is the single source of the version; a release bumps it there.
const { version: VERSION } = createRequire(import.meta.url)("../package.json");

const REMOTE_URL =
  process.env.KEENABLE_MCP_URL || "https://api.keenable.ai/mcp?keenable_title=npm";
const API_KEY = process.env.KEENABLE_API_KEY;

const requestInit = { headers: { "User-Agent": bridgeUserAgent(VERSION) } };
if (API_KEY) requestInit.headers["X-API-Key"] = API_KEY;

const client = new Client(
  { name: "keenable-mcp", version: VERSION },
  { capabilities: {} },
);

const transport = new StreamableHTTPClientTransport(new URL(REMOTE_URL), {
  requestInit,
});

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
  server.setRequestHandler(ListToolsRequestSchema, () => client.listTools());
  server.setRequestHandler(CallToolRequestSchema, (request) =>
    client.callTool(request.params),
  );
  return server;
}

async function main() {
  await client.connect(transport);
  // getInstructions() exists in every MCP SDK release this package accepts
  // (^1.12.0); the optional call just keeps a broken install from crashing.
  const server = bridgeServer(client.getInstructions?.(), client.getServerVersion?.());
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("keenable-mcp: failed to start:", err?.message || err);
  process.exit(1);
});
