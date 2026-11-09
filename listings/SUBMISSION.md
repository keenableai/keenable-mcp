# Agent store submissions

One listing per store, each with its own attribution tag. Nothing here has been
submitted yet: a person with the store account submits, then updates the
status line.

Attribution used by every listing:

- MCP URLs carry `keenable_title=<tag>`, which the hosted server records as the
  caller's title.
- Web links carry `utm_source=<tag>&utm_medium=registry`.

| Store | Tag | Status |
|---|---|---|
| Official MCP Registry | `mcp-registry` | Live (`ai.keenable/web-search` 0.2.1). Do not resubmit. |
| Claude plugin directory | `claude-plugin` | Not submitted |
| Cursor (cursor.directory, then Cursor Marketplace) | `cursor` | Not submitted |
| Cline MCP Marketplace | `cline` | Not submitted |
| skills.sh | None yet (see below) | Not submitted |

## Official MCP Registry

- Already live as 0.2.1. `server.json` is 0.2.2 (npm 0.1.2), not yet
  published. The remote is
  `https://api.keenable.ai/mcp-public?keenable_title=mcp-registry`.
- Republish only when `server.json` changes, with `mcp-publisher publish` and a
  new top-level `version`.

## Claude plugin directory

- **Where:** [claude.ai/directory/manage](https://claude.ai/directory/manage) →
  **Submit new** → **Plugin bundle**. Needs a paid claude.ai plan (an Owner on
  Team or Enterprise). Guide: https://claude.com/docs/plugins/submit
- **Source:** repository `keenableai/keenable-mcp`, plugin path
  `listings/claude-code`, branch `main`.
- **Updates:** keep **GitHub push webhook** (needs repo admin).
- **Fields come from the repo:** `listings/claude-code/.claude-plugin/plugin.json`
  (name `keenable`, display name "Keenable Web Search", icon
  `.claude-plugin/icon.png` 512×512, privacy and terms URLs) and
  `listings/claude-code/README.md` (the listing description).
- **MCP server:** `https://api.keenable.ai/mcp-public?keenable_title=claude-plugin`
  (keyless, no OAuth discovery, so Claude shows no sign-in).
- **Connector:** Keenable Web Search is already in the Claude Connectors
  Directory, so no separate connector submission is needed.
- **Before submitting:** `claude plugin validate ./listings/claude-code --strict`
  must pass (it does on this branch). Note the icon is used only on the first
  save in the portal.
- **Works before review:** anyone can already run
  `/plugin marketplace add keenableai/keenable-mcp` and
  `/plugin install keenable@keenable` once this is on `main`.
- **Status:** not submitted.

## Cursor

Cursor has two separate queues. Submit to cursor.directory first, which Cursor
staff recommend for most plugins, then to the curated marketplace.

### cursor.directory

- **Where:** https://cursor.directory/plugins/new, sign in with GitHub.
- **Auto tab:** paste `https://github.com/keenableai/keenable-mcp/tree/main/listings/cursor`
  and click **Scan repo**. It should find `mcp.json` with one server, `keenable`.
- **Manual tab (if the scan finds nothing):** name `keenable`; description from
  `listings/cursor/.cursor-plugin/plugin.json`; repository
  `https://github.com/keenableai/keenable-mcp`; homepage
  `https://keenable.ai/?utm_source=cursor&utm_medium=registry`; keywords
  `web-search, search, fetch, markdown, research, keyless`; one MCP component
  pasted from `listings/cursor/mcp.json`.

### Cursor Marketplace

- **Where:** https://cursor.com/marketplace/publish (hand-reviewed, no status
  page; Cursor replies by email). Submitted as an individual account; say in the
  notes that this is a Keenable company submission with `support@keenable.ai`
  as the contact.
- **Source:** repository `https://github.com/keenableai/keenable-mcp`. The repo
  root has `.cursor-plugin/marketplace.json`, which points at `listings/cursor`.
- **Manifest:** `listings/cursor/.cursor-plugin/plugin.json` (name `keenable`,
  MIT, logo `assets/logo.png` 400×400 by absolute raw URL).
- **MCP server:** `https://api.keenable.ai/mcp-public?keenable_title=cursor`.
- **Status:** not submitted.

## Cline MCP Marketplace

- **Where:** a new issue from the template at
  https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml
- **GitHub Repo URL:** `https://github.com/keenableai/keenable-mcp`
- **Logo:** `assets/logo.png` (400×400 PNG, as required).
- **Reason for addition:** keyless live web search and clean-markdown page
  fetch for Cline, with no signup or key needed to start.
- **Attestation:** the form asks the submitter to confirm they watched Cline
  install the server from `README.md` / `llms-install.md`. Do that test for real
  before ticking it.
- **Attribution:** `llms-install.md` sets
  `KEENABLE_MCP_URL=https://api.keenable.ai/mcp?keenable_title=cline` for the
  npm bridge, and its signup link carries `utm_source=cline`. The guide is
  titled for Cline and tells other clients to drop the `env` line, so their
  installs are not counted as Cline.
- **Trade-off:** `KEENABLE_MCP_URL` overrides the bridge's built-in endpoint,
  so Cline installs stay pinned to `https://api.keenable.ai/mcp` even if a later
  `@keenable/mcp` release changes its default. Moving Cline users to another
  endpoint means editing `llms-install.md` and asking them to update their
  config.
- **Status:** not submitted.

## skills.sh

- **Where:** no form. skills.sh lists a skill automatically once someone runs
  `npx skills add` on it, and ranks by install count. Seed it once:
  `npx skills add keenableai/keenable-mcp --skill keenable-web-search -g -y`.
- **Listing:** `skills/keenable-web-search/SKILL.md` (name and description are
  what skills.sh search matches).
- **No tag yet:** skills.sh has no attribution tag of its own. The skill's
  script tags keyless calls with `X-Keenable-Title: OpenClaw Skill`, and the
  same skill is published to ClawHub, so skills.sh and ClawHub calls are not
  told apart. skills.sh's own install count is the per-store number until the
  skill gets its own tag.
- **Check:** `npx skills add keenableai/keenable-mcp --list` should show only
  `keenable-web-search`.
- **Status:** not submitted (not seeded).
