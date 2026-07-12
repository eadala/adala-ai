# RBAC Permission Matrix

**Source of truth:** `artifacts/api-server/src/core/authorization/permissionCatalog.ts`  
**Role definitions:** `artifacts/api-server/src/modules/platform/rbac.ts` (`DEFAULT_ROLES`)  
**Evaluation:** `office_members.role` → `roles.permissions` (JSON array or `*`)

---

## Permission Catalog (61 keys)

| Domain | Permissions |
|--------|-------------|
| Cases | `cases:view`, `cases:create`, `cases:edit`, `cases:delete`, `cases:assign`, `cases:close` |
| Clients | `clients:view`, `clients:create`, `clients:edit`, `clients:delete` |
| Contracts | `contracts:view`, `contracts:create`, `contracts:edit`, `contracts:delete` |
| Documents | `documents:view`, `documents:upload`, `documents:edit`, `documents:delete` |
| Invoices | `invoices:view`, `invoices:create`, `invoices:edit`, `invoices:delete` |
| Payments | `payments:view`, `payments:create` |
| Financial | `reports:view`, `financial:view` |
| Accounting | `accounting:delete` |
| Payroll | `payroll:view`, `payroll:manage` |
| HR | `hr:manage` |
| Users | `users:view`, `users:create`, `users:edit`, `users:delete` |
| Roles | `roles:view`, `roles:create`, `roles:edit` |
| Settings | `settings:view`, `settings:edit` |
| AI | `ai:access` |
| Messaging | `messages:view`, `messages:send` |
| Support | `support:view`, `support:reply` |
| Referral | `referral:create`, `referral:view` |
| Collaboration | `collaborator:access` |
| Audit | `audit:view` |
| Dashboard | `dashboard:view` |

### Frontend aliases (governance-synced)

| Frontend key | Canonical |
|--------------|-----------|
| `cases:manage` | `cases:edit` |
| `clients:manage` | `clients:edit` |
| `users:manage` | `users:edit` |
| `settings:manage` | `settings:edit` |
| `financial:manage` | `financial:view` |
| `reports:export` | `reports:view` |

---

## Default Role × Permission Matrix

Legend: ✅ granted · ❌ denied · ⭐ wildcard (`*`)

### Core legal permissions

| Permission | firm_owner | office_manager | lawyer | trainee_lawyer | accountant | secretary | broker | collaborator | client |
|------------|:----------:|:--------------:|:------:|:--------------:|:----------:|:---------:|:------:|:------------:|:------:|
| `dashboard:view` | ⭐ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `cases:view` | ⭐ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `cases:create` | ⭐ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `cases:edit` | ⭐ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `cases:delete` | ⭐ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `clients:view` | ⭐ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `clients:create` | ⭐ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `clients:delete` | ⭐ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `contracts:view` | ⭐ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `contracts:create` | ⭐ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `documents:view` | ⭐ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| `documents:upload` | ⭐ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| `ai:access` | ⭐ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Financial permissions (PR-AUTH-003)

| Permission | firm_owner | office_manager | lawyer | trainee_lawyer | accountant | secretary | broker | collaborator | client |
|------------|:----------:|:--------------:|:------:|:--------------:|:----------:|:---------:|:------:|:------------:|:------:|
| `invoices:view` | ⭐ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `invoices:create` | ⭐ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `invoices:edit` | ⭐ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `invoices:delete` | ⭐ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `payments:view` | ⭐ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `payments:create` | ⭐ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `financial:view` | ⭐ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `accounting:delete` | ⭐ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `reports:view` | ⭐ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `payroll:view` | ⭐ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `payroll:manage` | ⭐ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### HR permissions (PR-AUTH-003)

| Permission | firm_owner | office_manager | lawyer | trainee_lawyer | accountant | secretary | broker | collaborator | client |
|------------|:----------:|:--------------:|:------:|:--------------:|:----------:|:---------:|:------:|:------------:|:------:|
| `hr:manage` | ⭐ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **RBAC-ROLE-001 follow-up:** Review whether `office_manager` should receive `hr:manage` and whether `accountant` should receive `accounting:delete`. No automatic changes in PR-AUTH-003.

### Admin permissions

| Permission | firm_owner | office_manager | lawyer | trainee_lawyer | accountant | secretary |
|------------|:----------:|:--------------:|:------:|:--------------:|:----------:|:---------:|
| `users:view` | ⭐ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users:create` | ⭐ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `users:edit` | ⭐ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `users:delete` | ⭐ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `roles:view` | ⭐ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `roles:create` | ⭐ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `audit:view` | ⭐ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `settings:view` | ⭐ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Separation of Duties Highlights

| Action | Required permission | Typical role | SoD note |
|--------|--------------------|--------------|----------|
| Delete invoice | `invoices:delete` | accountant, firm_owner | office_manager cannot delete |
| Delete accounting record | `accounting:delete` | firm_owner only | accountants can write but not delete |
| Pay payroll | `payroll:manage` | office_manager, firm_owner | accountant is view-only |
| HR employee CRUD | `hr:manage` | firm_owner only | pending RBAC-ROLE-001 |
| RBAC role changes | `roles:edit` | firm_owner only | office_manager has `roles:view` only |
| Member removal | `users:delete` | firm_owner only | — |

---

## Super Admin Bypass

| Condition | Behavior |
|-----------|----------|
| SA email in `SUPER_ADMIN_EMAILS` | Bypass RBAC with audit log `SA_RBAC_BYPASS` |
| Impersonation active | SA bypass **disabled** |
| Missing `office_members` row | **Deny** (no trainee fallback) |

---

## Evaluation Rules

```text
1. Load office_members WHERE user_id + office_id (tenant)
2. JOIN roles ON office_members.role = roles.name
3. Parse roles.permissions JSON
4. If permissions includes "*" → ALLOW
5. Else if permissions includes exact key → ALLOW
6. Else → DENY (AUTH_403)
```

**Write path:** Role assignment writes to `office_members.role` only. `users.role` is not authoritative.
