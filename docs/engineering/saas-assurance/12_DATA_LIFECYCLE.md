# Data Lifecycle & Legal SaaS Operations

## Capability matrix

| Capability | Code/docs evidence | Status |
|---|---|---|
| Audit log retention | audit tables + logRotationCron | Partial (rotation exists; policy TBD) |
| Document versioning | contract_versions etc. | Partial |
| Export / portability | not comprehensively evidenced | **GAP** |
| Deletion / offboarding | incomplete state machine | **GAP** |
| Legal hold vs delete | conflict not modeled | **GAP** |
| Backup retention | NOT VERIFIED | **GAP** |
| PDPL / KSA obligations | requires legal assessment | **NOT CLAIMED** |

## Findings ([Async backup cost lifecycle](bc-e224a8ab-4d49-57ca-8df5-870eef796b65))

| ID | Sev | Finding |
|---|---|---|
| F-LIFE-001 | P1 | No automated tenant offboarding / wipe / export-on-cancel |
| F-LIFE-002 | P1 | `legal_holds` are records only — delete paths do not consult holds |
| F-LIFE-003 | P1 | `retention_policies.auto_delete` has **no enforcing cron** (document scan archives only) |
| F-LIFE-004 | P2 | Data subject requests are ticket rows — fulfillment manual |
| F-LIFE-005 | P2 | Policy vs practice: long audit retention vs short `tenant_audit_logs` rotation; `ai_usage_logs` never rotated |

Do not claim PDPL compliance from this engineering audit.
