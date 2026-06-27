---
name: keenable-web-search
version: "1.1.2"
description: "Web search and research skill. Search the web for current, citable information — news, research papers, documentation, company and market research, fact-checking, and any page beyond the model's training data. Runs a bundled Python script (stdlib only, no API key, no install). NOT for local file operations or non-web tasks."
license: MIT
repository: https://github.com/keenableai/keenable-mcp
homepage: https://keenable.ai
triggers:
  - keenable
  - web search
  - search the web
  - search online
  - look it up
  - find sources
  - research
  - news
metadata:
  openclaw:
    emoji: "🔎"
    tags:
      - search
      - web-search
      - research
      - news
      - keyless
---

# Keenable Web Search 🔎

A web search and research skill. It searches the live web for current,
citable information and returns ranked results with titles, URLs, and
snippets. A small bundled Python script (standard library only) calls
Keenable's keyless public endpoint, so there is **no API key and nothing to
install**.

## What this skill is for

Use it whenever the answer depends on information from the web rather than the
model's training data:

- **Research** — find papers, primary sources, and background on a topic, then
  read the most relevant pages before drawing conclusions.
- **News and current events** — look up recent announcements, releases, and
  developments, with optional date bounds for time-sensitive topics.
- **Fact-checking and citation** — confirm a claim against a primary source and
  cite the URL.
- **Company, product, and market research** — gather references about an
  organization, product, technology, or trend.
- **Documentation lookup** — find official docs, changelogs, and references for
  a library, standard, or API.

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
| `--site <domain>` | Restrict the search to one site, e.g. `--site arxiv.org`. |
| `--published-after` / `--published-before` | `YYYY-MM-DD` bounds on publish date, for time-sensitive research. |
| `--acquired-after` / `--acquired-before` | `YYYY-MM-DD` bounds on when the page was indexed. |
| `--json` | Raw JSON instead of formatted text. |

### Examples

```bash
# News and current events
python3 scripts/search.py "latest OpenAI model announcements"

# Research papers from one site, recent only
python3 scripts/search.py "diffusion models for inverse problems" \
  --site arxiv.org --published-after 2025-01-01

# Documentation lookup
python3 scripts/search.py "Python asyncio TaskGroup reference"

# Machine-readable output for downstream processing
python3 scripts/search.py "EU AI Act timeline" --json
```

## Notes

- **Keyless.** The script calls the public search endpoint and tags traffic with
  an `X-Keenable-Title` header; no signup or key is required. The endpoint is
  rate-limited — on a `429` the script tells you to retry shortly.
- **No dependencies.** Pure Python standard library (`urllib`), so it runs
  anywhere Python 3 is available — nothing to `pip install`.
- More about Keenable: [keenable.ai](https://keenable.ai).
