---
name: Adala AI UI Builder
description: AI-powered page builder — Arabic prompt → Gemini JSON schema → live React component preview
---

## Routes
- `GET  /api/ui-builder/templates` — returns 6 legal SaaS template objects (id/title/description/prompt/icon)
- `POST /api/ui-builder/generate`  — body: `{ prompt }` → returns `{ schema }` (UISchema JSON)

## Schema Types
hero | stats | table | card | timeline | form | alert | section (section is depth-limited to 2)

## Key constraint
- callAI() must strip ```json``` fences before JSON.parse — done via regex replace in the route
- Income-statement-style tables: always include `rows` (3 demo rows) not just `columns`

## File locations
- Backend: `artifacts/api-server/src/routes/uiBuilder.ts`
- Frontend: `artifacts/adala/src/pages/ui-builder.tsx`
- Nav item: layout.tsx AI operating center, Wand2 icon, feature="ai"
- Route: App.tsx lazy import UIBuilder, path=/ui-builder ProtectedRoute

**Why:** User wanted best-in-class design feature; AI UI Builder is the most differentiating option for a Legal SaaS — lets offices prototype custom pages without code.
