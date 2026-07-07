# Security Attack Simulation — Customer Zero

**Method:** Adversarial persona testing (malicious employee) + static code audit + automated `enterprise-abuse.test.ts`

---

## Attack Scenarios

### A1 — Cross-tenant data access

| Attack | Vector | Result | Notes |
|--------|--------|--------|-------|
| Access other office cases | `X-Tenant-Id` header | **Blocked** | `resolveTenantId` verifies membership |
| SQL without office_id | Raw SQL modules | **Mitigated** | accounting/hr/invoices scope by tenantId |
| Payment webhook cross-update | Forged webhook event | **Fixed** | Requires `metadata.office_id` in UPDATE WHERE |

### A2 — Permission bypass

| Attack | Vector | Before | After |
|--------|--------|--------|-------|
| List all team members | `GET /rbac/members` | ✅ Allowed (any member) | **Denied** without `users:view` |
| List pending invitations | `GET /rbac/invitations` | ✅ Allowed | **Denied** without `users:view` |
| List roles/permissions | `GET /rbac/roles` | ✅ Allowed | **Denied** without `roles:view` |
| Create payment transaction | `POST /payments/transactions` | ✅ Allowed | **Denied** without `payments:create` |
| Settle batch payments | `POST /payments/batch-settle` | ✅ Allowed | **Denied** without `payments:create` |
| Delete invoice | `DELETE /invoices/:id` | Denied for trainee | **Denied** — `invoices:delete` required |
| HR employee delete | `DELETE /hr/employees/:id` | Was open to all | **Denied** — `hr:manage` |

### A3 — Trainee lateral movement

| Action | Permission required | Trainee result |
|--------|--------------------:|:--------------:|
| Delete case | `cases:delete` | **DENY** |
| View payroll | `payroll:view` | **DENY** |
| Create payment | `payments:create` | **DENY** |
| View financial reports | `financial:view` | **DENY** |
| Check-in attendance | `dashboard:view` | **ALLOW** (intended) |
| Upload document | `documents:upload` | **ALLOW** (intended) |

### A4 — UI permission bypass

| Attack | Vector | Result |
|--------|--------|--------|
| Navigate to `/invoices` via URL | Direct route | API returns 403 if no `invoices:view` |
| Sidebar shows finance to trainee | Nav render | **Fixed** — nav items hidden |
| Quick action "new invoice" | FAB menu | **Fixed** — requires `invoices:create` |

### A5 — AI credit abuse

| Attack | Status | Notes |
|--------|--------|-------|
| Copilot without tenant | **Blocked** | T-ISO-04 |
| Cross-tenant AI cache | **Blocked** | T-ISO-07 |
| Unlimited AI without credits | **Partial** | Entitlements check exists; strict mode pending |

---

## Critical Findings Log

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| SEC-CZ-001 | Critical | RBAC member enumeration | **Fixed** |
| SEC-CZ-002 | Critical | Payments mutations unguarded | **Fixed** |
| SEC-CZ-003 | Critical | Webhook UPDATE without tenant scope | **Fixed** |
| SEC-CZ-004 | Critical | Payment settings `DEFAULT 'default'` | **Fixed** |
| SEC-CZ-005 | High | HR extended modules unguarded | Open (P1) |
| SEC-CZ-006 | High | `billing.ts` no tenant RBAC | Open (P1) |
| SEC-CZ-007 | Medium | Webhook signature optional if secret unset | Open (P2) |
| SEC-CZ-008 | Medium | Contract GET reads without RBAC | Open (P2) |

---

## Automated Verification

```bash
pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/tests/enterprise-abuse.test.ts
```

Checks:
- payments.ts mutation guards
- RBAC enumeration guards
- office_manager enterprise permissions
- trainee denial
- frontend nav gates
- tenant scoping in P0 modules

---

## Remaining Attack Surface

1. **42 HR extended routes** — `hr-enterprise`, `hrInternal`, `hrPerformance`
2. **Platform billing routes** — user-scoped not office-scoped RBAC
3. **7-step tenant resolver** — wrong office selection for multi-member users
4. **No RLS** — application-layer only
5. **Super admin bypass** — audited but powerful
