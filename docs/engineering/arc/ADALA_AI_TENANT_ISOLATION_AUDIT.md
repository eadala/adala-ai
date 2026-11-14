# AI Tenant Isolation Audit

## Modules reviewed

| Module | Path | Status |
|---|---|---|
| AI data gateway | `security/ai-data-gateway.ts` | VERIFIED: `assertTenant` + `office_id` predicates on listed queries |
| Case AI / copilot | `case/case.ai.ts`, `copilot/case.intelligence.ts` | PARTIAL source — tenant args present in samples; full tool matrix NOT_TESTED |
| Support AI | `platform/support-ai.ts` | NOT_TESTED adversarial |
| Credits / usage | schema + services | NOT_TESTED adversarial |
| RAG / embeddings | migrations / services | NOT_TESTED |
| Vector search | — | NOT_TESTED |
| Conversation memory | — | NOT_TESTED comprehensively |

## Prompt injection

Application retrieval appears SQL-scoped when gateway helpers are used. **Prompt text is not an authorization control** — VERIFIED principle in design comments.

No end-to-end prompt-injection suite executed this audit → cannot claim AI isolation PASS.

## Privileged tool / ARC access via AI

ARC `ai_agent` lacks `deployment:execute` — VERIFIED (ARC tests). Customer AI reaching ARC admin APIs: no shared route found — VERIFIED separation intent.

## Verdict

**AI_TENANT_ISOLATION: UNVERIFIED** (strong gateway patterns; incomplete E2E/RAG/credit/cache proof).
