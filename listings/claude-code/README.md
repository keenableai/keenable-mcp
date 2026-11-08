# Keenable Web Search for Claude Code

Gives Claude Code live web search and page reading through Keenable, a web
search engine built for AI agents. The plugin adds one remote MCP server with
two tools:

- `search_web_pages` finds current pages on any topic, narrowed by site and
  publish date.
- `fetch_page_content` reads any URL as clean markdown, or returns only the
  part you ask for.

It is keyless: there is no sign-in and nothing to configure. Keyless calls run
on the shared public tier (1,000 requests per hour per IP). To run on your own
Keenable account with its own limits, add the server with your API key instead,
as described in the [Claude Code guide](https://docs.keenable.ai/integrations/claude?utm_source=claude-plugin&utm_medium=registry).

## Install

```text
/plugin marketplace add keenableai/keenable-mcp
/plugin install keenable@keenable
```

Run `/mcp` to check that the server is connected with both tools. A plugin
server is listed as `plugin:keenable:keenable`, and its tools are named
`mcp__plugin_keenable_keenable__search_web_pages` and
`mcp__plugin_keenable_keenable__fetch_page_content`.

## Links

- Docs: https://docs.keenable.ai/integrations/claude?utm_source=claude-plugin&utm_medium=registry
- Site: https://keenable.ai/?utm_source=claude-plugin&utm_medium=registry
- Privacy: https://keenable.ai/privacy

License: MIT
