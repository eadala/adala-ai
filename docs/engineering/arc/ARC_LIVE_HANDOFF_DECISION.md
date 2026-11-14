# ARC Live Integration Handoff Decision

**Directive:** ARC-LIVE-HANDOFF-001  
**Date (UTC):** 2026-11-14  
**Baseline:** Phase 2C-G `e82ed25c59343ce2e398ce839a235fe27283fc8c` / `29cda42e2e0b6ab93ef68056781182af2a6b9c32`

## Decision

**ACCEPT** the controlled live-integration **handoff package**.

Live OIDC and live GitHub verification remain **PENDING** operator approval and secret binding. No live provider calls were authorized or executed in this task.

## Package contents

| Deliverable | Path |
|---|---|
| OIDC operator guide | `docs/engineering/arc/ARC_LIVE_OIDC_OPERATOR_GUIDE.md` |
| GitHub App operator guide | `docs/engineering/arc/ARC_LIVE_GITHUB_APP_OPERATOR_GUIDE.md` |
| Action checklist | `docs/engineering/arc/ARC_LIVE_INTEGRATION_CHECKLIST.md` |
| Validation runbook | `docs/engineering/arc/ARC_LIVE_VALIDATION_RUNBOOK.md` |
| Security acceptance | `docs/engineering/arc/ARC_LIVE_SECURITY_ACCEPTANCE.md` |
| Dry-run script | `artifacts/arc-server/scripts/arc-live-validation.sh` |

## Verified facts

- Baseline HEAD/tree matched; **104/104** tests PASS.
- F-001 / F-002 remain closed.
- Deployment execution remains **DISABLED**.
- Production impact: **NONE**.
- Validation script dry-run: authorization gate blocks live calls.

## Next human step

Complete checklist B→D, then authorize a validation window and run the runbook with `ARC_LIVE_VALIDATION_AUTHORIZED=true`.

## Production readiness

**NO-GO**
