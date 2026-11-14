# Tenant Attack-Surface Inventory

**Legend:** VERIFIED / FAILED / BLOCKED / NOT_APPLICABLE / NOT_TESTED

| Surface | Entry | Auth | Tenant source | Enforcement | Tests | Residual |
|---|---|---|---|---|---|---|
| REST `/api/*` | `app.ts` routers | Clerk + `requireAuthWithTenant` (most) | `resolveTenantId` + ALS | App WHERE + intended RLS | Partial static | Pool GUC FAILED |
| Health `/api/healthz` | `app.ts` | None | N/A | N/A | N/A | NOT_APPLICABLE |
| Stripe webhook | `POST /api/stripe/webhook` | Signature | Privileged bypass after verify | `setBypassRlsSession` | Static wiring | Pool clear race FAILED |
| Moyasar webhook | `POST /api/webhook/moyasar` | Optional HMAC | `body.metadata.office_id` | Weak | Static FAIL evidence | **FAILED** |
| WhatsApp webhook | `POST /api/webhook/whatsapp` | Meta HMAC | Mapping | Signature required | NOT_TESTED runtime | MEDIUM residual |
| SSE events | `operations/events.ts` | Auth + `resolveTenantId` | Header validated | Source asserts | Static | NOT_TESTED live |
| GraphQL | — | — | — | — | — | NOT_APPLICABLE (absent) |
| WebSocket | CSP allows `wss:` | — | — | — | — | NOT_TESTED (no dedicated WS router found in audit window) |
| Background / cron | Various services | System | Mixed | NOT_TESTED comprehensively | NOT_TESTED | HIGH residual |
| Object storage | `operations/storage.ts` | `requireAuthWithTenant` | Office ownership helpers | Signed URL + DB ownership | Static signed-open | NOT_TESTED cross-tenant runtime |
| AI gateway | `security/ai-data-gateway.ts` | Caller-supplied `tenantId` | Query `office_id` filter | App SQL | Source VERIFIED pattern | Caller trust NOT_TESTED E2E |
| RAG / vectors | Schema migrations AI | — | — | — | NOT_TESTED | UNVERIFIED |
| Search FTS | messages FTS | Tenant middleware | Office filters | Partial tests | Partial | NOT_TESTED adversarial |
| Cache (tenant map) | `tenantMiddleware` TTL 5m | — | In-memory | Membership cache | Source | Revocation delay MEDIUM |
| Billing / Stripe buffer | `stripeEventBuffer.ts` | Signature path | Bypass GUC | Static | Pool leak applies | FAILED containment |
| Client portal | `marketplace/client-*` | Clerk + resolveTenant | Header + membership | Fail-closed helpers | Static | NOT_TESTED E2E |
| Super-admin dashboards | `modules/platform/*` | `requireSuperAdmin` | Bypass | Intentional cross-tenant | Static | Boundary VERIFIED intent |
| ARC APIs | `artifacts/arc-server` | ARC roles | Separate | Deploy disabled | 129/129 | VERIFIED separation |
| Audit logs | Multiple | Mixed | office_id | NOT_TESTED | NOT_TESTED | — |
| Exports / backups | `platform/backup.ts` | SA / tenant checks | Path + snapshot tenantId | Source checks | NOT_TESTED adversarial | Residual |

Do not invent modules: GraphQL not present. Full route enumeration exceeds static sample — treat unmarked customer REST as **inventoried-class but NOT_TESTED object-level**.
