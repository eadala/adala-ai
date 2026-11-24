# 04 — Historical Secret Audit

**Scope:** All blobs reachable from `refs/backup/phase-031-8685f64a` + `refs/backup/master-032r-checkpoint` (content scan skipped for `.bundle` / >2MB / binary).  
**Tools:** Local Python pattern scan (no new tools installed).  
**CONFIRMED_SECRET_COUNT:** 0  
**Values:** never printed.

## Findings (paths only)

| FILE_PATH | SECRET_TYPE | CLASSIFICATION | EXPOSURE_SCOPE | REMEDIATION_REQUIRED |
|-----------|-------------|----------------|----------------|----------------------|
| `docs/engineering/forensic-git-recovery-032r/evidence/baseline-capture.txt` | github_pat-shaped | NEEDS_MANUAL_REVIEW | LOCAL_ONLY (not on origin/main tip) | **Exclude from transfer** or scrub; rotate if confirmed live |
| same | jwt_like | NEEDS_MANUAL_REVIEW | LOCAL_ONLY | Exclude/scrub; rotate if session token live |
| `.replit` | openai-shaped `sk-…` | NEEDS_MANUAL_REVIEW | PUBLIC history on origin/main | Manual review; rotate if ever real |
| `docker-compose.yml` | postgres_password_literal | NEEDS_MANUAL_REVIEW | PUBLIC tip | Env-subst; rotate if used beyond local |
| `.env.example` CLERK/STRIPE/WHSEC | short live-prefix shapes | LIKELY_PLACEHOLDER | PUBLIC tip | Replace with obvious placeholders |
| `healSecret.ts` | path interest / env + literals | NEEDS_MANUAL_REVIEW (prior) | PUBLIC tip | Confirm test-only |

Machine summary: `evidence/secret-audit-summary.json`

**UNRESOLVED_SECRET_FINDINGS:** YES — Gate 3 transfer must scrub/exclude LOCAL_ONLY capture file at minimum.
