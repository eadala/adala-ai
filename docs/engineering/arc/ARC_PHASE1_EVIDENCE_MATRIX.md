# ARC Phase 1 Evidence Matrix

| Claim / invariant | Classification | Evidence |
|-------------------|----------------|----------|
| HEAD = `9f92831db981668168f3adab435fcbaffc5c514c` | VERIFIED FACT | `git rev-parse HEAD` |
| Tree = `0225f1454d97e103eaf126e8619de4c7fedab1c7` | VERIFIED FACT | `git rev-parse HEAD^{tree}` |
| Branch name | VERIFIED FACT | `git branch --show-current` |
| Clean working tree (pre-audit-doc write) | VERIFIED FACT | empty `git status --porcelain` at identity check |
| Scope limited to arc + docs + lockfile | VERIFIED FACT | `git diff --name-only` + filter |
| No adala/api-server imports of ARC | VERIFIED FACT | ripgrep no matches |
| Typecheck pass | REPRODUCED TEST | exit 0 |
| 19/19 tests | REPRODUCED TEST | exit 0; pass 19 fail 0 skip 0 |
| Console build | REPRODUCED TEST | exit 0 |
| healthz 200 / deploy disabled | REPRODUCED TEST | curl on :8791 |
| execute never calls Coolify | VERIFIED FACT + REPRODUCED | static review + capabilities.executeDeploy false + kill-switch still 403 |
| Role header forge possible | REPRODUCED TEST | auditor→operator reached execute |
| ai_agent can request deploy | REPRODUCED TEST | HTTP 202 |
| Production SHA verified | UNVERIFIED | by design in overview |
| Coolify live connectivity | UNVERIFIED | mock/UNAVAILABLE only |
| Prior agent “PRODUCTION_IMPACT NONE” | REPORTED CLAIM → **accepted as consistent** with scope | no prod wiring found |
| Screenshots prove security | INFERENCE rejected | UI ≠ enforcement |
| Production Auto Deploy status | UNVERIFIED | out of ARC audit scope |

## Change-scope matrix (summary)

| File/module | Change | Purpose | Prod impact | Risk |
|-------------|--------|---------|-------------|------|
| artifacts/arc-server/* | Added | Control-plane API | None (local package) | Auth mock HIGH for future |
| artifacts/arc-console/* | Added | Operator UI | None | Misleading if misread as live |
| docs/engineering/arc/* | Added | Design docs | None | Low |
| pnpm-lock.yaml | Modified | Workspace deps | Install graph only | Lockfile review OK |
| Customer app / migrations / CI deploy | Unchanged | — | None | — |
