# Cloudflare R2 — Object Storage (S3-compatible)

## Required environment variables

```bash
STORAGE_PROVIDER=cloudflare_r2
R2_BUCKET_NAME=your-bucket-name
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

## Bucket security

- Keep **Public Access disabled** on the R2 bucket.
- All reads/writes go through the API server using signed URLs or server-side SDK calls.
- Do not enable R2 public bucket policies for production document data.

## CORS configuration (required for browser presigned uploads)

Presigned PUT uploads from the browser (`SmartUploader`, office branding, Document Center direct upload) require CORS on the R2 bucket.

In **Cloudflare Dashboard → R2 → your bucket → Settings → CORS policy**, add:

```json
[
  {
    "AllowedOrigins": [
      "https://your-production-domain.com",
      "https://staging.your-domain.com",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace origins with your actual frontend URLs (`ALLOWED_ORIGINS` / Clerk domains).

### What uses presigned PUT

| Flow | API |
|------|-----|
| Smart Documents | `POST /api/storage/uploads/request-url` → PUT signed URL |
| Office branding | same |
| Document Center | `POST /api/document-center/upload-url` → PUT → confirm |

### What uses server proxy (no bucket CORS needed)

| Flow | API |
|------|-----|
| Private object download | `GET /api/storage/objects/*` |
| Document download redirect | `GET /api/document-center/files/:id/download` |

## Optional legacy variables

| Variable | Purpose |
|----------|---------|
| `PRIVATE_OBJECT_DIR` | Legacy `/bucket/prefix` — maps to object key prefix (default: `private`) |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Comma-separated `/bucket/prefix` for public asset search paths |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Legacy Replit bucket name — use `R2_BUCKET_NAME` instead |

## Health check test

```bash
# Unit tests (no live R2)
cd artifacts/api-server && node --import tsx --test src/tests/r2-storage.test.ts

# Live connectivity (staging credentials)
R2_RUN_LIVE_TEST=1 \
  STORAGE_PROVIDER=cloudflare_r2 \
  R2_BUCKET_NAME=... \
  R2_ENDPOINT=... \
  R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... \
  node --import tsx --test src/tests/r2-storage.test.ts
```

## Migration from Replit

1. Copy existing objects from Replit bucket to R2 (same keys under `docs/`, `backups/`, `private/uploads/`).
2. Set R2 env vars on the API server.
3. Restart API — no frontend changes required.
4. Existing `storage_provider='replit_object_storage'` rows remain readable if keys were copied unchanged.
