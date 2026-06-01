---
name: Adala Clerk Auth setup
description: Clerk Auth routing and protected route structure for عدالة AI
---

Clerk is provisioned and working (development keys active).

**Route structure:**
- `/` → Landing page (public, unauthenticated users see marketing page)
- `/dashboard` → Protected (redirects to `/` if signed out)
- `/sign-in/*?` and `/sign-up/*?` → Clerk auth pages (branded navy/gold)
- All `/cases`, `/documents`, `/ai-tasks`, `/ai-chat`, `/users`, `/messages`, `/billing` → Protected

**Why:** Home route must be public per Clerk skill requirements. Authenticated users auto-redirect to `/dashboard`.

**How to apply:** Use `<ProtectedRoute>` wrapper in App.tsx for auth-gated pages. Use `<Show when="signed-in/out">` from `@clerk/react` for conditional rendering.
