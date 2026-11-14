# RBAC TypeScript Repair

## Reported errors

P0-005 docs recorded 3 `tsc` errors in `rbac.ts` referencing `invitationsTable.officeId` schema drift (dist stale vs source).

## Investigation

- Source `lib/db/src/schema/rbac.ts` already declares `officeId: text("office_id")` (migration 058).  
- Failure was stale `@workspace/db` dist, not missing authorization logic.  
- Introduction: schema added in 058 path; api-server rbac uses officeId filters.

## Correction

Rebuilt `lib/db` (`pnpm run build`). No `@ts-ignore` / `any` weakening of authorization types.

## Result

`pnpm run typecheck` in `artifacts/api-server` → **exit 0**.  
Security impact of the prior failure: build gate only; runtime isolation logic already present once dist matched source.
