#!/usr/bin/env python3
"""Keenable web search — keyless, no dependencies (Python stdlib only).

Usage:
  python3 search.py "your query" [--mode pro|realtime] [--site arxiv.org]
                     [--published-after YYYY-MM-DD] [--published-before YYYY-MM-DD]
                     [--acquired-after YYYY-MM-DD] [--acquired-before YYYY-MM-DD]
                     [--json]

Hits the keyless public endpoint — no API key or signup required. Use
--mode realtime for the lowest latency, --mode pro (default) for higher quality.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

SEARCH_URL = "https://api.keenable.ai/v1/search/public"
APP_TITLE = "OpenClaw Skill"  # attribution tag for keyless traffic (X-Keenable-Title)

_PARAMS = ("site", "published_after", "published_before", "acquired_after", "acquired_before")


def search(query, mode="pro", **filters):
    payload = {"query": query, "mode": mode}
    for k in _PARAMS:
        if filters.get(k):
            payload[k] = filters[k]

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
    results = data.get("results", [])
    if not results:
        return "No results."
    out = []
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


def main():
    p = argparse.ArgumentParser(description="Keenable web search (keyless)")
    p.add_argument("query", nargs="+", help="Natural-language search query")
    p.add_argument("--mode", default="pro", choices=["pro", "realtime"],
                   help="pro (default, higher quality) or realtime (lowest latency)")
    p.add_argument("--site", help="Restrict to one site, e.g. arxiv.org")
    p.add_argument("--published-after", dest="published_after", help="YYYY-MM-DD")
    p.add_argument("--published-before", dest="published_before", help="YYYY-MM-DD")
    p.add_argument("--acquired-after", dest="acquired_after", help="YYYY-MM-DD")
    p.add_argument("--acquired-before", dest="acquired_before", help="YYYY-MM-DD")
    p.add_argument("-j", "--json", action="store_true", help="Output raw JSON")
    args = p.parse_args()

    data = search(
        " ".join(args.query),
        mode=args.mode,
        site=args.site,
        published_after=args.published_after,
        published_before=args.published_before,
        acquired_after=args.acquired_after,
        acquired_before=args.acquired_before,
    )
    print(json.dumps(data, ensure_ascii=False, indent=2) if args.json else format_results(data))


if __name__ == "__main__":
    main()
