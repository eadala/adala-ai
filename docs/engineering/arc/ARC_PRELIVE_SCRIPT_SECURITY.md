# ARC Pre-Live Validation Script Security

**Subject:** `artifacts/arc-server/scripts/arc-live-validation.sh`  
**Syntax:** `bash -n` → OK · **Dry-run:** unauthorized path executed · **Live path:** NOT EXECUTED

## Command inventory

| Line / op | Effect | Side effect risk |
|---|---|---|
| `set -euo pipefail` | Strict mode | None |
| `mkdir -p "$REPORT_DIR"` | Writes under `/tmp/arc-live-evidence` (override via env) | Local FS only |
| `redact` sed pipeline | Filters Bearer/ghp_/JSON secret keys | Incomplete patterns → LOW |
| Auth gate `ARC_LIVE_VALIDATION_AUTHORIZED!=true` | Exit 0, no network | **PASS** missing auth |
| `pnpm test` (authorized only) | Local unit tests | Local only |
| `curl` GET healthz/config/harness | HTTP to `ARC_BASE_URL` | Network when authorized |
| `curl` POST deploy probes | Expect 401/403 | Denies success otherwise |

**Subprocesses:** `date`, `mkdir`, `sed`, `tee`, `curl`, `pnpm`, `tail`, bash subshell.  
**Env vars read:** `ARC_LIVE_EVIDENCE_DIR`, `ARC_BASE_URL`, `ARC_LIVE_VALIDATION_AUTHORIZED` (+ inherited secrets only if operator exports them — never echoed by script).

## Mandatory negative cases (script / design)

| Case | Result |
|---|---|
| Missing authorization | Dry-run message; exit 0; no provider calls — **PASS** (`/tmp/arc-prelive-script-dryrun.log`) |
| Missing credentials | Handled by server harness as `BLOCKED_NO_CREDENTIALS` when live later — not exercised live |
| Deploy mutation via script | Only POST probes expecting failure — **PASS** |
| Silent fixture-as-live | Script instructs not to relabel — classification enforced in harness |

## Findings

| ID | Severity | Issue |
|---|---|---|
| F-PRELIVE-001 | MEDIUM | When authorized, `ARC_BASE_URL` is not restricted to loopback/allowlist; operator misconfiguration could target a non-local ARC. **Remediation before live run:** require `http://127.0.0.1` / `localhost` or explicit allowlist; add `curl --max-time`. |
| F-PRELIVE-002 | LOW | `curl` GETs lack `--max-time` / `--max-redirs` (mitigated somewhat by `-f` and no `-L`). |
| F-PRELIVE-003 | LOW | Redaction regex misses some secret shapes (e.g. PEM bodies if ever printed). Server-side redaction remains primary control. |

No command injection via unchecked concatenation of untrusted remote input observed; paths are fixed literals; `BASE_URL` is env-trusted (operator).

## Verdict

**PASS WITH CONDITIONS** — safe for dry-run; remediate F-PRELIVE-001 before granting live validation authorization.
