# Master Execution Plan — ADALA-032R→037

**DIRECTIVE_ID:** ADALA-MASTER-032R-037-ENGINEERING-EXECUTION  
**Program start (UTC):** 2026-11-23T19:14:00Z  
**Working branch:** `cursor/lineage-recovery-integration-032-da81`

## Phase order (mandatory)

| Phase | Name | State | Gate to next |
|-------|------|-------|--------------|
| 032R | Source-of-truth recovery | **AWAITING_AUTHORIZATION** | Trustworthy baseline OR approved reconstruction |
| 033 | Safe codebase integration | NOT_STARTED | INTEGRATION_CLOSED_LOCAL |
| 034 | Global UX/UI | NOT_STARTED | GLOBAL_UX_CLOSED_LOCAL |
| 035 | Intelligent legal ops | NOT_STARTED | LEGAL_OPS_CLOSED_LOCAL |
| 036 | Security/perf/reliability | NOT_STARTED | SECURITY_RELIABILITY_CLOSED_LOCAL |
| 037 | Release candidate | NOT_STARTED | RC_READY_FOR_HUMAN_REVIEW |

## Operating rules

- Preserve before changing; verify before trusting; test before advancing.
- No push / fetch / merge-to-main / deploy without separate approval.
- Synthetic data and local mocks only.
- Stop on P0, migration collision threat, or missing authorization.

## Current stop

Phase 032R cannot establish `EXACT_HISTORY_VERIFIED`. External access required.  
**Phase 033 is NOT eligible.**
