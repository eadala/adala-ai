# Live Production Deployment Verification

Mode: **STRICT READ-ONLY**. Evidence time: **2026-11-13 22:57 Asia/Riyadh** (`2026-11-13T19:57:20Z` UTC probes).  
No Coolify/Hetzner/GitHub config changes, restarts, merges, DB writes, or restores.

Incident merge under review: `478be04aa42c2ee50ca60d3d37704bcd41f657a5` (#164 → `develop`).

## Return fields

| Field | Value |
|---|---|
| **ACTUAL_PRODUCTION_SHA** | **UNVERIFIED** |
| **COOLIFY_WATCHED_BRANCH** | **DOCUMENTED:** `main` (`DEPLOY.md` / `COOLIFY_BRANCH=main`). **LIVE:** **UNVERIFIED** |
| **AUTO_DEPLOY_STATUS** | **LIVE:** **UNVERIFIED**. Setup docs instruct enabling Automatic Deployment |
| **PR164_DEPLOYED** | **UNVERIFIED** |
| **APPLICATION_HEALTH** | **PARTIAL** — `https://adalahai.com/api/health` → HTTP 200 `{"ok":true,"status":"healthy"}` at probe time; `www.adalahai.com/api/health` → **503** `no available server`; no runtime SHA endpoint |
| **DATABASE_HEALTH** | **UNVERIFIED** (no prod DB credentials/API; health JSON does not include DB detail) |
| **BACKUP_AND_RESTORE_READINESS** | **UNVERIFIED** (checklist blanks; no last-backup / restore-drill evidence in operator pack) |
| **PRODUCTION_SECURITY_GAPS** | See §7 |
| **COMMERCIAL_LAUNCH_DECISION** | **NO_GO** |

## 1. Running production identity

| Evidence source | Result |
|---|---|
| Coolify UI / API | **UNAVAILABLE** — no Coolify token/secret in agent; webhooks API **403** |
| Container image digest | **UNVERIFIED** |
| Coolify application name | **UNVERIFIED** |
| Last successful Coolify deployment | **UNVERIFIED** |
| App build/version endpoint | `/api/version`, `/api/build` → **404** — cannot read SHA from runtime |
| GitHub Deployments / Environments | empty (`total_count: 0`) |
| DNS `adalahai.com` | Cloudflare anycast `104.21.56.83`, `172.67.181.176` (probe 22:57 Asia/Riyadh) — host ≠ direct Hetzner IP observability |

## 2. Watched branch / Auto Deploy / webhooks

| Item | Evidence | Confidence |
|---|---|---|
| Documented watched branch | `DEPLOY.md`: Coolify **Branch: `main`**, `COOLIFY_BRANCH=main` | Documentation only |
| Live Coolify branch | No operator checklist filled; no API access | **UNVERIFIED** |
| Live Auto Deploy | Same | **UNVERIFIED** |
| GitHub repo webhooks | API **403** to this token | **UNVERIFIED** |
| GitHub Actions deploy job | None in current CI (build gates only) — does **not** prove Coolify idle | VERIFIED absence of GHA deploy |

## 3. Did #164 (`478be04a`) reach production?

| Fact | Status |
|---|---|
| `478be04a` is tip of `origin/develop` | VERIFIED |
| `478be04a` is **not** an ancestor of `origin/main` (`c9667a0b…`) | VERIFIED |
| `#164` head tip on `main` | VERIFIED **NO** |
| Runtime proves deployed SHA == `478be04a` | **NO evidence** |
| Coolify deployment record for that SHA | **UNVERIFIED** / unavailable |

**PR164_DEPLOYED: UNVERIFIED**

Clarification (not a substitute for Coolify evidence): under the **documented** `main`-watch model, this squash-merge **cannot** have been delivered by an Auto Deploy of `main`, because it is not on `main`. If live Coolify were reconfigured to watch `develop`, deployment would still be **UNVERIFIED** without Coolify/runtime SHA proof. Green develop CI is **not** used as deployment proof.

## 4. Application / DB / ops signals (read-only)

| Check | Result | Timestamp |
|---|---|---|
| `GET https://adalahai.com/api/health` | 200 `ok/healthy` | 2026-11-13T19:57:20Z |
| `GET https://adalahai.com/api/healthz` | 200 `ok/healthy` | same |
| `GET https://www.adalahai.com/api/health` | **503** `no available server` | same |
| Container restarts / Coolify metrics | **UNVERIFIED** | — |
| Recent error logs | **UNVERIFIED** | — |
| PostgreSQL operational status | **UNVERIFIED** | — |

## 5. Backups / restore

Operator checklist (`COOLIFY_OPERATOR_CHECKLIST.md` §E) remains blank in-repo. Historical backup score docs exist but are **not** live proof of last successful backup or restore drill.

**BACKUP_AND_RESTORE_READINESS: UNVERIFIED**

## 6. Deployed revision vs required security fixes

Without `ACTUAL_PRODUCTION_SHA`, production code identity is unknown. Comparison uses **`origin/main` tip** `c9667a0b…` as the **documented** production-track branch tip only (not proven deployed):

| Control | On `origin/main` | On `origin/develop` (incl. #164) |
|---|---|---|
| AI credits inventing `officeId = "default"` | **Still present** | Removed / fail-closed (#164) |
| `requireAuthWithTenant` on AI credits deduct | Not as in #164 | Present |
| Session GUC `set_config(..., false)` | Present (pool leak class) | Present ( #139 not on develop tip) |
| RLS / GUC containment (#139) | Not verified landed on main as #139 (recovery stack) | Not in develop tip |

**Implication:** Even if production tracks `main`, #164 tenant-cohesion fixes are **not** on that branch tip; inventing-default paths remain in `main` tree. If production is older than `main`, gaps are at least as large — **UNVERIFIED**.

## 7. Immediate P0/P1 production risks

| ID | Risk | Severity | Evidence |
|---|---|---|---|
| R1 | Production running SHA unknown | P0 ops | No Coolify/runtime SHA |
| R2 | Auto Deploy live state unknown | P0 release safety | Checklist blank; API unavailable |
| R3 | Documented production track (`main`) still contains inventing-default AI credit paths | P0 security (if prod≈main) | `origin/main` source |
| R4 | Session-level tenant GUC still in `requireAuth` on main | P0-class (pool) | source `set_config(..., false)` |
| R5 | Backup/restore unproven | P1 | checklist blank |
| R6 | `www.adalahai.com` 503 | P1 availability | probe 503 |
| R7 | Governance: develop merged without independent review (#164) | P1 process | prior incident; does not by itself prove prod deploy |

## 8. Commercial launch decision

**NO_GO**

Cannot authorize commercial launch while production SHA, Coolify Auto Deploy, DB health, and backup/restore readiness remain **UNVERIFIED**, and the documented production branch tip still lacks #164 fail-closed cohesion plus open GUC containment.

## Next safe action (operator-only)

1. Fill `COOLIFY_OPERATOR_CHECKLIST.md` with screenshots: deployed SHA, image digest, watched branch, Auto Deploy ON/OFF, last 5 deploys.  
2. Expose or query a non-secret build SHA endpoint / Coolify `COOLIFY_GIT_COMMIT_SHA` for read-only verification.  
3. Confirm whether production tracks `main` or another branch; pause Auto Deploy if uncertain during cohesion merges.  
4. Do **not** merge `develop`→`main` or promote #164 to production until independent review + GUC/#139 plan + backups attested.

