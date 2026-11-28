# PR Inventory and Baseline

Evidence date: 2026-11-13 (Asia/Riyadh). Classification keys: VERIFIED / INFERRED / UNVERIFIED.

## Repository identity — VERIFIED

| Field | Value |
|---|---|
| Repo | `eadala/adala-ai` |
| Default branch | `main` |
| `origin/main` | `c9667a0b3229ad371b7b0f99f0cf187bd99532e5` |
| `origin/develop` | `d2bd14d9262054a6948607a5bdfd8eb0c524a446` |
| Frozen RC commit | `5441523302a1513f07b5dc08f028d848a0bad5b4` |
| Frozen RC tree | `cd84a7f277c481dc5c96d707dde4e78d7f18e713` |
| Frozen RC tree match | **MATCH** (`git rev-parse <rc>^{tree}`) |

## Branch protection / rulesets

| Control | Status | Evidence |
|---|---|---|
| `develop` protected | VERIFIED `protected:true` | `gh api repos/eadala/adala-ai/branches/develop` |
| Ruleset `adalah-ai` (id 17934003) | VERIFIED `enforcement:disabled` | `gh api .../rulesets` |
| Required reviewers / status checks detail | UNVERIFIED | Branch protection content API returned limited fields; treat independent review as required |
| Coolify / Hetzner deploy triggers | UNVERIFIED | Out of scope (G13) |

## Cohesion PR set (#164 + #166–#182) — VERIFIED (18 PRs)

All: `base=develop`, `mergeable=MERGEABLE`, `reviewDecision=REVIEW_REQUIRED`, CI rollup `SUCCESS×12`, ancestry `ON_DEVELOP_TIP` (merge-base = `origin/develop`).

| PR | Head SHA | Branch | Purpose (from title) | Files |
|---|---|---|---|---|
| 164 | `094636ad0e3e` | `cursor/platform-cohesion-batch2-da81` | Stripe/AI/login/messages fail-closed | 9 |
| 166 | `c62b7f5f66a1` | batch3 | marketplace/portal IDOR + email cron | 7 |
| 167 | `eaf9fc7946f1` | batch4 | branding/theme/onboarding | 5 |
| 168 | `6a9de7d40789` | batch5 | integrations/templates/workflow | 5 |
| 169 | `a8a575ca10e7` | batch6 | entitlements/support | 6 |
| 170 | `05f21b9faa91` | batch7 | payments/API keys/import/AI gateway | 5 |
| 171 | `13b43a3d0a86` | batch8 | orgStructure/AI chat/notifications | 5 |
| 172 | `aff805dd23e3` | batch9 | ai-agent/events/agents/legalAI | 5 |
| 173 | `f8cda4985d01` | batch10 | signatures/adoul/events/copilot | 6 |
| 174 | `5786c408d0bb` | batch11 | notifications feed / legal AI tools | 6 |
| 175 | `334c14305d47` | batch12 | subscription/push/promo | 4 |
| 176 | `b434478ebda1` | batch13 | marketplace/billing/feature gates | 5 |
| 177 | `3ba128169b6b` | batch14 | RBAC / tasks/cases NULL-OR | 6 |
| 178 | `5c5d991a0894` | batch15 | messages/storage/calendar/financial-engine | 5 |
| 179 | `c39e72fc241d` | batch16 | WhatsApp/reminders/hrInternal/webPush | 5 |
| 180 | `012518c4d252` | batch17 | eventBus/analytics/branches/compliance/hrPerformance | 6 |
| 181 | `7f24be0f4cd3` | batch18 | HR enterprise / JLWM recommendations | 3 |
| 182 | `b62d2b8a97e0` | batch19 | collection revenues / autopilot / AI contracts | 4 |

## Adjacent open PRs (not in cohesion set)

| PR | Base | Mergeable | Note |
|---|---|---|---|
| 165 | `main` | CONFLICTING | Duplicate of batch2 against wrong base — supersede/close |
| 138 | `main` | MERGEABLE | Recovery / notifications tenant-scope (recovery stack) |
| 139 | `cursor/recovery-production-readiness-da81` | MERGEABLE | P0 GUC containment (`set_config` pool pin) |

## Local integration candidate — VERIFIED

| Field | Value |
|---|---|
| Branch (local only) | `cursor/security-integration-validation-b19` |
| Worktree | `/tmp/security-integration/integration-wt` |
| Base | `d2bd14d9262054a6948607a5bdfd8eb0c524a446` |
| Final HEAD | `5abb1d03def2027896691dad93f85dd6134bee4f` |
| Final TREE | `168a55b43e139b67d7ff7687c624dff6a5518015` |
| Merge conflicts | none (18/18) |
| Remote push | **not pushed** (disposable validation only) |

## Remediation PRs produced this program

| Branch | Head | Purpose |
|---|---|---|
| `cursor/security-autopilot-task-scope-da81` | `4821321e` | Scope autopilot tasks context by `office_id` |
| `cursor/security-jlwm-demo-seed-guard-da81` | `773fe722` | Gate JLWM demo auto-seed in production |
