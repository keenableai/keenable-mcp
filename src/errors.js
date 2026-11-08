// Classify and describe failures talking to the hosted Keenable MCP server,
// so the bridge can retry the transient ones and tell the user (and the
// agent) what went wrong in words they can act on.

// Network-level failures (DNS, refused, reset, timeout) and 5xx responses are
// worth retrying; a 4xx such as a malformed API key is not.
export function isRetryable(err) {
  const status = httpStatus(err);
  if (status === undefined) return isNetworkError(err);
  return status >= 500;
}

// Recent MCP SDKs throw StreamableHTTPError with the HTTP status in `code`;
// older ones (1.12) throw a plain Error whose message says "(HTTP 401)".
// JSON-RPC errors (McpError) also carry a numeric `code`, but a negative one.
function httpStatus(err) {
  if (typeof err?.code === "number" && err.code >= 100) return err.code;
  const match = /\(HTTP (\d{3})\)/.exec(err?.message ?? "");
  return match ? Number(match[1]) : undefined;
}

function isNetworkError(err) {
  return (
    err?.name === "TypeError" ||
    err?.name === "AbortError" ||
    err?.name === "TimeoutError" ||
    typeof networkCode(err) === "string"
  );
}

// Node's fetch wraps the socket error: `TypeError: fetch failed` with
// `cause.code` such as ENOTFOUND or ECONNREFUSED.
function networkCode(err) {
  return err?.cause?.code ?? err?.cause?.cause?.code;
}

// The endpoint without its query string, for messages.
export function displayUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return String(url);
  }
}

export function describeError(err, url) {
  const where = displayUrl(url);
  const status = httpStatus(err);
  if (status !== undefined) {
    // The hosted server answers errors with {"error": ..., "message": ...};
    // its message is already written for the user, so pass it through.
    const body = /\{.*\}/s.exec(err.message)?.[0];
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.message === "string") return parsed.message;
    } catch {}
    return `The Keenable server at ${where} answered HTTP ${status}: ${err.message}`;
  }
  if (isNetworkError(err)) {
    const code = networkCode(err);
    return (
      `Could not reach the Keenable server at ${where}` +
      (code ? ` (${code})` : "") +
      ". Check the network connection or proxy; set KEENABLE_MCP_URL only if you use a different endpoint."
    );
  }
  return err?.message || String(err);
}
