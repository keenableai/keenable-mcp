// Anonymous client ID for keyless use. The hosted server issues an opaque
// token in the `X-Keenable-Client` response header; the bridge sends it back
// on later requests and keeps it in a file the Keenable SDKs share, so one
// machine keeps one ID. It is not a credential and is never parsed here.

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";

export const CLIENT_ID_HEADER = "X-Keenable-Client";

const VALID = /^[A-Za-z0-9._-]{1,128}$/;

// The token when it is one the server could have issued, otherwise undefined.
export function validClientId(value) {
  return typeof value === "string" && VALID.test(value) ? value : undefined;
}

// Only used without an API key, and never when KEENABLE_NO_CLIENT_ID is set.
export function clientIdEnabled(env, apiKey) {
  return !apiKey && !env.KEENABLE_NO_CLIENT_ID;
}

// <config dir>/keenable/client-id, or undefined when no directory can be
// named. A relative XDG_CONFIG_HOME is ignored, as the XDG spec says.
export function clientIdPath(env = process.env, platform = process.platform, home = homedir) {
  const p = platform === "win32" ? path.win32 : path.posix;
  const absolute = (dir) => (typeof dir === "string" && p.isAbsolute(dir) ? dir : undefined);
  const under = (...parts) => {
    let dir;
    try {
      dir = absolute(typeof home === "function" ? home() : home);
    } catch {}
    return dir && p.join(dir, ...parts);
  };
  const configDir =
    absolute(env.XDG_CONFIG_HOME) ??
    (platform === "win32" ? absolute(env.APPDATA) ?? under("AppData", "Roaming") : under(".config"));
  return configDir ? p.join(configDir, "keenable", "client-id") : undefined;
}

// A missing, unreadable or malformed file is the same as no ID.
export function loadClientId(file) {
  if (!file) return undefined;
  try {
    return validClientId(readFileSync(file, "utf8").trim());
  } catch {
    return undefined;
  }
}

// Written to a temp file and renamed, so a reader never sees half a token.
// Returns whether it was saved; a failure (read-only home, sandbox) is not
// reported, the caller just keeps the ID in memory.
export function saveClientId(file, id) {
  if (!file || !validClientId(id)) return false;
  const dir = path.dirname(file);
  const temp = path.join(dir, `.client-id.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(temp, `${id}\n`, { mode: 0o600, flag: "wx" });
    renameSync(temp, file);
    return true;
  } catch {
    try {
      rmSync(temp, { force: true });
    } catch {}
    return false;
  }
}

// Wraps a fetch so `onClientId` gets each valid ID a response from `origin`
// carries. The response itself is returned untouched.
export function captureClientId(fetchFn, origin, onClientId) {
  return async (...args) => {
    const response = await fetchFn(...args);
    try {
      if (new URL(response.url).origin === origin) {
        const id = validClientId(response.headers.get(CLIENT_ID_HEADER));
        if (id) onClientId(id);
      }
    } catch {}
    return response;
  };
}
