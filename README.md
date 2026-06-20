# Keenable MCP

MCP server for live web search and clean-markdown page fetch over the
[Keenable](https://keenable.ai) web index.

- **Hosted endpoint:** `https://api.keenable.ai/mcp` (Streamable HTTP)
- **Tools:** `search_web_pages`, `fetch_page_content`
- **Keyless by default** (1,000 requests/hour). An optional API key lifts the cap.

The server is hosted, so most clients just point at the URL. For stdio-only
clients there is a thin npm wrapper (`@keenable/mcp`) that bridges to the same
endpoint.

## Tools

| Tool | Description |
|---|---|
| `search_web_pages` | Live web search. Args: `query` (required), plus optional `mode`, `site`, `published_after` / `published_before`, `acquired_after` / `acquired_before`. |
| `fetch_page_content` | Fetch a URL and return clean markdown. Args: `url` (required), optional `max_chars` (default 50000). |

## Use it

### Remote (recommended)

Any client that supports remote Streamable HTTP servers can connect directly:

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

### Stdio (Claude Desktop, Cursor, Cline, …)

For clients that only speak stdio, run the wrapper with `npx`:

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
- `KEENABLE_MCP_URL` — override the endpoint (defaults to `https://api.keenable.ai/mcp`).

## Links

- Docs: https://docs.keenable.ai/mcp-server
- Site: https://keenable.ai
- Registry: [`ai.keenable/web-search`](https://registry.modelcontextprotocol.io/v0/servers?search=ai.keenable) (Official MCP Registry)

## License

MIT
