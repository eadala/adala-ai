# ARC Phase 2A Finding Closure

## F-001 — Forgeable X-ARC-Role

| | |
|--|--|
| **Root cause** | `optionalAuth` trusted `X-ARC-Role` over registry role |
| **Code changes** | Removed role header trust; `verifyBearerCredential` returns `role_header_forbidden` if header present; roles only from `OPERATOR_REGISTRY` |
| **Regression tests** | phase2a #1, #9, legacy token test |
| **Reproduction evidence** | Smoke: Bearer(auditor)+`X-ARC-Role: production_operator` → **403** `role_header_forbidden` |
| **Closure status** | **CLOSED** |
| **Residual risk** | Local HMAC secret default — must set `ARC_IDENTITY_SECRET` before any shared deploy; IdP still future work |

## F-002 — AI agent deployment request 202

| | |
|--|--|
| **Root cause** | `/deployments/request` used `requireAuth` without permission check |
| **Code changes** | `requirePermission("deployment:request")`; AI role has no such permission; also blocked approval/policy/roles/credentials |
| **Regression tests** | phase2a #5–7, AI roles/credentials |
| **Reproduction evidence** | Smoke: AI Bearer → deploy request **403** missing `deployment:request` |
| **Closure status** | **CLOSED** |
| **Residual risk** | None for request path; keep matrix reviews in CI |

## Deploy isolation

Still **DISABLED** for all roles including platform_owner (`deployment:execute` absent from matrix + hard 403).
