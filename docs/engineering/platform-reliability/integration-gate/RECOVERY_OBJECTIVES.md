# Recovery Objectives Analysis

## Capability vs claim

| Capability | Status |
|------------|--------|
| Full logical backup recovery (`pg_dump -Fc`) | Demonstrated locally |
| Incremental / physical backup | NOT IMPLEMENTED |
| Point-in-time recovery (PITR) | **NOT AVAILABLE** — no WAL archiving verified |
| Application process recovery | Demonstrated (container kill/restart) |
| Object-storage recovery | Local emulator round-trip only; live R2 NOT activated |

## Proposed (human approval required)

- RPO: 24h (daily logical full dump) — **not achieved claim**
- RTO: 4h for DB restore path in non-prod — **not achieved claim**

## Recommendation

Keep logical dumps as the current approved local strategy. Add WAL/PITR only after managed PostgreSQL continuous archiving is authorized and restore-tested in non-prod. Treat object storage + secrets as separate recovery tracks.
