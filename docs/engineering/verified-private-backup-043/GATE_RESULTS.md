# ADALA-043 — Mandatory Gate Results

| # | Gate | Result | Evidence |
|---|------|--------|----------|
| 1 | Destination identity + PRIVATE | **PASS** | MCP `get_repository`: `full_name=adalahai/adala-ai-private-recovery-2026`, `private=true`, `visibility=private` |
| 2 | Authenticated push permission | **PASS** | `permissions.push=true`, `admin=true` for connected `adalahai` |
| 3 | Secret incident remediated (authoritative) | **FAIL** | Last recorded status `PENDING_OWNER_REVOCATION` / `PENDING_OWNER_ACTION`. No authoritative revocation/rotation evidence provided in this directive. Expiration not assumed. |
| 4 | Phase 031 commit + tree | **PASS** | `8685f64a…` / `ea8b8e85…` |
| 5 | Full 031 history secret scan | **PASS** | 6364 blobs scanned; contaminated blob absent; 0 CONFIRMED `ghs_`/private-key hits in 031 closure |
| 6 | Contaminated HEAD/checkpoint excluded | **PASS** | Export scope = `8685f64a` only; contam blob not in object list |
| 7 | Destination branch unrelated history | **PASS** | Empty repository (no commits); branch `backup/phase-031-clean` absent |
| 8 | Deployment isolation | **FAIL / BLOCKED** | Actions workflows: 0 (PASS). Coolify live binding: **UNKNOWN**. `gh` cannot see repo (404) so webhooks/deploy keys not inspectable via CLI. Directive: unknown deployment isolation is a blocker. |

## Decision

**STOP — no push performed.**

Failed mandatory gates: **3 (secret remediation)**, **8 (deployment isolation unknown)**.
