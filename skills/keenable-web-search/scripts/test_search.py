
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

    def test_only_blanks_is_sent_for_the_api_to_reject(self):
        self.assertEqual(search.split_domains([" , "]), [""])
        self.assertEqual(search.split_domains([""]), [""])


class BuildPayloadTest(unittest.TestCase):
    def test_empty_lists_are_omitted(self):
        payload = search.build_payload("q", exclude_domains=[], site=None)
        self.assertEqual(payload, {"query": "q", "mode": "pro"})

    def test_every_filter_passed_through(self):
        filters = {k: f"v-{k}" for k in search._PARAMS}
        payload = search.build_payload("q", **filters)
        self.assertEqual(payload, {"query": "q", "mode": "pro", **filters})


class FormatResultsTest(unittest.TestCase):
    def test_warning_shown_before_results(self):
        out = search.format_results(
            {"warning": "W", "results": [{"title": "T", "url": "https://a.com"}]}
        )
        self.assertTrue(out.startswith("Note: W\n"))
        self.assertIn("https://a.com", out)

    def test_warning_shown_when_no_results_left(self):
        out = search.format_results({"warning": "W", "results": []})
        self.assertTrue(out.startswith("Note: W\n"))


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
            "two", "words", "--exclude-domain", "a.com,b.com", "--exclude-domain", "who.int",
            "--published-after", "2024-01-01",
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
            "exclude_domains": ["a.com", "b.com", "who.int"],
            "published_after": "2024-01-01",
            "published_before": "2024-12-31",
            "acquired_after": "2023-01-01",
            "acquired_before": "2025-01-01",
        })

    def test_plain_query_body_has_no_filters(self):
        sent, _ = self._run(["q"])
        self.assertEqual(json.loads(sent[0].data), {"query": "q", "mode": "pro"})

    def test_blank_exclude_reaches_body(self):
        sent, _ = self._run(["q", "--exclude-domain", ""])
        self.assertEqual(json.loads(sent[0].data)["exclude_domains"], [""])

    def test_site_with_exclude_reaches_body(self):
        sent, _ = self._run(["q", "--site", "a.com", "--exclude-domain", "b.com"])
        self.assertEqual(
            json.loads(sent[0].data),
            {"query": "q", "mode": "pro", "site": "a.com", "exclude_domains": ["b.com"]},
        )

    def test_json_output_keeps_warning(self):
        resp = {"warning": "W", "results": [{"title": "T", "url": "u"}]}
        _, out = self._run(["q", "--json"], response=resp)
        self.assertEqual(json.loads(out), resp)

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
