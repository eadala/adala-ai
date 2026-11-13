# Residual Security Risk Assessment

## 9.1 Demo-seed DDL (`jlwmDemoSeed.ts`) — VERIFIED

- Imported by `artifacts/api-server/src/index.ts`.
- **Pre-remediation:** `setTimeout` always called `seedNorthSouthDemoData` ~8s after boot — **production-reachable**, no `NODE_ENV` guard.
- Uses fixed demo office UUIDs (`NORTH_ID` / `SOUTH_ID`); idempotent skip if already seeded.
- Admin route also exists (`adminOnly`) per file header.
- **Remediation:** `cursor/security-jlwm-demo-seed-guard-da81` @ `773fe722` skips when `NODE_ENV=production` unless `JLWM_DEMO_ALLOW_PROD=true`.
- Severity after gate: P2 (admin-triggered / explicit override only).

## 9.2 Document Center `__default__` — VERIFIED

- Intentional global retention templates (`office_id='__default__'`).
- Reads: tenant sees defaults OR own overrides.
- Writes: `INSERT … VALUES (${officeId}, …) ON CONFLICT DO UPDATE` — tenant customizes **own** row, not `__default__`.
- Cross-office mutation of defaults: **not observed** in mutate path.
- Classification: design pattern, not tenant inventing. Monitor auto_delete behavior.

## 9.3 Super Admin / platform tools — VERIFIED (spot)

- Stripe admin, promo admin, infrastructure, bankruptcy demo seed use `requireSuperAdmin` / `adminOnly`.
- Ordinary office user invocation should 403 — **NOT_TESTED** runtime; static middleware present.
- Do not broaden these privileges during cohesion merge.

## 9.4 Actor attribution `?? "unknown"` — VERIFIED sample

| Location | Use | Risk |
|---|---|---|
| `errorHandler` requestId | telemetry | Low |
| `runtimeShield` / support IP | network metadata | Low |
| `governanceKernel` action.source | system/blocked actions | Low–Med |
| `hr-enterprise` requesterId/approverId | approval mutations | **P2** — prefer fail-closed if auth missing |
| `developer.ts` createdBy | API key create | P2 — should reject unauthenticated |

None invent `officeId`. Not treated as P0 inventing-tenant class.

## Open non-blocking residuals

1. DDL `DEFAULT 'default'` schema debt (F-06).
2. orgStructure heal-to-default (F-07).
3. GUC session pin via #139 (F-09) — separate track.
4. Full RLS adversarial suite NOT_RUN.
