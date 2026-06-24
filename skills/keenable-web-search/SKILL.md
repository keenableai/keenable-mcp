---
name: keenable-web-search
description: "Live web search and clean page extraction via the Keenable MCP server. Use when you need to: (1) search the web for current, citable information beyond the model's training data, (2) find news, research, docs, or specific pages by describing them in natural language, (3) restrict results to a site or a date range, (4) fetch a known URL as clean markdown. Works with no API key. NOT for: local file operations or anything that does not involve web search or page retrieval."
---

# Keenable — Web Search & Page Extraction

Keenable is a hosted web-search engine exposed over MCP. Describe the page you
want in natural language and it returns ranked results with titles, URLs, and
snippets, or fetches a known URL as clean, LLM-ready markdown.

**MCP server:** `https://api.keenable.ai/mcp` (Streamable HTTP)
**Free tier:** works keyless — a rate-limited public endpoint, no signup
**API key:** set the `X-API-Key` header to raise rate limits (and to enable the
low-latency `realtime` search mode on eligible accounts) — [keenable.ai](https://keenable.ai)
**Site:** [keenable.ai](https://keenable.ai)

## Setup

Add the MCP server to your agent config:

```bash
# OpenClaw — keyless
openclaw mcp add keenable --url "https://api.keenable.ai/mcp"
```

Or in any MCP config JSON (Streamable HTTP transport):

```json
{
  "mcpServers": {
    "keenable": {
      "url": "https://api.keenable.ai/mcp"
    }
  }
}
```

To raise rate limits, send your key as an `X-API-Key` header:

```json
{
  "mcpServers": {
    "keenable": {
      "url": "https://api.keenable.ai/mcp",
      "headers": { "X-API-Key": "YOUR_KEENABLE_API_KEY" }
    }
  }
}
```

---

## Tool Reference

| Tool | What it does |
|------|-------------|
| `search_web_pages` | Web search — natural-language query in, ranked results (title, URL, snippet) out |
| `fetch_page_content` | Fetch a known URL and return the page as clean markdown |

---

## search_web_pages

Describe the page you want in natural language, not just keywords — Keenable
ranks on meaning. Snippets are starting points; open the URL with
`fetch_page_content` before relying on a claim, and cite the source.

**Parameters:**

| Parameter | Type | What it does |
|-----------|------|-------------|
| `query` | string, required | Semantically rich description of the ideal page (e.g. "official changelog for the EU AI Act 2025 amendments"), not bare keywords |
| `mode` | `pro` \| `realtime` | `pro` (default) for higher-quality results; `realtime` for the lowest latency (good for voice / latency-sensitive turns). `realtime` requires an enabled account |
| `site` | string | Restrict results to one site, e.g. `arxiv.org` |
| `published_after` / `published_before` | string | `YYYY-MM-DD` bounds on publish date — use for time-sensitive topics |
| `acquired_after` / `acquired_before` | string | `YYYY-MM-DD` bounds on when the page was indexed |

```
search_web_pages {
  "query": "blog posts comparing vector databases for recommendation systems",
  "site": "arxiv.org"
}
```

```
search_web_pages {
  "query": "latest OpenAI model announcements",
  "published_after": "2026-01-01",
  "mode": "realtime"
}
```

### Search modes

- `pro` — default. Higher-quality ranking. Best for research and accuracy.
- `realtime` — fastest response, ideal for latency-sensitive turns (e.g. voice
  agents). Requires an account with realtime enabled; keyless and standard
  accounts should use `pro`.

---

## fetch_page_content

Fetch a known URL and get the page back as clean markdown — no scraping or HTML
parsing on your side. Use it to read a result returned by `search_web_pages`
before citing it.

**Parameters:**

| Parameter | Type | What it does |
|-----------|------|-------------|
| `url` | string, required | The URL to fetch, e.g. `https://example.com` |
| `max_chars` | int | Cap the returned content length. Longer pages are truncated. Defaults to 50000 |

```
fetch_page_content {
  "url": "https://example.com/article",
  "max_chars": 20000
}
```

---

## Typical flow

1. `search_web_pages` with a descriptive query (add `site` / date filters to
   narrow).
2. Pick the most relevant result.
3. `fetch_page_content` on its URL to read the full page.
4. Answer from the fetched content and cite the source URL.
