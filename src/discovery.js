#!/usr/bin/env node
// Discovery-only stdio entrypoint for MCP catalogs (Glama, etc.).
//
// Catalog scanners run the server in a sandbox without outbound network and
// call `tools/list` to score the server. The real bridge (src/index.js)
// connects to the hosted endpoint, which those sandboxes cannot reach, so this
// file instead declares the same tool schemas statically and does not touch the
// network. Real `tools/call` requests are served by the hosted server at
// https://api.keenable.ai/mcp via src/index.js (or the remote URL directly);
// here they return a pointer to that endpoint.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const TOOLS = [
  {
    name: "search_web_pages",
    description:
      "Live web search over the Keenable web index. Describe the ideal page, not keywords. Use date/site filters to narrow results.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Natural language search query. A semantically rich description of the ideal page, not just keywords.",
        },
        mode: {
          type: "string",
          enum: ["pro"],
          description: "Search mode: 'pro' (default) for enhanced results.",
        },
        site: {
          type: "string",
          description: 'Restrict results to a specific site (e.g. "techcrunch.com").',
        },
        published_after: {
          type: "string",
          description: "Filter to pages published after this date (YYYY-MM-DD).",
        },
        published_before: {
          type: "string",
          description: "Filter to pages published before this date (YYYY-MM-DD).",
        },
        acquired_after: {
          type: "string",
          description: "Filter to pages acquired/indexed after this date (YYYY-MM-DD).",
        },
        acquired_before: {
          type: "string",
          description: "Filter to pages acquired/indexed before this date (YYYY-MM-DD).",
        },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
  },
  {
    name: "fetch_page_content",
    description:
      "Fetch and extract content from a web page. Returns the page content in markdown format.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: 'The URL to fetch. Example: "https://example.com".',
        },
        live: {
          type: "boolean",
          default: false,
          description: "Fetch live content. Defaults to false.",
        },
        max_chars: {
          type: "integer",
          minimum: 1,
          description:
            "Maximum number of characters of content to return. Longer content is truncated. Defaults to 50000 when omitted.",
        },
      },
      required: ["url"],
    },
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
  },
];

const server = new Server(
  { name: "keenable-web-search", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

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
