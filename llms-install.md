# Installation guide for Cline

This server is keyless by default. No signup, account, or API key is required to
install or use it.

## Install

The server is hosted, so Cline connects to its URL directly. Add this to
`cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "keenable": {
      "type": "streamableHttp",
      "url": "https://api.keenable.ai/mcp-public?keenable_title=cline"
    }
  }
}
```

That is the complete setup: nothing to install and no Node.js needed. Keep
`"type": "streamableHttp"`; without it Cline falls back to the legacy SSE
transport and cannot connect. `keenable_title=cline` only tags the install as
coming from Cline; if you are installing for any client other than Cline, drop
it so the install is not counted as Cline.

The server exposes two tools:

- `search_web_pages` — live web search. Required arg `query`; optional `site`, `exclude_domains` (array of hosts, each covering its subdomains; up to 1,000 distinct hosts; the API rejects anything else with `invalid_filter`; full rules in the README's `exclude_domains` section), `published_after`/`published_before`, `acquired_after`/`acquired_before`, `query_time` (point-in-time upper bound, not a recency filter), `max_results` (1-50), `snippet_max_length` (180-10000), `session_id`, `output_format`, `disable_cards` (plain web pages instead of Keenable-written cards). With an API key (below), it also takes `mode` (`pro` or `realtime`).
- `fetch_page_content` — fetch a URL and return clean markdown. Required arg `url`; optional `max_chars` (default 50000), `live`, `prompt` (extract only what you ask for), `session_id`, `output_format`.

## Optional: API key

Keenable is keyless (1,000 requests/hour). To lift the cap, send an API key in
the `X-API-Key` header and use the `/mcp` URL:

```json
{
  "mcpServers": {
    "keenable": {
      "type": "streamableHttp",
      "url": "https://api.keenable.ai/mcp?keenable_title=cline",
      "headers": { "X-API-Key": "YOUR_KEY" }
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

- A Cline version with Streamable HTTP support (`"type": "streamableHttp"`).
- Outbound HTTPS access to `https://api.keenable.ai`.
