# Phase 049 — Capability Recovery Matrix

Evidence grounded in tip `cursor/phase-049-engineering-continuity-da81` (post Phase 049 AI gateway fix).  
Statuses are behavioral/code-path classifications — not “file exists” alone.

| Capability | Evidence location | Status | Missing deps | Security implications | User/business impact | Recovery effort | Priority | Recommended action |
|---|---|---|---|---|---|---|---|---|
| Multi-tenant org / offices | `modules/platform`, `middlewares/tenantMiddleware.ts`, migrations 001–061 | IMPLEMENTED_AND_VERIFIED (code paths present; full live harness not re-run this session) | Live DB for full RLS suite | Core isolation | Blocks all SaaS use if broken | Low–Med verify | P0 verify | Keep fail-closed; re-run tenant/RLS harness before prod |
| Law firm onboarding | office/invitation routes; migration `058_invitations_*` | PARTIALLY_IMPLEMENTED | E2E onboarding fixture | Invite token misuse | Onboarding friction | Med | P1 | Add invitation flow integration tests |
| Clerk auth | `middlewares/requireAuth.ts`, `clerkProxyMiddleware.ts` | IMPLEMENTED_AND_VERIFIED (code) | Clerk secrets in env | Auth bypass if misconfigured | Login | Low verify | P0 | No weaken; smoke auth tests in CI |
| RBAC | auth modules, role checks in routes | PARTIALLY_IMPLEMENTED | Centralized policy matrix doc | Privilege escalation | Wrong role access | Med | P1 | Inventory role gates per module |
| Tenant-aware APIs / DB | `core/tenantContext.ts`, RLS migrations 059–060 | IMPLEMENTED_BUT_DEFECTIVE historically; tip includes fail-closed empty tenant | Harness DB | Cross-tenant leak | Catastrophic | High if gaps remain | P0 | Continuous tenant isolation tests |
| Subscription / billing | financial + stripe/moyasar modules | PARTIALLY_IMPLEMENTED | Gateway abstraction completeness | Payment fraud / leakage | Revenue | Med–High | P1 | Complete gateway abstraction + idempotency tests |
| Clients / matters / cases | `modules/legal-core` | IMPLEMENTED_AND_VERIFIED (schema + routes present) | Full UI E2E | Case data exposure | Core product | Med | P0 | Keep pagination/authz; smoke paths |
| Documents | `modules/documents`, storage providers | PARTIALLY_IMPLEMENTED | R2 config | Cross-tenant file retrieval | Document loss/leak | Med | P0 | Enforce ownership ACL tests |
| Tasks / deadlines / hearings | legal-core / JLWM / calendar migrations | PARTIALLY_IMPLEMENTED | Calendar E2E | Missed deadlines liability | Practice ops | Med | P1 | Stabilize JLWM + calendar schema authority tests |
| Financial / admin | `modules/financial`, migration 061 | PARTIALLY_IMPLEMENTED | Ledger harness | Money integrity | Trust | High | P0 | Idempotent financial ops + authz |
| AI gateway + routing | `modules/ai/aiGateway.ts`, `lib/aiGatewayTenant.ts` | IMPLEMENTED_BUT_DEFECTIVE → **fixed fail-closed in 049** | Provider keys | Cross-tenant cache/analytics | AI trust | Low (done) | P0 | Maintain `test:ai-gateway-tenant` |
| AI credits / metering | migrations + `test:ai-credits-039` | PARTIALLY_IMPLEMENTED | Billing linkage | Usage theft | Cost control | Med | P1 | Wire metering to gateway calls |
| Legal AI assistant | AI gateway prompts | PARTIALLY_IMPLEMENTED | Guardrails evals | Hallucination / privilege | Lawyer UX | Med | P1 | Add attribution + audit |
| RAG / knowledge retrieval | migration `021_rag_schema_foundation.sql` only; **no runtime RAG service routes found** | MISSING (runtime) | Indexing pipeline, authz, embeddings | Unscoped retrieval | Core AI differentiation | High | P0 product | Reconstruct RAG only with authz design — do not claim Phase 018–030 recovered |
| Knowledge ingestion / attribution | schema fragments only | MISSING | Same as RAG | Evidence integrity | Compliance | High | P0 | Spec then implement |
| AI auditability | ai events/agents schema tests 041–042 | PARTIALLY_IMPLEMENTED | End-to-end audit sink | Non-repudiation gap | Enterprise sales | Med | P1 | Ensure every AI call writes audit |
| Migrations | `artifacts/api-server/migrations/*.sql` (59 files; tip through **061**) | PARTIALLY_IMPLEMENTED | 062–075 absent per prior backlog | Drift / collision | Deploy risk | High | P0 | Forward-only; never invent lost history |
| Background jobs / cron | `cron/agentCron.ts` | PARTIALLY_IMPLEMENTED | Overlap locks verified in prior work | Duplicate side effects | Reliability | Med | P1 | Idempotency review |
| Logging / observability | monitoring module + migration 057 | PARTIALLY_IMPLEMENTED | Prod exporters | Blind spots | Ops | Med | P2 | Keep tenant isolation on metrics |
| Storage integration | R2 provider, ACL helpers | PARTIALLY_IMPLEMENTED | Credentials | File leak | Documents | Med | P0 | ACL regression tests |
| Backup / recovery | Phoenix 046 private backup; `scripts/engineering/*` | PARTIALLY_IMPLEMENTED → automation improved in 049 | Owner auth for remote push | Loss of work | Continuity | Med | P0 | Local bundles verified; remote gated |
| Security testing | schema authority + gateway tenant tests | PARTIALLY_IMPLEMENTED | Full adversarial suite | False confidence | Trust | Med | P0 | Expand isolation tests |
| CI verification | `.github/workflows/ci.yml` | PARTIALLY_IMPLEMENTED | Stable runners | Blind merge | Velocity | Med | P1 | Ensure CI on this branch |

## Priority summary — missing / defective

1. **RAG runtime + authz** — MISSING (schema-only).  
2. **Migrations 062–075** — MISSING; treat as unknown product scope, not recovered.  
3. **AI gateway tenant fallback** — addressed in this phase (fail-closed).  
4. **Remote milestone backup** — automation ready; transfer **not** authorized/performed for 049.  
5. **Full live RLS/API harness** — BLOCKED without dedicated test DB in this session where unavailable.

## Explicit non-claims

- Phase 018–030 source history is **not** declared recovered.  
- Presence of migration `021` does **not** equal RAG product capability.
