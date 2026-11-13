#!/usr/bin/env bash
# Read-only Path 01 admin posture check for Adalah AI.
# Usage:
#   ./scripts/release/verify-path01-admin.sh
#   REPO=eadala/adala-ai ./scripts/release/verify-path01-admin.sh
#
# Exit codes:
#   0 = engineering OK; admin items may still be PENDING (printed)
#   1 = engineering regression (audit/CI tip identity)
#   2 = usage / tool error
set -euo pipefail

REPO="${REPO:-eadala/adala-ai}"
RULESET_ID="${RULESET_ID:-17934003}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing tool: $1" >&2; exit 2; }; }
need gh
need jq
need git

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "ERROR: not inside a git repository" >&2
  exit 2
fi
cd "${ROOT}"

echo "== Path 01 admin verify =="
echo "repo=${REPO}"

echo
echo "-- develop tip --"
TIP="$(gh api "repos/${REPO}/commits/develop" --jq '.sha')"
MSG="$(gh api "repos/${REPO}/commits/develop" --jq '.commit.message|split("\n")[0]')"
echo "sha=${TIP}"
echo "subject=${MSG}"

echo
echo "-- collaborators (Write+) --"
COLLAB_JSON="$(gh api "repos/${REPO}/collaborators")"
echo "${COLLAB_JSON}" | jq -r '.[] | "\(.login)\trole=\(.role_name // "n/a")\tpush=\(.permissions.push)"'
WRITE_COUNT="$(echo "${COLLAB_JSON}" | jq '[.[] | select(.permissions.push==true)] | length')"
WRITE_LOGINS="$(echo "${COLLAB_JSON}" | jq -r '[.[] | select(.permissions.push==true) | .login] | join(",")')"
echo "write_collaborators=${WRITE_COUNT} (${WRITE_LOGINS})"

echo
echo "-- ruleset ${RULESET_ID} --"
RS="$(gh api "repos/${REPO}/rulesets/${RULESET_ID}")"
echo "${RS}" | jq '{name,enforcement,include:(.conditions.ref_name.include // []),rules:[.rules[].type]}'
ENFORCE="$(echo "${RS}" | jq -r '.enforcement')"
INCLUDE_COUNT="$(echo "${RS}" | jq '(.conditions.ref_name.include // []) | length')"

echo
echo "-- open PRs into develop --"
OPEN_N="$(gh pr list --repo "${REPO}" --base develop --state open --json number --jq 'length')"
echo "open_develop_prs=${OPEN_N}"

echo
echo "-- summary --"
ENG_OK=1
ADMIN_PENDING=0

if [[ "${OPEN_N}" != "0" ]]; then
  echo "ENGINEERING: open develop PRs remain (${OPEN_N})"
  ENG_OK=0
else
  echo "ENGINEERING: no open PRs into develop"
fi

if [[ "${WRITE_COUNT}" -lt 2 ]]; then
  echo "ADMIN PENDING: need >=1 independent Write collaborator (currently ${WRITE_COUNT})"
  ADMIN_PENDING=1
else
  echo "ADMIN OK: Write collaborators >= 2"
fi

if [[ "${INCLUDE_COUNT}" -lt 1 ]]; then
  echo "ADMIN PENDING: ruleset has empty target refs (set develop/main)"
  ADMIN_PENDING=1
else
  echo "ADMIN OK: ruleset has ${INCLUDE_COUNT} target ref pattern(s)"
fi

case "${ENFORCE}" in
  active)
    echo "ADMIN NOTE: ruleset enforcement=active"
    ;;
  evaluate)
    echo "ADMIN NOTE: ruleset enforcement=evaluate (good staging before active)"
    ;;
  disabled|*)
    echo "ADMIN PENDING: ruleset enforcement=${ENFORCE} (prepare rules, then evaluate→active after reviewer exists)"
    ADMIN_PENDING=1
    ;;
esac

echo
if [[ "${ENG_OK}" -ne 1 ]]; then
  echo "RESULT: ENGINEERING_NOT_CLEAR"
  exit 1
fi
if [[ "${ADMIN_PENDING}" -eq 1 ]]; then
  # Path 01 engineering is complete; admin (reviewer/ruleset) may be DEFERRED_BY_OPERATOR.
  if [[ "${PATH01_ADMIN_DEFERRED:-0}" == "1" ]]; then
    echo "RESULT: ENGINEERING_OK_ADMIN_DEFERRED"
    echo "NOTE: set PATH01_ADMIN_DEFERRED=0 later when enforcing reviewer+ruleset"
    exit 0
  fi
  echo "RESULT: ENGINEERING_OK_ADMIN_PENDING"
  echo "NOTE: export PATH01_ADMIN_DEFERRED=1 to acknowledge operator deferral"
  exit 0
fi
echo "RESULT: PATH01_ADMIN_READY"
exit 0
