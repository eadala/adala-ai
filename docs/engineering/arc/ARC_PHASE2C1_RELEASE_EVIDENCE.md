# ARC Phase 2C-1 Release Evidence Validation

## Distinct facts

| Fact | Source | Must equal deploy identity? |
|---|---|---|
| Git commit SHA | Release inventory / GitHub commit | No |
| Git tree SHA | Release inventory / GitHub | No |
| CI workflow results | GitHub checks | No |
| Human review | ARC approvals / PR reviews | No |
| Container image digest | Build attestation | No |
| Deployed production identity | Coolify/runtime attestation only | — |

`classifyReleaseFacts()` and `GET /api/arc/evidence/:id` expose these separately.

Unknown production identity remains **UNVERIFIED**. GitHub success does not promote it.

## Status

**PASS** (correlation semantics) · Production Coolify attestation: **NOT_CONNECTED**
