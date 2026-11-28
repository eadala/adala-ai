# Live Production Risk Assessment

Probe: 2026-11-13T20:05:43Z UTC / 23:05 Asia/Riyadh. READ-ONLY.

## Application

| Signal | Result |
|---|---|
| `GET /api/health` → `/api/healthz` | HTTP 200 healthy |
| `GET /api/status` | overall **outage**; services: database/ai/storage/email/whatsapp **operational**; **payments outage** |
| `www.adalahai.com/api/health` | **503** `no available server` |
| Apex `adalahai.com` | Responds via Cloudflare |
| Auth / Clerk | Headers show Clerk signed-out on public health (expected) |
| Container restarts / CPU / latency | **UNVERIFIED** (no Coolify metrics) |

## Payments outage — root-cause analysis (code vs live)

Current repo `systemStatus.checkPayments()` (main/develop):

- Stripe/Moyasar key present → `operational`
- Live Stripe without webhook secret → `degraded`
- No gateway configured → **`degraded`** (not `outage`)

Live reports payments **`outage`**, which **does not match** current tip logic for “missing keys”.

| Hypothesis | Likelihood | Evidence |
|---|---|---|
| Production runs older build that returns `outage` for missing payments | INFERRED high | Live≠tip behavior |
| Custom/env-specific fork | UNVERIFIED | — |
| Stripe key present but different check path | UNVERIFIED | tip would still be operational/degraded |
| True provider outage | UNVERIFIED | no provider API probed (forbidden to use live keys) |
| **Live detail string** | VERIFIED | `Stripe غير مضبوط (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)` with status **outage** — tip code would emit **degraded** for missing keys → **production binary ≠ current main/develop tip** |

**Do not expose keys.** Operator should confirm which payment env vars exist (names only) and deployed SHA.

Commercial implication: payments not GO without config + verification. Noncommercial pilot can proceed with payments explicitly disabled if product accepts.

## WWW 503

| Hypothesis | Status |
|---|---|
| WWW hostname not mapped in Coolify / proxy | INFERRED |
| Cloudflare origin for `www` unhealthy | INFERRED |
| Apex OK via CF | VERIFIED probe |

No DNS/proxy changes made.

## PostgreSQL

| Item | Result |
|---|---|
| App-reported DB | operational (`/api/status`) |
| Direct PG version/connections/RLS | **UNVERIFIED** |
| Prod migration version applied | **UNVERIFIED** |

## Top risks

1. P0 — Unknown production SHA / Auto Deploy  
2. P0 — Payments reported outage (commercial)  
3. P1 — www 503  
4. P0-class — If prod≈main: inventing-default paths remain; GUC session leak  
5. P1 — Backup/restore unproven  
