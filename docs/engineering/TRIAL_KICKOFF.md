# Trial Kickoff Snapshot — Adalah AI

**Date (Asia/Riyadh):** 2026-11-13  
**Status:** Engineering preflight **PASS** · Coolify/staging DNS **DEFERRED by owner** (not blocking) · Live platform in use

## Identity (filled)

| Field | Value |
|-------|--------|
| Trial code base (Git SHA) | `1d283d6a494fb8509a583da583747ff0bb6e4f55` |
| Tree | `035d84afff74ee857a95ceb457eb59ff557c1589` |
| Branch source | `develop` (includes merged `#150` trial kit) |
| Frozen RC (immutable) | `5441523302a1513f07b5dc08f028d848a0bad5b4` / tree `cd84a7f…` — **unchanged** |
| Trial hostname | **DEFERRED** — owner chose live platform path for now |
| Coolify staging app | **DEFERRED** (unimportant for current window) |
| Live platform | `https://adalahai.com` — `/api/healthz` healthy |
| Owner sign-off | ________ |

## Engineering checks (done)

```text
./scripts/release/trial-preflight.sh HEAD  → PASS
./scripts/release/verify-release.sh HEAD  → commit 1d283d6a…
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
