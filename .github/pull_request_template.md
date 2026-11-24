<!--
A check (pr-body-lint) reads this description. Write your answers outside
these comments; the check ignores the comments.
Why the sections exist and how to measure: MEASURING.md in keenableai/ci-workflows.

No behavior change (refactor, tests, CI, docs only)? Add the
`no-behavior-change` label and leave Hypothesis and Follow-up empty.
Evidence is still required.
-->

## Why

<!--
Who is this for, and what problem do they have? Name a customer or an agent
segment ("Claude Code users looking up docs", "Codex in CI", "open-source
agents via OpenRouter"). Link what shows the problem: Linear issue (KEE-123),
support ticket, transcript, Grafana panel, PostHog insight, failed-fetch report.
-->

## Hypothesis

<!--
We believe <change> for <who> will result in <outcome>.
We'll know we're right when <metric, threshold, where it is measured>.
We'll know we're wrong when <metric or guardrail threshold>. This is the kill criterion.
-->

## Evidence

<!--
What you ran and what it showed, with links. Mark each claim measured,
inferred or guess. Pick what fits the change:

- Eval: the benchmark on base and head (k-rank-eval, keenable-eval,
  keenable-bench, search-gym). Report the paired per-query delta and its
  interval, not two averages. Verdict: better, worse, non-inferior or inconclusive.
- Agents: give Claude, a GPT/Codex model and an open model (via OpenRouter)
  the same tasks on base and head. Compare what they do (tool chosen,
  argument errors, calls per task, task success), not which version they
  say they prefer.
- Second opinion: ask a model from another family (Codex if Claude wrote it,
  and the other way round) to review the diff against the hypothesis. List
  what you acted on and what you dismissed, and why.
- Real calls: hit the API, MCP server or SDK and paste the output.
- Production today: the Grafana panel or PostHog insight that shows the
  current baseline you expect to move.

This section must link a run when the PR changes something agents or API
clients get directly (the repo lists those paths in its pr-body-lint workflow).
-->

## Risk and rollback

<!--
What could break outside the diff, who would notice, and how to undo it.
Is a revert enough, or does a migration, cache, config or published release
outlive it?
-->

## Follow-up

<!--
Where you will look once this ships, and when: a Grafana dashboard
(search-runtime-god, user-analysis-god-dashboard, backend pod health), a
PostHog insight, error tracking, a scheduled eval. Name the date.
"None, because …" is an answer when nothing can be measured.
-->
