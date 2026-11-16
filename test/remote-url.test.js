import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRemoteUrl, refuseRedirects } from "../src/remote-url.js";

test("accepts https anywhere and plain http on loopback only", () => {
  for (const value of [
    "https://api.keenable.ai/mcp?keenable_title=npm",
    "https://example.com:8443/mcp",
    "https://10.0.0.5/mcp",
    "http://localhost/mcp",
    "http://LOCALHOST:8080/mcp",
    "http://127.0.0.1:3000/mcp",
    "http://[::1]:3000/mcp",
  ]) {
    assert.equal(parseRemoteUrl(value).href, new URL(value).href);
  }
});

test("rejects anything else, judging the host requests would reach", () => {
  const rejected = {
    "http://example.com/mcp": /must use https, got http:\/\/example\.com /,
    "http://10.0.0.5/mcp": /must use https, got http:\/\/10\.0\.0\.5 /,
    "http://127.0.0.2/mcp": /must use https/,
    "http://[::ffff:127.0.0.1]/mcp": /must use https/,
    "http://localhost.example.com/mcp": /must use https, got http:\/\/localhost\.example\.com /,
    "http://localhost./mcp": /must use https/,
    // The backslash ends the host for the URL parser, so this is evil.example.
    "http://evil.example\\@localhost/mcp": /must use https, got http:\/\/evil\.example /,
    "http://localhost@evil.example/mcp": /must not contain a user or password \(host: evil\.example\)/,
    "https://user@example.com/mcp": /must not contain a user or password/,
    "https://user:pw@example.com/mcp": /must not contain a user or password/,
    "ftp://example.com/mcp": /must use https, got ftp:\/\/example\.com /,
    "file:///etc/passwd": /must use https, got file:\/\/ /,
    "ws://localhost/mcp": /must use https/,
    "api.keenable.ai/mcp": /is not a valid URL/,
    "": /is not a valid URL/,
    "   ": /is not a valid URL/,
  };
  for (const [value, pattern] of Object.entries(rejected)) {
    assert.throws(() => parseRemoteUrl(value), pattern, value);
  }
});

test("never repeats a user, password, path or query in the message", () => {
  for (const value of [
    "http://alice:s3cret@example.com/private?token=s3cret",
    "https://alice:s3cret@example.com/private?token=s3cret",
    "ftp://example.com/private?token=s3cret",
    "s3cret private",
  ]) {
    assert.throws(
      () => parseRemoteUrl(value),
      (err) => !/s3cret|alice|private/.test(err.message),
      value,
    );
  }
});

test("refuseRedirects asks fetch not to follow and passes other responses through", async () => {
  const calls = [];
  const ok = new Response("{}", { status: 200 });
  const fetch = refuseRedirects(async (input, init) => {
    calls.push(init);
    return ok;
  });
  assert.equal(await fetch("https://example.com/mcp", { method: "POST", redirect: "follow" }), ok);
  assert.deepEqual(calls, [{ method: "POST", redirect: "manual" }]);
  for (const status of [304, 401, 404, 500]) {
    const response = new Response(null, { status });
    assert.equal(await refuseRedirects(async () => response)("https://example.com/mcp"), response);
  }
});

test("refuseRedirects turns a redirect into an error naming only the target's origin", async () => {
  const redirect = (location) => async () =>
    new Response(null, { status: 307, headers: location === undefined ? {} : { location } });
  const message = (origin) =>
    `the server answered with a redirect (307) to ${origin}, which was not followed; ` +
    "set KEENABLE_MCP_URL to the server's final address";
  const cases = [
    ["https://evil.example/steal?key=1", "https://evil.example"],
    ["http://example.com/mcp", "http://example.com"],
    ["/elsewhere", "https://example.com"],
    [undefined, "another address"],
  ];
  for (const input of ["https://example.com/mcp", new URL("https://example.com/mcp")]) {
    for (const [location, origin] of cases) {
      await assert.rejects(refuseRedirects(redirect(location))(input, {}), { message: message(origin) });
    }
  }
});
