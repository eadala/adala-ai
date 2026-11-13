# Trial Kickoff Snapshot — Adalah AI (Path 02)

**Date (Asia/Riyadh):** 2026-11-13  
**Status:** Engineering preflight **PASS** · Coolify/staging DNS **DEFERRED by owner** · Live platform in use  
**Path:** Path 01 (security/governance/audit) **CLOSED** → Path 02 (trial staging) **ACTIVE**

## Identity (filled)

| Field | Value |
|-------|--------|
| Trial code base (Git SHA) | `3e67b85ab6a2446db3981507539da0018494ca8c` |
| Tree | `b75064eef27604a1afedf84ac818b956c2818224` |
| Branch source | `develop` (Path 01 tip incl. `#141`–`#160`) |
| Frozen RC (immutable) | `5441523302a1513f07b5dc08f028d848a0bad5b4` / tree `cd84a7f…` — **unchanged** |
| Trial hostname | **DEFERRED** — owner chose live platform path for now |
| Coolify staging app | **DEFERRED** (unimportant for current window) |
| Live platform | `https://adalahai.com` — `/api/healthz` healthy |
| Owner sign-off | ________ |

## Engineering checks (done)

```text
./scripts/release/trial-preflight.sh HEAD          → PASS
./scripts/release/verify-release.sh HEAD           → commit 3e67b85a…
PATH01_ADMIN_DEFERRED=1 ./scripts/release/verify-path01-admin.sh
  → ENGINEERING_OK_ADMIN_DEFERRED
pnpm audit                                         → No known vulnerabilities found
```

## Live platform path (owner decision)

- Coolify staging / `trial.*` DNS: **postponed**
- Use live site for product checks: https://adalahai.com
- Prefer read-only / named-tester paths; avoid Live Stripe charges
- Staging isolation remains recommended before broad invites — not required for this deferred window

## Explicit non-claims

- Trial kit on `develop` ≠ staging online
- Staging success ≠ production readiness
- Do not merge `#138–#140` as part of this trial
- Obsolete `#151` (targets `main`, CONFLICTING) — superseded by Path 02 on `develop`
