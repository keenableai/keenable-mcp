---
name: keenable-web-search
version: "1.1.0"
description: "Keyless live web search via Keenable. Use when the user needs current, citable information from the web — news, research, docs, or any page beyond the model's training data. Runs a bundled Python script (stdlib only, no API key, no install). NOT for local file operations or non-web tasks."
license: MIT
repository: https://github.com/keenableai/keenable-mcp
homepage: https://keenable.ai
triggers:
  - keenable
  - web search
  - search the web
  - news
  - research
metadata:
  openclaw:
    emoji: "🔎"
    tags:
      - search
      - web
      - research
      - news
      - keyless
---

# Keenable Web Search 🔎

Live web search that works with **no API key and no install** — a small bundled
Python script (standard library only) calls Keenable's keyless public endpoint
and returns ranked results with titles, URLs, and snippets.

## Usage

Run the bundled script with a natural-language query (describe the ideal page,
not bare keywords):

```bash
python3 scripts/search.py "official changelog for the EU AI Act 2025 amendments"
```

Snippets are starting points. Open the most relevant URL (e.g. with the agent's
web-fetch tool) before relying on a claim, and cite the source.

### Options

| Flag | What it does |
|------|-------------|
| `--mode pro` | Default. Higher-quality ranking — best for research and accuracy. |
| `--mode realtime` | Lowest latency (~0.4s vs ~1.5s) — best for quick, latency-sensitive lookups. |
| `--site <domain>` | Restrict to one site, e.g. `--site arxiv.org`. |
| `--published-after` / `--published-before` | `YYYY-MM-DD` bounds on publish date — for time-sensitive topics. |
| `--acquired-after` / `--acquired-before` | `YYYY-MM-DD` bounds on when the page was indexed. |
| `--json` | Raw JSON instead of formatted text. |

### Examples

```bash
# Latest news, fastest mode
python3 scripts/search.py "latest OpenAI model announcements" --mode realtime

# Research papers from one site, recent only
python3 scripts/search.py "diffusion models for inverse problems" \
  --site arxiv.org --published-after 2025-01-01

# Machine-readable output
python3 scripts/search.py "EU AI Act timeline" --json
```

## Notes

- **Keyless.** The script calls the public endpoint and tags traffic with an
  `X-Keenable-Title` header; no signup or key is required. The endpoint is
  rate-limited — on a `429` the script tells you to retry shortly.
- **No dependencies.** Pure Python standard library (`urllib`), so it runs
  anywhere Python 3 is available — nothing to `pip install`.
- More about Keenable: [keenable.ai](https://keenable.ai).
