# Engineering Remediation Decision (010-A → pre-010-B)

**Decision maker:** Engineering agent (software remediation)  
**Date (Asia/Riyadh context):** 2026-11-14  
**Human 010-B authorization:** still **PENDING / NOT APPROVED**  
**Live R2 contact:** **NOT PERFORMED** (no app secrets bound; gate fail-closed)

## Best remedial engineering decision adopted

1. **010-B test scope RPO:** Cursor **Option A** (logical dump validates storage↔restore only).  
2. **Production RPO:** remains **UNDECIDED** for owners; engineering **design recommendation** = Cursor **Option B with N=1** (≤1h logical cadence) as interim target pending WAL/PITR architecture decision — **not signed as policy**.  
3. **WAL/PITR:** no activation; separate future decision.  
4. **Code remediation shipped (local):** fail-closed live upload/download/delete unless `ADALA_010B_AUTHORIZED=1`; backup key prefix enforcement; production-like DB URL refusal fix; cron skips gated live upload and keeps local artifact.  
5. **No push / merge / deploy / ARC.**

## Engineering-recommended auth blanks (NOT human approval)

| Field | Engineering recommendation | Status |
|-------|----------------------------|--------|
| Approved bucket | `adala-backups-nonprod` | Proposed only |
| IAM policy reference | Least-privilege `backups/*` RW as in `05_IAM_AND_CREDENTIALS.md` | Proposed only |
| Encryption | Provider SSE (R2/S3 default) over TLS | Proposed only |
| Retention | 30 days; synthetic objects only; no customer docs | Proposed only |
| Cost ceiling | USD 50 / month non-prod backup+egress until measured | Proposed only |
| Security reviewer | _(human)_ | Required before credentials |
| Platform owner | _(human)_ | Required |
| Authorizing person | _(human)_ | Required — must change PENDING→APPROVED |
| Authorization decision | **PENDING** | Unchanged |

## Why not execute live 010-B now

- Authorization record blanks unfilled; decision PENDING.
- Independent security review for credential issuance not evidenced.
- No R2 secrets available in this environment.
- Live contact would violate the draft limited-authorization hold.

## Verification executed

- `phase010bGateHarness` (local only) — see `evidence/phase010b-gate-harness.json`
- Existing local storage path remains usable with `STORAGE_PROVIDER=local`

## Exit state

```
010-A: SPECS_READY
010-B: NOT_AUTHORIZED (PENDING)
CODE_HARDENING: APPLIED_LOCAL
LIVE_R2: NOT_PERFORMED
PRODUCTION: NO-GO
PUSH_MERGE_DEPLOY: NOT_PERFORMED
```
