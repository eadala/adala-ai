---
name: Adala Integrations Audit
description: Security audit findings and fixes for all external integrations (WhatsApp, Telegram, Stripe, Moyasar, SMTP)
---

# Integration Security Audit — June 2026

## Summary of Findings

### WhatsApp
- **FIXED**: All routes now use `requireAuthWithTenant` + real `tenantId` (was `'default'`)
- **FIXED**: `POST /webhook/whatsapp` — added `X-Hub-Signature-256` HMAC-SHA256 verification using `WHATSAPP_APP_SECRET` env var; uses `crypto.timingSafeEqual`; logs warning if env var not set
- **REMAINING**: `auth_token` / `meta_token` stored as plaintext in DB (requires AES encryption — deferred, major refactor)
- **REMAINING**: No per-office rate limit on outbound sends

### Telegram
- **FIXED**: All routes use real `tenantId` (was `'default'`)
- **FIXED**: `notifyTelegramCaseStatus()` now resolves `officeId` from case data (`updatedCase.office_id ?? 'default'`)
- **REMAINING**: `bot_token` stored as plaintext in DB

### Stripe
- ✅ CLEAN: Webhook signature via `stripe.webhooks.constructEvent()` — mandatory, rejects without `STRIPE_WEBHOOK_SECRET`
- ✅ CLEAN: Idempotency (stripe_events table) + DLQ (stripe_dead_letters) + retry backoff
- ✅ CLEAN: No card data touches server (Stripe Elements/Checkout)
- ✅ CLEAN: Platform key in env vars; per-office via Stripe Connect

### Moyasar
- **FIXED**: Signature now uses `crypto.timingSafeEqual` — prevents timing attacks
- **FIXED**: Missing signature header now returns 403 (was: processed anyway if sig was empty string)
- **FIXED**: Warning log when `webhook_secret` not configured for an office
- **REMAINING**: `secret_key` / `webhook_secret` stored as plaintext in DB

### Checkout.com
- Settings table exists; no webhook endpoint implemented (just outbound API calls)
- `secret_key` stored as plaintext in DB

### SMTP / Email Notifications
- **FIXED**: All routes use real `tenantId` (was `'default'`)
- **REMAINING**: `smtp_pass` stored as plaintext in DB

## Key Env Var Required
- `WHATSAPP_APP_SECRET` — Meta App Secret for incoming webhook verification; must be set before go-live
- `STRIPE_WEBHOOK_SECRET` — already enforced (rejects if missing)
- Moyasar: configure `webhook_secret` per office in DB; warning logged if missing

## Architecture Pattern for rawBody in WhatsApp Webhook
- Uses `(req as any).rawBody ?? Buffer.from(JSON.stringify(req.body))` for HMAC
- For this to work with the raw bytes Meta sends, app.ts must capture rawBody before JSON parsing on this route
- If strict verification fails, check that `express.raw()` or a rawBody capture middleware is applied to `/webhook/whatsapp`

## Deferred: API Key Encryption
- All provider tokens in DB are plaintext (auth_token, bot_token, smtp_pass, secret_key)
- Requires AES-256-GCM wrapper around DB read/write + `ENCRYPTION_KEY` env var
- Low risk in current setup: DB access requires server credentials (not directly exposed to tenants)
- Recommend implementing before enterprise/multi-region scale
