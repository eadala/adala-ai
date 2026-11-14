# HTTP Adversarial Tests

**Harness:** `artifacts/api-server/src/tests/runtime/httpAdversarialHarness.ts`  
**Environment:** Express app (real routers/middleware) + `adala_tenant_runtime` as `adala_app`  
**Auth:** `ADALA_HTTP_SECURITY_TEST` + `X-Adala-Test-Auth` fixtures  
**Command:** `pnpm run test:http-adversarial` (via gate)  
**Exit:** 0 — PASS  

| Test ID | Threat | Path | Expected | Actual | Exit |
|---|---|---|---|---|---|
| OFFICE_IDOR_CROSS | Cross-office IDOR | GET `/api/office/my/{B}/services` as A | 403 | 403 OFFICE_FORBIDDEN | 0 |
| OFFICE_SAME_TENANT | Positive control | GET services A as A | 200 + A rows | 200 | 0 |
| MULTI_OFFICE_SELECT_B | Legitimate multi-office | GET B as multi | 200 | 200 | 0 |
| PAYMENTS_LIST_A | Payment isolation | GET `/api/payments/transactions` | 200 no B ids | 200 | 0 |
| FORGED_HEADER | Forged x-tenant-id | header B as A | 401/403 | 403 PLATFORM_FORBIDDEN | 0 |
| REVOKED_MEMBER | Revoked membership | A as revoked | 401/403 | 403 | 0 |
| AI_CREDITS_CROSS_BODY | Cross-tenant credit body | POST deduct body.officeId=B | B balance unchanged | unchanged | 0 |
| AI_AGENT_LOGS_A | Cross-tenant agent logs | GET logs as A | no log-b | pass | 0 |
| WHATSAPP_UNSIGNED | Unsigned webhook | POST webhook | 403 | 403 | 0 |
| WHATSAPP_CROSS_STATUS | Provider id cross-tenant | signed status phone-b → msg-a | msg-a status unchanged | received | 0 |
| ROLE_LAWYER_SAME | Role access | lawyer A services | 200 | 200 | 0 |
| ROLE_ACCOUNTANT_SAME | Role access | accountant A | 200 | 200 | 0 |
| PAYMENTS_PAGINATION_A | Cross-tenant pagination | limit/offset | no B | pass | 0 |
| AI_WORKFLOWS_SCOPED | Search/agg scope | workflows | no wf-b | pass | 0 |
| MISSING_AUTH | Missing auth | no headers | 401 | 401 | 0 |
| UNAUTHORIZED_USER | No membership | user-none | 401/403 | 403 | 0 |
| CONFLICT_PATH_TENANT | Conflicting ids | path B + tenant A | 403 | 403 | 0 |
| PRIV_ESC_AI_ADMIN | Privilege escalation | admin AI credits as owner | 401/403 | 401 | 0 |

Evidence: `evidence/http-adversarial.log`
