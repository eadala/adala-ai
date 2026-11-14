# ARC Phase 2B Approval Security

## Controls

- Verified human identity (Bearer).
- Independent reviewer role required for approve.
- Platform Owner cannot bypass independent review (API + policy).
- Artifact-bound approval requests (commit SHA + image digest + env + policy version).
- Expiration window (7d) + self-approval rejection.
- AI agents cannot approve (INV-003 / INV-008).
- Audit events on request/decide/deny.
- Deployment execution disabled for every role.

## Status

**PASS**
