# Phase 010-B Entry Conditions

**010-B = live non-production object storage drill.**  
Do **not** start until every condition below is true.

**Governing draft:** `12_PHASE_010B_LIMITED_AUTHORIZATION_DRAFT.md`  
**Current authorization decision:** PENDING (DRAFT — NOT APPROVED)

## Hard blockers

1. Limited-authorization record **APPROVED** with all blanks filled (bucket, IAM, encryption, retention, cost ceiling, security reviewer, platform owner, authorizing person, date)
2. Explicit written approval to contact non-prod object storage (does **not** auto-extend to WAL/PITR, staging, or production)
3. Exact non-prod bucket identifier approved and isolated from production
4. Credentials issued via secret store only after independent security review for credential issuance (not chat/git)
5. Encryption setting confirmed on bucket
6. Retention and cleanup rules approved; disposable restore database host identified
7. Synthetic dataset prepared exclusively (no production dumps / customer / legal documents)
8. Cost ceiling approved
9. 009 freeze SHA `9e9468f7…` still the review baseline (or delta reviewed)
10. No git push/merge, no ARC, no production schedule changes

## 010-B test sequence (preview)

1. Upload synthetic backup artifact to non-prod bucket
2. List + download + checksum
3. Isolated restore to `adala_restore_*`
4. Integrity validation
5. Negative: missing key / corrupt bytes → FAIL
6. Cleanup remote synthetic object + disposable DB
7. Record evidence under `docs/engineering/platform-reliability/phase-010b/`

## Still NO-GO after 010-B alone

- Staging full migration/integration suite
- Production
- Push/merge/deploy unless separately authorized
