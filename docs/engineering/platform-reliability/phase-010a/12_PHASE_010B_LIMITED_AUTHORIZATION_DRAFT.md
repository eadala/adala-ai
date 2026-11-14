# ADALA AI — PHASE 010-B LIMITED AUTHORIZATION

**Document status: DRAFT — NOT APPROVED**

**Reference baseline:** `9e9468f78e025129deb8ef5a32c00c5ddabc9598`  
**Phase 010-A:** SPECS_READY  
**Phase 010-B:** PENDING EXPLICIT HUMAN APPROVAL  
**Authorization decision:** PENDING  
**Production readiness:** NO-GO

This file records the limited-authorization draft supplied for human review.  
Filing it does **not** authorize execution. Live R2 contact remains forbidden until the authorization record below is completed and the decision is changed from PENDING.

---

## 1. Authorized scope upon signature

Permit only the following activities in a designated non-production environment:

1. Create or configure one dedicated R2 test bucket.
2. Issue restricted, test-only credentials.
3. Generate a PostgreSQL logical backup containing synthetic data exclusively.
4. Upload the backup to the approved test bucket.
5. Verify checksum and artifact metadata.
6. Download the backup from R2.
7. Restore into a disposable, isolated PostgreSQL database.
8. Validate restored schema and data integrity.
9. Test controlled upload, download, and corruption failures.
10. Delete only specifically identified synthetic test artifacts after verification.

---

## 2. Mandatory restrictions

- No production access.
- No production data.
- No production credentials.
- No production bucket access.
- No staging deployment.
- No Git push or merge.
- No activation of ARC deployment.
- No changes to production backup schedules.
- No activation of WAL/PITR.
- No broad IAM permissions.
- No deletion of unidentified resources.
- No transfer of real customer or legal documents.

---

## 3. Preconditions

Execution must not begin until:

- The exact bucket identifier is approved.
- IAM permissions are reviewed and approved.
- Encryption configuration is approved.
- Retention and cleanup rules are approved.
- Estimated cost and spending limit are approved.
- Test data and restore target are confirmed disposable.
- The independent security review required for credential issuance is complete.
- Explicit authorization is recorded.

---

## 4. Recovery objective decision

**For Phase 010-B:**

Option **A** — logical backup, limited to validating the storage-and-restore workflow.

**For production:**

RPO: **UNDECIDED**.

WAL/PITR requires a separate architecture decision and authorization.

---

## 5. Acceptance criteria

Phase 010-B may be marked PASS only if:

- A real non-production R2 upload succeeds.
- The uploaded artifact is independently downloaded.
- Integrity verification passes.
- A real PostgreSQL restore succeeds.
- Restored data matches expected integrity markers.
- Corrupted artifacts are rejected.
- Failed operations return failure rather than false success.
- No prohibited resource is accessed.
- Test resources are accounted for and cleaned up according to the approved policy.
- Evidence is recorded without exposing credentials.

---

## 6. Authorization record

| Field | Value |
|-------|--------|
| Approved bucket | __________________ |
| Approved IAM policy reference | __________________ |
| Approved encryption method | __________________ |
| Approved retention | __________________ |
| Approved cost ceiling | __________________ |
| Security reviewer | __________________ |
| Platform owner | __________________ |
| Authorizing person | __________________ |
| Approval date | __________________ |
| Authorization decision | **PENDING** |
| Production readiness | **NO-GO** |

---

## 7. Execution hold

Until Authorization decision = **APPROVED** with all blanks filled:

- Do not create the R2 bucket from this agent session unless separately ordered after approval.
- Do not issue or request live credentials in chat.
- Do not upload, download, or restore against live object storage.
- Do not push, merge, or deploy.
