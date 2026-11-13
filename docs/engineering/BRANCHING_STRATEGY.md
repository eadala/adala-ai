# Branching Strategy — Adalah AI

**Status:** Active governance  
**Scope:** GitHub repository `eadala/adala-ai`  
**Production deploy target (documented):** `main` via Coolify (`DEPLOY.md`) — live Coolify settings remain operator-verified.

## Branch roles

| Branch | Role | Direct commits | Force-push |
|--------|------|----------------|------------|
| `main` | Integration / release line for production-bound work | Forbidden | Forbidden |
| `develop` | Primary Cursor integration branch | Forbidden for feature work | Forbidden |
| `cursor/<task>-da81` | Cloud Agent / Cursor short-lived work | Allowed on the short-lived branch only | Forbidden after shared review starts |
| `feature/<task>` | Human feature work | Same as cursor | Forbidden after shared review |
| `fix/<task>` | Non-urgent fixes | Same | Forbidden |
| `hotfix/<task>` | Production emergency only | Same; PR to `main` with accelerated review | Forbidden |
| `release/<version>` | Release stabilization cut | Docs/version bumps only | Forbidden |

Do **not** create a long-lived `staging` branch until a separate staging app + database are verified.

## Naming rules

- Lowercase kebab-case only.
- Cloud Agent branches: `cursor/<descriptive-name>-da81`.
- One concern per branch. No “misc” or “wip-final2” permanent names.
- Never reuse a branch name after it was used for a different change set.

## Integration flow

```
short-lived branch  →  PR → develop  →  (release PR) → main  →  deploy (authorized)
```

1. Create the short-lived branch from the current integration tip (`develop` for routine work, `main` only for authorized hotfixes).
2. Open a PR into `develop` (or `main` for hotfix / authorized release land).
3. Require green CI + independent review before merge.
4. Delete the short-lived branch after merge (optional; do not mass-delete unknown branches).

## Release candidates

Frozen RC (immutable identity — do not amend/rebase/squash/cherry-pick):

- Commit: `5441523302a1513f07b5dc08f028d848a0bad5b4`
- Tree: `cd84a7f277c481dc5c96d707dde4e78d7f18e713`
- PR chain: `#138 ⊂ #139 ⊂ #140`

Do not merge this candidate without separate explicit authorization and Coolify safety confirmation.

## Forbidden

- Pushing directly to `main` or `develop`.
- Force-push to shared branches.
- Weakening branch protection / review requirements.
- Tagging any commit as “production” without independent deployed-SHA verification.
