# Exact Authorization Request (Gate B)

**Request ID:** AUTH-032R-GATE-B-BUNDLE-TRANSFER

| Field | Value |
|-------|-------|
| SOURCE | Any custodian host that still holds commit `4d76a954944e17ae920346dd80ae484a3400d310` (prior LOCAL-ONLY VM export, operator machine, Cursor-retained disk if any) |
| DESTINATION | This agent workspace — disposable verify repo first (`/tmp/adala-verify-bare`), then optional `refs/recovery/*` only |
| TRANSFER_METHOD | Offline/encrypted Git **bundle** + SHA-256 checksum file |
| OBJECT_SCOPE | Exact Phase 030 commit + reachable ancestry (preferably 018–030 LOCAL-ONLY tips) |
| EXACT_COMMANDS | Source: `source-of-truth-recovery-032r-v3/05`+`06`; Dest: `08` |
| EXPECTED_DATA_VOLUME | Unknown until source `du` (expect tens–hundreds of MB) |
| SECURITY_IMPACT | Bundle Git objects only; exclude secrets/`.env` |
| PRESERVATION_PLAN | Keep Phase 031 `8685f64a` + backup ref + existing 39MB bundle untouched |
| VERIFICATION_PLAN | Isolated import; assert commit + tree `d568bf7f…` before any integration |
| ROLLBACK_PLAN | Delete disposable verify repo; never force-move `main`/031/032 tips |

**Also request (optional, separate):** Approval to *evaluate* Fallback C reconstruction plan **documentation only** if search returns empty — still no implementation without a further approval.

**STOP. No transfer inferred.**
