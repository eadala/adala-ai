---
name: Adala SaaS Pro Features
description: 4 enterprise-grade SaaS features added — Demo Mode, 2FA (TOTP), Sentry, Swagger/OpenAPI
---

## Demo Mode
- Public endpoint: `GET /api/demo/credentials` → returns email/password from DEMO_EMAIL/DEMO_PASSWORD env vars
- Public endpoint: `GET /api/demo/stats` → returns live stats from demo office
- Demo office seeded via `ensureDemoData()` in demoMode.ts (DEMO_OFFICE_ID = ddddeeee-...-0099)
- /demo-login page already existed (shows office selector); new credentials API powers it
- All 4 landing variants have "🎭 جرّب المنصة" button linking to /demo-login

## 2FA (TOTP)
- DB table: `two_factor_settings` (user_id UNIQUE, secret, enabled, backup_codes text[])
- Backend routes: `/api/2fa/status` (GET), `/api/2fa/setup` (POST), `/api/2fa/verify` (POST), `/api/2fa/check` (POST), `/api/2fa/disable` (POST)
- Frontend: /2fa-setup (full setup flow: QR scan → verify → backup codes) + /2fa-verify (login check)
- my-profile.tsx 2FA row now links to /2fa-setup with "تفعيل/إدارة" button
- Uses `speakeasy` for TOTP + `qrcode` for QR data URL generation
- sessionStorage key "2fa_verified" marks session as passed

## Sentry
- Backend: `@sentry/node` initialized at top of app.ts before Express; reads SENTRY_DSN env var
- Frontend: `@sentry/react` initialized in main.tsx; reads VITE_SENTRY_DSN env var
- Both are no-ops if DSN not provided (graceful degradation)
- @opentelemetry/* packages must be installed as runtime deps (already external in build.mjs)
- Required peer deps: @opentelemetry/core, @opentelemetry/api, @opentelemetry/instrumentation, etc.

## Swagger / OpenAPI docs
- File: `artifacts/api-server/src/docs/swagger.ts` → `registerSwaggerDocs(app)` called in app.ts
- Accessible at: `GET /api/docs` (swagger-ui) + `GET /api/docs.json` (raw spec)
- Covers: Cases, Clients, Invoices, AI, 2FA, Billing, Admin, Security, Demo endpoints
- Custom Arabic CSS styling on Swagger UI

**Why:** These 4 features complete the SaaS readiness checklist (Demo, 2FA, Observability, API Docs)
**How to apply:** Add SENTRY_DSN + VITE_SENTRY_DSN secrets to enable Sentry; DEMO_EMAIL + DEMO_PASSWORD for custom demo creds
