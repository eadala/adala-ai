# ARC Release Policy Engine

**Policy version:** `arc-policy-v1-phase1`  
**Code:** `artifacts/arc-server/src/policy/engine.ts`

## Mandatory gates (Phase 1)

| Gate | PASS condition | Otherwise |
|------|----------------|-----------|
| commit_identity | 40-hex SHA | FAIL |
| tree_identity | 40-hex tree | FAIL |
| image_digest | digest present | UNVERIFIED (blocks) |
| typescript/ci | release.ciStatus PASS | as recorded |
| independent_review | human independent approval | FAIL |
| backup_evidence | attestation readiness PASS | FAIL/UNVERIFIED |
| restore_evidence | isolated restore timestamp + readiness | FAIL |
| staging_acceptance | flag true | BLOCKED |
| production_sha_verified | VERIFIED live SHA | UNVERIFIED |
| release_approval | bound sha+digest approval | FAIL/EXPIRED |
| deployment_execution_enabled | env kill-switch | BLOCKED |

Any mandatory non-PASS → `deploymentAllowed=false`.

## Determinism

Same `PolicyInput` → same gate results (timestamps in evidence differ).
