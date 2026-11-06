#!/usr/bin/env python3
"""Keenable web search — keyless, no dependencies (Python stdlib only).

Usage:
  python3 search.py "your query" [--site arxiv.org]
                     [--exclude-domain HOST ...]
                     [--published-after YYYY-MM-DD] [--published-before YYYY-MM-DD]
                     [--acquired-after YYYY-MM-DD] [--acquired-before YYYY-MM-DD]
                     [--json]

Hits the keyless public endpoint — no API key or signup required.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

SEARCH_URL = "https://api.keenable.ai/v1/search/public"
APP_TITLE = "OpenClaw Skill"  # attribution tag for keyless traffic (X-Keenable-Title)

_PARAMS = (
    "site",
    "exclude_domains",
    "published_after",
    "published_before",
    "acquired_after",
    "acquired_before",
)


def split_domains(values):
    out = []
    for raw in values or ():
        for part in raw.split(","):
            entry = part.strip()
            if entry and entry not in out:
                out.append(entry)
    return out


def build_payload(query, **filters):
    payload = {"query": query, "mode": "pro"}
    for k in _PARAMS:
        if filters.get(k):
            payload[k] = filters[k]
    return payload


def search(query, **filters):
    payload = build_payload(query, **filters)

    req = urllib.request.Request(
        SEARCH_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Keenable-Title": APP_TITLE},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        if e.code == 429:
            sys.exit("Rate limited by the public endpoint. Try again shortly.")
        sys.exit(f"Search failed (HTTP {e.code}): {body}")
    except urllib.error.URLError as e:
        sys.exit(f"Could not reach Keenable: {e.reason}")


def format_results(data):
    out = []
    warning = data.get("warning")
    if warning:
        out.append(f"Note: {warning}")
    results = data.get("results", [])
    if not results:
        out.append("No results.")
        return "\n".join(out)
    for i, r in enumerate(results, 1):
        title = r.get("title") or "Untitled"
        url = r.get("url", "")
        snippet = (r.get("snippet") or r.get("description") or "").replace("\n", " ").strip()
        if len(snippet) > 400:
            snippet = snippet[:400] + "..."
        out.append(f"{i}. {title}\n   {url}")
        if snippet:
            out.append(f"   {snippet}")
    return "\n".join(out)


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Keenable web search (keyless)")
    p.add_argument("query", nargs="+", help="Natural-language search query")
    p.add_argument("--site", help="Restrict to one site, e.g. arxiv.org")
    p.add_argument(
        "--exclude-domain",
        dest="exclude_domain",
        action="append",
        metavar="HOST",
        help="Never return results from these hosts and their subdomains. "
        "Repeatable; comma lists OK (e.g. pinterest.com,quora.com). Hosts only: "
        "no paths or .gov suffixes. Up to 1,000 hosts.",
    )
    p.add_argument("--published-after", dest="published_after", help="YYYY-MM-DD")
    p.add_argument("--published-before", dest="published_before", help="YYYY-MM-DD")
    p.add_argument("--acquired-after", dest="acquired_after", help="YYYY-MM-DD")
    p.add_argument("--acquired-before", dest="acquired_before", help="YYYY-MM-DD")
    p.add_argument("-j", "--json", action="store_true", help="Output raw JSON")
    args = p.parse_args(argv)
    return args, split_domains(args.exclude_domain)


def main(argv=None):
    args, exclude_domains = parse_args(argv)
    data = search(
        " ".join(args.query),
        site=args.site,
        exclude_domains=exclude_domains,
        published_after=args.published_after,
        published_before=args.published_before,
        acquired_after=args.acquired_after,
        acquired_before=args.acquired_before,
    )
    print(json.dumps(data, ensure_ascii=False, indent=2) if args.json else format_results(data))


if __name__ == "__main__":
    main()
