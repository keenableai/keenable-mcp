"""Offline tests for search.py (stdlib unittest, no network).

Run from the repo root:
  python3 -m unittest discover -s skills/keenable-web-search/scripts -p 'test_*.py'
"""

import contextlib
import io
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import search  # noqa: E402


class SplitDomainsTest(unittest.TestCase):
    def test_none_gives_empty_list(self):
        self.assertEqual(search.split_domains(None), [])

    def test_commas_whitespace_dedup_order(self):
        self.assertEqual(
            search.split_domains(["a.com, b.com,,a.com", ".gov", " b.com "]),
            ["a.com", "b.com", ".gov"],
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
            "q", include_domains=["press.un.org", "undocs.org"], exclude_domains=["x.com"]
        )
        self.assertEqual(payload["include_domains"], ["press.un.org", "undocs.org"])
        self.assertEqual(payload["exclude_domains"], ["x.com"])


class ParseArgsTest(unittest.TestCase):
    def _exit_code(self, argv):
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as cm:
                search.parse_args(argv)
        return cm.exception.code

    def test_repeatable_and_comma_lists(self):
        _, inc, exc = search.parse_args(
            ["q", "--include-domain", "a.com,b.com", "--include-domain", ".gov",
             "--exclude-domain", "c.com"]
        )
        self.assertEqual(inc, ["a.com", "b.com", ".gov"])
        self.assertEqual(exc, ["c.com"])

    def test_empty_include_is_an_error(self):
        self.assertEqual(self._exit_code(["q", "--include-domain", " , "]), 2)

    def test_site_with_include_is_an_error(self):
        self.assertEqual(self._exit_code(["q", "--site", "a.com", "--include-domain", "b.com"]), 2)


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


if __name__ == "__main__":
    unittest.main()
