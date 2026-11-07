// `get_api_key`: a local bridge tool that runs the agent device flow
// (POST /v1/auth/agent/code, then /v1/auth/agent/token) so an agent can get
// its user's approval for an API key without leaving the task. Off unless
// KEENABLE_GET_API_KEY=1. The key goes to `onApiKey` only: it is never put in
// tool text and never logged.

import { hostname } from "node:os";

export const GET_API_KEY_TOOL_NAME = "get_api_key";
export const GET_API_KEY_FLAG = "KEENABLE_GET_API_KEY";

export const CLIENT_ID = "keenable-mcp";
export const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:agent_code";

const DOCS_DEVICE_FLOW = "https://docs.keenable.ai/authentication#device-flow-errors";
const DOCS_5XX = "https://docs.keenable.ai/errors#5xx";

const POLL_TIMEOUT_MS = 10 * 60_000;
const WAIT_ON_RECALL_MS = 20_000;
const UPSTREAM_RETRY_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;

export const GET_API_KEY_TOOL = {
  name: GET_API_KEY_TOOL_NAME,
  description:
    "Get a Keenable API key for this session with one approval click by your user, instead of searching keyless. " +
    "Returns a link and a code: show both to your user and ask them to approve. After they approve, every search and " +
    "fetch in this session uses the new key, which lifts the keyless hourly cap. Call it again to check whether they " +
    "approved. The key itself is never shown.",
  inputSchema: { type: "object", properties: {} },
  annotations: {
    title: "Get API Key",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export function getApiKeyEnabled(env) {
  const value = String(env?.[GET_API_KEY_FLAG] ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

export function apiOriginFrom(mcpUrl) {
  return new URL(mcpUrl).origin;
}

function text(lines, isError = false) {
  const result = { content: [{ type: "text", text: lines.filter(Boolean).join("\n") }] };
  if (isError) result.isError = true;
  return result;
}

function errorResult({ what, next, code, docsUrl, requestId }) {
  const tail = [`Docs: ${docsUrl} (code: ${code})`, requestId ? `(request_id: ${requestId})` : ""]
    .filter(Boolean)
    .join(" ");
  return text([`Keenable: ${what}`, `Next step: ${next}`, tail], true);
}

function upstreamError(response) {
  const status = response.status ? ` (HTTP ${response.status})` : "";
  return errorResult({
    what: `the key service had a temporary error${status}.`,
    next: "retry get_api_key once in 30 seconds. If it fails again, continue keyless.",
    code: response.body?.code ?? "internal_error",
    docsUrl: response.body?.docs_url ?? DOCS_5XX,
    requestId: response.requestId,
  });
}

function rejectedError(response, step) {
  return errorResult({
    what: `the key service rejected the ${step} (HTTP ${response.status}).`,
    next: response.body?.fix ?? "wait a minute, then call get_api_key again, or continue keyless.",
    code: response.body?.code ?? "request_rejected",
    docsUrl: response.body?.docs_url ?? DOCS_DEVICE_FLOW,
    requestId: response.requestId,
  });
}

const OUTCOMES = {
  expired_token: () =>
    errorResult({
      what: "the approval code expired before your user approved it.",
      next: "call get_api_key again for a new link and code.",
      code: "expired_token",
      docsUrl: DOCS_DEVICE_FLOW,
    }),
  access_denied: () =>
    errorResult({
      what: "your user declined the request for an API key.",
      next: "continue keyless, or ask your user before you call get_api_key again.",
      code: "access_denied",
      docsUrl: DOCS_DEVICE_FLOW,
    }),
  expired_after_network_error: ({ label }) =>
    errorResult({
      what:
        "the approval code expired after a dropped connection to the key service. Your user may already have " +
        `approved, so a key named ${label} may already exist in the console.`,
      next: "call get_api_key again for a new link and code.",
      code: "expired_token",
      docsUrl: DOCS_DEVICE_FLOW,
    }),
  timeout: () =>
    errorResult({
      what: "your user did not approve within 10 minutes, and the code has expired.",
      next: "call get_api_key again for a new link, then show it to your user again.",
      code: "expired_token",
      docsUrl: DOCS_DEVICE_FLOW,
    }),
};

function isRetryableFailure(response) {
  return response.networkError || response.status >= 500;
}

function realSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms).unref?.());
}

export function createApiKeyFlow({
  apiOrigin,
  onApiKey,
  fetchImpl = globalThis.fetch,
  sleep = realSleep,
  now = Date.now,
  label = `${hostname()}-mcp`,
  pollTimeoutMs = POLL_TIMEOUT_MS,
  waitOnRecallMs = WAIT_ON_RECALL_MS,
  upstreamRetryMs = UPSTREAM_RETRY_MS,
}) {
  let state = { status: "idle" };

  async function post(path, body) {
    try {
      const res = await fetchImpl(`${apiOrigin}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      let parsed = null;
      try {
        parsed = await res.json();
      } catch {
        parsed = null;
      }
      const retryAfter = Number(res.headers?.get?.("retry-after"));
      return {
        status: res.status,
        ok: res.ok,
        body: parsed && typeof parsed === "object" ? parsed : null,
        requestId: res.headers?.get?.("x-request-id") ?? undefined,
        retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
      };
    } catch {
      return { status: 0, ok: false, body: null, networkError: true };
    }
  }

  async function poll(code) {
    const deadline = now() + Math.min(pollTimeoutMs, code.expiresInMs);
    let intervalMs = code.intervalMs;
    let failedOnce = false;
    let lostResponse = false;
    while (true) {
      await sleep(intervalMs);
      if (now() >= deadline) return { kind: "timeout" };
      const res = await post("/v1/auth/agent/token", {
        client_id: CLIENT_ID,
        agent_code: code.agentCode,
        grant_type: GRANT_TYPE,
      });
      if (res.networkError) lostResponse = true;
      if (isRetryableFailure(res)) {
        if (failedOnce) return { kind: "upstream", response: res };
        failedOnce = true;
        await sleep(upstreamRetryMs);
        continue;
      }
      failedOnce = false;
      const apiKey = res.body?.api_key;
      if (res.ok && typeof apiKey === "string" && apiKey) {
        onApiKey(apiKey);
        return { kind: "approved" };
      }
      const error = res.body?.error;
      if (error === "authorization_pending") continue;
      if (error === "slow_down") {
        intervalMs += 5_000;
        continue;
      }
      if (error === "expired_token") return { kind: lostResponse ? "expired_after_network_error" : error };
      if (error === "access_denied") return { kind: error };
      if (res.status === 429) {
        await sleep(res.retryAfterMs ?? intervalMs);
        continue;
      }
      return { kind: "rejected", response: res };
    }
  }

  function pendingText(code, lead) {
    return text([
      lead,
      `Open: ${code.verificationUri}`,
      `Code: ${code.userCode}`,
      "Show your user this link and code and ask them to approve. The link expires in 10 minutes.",
      "After they approve, this session uses the new key for every search and fetch. Call get_api_key again to check.",
    ]);
  }

  function report(outcome) {
    switch (outcome.kind) {
      case "approved":
        return activeText("Keenable: your user approved.");
      case "upstream":
        return upstreamError(outcome.response);
      case "rejected":
        return rejectedError(outcome.response, "approval check");
      default:
        return OUTCOMES[outcome.kind]({ label });
    }
  }

  function activeText(lead) {
    return text([
      lead,
      "This session now uses its own Keenable API key for every search and fetch, so the keyless hourly cap no longer applies.",
    ]);
  }

  async function start() {
    const res = await post("/v1/auth/agent/code", { client_id: CLIENT_ID, label });
    if (isRetryableFailure(res)) return upstreamError(res);
    const body = res.body;
    if (!res.ok || typeof body?.agent_code !== "string" || typeof body?.verification_uri !== "string") {
      return res.ok ? upstreamError(res) : rejectedError(res, "request for an approval code");
    }
    const code = {
      agentCode: body.agent_code,
      userCode: body.user_code,
      verificationUri: body.verification_uri,
      intervalMs: Math.max(1, Number(body.interval) || 5) * 1000,
      expiresInMs: Math.max(1, Number(body.expires_in) || 600) * 1000,
    };
    const pending = { status: "pending", code };
    pending.done = poll(code).then(
      (outcome) => {
        if (state !== pending) return outcome;
        state = outcome.kind === "approved" ? { status: "active" } : { status: "settled", outcome };
        return outcome;
      },
      () => {
        const outcome = { kind: "upstream", response: { status: 0 } };
        if (state === pending) state = { status: "settled", outcome };
        return outcome;
      },
    );
    state = pending;
    return pendingText(code, "Keenable: your user needs to approve an API key for this session.");
  }

  async function call() {
    if (state.status === "active") {
      return activeText("Keenable: this session already has an API key. Nothing to do.");
    }
    if (state.status === "settled") {
      const { outcome } = state;
      state = { status: "idle" };
      return report(outcome);
    }
    if (state.status === "pending") {
      const pending = state;
      const outcome = await Promise.race([pending.done, sleep(waitOnRecallMs).then(() => null)]);
      if (!outcome) {
        return pendingText(pending.code, "Keenable: still waiting for your user to approve.");
      }
      if (state.status === "settled") state = { status: "idle" };
      return report(outcome);
    }
    return start();
  }

  return { call, get status() { return state.status; }, get settled() { return state.done ?? Promise.resolve(); } };
}
