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

## CRITICAL — Clerk Proxy URL

`clerkProxyUrl` in App.tsx MUST be:
```typescript
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
```

**Why:** `VITE_CLERK_PROXY_URL` is **empty in dev** (intentional — Clerk hits dev FAPI directly) and **auto-populated by Replit at publish time**. Any manual fallback causes the published app to use wrong proxy URL and breaks auth entirely.

**How to apply:** Never add a `||` fallback to `clerkProxyUrl`. Never gate it on `NODE_ENV`. The empty dev value is intentional per the Clerk skill canonical pattern.

## CRITICAL — clerkProxyMiddleware.ts

**NEVER modify clerkProxyMiddleware.ts** beyond the canonical template at `.local/skills/clerk-auth/templates/api-server/src/middlewares/clerkProxyMiddleware.ts`. Specifically:
- The FAPI target MUST be `https://frontend-api.clerk.dev` — do NOT derive it from the publishable key
- Deriving FAPI from `pk_live_*` base64 decode yields `clerk.legal-platform--ahkm1000.replit.app` which is unreachable from the deployed server → **504 Gateway Timeout** → Clerk JS never loads → white screen
- Always resync to canonical template when anything seems wrong

## CRITICAL — Tailwind v4 + Clerk in Production

When using `@tailwindcss/vite` (Tailwind v4), vite.config.ts MUST have:
```typescript
tailwindcss({ optimize: false })
```
**Why:** Without this, nested `@layer` imports from `@clerk/themes/*.css` get reordered in production builds. Clerk UI and potentially the entire page render correctly in dev but broken/white in production.

## CRITICAL — index.html root div

The `<div id="root">` should have an inline dark background style:
```html
<div id="root" style="background:#0F1B35;min-height:100vh"></div>
```
**Why:** If React fails to mount (JS error, bundle failure), the page shows dark background instead of white — making it immediately clear that React is not running. With React running, its own styles override the inline style.

## CRITICAL — Dark Mode Must Be Initialized Before React Mounts

The app uses `@custom-variant dark (&:is(.dark *))` in `index.css` (Tailwind v4). This requires `class="dark"` on `<html>` for ALL dark CSS variables to apply.

**index.html MUST have this inline script BEFORE `<div id="root">`:**
```html
<script>
  (function(){
    var t = localStorage.getItem('adala-theme') || 'dark';
    document.documentElement.classList.toggle('dark', t === 'dark');
  })();
</script>
```

**account-menu.tsx MUST initialize from localStorage AND sync via useEffect:**
```typescript
const [theme, setTheme] = useState<"dark" | "light">(() =>
  (localStorage.getItem("adala-theme") as "dark" | "light") || "dark"
);
useEffect(() => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("adala-theme", theme);
}, [theme]);
```

**Why:** Without dark class on `<html>`, all `bg-background`/`text-foreground` etc. use `:root` (light mode) variables → components render with wrong colors → blank dark screen (root div inline background shows through).

## Module-level safety for publishableKeyFromHost

Wrap in try/catch at module level in App.tsx:
```typescript
let clerkPubKey: string;
try {
  clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
} catch (e) {
  clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
}
```
**Why:** Module-level throw prevents React from mounting entirely — not caught by ErrorBoundary.
