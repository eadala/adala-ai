# ARC Pre-Live Credential & Network Boundaries

## Credential leakage review

| Channel | Verdict | Evidence |
|---|---|---|
| Source / docs | PASS | No live secrets in handoff; placeholders only |
| Config API | PASS | Redacted snapshot; leak test in 2CG suite |
| Audit metadata | PASS | Bearer redacted (`/tmp/arc-prelive-network.json`) |
| Script output | PASS (dry-run) | No secrets; redactor present |
| Git remote | N/A to ARC app | Agent env has tokenized remote — not committed by handoff |
| Frontend bundles | PASS | ARC console does not embed provider secrets |

## Network

| Control | Verdict |
|---|---|
| GitHub origin allowlist | PASS |
| SSRF metadata block | PASS |
| Coolify user URL deny | PASS |
| Redirect follow | `redirect: "error"` |
| Customer IdP block | PASS (`clerk.adalah.ai`) |
| Production Coolify | NOT_CONNECTED |

## Findings

| ID | Severity | Issue |
|---|---|---|
| F-PRELIVE-001 | MEDIUM | See script BASE_URL allowlist gap |
| F-PRELIVE-007 | LOW | Script redaction incomplete vs full `redactSecrets` library |

## Verdict

**PASS WITH CONDITIONS** — remediate BASE_URL restriction before live validation authorization.
