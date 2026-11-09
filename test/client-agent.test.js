import { test } from "node:test";
import assert from "node:assert/strict";
import { bridgeUserAgent } from "../src/client-agent.js";

test("names only the bridge before the host's handshake", () => {
  assert.equal(bridgeUserAgent("0.1.1"), "keenable-mcp/0.1.1");
  assert.equal(bridgeUserAgent("0.1.1", {}), "keenable-mcp/0.1.1");
});

test("appends the host's name and version", () => {
  assert.equal(bridgeUserAgent("0.1.1", { name: "claude-ai", version: "0.1.0" }), "keenable-mcp/0.1.1 (claude-ai/0.1.0)");
  assert.equal(bridgeUserAgent("0.1.1", { name: "cursor-vscode" }), "keenable-mcp/0.1.1 (cursor-vscode)");
});

test("reduces whatever the host sends to a short, header-safe token", () => {
  const ua = bridgeUserAgent("0.1.1", { name: "Evil Client\r\nX-API-Key: x", version: "1 (2)" });
  assert.equal(ua, "keenable-mcp/0.1.1 (Evil-Client-X-API-Key-x/1-2-)");
  assert.ok(!/[\r\n]/.test(ua));
  assert.ok(bridgeUserAgent("1", { name: "a".repeat(500) }).length < 100);
});
