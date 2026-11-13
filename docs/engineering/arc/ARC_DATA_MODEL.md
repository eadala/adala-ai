# ARC Data Model

Phase 1 uses an **in-memory store** (`ArcStore`). Logical entities match the future dedicated ARC database.

## Entities

| Entity | PK | Notes |
|--------|----|-------|
| environments | id | production/staging/local |
| applications | id | FK environmentId |
| releases | id | Unique (repository, commitSha) intended |
| release_artifacts | — | Phase 1 fields on releases (buildArtifactId, imageDigest) |
| release_gates | evaluated ephemeral | Policy engine output |
| gate_evidence | id | Attached to gate evaluation |
| approval_requests | id | Bound to sha+digest+env+policyVersion |
| approvals | id | FK approvalRequestId; SoD enforced |
| deployment_attempts | — | Phase 1: audit only (execute disabled) |
| incidents | id | |
| monitoring_observations | id | Explicit EvidenceState |
| backup_attestations | id | readiness GateResult |
| audit_events | id | Append-only; no update/delete |

## State transitions

```
approval_request: pending → approved | rejected | expired | invalidated
release.deploymentStatus: proposed → blocked | approved | not_deployed
incident: open → acknowledged → resolved
```

## Concurrency / idempotency

- Deployment **request** accepts concurrent 202s (no execute).  
- Approval decisions audited; duplicate grants are additional audit rows (Phase 2: unique constraint on request+actor).  

## Retention

Phase 1 process lifetime. Phase 2+: retain audit ≥ 1 year; gates evidence ≥ release lifetime.

## Isolation

Never reuse customer `office_id` RLS. ARC authz is role-based on operator identity.
