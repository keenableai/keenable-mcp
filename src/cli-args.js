// Command-line handling for the stdio bridge. The bridge takes no options of
// its own: MCP hosts start it with no arguments and talk to it over stdin.
// --help and --version answer people and agents checking the install; any
// other argument is an error, so a typo doesn't look like a working start.

export const HELP_TEXT = `Usage: npx -y @keenable/mcp

Stdio bridge to the hosted Keenable MCP server (https://api.keenable.ai/mcp).
Add it to an MCP client that only runs stdio commands. It takes no options:
the client starts it and talks to it over stdin and stdout.

Environment:
  KEENABLE_API_KEY   Optional. Your API key; lifts the keyless rate limits.
  KEENABLE_MCP_URL   Optional. Another server address (default: https://api.keenable.ai/mcp).

Options:
  -h, --help      Show this help.
  -v, --version   Show the version.

Clients that support remote servers can skip this package and connect to
https://api.keenable.ai/mcp directly. Docs: https://docs.keenable.ai/mcp-server`;

export function parseArgs(argv) {
  if (argv.length === 0) return { action: "serve" };
  const [first] = argv;
  if (argv.length === 1 && (first === "--help" || first === "-h")) return { action: "help" };
  if (argv.length === 1 && (first === "--version" || first === "-v")) return { action: "version" };
  return {
    action: "error",
    message: `keenable-mcp: unknown argument "${first}". The bridge takes no options; set KEENABLE_API_KEY in the environment instead. Run "npx -y @keenable/mcp --help" for usage.`,
  };
}
