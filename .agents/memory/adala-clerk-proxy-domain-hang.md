---
name: Adala Clerk proxy hardcoded domain
description: Root cause of the "site hangs at login" bug that survived multiple prior fix attempts on adalahai.com
---

Two compounding issues caused login to hang only on the custom domain (adalahai.com), while the .replit.app URL kept working — which is why symptom-level fixes never stuck:

1. **Code divergence**: `clerkProxyUrl` in App.tsx had custom logic (`import.meta.env.DEV ? undefined : (window.location.origin + rawProxy)`) instead of the canonical one-liner `const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;`. Any hand-rolled branching/rebuilding of this value defeats Clerk's per-domain proxy validation.
2. **Hardcoded env var**: `VITE_CLERK_PROXY_URL` was manually pinned in `.replit` `[userenv.shared]` to a literal `https://<repl-slug>.replit.app/api/__clerk` string. Because it's "shared", this same absolute URL leaked into both dev and prod, and pointed at the wrong domain when the site was visited via the custom domain. Browser CSP then blocked loading Clerk's JS from that mismatched origin — this is the actual "hang" (spinner never resolves, no visible error unless you open devtools).

**Why:** Clerk-managed proxy env vars (`VITE_CLERK_PROXY_URL`, `CLERK_PROXY_URL`) must stay auto-provisioned/empty-in-dev; hand-setting them to a fixed value breaks any domain other than the one baked into the string, and the failure only shows up as a silent hang, not a clear error banner.

**How to apply:** When "login hangs" is reported and only on a custom domain (or reported as "still broken after fixes"), check `.replit` `[userenv.shared]` for a manually-set `VITE_CLERK_PROXY_URL`/`CLERK_PROXY_URL` before touching App.tsx again. Delete it via `deleteEnvVars` (not `sed`/hand-editing `.replit`) and resync the client code to the exact canonical snippet in the clerk-auth skill's `setup-and-customization.md`. Also verify server-side: `curl -D- https://<custom-domain>/api/__clerk/v1/client` — a `400 {"code":"host_invalid"}` response confirms Clerk itself is rejecting the host, independent of anything the client sends.
