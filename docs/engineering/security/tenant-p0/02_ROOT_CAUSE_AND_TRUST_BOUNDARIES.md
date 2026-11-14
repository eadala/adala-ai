# Root Cause and Trust Boundaries

| Finding | Trust-boundary failure |
|---|---|
| OFFICE-IDOR | AuthN without membership/path binding |
| PAYMENTS-LIST | App query omitted `office_id` (relied on broken GUC/RLS) |
| RESOLVER-TRACE | Header promoted to authority without membership |
| AI-CREDITS | Body/`default` office charged |
| AI-AGENT | Unscoped list/insert |
| POOL-GUC | Session `set_config` + `pg.Pool` release without reset |
| MOYASAR | Optional signature + unscoped UPDATE |
| CRON/FORCE | Jobs without privileged scope; ENABLE without FORCE |

Invariant: client IDs are selectors; membership-verified `req.tenantId` is authority; RLS is defense-in-depth after pool guard.
