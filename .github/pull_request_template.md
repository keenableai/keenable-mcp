<!--
pr-body-lint reads this description and points out what's missing. It never
blocks a merge. Comments like this one are guidance: write outside them.
How to measure a change: MEASURING.md in keenableai/ci-workflows.

No behavior change (refactor, tests, CI, docs only)? Add the
`no-behavior-change` label and leave Hypothesis and Follow-up out.
-->

## What

<!-- What changes: a tool, a parameter, a description, the skill, install or client config, the bridge. -->

## Why

<!--
Which agents or clients is this for (Claude Code, Codex, Cursor, a catalog
scanner), and what goes wrong for them today? Link what shows it: a
transcript, a Linear or GitHub issue, MCP usage data.
-->

## Hypothesis

<!--
We believe <change> for <who> will result in <outcome>.
We'll know we're right when <metric, threshold, where it is measured>.
We'll know we're wrong when <metric or guardrail threshold>.
-->

## Checks

<!--
What you ran and what it showed:
- `npm test` (CI runs Node 18/20/22 and the oldest accepted MCP SDK)
- `npm run check:discovery` (src/tools.js against the live tools/list) and `npm run check:version`
- tool description, schema, server instructions or skill changed: give agents
  of several families (Claude, a GPT/Codex model, an open model) the same tasks
  on base and head and compare what they do: tool chosen, argument errors,
  task success. Link the run; required for src/tools.js, src/metadata.js, skills/.
- the bridge run against the hosted server, and its output
Say what you could not run and why.
-->

## Docs

<!--
A tool, parameter, description, server instructions, response shape, install
or client config, or error message changed? Link the keenable-external-docs
PR (and the keenable-sdk PR or issue if the API surface moved). Otherwise say why none is needed.
-->

## Risk and rollback

<!--
What could break for clients, and how to undo it. npx users get a change only
in the next npm release, and a release cannot be taken back: say whether this
should ship as a prerelease on `next` first. Does the hosted server
(keenable-backend-ts) need to change first?
-->

## Follow-up

<!--
Where you will look after it ships, and when: MCP tool usage and error rates,
the discovery-drift job, client reports. "None, because …" is an answer.
-->
