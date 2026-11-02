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
    const data = body
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .find((d) => d.includes('"result"') || d.includes('"error"'));
    if (!data) throw new Error(`no data event in SSE response: ${body.slice(0, 500)}`);
    msg = JSON.parse(data);
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
  live = await liveTools();
} catch (err) {
  console.error(`check-discovery: could not read tools/list from ${URL_}`);
  console.error(`  ${err.message}`);
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
