# Findings & Remediation Matrix

Scoring: Risk Priority = Impact × Likelihood × Exposure × Detectability Difficulty (ordinal 1–5 each; not calibrated probability).

| ID | Sev | Comp | Evidence | Root cause | Minimal correction | Alt | Migration | Complexity | Phase |
|---|---|---|---|---|---|---|---|---|---|
| F-DR-001 | P0 | Backup/DR | BACKUP_RESTORE_DRILL.md NOT VERIFIED | No evidenced restore | Execute isolated restore drill; record RTO/RPO | Managed PITR (e.g. provider) | NO | M | 0 |
| F-REL-003 / F-OBS-001 | P0 | Health | app.ts healthz always 200 | Liveness≠readiness | Add `/api/readyz` with DB ping; point orchestrator readiness | Deep health on separate port | NO | S | 0 |
| F-PERF-001 / F-DBPERF-001 | P1 | Pool | lib/db index.ts bare Pool | Defaults only | Set max, idleTimeout, connectionTimeoutMillis; metrics | PgBouncer | NO | S | 0 |
| F-ASYNC-001 | P1 | Cron | cronOverlapGuard in-process | Single-node assumption | PG advisory lock / Redis lock | Extract worker service | NO | M | 1 |
| F-REL-001 | P1 | Retry | retry.engine no jitter | Design gap | Add full-jitter; structured logs | Resilience library | NO | S | 1 |
| F-REL-002 | P1 | Providers | no uniform circuit | Missing bulkheads | Circuit breaker for AI/payment HTTP | Queue-based decoupling | NO | M | 1 |
| F-ARCH-001 | P1 | Process | cron+API colocated | Monolith deploy unit | Separate worker entrypoint | K8s CronJob | NO | M | 1 |
| F-PERF-002 | P1 | Capacity | Profiles B–E unrun | Scope/time | Run load suite on staging clone | Third-party load test | NO | M | 1 |
| F-DBPERF-002 | P1 | SQL | MONTHS.map parallel queries | Chatty dashboards | Single grouped SQL | Materialized rollups | NO | M | 2 |
| F-OBS-002 | P1 | Telemetry | OTEL/Sentry gated | Config | Enable with sampling budgets + runbooks | Managed APM | NO | S | 1 |
| F-RELENG-001..003 | P1 | CI/CD | ci.yml | Missing gates | Add DR checklist job + optional isolation gate | Full CD redesign | NO | M | 2 |
| F-LIFE-001/002 | P1 | Lifecycle | gaps | No state machine | Design offboarding+legal hold states | Vendor DSR tool | UNKNOWN | L | 2 |
| F-COST-001 | P1 | AI cost | credits exist; hard stop uneven | Product/ops | Hard quotas + budget alerts | Model routing | NO | M | 2 |
| F-ARCH-003/FE-004 | P2 | Cohesion | large modules/routes | Growth | Domain packaging boundaries | Microservices (avoid default) | NO | L | 3 |
| F-FE-001 | P2 | Frontend | CWV unmeasured | Not run | Lighthouse CI | — | NO | S | 2 |

## Immediately dangerous?

F-DR-001 and F-REL-003 are **production release blockers** for GO. No destructive testing performed.
