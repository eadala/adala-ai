---
name: Adala Multi-Tenant Branding System
description: CSS variable theming, office logo in navbar, invoice templates, and digital identity assets
---

## Object Storage
- Provisioned via `setupObjectStorage()` — bucket ID stored in secrets
- Server files: `artifacts/api-server/src/lib/objectStorage.ts`, `objectAcl.ts`, `routes/storage.ts`
- Client package: `lib/object-storage-web/` (Uppy v5)
- pnpm overrides in root `package.json`: `"react": "19.1.0"`, `"react-dom": "19.1.0"`

## DB Schema (lib/db/src/schema/branding.ts)
`office_branding` table — all columns:
- Core: id, tenant_id, office_name, office_name_en, tagline, phone, email, address, website, license_no
- Assets: logo_url, stamp_url, signature_url
- Digital Identity (added June 2026): favicon_url, login_background_url, watermark_url
- Template: invoice_template (classic_legal|modern_blue|minimal, default 'classic_legal')
- Colors: primary_color (#1e3a5f), secondary_color (#c9a84c)
- Tiers: subscription_tier, show_adalah_logo, show_adalah_footer, adalah_logo_size

## API Routes
- `GET/POST /api/branding` — in `artifacts/api-server/src/routes/branding.ts`
- `POST /api/storage/uploads/request-url` — presigned URL for GCS upload
- `GET /api/storage/objects/:path` — serve uploaded files

## Frontend Architecture
- **Hook**: `artifacts/adala/src/hooks/use-branding.ts` — single source of truth for `useBranding()` and `OfficeBranding` type
- **OfficeThemeProvider**: `artifacts/adala/src/components/office-theme-provider.tsx` — renders null, applies `--office-primary`/`--office-secondary` CSS vars to `document.documentElement` + dynamic favicon + document.title; placed inside QueryClientProvider in App.tsx
- **OfficeLogo**: inline function in `layout.tsx` (above Layout), shows office logo/name from branding in sidebar; falls back to first-letter avatar
- **document-print-template.tsx**: imports from hooks/use-branding directly (NO re-export)

## Critical: Re-export Pattern
**NEVER re-export useBranding from document-print-template.tsx.**
Mixing hook re-exports with component exports breaks React Fast Refresh.
All files import useBranding from `@/hooks/use-branding` directly.

## CSS Variables
`--office-primary` and `--office-secondary` on `document.documentElement`.
Usage: `style={{ color: "var(--office-primary)" }}`

## Office Settings Page (6 tabs)
1. هوية المكتب — contact details
2. الشعار والختم — logo/stamp/signature + favicon/login-bg/watermark
3. الهوية البصرية — colors (5 presets) + adalah visibility + live preview
4. قوالب الفواتير — 3 template cards + full invoice preview
5. الاشتراك — tier selector
6. واتساب API — Meta Business setup

## Invoice Templates
- `classic_legal`: navy/gold border, logo in corner (default)
- `modern_blue`: gradient header background
- `minimal`: clean borderless, small color accent

## Subscription Tiers
- basic/pro: showAdalalahLogo=true, cannot hide
- enterprise/government: canHide=true (white-label)

**Why:** Tiered white-label preserves brand exposure for lower tiers while making logo removal a premium upsell.
