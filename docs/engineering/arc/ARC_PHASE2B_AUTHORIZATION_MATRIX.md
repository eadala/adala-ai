# ARC Phase 2B Authorization Matrix

Deny-by-default. `deployment:execute` is **never** granted (Phase 2A/2B invariant).

| Permission | Owner | Release Mgr | Ind. Reviewer | Prod Op | Auditor | AI Agent |
|---|---|---|---|---|---|---|
| *:read (ops) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| audit:read | ✓ | ✓ | ✓ | | ✓ | |
| approval:request | ✓ | ✓ | | ✓ | | |
| approval:decide | | | ✓ | | | |
| deployment:request | ✓ | ✓ | | ✓ | | |
| deployment:execute | | | | | | |
| policy/roles/credentials:modify | | | | | | |

## Hard rules

- AI agent: no approval, deployment, policy, roles, credentials (INV-003).
- Independent reviewer required for approval grant; Platform Owner cannot bypass (INV-008).
- Self-approval rejected.

## Status

**PASS** — `assertNoExecuteGrants()` + regression tests.
