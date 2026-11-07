# P0 Hotfix Integration & Release Assurance Handoff

**Date:** 2026-11-07 (Asia/Riyadh)  
**Agent actions:** verify / test / document only — **no merge, deploy, or production migration**

---

## PR status

### PR #138 — Recovery (frozen RC)

| Field | Value |
|-------|--------|
| Tip SHA | `b3d9a0afd1b45486296910827824363bd9ed6810` |
| Contents | SEC-001/005/007/008, Migrations **058–060**, ADR-001 app GUCs |
| CI (at handoff) | Gates/Tests/Docker/Gate5/Gate8 mostly **PASS**; **DB Migrations still IN_PROGRESS / not terminal PASS** on tip |
| Mergeable | MERGEABLE (GitHub) |
| Frozen | **Yes — do not force-push** |

### PR #139 — P0 GUC containment hotfix

| Field | Value |
|-------|--------|
| Base | `cursor/recovery-production-readiness-da81` @ `b3d9a0a` |
| Tip SHA | `d6a0def654d992717fffa0cd885670efa01ff2ba` |
| Security commit | `7fffe90` |
| CI (at handoff) | Re-running on `d6a0def` after test strengthen — **confirm remote green before merge** |
| Diff scope | Pool pin scopes + Stripe/SA/office wiring + P0 tests + docs |

---

## Integration candidate

| Field | Value |
|-------|--------|
| Branch | `cursor/integration-recovery-p0-da81` |
| **Exact SHA** | `d6a0def654d992717fffa0cd885670efa01ff2ba` |
| Composition | Frozen RC `b3d9a0a` **+** P0 hotfix (PR #139 tip). RC is ancestor. |
| Why this SHA | PR #139 already stacks on the frozen recovery tip; integration ≡ hotfix tip. |

### Local gates on integration SHA

| Gate | Result |
|------|--------|
| `test:guc-pool-containment-p0` | **PASS** (baseline leak + contained T1–T7 + nested tx + cron escape contract) |
| `test:rls-fail-closed-059` | **PASS** |
| `test:vault-rls-060` | **PASS** |
| `test:invitations-058` | **PASS** |
| `test:notifications-tenant` | **PASS** |
| `test:rbac-invitations` | **PASS** |
| `test:stage9-security` | **PASS** |
| `test:sse-tenant-isolation` | **PASS** |
| `test:internal-messages-tenant` | **PASS** |
| api-server `tsc --noEmit` | **PASS** |
| api-server `build` (`build.mjs`) | **PASS** |
| Remote DB Migrations / full CI on integrated tip | **NOT VERIFIED terminal PASS** until GitHub completes on `d6a0def` |
| Docker / Gate 5 on integrated tip | **NOT VERIFIED** until remote CI completes |

**Do not claim integrated release verified from separate PR checks alone** — local combined contracts PASS; remote full matrix pending on `d6a0def`.

---

## Security audit summary (#139)

| Requirement | Verdict |
|-------------|---------|
| Office queries use pinned client | **PASS** — `runWithOfficeDbScopeUntilResponse` + ALS `pool.query` routing |
| Privileged work cannot escape scope | **PASS** — setters require pin; nested `release` ignored while pinned |
| Unbound pool.query fail-closed | **PASS** — checkout begin/end deny |
| Nested transactions keep scope | **PASS** — tested BEGIN/ROLLBACK inside office/bypass scopes |
| Concurrent offices | **PASS** — T6 |
| Exception / cancel no bypass leak | **PASS** — T3 + nested cancel |
| Stripe after signature | **PASS** — `constructEvent` then `runWithBypassDbScope` |
| Background jobs | **PASS WITH LIMITATIONS** — `agentCron` has no bypass setter; unbound queries fail-closed. Jobs that need privileged RLS must use explicit `runWithBypassDbScope` (none found setting bypass today) |

### Residual escape notes (not blockers for CONDITIONAL GO)

1. Unbound **callback-form** `pool.query` falls through to driver (rare; drizzle uses Promise form).
2. Unbound `db.transaction` → `connect`/`release` without fail-closed wrapper — mitigated because session bypass is not set outside scopes; `dataVault` uses `set_config(..., true)` (tx-local).
3. Production `BYPASSRLS` / FORCE / owner role — **NOT VERIFIED**.

---

## Production preconditions (separate from code merge)

| Item | Status |
|------|--------|
| Prod role / FORCE inventory (`scripts/db/prod-rls-role-inventory.sql`) | **NOT VERIFIED** |
| Migrations 058→059→060 apply | **NOT APPLIED** / plan ready |
| Backup restore drill | **BLOCKED** until evidenced |
| Clerk / Stripe / Gemini / R2 / HEAL presence | **NOT VERIFIED** |
| Live E2E | **NOT VERIFIED** |
| Coolify deploy authorization | **NOT VERIFIED** / human gate |

---

## Recommended merge order

1. Wait for **terminal CI PASS** on PR #138 tip `b3d9a0a` (especially DB Migrations).
2. Wait for **terminal CI PASS** on PR #139 tip `d6a0def` (or successor).
3. Merge **#138** first (or keep as base).
4. Merge **#139** into the recovery line (already based on #138 tip) — or merge integration branch `cursor/integration-recovery-p0-da81` @ `d6a0def` as the single release SHA after both are green.
5. Deploy **app** at integrated SHA, then apply **058 → 059 → 060** in a controlled window.

---

## Final decisions

| Decision | Verdict |
|----------|---------|
| **INTEGRATION** | **READY** for local combined security/contracts on `d6a0def` — **NOT READY** to declare remote full-CI integrated release until DB Migrations + Gates complete on that tip |
| **MERGE** | **NOT READY** until remote CI terminal PASS on #138 and #139 tips; then **READY** for human merge in order above |
| **PRODUCTION** | **CONDITIONAL GO** |

**Required human approvals:** merge #138/#139; backup restore; role inventory; secrets; Coolify deploy; migration apply.
