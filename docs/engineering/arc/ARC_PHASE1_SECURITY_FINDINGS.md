# ARC Phase 1 Security Findings

**Audit:** ARC-SEC-AUDIT-001  
**CRITICAL findings:** **0**  
**Rule:** No CRITICAL → continue; no production-changing bypass found.

---

## ARC-F-001 — Shared static token + client-supplied role header

| | |
|--|--|
| **Severity** | **HIGH** |
| **Component** | `artifacts/arc-server/src/lib/auth.ts` |
| **Evidence** | `X-ARC-Role` overrides `KNOWN[opId].role` when `X-ARC-Token` matches default `arc-local-dev-token`. Adversarial probe: operator `auditor` + role `production_operator` reached execute handler (then 403 disabled). |
| **Reproduction** | `curl -X POST …/deployments/execute -H x-arc-token:arc-local-dev-token -H x-arc-operator:auditor -H x-arc-role:production_operator` → **403 deployment_disabled** (authz bypassed; deploy still impossible). |
| **Root cause** | Phase 1 mock identity; browser-trusted role claim |
| **Exploitability** | High **if** ARC were network-exposed with default token; mitigated by `listen(127.0.0.1)` and no provider execute path |
| **Business impact** | Undermines approval SoD integrity for any future enablement |
| **Remediation** | PR-01/PR-02: real authN; server-side role binding; remove role header override |
| **Regression tests** | Role header must not elevate; unknown tokens 401 |
| **Acceptance** | Operator role derived only from verified identity store/IdP |

---

## ARC-F-002 — `/deployments/request` allows any authenticated role including `ai_agent`

| | |
|--|--|
| **Severity** | **HIGH** |
| **Component** | `routes/api.ts` `POST /deployments/request` — `requireAuth` only |
| **Evidence** | Probe: `ai_agent` → **HTTP 202** accepted |
| **Root cause** | Missing `requireRoles` on request endpoint |
| **Exploitability** | Low for prod change (execution disabled); pollutes audit/process |
| **Remediation** | Restrict to release_manager / platform_owner / production_operator; reject `ai_agent` |
| **Regression tests** | ai_agent and auditor → 403 on request |

---

## ARC-F-003 — Permissive CORS (`origin: true`)

| | |
|--|--|
| **Severity** | **MEDIUM** |
| **Component** | `app.ts` `cors({ origin: true })` |
| **Evidence** | OPTIONS with `Origin: https://evil.example` → `Access-Control-Allow-Origin: https://evil.example` |
| **Root cause** | Dev-friendly CORS |
| **Impact** | Browser cross-origin calls if ARC ever served with cookies/sessions |
| **Remediation** | Allowlist console origin only |
| **Regression** | Foreign origin denied |

---

## ARC-F-004 — Audit log is in-memory only

| | |
|--|--|
| **Severity** | **MEDIUM** |
| **Component** | `lib/store.ts` |
| **Evidence** | Process restart clears `auditEvents`; code sets `immutabilityClaim: false` |
| **Impact** | No durable forensics; not tamper-evident across restarts |
| **Remediation** | PR-03 durable append-only store |
| **Note** | Docs correctly avoid claiming immutability — **INFORMATIONAL credit** |

---

## ARC-F-005 — Kill-switch env still hard-denies but message claims policy evaluation

| | |
|--|--|
| **Severity** | **LOW** |
| **Component** | `POST /deployments/execute` when `ARC_ENABLE_DEPLOYMENT_EXECUTION=true` |
| **Evidence** | Still HTTP 403 `deployment_blocked_by_policy` **without** calling Coolify or `evaluateReleasePolicy` |
| **Impact** | Confusing ops message; **security outcome is safe** (no execute) |
| **Remediation** | Clarify dead-end Phase 1 stub; never add provider call without full gate+approval |

---

## ARC-F-006 — No frontend automated tests

| | |
|--|--|
| **Severity** | **LOW** |
| **Component** | `artifacts/arc-console` |
| **Evidence** | No `*.test.*` under arc-console; FE typecheck/build only |
| **Remediation** | PR-09 UI contract tests for UNVERIFIED labels |

---

## INFORMATIONAL

| ID | Note |
|----|------|
| ARC-I-001 | No webhook handlers — replay/signature scenarios **NOT_RUN** (no surface) |
| ARC-I-002 | `CoolifyAdapter.executeDeploy` hardcoded `false`; live credentials still return UNAVAILABLE without HTTP |
| ARC-I-003 | Bind `127.0.0.1` only — good Phase 1 network isolation |
| ARC-I-004 | Workspace `pnpm audit` noise includes api-server paths; not ARC-specific CRITICAL |

## CRITICAL

None identified for unauthorized **production-changing** operations in Phase 1 code paths reviewed.
