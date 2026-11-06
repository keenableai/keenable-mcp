// Server metadata advertised on `initialize` (MCP Implementation fields), so
// clients and directories can show a title, description, website and icon.
// The bridge prefers the hosted server's values and falls back to these, which
// mirror keenable-backend-ts src/mcp-server/tools.ts SERVER_METADATA.

export const SERVER_NAME = "keenable-web-search";

export const SERVER_METADATA = {
  title: "Keenable Web Search",
  description:
    "Web search built for AI agents. Find current pages on any topic, narrowed by site and publish date, then read any URL as clean markdown or pull out only the part you need.",
  websiteUrl: "https://docs.keenable.ai/mcp-server",
  icons: [
    { src: "https://api.keenable.ai/favicon.svg", mimeType: "image/svg+xml", sizes: ["any"] },
  ],
};

const FORWARDED_FIELDS = Object.keys(SERVER_METADATA);

export function serverInfo(version, remote) {
  const info = { name: SERVER_NAME, version, ...SERVER_METADATA };
  for (const field of FORWARDED_FIELDS) {
    if (remote?.[field] !== undefined) info[field] = remote[field];
  }
  return info;
}
