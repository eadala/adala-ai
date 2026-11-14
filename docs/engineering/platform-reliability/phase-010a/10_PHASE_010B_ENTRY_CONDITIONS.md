# Phase 010-B Entry Conditions

**010-B = live non-production object storage drill.**  
Do **not** start until every condition below is true.

## Hard blockers

1. Explicit written approval to contact non-prod object storage
2. Non-prod bucket exists and is isolated from production
3. Credentials issued via secret store (not chat/git)
4. Encryption setting confirmed on bucket
5. Disposable restore database host identified
6. Synthetic dataset prepared (no production dumps unless separately approved)
7. 009 freeze SHA still the review baseline (or delta reviewed)

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
