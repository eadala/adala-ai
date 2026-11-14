# ARC Control Plane Isolation

## Separation

| Requirement | Status | Evidence |
|---|---|---|
| Customer ≠ ARC operator auth | VERIFIED | Separate `artifacts/arc-server` auth model |
| Customer APIs do not expose ARC admin | VERIFIED | No shared Express mount of ARC into api-server found |
| AI cannot deploy | VERIFIED | `deployment:execute` never granted; Coolify `executeDeploy: false` |
| GitHub read-only / deploy disabled | VERIFIED | Phase 2C-G / prelive suites |
| F-PRELIVE-001 network hardening | VERIFIED | Baseline 129/129; BASE_URL allowlist |
| Live validation authorized | NOT GRANTED | Dry-run only |
| ARC logs customer secrets | Mitigated redact scripts | Residual LOW |

## Customer data in ARC evidence

Live validation reports redact tokens; must not dump tenant case data — design intent VERIFIED; production observation NOT activated.

## Verdict

**ARC_CONTROL_PLANE_ISOLATION: PASS** for operational separation on this baseline. Does **not** imply customer SaaS tenant PASS.
