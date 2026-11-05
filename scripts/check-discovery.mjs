#!/usr/bin/env node
// Diff the static tool schemas in src/tools.js (served by src/discovery.js to
// catalog scanners) against the hosted server's live `tools/list`.
//
// Exits 0 when they match, 1 on drift (with a per-field diff), 2 when the
// live server could not be read. No dependencies: Node 18+ `fetch` only.
//
//   node scripts/check-discovery.mjs
//   KEENABLE_MCP_URL=https://... node scripts/check-discovery.mjs

import { TOOLS } from "../src/tools.js";

const URL_ =
  process.env.KEENABLE_MCP_URL || "https://api.keenable.ai/mcp?keenable_title=ci";

// Parse an SSE body into its JSON messages. Events are separated by a blank
// line, and one event's payload may span several `data:` lines, which join
// with "\n" (per the SSE spec). Non-JSON events are skipped.
function sseMessages(body) {
  return body
    .split(/\r?\n\r?\n/)
    .map((event) =>
      event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n"),
    )
    .filter(Boolean)
    .flatMap((data) => {
      try {
        return [JSON.parse(data)];
      } catch {
        return [];
      }
    });
}

// A brief outage of the hosted server should not look like drift: retry a
// couple of times before giving up with exit code 2.
async function liveToolsWithRetry(attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await liveTools();
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

async function liveTools() {
  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`);

  // The server may answer as plain JSON or as an SSE stream.
  let msg;
  if ((res.headers.get("content-type") || "").includes("text/event-stream")) {
    msg = sseMessages(body).find((m) => m?.id === 1);
    if (!msg) throw new Error(`no response to request 1 in SSE stream: ${body.slice(0, 500)}`);
  } else {
    msg = JSON.parse(body);
  }
  if (msg.error) throw new Error(`JSON-RPC error: ${JSON.stringify(msg.error)}`);
  if (!Array.isArray(msg.result?.tools)) {
    throw new Error(`unexpected response: ${body.slice(0, 500)}`);
  }
  return msg.result.tools;
}

// Collect differences as "path: expected → actual" lines. Object key order is
// ignored; array order is not (enum order and `required` are compared as-is).
function diff(live, local, path, out) {
  const show = (v) => (v === undefined ? "(missing)" : JSON.stringify(v));
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

  if (isObj(live) && isObj(local)) {
    const keys = new Set([...Object.keys(live), ...Object.keys(local)]);
    for (const k of keys) diff(live[k], local[k], `${path}.${k}`, out);
  } else if (JSON.stringify(live) !== JSON.stringify(local)) {
    out.push(`${path}\n    live:  ${show(live)}\n    local: ${show(local)}`);
  }
}

let live;
try {
  live = await liveToolsWithRetry();
} catch (err) {
  // fetch() reports network failures as "fetch failed"; the cause says why.
  const cause = err.cause?.code || err.cause?.message;
  console.error(`check-discovery: could not read tools/list from ${URL_} (3 attempts)`);
  console.error(`  ${err.message}${cause ? ` (${cause})` : ""}`);
  process.exit(2);
}

const byName = (tools) => Object.fromEntries(tools.map((t) => [t.name, t]));
const liveByName = byName(live);
const localByName = byName(JSON.parse(JSON.stringify(TOOLS)));

const problems = [];
for (const name of new Set([...Object.keys(liveByName), ...Object.keys(localByName)])) {
  if (!localByName[name]) {
    problems.push(`tool "${name}" is served live but missing from src/tools.js`);
  } else if (!liveByName[name]) {
    problems.push(`tool "${name}" is in src/tools.js but no longer served live`);
  } else {
    diff(liveByName[name], localByName[name], name, problems);
  }
}

if (problems.length) {
  console.error(
    `src/tools.js has drifted from ${URL_} (${problems.length} difference(s)):\n`,
  );
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "\nUpdate src/tools.js to match the live tools/list, then re-run `npm run check:discovery`.",
  );
  process.exit(1);
}

console.log(`src/tools.js matches ${URL_} (${live.length} tools).`);
