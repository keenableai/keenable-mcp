// Where the bridge may send the API key: the checks on KEENABLE_MCP_URL, and
// a fetch that never follows a redirect away from that address.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const FIX = "Set it to an https:// URL, or unset it to use the hosted Keenable server.";

// The hosted server's address as a URL, or an Error whose message says what
// to change. The message never repeats a user, password, path or query from
// the value: any of them can hold a secret.
//
// Every check reads the parsed URL, the same one requests are sent to, so a
// spelling such as "http://evil.example\@localhost" is judged by the host the
// request would really reach.
export function parseRemoteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`KEENABLE_MCP_URL is not a valid URL. ${FIX}`);
  }
  if (url.username || url.password) {
    throw new Error(
      `KEENABLE_MCP_URL must not contain a user or password (host: ${url.host}). ` +
        "Remove them and pass the key in KEENABLE_API_KEY.",
    );
  }
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol === "https:" || (url.protocol === "http:" && loopback)) return url;
  throw new Error(
    `KEENABLE_MCP_URL must use https, got ${url.protocol}//${url.host} ` +
      `(plain http is allowed only for localhost, 127.0.0.1 and [::1]). ${FIX}`,
  );
}

// Wraps `fetch` so a redirect is an error instead of a second request. fetch
// drops only the standard credential headers when it follows a redirect to
// another host; X-API-Key would go along, also from https to plain http.
export function refuseRedirects(fetch) {
  return async (input, init) => {
    const response = await fetch(input, { ...init, redirect: "manual" });
    if (!REDIRECT_STATUSES.has(response.status)) return response;
    await response.body?.cancel().catch(() => {});
    // The target is not named: Location is the server's text, and a server
    // that was sent the key could put it in the host name.
    throw new Error(
      `the server answered with a redirect (${response.status}), which was not followed; ` +
        "set KEENABLE_MCP_URL to the server's final address",
    );
  };
}
