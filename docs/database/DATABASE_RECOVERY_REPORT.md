# Database Recovery Report

| Item | Status |
|------|--------|
| Schema authority on `main` | Migrations through **057** present in repo |
| Agent `DATABASE_URL` | **Unset** — production apply **NOT VERIFIED** |
| Local PostgreSQL | Available for ephemeral integration tests |
| Backup schedule / encryption | **NOT VERIFIED** against Coolify/Hetzner |
| Isolated restore drill | **NOT EXECUTED** (requires human + staging DB) |

## Recommendations

1. Ops confirms 053–057 applied on production (`\dt` / migration inventory).  
2. Schedule encrypted backup + restore drill on a **clone**, not production.  
3. Do not run destructive SQL from agents.

## RLS note

056 owns `zta_*` / `vault_*`. 057 owns `rls_*` for remaining tenant-keyed tables. Application must still set `app.current_tenant` via `requireAuthWithTenant` — empty tenant can open vault policies.
