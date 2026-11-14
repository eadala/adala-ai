# Authorization Boundary Audit

## Authentication chain

| Step | Evidence | Status |
|---|---|---|
| Clerk `getAuth` | `requireAuth.ts` | VERIFIED source |
| Fail closed on missing userId | 401 responses | VERIFIED source |
| Super-admin email/metadata | `checkIsSuperAdmin` | VERIFIED source |
| Tenant via `resolveTenantId` | membership / SA / heal path | VERIFIED source |
| `x-tenant-id` without membership | rejected unless SA | VERIFIED source |
| Revoked membership | CACHE TTL 5 minutes | **FAILED / residual** — stale cache may authorize briefly |
| Role permissions | `requirePermission` + `office_members.role` | VERIFIED pattern; exhaustive role matrix NOT_TESTED |
| Client portal | `resolveTenantId` fail-closed | VERIFIED static tests |
| ARC roles vs customer | Separate packages | VERIFIED |

## Confused deputy / forged claims

| Attempt | Expected | Status |
|---|---|---|
| Forged `x-tenant-id` | Deny unless member/SA | VERIFIED source |
| Modified JWT | Clerk verify fails → 401 | VERIFIED intent; runtime NOT_TESTED this audit |
| Unauthorized tenant switch | Membership required | VERIFIED source |
| AI / customer → ARC deploy | Impossible via permissions | VERIFIED ARC tests |

## Privilege separation

- Customer roles ≠ ARC operators — VERIFIED  
- SA intentional bypass — VERIFIED  
- AI agent ARC non-authority — VERIFIED  

## Gaps

- Membership cache invalidation on revoke: NOT_TESTED / residual MEDIUM  
- Exhaustive invitation / cross-tenant invite accept: NOT_TESTED runtime  
- Complete RBAC matrix (lawyer/accountant/HR/clerk): PARTIAL source review only  
