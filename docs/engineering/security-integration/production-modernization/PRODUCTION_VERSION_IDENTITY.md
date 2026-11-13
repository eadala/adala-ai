# Production Version Identity

Evidence refresh: 2026-11-13T20:05:43Z UTC (23:05 Asia/Riyadh). Mode: READ-ONLY.

## Verdict

| Field | Value |
|---|---|
| ACTUAL_PRODUCTION_SHA | **UNVERIFIED** |
| Running image digest | **UNVERIFIED** |
| Coolify application ID / name | **UNVERIFIED** |
| Connected repository (live) | **UNVERIFIED** (docs: `eadala/adala-ai`) |
| Watched branch (live) | **UNVERIFIED** (docs: `main`) |
| Auto Deploy (live) | **UNVERIFIED** |
| Last successful Coolify deploy | **UNVERIFIED** |
| Chain Git→build→image→runtime | **INCOMPLETE** |

## Git reference tips (VERIFIED)

| Ref | SHA |
|---|---|
| `origin/main` | `c9667a0b3229ad371b7b0f99f0cf187bd99532e5` |
| `origin/develop` | `478be04aa42c2ee50ca60d3d37704bcd41f657a5` (#164 squash) |
| Frozen RC commit | `5441523302a1513f07b5dc08f028d848a0bad5b4` |
| Frozen RC tree | `cd84a7f277c481dc5c96d707dde4e78d7f18e713` (MATCH) |

## PR #164 in production?

| Fact | Result |
|---|---|
| `478be04a` on `develop` | VERIFIED |
| `478be04a` ancestor of `main` | **NO** |
| Coolify/runtime proves deploy of `478be04a` | **NO evidence** |
| Conclusion | **PR164_DEPLOYED=UNVERIFIED** |

## Access blockers (operator must supply)

1. Coolify UI: app name, watched branch, Auto Deploy, last deploy SHA, image digest.
2. Optional: expose non-secret `COOLIFY_GIT_COMMIT_SHA` / `/api/version`.
3. GitHub webhooks list: this agent token got **403**.

## Runtime fingerprint (not a SHA)

Live `/api/status` payments detail (2026-11-13T20:05Z+): status=`outage`, detail mentions missing Stripe secrets.

Current `main`/`develop` `checkPayments()` returns status=`degraded` for the same condition.

**Conclusion:** running production application code is **not identical** to current `origin/main` or `origin/develop` tips — SHA remains UNVERIFIED but **≠** `c9667a0b` / `478be04a` behaviorally for this check.
