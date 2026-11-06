import { test } from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { PostHog } from "posthog-node";
import { instrumentServer, dropContent } from "../src/posthog.js";

const QUERY = "sentinel-query-7f3a: acme corp layoffs internal memo";
const URL_ARG = "https://sentinel-url-7f3a.example/private";
const PROMPT = "sentinel-prompt-7f3a: list the salaries";
const RESULT = "sentinel-result-7f3a: confidential page text";
const SENTINEL = "7f3a";

const TOOLS = [
  {
    name: "search_web_pages",
    description: "Search.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "fetch_page_content",
    description: "Fetch.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" }, prompt: { type: "string" } },
      required: ["url"],
    },
  },
];

async function runBridge() {
  const sent = [];
  const posthog = new PostHog("phc_test", {
    host: "http://posthog.test",
    flushAt: 1,
    flushInterval: 0,
    fetch: async (url, options) => {
      const headers = options?.headers ?? {};
      const gzipped = (headers["Content-Encoding"] ?? headers["content-encoding"]) === "gzip";
      const body = options?.body ?? "";
      sent.push(`${url} ${gzipped ? gunzipSync(body).toString("utf8") : String(body)}`);
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const server = new Server({ name: "keenable-web-search", version: "0.0.0" }, { capabilities: { tools: {} } });
  instrumentServer(server, posthog);
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, (request) => {
    if (request.params.name === "fetch_page_content") {
      return { content: [{ type: "text", text: `Error fetching ${request.params.arguments.url}` }], isError: true };
    }
    return { content: [{ type: "text", text: `${RESULT} for ${request.params.arguments.query}` }] };
  });

  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const listed = await client.listTools();
  const search = await client.callTool({ name: "search_web_pages", arguments: { query: QUERY } });
  const fetchResult = await client.callTool({ name: "fetch_page_content", arguments: { url: URL_ARG, prompt: PROMPT } });

  await new Promise((r) => setTimeout(r, 200));
  await posthog.shutdown();
  await client.close();
  return { sent, listed, search, fetchResult };
}

test("tool calls reach PostHog without their arguments, results or error text", async () => {
  const { sent, search, fetchResult } = await runBridge();

  assert.ok(sent.length > 0, "expected PostHog to receive events");
  const payload = sent.join("\n");
  assert.match(payload, /\$mcp_tool_call/);
  assert.match(payload, /search_web_pages/);
  assert.ok(!payload.includes(SENTINEL), `customer content reached PostHog:\n${payload.slice(0, 2000)}`);
  assert.doesNotMatch(payload, /\$mcp_parameters|\$mcp_response|\$mcp_intent|\$mcp_error_message|\$exception/);
  assert.match(payload, /"\$mcp_is_error":true/, "a failed call is still counted as an error");

  assert.ok(search.content[0].text.includes(QUERY), "the tool still receives and returns the query");
  assert.equal(fetchResult.isError, true);
});

test("instrumentation leaves the advertised tool schemas unchanged", async () => {
  const { listed } = await runBridge();
  assert.deepEqual(listed.tools.map((t) => t.name), TOOLS.map((t) => t.name));
  for (const [i, tool] of listed.tools.entries()) {
    assert.deepEqual(tool.inputSchema, TOOLS[i].inputSchema, `${tool.name} schema was changed`);
  }
});

test("dropContent keeps only allowlisted events and properties", () => {
  const event = {
    event: "$mcp_tool_call",
    properties: {
      $mcp_tool_name: "search_web_pages",
      $mcp_is_error: true,
      $mcp_parameters: { query: QUERY },
      $mcp_response: RESULT,
      $mcp_intent: "why",
      $mcp_error_message: `Error fetching ${URL_ARG}`,
      $mcp_some_future_field: PROMPT,
    },
  };
  assert.deepEqual(dropContent(event).properties, { $mcp_tool_name: "search_web_pages", $mcp_is_error: true });
  assert.equal(dropContent({ event: "$exception", properties: { $exception_message: QUERY } }), null);
  assert.equal(dropContent({ event: "$mcp_feedback", properties: { $mcp_feedback_summary: QUERY } }), null);
});
