# Keenable MCP

MCP server for live web search and clean-markdown page fetch over the Keenable web index. See `README.md` for setup and how the bridge to the hosted server works.

## Public Docs and SDK

Every user-facing change ships with its docs. A change is user-facing when it alters a tool, a tool parameter or description, the server instructions, a response shape, an install or client config, or an error message.

- **Docs:** update [keenable-external-docs](https://github.com/keenableai/keenable-external-docs) in the same change set: open a docs PR alongside this one and link it in the description.
- **SDK:** if the change touches the API surface the SDKs wrap, also update [keenable-sdk](https://github.com/keenableai/keenable-sdk) (Python, TypeScript and Go), or open an issue there when it can't land in the same change set.
- **Docs reference the SDKs.** Code examples use the official SDKs, with the HTTP API (curl) shown next to them. If the docs describe something the SDK can't do, that's an SDK gap: fix it or file an issue.
- **If it isn't in the public docs, it doesn't exist in the product.** Don't ship an undocumented user-facing feature: document it, or remove it.

## TypeScript

Write new code in TypeScript when the repository can run it. This package is plain ESM JavaScript today with no build step: `npx` runs `src/index.js` as shipped. So, until it gets a `tsc` build:

- Keep new files under `src/` and `test/` as `.js`, matching the runtime, and say in the PR that the code would be `.ts` with a build step.
- Don't add a TypeScript file that nothing compiles, and don't add `// @ts-nocheck` or JSDoc-only typing as a substitute.
- The migration is its own change: convert `src/` and `test/`, compile to `dist/`, point `bin` and `files` at `dist/`, and keep the CI matrix (Node 18/20/22, oldest accepted MCP SDK).

In the other Keenable repositories that already compile TypeScript (keenable-backend-ts, keenable-landing), new code is always `.ts`/`.tsx`.

## Pull request descriptions and releases

Fill the sections of `.github/pull_request_template.md`. `pr-body-lint` points out what's missing and never blocks; its checker in `scripts/pr-description/` is a verbatim copy of `keenableai/ci-workflows/pr-description/` (change it there, then re-copy).

- **What** changes, and **Why**: who it is for (a named agent segment or customer) and what shows the problem.
- **Hypothesis:** "We believe … for … will result in …", plus "we'll know we're right when …" and "we'll know we're wrong when …", each with a metric and threshold.
- **Checks:** what you ran and what it showed, each claim marked measured, inferred or guess. A change to `src/tools.js`, `src/metadata.js` or `skills/` links a run: agents of several model families (Claude, a GPT/Codex model, an open model via OpenRouter) on the same tasks on base and head, compared on what they do, plus a second-opinion review from another model family.
- **Docs**, **Risk and rollback**, and **Follow-up** (where you will look after it ships and when; "None, because …" is an answer).

With the `no-behavior-change` label, Hypothesis and Follow-up can be left out. The guide to measuring is `MEASURING.md` in `keenableai/ci-workflows/pr-description/`.

A release reaches every user and can't be taken back, so `publish-npm.yml` checks the release notes and blocks without What changes for users, Evidence (with a link) and Rollback. See "Releasing" in `README.md`. Ship risky changes as a prerelease on `next` first.
