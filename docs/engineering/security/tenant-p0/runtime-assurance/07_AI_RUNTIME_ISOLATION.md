# AI Runtime Isolation

**Harness:** `aiRuntimeIsolationHarness.ts`  
**Exit:** 0 — PASS (live model skipped by design)

| Test ID | Class | Result |
|---|---|---|
| AI_CREDIT_FORGED_TENANT_BODY | tool-boundary | PASS — B balance unchanged |
| AI_AGENT_FORGED_HEADER | tool-boundary | PASS — HTTP 403 |
| AI_AGENT_LOGS_SCOPED | tool-boundary | PASS — no log-b |
| AI_PROMPT_INJECTION_TENANT_SWITCH | prompt-injection-sim | PASS — intent unknown; B credits unchanged |
| AI_TOOL_UNAUTH | tool-boundary | PASS — 401 |
| AI_UNSCOPED_USER | tool-boundary | PASS — 403 |
| AI_LIVE_MODEL | live-model-not-run | SKIPPED_BY_DESIGN |

Model responses are untrusted. Tool paths bind `req.tenantId` from middleware, not prompt text.

Evidence: `evidence/ai-runtime.log`
