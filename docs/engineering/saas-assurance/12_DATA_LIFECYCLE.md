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

## Findings

| ID | Sev | Finding |
|---|---|---|
| F-LIFE-001 | P1 | No explicit tenant offboarding lifecycle (export→hold check→delete→backup tombstone) |
| F-LIFE-002 | P1 | Legal hold vs erasure conflict unresolved in code |
| F-LIFE-003 | P2 | Audit retention policy not tied to regulatory schedule |

Do not claim PDPL compliance from this engineering audit.
