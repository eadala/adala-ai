# Production Environment Reference (Sanitized)

**Never paste real secrets into git, chat, or logs.**

---

## Required for controlled launch

| Variable | Purpose | Production shape | Verification |
|----------|---------|------------------|--------------|
| `DATABASE_URL` | PostgreSQL | Private connection string | `GET /api/healthz` + schema verify |
| `CLERK_SECRET_KEY` | Auth | `sk_live_*` | Login E2E |
| `VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_PUBLISHABLE_KEY` | Auth FE | `pk_live_*` | Login E2E |
| `STRIPE_SECRET_KEY` | Payments | `sk_live_*` | Checkout session create |
| `STRIPE_WEBHOOK_SECRET` | Webhook verify | `whsec_*` | Signed webhook 200 |
| `STRIPE_PUBLISHABLE_KEY` / `VITE_STRIPE_PUBLISHABLE_KEY` | Checkout FE | `pk_live_*` | Checkout UI |
| `PRODUCTION_URL` or `APP_URL` | Public origin | `https://adalahai.com` | Webhook registration |
| `GEMINI_API_KEY` | Primary AI | Valid Gemini key | `/api/ai-models/available` + chat |
| `R2_BUCKET_NAME` | Object storage | Bucket name | Upload |
| `R2_ENDPOINT` | R2 S3 API | `https://<acct>.r2.cloudflarestorage.com` | Upload |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 creds | Access keys | Signed URL |
| `HEAL_SECRET` | Auto-heal webhook | ≥12 chars, unique | `POST /internal/heal` with Bearer |

## Optional / channel-dependent

| Variable | When needed |
|----------|-------------|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Extra AI providers |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push |
| `BACKUP_ENCRYPTION_KEY` | Encrypted backups |
| Telegram / WhatsApp bot tokens | Only if product promises those channels |

## Stripe webhook path (canonical)

**Registered application route:** `POST /api/stripe/webhook`  
(Do not configure Dashboard to a non-existent `/api/billing/stripe-webhook` unless a redirect exists.)

## Migrations to confirm on production

Confirm **053 → 057** already applied. Then after updated app deploy, apply **058 → 059 → 060** (approved operator only):

```text
053_security_centers_schema_authority.sql
054_platform_runtime_schema_authority.sql
055_platform_runtime_b2_schema_authority.sql
056_rls_runtime_schema_authority.sql
057_monitoring_isolation_rls_schema_authority.sql
058_invitations_office_id_schema_authority.sql
059_rls_fail_closed_empty_tenant.sql
060_vault_rls_fail_closed.sql
```

Preflights: `scripts/db/preflight-migration-058.sql` … `060.sql`.  
Role inventory (read-only): `scripts/db/prod-rls-role-inventory.sql`.

**Do not apply from this agent without explicit human authorization.**

## Config checklist (presence only — never paste values)

| Area | Required | Agent status |
|------|----------|--------------|
| Clerk live keys | Yes | **NOT VERIFIED** |
| Stripe live + webhook → `/api/stripe/webhook` | Yes | **NOT VERIFIED** |
| Gemini | Yes (AI) | **NOT VERIFIED** |
| Cloudflare R2 | Yes (docs) | **NOT VERIFIED** |
| `HEAL_SECRET` ≥12 | Yes for heal | **NOT VERIFIED** |
| PostgreSQL `DATABASE_URL` | Yes | **NOT VERIFIED** (unset in agent) |
| Coolify deploy target | Yes | **NOT VERIFIED** |
| HTTPS / domain | Yes | **NOT VERIFIED** |
| Monitoring / healthz | Yes | **NOT VERIFIED** |

## Agent environment note

This Cloud Agent VM does **not** hold production secrets (`DATABASE_URL` unset). Config validation against live Coolify/Hetzner is a human/ops step.
