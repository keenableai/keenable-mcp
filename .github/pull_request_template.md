<!--
pr-body-lint checks this description against the sections below.
Comments like this one are guidance and the check ignores them; write your
answers outside them. Guide: the "Pull request descriptions" section of CLAUDE.md.

No behavior change (refactor, tests, CI, docs only)? Add the
`no-behavior-change` label and leave Hypothesis empty. Evidence is still required.
-->

## Why

<!--
Who is this for, and what problem do they have? Name a customer or an agent
segment ("Claude Code users looking up docs", "Codex in CI", "open-source agents
via OpenRouter"). Link what shows the problem: Linear issue (KEE-123), ticket,
transcript, query.
-->

## Hypothesis

<!--
We believe <change> for <who> will result in <outcome>.
We'll know we're right when <metric, threshold, benchmark suite>.
We'll know we're wrong when <metric or guardrail threshold>. This is the kill criterion.
-->

## Evidence

<!--
What you ran and what it showed, with links: eval runs on base and head, CI
runs, real calls to the API or MCP server and their output. Mark each claim
measured, inferred or guess.

For a benchmark number: were the judge, models and query sample the same on
both sides? What are the paired per-query delta and its interval? Verdict:
better, worse, non-inferior or inconclusive.

This section must link a run when the PR changes something agents read
directly: tool descriptions or schemas, server instructions, the skill, or
ranking.
-->

## Risk and rollback

<!--
What could break outside the diff, who would notice, and how to undo it
(is a revert enough, or does a migration, config or cache need undoing too?).
-->
