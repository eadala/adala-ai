# Observability and Alerting

## Metrics module

`artifacts/api-server/src/reliability/observability/backupMetrics.ts`

Stable counters/gauges (no tenant/case/user IDs):

- backup success/failure
- last verified restore timestamp + duration
- DR pass/fail/blocked

## Proposed alerts (not activated)

| Alert | Severity | Trigger | Operator action | Runbook | Escalation | False positives |
|-------|----------|---------|-----------------|---------|------------|-----------------|
| Missing backup | P1 | No COMPLETED dump in expected window | Inspect cron + artifact dir | 11_OPERATIONAL_RUNBOOKS | >2 windows | Clock skew / maintenance window |
| Backup failed | P1 | FAILED_* status | Inspect capture logs | same | Immediate if repeated | Transient DB lock |
| Verify fail | P1 | FAILED_VERIFICATION | Quarantine artifact | same | Immediate | Disk corruption |
| DR drill fail | P1 | outcome FAIL | Re-run isolated restore | same | After 1 confirmed fail | Misconfigured disposable env (BLOCKED≠FAIL) |
| Backup age | P2 | Age > proposed RPO | Force backup | same | >2× RPO | Approved freeze |
| Readiness prolonged | P1 | readyz 503 sustained | Check DB/config/shutdown | same | >5 min | Rolling deploy |
| Worker backlog | P2 | queue depth high | Scale/inspect workers | same | Sustained | Burst traffic |

No live notification channels activated.
