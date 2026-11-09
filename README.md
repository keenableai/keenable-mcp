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
| `search_web_pages` | Live web search. Args: `query` (required), plus optional `mode` (`pro` or `realtime`), `site`, `exclude_domains`, `published_after` / `published_before`, `acquired_after` / `acquired_before`, `query_time` (point-in-time upper bound, not a recency filter), `max_results` (1-50), `snippet_max_length` (180-10000), `session_id`, `output_format`, `disable_cards` (plain web pages instead of Keenable-written cards). |
| `fetch_page_content` | Fetch a URL and return clean markdown. Args: `url` (required), optional `max_chars` (default 50000), `live`, `prompt` (extract only what you ask for), `session_id`, `output_format`. |

### `exclude_domains`

Use `site` for one site and `exclude_domains` (array) to drop sites from the
results. This section is the one place the rules are written down; the skill
and `llms-install.md` point here.

- Hosts only, such as `example.com`. Each host covers its subdomains
  (`yahoo.com` covers `finance.yahoo.com`). Hosting suffixes such as
  `github.io` or `blogspot.com` are accepted.
- Up to 1,000 distinct hosts, 2,000 entries as sent, 2,048 bytes per entry.
- The server cleans up surrounding spaces, case, an `http://` or `https://`
  scheme, a leading `www.`, a port, a trailing `/` or `.`, and a query string
  or fragment.
- It rejects anything else with a 400 `invalid_filter` error whose `field`,
  `value` and `reason` name the entry (or the count, for a limit): an empty
  entry, a path, another scheme, a suffix such as `.com` or `com`, a
  wildcard, an IP address, a `user@` prefix, or an invalid host.
- If every result is excluded, the response can be empty.

The hosted server is the validator; the npm wrapper passes the list through
unchanged. `src/tools.js` copies the server's own parameter text verbatim, so
it changes only when the server's does.

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

## Development

```sh
npm install
npm test
```

`npm test` runs the unit tests and a stdio smoke test of the discovery build
(`src/discovery.js`): `initialize` must advertise the server metadata and
`tools/list` must return both tools. CI runs it on Node 18, 20 and 22 and on
the oldest MCP SDK the package accepts. The skill script's tests run with
`python3 -I -m unittest discover -s test/skill -p "test_*.py"`, also in CI. They
live outside `skills/` so `npx skills add` does not install them.

## Releasing

The npm version lives only in `package.json`; the bridge reads it at runtime.
`server.json` (the MCP Registry manifest) must repeat it as a literal in
`packages[].version`, so bump both. `npm run check:version` compares them and
runs automatically before `npm publish`. The top-level `server.json` `version`
is the registry entry's own version and is bumped whenever `server.json`
changes. The live registry entry is 0.2.1; `server.json` is 0.2.2 (npm 0.1.2)
and is published with the next npm release.

## Links

- Docs: https://docs.keenable.ai/mcp-server
- Site: https://keenable.ai
- Registry: [`ai.keenable/web-search`](https://registry.modelcontextprotocol.io/v0/servers?search=ai.keenable) (Official MCP Registry)

## License

MIT
