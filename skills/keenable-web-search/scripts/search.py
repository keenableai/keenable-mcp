#!/usr/bin/env python3
"""Keenable web search — keyless, no dependencies (Python stdlib only).

Usage:
  python3 search.py "your query" [--mode {pro,realtime}] [--site arxiv.org]
                     [--published-after WHEN] [--published-before WHEN]
                     [--acquired-after WHEN] [--acquired-before WHEN]
                     [--query-time WHEN] [--max-results N]
                     [--snippet-max-length N] [--json]

WHEN is a YYYY-MM-DD date, an ISO 8601 datetime (2026-09-20T00:00:00Z), or a
relative offset back from now such as 7d or 3mo.

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
    "mode",
    "site",
    "published_after",
    "published_before",
    "acquired_after",
    "acquired_before",
    "query_time",
    "max_results",
    "snippet_max_length",
)

_DATE_HELP = "YYYY-MM-DD, ISO 8601 datetime, or relative offset like 7d / 3mo"


def search(query, **filters):
    payload = {"query": query}
    for k in _PARAMS:
        if filters.get(k) is not None:
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
        try:
            # The API explains bad parameters in "message", e.g.
            # '"max_results": must be an integer between 1 and 50'.
            err = json.loads(body)
            body = err.get("message") or err.get("error") or body
        except (ValueError, AttributeError):
            pass
        sys.exit(f"Search failed (HTTP {e.code}): {body}")
    except urllib.error.URLError as e:
        sys.exit(f"Could not reach Keenable: {e.reason}")


def format_results(data, max_snippet=400):
    results = data.get("results", [])
    if not results:
        return "No results."
    out = []
    for i, r in enumerate(results, 1):
        title = r.get("title") or "Untitled"
        url = r.get("url", "")
        # "snippet" carries the page text; "description" is deprecated and
        # empty, kept only as a fallback for older responses.
        snippet = (r.get("snippet") or r.get("description") or "").replace("\n", " ").strip()
        if len(snippet) > max_snippet:
            snippet = snippet[:max_snippet] + "..."
        out.append(f"{i}. {title}\n   {url}")
        if snippet:
            out.append(f"   {snippet}")
    return "\n".join(out)


def main():
    p = argparse.ArgumentParser(description="Keenable web search (keyless)")
    p.add_argument("query", nargs="+", help="Natural-language search query")
    p.add_argument(
        "--mode",
        choices=("pro", "realtime"),
        default="pro",
        help="pro (default): higher-quality results; realtime: fastest",
    )
    p.add_argument("--site", help="Restrict to one site, e.g. arxiv.org")
    p.add_argument(
        "--published-after",
        dest="published_after",
        metavar="WHEN",
        help=f"Pages published after this time ({_DATE_HELP}). Use this for recent results.",
    )
    p.add_argument(
        "--published-before",
        dest="published_before",
        metavar="WHEN",
        help=f"Pages published before this time ({_DATE_HELP})",
    )
    p.add_argument(
        "--acquired-after",
        dest="acquired_after",
        metavar="WHEN",
        help=f"Pages indexed after this time ({_DATE_HELP})",
    )
    p.add_argument(
        "--acquired-before",
        dest="acquired_before",
        metavar="WHEN",
        help=f"Pages indexed before this time ({_DATE_HELP})",
    )
    p.add_argument(
        "--query-time",
        dest="query_time",
        metavar="WHEN",
        help=(
            "Point-in-time search: an upper bound that searches the web as it stood at this "
            "moment and excludes every newer page. Not a recency filter (7d means as of 7 days "
            f"ago, not the last 7 days); for recent results use --published-after. ({_DATE_HELP}, "
            "or Unix epoch)"
        ),
    )
    p.add_argument(
        "--max-results",
        dest="max_results",
        type=int,
        metavar="N",
        help="Number of results, 1-50 (server default 10)",
    )
    p.add_argument(
        "--snippet-max-length",
        dest="snippet_max_length",
        type=int,
        metavar="N",
        help="Max snippet length per result in characters, 180-10000 (text output shows up to this; default 400)",
    )
    p.add_argument("-j", "--json", action="store_true", help="Output raw JSON")
    args = p.parse_args()

    data = search(
        " ".join(args.query),
        site=args.site,
        published_after=args.published_after,
        published_before=args.published_before,
        acquired_after=args.acquired_after,
        acquired_before=args.acquired_before,
        query_time=args.query_time,
        max_results=args.max_results,
        snippet_max_length=args.snippet_max_length,
        mode=args.mode,
    )
    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print(format_results(data, args.snippet_max_length or 400))


if __name__ == "__main__":
    main()
