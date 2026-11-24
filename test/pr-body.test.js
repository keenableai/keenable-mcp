import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkPrBody, checkReleaseNotes, parseSections } from "../scripts/pr-body.mjs";

const template = readFileSync(new URL("../.github/pull_request_template.md", import.meta.url), "utf8");

const good = `## Why
Codex users in CI call fetch_page_content with a single url and get a schema error since #45 (KEE-1600, 14 transcripts).

## Hypothesis
We believe accepting url again for Codex in CI will stop the schema errors.
We'll know we're right when argument errors on fetch_page_content drop below 0.5% of calls for a week.
We'll know we're wrong when argument errors stay above 2% or search task success on the agent slice drops.

## Evidence
Measured: tool-ab run https://example.test/runs/123 on base and head, 300 tasks, 3 model families.

## Risk and rollback
Clients that send both url and urls get urls; a revert restores the old schema.
`;

test("the template as shipped fails: every section is still empty", () => {
  const { errors } = checkPrBody({ body: template });
  for (const heading of ["Why", "Hypothesis", "Evidence", "Risk and rollback"]) {
    assert.ok(errors.some((e) => e.includes(`## ${heading}`)), `expected an error for ${heading}: ${errors.join(" | ")}`);
  }
});

test("a filled description passes, with or without the template comments left in", () => {
  assert.deepEqual(checkPrBody({ body: good, files: ["src/tools.js"] }).errors, []);
  assert.deepEqual(checkPrBody({ body: `${template}\n${good}` }).errors, []);
});

test("an empty or missing description fails on every section", () => {
  assert.equal(checkPrBody({ body: "" }).errors.length, 4);
  assert.equal(checkPrBody({ body: null }).errors.length, 4);
});

test("filler answers count as empty", () => {
  const body = good.replace(/## Risk and rollback\n.*\n/, "## Risk and rollback\nN/A\n");
  const { errors } = checkPrBody({ body });
  assert.deepEqual(errors.length, 1);
  assert.match(errors[0], /Risk and rollback" is empty/);
});

test("a hypothesis without a kill criterion fails", () => {
  const body = good.replace(/We'll know we're wrong when.*\n/, "");
  const { errors } = checkPrBody({ body });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /wrong when/);
});

test("placeholders copied out of the template are caught", () => {
  const body = good.replace("We believe accepting url again", "We believe <change>");
  assert.match(checkPrBody({ body }).errors.join(), /placeholder <change>/);
});

test("no-behavior-change skips the hypothesis but still wants evidence", () => {
  const body = good.replace(/## Hypothesis\n[\s\S]*?\n## Evidence/, "## Evidence");
  assert.deepEqual(checkPrBody({ body, labels: ["no-behavior-change"] }).errors, []);
  assert.match(checkPrBody({ body }).errors.join(), /Missing the "## Hypothesis"/);
  const noEvidence = body.replace(/## Evidence\n.*\n/, "");
  assert.match(checkPrBody({ body: noEvidence, labels: ["no-behavior-change"] }).errors.join(), /Missing the "## Evidence"/);
});

test("changes to what agents read need a linked run", () => {
  const body = good.replace(/https:\/\/\S+ /, "");
  assert.deepEqual(checkPrBody({ body, files: ["README.md", "test/x.test.js"] }).errors, []);
  for (const file of ["src/tools.js", "src/metadata.js", "skills/keenable-web-search/SKILL.md"]) {
    const { errors } = checkPrBody({ body, files: [file] });
    assert.equal(errors.length, 1, file);
    assert.match(errors[0], /must link the run/);
  }
});

test("headings match by prefix and case; code fences do not start sections", () => {
  const sections = parseSections("## why / customer\nA\n```\n## Evidence\n```\n### detail\nB");
  assert.deepEqual([...sections.keys()], ["why / customer"]);
  assert.match(sections.get("why / customer"), /### detail\nB/);
});

test("a missing Linear key is a notice, not an error", () => {
  const body = good.replace("KEE-1600, ", "");
  const result = checkPrBody({ body });
  assert.deepEqual(result.errors, []);
  assert.equal(result.notices.length, 1);
  assert.equal(checkPrBody({ body, branch: "kee-1600-fix".toUpperCase() }).notices.length, 0);
});

const notes = `## What changes for users
fetch_page_content accepts url again next to urls, so agents that send one URL stop getting a schema error.

## Evidence
Ran as 0.1.3-beta.1 on next for a week: https://example.test/runs/456, argument errors 0.2% (was 3.1%).

## Rollback
npm dist-tag add @keenable/mcp@0.1.2 latest; users who pinned 0.1.3 keep it.
`;

test("stable release notes need what changes, linked evidence and a rollback", () => {
  assert.deepEqual(checkReleaseNotes({ body: notes }).errors, []);
  assert.equal(checkReleaseNotes({ body: "" }).errors.length, 3);
  assert.equal(checkReleaseNotes({ body: "Bug fixes." }).errors.length, 3);
  const unlinked = checkReleaseNotes({ body: notes.replace(/https:\/\/\S+, /, "") }).errors;
  assert.equal(unlinked.length, 1);
  assert.match(unlinked[0], /Evidence" must link/);
});

test("a prerelease only needs what changes for users", () => {
  const body = notes.split("## Evidence")[0];
  assert.deepEqual(checkReleaseNotes({ body, prerelease: true }).errors, []);
  assert.equal(checkReleaseNotes({ body }).errors.length, 2);
  assert.equal(checkReleaseNotes({ body: "", prerelease: true }).errors.length, 1);
});
