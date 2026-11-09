# Installation guide for Cline

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
      "args": ["-y", "@keenable/mcp"],
      "env": { "KEENABLE_MCP_URL": "https://api.keenable.ai/mcp?keenable_title=cline" }
    }
  }
}
```

That is the complete setup. `KEENABLE_MCP_URL` only tags the install as coming
from Cline; leave it out and the server works the same. If you are installing
for any client other than Cline, leave the `env` line out so the install is not
counted as Cline. On first run `npx`
downloads `@keenable/mcp`, which connects to the hosted server at `https://api.keenable.ai/mcp` and exposes two
tools:

- `search_web_pages` — live web search. Required arg `query`; optional `mode` (`pro` or `realtime`), `site`, `exclude_domains` (array of hosts such as `example.com`, each covering its subdomains; no paths, suffixes or wildcards; up to 1,000 hosts), `published_after`/`published_before`, `acquired_after`/`acquired_before`, `query_time` (point-in-time upper bound, not a recency filter), `max_results` (1-50), `snippet_max_length` (180-10000), `session_id`, `output_format`, `disable_cards` (plain web pages instead of Keenable-written cards).
- `fetch_page_content` — fetch a URL and return clean markdown. Required arg `url`; optional `max_chars` (default 50000), `live`, `prompt` (extract only what you ask for), `session_id`, `output_format`.

## Optional: API key

Keenable is keyless (1,000 requests/hour). To lift the cap, add an API key as an
environment variable:

```json
{
  "mcpServers": {
    "keenable": {
      "command": "npx",
      "args": ["-y", "@keenable/mcp"],
      "env": {
        "KEENABLE_MCP_URL": "https://api.keenable.ai/mcp?keenable_title=cline",
        "KEENABLE_API_KEY": "YOUR_KEY"
      }
    }
  }
}
```

## Verify

After install, ask the agent to list tools for the `keenable` server; it should
return `search_web_pages` and `fetch_page_content`. A simple check is to run a
`search_web_pages` call with `query: "model context protocol"`.

## Get a key

To lift the keyless cap, [sign up](https://app.keenable.ai/signup?utm_source=cline&utm_medium=registry) and create a key in the console.

## Requirements

- Node.js >= 18 (for `npx`).
- Outbound HTTPS access to `https://api.keenable.ai`.
