// Request handlers that forward tools/list and tools/call to the hosted
// server. With `getApiKey` set, the local get_api_key tool is added;
// without it, both handlers forward exactly as before.

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GET_API_KEY_TOOL, GET_API_KEY_TOOL_NAME } from "./get-api-key.js";

export function registerBridgeHandlers(server, client, { getApiKey } = {}) {
  if (!getApiKey) {
    server.setRequestHandler(ListToolsRequestSchema, () => client.listTools());
    server.setRequestHandler(CallToolRequestSchema, (request) =>
      client.callTool(request.params),
    );
    return;
  }
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const remote = await client.listTools();
    const tools = (remote.tools ?? []).filter((t) => t.name !== GET_API_KEY_TOOL_NAME);
    return { ...remote, tools: [...tools, GET_API_KEY_TOOL] };
  });
  server.setRequestHandler(CallToolRequestSchema, (request) =>
    request.params.name === GET_API_KEY_TOOL_NAME
      ? getApiKey.call()
      : client.callTool(request.params),
  );
}
