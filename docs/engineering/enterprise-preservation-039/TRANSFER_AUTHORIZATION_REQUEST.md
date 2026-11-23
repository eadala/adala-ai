# Transfer Authorization Request (Gate G) — NOT EXECUTABLE YET

| Field | Value |
|-------|-------|
| SOURCE_REPOSITORY | local `/agent/repos/adala-ai` |
| DESTINATION_REPOSITORY | `eadala/adala-ai-secure-backup` (must exist + private verified) |
| SOURCE_REFS | **Only** `refs/backup/phase-031-8685f64a` until checkpoint scrubbed |
| DESTINATION_REFS | `refs/heads/backup/phase-031-8685f64a` |
| EXPECTED_OBJECTS | Phase 031 commit/tree + ancestry (no baseline-capture) |
| EXPECTED_TRANSFER_SIZE | ~39MB bundle or equivalent pack |
| SECRET_SCAN_STATUS | Phase 031 scope: no CONFIRMED_SECRET in tree; checkpoint scope: **BLOCKED** |
| PRIVATE_VISIBILITY_STATUS | UNVERIFIED |
| DEPLOYMENT_ISOLATION_STATUS | UNVERIFIED |
| EXACT_COMMANDS | `git push backup-origin 8685f64a:refs/heads/backup/phase-031-8685f64a` (after remote add) |
| ROLLBACK_PLAN | Delete remote backup branch only; never touch public origin |
| RESTORE_VERIFICATION_PLAN | Gate H disposable clone from private remote |

**EXTERNAL_TRANSFER_AUTHORIZED:** NO  
**Do not push.**
