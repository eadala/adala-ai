---
name: Adala onboarding cache bug
description: OnboardingGate redirect loop — must use setQueryData not invalidateQueries before navigation
---

## The Rule
In `onboarding.tsx`, after skip/complete mutations, use `qc.setQueryData(["onboarding-state"], { completed: true, step: 4, data: {} })` — NOT `qc.invalidateQueries` — before calling `nav("/dashboard")`.

**Why:** `OnboardingGate` in `App.tsx` has `staleTime: 10 * 60 * 1000` (10 min). `invalidateQueries` triggers an async background refetch but the stale cache is still visible when the component re-renders at `/dashboard`. The gate sees `{completed: false, step: 0}` and immediately redirects back to `/onboarding`, entering a redirect loop that corrupts wouter's router state for the entire session — ALL subsequent pages show the catch-all "Page Not Found 404" component (even /dashboard).

**How to apply:** Any mutation in `onboarding.tsx` that marks onboarding complete must call `setQueryData` synchronously before `nav()`. The pattern is in `afterComplete()`:
```js
const afterComplete = () => {
  qc.setQueryData(["onboarding-state"], { completed: true, step: 4, data: {} });
  nav("/dashboard");
};
```

## Symptom to recognize
- All pages show "Page Not Found 404 — Did you forget to add the page to the router?" after user completes/skips onboarding
- Sidebar IS present (from catch-all route's Layout) but main content is always NotFound
- No JavaScript errors in browser console
- Routes ARE defined in Switch (confirmed programmatically) — it's a state bug not a route bug
