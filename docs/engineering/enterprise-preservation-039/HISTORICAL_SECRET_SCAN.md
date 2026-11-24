# Historical Secret Scan

Values never printed. Source: `evidence/gate-b-findings.json`.

| Path | Classification | Exposure | Remediation |
|------|----------------|----------|-------------|
| `.../baseline-capture.txt` | **CONFIRMED_SECRET** | Local checkpoint history only (not on origin/main tip) | **Block transfer of refs that reach it**; rotate credential if still valid |
| `docker-compose.yml` POSTGRES_PASSWORD | NEEDS_MANUAL_REVIEW | Public tip | Env-subst |
| `.env.example` sk_live_/whsec_ short | LIKELY_PLACEHOLDER | Public tip | Obvious fakes |
| `.replit` | UNKNOWN this run (path not on tip; prior 038 noted public history) | Public history (prior) | Manual review |

**UNRESOLVED_SENSITIVE_FINDINGS:** YES  
**CONFIRMED_SECRET_COUNT:** 1
