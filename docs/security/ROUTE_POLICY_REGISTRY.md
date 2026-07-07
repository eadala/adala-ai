# Route Policy Registry

**Source:** `artifacts/api-server/src/core/authorization/routePolicyRegistry.ts`  
**Policies:** 87 entries · **Route class:** `TENANT_RBAC`  
**Enforcement:** `enforceRoutePolicy()` middleware (`AUTHORIZATION_ENFORCEMENT=warn|strict|off`)

---

## Registry Statistics

| Section | Policies |
|---------|--------:|
| Cases | 18 |
| Clients | 4 |
| Contracts | 5 |
| Documents | 3 |
| Invoices | 11 |
| Accounting | 19 |
| HR / Payroll | 18 |
| RBAC Admin | 9 |
| **Total** | **87** |

Registry coverage vs P0 coded routes: **~74%** (87 policies / 118 tenant routes). Governance Layer 10 enforces mutation guards in code; registry is the SSOT for `enforceRoutePolicy` strict mode.

---

## Route → Permission Mapping

### Cases

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/cases` | `cases:view` |
| GET | `/api/cases/stats` | `cases:view` |
| POST | `/api/cases` | `cases:create` |
| GET | `/api/cases/:id` | `cases:view` |
| PATCH | `/api/cases/:id` | `cases:edit` |
| DELETE | `/api/cases/:id` | `cases:delete` |
| DELETE | `/api/cases/:id/hard` | `cases:delete` |
| POST | `/api/cases/:id/timeline` | `cases:edit` |
| POST | `/api/cases/:id/messages` | `cases:edit` |
| POST | `/api/cases/:id/tasks` | `cases:edit` |
| POST | `/api/cases/:id/autopilot` | `cases:edit` |
| POST | `/api/cases/:id/analyze` | `ai:access` |
| PATCH | `/api/cases/:id/court` | `cases:edit` |
| POST | `/api/cases/:id/hearings` | `cases:edit` |
| PATCH | `/api/cases/:id/hearings/:hid` | `cases:edit` |
| DELETE | `/api/cases/:id/hearings/:hid` | `cases:edit` |
| POST | `/api/cases/:id/documents` | `documents:upload` |
| DELETE | `/api/cases/:id/documents/:did` | `documents:delete` |

### Clients

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/clients` | `clients:view` |
| POST | `/api/clients` | `clients:create` |
| PATCH | `/api/clients/:id` | `clients:edit` |
| DELETE | `/api/clients/:id` | `clients:delete` |

### Contracts

| Method | Path | Permission |
|--------|------|------------|
| POST | `/api/contracts` | `contracts:create` |
| PATCH | `/api/contracts/:id` | `contracts:edit` |
| DELETE | `/api/contracts/:id` | `contracts:delete` |
| POST | `/api/contracts/:id/analyze` | `ai:access` |
| POST | `/api/contracts/generate-from-prompt` | `contracts:create` |

### Documents

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/documents` | `documents:view` |
| POST | `/api/documents` | `documents:upload` |
| DELETE | `/api/documents/:id` | `documents:delete` |

### Invoices (PR-AUTH-003)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/invoices` | `invoices:view` |
| GET | `/api/invoices/:id` | `invoices:view` |
| POST | `/api/invoices` | `invoices:create` |
| PUT | `/api/invoices/:id` | `invoices:edit` |
| DELETE | `/api/invoices/:id` | `invoices:delete` |
| GET | `/api/invoices/:id/payments` | `payments:view` |
| POST | `/api/invoices/:id/payments` | `payments:create` |
| DELETE | `/api/invoices/:id/payments/:pid` | `payments:create` |
| POST | `/api/invoices/:id/payment-link` | `invoices:edit` |
| POST | `/api/invoices/:id/mark-paid` | `payments:create` |
| POST | `/api/invoices/:id/send-email` | `invoices:edit` |

**Not registered (by design):** `GET /api/invoices/public/:token` — public token route, no tenant RBAC.

### Accounting (PR-AUTH-003)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/accounting/revenues` | `financial:view` |
| POST | `/api/accounting/revenues` | `financial:view` |
| PUT | `/api/accounting/revenues/:id` | `financial:view` |
| DELETE | `/api/accounting/revenues/:id` | `accounting:delete` |
| GET | `/api/accounting/expenses` | `financial:view` |
| POST | `/api/accounting/expenses` | `financial:view` |
| PUT | `/api/accounting/expenses/:id` | `financial:view` |
| DELETE | `/api/accounting/expenses/:id` | `accounting:delete` |
| GET | `/api/accounting/bank-accounts` | `financial:view` |
| POST | `/api/accounting/bank-accounts` | `financial:view` |
| PUT | `/api/accounting/bank-accounts/:id` | `financial:view` |
| DELETE | `/api/accounting/bank-accounts/:id` | `accounting:delete` |
| GET | `/api/accounting/advances` | `financial:view` |
| POST | `/api/accounting/advances` | `financial:view` |
| PATCH | `/api/accounting/advances/:id/approve` | `financial:view` |
| PATCH | `/api/accounting/advances/:id/repay` | `financial:view` |
| DELETE | `/api/accounting/advances/:id` | `accounting:delete` |
| GET | `/api/accounting/reports/summary` | `financial:view` |
| GET | `/api/accounting/cashflow` | `financial:view` |

### HR / Payroll (PR-AUTH-003)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/hr/payroll` | `payroll:view` |
| GET | `/api/hr/payroll/stats` | `payroll:view` |
| POST | `/api/hr/payroll/generate` | `payroll:manage` |
| PATCH | `/api/hr/payroll/:id/pay` | `payroll:manage` |
| PATCH | `/api/hr/payroll/pay-all` | `payroll:manage` |
| POST | `/api/hr/attendance` | `hr:manage` |
| POST | `/api/hr/attendance/check-in` | `dashboard:view` |
| POST | `/api/hr/attendance/check-out` | `dashboard:view` |
| GET | `/api/hr/office-location` | `dashboard:view` |
| POST | `/api/hr/office-location` | `hr:manage` |
| GET | `/api/hr/employees` | `hr:manage` |
| POST | `/api/hr/employees` | `hr:manage` |
| PATCH | `/api/hr/employees/:id` | `hr:manage` |
| DELETE | `/api/hr/employees/:id` | `hr:manage` |
| POST | `/api/hr/leaves` | `dashboard:view` |
| PATCH | `/api/hr/leaves/:id` | `hr:manage` |
| POST | `/api/hr/warnings` | `hr:manage` |
| POST | `/api/hr/investigations` | `hr:manage` |

### RBAC Admin (PR-AUTH-001)

| Method | Path | Permission |
|--------|------|------------|
| POST | `/api/rbac/roles` | `roles:create` |
| PATCH | `/api/rbac/roles/:id` | `roles:edit` |
| DELETE | `/api/rbac/roles/:id` | `roles:edit` |
| POST | `/api/rbac/invitations` | `users:create` |
| DELETE | `/api/rbac/invitations/:id` | `users:create` |
| PATCH | `/api/rbac/members/:memberId/role` | `users:edit` |
| DELETE | `/api/rbac/members/:memberId` | `users:delete` |
| PATCH | `/api/rbac/users/:id/status` | `users:edit` |
| GET | `/api/rbac/audit-logs` | `audit:view` |

---

## Routes in Code but Not Yet in Registry

These routes have `requirePermission` in handlers but lack registry entries (warn-mode only):

| Module | Examples |
|--------|----------|
| `hr.ts` | GET warnings/investigations, PATCH/DELETE warnings/investigations |
| `contracts.ts` | Additional GET routes (unguarded reads) |
| `cases.ts` | Sub-resource GET routes beyond registry |

**Action:** Expand registry before enabling `AUTHORIZATION_ENFORCEMENT=strict`.

---

## Path Normalization

```typescript
normalizeApiPath("/cases?page=1")     → "/api/cases"
normalizeApiPath("/api/cases/:id")    → "/api/cases/:id"
```

Matching uses Express-style `:param` segment equality.
