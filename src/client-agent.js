// User-Agent for calls to the hosted server, naming the stdio host (Claude
// Desktop, Cursor, Cline...) so usage is counted per client. Name and version
// only, reduced to a safe token set.

const TOKEN = /[^A-Za-z0-9._-]+/g;

function token(value, max) {
  return typeof value === "string" ? value.replace(TOKEN, "-").slice(0, max) : "";
}

export function bridgeUserAgent(version, clientInfo) {
  const own = `keenable-mcp/${version}`;
  const name = token(clientInfo?.name, 64);
  if (!name) return own;
  const clientVersion = token(clientInfo?.version, 32);
  return `${own} (${clientVersion ? `${name}/${clientVersion}` : name})`;
}
