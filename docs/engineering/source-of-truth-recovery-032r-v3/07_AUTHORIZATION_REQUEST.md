# 07 — Authorization Request

**EXTERNAL_TRANSFER_AUTHORIZED:** NO (awaiting)

| Field | Value |
|-------|-------|
| SOURCE | Custodian host still holding `4d76a954…` (prior LOCAL-ONLY VM export, operator machine, or Cursor-retained disk if any) |
| DESTINATION | This agent environment — **disposable verify repo first**, then optional import under `refs/recovery/*` |
| TRANSFER_METHOD | Encrypted/offline copy of verified Git **bundle** + `.sha256` |
| OBJECT_SCOPE | Exact Phase 030 commit + reachable ancestry needed for connectivity (ideally 018–030 LOCAL-ONLY tips) |
| EXACT_COMMANDS | Source: §06; Destination: §08 |
| EXPECTED_DATA_VOLUME | Unknown until source `du`; expect tens–hundreds of MB |
| SECURITY_IMPACT | Avoid transferring `.env` / credentials; bundle of Git objects only |
| PRESERVATION_PLAN | Phase 031 already at `8685f64a` + `refs/backup/phase-031-8685f64a` + local bundle |
| VERIFICATION_PLAN | Isolated import; exact SHA/tree match before touching primary branches |
| ROLLBACK_PLAN | Discard disposable verify repo; never force-move existing branch tips |

**STOP — explicit approval required before any transfer.**
