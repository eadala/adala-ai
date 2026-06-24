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

## V2 Enterprise Features (added on top of V1)

**New DB Tables (auto-created at boot, idempotent):**
- `document_versions` — version history per file; is_current flag; auto-incremented version_number
- `document_permissions` — OWNER/TEAM/MANAGEMENT/HR/FINANCE/CUSTOM; UNIQUE(document_id, user_id/role_id)
- `retention_policies` — per-office OR `__default__`; UNIQUE(office_id, category); 13 defaults seeded ON CONFLICT DO NOTHING
- `document_ai_metadata` — Gemini analysis output; UNIQUE(document_id)

**New API Routes (all under /document-center/*):**
- Version: POST/GET /files/:id/versions, POST /files/:id/versions/:verId/restore, GET /files/:id/versions/:verId/download
- Permissions: GET/POST /files/:id/permissions, DELETE /files/:id/permissions/:permId
- Retention: GET/PUT /document-center/retention-policies, POST /retention-policies/scan
- AI: POST /files/:id/analyze (Gemini), GET /files/:id/ai-metadata, GET /search?q=

**Frontend: 10-tab page (was 6 tabs)**
- Added: الإصدارات / الصلاحيات / الاحتفاظ / الذكاء المستندي

**Retention policy merge pattern:** LEFT JOIN default (__default__) with office-specific; office wins via COALESCE.
**AI analysis:** Gemini 2.0 Flash inline_data for images/PDF; text-only prompt for others; saved to document_ai_metadata.
**Search:** ILIKE on file_name + JOIN dam.summary/keywords/parties.

**Why:** Moving from base64-in-DB (causes DB bloat × 1.33x) to Object Storage with metadata-only in DB.
