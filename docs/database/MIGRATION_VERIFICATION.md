# Migration Verification — 053–057

| Migration | File in repo | On `main` | Applied prod | Schema match prod | App behavior |
|-----------|--------------|-----------|--------------|-------------------|--------------|
| 053 | PRESENT | Yes (via main history) | **NOT VERIFIED** | NOT VERIFIED | Contract tests exist (`test:security-centers-053`) |
| 054 | PRESENT | Yes | NOT VERIFIED | NOT VERIFIED | `test:platform-runtime-054` |
| 055 | PRESENT | Yes | NOT VERIFIED | NOT VERIFIED | `test:platform-runtime-055` |
| 056 | PRESENT | Yes | NOT VERIFIED | NOT VERIFIED | `test:rls-runtime-056` |
| 057 | PRESENT | Yes (`c9667a0` / PR #137) | NOT VERIFIED | NOT VERIFIED | `test:monitoring-isolation-057` |

## Distinctions (INV-004)

1. File exists ≠ applied.  
2. Merged to main ≠ production.  
3. CI `test:db-migrations` (ephemeral PG) ≠ production apply.

## Human read-only verification (recommended)

```sql
-- Example inventory only; run by authorized DBA on a replica if possible
SELECT filename FROM schema_migrations ORDER BY filename; -- adjust to actual inventory table name used by this project
```

Confirm project’s actual migration ledger table before running. Agent has no `DATABASE_URL`.

## Apply sequence (authorization required)

053 → 054 → 055 → 056 → 057. Take backup first. Do not reverse without DBA plan.
