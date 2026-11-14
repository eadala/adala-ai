# F-PRELIVE-001 Root Cause

**Directive:** ARC-SEC-FIX-003  
**Finding:** Unrestricted `ARC_BASE_URL` in authorized live-validation path

## Trace

1. Environment: `ARC_BASE_URL` (default `http://127.0.0.1:8787`)
2. Script assignment: `BASE_URL="${ARC_BASE_URL:-...}"` with **no validation**
3. Authorized branch (`ARC_LIVE_VALIDATION_AUTHORIZED=true`) used `curl` against `${BASE_URL}/...`
4. No host/scheme/port/DNS/proxy checks; redirects not explicitly disabled (`-L` absent but also no `--max-redirs 0`)

## Exploit conditions (pre-fix)

Given authorization flag set (operator mistake or premature enablement):

```bash
export ARC_LIVE_VALIDATION_AUTHORIZED=true
export ARC_BASE_URL=http://evil.example:8787   # or production host
./artifacts/arc-server/scripts/arc-live-validation.sh
```

Script would issue HTTP requests to the attacker-/misconfigured destination.

## Not exploitable by

- Unauthenticated remote users (no ARC public exposure assumed; script is local ops)
- AI agents via API (no allowlist mutation API; `credentials:modify` denied)
- Unauthorized dry-run path (no network until authorization flag)

## Severity rationale

MEDIUM: requires authorization flag, but once set, destination trust was unbounded.
