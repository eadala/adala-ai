# Backup Storage Readiness

## Local emulator

- Provider: `STORAGE_PROVIDER=local` → `localFsProvider.ts`
- Root: `LOCAL_STORAGE_ROOT` (required)
- No R2/live credentials used
- Atomic write via `.partial` + rename
- Path traversal rejected
- Metadata includes size/sha256/encryption label

## Verified locally

| Check | Result |
|-------|--------|
| Artifact naming (`backups/full/full-*.dump.enc`) | PASS |
| Integrity round-trip checksum | PASS |
| Upload/list/download/delete | PASS |
| Missing download fails | PASS |
| Unsafe key rejected | PASS |
| Credential isolation (no R2 secrets) | PASS |
| Retention env surface | PASS |
| Restore-from-storage → isolated restore | PASS |

Harness: `pnpm exec tsx src/tests/runtime/integrationGate009Harness.ts`  
Evidence: `evidence/local-storage-harness.json`
