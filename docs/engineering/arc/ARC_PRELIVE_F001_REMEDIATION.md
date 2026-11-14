# F-PRELIVE-001 Remediation

## Changes

| File | Change |
|---|---|
| `src/lib/validationBaseUrl.ts` | Strict URL + destination + DNS + proxy policy |
| `scripts/validate-base-url.ts` | CLI for shell preflight |
| `scripts/arc-live-validation.sh` | Validate BASE_URL before curl; `--max-time`; `--max-redirs 0`; proxy re-check |
| `src/tests/prelive-f001-base-url.test.ts` | Negative + positive regression suite |

## Enforcement points

1. **Structural deny** — malformed, userinfo, query/hash/path, bad scheme, control chars, metadata, production hosts, ports.
2. **Policy** — default `loopback` (http + loopback host + fixture ports); optional `staging_allowlist` requires admin env allowlist + https.
3. **DNS** — resolve hostname; require all addresses match policy (loopback-only under default).
4. **Proxy** — deny if `HTTP(S)_PROXY`/`ALL_PROXY` set unless `ARC_ALLOW_HTTP_PROXY=true`.
5. **Script** — authorized path calls validator; failure → exit 1 before curl.

## Non-fallback

Missing/invalid allowlist, DNS failure, unauthorized host → **DENY**. No silent less-restrictive mode.
