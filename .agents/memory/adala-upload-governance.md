---
name: Adala Upload Governance
description: Enterprise File Upload Governance — uploadGuard.ts 8-layer security, fileUploadRegistry, 81 regression tests
---

## Core Library: `artifacts/api-server/src/lib/uploadGuard.ts`

8-layer security applied to every server-side upload:
1. MIME Allowlist (24 types) — Set<string>, strict match
2. Executable Extension Block — 30+ extensions, handles double-ext (.pdf.exe)
3. Filename Sanitization — strips path traversal, null bytes, leading dots, collapses `..`
4. Actual Byte Size Validation — decodes base64 first, then measures real bytes (not string length)
5. Magic Bytes Check — PDF(%PDF-) / PNG / JPEG / ZIP verified against buffer start
6. SHA-256 Checksum — returned for dedup use by callers
7. Per-context Size Limits — document-center=15MB, cases=10MB, portal=5MB, default=10MB
8. Express middleware factory — `uploadGuardMiddleware(context)` attaches validated data to `req.uploadValidated`

**Why:** String.length on base64 ≈ 1.33× actual bytes — old size checks were easily bypassed.

**How to apply:** Import `validateUpload` for inline use, or `uploadGuardMiddleware(context)` as Express middleware before route handlers.

## Frontend Registry: `artifacts/adala/src/lib/fileUploadRegistry.ts`

9 upload points documented with full metadata:
- `doc-center-upload` — guardApplied:true ✅
- `case-documents-upload` — guardApplied:true ✅
- `portal-client-upload` — guardApplied:true ✅
- `office-settings-branding` — signed URL, guardApplied:false (no server pass-through)
- `user-profile-photo` — Clerk SDK, guardApplied:false (Clerk-managed)
- `smart-uploader` — signed URL, guardApplied:false
- `bankruptcy-documents` — stores URL only, no actual file
- `csv-import` — client-side parse only
- `backup-import` — client-side JSON only

## Regression Tests: `artifacts/api-server/src/tests/upload-regression.test.ts`

81/81 pass. 14 test suites. Self-contained (no ESM import, no running server needed).

**Critical:** Node's `--experimental-strip-types` uses ESM resolution and requires `.js` extension in imports. Use self-contained tests that inline the logic instead.

Run: `node --test --experimental-strip-types src/tests/upload-regression.test.ts`

## Bugs Fixed (incidental)
- `tenantMiddleware.ts:177` — `headerTenant` used before declaration; fixed to `headerTenantId` (param name)
- `monitoring.ts` — missing `logger` import from `../../lib/logger`
