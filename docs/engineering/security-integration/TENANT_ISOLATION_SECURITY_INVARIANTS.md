# Tenant Isolation Security Invariants

## I1 — Authoritative ownership
Every tenant-owned row must be reachable only through authenticated office context or a verified parent (case→office, invoice→office). Prefer existing ownership columns over inventing new `office_id` when parent linkage is already enforced.

## I2 — Trusted tenant identity
`office_id` / `tenantId` must come from server-side auth (`requireAuthWithTenant` → `req.tenantId`). Never trust client body/query/header as sole tenant authority.

## I3 — Fail-closed
Missing/invalid/unauthorized tenant → reject (403/401), no query, no inventing `"default"` / `"platform"` / `"unknown"` as office identity.

## I4 — Cross-tenant prohibition
Office A must not read/write Office B cases, documents, revenues, contracts, AI context, Autopilot tasks, or audit trails absent explicit Super Admin authorization.

## I5 — Privileged access
Super Admin / platform tools require `requireSuperAdmin` (or equivalent), audited actions, and explicit tenant selection. No implicit escalation from ordinary membership.

## I6 — Background jobs
Cron/webhooks/workers must carry verified office scope or operate only on explicitly selected tenants. No global unscoped mutations of tenant data.

## I7 — Connection / RLS containment
Session GUC (`app.current_tenant`) must not leak across pooled connections. Prefer transaction-local `set_config(..., true)` (#139). Privileged bypass (`app.bypass_rls`) must be narrowly contained.

## I8 — No silent actor substitution
Missing actor identity must not become a forged authenticated user for security-sensitive mutations. System actors must be explicit (`system:…`) if needed.
