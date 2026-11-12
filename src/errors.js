// One readable line for an error from the hosted server or the network.

// Node's fetch reports every network failure as "fetch failed" and keeps the
// reason (ENOTFOUND, ECONNREFUSED, a TLS error...) on `cause`.
function withCause(err) {
  const message = err?.message || String(err);
  const cause = err?.cause?.code || err?.cause?.message;
  return cause && !message.includes(cause) ? `${message} (${cause})` : message;
}

// The hosted server rejects a request with a JSON body such as
// {"error":"requires_auth","message":"Malformed API key. ...","code":"...",
// "fix":"...","retryable":false}; the MCP SDK wraps that body in its own
// prefix. Keep what tells the agent what to do next: the message, the code,
// the fix and whether a retry can help, in the same shape as the hosted
// server's own tool errors.
function serverMessage(text) {
  const start = text.indexOf("{");
  if (start < 0) return undefined;
  let body;
  try {
    body = JSON.parse(text.slice(start));
  } catch {
    return undefined;
  }
  const { message, code, fix, retryable } = body ?? {};
  if (typeof message !== "string" || !message) return undefined;
  return [
    typeof code === "string" && code ? `${message} (${code})` : message,
    typeof fix === "string" && fix && `Fix: ${fix}`,
    typeof retryable === "boolean" && `Retryable: ${retryable ? "yes" : "no"}`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function describeError(err) {
  const text = withCause(err);
  return serverMessage(text) ?? text;
}
