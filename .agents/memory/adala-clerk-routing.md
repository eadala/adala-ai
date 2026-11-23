---
name: Adala Clerk Routing Anti-Patterns
description: Blank screen root causes found in production — Clerk Show components render nothing during loading; correct pattern uses useAuth() hooks
---

# Clerk Routing Anti-Patterns → Blank Screen

## The Problem
Using Clerk's `<Show when="signed-in">` / `<Show when="signed-out">` as route guards
causes COMPLETELY BLANK screens while Clerk is initializing, because BOTH components
render nothing during the loading phase.

**BAD — blank during Clerk loading:**
```tsx
<Show when="signed-in">{content}</Show>
<Show when="signed-out"><Redirect to="/" /></Show>
```

**WHY:** During Clerk init, neither branch renders. Result = blank page.
This is especially bad for the home route (/) where users expect immediate content.

## The Fix
Use `useAuth()` hook directly with explicit loading guards:

```tsx
// Route guards
function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded)   return <PageLoader />;   // ← always shows something
  if (!isSignedIn) return <Redirect to="/" />;
  return <Layout>...</Layout>;
}

// Home page — render Landing immediately, redirect when ready
function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded)           return <Landing />;  // show while Clerk loads
  if (isSignedIn)          return <RoleAwareRedirect />;
  return <Landing />;
}
```

## Files Fixed
- `artifacts/adala/src/App.tsx`: HomeRedirect, AdminRoute, WorkspaceRoute, ProtectedRoute
- Removed: ClerkLoading, ClerkLoaded, Show imports (no longer needed)

## Related: OfficeThemeProvider FOUC
The `return () => clearDesignTokens()` in the theme effect ran before EVERY re-render,
wiping CSS vars mid-render causing white flash. Fix: separate into two effects —
one for applying tokens (no cleanup), one cleanup-only effect for unmount.

**Why:** React effect cleanup runs before every re-run with new deps, not just unmount.
Don't put destructive DOM operations in cleanup unless they're idempotent or mount-only.
