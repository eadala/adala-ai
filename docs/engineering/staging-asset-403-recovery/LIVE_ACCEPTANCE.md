# Live Staging Acceptance Evidence

**Date (Asia/Riyadh):** 2026-11-25

## Agent-accessible probes (no Basic Auth)

| Check | Result |
|-------|--------|
| `GET https://staging.adalahai.com/` | **401** `www-authenticate: Basic realm="traefik"` |
| Asset follow-up | Not reachable without outer ACL credentials |
| Production impact | None — production not modified |

## Automated evidence (repository)

| Check | Result |
|-------|--------|
| `pnpm --filter @workspace/api-server run test:frontend-static` | PASS |
| `pnpm --filter @workspace/api-server run test:stage9-security` | PASS |
| CI job wiring `test:frontend-static` | Added |

## Operator checklist (after deploy + Basic Auth)

- [ ] HTML 200
- [ ] Each `/assets/*` referenced by HTML → 200
- [ ] JS MIME valid; CSS `text/css`
- [ ] No unexpected 403 on legitimate assets
- [ ] React bootstraps; Clerk sign-in renders
- [ ] Staging test user can auth (dev Clerk)
- [ ] Dashboard loads; DB health OK
- [ ] Tenant isolation still enforced
- [ ] No indefinite loader
- [ ] Staging ≠ production resources

## Final classification pending live ACL access

**STAGING PARTIALLY RECOVERED — BLOCKERS REMAIN** (code fix + tests landed; live Traefik verification pending operator credentials / Coolify redeploy of this SHA).
