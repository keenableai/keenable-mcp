import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CLIENT_ID_HEADER,
  captureClientId,
  clientIdEnabled,
  clientIdPath,
  loadClientId,
  saveClientId,
  validClientId,
} from "../src/client-id.js";

function tempDir(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "keenable-client-id-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("accepts only tokens of 1 to 128 safe characters", () => {
  assert.equal(validClientId("aZ09._-"), "aZ09._-");
  assert.equal(validClientId("a".repeat(128)), "a".repeat(128));
  for (const bad of ["", "a".repeat(129), "a b", "a/b", "a\n", " a", "é", "a,b", null, undefined, 42]) {
    assert.equal(validClientId(bad), undefined, JSON.stringify(bad));
  }
});

test("is on only without an API key and without the opt-out", () => {
  assert.equal(clientIdEnabled({}, undefined), true);
  assert.equal(clientIdEnabled({ KEENABLE_NO_CLIENT_ID: "" }, ""), true);
  assert.equal(clientIdEnabled({}, "key"), false);
  assert.equal(clientIdEnabled({ KEENABLE_NO_CLIENT_ID: "1" }, undefined), false);
  assert.equal(clientIdEnabled({ KEENABLE_NO_CLIENT_ID: "0" }, undefined), false);
});

test("resolves the file under the platform's config dir", () => {
  assert.equal(clientIdPath({}, "linux", "/home/u"), "/home/u/.config/keenable/client-id");
  assert.equal(clientIdPath({}, "darwin", "/Users/u"), "/Users/u/.config/keenable/client-id");
  assert.equal(clientIdPath({ XDG_CONFIG_HOME: "/x/cfg" }, "linux", "/home/u"), "/x/cfg/keenable/client-id");
  assert.equal(clientIdPath({ XDG_CONFIG_HOME: "rel/cfg" }, "linux", "/home/u"), "/home/u/.config/keenable/client-id");
  assert.equal(clientIdPath({ XDG_CONFIG_HOME: "" }, "linux", "/home/u"), "/home/u/.config/keenable/client-id");
  assert.equal(
    clientIdPath({ APPDATA: "C:\\Users\\u\\AppData\\Roaming" }, "win32", "C:\\Users\\u"),
    "C:\\Users\\u\\AppData\\Roaming\\keenable\\client-id",
  );
  assert.equal(clientIdPath({}, "win32", "C:\\Users\\u"), "C:\\Users\\u\\AppData\\Roaming\\keenable\\client-id");
  assert.equal(
    clientIdPath({ XDG_CONFIG_HOME: "D:\\cfg", APPDATA: "C:\\A" }, "win32", "C:\\Users\\u"),
    "D:\\cfg\\keenable\\client-id",
  );
  // APPDATA is a Windows variable; elsewhere it means nothing.
  assert.equal(clientIdPath({ APPDATA: "/appdata" }, "linux", "/home/u"), "/home/u/.config/keenable/client-id");
});

test("names no file when the home directory is unknown", () => {
  assert.equal(clientIdPath({}, "linux", ""), undefined);
  assert.equal(clientIdPath({}, "win32", () => { throw new Error("no home"); }), undefined);
  assert.equal(clientIdPath({ XDG_CONFIG_HOME: "/x" }, "linux", ""), "/x/keenable/client-id");
});

test("loads a trimmed valid token and nothing else", (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, "client-id");
  assert.equal(loadClientId(file), undefined);
  assert.equal(loadClientId(undefined), undefined);
  assert.equal(loadClientId(dir), undefined);
  writeFileSync(file, "  tok-1.x\r\n");
  assert.equal(loadClientId(file), "tok-1.x");
  for (const bad of ["", "\n", "two lines\nhere", "bad token", "a".repeat(129)]) {
    writeFileSync(file, bad);
    assert.equal(loadClientId(file), undefined, JSON.stringify(bad));
  }
});

test("saves atomically with private modes and replaces the old value", (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, "cfg", "keenable", "client-id");
  assert.equal(saveClientId(file, "first"), true);
  assert.equal(readFileSync(file, "utf8"), "first\n");
  assert.equal(saveClientId(file, "second"), true);
  assert.equal(loadClientId(file), "second");
  assert.deepEqual(readdirSync(path.dirname(file)), ["client-id"]);
  if (process.platform !== "win32") {
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.equal(statSync(path.dirname(file)).mode & 0o777, 0o700);
  }
});

test("a failed save reports false, throws nothing and leaves no temp file", (t) => {
  const dir = tempDir(t);
  assert.equal(saveClientId(undefined, "tok"), false);
  assert.equal(saveClientId(path.join(dir, "client-id"), "bad token"), false);
  assert.deepEqual(readdirSync(dir), []);

  // The parent is a file, so the directory cannot be created.
  writeFileSync(path.join(dir, "blocker"), "");
  assert.equal(saveClientId(path.join(dir, "blocker", "keenable", "client-id"), "tok"), false);

  // The target is a directory, so the rename fails after the temp file exists.
  const target = path.join(dir, "keenable", "client-id");
  mkdirSync(path.join(target, "child"), { recursive: true });
  assert.equal(saveClientId(target, "tok"), false);
  assert.deepEqual(readdirSync(path.dirname(target)), ["client-id"]);
});

test("a read-only directory is not written to", { skip: process.platform === "win32" || process.getuid?.() === 0 }, (t) => {
  const dir = tempDir(t);
  chmodSync(dir, 0o500);
  t.after(() => {
    try {
      chmodSync(dir, 0o700);
    } catch {}
  });
  assert.equal(saveClientId(path.join(dir, "client-id"), "tok"), false);
  assert.equal(saveClientId(path.join(dir, "keenable", "client-id"), "tok"), false);
});

test("captures a valid ID from the remote's responses only", async () => {
  const response = (url, value) => ({ url, headers: new Headers(value === undefined ? {} : { [CLIENT_ID_HEADER]: value }) });
  const queue = [
    response("https://api.example/mcp", "tok-1"),
    response("https://api.example/mcp", undefined),
    response("https://api.example/mcp", "not valid"),
    response("https://api.example/mcp", "a".repeat(129)),
    response("https://other.example/mcp", "foreign"),
    response("", "no-url"),
    response("https://api.example/other", "tok-2"),
  ];
  const calls = [];
  const captured = [];
  const wrapped = captureClientId(
    async (...args) => {
      calls.push(args);
      return queue[calls.length - 1];
    },
    "https://api.example",
    (id) => captured.push(id),
  );
  for (const expected of queue) assert.equal(await wrapped("u", { method: "POST" }), expected);
  assert.deepEqual(calls[0], ["u", { method: "POST" }]);
  assert.deepEqual(captured, ["tok-1", "tok-2"]);
});

test("a failed fetch still rejects, and a throwing callback does not break the response", async () => {
  await assert.rejects(captureClientId(async () => { throw new Error("offline"); }, "https://a.example", () => {})(), /offline/);
  const res = { url: "https://a.example/", headers: new Headers({ [CLIENT_ID_HEADER]: "tok" }) };
  const wrapped = captureClientId(async () => res, "https://a.example", () => { throw new Error("boom"); });
  assert.equal(await wrapped(), res);
});
