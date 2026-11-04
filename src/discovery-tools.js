// Static tool schemas for the discovery build, kept import-free for offline tests.
// Not a validator: the hosted server checks every argument.

export const TOOLS = [
  {
    name: "search_web_pages",
    description:
      "Live web search over the Keenable web index. Describe the ideal page, not keywords. Use date filters and include_domains / exclude_domains (site for a single domain) to narrow results.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Natural language search query. A semantically rich description of the ideal page, not just keywords.",
        },
        mode: {
          type: "string",
          enum: ["pro"],
          description: "Search mode: 'pro' (default) for enhanced results.",
        },
        site: {
          type: "string",
          description:
            'Restrict results to one domain (e.g. "techcrunch.com"); for several, use include_domains.',
        },
        include_domains: {
          type: "array",
          items: { type: "string" },
          description:
            'Return results only from these domains. Entries: "example.com" (and its subdomains), "example.com/docs" (path prefix), ".gov" (suffix). Up to 200 entries with exclude_domains; do not combine with site.',
        },
        exclude_domains: {
          type: "array",
          items: { type: "string" },
          description:
            "Never return results from these domains. Same entry forms as include_domains; wins over include_domains.",
        },
        published_after: {
          type: "string",
          description: "Filter to pages published after this date (YYYY-MM-DD).",
        },
        published_before: {
          type: "string",
          description: "Filter to pages published before this date (YYYY-MM-DD).",
        },
        acquired_after: {
          type: "string",
          description: "Filter to pages acquired/indexed after this date (YYYY-MM-DD).",
        },
        acquired_before: {
          type: "string",
          description: "Filter to pages acquired/indexed before this date (YYYY-MM-DD).",
        },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
  },
  {
    name: "fetch_page_content",
    description:
      "Fetch and extract content from a web page. Returns the page content in markdown format.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: 'The URL to fetch. Example: "https://example.com".',
        },
        live: {
          type: "boolean",
          default: false,
          description: "Fetch live content. Defaults to false.",
        },
        max_chars: {
          type: "integer",
          minimum: 1,
          description:
            "Maximum number of characters of content to return. Longer content is truncated. Defaults to 50000 when omitted.",
        },
      },
      required: ["url"],
    },
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
  },
];
