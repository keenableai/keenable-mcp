# Keenable MCP

MCP server for live web search and clean-markdown page fetch over the
[Keenable](https://keenable.ai) web index.

- **Hosted endpoint:** `https://api.keenable.ai/mcp` (Streamable HTTP)
- **Tools:** `search_web_pages`, `fetch_page_content`
- **Keyless by default** (1,000 requests/hour). An optional API key lifts the cap.

The server is hosted, so most clients just point at the URL. For clients (or
config paths) that only accept a stdio `command` there is a thin npm wrapper
(`@keenable/mcp`) that bridges to the same endpoint.

## Tools

| Tool | Description |
|---|---|
| `search_web_pages` | Live web search. Args: `query` (required), plus optional `mode` (`pro` or `realtime`), `site`, `published_after` / `published_before`, `acquired_after` / `acquired_before`, `query_time` (point-in-time upper bound, not a recency filter), `max_results` (1-50), `snippet_max_length` (180-10000), `session_id`, `output_format`, `disable_cards` (plain web pages instead of Keenable-written cards). |
| `fetch_page_content` | Fetch a URL and return clean markdown. Args: `url` (required), optional `max_chars` (default 50000), `live`, `prompt` (extract only what you ask for), `session_id`, `output_format`. |

## Use it

### Remote (recommended)

Clients with remote MCP support — Cursor, Cline, VS Code, and Claude Desktop's
Custom Connectors UI — connect to the URL directly:

```json
{
  "mcpServers": {
    "keenable": {
      "type": "streamable-http",
      "url": "https://api.keenable.ai/mcp"
    }
  }
}
```

### Stdio (e.g. Claude Desktop's `claude_desktop_config.json`)

For clients or config paths that only accept a stdio `command`, run the wrapper
with `npx`:

```json
{
  "mcpServers": {
    "keenable": {
      "command": "npx",
      "args": ["-y", "@keenable/mcp"]
    }
  }
}
```

That is all you need for keyless use.

## API key (optional)

Keenable is keyless by default. To lift the hourly rate limit, pass a key.

Remote:

```json
{
  "mcpServers": {
    "keenable": {
      "type": "streamable-http",
      "url": "https://api.keenable.ai/mcp",
      "headers": { "X-API-Key": "YOUR_KEY" }
    }
  }
}
```

Stdio:

```json
{
  "mcpServers": {
    "keenable": {
      "command": "npx",
      "args": ["-y", "@keenable/mcp"],
      "env": { "KEENABLE_API_KEY": "YOUR_KEY" }
    }
  }
}
```

## How the wrapper works

`@keenable/mcp` is a small stdio bridge: it connects to the hosted server over
Streamable HTTP and forwards every tool the server exposes. There is no
search logic in this package; the index and tools live behind
`https://api.keenable.ai/mcp`. Environment variables:

- `KEENABLE_API_KEY` — optional API key, sent as `X-API-Key`.
- `KEENABLE_MCP_URL` — override the endpoint (defaults to `https://api.keenable.ai/mcp?keenable_title=npm`).
- `KEENABLE_GET_API_KEY` — set to `1` to add a local `get_api_key` tool (off by
  default; ignored when `KEENABLE_API_KEY` is set). It runs the agent device
  flow: it returns a link and code for the agent to show its user, and once
  the user approves, the rest of the session sends the new key. The key is never
  shown in tool output. See
  [Get a key](https://docs.keenable.ai/authentication#device-flow).

## Development

```sh
npm install
npm test
```

`npm test` runs the unit tests and a stdio smoke test of the discovery build
(`src/discovery.js`): `initialize` must advertise the server metadata and
`tools/list` must return both tools. CI runs it on Node 18, 20 and 22 and on
the oldest MCP SDK the package accepts.

## Releasing

The npm version lives only in `package.json`; the bridge reads it at runtime.
`server.json` (the MCP Registry manifest) must repeat it as a literal in
`packages[].version`, so bump both. `npm run check:version` compares them and
runs automatically before `npm publish`. The top-level `server.json` `version`
is the registry entry's own version and is bumped whenever `server.json`
changes.

## Links

- Docs: https://docs.keenable.ai/mcp-server
- Site: https://keenable.ai
- Registry: [`ai.keenable/web-search`](https://registry.modelcontextprotocol.io/v0/servers?search=ai.keenable) (Official MCP Registry)

## License

MIT
