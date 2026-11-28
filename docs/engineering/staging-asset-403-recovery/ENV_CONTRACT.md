# Staging Environment Variable Contract

Verified against repository consumers (not assumed).

## Required for API boot (staging)

| Variable | Consumer | Notes |
|----------|----------|-------|
| `CLERK_SECRET_KEY` | `@clerk/express`, server Clerk clients | Development secret for staging only |
| `CLERK_PUBLISHABLE_KEY` or host-mapped publishable | `clerkMiddleware` / `publishableKeyFromHost` | Server-side Clerk config |
| `DATABASE_URL` | Drizzle / pool | Isolated staging Postgres only |
| `SESSION_SECRET` | session crypto if enabled | Staging-specific |
| `NODE_ENV=production` | Enables static serving | Coolify Docker production stage |
| `PUBLIC_DIR=/app/public` | Dockerfile default | Built Vite `dist-stable` |
| `PORT=8080` | Dockerfile / Coolify | |

## Frontend publishable key (build-time)

| Variable | Consumer | Notes |
|----------|----------|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Vite build (`infra/Dockerfile.web` / Coolify build args) | Embedded in FE bundle; **pk_test_*** for staging |
| `VITE_CLERK_PROXY_URL` | Optional Clerk proxy | Default `/api/__clerk` in web Dockerfile |

## Not required as runtime FE env

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Next.js naming; this app is Vite. Prefer `VITE_*`.
- Secret keys must **never** be Vite-prefixed or baked into `public/`.

## CORS / browser origin (incident-critical)

| Variable / constant | Classification | Notes |
|---------------------|----------------|-------|
| `STAGING_CORS_DOMAINS` (code) | Runtime public allowlist | Includes `https://staging.adalahai.com` |
| `PRODUCTION_CORS_DOMAINS` (code) | Runtime public allowlist | `adalahai.com` / `www` |
| `ALLOWED_ORIGINS` | Runtime public config | Comma-separated **exact** `https://host` entries only; wildcards/paths rejected |

**Forbidden:** trusting `Host` / `X-Forwarded-Host`, wildcards, unrestricted origin reflection.

Without staging Origin on the allowlist, Vite `crossorigin` asset GETs return **403 JSON** (`CORS_ORIGIN_NOT_ALLOWED`).

## Staging isolation

- Staging Clerk: **Development** instance.
- Staging DB: dedicated volume/network/credentials — never production `DATABASE_URL`.
- Previously exposed staging credentials: treat as compromised; rotate before re-enabling integrations.
