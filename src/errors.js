// One readable line for an error from the hosted server or the network.

// Node's fetch reports every network failure as "fetch failed" and keeps the
// reason (ENOTFOUND, ECONNREFUSED, a TLS error...) on `cause`.
function withCause(err) {
  const message = err?.message || String(err);
  const cause = err?.cause?.code || err?.cause?.message;
  return cause && !message.includes(cause) ? `${message} (${cause})` : message;
}

// The hosted server rejects a request with a JSON body such as
// {"error":"requires_auth","message":"Malformed API key. ..."}; the MCP SDK
// wraps that body in its own prefix. Only the server's message is useful.
function serverMessage(text) {
  const start = text.indexOf("{");
  if (start < 0) return undefined;
  try {
    const { message } = JSON.parse(text.slice(start));
    return typeof message === "string" && message ? message : undefined;
  } catch {
    return undefined;
  }
}

export function describeError(err) {
  const text = withCause(err);
  return serverMessage(text) ?? text;
}
