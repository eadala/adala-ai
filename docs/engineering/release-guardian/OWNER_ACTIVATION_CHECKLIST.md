# Owner Activation Checklist — Production Auto-Promote

Do **not** enable `production_auto_promote` until every item is verified.

- [ ] Exposed GitHub App installation token revoked/expired (authoritative)
- [ ] Deployment credentials rotated/reviewed
- [ ] Public contaminated history remediated **or** promotion restricted to clean-tree artifacts only
- [ ] Coolify staging app live with separate Postgres + synthetic data
- [ ] No production Stripe/Clerk secrets in staging
- [ ] `RELEASE_GUARDIAN_STAGING_URL` set; smoke PASS
- [ ] Required GitHub checks enforced on `main`
- [ ] Coolify auto-deploy from feature branches disabled
- [ ] Production baseline health documented
- [ ] Rollback target (previous image digest) recorded per release
- [ ] Written owner activation of `production_auto_promote=true` for LOW only

Until then: **AUTOMATIC_PRODUCTION = DISABLED**.
