# Approval Matrix — Phase 010-A / 010-B gate

Signatures may remain blank; package is ready for review.

**Binding draft for 010-B limits:** `12_PHASE_010B_LIMITED_AUTHORIZATION_DRAFT.md`  
**Status of that draft:** DRAFT — NOT APPROVED — execution forbidden.

| Gate | Owner role | Required before | Status |
|------|------------|-----------------|--------|
| Accept 009 freeze SHA `9e9468f7…` as review baseline | Eng lead | 010-B | ☐ Pending |
| Exact non-prod bucket identifier | Platform / cloud owner | Create/configure bucket | ☐ Pending |
| Encryption configuration | Security | 010-B upload | ☐ Pending |
| Retention and cleanup rules | Legal + Eng | Lifecycle / post-drill cleanup | ☐ Pending |
| IAM least-privilege (test-only, no broad perms) | Security / IAM | Issue credentials | ☐ Pending |
| Cost estimate + spending ceiling | Finance / Eng | Live upload | ☐ Pending |
| Disposable synthetic data + restore target | Eng | Drill start | ☐ Pending |
| Independent security review for credential issuance | Security | Issue credentials | ☐ Not evidenced |
| Production RPO (A/B/C) | Business + Eng + Security | Production GO | ☐ UNDECIDED |
| 010-B test-scope RPO | — | — | **A** (workflow validation only; draft) |
| Authorize 010-B live non-prod test | Explicit human approval (filled auth record) | Any live R2 call | ☐ **BLOCKED / PENDING** |

## Mandatory restrictions (must appear on any signed 010-B auth)

No production access/data/credentials/buckets; no staging deploy; no git push/merge; no ARC; no production backup schedule changes; no WAL/PITR activation; no broad IAM; no deletion of unidentified resources; no real customer/legal documents.

## Independent review

009 report-based assessment is **not** a substitute for independent code/log review.

| Review | Status |
|--------|--------|
| Independent security review of reliability diff | ☐ Not evidenced |
| Independent engineering review of test logs | ☐ Not evidenced |
| Independent security review required for credential issuance | ☐ Not evidenced |

Block production until independent reviews are complete. Block 010-B until the limited-authorization record is APPROVED with all blanks filled.
