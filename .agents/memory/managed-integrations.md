---
name: Managed Integrations Hub
description: Platform-managed integrations system — owner holds all keys, clients request activation via support tickets
---

## Architecture
- **Platform owner** manages all API keys centrally in `platform_integrations.config` (JSONB)
- **Clients** see locked/unlocked status based on plan, submit support requests — never touch keys
- **3 DB tables**: `platform_integrations` (catalog), `office_integration_status` (per-office), `integration_requests` (tickets)

## Routes
- `GET /api/integrations` — office view with plan-aware status
- `POST /api/integrations/request` — submit activation/help request
- `GET /api/integrations/my-requests` — office's own request history
- `GET /api/admin/integrations` — full catalog + stats
- `PUT /api/admin/integrations/:key` — update config/toggle/plan
- `POST /api/admin/integrations/:key/offices/:officeId` — activate for office
- `GET/PUT /api/admin/integration-requests` — manage client requests

## Integration Catalog (12 seeded)
ai, telegram, whatsapp, email, stripe, moyasar, sms, gdrive, webhook, esign, push, nafath

## Frontend
- `/integrations` — client-facing page (ProtectedRoute, lazy in App.tsx)
- `IntegrationsHubTab.tsx` — super admin tab (id: "integrations-hub")
- Nav item in layout.tsx under "مركز الاتصالات" section

## Key Pattern
`global_enabled` (admin toggle) + plan_required check + office_integration_status → 5 UI states: active/inactive/locked/pending/disabled

**Why:** SaaS security model — centralized key management prevents credential leakage and enables monetization through plan-gated integrations.
