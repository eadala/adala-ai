# 12 — Consolidated Authorization Requests

## GATE 2 — Private destination provisioning

| Field | Value |
|-------|-------|
| Proposed owner/name | `eadala/adala-ai-secure-backup` |
| Visibility | private |
| Access model | Owner-only write; MFA; no third-party apps |
| Automation risk | Disable Actions; no Coolify link |
| Exact creation | GitHub UI/API create **private** empty repo (human) |

**STOP — do not create without approval.**

## GATE 3 — External backup transfer (after Gate 2)

| Field | Value |
|-------|-------|
| Destination | verified-private `backup-origin` |
| Ref mapping | `backup/phase-031-8685f64a`, `backup/master-032r-checkpoint` |
| Preconditions | Scrub/exclude `baseline-capture.txt`; confirm Coolify not attached; Actions off |
| Scope | Phase 031 + checkpoint ancestry; optional encrypted bundles separately |
| Estimated size | ~40–120MB+ depending on bundle inclusion |
| Rollback | Delete remote backup branches only; never touch public `origin`/`main` |
| Exact commands | See prior `safe-github-backup-038/04` adapted to `backup-origin` + `backup/*` branches |

**STOP — do not transfer without separate approval.**

## GATE 4 / 5

Off-env restore verification and Fallback C implementation require further directives.
