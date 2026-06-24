---
name: Adala Document Center
description: Enterprise Object Storage migration — DocumentStorageService + /document-center page + migration worker
---

## Architecture

**Service**: `src/services/documentStorage.ts` — wraps Replit Object Storage (same client as backupStorage.ts).
- Uses `objectStorageClient` from `lib/objectStorage.ts` + sidecar at `http://127.0.0.1:1106`
- Key pattern: `docs/{officeId}/{folder}/{uuid}_{filename}`
- Signed URLs via POST to `/object-storage/signed-object-url` on sidecar
- `uploadBuffer()` / `uploadBase64()` / `getSignedUrl()` / `getUploadUrl()` / `deleteFile()` / `migrateBase64ToStorage()`

**API**: `src/modules/documents/documentCenter.ts` — 14 routes at `/document-center/*`
- Registered in `routes/index.ts` via `router.use(documentCenterRouter)`
- `ensureDocumentCenterSchema()` called in `index.ts` at boot

**DB Tables created at boot (idempotent):**
- `document_center_files` — unified file registry (17 cols, office_id TEXT)
- `storage_migration_log` — migration audit trail
- ALTER documents: +storage_key, +storage_provider, +checksum, +version, +is_archived, +legal_category, +tags, +migrated_at

**Frontend**: `/document-center` — 6-tab page (lazy import + ProtectedRoute)
- Nav item: "مركز المستندات" with FolderOpen icon, in platform operating center section

## Key Rules
- `isSuperAdmin` is NOT exported from `requireAuth.ts` — use inline guard (check publicMetadata.role or VITE_SUPER_ADMIN_EMAILS)
- Old base64 docs in `documents.file_url` are NOT deleted — migration is progressive
- `storage_provider = 'db_base64'` for old docs, `'replit_object_storage'` for new
- MIME allowlist: 22 types enforced at upload (HTTP 415 on violation)
- Migration worker: POST /document-center/migrate?batchSize=1-50, reads docs WHERE storage_key IS NULL AND file_url LIKE 'data:%'

**Why:** Moving from base64-in-DB (causes DB bloat × 1.33x) to Object Storage with metadata-only in DB.
