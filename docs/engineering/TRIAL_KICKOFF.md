# Trial Kickoff Snapshot — Adalah AI

**Date (Asia/Riyadh):** 2026-11-13  
**Status:** Engineering preflight **PASS** · Staging deploy **BLOCKED** (operator)

## Identity (filled)

| Field | Value |
|-------|--------|
| Trial code base (Git SHA) | `1d283d6a494fb8509a583da583747ff0bb6e4f55` |
| Tree | `035d84afff74ee857a95ceb457eb59ff557c1589` |
| Branch source | `develop` (includes merged `#150` trial kit) |
| Frozen RC (immutable) | `5441523302a1513f07b5dc08f028d848a0bad5b4` / tree `cd84a7f…` — **unchanged** |
| Trial hostname | **NOT LIVE** — `trial.adalahai.com` does not resolve (DNS pending) |
| Coolify staging app | **NOT CREATED** |
| Production `adalahai.com` | Live (do **not** use for trial) |
| Owner sign-off | ________ |

## Engineering checks (done)

```text
./scripts/release/trial-preflight.sh HEAD  → PASS
./scripts/release/verify-release.sh HEAD  → commit 1d283d6a…
```

## Operator blockers (must clear before smoke)

1. Create **separate** Coolify application (not production).
2. Provision **separate** PostgreSQL (empty / demo seed only).
3. Set env from `TRIAL_STAGING_ENV.md` (Clerk **test** keys only; no `*_live_*`).
4. Point staging app Git watch to `develop` (or this SHA) — **leave production Auto Deploy untouched**.
5. Add DNS: `trial.adalahai.com` → staging Coolify.
6. Deploy and record Coolify **Deployed SHA** (must match `1d283d6a…` or later agreed tip).
7. Run `TRIAL_SMOKE_TEST.md` → Go / No-Go.

## Explicit non-claims

- Trial kit on `develop` ≠ staging online  
- Staging success ≠ production readiness  
- Do not merge `#138–#140` as part of this trial
