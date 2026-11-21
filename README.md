# Keenable MCP

MCP server for live web search and clean-markdown page fetch over the
[Keenable](https://keenable.ai) web index.

- **Hosted endpoint:** `https://api.keenable.ai/mcp` (Streamable HTTP)
- **Tools:** `search_web_pages`, `fetch_page_content`
- **Keyless by default** (1,000 requests/hour). An optional API key lifts the cap.
- **Rate limits:** 10 calls per second per organization with a key (by default;
  raise it from the console), and 10 per second plus 1,000 per hour per IP
  address without one. Searches and fetches share the limit. The server's
  instructions tell agents to send at most 5 calls at once and to wait out the
  `Retry after` a rate-limit error states.

The server is hosted, so most clients just point at the URL. For clients (or
config paths) that only accept a stdio `command` there is a thin npm wrapper
(`@keenable/mcp`) that bridges to the same endpoint.

## Tools

| Tool | Description |
|---|---|
| `search_web_pages` | Live web search. Args: `query` (required), plus optional `mode` (`pro` or `realtime`; not offered on `/mcp-public`), `site`, `exclude_domains`, `published_after` / `published_before`, `acquired_after` / `acquired_before`, `query_time` (point-in-time upper bound, not a recency filter), `max_results` (1-50), `snippet_max_length` (180-10000), `session_id`, `objective` (two or three sentences on what the search is for, at most 1,000 characters), `output_format`, `disable_cards` (plain web pages instead of Keenable-written cards). |
| `fetch_page_content` | Read web pages and return clean markdown. Args: `urls` (1-10 URLs; one per call without an API key, and each page counts as one call toward the rate limit), optional `max_chars` (per page; when omitted, 20,000 characters in total, split evenly across the pages), `prompt` (applied to every page, returning only what you ask for; a page too long for a prompt fails with `prompt_input_too_long`, so fetch it again without `prompt`), `max_age_hours` (0-720: how old Keenable's indexed copy may be; `0` reads the page live), `session_id`, `output_format`. `url` and `live` are deprecated but still accepted (`live: true` means `max_age_hours: 0`). One URL returns the page as before; several pages are separated by `---` in text and come back as `{"results": [...]}` with `output_format: "json"`, where a page that failed carries its error. The call is a tool error only when every page fails, or when a URL is invalid, private or listed twice (then nothing is fetched). Errors say whether a retry can help (`Retryable: yes` or `no`). |

### `exclude_domains`

Use `site` for one site and `exclude_domains` (array) to drop sites from the
results. This section is the one place the rules are written down; the skill
and `llms-install.md` point here.

- Hosts, such as `example.com`. Each host covers its subdomains
  (`yahoo.com` covers `finance.yahoo.com`). Hosting suffixes such as
  `github.io` or `blogspot.com` are accepted as hosts.
- A public suffix written with a leading dot, such as `.gov` or `.co.uk`,
  excludes every host under it (`*.gov` means the same). The suffix must be on
  the Public Suffix List, and it covers only hosts under it: `.gov` doesn't
  exclude `gov.uk`.
- Up to 1,000 distinct hosts, 2,000 entries as sent, 2,048 bytes per entry.
- The server cleans up surrounding spaces, case, an `http://` or `https://`
  scheme, a leading `www.`, a port, a trailing `/` or `.`, and a query string
  or fragment.
- It rejects anything else with a 400 `invalid_filter` error whose `field`,
  `value` and `reason` name the entry (or the count, for a limit): an empty
  entry, a path, another scheme, a bare suffix such as `com` or `co.uk`, a
  dotted name that isn't a public suffix such as `.example`, a wildcard on a
  host such as `*.un.org`, an IP address, a `user@` prefix, or an invalid
  host.
- If every result is excluded, the response can be empty.

The hosted server is the validator; the npm wrapper passes the list through
unchanged. `src/tools.js` copies the server's own parameter text verbatim, so
it changes only when the server's does.

## Use it

### Remote (recommended)

Clients with remote MCP support connect to the URL directly. Claude Code is
one command:

```sh
claude mcp add keenable --transport http https://api.keenable.ai/mcp --scope user
```

Cursor takes this entry:

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

- **Claude Code**: the command above, or `"type": "http"` in `.mcp.json`
  (`--scope project` writes that file for you).
- **Claude Desktop, claude.ai and the Claude mobile apps**: add **Keenable Web
  Search** from Claude's Connectors Directory, or add a custom connector with
  `https://api.keenable.ai/mcp-oauth`, which signs you in to Keenable. Claude
  Desktop's config file ignores `url` entries; use the
  [stdio wrapper](#stdio-eg-claude-desktops-claude_desktop_configjson) there.
- **Cline** (`cline_mcp_settings.json`): set `"type": "streamableHttp"`. Without
  a type Cline falls back to the legacy SSE transport. See
  [`llms-install.md`](llms-install.md).
- **VS Code** (`.vscode/mcp.json`): the top-level key is `servers`, not
  `mcpServers`, and the type is `"http"`.
- **Clients that fail on OAuth discovery**: use
  `https://api.keenable.ai/mcp-public`. It is the same server without OAuth
  metadata (and without the `mode` parameter).

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

Claude Code:

```sh
claude mcp add keenable --transport http https://api.keenable.ai/mcp --scope user \
  --header "X-API-Key: YOUR_KEY"
```

Remote (JSON):

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

## Monitor tools

With an API key (or a Keenable sign-in on a remote connection), the server
also lists four [Monitors](https://docs.keenable.ai/products/monitors) tools:
`create_monitor`, `list_monitors`, `get_monitor_results` and `delete_monitor`.
A monitor watches the web for you, in one of two kinds:

- A **search monitor** is a standing query: every newly crawled page that is
  news about its topic is kept as a result of that monitor.
- A **page monitor** (`"type": "page"` on the Monitors API) watches one public
  page, such as a competitor's pricing page, and reports when it changes in a
  way that matters (`page.watch_for`, `page.sensitivity`), with a summary of
  the change and a word-level diff.

A monitor runs on a schedule: once, at an interval of 10 minutes or more
(a page monitor checks hourly unless told otherwise), or on a cron expression
in a time zone that runs at most every 10 minutes. It can be paused and
resumed; a resumed monitor carries on at its next scheduled time without a
catch-up run. With an `output_schema` (a supported subset of JSON Schema), a
run also returns structured output in that shape.

Monitors is free for now: requests and runs cost nothing. An organization can
have up to 100 active monitors. `create_monitor` creates search monitors, and
`get_monitor_results` returns their pages. For everything else (creating a
page monitor and reading its changes and version history, setting a schedule
or an output schema, pausing, resuming, renaming or changing a monitor,
starting a run or reading one), use the
[Monitors API](https://docs.keenable.ai/api-reference/monitors/create), the
SDKs or the CLI.

A remote MCP server cannot push messages to a chat, so news is pulled:
`get_monitor_results` returns the results a reader has not been given yet,
across all monitors or for one, each once, and the server remembers what was
read, so a scheduled task that starts a new chat every hour still gets each
result once. `peek: true` looks without marking results as read, and
`includeSeen: true` with a `monitorId` pages through that monitor's results,
read or not. Pass `reader` to give a second person or task a separate reading
position. Keyless connections list only
`search_web_pages` and `fetch_page_content`.

`create_monitor` takes `query` (required), `name`, `webhookUrl`,
`includeDomains` and `excludeDomains`. To have each new result pushed to your
server instead of pulled, pass `webhookUrl`, a public HTTPS address. The
response returns the signing secret once, as `webhookSecret`: store it then,
and treat it like any key pasted into a chat, because it sits in the
transcript. Deliveries are signed under
[Standard Webhooks](https://www.standardwebhooks.com); see
[how to verify them](https://docs.keenable.ai/products/monitors#verify-a-webhook).

The wrapper forwards these tools like the others; its built-in copy of the
tools (used when the hosted server can't be reached) holds only the two search
tools.

## How the wrapper works

`@keenable/mcp` is a small stdio bridge: it connects to the hosted server over
Streamable HTTP and forwards every tool the server exposes. There is no
search logic in this package; the index and tools live behind
`https://api.keenable.ai/mcp`. Environment variables:

- `KEENABLE_API_KEY` — optional API key, sent as `X-API-Key`.
- `KEENABLE_MCP_URL` — override the endpoint (defaults to `https://api.keenable.ai/mcp?keenable_title=npm`). It must be an `https://` URL; plain `http://` is accepted only for `localhost`, `127.0.0.1` and `[::1]`. A URL with a user or password is refused: the key belongs in `KEENABLE_API_KEY`.

The wrapper sends the API key to that address only. If the server answers with
a redirect, the wrapper does not follow it and the call fails with a message
saying so (the target is not shown); set `KEENABLE_MCP_URL` to the final address.

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
saying what to change and exits.

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

To release a new npm version:

1. Bump `version` in `package.json` and `packages[].version` in `server.json`,
   and merge to `main`.
2. Create a GitHub Release tagged `v<version>` (for example `v0.1.2`) on that
   commit.
3. `publish-npm.yml` checks that the tag matches `package.json`, runs the
   tests, and publishes to npm with Trusted Publishing (OIDC, no token). It
   ignores releases whose tag does not start with `v`.

The MCP Registry entry is still published by hand: bumping
`packages[].version` changes `server.json`, so also bump its top-level
`version` and run `mcp-publisher publish`.

## Links

- Docs: https://docs.keenable.ai/mcp-server
- Site: https://keenable.ai
- Registry: [`ai.keenable/web-search`](https://registry.modelcontextprotocol.io/v0/servers?search=ai.keenable) (Official MCP Registry)

## License

MIT
