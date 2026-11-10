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
| `search_web_pages` | Live web search. Args: `query` (required), plus optional `mode` (`pro` or `realtime`; not offered on `/mcp-public`), `site`, `published_after` / `published_before`, `acquired_after` / `acquired_before`, `query_time` (point-in-time upper bound, not a recency filter), `max_results` (1-50), `snippet_max_length` (180-10000), `session_id`, `output_format`, `disable_cards` (plain web pages instead of Keenable-written cards). |
| `fetch_page_content` | Fetch a URL and return clean markdown. Args: `url` (required), optional `max_chars` (default 50000), `live`, `prompt` (extract only what you ask for), `session_id`, `output_format`. |

## Use it

### Remote (recommended)

Clients with remote MCP support connect to the URL directly. In Claude
Desktop's Custom Connectors UI, paste the URL. Cursor takes this entry:

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

Other clients spell it differently:

- **Claude Code**: run
  `claude mcp add keenable --transport http https://api.keenable.ai/mcp`, or set
  `"type": "http"` in `.mcp.json`.
- **Cline** (`cline_mcp_settings.json`): set `"type": "streamableHttp"`. Without
  a type Cline falls back to the legacy SSE transport.
- **VS Code** (`.vscode/mcp.json`): the top-level key is `servers`, not
  `mcpServers`, and the type is `"http"`.

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

## Agent stores

Each store has its own listing, and each one tags its traffic with its own
`keenable_title` so calls can be counted per store:

| Store | Listing source | Install |
|---|---|---|
| Claude Code plugins | [`listings/claude-code`](listings/claude-code) via [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) | `/plugin marketplace add keenableai/keenable-mcp`, then `/plugin install keenable@keenable` |
| Cursor | [`listings/cursor`](listings/cursor) via [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json) | From the Cursor marketplace or cursor.directory once listed |
| Cline MCP Marketplace | [`llms-install.md`](llms-install.md) | From Cline's MCP Marketplace once listed |
| skills.sh | [`skills/keenable-web-search`](skills/keenable-web-search) | `npx skills add keenableai/keenable-mcp --skill keenable-web-search` |
| Official MCP Registry | [`server.json`](server.json) | [`ai.keenable/web-search`](https://registry.modelcontextprotocol.io/v0/servers?search=ai.keenable) |

[`listings/SUBMISSION.md`](listings/SUBMISSION.md) tracks where each listing is
submitted and its status.

## How the wrapper works

`@keenable/mcp` is a small stdio bridge: it connects to the hosted server over
Streamable HTTP and forwards every tool the server exposes. There is no
search logic in this package; the index and tools live behind
`https://api.keenable.ai/mcp`. Environment variables:

- `KEENABLE_API_KEY` — optional API key, sent as `X-API-Key`.
- `KEENABLE_MCP_URL` — override the endpoint (defaults to `https://api.keenable.ai/mcp?keenable_title=npm`).

If the hosted server can't be reached when the wrapper starts (no network, a
rejected API key), it still starts: it lists its built-in copy of the tools,
and a tool call returns the reason as a tool error, so the model can report
it. Every call tries the connection again, so nothing needs restarting once
the problem is fixed. The reason is also written to stderr, which most clients
keep in their MCP server log.

The wrapper waits up to 10 seconds for the hosted server before starting
without it. A session started that way does not get the hosted server's usage
instructions; they are back the next time the client launches the wrapper. An
invalid `KEENABLE_MCP_URL` is the one thing that stops it: it prints one line
naming the value and exits.

Behind an HTTP proxy, Node does not read `HTTPS_PROXY` by default. On Node
22.21 or newer, add `"NODE_USE_ENV_PROXY": "1"` to the `env` block next to your
proxy variables.

## Development

```sh
npm install
npm test
```

`npm test` runs the unit tests and a stdio smoke test of the discovery build
(`src/discovery.js`): `initialize` must advertise the server metadata and
`tools/list` must return both tools. It also runs the bridge (`src/index.js`)
against a local stand-in for the hosted server, so no test needs the network. CI runs it on Node 18, 20 and 22 and on
the oldest MCP SDK the package accepts.

## Releasing

The npm version lives only in `package.json`; the bridge reads it at runtime.
`server.json` (the MCP Registry manifest) must repeat it as a literal in
`packages[].version`, so bump both. `npm run check:version` compares them and
runs automatically before `npm publish`. The top-level `server.json` `version`
is the registry entry's own version and is bumped whenever `server.json`
changes. `server.json` mirrors the live registry entry (0.2.1): publish again
only when its content changes.

## Links

- Docs: https://docs.keenable.ai/mcp-server
- Site: https://keenable.ai
- Registry: [`ai.keenable/web-search`](https://registry.modelcontextprotocol.io/v0/servers?search=ai.keenable) (Official MCP Registry)

## License

MIT
