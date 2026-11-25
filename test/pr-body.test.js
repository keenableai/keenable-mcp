// Same cases as keenableai/ci-workflows/test/pr-body.test.mjs, run against the
// verbatim copy in scripts/pr-description/ and this repo's template.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkPrBody, checkReleaseNotes, compilePathPatterns, parseSections } from "../scripts/pr-description/pr-body.mjs";

const template = readFileSync(new URL("../.github/pull_request_template.md", import.meta.url), "utf8");
const SECTIONS = ["What", "Why", "Hypothesis", "Checks", "Risk and rollback", "Follow-up"];
const AGENT_FACING = "src/tools.js\nsrc/mcp-server/\nopenapi.json\n# a comment\nskills/**/SKILL.md\n";

const good = `## What
fetch_page_content accepts url again next to urls.

## Why
Codex users in CI call fetch_page_content with a single url and get a schema error since #45 (KEE-1600, 14 transcripts).

## Hypothesis
We believe accepting url again for Codex in CI will stop the schema errors.
We'll know we're right when argument errors on fetch_page_content drop below 0.5% of calls for a week.
We'll know we're wrong when argument errors stay above 2% or search task success on the agent slice drops.

## Checks
Measured: tool-ab run https://example.test/runs/123 on base and head, 300 tasks, 3 model families.

## Risk and rollback
Clients that send both url and urls get urls; a revert restores the old schema.

## Follow-up
MCP tool error panel in Grafana on 2026-12-08, one week after deploy.
`;

test("the template as shipped fails on every section", () => {
  const { errors } = checkPrBody({ body: template });
  for (const heading of SECTIONS) {
    assert.ok(errors.some((e) => e.includes(`## ${heading}`)), `expected an error for ${heading}: ${errors.join(" | ")}`);
  }
});

test("a filled description passes, with or without the template comments left in", () => {
  assert.deepEqual(checkPrBody({ body: good, files: ["src/tools.js"], agentFacingPaths: AGENT_FACING }).errors, []);
  assert.deepEqual(checkPrBody({ body: `${template}\n${good}` }).errors, []);
});

test("an empty or missing description fails on every section", () => {
  assert.equal(checkPrBody({ body: "" }).errors.length, SECTIONS.length);
  assert.equal(checkPrBody({ body: null }).errors.length, SECTIONS.length);
});

test("filler answers count as empty", () => {
  const { errors } = checkPrBody({ body: good.replace(/## Risk and rollback\n.*\n/, "## Risk and rollback\nN/A\n") });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Risk and rollback" is empty/);
});

test("follow-up accepts a reasoned none but not a bare one", () => {
  const reasoned = good.replace(/## Follow-up\n.*\n/, "## Follow-up\nNone, because the flag is off until the launch PR.\n");
  assert.deepEqual(checkPrBody({ body: reasoned }).errors, []);
  const bare = good.replace(/## Follow-up\n.*\n/, "## Follow-up\nNone\n");
  assert.match(checkPrBody({ body: bare }).errors.join(), /Follow-up" is empty/);
});

test("a hypothesis without a kill criterion fails", () => {
  const { errors } = checkPrBody({ body: good.replace(/We'll know we're wrong when.*\n/, "") });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /wrong when/);
});

test("placeholders copied out of the template are caught", () => {
  const body = good.replace("We believe accepting url again", "We believe <change>");
  assert.match(checkPrBody({ body }).errors.join(), /placeholder <change>/);
});

test("no-behavior-change skips hypothesis and follow-up but still wants evidence", () => {
  const body = good.replace(/## Hypothesis\n[\s\S]*?\n## Checks/, "## Checks").replace(/## Follow-up\n.*\n/, "");
  assert.deepEqual(checkPrBody({ body, labels: ["no-behavior-change"] }).errors, []);
  assert.match(checkPrBody({ body }).errors.join(), /Missing the "## Hypothesis"/);
  assert.match(checkPrBody({ body }).errors.join(), /Missing the "## Follow-up"/);
  const noEvidence = body.replace(/## Checks\n.*\n/, "");
  assert.match(checkPrBody({ body: noEvidence, labels: ["no-behavior-change"] }).errors.join(), /Missing the "## Checks"/);
});

test("agent-facing changes need a linked run", () => {
  const body = good.replace(/https:\/\/\S+ /, "");
  const check = (files) => checkPrBody({ body, files, agentFacingPaths: AGENT_FACING }).errors;
  assert.deepEqual(check(["README.md", "src/tools.json", "skills/x/README.md"]), []);
  for (const file of ["src/tools.js", "src/mcp-server/a/b.ts", "openapi.json", "skills/web/SKILL.md"]) {
    const errors = check([file]);
    assert.equal(errors.length, 1, file);
    assert.match(errors[0], /must link the run/);
  }
  assert.deepEqual(checkPrBody({ body, files: ["src/tools.js"] }).errors, [], "no patterns, no requirement");
});

test("path patterns: prefix, single and double star, regex characters are literal", () => {
  const [prefix, star, double, literal] = compilePathPatterns("src/\n*.json\na/**/z.md\nfile+(1).txt");
  assert.ok(prefix.test("src/a/b.ts") && !prefix.test("srcx/a"));
  assert.ok(star.test("openapi.json") && !star.test("docs/openapi.json"));
  assert.ok(double.test("a/b/c/z.md") && !double.test("b/z.md"));
  assert.ok(literal.test("file+(1).txt") && !literal.test("fileee(1).txt"));
  assert.deepEqual(compilePathPatterns(""), []);
});

test("the headings people already use count: Evidence, Tests, Rollback note", () => {
  const body = good
    .replace("## Checks", "## Tests")
    .replace("## Risk and rollback", "## Rollback note")
    .replace("## Hypothesis", "## Expected effect");
  assert.deepEqual(checkPrBody({ body }).errors, []);
  assert.deepEqual(checkPrBody({ body: good.replace("## Checks", "## Evidence") }).errors, []);
});

test("UI changes get a screenshot suggestion, never a missing-section warning", () => {
  const ui = { files: ["src/components/Hero.tsx"], visualPaths: "src/components/\nsrc/**/*.css" };
  const bare = checkPrBody({ body: good, ...ui });
  assert.deepEqual(bare.errors, []);
  assert.ok(bare.notices.some((n) => /Screenshots help the reviewer/.test(n)));
  const words = checkPrBody({ body: `${good}\n## Screenshots\nLooks the same as before.\n`, ...ui });
  assert.ok(words.notices.some((n) => /Screenshots help/.test(n)));
  for (const shot of [
    "![after](https://github.com/user-attachments/assets/abc123)",
    '<img width="600" src="https://github.com/user-attachments/assets/abc123">',
    "Before and after: docs/pr-screenshots/696/after-desktop.png",
    "Recording: https://example.test/demo.mp4",
  ]) {
    const r = checkPrBody({ body: `${good}\n## Screenshots\n${shot}\n`, ...ui });
    assert.ok(!r.notices.some((n) => /Screenshots help/.test(n)), shot);
  }
  const server = checkPrBody({ body: good, files: ["src/server.ts"], visualPaths: ui.visualPaths });
  assert.ok(!server.notices.some((n) => /Screenshots help/.test(n)));
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
  assert.equal(checkPrBody({ body, branch: "KEE-1600-fix" }).notices.length, 0);
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
