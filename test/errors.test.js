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

test("describeError keeps the server's code, fix and retry decision", () => {
  const body = {
    error: "Page too long for a prompt",
    message: "The page is too long to run a prompt over.",
    code: "prompt_input_too_long",
    fix: "Fetch it without prompt.",
    retryable: false,
  };
  const err = new Error(`Error POSTing to endpoint (HTTP 422): ${JSON.stringify(body)}`);
  assert.equal(
    describeError(err),
    "The page is too long to run a prompt over. (prompt_input_too_long) Fix: Fetch it without prompt. Retryable: no",
  );
  const retryable = new Error(JSON.stringify({ message: "Try again.", retryable: true }));
  assert.equal(describeError(retryable), "Try again. Retryable: yes");
});
