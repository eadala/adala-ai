# ARC Implementation Plan

## Backlog

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Discovery, ADR, threat model, data model | Done (this package) |
| 1 | Read-only MVP: server, console, adapters, policy, tests | Implemented locally |
| 2 | RBAC hardening, approval expiry jobs, evidence validators | Next |
| 3 | Coolify read live + deploy interface stubs locked | Planned |
| 4 | Staging deploy of ARC | Needs separate auth |
| 5 | Production enablement | Planning only |

## Module ownership

| Module | Package path |
|--------|--------------|
| Backend API | `artifacts/arc-server` |
| Console | `artifacts/arc-console` |
| Docs | `docs/engineering/arc` |

## Local commands

```bash
pnpm --filter @workspace/arc-server install   # via workspace install
pnpm --filter @workspace/arc-server test
pnpm --filter @workspace/arc-server typecheck
pnpm --filter @workspace/arc-server start     # :8787
pnpm --filter @workspace/arc-console dev     # :5177
```

## Non-goals this task

Push, PR merge, Coolify changes, production secrets, customer app edits.
