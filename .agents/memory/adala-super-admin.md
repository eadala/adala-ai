---
name: Adala Super Admin
description: Super Admin panel setup, DB migration workaround, and auth guard pattern
---

## DB Migration
`drizzle-kit push` requires a TTY and fails in non-interactive shells. **Workaround:** use `executeSql()` in `code_execution` to create tables directly via SQL.

**Why:** drizzle-kit prompts for confirmation when adding unique constraints to tables with data. Even `--force` flag doesn't bypass the TTY check.

**How to apply:** whenever a schema change is needed, run raw SQL via code_execution instead of `pnpm --filter @workspace/db run push`.

## Super Admin Auth
- Backend guard: `isSuperAdmin(userId, email)` in `artifacts/api-server/src/routes/admin.ts` — checks `SUPER_ADMIN_EMAILS` env var (comma-separated) OR Clerk metadata `role=super_admin`
- Frontend guard: `VITE_SUPER_ADMIN_EMAILS` env var checked in layout.tsx; sidebar group hidden unless user email matches or `publicMetadata.role === "super_admin"`
- Route: `/super-admin` protected by `ProtectedRoute` wrapper in App.tsx

## Admin Tables Created (via SQL)
plans, discount_codes, ai_api_keys, platform_settings, departments, job_titles, legal_systems, support_tickets, office_registry
Also added columns to office_page: name_en, tagline_en, about_en, maps_embed_url, cover_image, is_published
