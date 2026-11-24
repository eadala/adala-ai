# Phase 033 — Scope and Acceptance (Phase 049 execution)

## Specification status

**RECONSTRUCTED — NOT YET APPROVED** as a product Phase 033 master specification.

Authoritative prior artifacts:

- `docs/engineering/operation-phoenix-040x/040G_PHASE_033_RECOVERY_BACKLOG.md` — Phase 033 **not started**; backlog only.
- `docs/engineering/phoenix-041/PHASE_033_READINESS.md` — **NOT_READY**; blocked on durable private backup + secret remediation + separate implementation authorization.

No complete Phase 033 requirements document inventing product features was found. Therefore this execution does **not** invent RAG reconstruction, migration 062+, or large architecture migrations under the Phase 033 label.

## Independently justified scope selected for Phase 049

Maintenance / security / continuity work that does not depend on the missing Phase 033 product spec:

| ID | Change | Acceptance criteria | Status |
|----|--------|---------------------|--------|
| 033-R1 | AI gateway fail-closed tenant resolution | No `userId` / `"unknown"` fallback; `/ai/query` rejects without tenant; unit tests pass | DONE |
| 033-R2 | Local docker-compose password hygiene | `POSTGRES_PASSWORD` from env with non-hardcoded default; DATABASE_URL aligned | DONE |
| 033-R3 | Milestone preserve + gated remote backup scripts | Local bundle create/verify; remote push requires `ALLOW_REMOTE_BACKUP=1`; refuses Phase 031 overwrite | DONE (local) |
| 033-R4 | Session continuity + engineering state manifest | Scripts + `ENGINEERING_STATE.json` without secrets | DONE |
| 033-R5 | Capability matrix grounded in tip evidence | Matrix file exists with statuses | DONE |

## Explicitly deferred (needs approved Phase 033 / product auth)

- RAG runtime reconstruction (migrations beyond schema foundation).
- Migrations 062–075.
- Any claim of Phase 018–030 recovery.
- Unattended remote push of new milestones.
- Production deployment.

## Security requirements (apply to all implemented work)

Fail-closed tenant authorization; server-side enforcement; tenant-scoped queries; safe RLS/GUC; least privilege; secure AI tool execution; firm data isolation; idempotent async/financial ops; audit trails; no unauthorized cross-tenant files; human approval for legally consequential external actions.
