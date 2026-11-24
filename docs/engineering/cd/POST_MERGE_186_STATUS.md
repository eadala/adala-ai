# Post-merge #186 + RC reconcile status

## Verified

| Item | Value |
|------|-------|
| PR #186 | **MERGED** into `develop` at `2026-11-24T06:34:24Z` |
| Merge SHA | `b8629b3bef70878224d164f424986de9d0364601` |
| Post-merge CI | SUCCESS — https://github.com/eadala/adala-ai/actions/runs/45341459081 |
| Post-merge Guardian | SUCCESS — https://github.com/eadala/adala-ai/actions/runs/45341459041 |
| Gap | #186 = CD infra only; full RC app tree **not** on develop |
| Reconcile PR | https://github.com/eadala/adala-ai/pull/187 — tree apply of RC `8445c6e9` onto develop lineage @ `3285eca3` |
| Contam on develop / reconcile | **absent** |
| Phase 031 private backup | `8685f64a` unchanged |
| Private backup reconcile | `backup/reconcile-rc-onto-develop-001` @ `3285eca3` |

## Coolify / main safety (do before any main merge)

Production Coolify still **Deploy on push** from `main`. Merging develop→main **would** redeploy production with whatever is on develop.

**Required before develop→main:**

1. Coolify production → disable Deploy on push (or pause auto-deploy).
2. Add HTTPS CI webhook → GitHub secret `COOLIFY_DEPLOY_WEBHOOK_URL`.
3. Merge CD workflows to `main` only after that (or accept that first main push triggers Coolify).
4. Prefer: merge #187 → develop first; validate staging; then controlled main promote.

## Staging (`adala-ai-staging`)

Agent has **no Coolify API** and no resolvable public staging hostname from common guesses. Owner must provide `STAGING_BASE_URL` and `COOLIFY_STAGING_DEPLOY_WEBHOOK_URL`.

## Credential remediation

Still **NOT CONFIRMED**. User token cannot list GitHub App installations. Capture TTL suggests token string expired; issuing installation rotation remains owner-side.
