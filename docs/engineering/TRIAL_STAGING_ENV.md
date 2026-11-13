# Trial Staging Environment Variables — Adalah AI

**Use only on staging / trial Coolify app.**  
Never paste production secrets into trial. Never commit real values.

Copy from root `.env.example` as a starting point, then apply this **trial profile**.

## Required for trial

| Variable | Trial value rule |
|----------|------------------|
| `NODE_ENV` | `production` (runtime) or `staging` if app supports it |
| `PORT` | Match Coolify (often `8080`) |
| `DATABASE_URL` | **Separate** staging Postgres — not production |
| `CLERK_SECRET_KEY` | Clerk **Test** secret (`sk_test_…`) |
| `CLERK_PUBLISHABLE_KEY` | Clerk **Test** publishable |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same test publishable for frontend build |
| `PLATFORM_OWNER_EMAIL` | Your trial owner email |
| `SESSION_SECRET` | New random 64-hex for staging only |

## AI (optional for smoke)

| Variable | Trial rule |
|----------|------------|
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Dev/restricted keys; quota-limited OK |
| `OLLAMA_*` | Optional; can leave default/disabled |

## Payments — keep safe

| Variable | Trial rule |
|----------|------------|
| `STRIPE_SECRET_KEY` | Prefer **omit** or `sk_test_…` only |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` only |
| `STRIPE_WEBHOOK_SECRET` | Test webhook or leave unset if billing out of scope |

## Deploy metadata (Coolify may set)

`GITHUB_SHA`, `GITHUB_REF_NAME`, `DEPLOYMENT_TIMESTAMP` — record SHA after deploy for smoke sign-off.

## Checklist before first staging deploy

- [ ] New DB empty (or seed demo only — no prod dump)
- [ ] All `*_live_*` keys absent
- [ ] Hostname is trial subdomain
- [ ] Production Coolify env untouched
- [ ] Values stored only in Coolify secrets UI
