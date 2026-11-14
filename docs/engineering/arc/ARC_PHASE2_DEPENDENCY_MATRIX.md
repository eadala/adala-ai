# ARC Phase 2 Dependency Matrix

| Work item | Blocked by | Blocks | External dependency |
|-----------|------------|--------|---------------------|
| PR-01 Identity | Human IdP decision | PR-02, PR-05, PR-06/07 auth | Clerk/OIDC tenant for operators |
| PR-02 AuthZ | PR-01 | Mutating APIs hardening | — |
| PR-03 Audit DB | ARC DB choice | PR-04/08 persistence | Dedicated ARC DB (not customer) |
| PR-04 Policy persist | PR-03 | PR-05 binding | — |
| PR-05 Approvals | PR-01–04 | Human workflow | — |
| PR-06 GitHub | PR-01 token vault | Evidence automation | Fine-grained PAT/GitHub App |
| PR-07 Coolify RO | PR-01; staging Coolify | Prod metadata later | Staging Coolify token |
| PR-08 Monitoring | PR-03 | Ops UX | Optional probe network |
| PR-09 Tests | F-001/F-002 fixes | Merge gate | CI |
| PR-10 Staging ARC | PR-01–09 | Prod enablement planning | Staging host |

## Parallelism

Docs/UI polish || PR-03 schema design can overlap PR-01 design reviews carefully.
