import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_ID,
  GRANT_TYPE,
  GET_API_KEY_TOOL,
  apiOriginFrom,
  createApiKeyFlow,
  getApiKeyEnabled,
} from "../src/get-api-key.js";

const KEY = `keen_${"x".repeat(24)}`;
const CODE = {
  agent_code: "agent-code-1",
  user_code: "ABCD-EFGH",
  verification_uri: "https://app.keenable.ai/link?code=ABCD-EFGH",
  expires_in: 600,
  interval: 5,
};

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

// Scripted fetch: `code` answers /code, `tokens` is consumed per /token poll.
function harness({ code = () => jsonResponse(200, CODE), tokens = [], ...opts } = {}) {
  let clock = 0;
  const calls = [];
  const keys = [];
  const queue = [...tokens];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    if (url.endsWith("/v1/auth/agent/code")) return code();
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (!next) return jsonResponse(200, { error: "authorization_pending" });
    return next();
  };
  const sleep = (ms) => {
    if (ms === NEVER) return new Promise(() => {});
    clock += ms;
    return new Promise((resolve) => setImmediate(resolve));
  };
  const flow = createApiKeyFlow({
    apiOrigin: "https://api.example.test",
    onApiKey: (key) => keys.push(key),
    fetchImpl,
    sleep,
    now: () => clock,
    label: "host-mcp",
    ...opts,
  });
  return { flow, calls, keys, elapsed: () => clock };
}

const NEVER = 777_777;
const pending = () => jsonResponse(200, { error: "authorization_pending" });

function textOf(result) {
  return result.content.map((c) => c.text).join("\n");
}

function assertNoKey(result) {
  assert.ok(!JSON.stringify(result).includes(KEY), "tool output must never contain the key");
}

test("the flag is off unless KEENABLE_GET_API_KEY is 1 or true", () => {
  assert.equal(getApiKeyEnabled({}), false);
  assert.equal(getApiKeyEnabled(undefined), false);
  assert.equal(getApiKeyEnabled({ KEENABLE_GET_API_KEY: "0" }), false);
  assert.equal(getApiKeyEnabled({ KEENABLE_GET_API_KEY: "yes" }), false);
  assert.equal(getApiKeyEnabled({ KEENABLE_GET_API_KEY: "1" }), true);
  assert.equal(getApiKeyEnabled({ KEENABLE_GET_API_KEY: "TRUE" }), true);
});

test("the API origin comes from the MCP URL", () => {
  assert.equal(apiOriginFrom("https://api.keenable.ai/mcp?keenable_title=npm"), "https://api.keenable.ai");
});

test("the tool takes no arguments", () => {
  assert.deepEqual(GET_API_KEY_TOOL.inputSchema, { type: "object", properties: {} });
});

test("first call returns the approve link and user code, then approval sets the key", async () => {
  const { flow, calls, keys } = harness({ tokens: [pending, () => jsonResponse(200, { api_key: KEY })] });

  const first = await flow.call();
  assert.equal(first.isError, undefined);
  assert.match(textOf(first), /Open: https:\/\/app\.keenable\.ai\/link\?code=ABCD-EFGH/);
  assert.match(textOf(first), /Code: ABCD-EFGH/);
  assert.deepEqual(calls[0], {
    url: "https://api.example.test/v1/auth/agent/code",
    body: { client_id: CLIENT_ID, label: "host-mcp" },
  });

  await flow.settled;
  assert.deepEqual(keys, [KEY]);
  assert.equal(flow.status, "active");
  assert.deepEqual(calls[1].body, { client_id: CLIENT_ID, agent_code: "agent-code-1", grant_type: GRANT_TYPE });

  const second = await flow.call();
  assert.equal(second.isError, undefined);
  assert.match(textOf(second), /already has an API key/);
  for (const r of [first, second]) assertNoKey(r);
});

test("a recall while approval lands reports approval without the key", async () => {
  const { flow, keys } = harness({ tokens: [() => jsonResponse(200, { api_key: KEY })], waitOnRecallMs: NEVER });
  await flow.call();
  const result = await flow.call();
  assert.equal(result.isError, undefined);
  assert.match(textOf(result), /approved/);
  assert.deepEqual(keys, [KEY]);
  assertNoKey(result);
});

test("a recall while still pending shows the link again without error", async () => {
  const { flow } = harness({ tokens: [pending], waitOnRecallMs: 0 });
  await flow.call();
  const result = await flow.call();
  assert.equal(result.isError, undefined);
  assert.match(textOf(result), /still waiting/);
  assert.match(textOf(result), /Code: ABCD-EFGH/);
});

test("expired_token tells the agent to call get_api_key again", async () => {
  const { flow, keys } = harness({ tokens: [() => jsonResponse(200, { error: "expired_token" })] });
  await flow.call();
  await flow.settled;
  const result = await flow.call();
  assert.equal(result.isError, true);
  assert.match(textOf(result), /expired/);
  assert.match(textOf(result), /Next step: call get_api_key again/);
  assert.match(textOf(result), /\(code: expired_token\)/);
  assert.match(textOf(result), /Docs: https:\/\/docs\.keenable\.ai\/authentication#device-flow-errors/);
  assert.deepEqual(keys, []);
  assert.equal(flow.status, "idle");
});

test("access_denied tells the agent the user declined and to continue keyless", async () => {
  const { flow, keys } = harness({ tokens: [() => jsonResponse(200, { error: "access_denied" })] });
  await flow.call();
  await flow.settled;
  const result = await flow.call();
  assert.equal(result.isError, true);
  assert.match(textOf(result), /declined/);
  assert.match(textOf(result), /continue keyless/);
  assert.match(textOf(result), /\(code: access_denied\)/);
  assert.deepEqual(keys, []);
});

test("the poll gives up after 10 minutes with a show-the-link-again step", async () => {
  const { flow, keys, elapsed } = harness({ tokens: [pending], code: () => jsonResponse(200, { ...CODE, expires_in: 3600 }) });
  await flow.call();
  await flow.settled;
  assert.ok(elapsed() >= 10 * 60_000 && elapsed() < 10 * 60_000 + 10_000);
  const result = await flow.call();
  assert.equal(result.isError, true);
  assert.match(textOf(result), /still waiting/);
  assert.match(textOf(result), /call get_api_key again for a new link, then show it to your user again/);
  assert.match(textOf(result), /\(code: authorization_pending\)/);
  assert.deepEqual(keys, []);
  assert.equal(flow.status, "idle");
});

test("an upstream 5xx on the code request says retry once in 30 seconds", async () => {
  const { flow } = harness({
    code: () => jsonResponse(503, { error: "Service unavailable", code: "internal_error" }, { "x-request-id": "req-9" }),
  });
  const result = await flow.call();
  assert.equal(result.isError, true);
  assert.match(textOf(result), /HTTP 503/);
  assert.match(textOf(result), /retry get_api_key once in 30 seconds/);
  assert.match(textOf(result), /\(code: internal_error\)/);
  assert.match(textOf(result), /\(request_id: req-9\)/);
  assert.equal(flow.status, "idle");
});

test("a network failure on the code request is reported like a 5xx", async () => {
  const { flow } = harness({
    code: () => {
      throw new TypeError("fetch failed");
    },
  });
  const result = await flow.call();
  assert.equal(result.isError, true);
  assert.match(textOf(result), /retry get_api_key once in 30 seconds/);
  assert.match(textOf(result), /\(code: internal_error\)/);
});

test("a 4xx on the code request passes the API's code and fix through", async () => {
  const { flow } = harness({
    code: () =>
      jsonResponse(429, {
        error: "Rate limit exceeded",
        code: "rate_limited",
        fix: "Wait for Retry-After, then retry.",
        docs_url: "https://docs.keenable.ai/errors#429",
      }),
  });
  const result = await flow.call();
  assert.equal(result.isError, true);
  assert.match(textOf(result), /HTTP 429/);
  assert.match(textOf(result), /Next step: Wait for Retry-After, then retry\./);
  assert.match(textOf(result), /Docs: https:\/\/docs\.keenable\.ai\/errors#429 \(code: rate_limited\)/);
});

test("one 5xx while polling is retried after 30 seconds and the flow still succeeds", async () => {
  const { flow, keys, elapsed } = harness({
    tokens: [() => jsonResponse(502, {}), () => jsonResponse(200, { api_key: KEY })],
  });
  await flow.call();
  await flow.settled;
  assert.deepEqual(keys, [KEY]);
  assert.ok(elapsed() >= 30_000);
});

test("two 5xx in a row while polling end the flow with the retry step", async () => {
  const { flow, keys } = harness({ tokens: [() => jsonResponse(500, {}), () => jsonResponse(500, {})] });
  await flow.call();
  await flow.settled;
  const result = await flow.call();
  assert.equal(result.isError, true);
  assert.match(textOf(result), /retry get_api_key once in 30 seconds/);
  assert.deepEqual(keys, []);
});

test("slow_down lengthens the poll interval", async () => {
  const { flow, elapsed } = harness({
    tokens: [() => jsonResponse(200, { error: "slow_down" }), () => jsonResponse(200, { api_key: KEY })],
  });
  await flow.call();
  await flow.settled;
  assert.equal(elapsed(), 5_000 + 10_000);
});

test("nothing is logged, so the key cannot leak to logs", async () => {
  const original = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  const lines = [];
  for (const k of Object.keys(original)) console[k] = (...a) => lines.push(a.join(" "));
  try {
    const { flow } = harness({ tokens: [() => jsonResponse(200, { api_key: KEY })] });
    await flow.call();
    await flow.settled;
    await flow.call();
  } finally {
    Object.assign(console, original);
  }
  assert.deepEqual(lines, []);
});
