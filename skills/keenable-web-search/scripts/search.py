#!/usr/bin/env python3
"""Keenable web search — keyless, no dependencies (Python stdlib only).

Usage:
  python3 search.py "your query" [--site arxiv.org]
                     [--include-domain DOMAIN ...] [--exclude-domain DOMAIN ...]
                     [--published-after YYYY-MM-DD] [--published-before YYYY-MM-DD]
                     [--acquired-after YYYY-MM-DD] [--acquired-before YYYY-MM-DD]
                     [--json]

--include-domain / --exclude-domain are repeatable and accept comma-separated
lists (e.g. --include-domain press.un.org,undocs.org --include-domain .gov).
They are sent as the include_domains / exclude_domains arrays: results come only
from the included domains and never from the excluded ones (exclude wins).
Entries may be a host (example.com, also matches subdomains), a host with a
path prefix (example.com/docs), or a suffix (.gov). --site is a single-domain
alias and cannot be combined with --include-domain.

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
    "include_domains",
    "exclude_domains",
    "published_after",
    "published_before",
    "acquired_after",
    "acquired_before",
)


def split_domains(values):
    """Flatten repeated / comma-separated domain flags into one list.

    ``values`` is what argparse collects for a repeatable flag (``None`` or a
    list of raw strings). Each string may hold several comma-separated entries.
    Whitespace around entries and empty pieces (e.g. a trailing comma) are
    dropped; exact duplicates are removed while keeping order. Normalization
    and validation (www., case, punycode, rejected forms) happen server-side.
    """
    out = []
    for raw in values or ():
        for part in raw.split(","):
            entry = part.strip()
            if entry and entry not in out:
                out.append(entry)
    return out


def build_payload(query, **filters):
    """Build the JSON body for POST /v1/search/public.

    Only filters with a value are sent; empty domain lists are omitted (the API
    rejects ``include_domains: []``).
    """
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
    """Render a search response as numbered plain text.

    A response ``warning`` (e.g. the domain filter removed results, or inline
    ``site:`` tokens were dropped because include_domains was set) is printed
    first as a ``Note:`` line, also when no results are left, so the signal is
    not lost outside ``--json``.
    """
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
    """Parse CLI args; returns (args, include_domains, exclude_domains)."""
    p = argparse.ArgumentParser(description="Keenable web search (keyless)")
    p.add_argument("query", nargs="+", help="Natural-language search query")
    p.add_argument("--site", help="Restrict to one site, e.g. arxiv.org")
    p.add_argument(
        "--include-domain",
        dest="include_domain",
        action="append",
        metavar="DOMAIN",
        help="Only return results from these domains. Repeatable; comma lists OK "
        "(e.g. press.un.org,undocs.org or .gov). Not combinable with --site.",
    )
    p.add_argument(
        "--exclude-domain",
        dest="exclude_domain",
        action="append",
        metavar="DOMAIN",
        help="Never return results from these domains. Repeatable; comma lists OK.",
    )
    p.add_argument("--published-after", dest="published_after", help="YYYY-MM-DD")
    p.add_argument("--published-before", dest="published_before", help="YYYY-MM-DD")
    p.add_argument("--acquired-after", dest="acquired_after", help="YYYY-MM-DD")
    p.add_argument("--acquired-before", dest="acquired_before", help="YYYY-MM-DD")
    p.add_argument("-j", "--json", action="store_true", help="Output raw JSON")
    args = p.parse_args(argv)

    include_domains = split_domains(args.include_domain)
    exclude_domains = split_domains(args.exclude_domain)
    if args.site and include_domains:
        p.error("--site cannot be combined with --include-domain; "
                "add the site to --include-domain instead")
    if args.include_domain is not None and not include_domains:
        p.error("--include-domain needs at least one domain")
    return args, include_domains, exclude_domains


def main(argv=None):
    args, include_domains, exclude_domains = parse_args(argv)
    data = search(
        " ".join(args.query),
        site=args.site,
        include_domains=include_domains,
        exclude_domains=exclude_domains,
        published_after=args.published_after,
        published_before=args.published_before,
        acquired_after=args.acquired_after,
        acquired_before=args.acquired_before,
    )
    print(json.dumps(data, ensure_ascii=False, indent=2) if args.json else format_results(data))


if __name__ == "__main__":
    main()
