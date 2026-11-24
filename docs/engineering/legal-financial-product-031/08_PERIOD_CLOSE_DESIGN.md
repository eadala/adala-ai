# 08 — Accounting Period Close Design Gate (ADALA-031)

**Classification:** DESIGN_READY_FOR_APPROVAL  
**Implementation status:** NOT IMPLEMENTED (no mutations / no period tables in migration 061)

## Scope

Design for future accounting period close without modifying live financial ledgers in this phase.

## Proposed domain

| Entity | Purpose |
|--------|---------|
| `accounting_periods` | office_id, label, start_date, end_date, status (`open`/`soft_closed`/`closed`) |
| `period_close_events` | audit of close/reopen/adjust with actor + reason |
| `period_adjustments` | post-close adjusting entries (restricted role) |

## Controls

1. **Posting restrictions:** While `soft_closed` or `closed`, refuse new `office_erp_ledger` / invoice payments dated inside period unless `bypass_period_lock` role.
2. **Closing controls:** Checklist — reconciliation score ≥ threshold, unmatched invoices reviewed, duplicate payments cleared.
3. **Reopening authority:** Super-admin / firm_owner only; requires reason; writes audit event.
4. **Adjustments:** Separate adjusting entries tagged `period_adjustment=true`; never rewrite historical ledger rows.
5. **Reconciliation:** Must run `reconcile(officeId)` and persist report snapshot before close.
6. **Audit trail:** Immutable close/reopen events with actor, timestamps, checksum of ledger aggregates.
7. **Legacy records:** Pre-period open-ended rows assigned to synthetic “opening” period; no backdated silent mutation.
8. **Migration risks:** Adding NOT NULL period_id on ledger would break legacy rows — prefer nullable `period_id` + backfill job under approval.

## Explicit non-goals (this phase)

- No `accounting_periods` table creation
- No posting-lock middleware
- No data migration of historical ledger rows

## Approval required before implementation

Separate directive authorizing period-close mutations + forward migration.

**DESIGN_READY_FOR_APPROVAL**
