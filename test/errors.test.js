import { test } from "node:test";
import assert from "node:assert/strict";
import { describeError } from "../src/errors.js";

test("adds the network reason that fetch keeps on `cause`", () => {
  const err = new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo"), { code: "ENOTFOUND" }) });
  assert.equal(describeError(err), "fetch failed (ENOTFOUND)");
  assert.equal(describeError(new Error("boom")), "boom");
  assert.equal(describeError("plain"), "plain");
});

test("keeps only the hosted server's message from a rejected request", () => {
  const err = new Error(
    'Streamable HTTP error: Error POSTing to endpoint: {"error":"requires_auth","message":"Malformed API key."}',
  );
  assert.equal(describeError(err), "Malformed API key.");
  assert.equal(describeError(new Error("Error POSTing to endpoint: {not json")), "Error POSTing to endpoint: {not json");
});
