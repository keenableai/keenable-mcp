#!/usr/bin/env node
// Checks a pull request description against .github/pull_request_template.md,
// or with --release, the notes of a GitHub Release before it is published.
// pr-body-lint.yml runs it from the base branch, never from the PR, so a PR
// cannot loosen the rules it is judged by. Dependency-free.
//
// Inputs (environment):
//   PR_BODY_FILE   file holding the description (or the release notes)
//   PR_FILES_FILE  file with one changed path per line
//   PR_LABELS      JSON array of label names
//   PR_TITLE, PR_BRANCH
//   PRERELEASE     "true" for a prerelease (--release only)
//
// Local use:
//   PR_BODY_FILE=body.md node scripts/check-pr-body.mjs
//   PR_BODY_FILE=notes.md node scripts/check-pr-body.mjs --release
import { appendFileSync, readFileSync } from "node:fs";
import { checkPrBody, checkReleaseNotes } from "./pr-body.mjs";

function readLines(path) {
  if (!path) return [];
  return readFileSync(path, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
}

function parseLabels(raw) {
  if (!raw) return [];
  try {
    const labels = JSON.parse(raw);
    return Array.isArray(labels) ? labels.map(String) : [];
  } catch {
    return raw.split("\n").map((l) => l.trim()).filter(Boolean);
  }
}

const release = process.argv.includes("--release");
const body = process.env.PR_BODY_FILE ? readFileSync(process.env.PR_BODY_FILE, "utf8") : "";
const what = release ? "Release notes" : "PR description";
const { errors, notices } = release
  ? checkReleaseNotes({ body, prerelease: process.env.PRERELEASE === "true" })
  : checkPrBody({
      body,
      title: process.env.PR_TITLE ?? "",
      branch: process.env.PR_BRANCH ?? "",
      labels: parseLabels(process.env.PR_LABELS),
      files: readLines(process.env.PR_FILES_FILE),
    });

// Workflow commands are line-based: a newline in a message would end it early.
const oneLine = (s) => s.replace(/\r?\n/g, " ");
for (const e of errors) console.log(`::error title=${what}::${oneLine(e)}`);
for (const n of notices) console.log(`::notice title=${what}::${oneLine(n)}`);

const summary = [
  errors.length ? `## ${what}: needs changes` : `## ${what}: OK`,
  "",
  ...errors.map((e) => `- ❌ ${e}`),
  ...notices.map((n) => `- ℹ️ ${n}`),
  "",
  errors.length
    ? release
      ? "Edit the release notes, then re-run this workflow. The sections are in the Releasing part of README.md."
      : "Edit the PR description; this check re-runs on every edit. The sections are in `.github/pull_request_template.md`."
    : "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
else console.log(summary);

process.exit(errors.length ? 1 : 0);
