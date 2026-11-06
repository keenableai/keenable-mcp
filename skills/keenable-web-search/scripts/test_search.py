
import contextlib
import io
import os
import json
import sys
import unittest
import urllib.error
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import search  # noqa: E402


class SplitDomainsTest(unittest.TestCase):
    def test_none_gives_empty_list(self):
        self.assertEqual(search.split_domains(None), [])

    def test_commas_whitespace_dedup_order(self):
        self.assertEqual(
            search.split_domains(["a.com, b.com,,a.com", "who.int", " b.com "]),
            ["a.com", "b.com", "who.int"],
        )

    def test_only_separators_gives_empty_list(self):
        self.assertEqual(search.split_domains([" , "]), [])


class BuildPayloadTest(unittest.TestCase):
    def test_no_filters_matches_previous_payload(self):
        self.assertEqual(search.build_payload("q"), {"query": "q", "mode": "pro"})

    def test_empty_lists_are_omitted(self):
        payload = search.build_payload("q", include_domains=[], exclude_domains=[], site=None)
        self.assertEqual(payload, {"query": "q", "mode": "pro"})

    def test_lists_sent_as_arrays(self):
        payload = search.build_payload(
            "q", include_domains=["un.org", "undocs.org"], exclude_domains=["x.com"]
        )
        self.assertEqual(payload["include_domains"], ["un.org", "undocs.org"])
        self.assertEqual(payload["exclude_domains"], ["x.com"])

    def test_every_filter_passed_through(self):
        filters = {k: f"v-{k}" for k in search._PARAMS}
        payload = search.build_payload("q", **filters)
        self.assertEqual(payload, {"query": "q", "mode": "pro", **filters})
        self.assertEqual(
            set(search._PARAMS),
            {"site", "include_domains", "exclude_domains", "published_after",
             "published_before", "acquired_after", "acquired_before"},
        )


class ParseArgsTest(unittest.TestCase):
    def _error(self, argv):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            with self.assertRaises(SystemExit) as cm:
                search.parse_args(argv)
        return cm.exception.code, err.getvalue()

    def test_repeatable_and_comma_lists(self):
        _, inc, exc = search.parse_args(
            ["q", "--include-domain", "a.com,b.com", "--include-domain", "who.int",
             "--exclude-domain", "c.com"]
        )
        self.assertEqual(inc, ["a.com", "b.com", "who.int"])
        self.assertEqual(exc, ["c.com"])

    def test_help_states_host_only_contract_and_limits(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            with self.assertRaises(SystemExit):
                search.parse_args(["--help"])
        text = " ".join(out.getvalue().split())
        self.assertIn("hosts and their subdomains", text)
        self.assertIn("no paths or .gov suffixes", text)
        self.assertIn("Up to 50 hosts", text)
        self.assertIn("Up to 200 hosts", text)
        self.assertNotIn("press.un.org", text)

    def test_errors(self):
        cases = [
            (["q", "--include-domain", " , "], "--include-domain needs at least one domain"),
            (["q", "--site", "a.com", "--include-domain", "b.com"],
             "--site cannot be combined with --include-domain"),
            (["q", "--site", "a.com", "--include-domain", " , "],
             "--include-domain needs at least one domain"),
        ]
        for argv, message in cases:
            with self.subTest(argv=argv):
                code, err = self._error(argv)
                self.assertEqual(code, 2)
                self.assertIn(message, err)

    def test_allowed_combinations(self):
        cases = [
            (["q", "--site", "a.com", "--exclude-domain", "b.com"], [], ["b.com"]),
            (["q", "--exclude-domain", " , "], [], []),
            (["q", "--include-domain", "a.com", "--exclude-domain", "a.com"], ["a.com"], ["a.com"]),
        ]
        for argv, want_inc, want_exc in cases:
            with self.subTest(argv=argv):
                _, inc, exc = search.parse_args(argv)
                self.assertEqual((inc, exc), (want_inc, want_exc))


class FormatResultsTest(unittest.TestCase):
    def test_no_results(self):
        self.assertEqual(search.format_results({"results": []}), "No results.")

    def test_warning_shown_with_results(self):
        out = search.format_results(
            {"warning": "Some results were removed by the domain filter.",
             "results": [{"title": "T", "url": "https://a.com"}]}
        )
        self.assertTrue(out.startswith("Note: Some results were removed by the domain filter.\n"))
        self.assertIn("1. T\n   https://a.com", out)

    def test_warning_shown_when_no_results_left(self):
        out = search.format_results({"warning": "W", "results": []})
        self.assertEqual(out, "Note: W\nNo results.")

    def test_result_rendering(self):
        long_desc = "line one\n" + "x" * 441
        out = search.format_results({"results": [
            {"url": "https://a.com", "description": long_desc},
            {"title": "B", "url": "https://b.com", "snippet": "  short  ", "description": "ignored"},
            {"title": "C", "url": "https://c.com", "snippet": ""},
        ]})
        self.assertEqual(out, "\n".join([
            "1. Untitled\n   https://a.com",
            "   " + ("line one " + "x" * 441)[:400] + "...",
            "2. B\n   https://b.com",
            "   short",
            "3. C\n   https://c.com",
        ]))


class _Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


class RequestTest(unittest.TestCase):

    def _run(self, argv, response=None, error=None):
        sent = []

        def fake_urlopen(req, timeout=None):
            sent.append(req)
            if error is not None:
                raise error
            return _Response(json.dumps(response or {"results": []}).encode("utf-8"))

        out = io.StringIO()
        with mock.patch.object(search.urllib.request, "urlopen", fake_urlopen), \
                contextlib.redirect_stdout(out):
            search.main(argv)
        return sent, out.getvalue()

    def test_body_and_headers(self):
        sent, _ = self._run([
            "two", "words", "--include-domain", "a.com,b.com", "--include-domain", "who.int",
            "--exclude-domain", "c.com", "--published-after", "2024-01-01",
            "--published-before", "2024-12-31", "--acquired-after", "2023-01-01",
            "--acquired-before", "2025-01-01",
        ])
        self.assertEqual(len(sent), 1)
        req = sent[0]
        self.assertEqual(req.full_url, search.SEARCH_URL)
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(req.get_header("Content-type"), "application/json")
        self.assertEqual(req.get_header("X-keenable-title"), search.APP_TITLE)
        self.assertEqual(json.loads(req.data), {
            "query": "two words",
            "mode": "pro",
            "include_domains": ["a.com", "b.com", "who.int"],
            "exclude_domains": ["c.com"],
            "published_after": "2024-01-01",
            "published_before": "2024-12-31",
            "acquired_after": "2023-01-01",
            "acquired_before": "2025-01-01",
        })

    def test_plain_query_body_has_no_filters(self):
        sent, _ = self._run(["q"])
        self.assertEqual(json.loads(sent[0].data), {"query": "q", "mode": "pro"})

    def test_site_with_exclude_reaches_body(self):
        sent, _ = self._run(["q", "--site", "a.com", "--exclude-domain", "b.com"])
        self.assertEqual(
            json.loads(sent[0].data),
            {"query": "q", "mode": "pro", "site": "a.com", "exclude_domains": ["b.com"]},
        )

    def test_json_output_keeps_warning(self):
        resp = {"warning": "W", "results": [{"title": "é", "url": "u"}]}
        _, out = self._run(["q", "--json"], response=resp)
        self.assertEqual(json.loads(out), resp)
        self.assertIn("é", out)

    def test_text_output_shows_warning(self):
        _, out = self._run(["q"], response={"warning": "W", "results": []})
        self.assertEqual(out, "Note: W\nNo results.\n")

    def test_error_exits(self):
        def http_error(code, body):
            return urllib.error.HTTPError(
                search.SEARCH_URL, code, "err", {}, io.BytesIO(body.encode("utf-8"))
            )

        cases = [
            (http_error(400, '{"error":"invalid_filter"}'),
             'Search failed (HTTP 400): {"error":"invalid_filter"}'),
            (http_error(429, "slow down"),
             "Rate limited by the public endpoint. Try again shortly."),
            (urllib.error.URLError("no route"), "Could not reach Keenable: no route"),
        ]
        for error, message in cases:
            with self.subTest(message=message):
                with self.assertRaises(SystemExit) as cm:
                    self._run(["q"], error=error)
                self.assertEqual(cm.exception.code, message)


if __name__ == "__main__":
    unittest.main()
