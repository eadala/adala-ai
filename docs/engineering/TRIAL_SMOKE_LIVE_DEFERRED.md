# Trial Smoke — Live Deferred Path (Path 02)

**When to use:** Coolify staging / `trial.*` DNS is **DEFERRED_BY_OPERATOR**, and the owner authorized **named-tester / read-only** checks against the live platform.

**Not a substitute for** `TRIAL_SMOKE_TEST.md` staging Go/No-Go.  
**Does not claim** production readiness.

## Identity

| Field | Value |
|-------|--------|
| Date (Asia/Riyadh) | ________ |
| `develop` SHA under test | ________ (`./scripts/release/verify-release.sh`) |
| Live base URL | `https://adalahai.com` |
| Deployed SHA vs tip | **UNKNOWN unless Coolify evidence attached** — live may lag `develop` |
| Tester | ________ |

## Automated probe (engineering)

```bash
./scripts/release/trial-live-probe.sh https://adalahai.com
# expect: LIVE PROBE PASSED
```

Maps to smoke rows **A1** (homepage HTTPS) and **A3** (healthz).

## Manual named-tester (optional, careful)

| # | Step | Allowed? | Result |
|---|------|----------|--------|
| L1 | Open live URL, confirm page loads | Yes (read) | |
| L2 | `/api/healthz` → healthy | Yes | |
| L3 | Sign-in with **named test** Clerk user only | Yes if owner approved | |
| L4 | Create cases / upload docs / billing | **Avoid** on prod unless owner explicitly allows a disposable sandbox office | |
| L5 | Live Stripe charge | **Forbidden** | |

## Sign-off

| Role | Go for *deferred live window*? | Signature |
|------|--------------------------------|-----------|
| Owner | | |
| Engineer | | |

Explicit: **PASS here ≠ staging Go ≠ production launch.**
