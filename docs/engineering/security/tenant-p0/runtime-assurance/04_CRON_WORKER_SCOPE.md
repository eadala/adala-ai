# Cron / Worker Scope Containment

## Inventory

| Job | Trigger | Identity | Tenant scope | Privileged ops | Containment |
|---|---|---|---|---|---|
| Agent run | cron hourly/4h | system | platform scan | DB reads/writes via agents | `withSystemDbScope` |
| Daily snapshot | cron 02:00 | system | platform | DB | `withSystemDbScope` |
| Initial AI health | setTimeout 10s | system | platform | DB | `withSystemDbScope` |
| Tenant backup | cron 6h | system | all offices | read + upload | `withSystemDbScope` |
| Full backup | cron 02:30 | system | platform | read + upload | `withSystemDbScope` |
| Email cron | hourly | system | invoices/sessions | email + DB | `withSystemDbScope` |
| Log rotation | daily 03:00 | system | platform cleanup | DELETE old logs | `withSystemDbScope` |
| Monitoring | every 10m | system | N/A metrics | collectMetrics ping | Platform-only (no tenant DML) |

## Design

`artifacts/api-server/src/lib/systemDbScope.ts` sets `app.bypass_rls=on` for approved system jobs and always clears to `__unscoped__` in `finally`. Pool GUC guard additionally resets on connection release — RLS is never disabled globally.

## Tests covered indirectly

- RLS_BYPASS_ON_SCOPED / OFF_FAILCLOSED  
- POOL RELEASE_CLEARS_BYPASS  
- Pool reuse leak observation + reset  

No job disables RLS globally.
