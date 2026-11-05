#!/usr/bin/env node
// Discovery-only stdio entrypoint for MCP catalogs (Glama, etc.).
//
// Catalog scanners run the server in a sandbox without outbound network and
// call `tools/list` to score the server. The real bridge (src/index.js)
// connects to the hosted endpoint, which those sandboxes cannot reach, so this
// file instead serves the same tool schemas statically (src/tools.js) and does
// not touch the network. Real `tools/call` requests are served by the hosted
// server at https://api.keenable.ai/mcp via src/index.js (or the remote URL
// directly); here they return a pointer to that endpoint.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { serverInfo } from "./metadata.js";
import { instrumentServer } from "./posthog.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS } from "./tools.js";

const server = new Server(
  // package.json is the single source of the version, as in src/index.js.
  serverInfo(createRequire(import.meta.url)("../package.json").version),
  { capabilities: { tools: {} } },
);
instrumentServer(server);

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, (request) => ({
  content: [
    {
      type: "text",
      text:
        `This is the discovery build of "${request.params.name}". Tool execution is served ` +
        `by the hosted Keenable MCP server at https://api.keenable.ai/mcp. Install the real ` +
        `server with: npx -y @keenable/mcp`,
    },
  ],
  isError: true,
}));

await server.connect(new StdioServerTransport());
