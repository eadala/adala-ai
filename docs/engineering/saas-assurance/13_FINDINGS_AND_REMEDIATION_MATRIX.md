# Findings & Remediation Matrix

Scoring: Risk Priority = Impact × Likelihood × Exposure × Detectability Difficulty (ordinal 1–5; not calibrated probability).

Updated with subagent synthesis (`evidence/SUBAGENT_SYNTHESIS.md`).

| ID | Sev | Comp | Evidence | Root cause | Minimal correction | Alt | Migration | Complexity | Phase |
|---|---|---|---|---|---|---|---|---|---|
| F-DR-001 | P0 | Backup/DR | BACKUP_RESTORE_DRILL NOT EXECUTED | No restore proof | Isolated restore drill + evidence | Managed PITR | NO | M | 0 |
| F-DR-002 | P0 | Backup/DR | `runFullBackupCron` stats-only | Misnamed job | Real `pg_dump`/PITR job; rename UI | Infra backup.sh only | NO | M | 0 |
| F-DR-003 | P0 | DR UI | `simulateRestoreTest` always success | Fake test | Remove/disable until real clone restore | Wire to drill script | NO | S | 0 |
| F-REL-003 / F-OBS-001 | P0 | Health | `app.ts` healthz always 200 | Liveness≠readiness | `/api/readyz` + orchestrator | Separate port | NO | S | 0 |
| F-PERF-001 / F-DBPERF-001 | P1 | Pool | bare `Pool` | Defaults | max/idle/connectionTimeout + metrics | PgBouncer | NO | S | 0 |
| F-ASYNC-001 | P1 | Cron | in-process Set | Single-node | Advisory/Redis lock | Worker service | NO | M | 1 |
| F-ASYNC-003 | P1 | Stripe reconcile | no overlap guard | Omission | Wrap withCronOverlapProtection | Distributed lock | NO | S | 1 |
| F-DR-004 / F-COST-004 | P1 | Storage | deleteBackup unused | No lifecycle | Retention sweeper cron | Bucket lifecycle rules | NO | S | 1 |
| F-COST-001/002 | P1 | AI | soft deduct + client cost | Product gap | Hard-fail + server cost table | Model router | NO | M | 1 |
| F-COST-003 / F-LIFE-005 | P1 | Logs | ai_usage_logs unbounded | Not in rotation | Add purge policy | Archive to object store | MAYBE | S | 1 |
| F-ARCH-003/004/005 | P1 | Money/AI/Stripe | dual payments; callAI drift; replit-sync boot | Incomplete abstraction | Unify gateways; freeze boot sync | Extract workers | NO | L | 1 |
| F-REL-001/002 | P1 | Resilience | no jitter; uneven circuits | Design | Full-jitter + provider breakers | Resilience lib | NO | M | 1 |
| F-OBS-003/004 | P1 | Metrics | unwired helpers; hardcoded health | Incomplete wiring | Wire or delete; real provider probes | APM only | NO | M | 1 |
| F-RELENG-001..004 | P1 | Release | no canary; no SBOM; no DR CI; Dockerfile unlocked | Process | Frozen Dockerfile + DR checklist job | Full CD | NO | M | 2 |
| F-LIFE-001..003 | P1 | Lifecycle | no offboarding; holds inert; policies unenforced | Missing product | State machine + enforce job | Vendor DSR | UNKNOWN | L | 2 |
| F-FE-001..004 | P1 | Frontend | 531KB entry; zoom lock; RTL hardcode; focus trap | UX debt | Fix viewport; shrink entry; i18n dir; focus trap | Redesign (avoid) | NO | M | 2 |
| F-PERF-002 | P1 | Capacity | Profiles B–E unrun | Scope | Staging load suite | Vendor load test | NO | M | 1 |
| F-DBPERF-002 | P1 | SQL | MONTHS.map fan-out | Chatty UI | Grouped SQL | Materialized views | NO | M | 2 |
| F-ARCH-006..008 / F-FE-005..008 | P2 | Maintainability | flat routers; orphan packages; a11y overclaim | Growth | Packaging + WCAG honesty | Microservices (no default) | NO | L | 3 |

## Immediately dangerous / GO blockers

F-DR-001, F-DR-002, F-DR-003, F-REL-003. No destructive testing performed. No remediations implemented under this directive.
