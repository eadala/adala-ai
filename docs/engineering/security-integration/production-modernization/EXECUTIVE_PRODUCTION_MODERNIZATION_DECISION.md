# Executive Production Modernization Decision

Evidence time: 2026-11-13 23:05 Asia/Riyadh.

## Decisions

| Scope | Decision |
|---|---|
| A. Current production operation | **CONDITIONAL_GO** — apex healthy; DB app-reported OK; payments outage + www 503 + unknown SHA |
| B. Controlled internal pilot | **CONDITIONAL_GO** — allowed only on isolated staging/pilot host; payments explicitly disabled or test keys; no customer data |
| C. Commercial launch | **NO_GO** |
| D. Production upgrade readiness | **NO_GO** until Coolify identity + RC review + GUC plan + backups attested |

## Verified production SHA

**UNVERIFIED**

## Recommended release

Local candidate `5ca2a2e931b859ed36b51eed75fd3e03cda509c7` (tree `bd9e3750fc7870c05124dc4af9e844095c292dd1`): develop+#164+#166–182+#185+#183-fix.  
**Not pushed. Not deployable without authorization.**  
Still missing integrated #139 GUC containment for full DB P0.

## Missing security fixes vs assumed prod (`main`)

#164–#183/#185 cohesion set; #139 GUC.

## Migrations

Confirm 053–057 applied in prod (UNVERIFIED). RC adds no new numbered migration files.

## Health

Payments **outage** (live); www **503**; `/api/health` OK.

## Backups

UNVERIFIED.

## CI/tests on RC

Guard tests PASS; tsc PASS; RLS adversarial NOT_RUN; full build/audit NOT_RUN.

## Review blockers

Independent review missing on all open cohesion PRs; Auto-merge must stay OFF.

## Deployment sequence (authorized humans only)

1. Operator verifies Coolify SHA/branch/Auto Deploy; pause Auto Deploy  
2. Governance lock (reviews + no auto-merge)  
3. Independent review of RC composition  
4. Staging deploy + acceptance  
5. Prove backups/restore drill  
6. Integrate/review #139  
7. Explicit production approval → promote (likely via `main`)  
8. Verify runtime SHA matches RC  

## Next safe action

**Operator completes Coolify production identity checklist (deployed SHA, digest, watched branch, Auto Deploy) and pauses Auto Deploy if uncertain — then commission disposable Postgres for G9 RLS validation of the local RC.**
