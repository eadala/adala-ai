---
name: Adala dual branding system
description: White-label / dual branding architecture for عدالة AI — office logos, stamps, signatures, tier-based Adalah logo visibility, PDF print templates
---

## Object Storage
- Provisioned via `setupObjectStorage()` — bucket ID stored in secrets
- Server files: `artifacts/api-server/src/lib/objectStorage.ts`, `objectAcl.ts`, `routes/storage.ts`
- Client package: `lib/object-storage-web/` (Uppy v5)
- pnpm overrides in root `package.json`: `"react": "19.1.0"`, `"react-dom": "19.1.0"` (NOT `$react` — root has no direct react dep)

## DB Schema
- `officeBrandingTable` in `lib/db/src/schema/branding.ts` — exported from schema/index.ts
- Fields: officeName, officeNameEn, tagline, phone, email, address, website, licenseNo, logoUrl, stampUrl, signatureUrl, primaryColor, secondaryColor, subscriptionTier, showAdalalahLogo, showAdalalahFooter, adalalahLogoSize, tenantId

## API Routes
- `GET/POST /api/branding` — in `artifacts/api-server/src/routes/branding.ts`
- `POST /api/storage/uploads/request-url` — presigned URL for GCS upload
- `GET /api/storage/objects/:path` — serve uploaded files

## Frontend
- Settings page: `artifacts/adala/src/pages/office-settings.tsx` — 4 tabs: هوية المكتب, الشعار والختم, الهوية المزدوجة, الاشتراك
- Print template: `artifacts/adala/src/components/document-print-template.tsx` — `DocumentPrintTemplate` + `PrintButton` components
- Route: `/office-settings` in App.tsx, nav item in layout.tsx under النظام group
- Upload flow: fetch presigned URL → PUT directly to GCS (NOT to backend)

## Subscription Tiers
- basic: showAdalalahLogo=true, size=normal, cannot hide
- pro: showAdalalahLogo=true, size=small, cannot hide
- enterprise: can hide logo (canHide=true)
- government: full white-label (canHide=true)

**Why:** Tiered white-label preserves brand exposure for lower tiers while making logo removal a premium upsell.
