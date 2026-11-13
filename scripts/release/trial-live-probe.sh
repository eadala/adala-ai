#!/usr/bin/env bash
# Read-only live/trial platform probe. Does not deploy or mutate.
# Usage:
#   ./scripts/release/trial-live-probe.sh [base-url]
# Default base-url: https://adalahai.com
# Exit 0 on pass; non-zero on hard failure.
set -euo pipefail

BASE_URL="${1:-https://adalahai.com}"
BASE_URL="${BASE_URL%/}"

if [[ ! "${BASE_URL}" =~ ^https://[A-Za-z0-9._-]+(/.*)?$ ]]; then
  echo "ERROR: base-url must be https://host" >&2
  exit 2
fi

echo "=== Adalah trial live probe ==="
echo "base_url=${BASE_URL}"
echo "time_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fail=0

probe() {
  local name="$1" url="$2" expect_substr="${3:-}"
  local tmp code
  tmp="$(mktemp)"
  code="$(curl -sS -o "${tmp}" -w '%{http_code}' --max-time 15 -L "${url}" || echo 000)"
  echo "-- ${name} --"
  echo "url=${url}"
  echo "http=${code}"
  if [[ "${code}" != "200" ]]; then
    echo "FAIL expected HTTP 200"
    fail=1
  else
    echo "OK  HTTP 200"
  fi
  if [[ -n "${expect_substr}" ]]; then
    if grep -q -- "${expect_substr}" "${tmp}"; then
      echo "OK  body contains: ${expect_substr}"
    else
      echo "FAIL body missing: ${expect_substr}"
      fail=1
    fi
  fi
  head -c 180 "${tmp}" | tr '\n' ' '; echo
  rm -f "${tmp}"
}

probe "A1 homepage" "${BASE_URL}/"
probe "A3 healthz" "${BASE_URL}/api/healthz" '"status":"healthy"'

# TLS / redirect sanity
echo "-- TLS / redirect --"
loc="$(curl -sS -o /dev/null -w '%{url_effective}|%{http_code}|%{ssl_verify_result}' --max-time 15 "${BASE_URL}/" || true)"
echo "effective=${loc}"
if [[ "${loc}" == https://* ]]; then
  echo "OK  effective URL is https"
else
  echo "FAIL effective URL not https"
  fail=1
fi

if [[ "${fail}" -ne 0 ]]; then
  echo "=== LIVE PROBE FAILED ==="
  exit 1
fi
echo "=== LIVE PROBE PASSED ==="
echo "NOTE: this is Path 02 deferred-live evidence only — not staging Go and not production readiness."
exit 0
