# Keenable Web Search for Cursor

Gives Cursor's agent live web search and page reading through Keenable, a web
search engine built for AI agents. The plugin adds one remote MCP server with
two tools:

- `search_web_pages` finds current pages on any topic, narrowed by site and
  publish date.
- `fetch_page_content` reads any URL as clean markdown, or returns only the
  part you ask for.

It is keyless: there is no sign-in and nothing to configure. Keyless calls run
on the shared public tier (1,000 requests per hour per IP). To run on your own
Keenable account, add the server to `mcp.json` with your API key instead, as
described in the [Cursor guide](https://docs.keenable.ai/integrations/cursor?utm_source=cursor&utm_medium=registry).

## Verify

Open **Customize** in the sidebar and check that **keenable** is listed and
switched on with both tools, then ask the agent something that needs the live
web.

## Links

- Docs: https://docs.keenable.ai/integrations/cursor?utm_source=cursor&utm_medium=registry
- Site: https://keenable.ai/?utm_source=cursor&utm_medium=registry
- Privacy: https://keenable.ai/privacy

License: MIT
