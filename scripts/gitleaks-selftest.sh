#!/usr/bin/env bash
#
# Regression test for .gitleaks.toml.
#
# An allowlist is a hole in a security control, and holes widen quietly: someone
# adds `tests/` to silence a fixture, and two years later a live key in a test
# file is invisible. This builds a throwaway tree of synthetic secrets — placed
# both where we EXPECT noise and where we MUST still catch things — and asserts
# each one is caught or ignored as intended.
#
# Run it after every edit to .gitleaks.toml:
#     ./scripts/gitleaks-selftest.sh
#
# Each case declares its own expectation, via `hit` or `miss`, so a case cannot
# exist without an assertion about it.
#
# The credentials below are fabricated. They are assembled at runtime from
# fragments so that no credential-shaped literal appears in this file: this
# script is copied into every repo covered by the policy, and a literal here
# would be flagged by every other scanner in those repos' pipelines. The
# assembled values are written to the scratch tree, which is what gets scanned.

set -uo pipefail

CFG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.gitleaks.toml"
TREE="$(mktemp -d)"
REPORT="$(mktemp)"
trap 'rm -rf "$TREE" "$REPORT"' EXIT

_id_head="AK";                        _id_tail="IAZZ7QWERTYUIOPASD"
_sec_head="wJalr0utnFEMI2K7MDENG";    _sec_tail="BPxRfiCYzTESTKEY01"
_jwt_head="eyJhbGciOiJIUzI1NiJ9";     _jwt_tail="eyJzdWIiOiIxIn0"
_pem_kind="RSA PRIVATE"
FAKE_AWS_ID="${_id_head}${_id_tail}"
FAKE_AWS_SECRET="${_sec_head}${_sec_tail}"
FAKE_JWT="${_jwt_head}.${_jwt_tail}.qmXpDlOesRRhY6NnP0iZoZfM8vKQKmNCRkYQx0IqQZM"
FAKE_PEM="-----BEGIN ${_pem_kind} KEY-----
MIIEowIBAAKCAQEAx7Vn9pQ2mK4tRfL0sYbHcZ3jW8dEuNoP1aTgVmS6yXrBhCkQ
-----END ${_pem_kind} KEY-----"

CASES=()

# Write one fixture and record what we expect the scanner to do with it.
_case() {
  local expect="$1" path="$2" body="$3"
  mkdir -p "$TREE/$(dirname "$path")"
  printf '%s\n' "$body" > "$TREE/$path"
  CASES+=("$expect $path")
  return 0
}

# a secret we must still report
hit() {
  local path="$1" body="$2"
  _case hit "$path" "$body"
  return 0
}

# a known false positive that must stay silent
miss() {
  local path="$1" body="$2"
  _case miss "$path" "$body"
  return 0
}

# --- must be REPORTED --------------------------------------------------------
# Several of these sit in places people instinctively want to exempt wholesale
# (tests, docs, dashboards, scratch dirs). They must still fire: the config
# narrows by content, never by path, so no directory is a blind spot.
hit "tests/test_creds.py"                "AWS_KEY = \"$FAKE_AWS_ID\""
hit "README.md"                          "Set your key to $FAKE_AWS_ID before running."
hit "search-us-west-2/dashboards/d.json" "{\"datasource\": \"$FAKE_AWS_ID\"}"
hit "modules/vpc/main.tf"                "$FAKE_PEM"
hit ".github/workflows/deploy.yml"       "  AWS_ACCESS_KEY_ID: $FAKE_AWS_ID"
hit "manifests/job.yaml"                 "  AWS_SECRET_ACCESS_KEY: \"$FAKE_AWS_SECRET\""
hit "tests/test_unannotated.py"          "TOKEN = \"$FAKE_JWT\""
# A scratch directory is not an exemption. `tmp/` was briefly a path allowlist
# in .gitleaks.toml, which meant a key committed here would sail through CI.
hit "tmp/scratch.py"                     "KEY = \"$FAKE_AWS_ID\""
# A value that merely BEGINS like a Terraform reference is not a reference.
hit "modules/db/creds.tf"                "  password = \"var.$FAKE_AWS_SECRET\""
# A credential does not become safe by sharing a line with a CIDR range.
hit "gcp-foundation/deploy.sh"           "gcloud compute --ranges=10.0.0.0/20 --key=\"$FAKE_AWS_SECRET\""

# --- must be SILENT ----------------------------------------------------------
# Each is a false positive actually observed in the 2026-08-29 reconnaissance
# scan, plus one case (test_annotated) proving the inline-exemption mechanism
# works, since that is what we ask developers to use for fixtures.
miss "tests/test_annotated.py"                "TOKEN = \"$FAKE_JWT\"  # gitleaks:allow — synthetic fixture"
miss "search-us-west-2/dashboards/panels.json" '{"key": "Q-41a9d702-80fa-4e3d-be11-03a37aea06dc-0"}'
miss ".github/workflows/sonar.yml"             '        --user "${SONAR_TOKEN}:"'
miss ".github/workflows/deploy-gcp.yml"        '          SA_KEY: ${{ secrets.GCP_SA_KEY }}'
miss "flyte/values.yaml"                       '  password:
    secretKeyRef:
      name: db-creds'
miss "modules/rds/main.tf"                     '  master_password = var.database_master_password'
miss "gcp-foundation/LOG.md"                   'gcloud services vpc-peerings connect --ranges=10.128.64.0/20,10.128.80.0/20'
# The real README this mirrors uses http://; the fixture uses https:// because
# the scheme is irrelevant to what is being tested (curl-auth-header fires on
# the -H argument) and a cleartext URL in a committed file is its own smell.
miss "ks_triton_operator/README.md"            '  curl https://triton.i.keenable.ai:8000/v2/health/ready -H "x-api-key: YOUR_API_KEY"'
miss "ytsaurus-test-eksctl/cluster.yaml"       '    remoteAccessSecurityGroup: "sg-0a1b2c3d4e5f60718"'
miss "charts/milvus/charts/kafka/NOTES.txt"    "$FAKE_PEM"

# Scan a RELATIVE target, from inside the tree. Path allowlists are matched
# against the path gitleaks reports, so scanning an absolute path makes every
# pattern face an absolute path — `^foo/` would stop matching, and `(^|/)tmp/`
# would match any tree under /tmp and skip all of it. CI and the pre-commit
# hook both scan `.`; this test must do the same or it proves nothing.
cd "$TREE" || exit 1
gitleaks dir . --config "$CFG" --redact --no-banner --exit-code 0 \
  --report-format json --report-path "$REPORT" >/dev/null 2>&1

printf '%s\n' "${CASES[@]}" | REPORT="$REPORT" python3 -c '
import json, os, sys

try:
    reported = {f["File"] for f in json.load(open(os.environ["REPORT"]))}
except Exception:
    reported = set()

GREEN, RED, OFF = "\033[32m", "\033[31m", "\033[0m"
failed = hits = misses = 0
for line in sys.stdin.read().splitlines():
    want, path = line.split(" ", 1)
    got = "hit" if path in reported else "miss"
    if want == "hit":
        hits += 1
    else:
        misses += 1
    if got == want:
        label = "caught" if want == "hit" else "silent"
        print(f"  {GREEN}ok{OFF}    {label}   {path}")
    elif want == "hit":
        print(f"  {RED}FAIL{OFF}  MISSED   {path}  <- a real secret here would be invisible")
        failed += 1
    else:
        print(f"  {RED}FAIL{OFF}  noisy    {path}  <- known false positive came back")
        failed += 1

print()
if failed:
    print("gitleaks self-test FAILED")
else:
    print(f"gitleaks self-test passed ({hits} caught, {misses} silent)")
sys.exit(1 if failed else 0)
'
