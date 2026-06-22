# Installation guide for AI agents (Cline, etc.)

This server is keyless by default. No signup, account, or API key is required to
install or use it.

## Install

Add this to the MCP settings (`cline_mcp_settings.json` or the client's
`mcpServers` config):

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

That is the complete setup. On first run `npx` downloads `@keenable/mcp`, which
connects to the hosted server at `https://api.keenable.ai/mcp` and exposes two
tools:

- `search_web_pages` — live web search. Required arg `query`; optional `mode`, `site`, `published_after`/`published_before`, `acquired_after`/`acquired_before`.
- `fetch_page_content` — fetch a URL and return clean markdown. Required arg `url`; optional `max_chars` (default 50000).

## Optional: API key

Keenable is keyless (1,000 requests/hour). To lift the cap, add an API key as an
environment variable:

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

## Verify

After install, ask the agent to list tools for the `keenable` server; it should
return `search_web_pages` and `fetch_page_content`. A simple check is to run a
`search_web_pages` call with `query: "model context protocol"`.

## Requirements

- Node.js >= 18 (for `npx`).
- Outbound HTTPS access to `https://api.keenable.ai`.
