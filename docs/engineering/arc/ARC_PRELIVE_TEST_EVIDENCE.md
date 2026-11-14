# ARC Pre-Live Test Evidence

## Commands & results

| Command | Exit | Counts | Evidence path |
|---|---|---|---|
| `cd artifacts/arc-server && pnpm test` | 0 | **104 pass / 0 fail / 0 skipped** | `/tmp/arc-prelive-evidence/arc-prelive-test.log` |
| `cd artifacts/arc-server && pnpm typecheck` | 0 | tsc clean | `/tmp/arc-prelive-evidence/arc-prelive-typecheck.log` |
| `bash -n artifacts/arc-server/scripts/arc-live-validation.sh` | 0 | syntax OK | shell |
| `./artifacts/arc-server/scripts/arc-live-validation.sh` (unauthorized) | 0 | dry-run only | `/tmp/arc-prelive-evidence/arc-prelive-script-dryrun.log` |
| Deploy isolation harness (tsx) | 0 | all 401/403 | `/tmp/arc-prelive-evidence/arc-prelive-deploy-isolation.json` |
| Network/SSRF/audit checks (tsx) | 0 | denials + redaction | `/tmp/arc-prelive-evidence/arc-prelive-network.json` |
| `shellcheck` | N/A | **not installed** — not counted as PASS | — |

No skipped tests were classified as PASS.

## Harness classification (fixture env)

`VERIFIED_LIVE_TEST: 0` · fixture cases present — SEC-007 held.

## Verdict

**PASS**
