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

const REMOTE_URL = process.env.KEENABLE_MCP_URL || "https://api.keenable.ai/mcp";
const API_KEY = process.env.KEENABLE_API_KEY;

const requestInit = {};
if (API_KEY) requestInit.headers = { "X-API-Key": API_KEY };

const client = new Client(
  { name: "keenable-mcp", version: "0.1.0" },
  { capabilities: {} },
);

const transport = new StreamableHTTPClientTransport(new URL(REMOTE_URL), {
  requestInit,
});

const server = new Server(
  { name: "keenable-web-search", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => client.listTools());
server.setRequestHandler(CallToolRequestSchema, (request) =>
  client.callTool(request.params),
);

async function main() {
  await client.connect(transport);
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("keenable-mcp: failed to start:", err?.message || err);
  process.exit(1);
});
