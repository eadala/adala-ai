# Database Performance (non-RLS)

## Index authority (positive)

Migrations already own hot-path indexes, e.g.:

- `010_office_ledger_performance_indexes.sql` — cases/clients/documents/invoices composites
- `052_messaging_runtime_indexes_schema_authority.sql` — office_messages predicates

## Synthetic EXPLAIN (isolated)

On `adala_rls_repro.client_invoices_repro` (tiny table):

```
Seq Scan … Execution Time: 0.061 ms
```

**Not** evidence of production plans. Useful only to confirm EXPLAIN tooling path.

## Findings

| ID | Sev | Evidence | Note |
|---|---|---|---|
| F-DBPERF-001 | P1 | Pool max default 10, no statement_timeout at app | Saturation / stuck query risk |
| F-DBPERF-002 | P1 | N+1 / fan-out monthly maps in finance/admin | Write amplification under dashboard load |
| F-DBPERF-003 | P2 | Autovacuum/bloat assumptions undocumented for large tenant tables | Ops unknown |
| F-DBPERF-004 | P2 | Migration 061 FORCE loops all ENABLE tables — lock duration on large prod unknown | Measure on staging clone |

## Index proposal policy

No speculative indexes from this audit. Any new index requires EXPLAIN on representative synthetic volume + write-overhead estimate + `CREATE INDEX CONCURRENTLY` guidance.
