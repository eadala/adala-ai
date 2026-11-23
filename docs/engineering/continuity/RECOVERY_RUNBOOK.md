# Adala AI — Recovery Runbook

## Local clean Phase 031 restore

```bash
BUNDLE=docs/engineering/operation-phoenix-040x/evidence/bundles/phase-031-clean.bundle
sha256sum -c ${BUNDLE}.sha256
./scripts/engineering/backup-integrity.sh "$BUNDLE" \
  8685f64a6ddb4d983f030b8c1b7b6e1607c6dc6b \
  ea8b8e85510bf68787b64a5de29f079f443f0a1a
```

## Off-environment (after authorized private backup)

1. Clone/fetch from verified-private `eadala/adala-ai-secure-backup` branch `backup/phase-031-8685f64a`.  
2. Assert commit/tree.  
3. Confirm contaminated blob `3f1a3e36…` absent.  
4. Record `OFF_ENVIRONMENT_RECOVERY_VERIFIED`.

Never push to public `eadala/adala-ai` as a backup action.
