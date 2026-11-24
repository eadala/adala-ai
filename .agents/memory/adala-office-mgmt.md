---
name: Adala Office Management Dashboard
description: /office-management page structure, tabs, and key patterns
---

## Overview
`/office-management` → `office-management.tsx` (1200+ lines). Manages the office public page & store.

## Tab Structure (defaultValue="overview")
1. **overview** — Store URL card (with inline slug editor), publish toggle, stats grid, quick-action cards
2. **appearance** — Inline color picker (7 presets), logo/cover upload, name/tagline/about form; save button appears when `appearanceForm !== null`
3. **orders** — Badge shows pending count; status dropdown to update each order
4. **services** — Add/edit/delete with dialog; isActive toggle
5. **team** — Add/delete members with photo upload
6. **reviews** — Approve/delete
7. **articles** — Publish/unpublish/edit/delete
8. **domains** — Subdomain display + custom domain connect (plan-gated)

## Key State
- `slugEdit` / `slugEditing` — inline slug editor in Overview tab
- `appearanceForm` — null when no changes; initialized lazily on first field change using spread of `office` fields; saved via `updateOfficeMutation`

## Upload Hooks (must be before conditional returns)
- `appLogoUpload` / `appCoverUpload` — save immediately to DB AND update `appearanceForm`
- `appLogoRef` / `appCoverRef` — hidden file inputs for appearance tab
- `logoUpload` / `coverUpload` — used in the old dialog (still exists for the "تعديل الصفحة" dialog)

## Backend
- PATCH `/api/office/my/:id` — accepts any fields from officePageTable
- `officePageTable` has: slug, name, nameEn, tagline, taglineEn, about, aboutEn, logo, coverImage, phone, whatsapp, email, address, city, licenseNumber, experienceYears, casesCount, clientsCount, successRate, showStats, primaryColor, twitter, linkedin, mapsEmbedUrl, isPublished, plan

**Why:** The top-level stats grid was removed (was redundant with Overview tab stats). The edit dialog still exists for full-page editing via "تعديل الصفحة" button.
