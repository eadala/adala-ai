# Cursor Development Workflow — Adalah AI

Operational daily procedure for Cursor / Cloud Agents / human developers.

## 0. Before touching anything

```bash
git status --short
git fetch origin
git rev-parse --abbrev-ref HEAD
git log -1 --oneline
```

- If the working tree is dirty, either commit, stash, or use `git worktree add`.
- Never `git reset --hard` or `git clean -fdx` against unrelated work.
- Never load production secrets into the agent environment for routine feature work.

## 1. Create an isolated branch

From the integration tip (usually `develop`):

```bash
git fetch origin
git checkout -b cursor/<task-name>-da81 origin/develop
```

Hotfix only (authorized):

```bash
git checkout -b hotfix/<task-name> origin/main
```

## 2. Implement with least privilege

- Change only files required for the task.
- Prefer schema-authority migrations over runtime DDL.
- Do not edit frozen RC tips (`5441523…`) or rewrite history.
- Do not modify Coolify / production env values from Cursor.

## 3. Local verification (minimum)

```bash
git diff --check
git status --short
# Then project-relevant checks, e.g.:
# pnpm --filter @workspace/api-server run typecheck
# bash -n scripts/release/verify-release.sh
```

Run the smallest relevant test set. Do not claim production readiness from local green alone.

## 4. Pre-PR checklist (required)

- [ ] Branch name matches policy (`cursor|feature|fix|hotfix|release`).
- [ ] PR will target `develop` (or authorized `main` for hotfix/release).
- [ ] Diff contains no secrets (`.env`, keys, tokens, private keys).
- [ ] Diff does not silently change Docker/Coolify/deploy workflows unless intended and called out.
- [ ] Migration files (if any) are intentional, numbered, and documented.
- [ ] Tenant / RLS / auth files called out in the PR body if touched.
- [ ] Frozen RC SHA/tree unchanged.
- [ ] No force-push performed.

## 5. Push and open PR

```bash
git push -u origin HEAD
# Open PR → base: develop (default for routine work)
```

Never push to `main` / `develop` directly.

**Deployment safety:** Coolify is documented to watch `main` (`DEPLOY.md`). Pushing `cursor/**` must not be assumed safe for production until an operator confirms Auto Deploy scope. If Coolify cannot be ruled out for the destination branch, do not push that branch.

## 6. After CI

- Wait for required checks.
- Do not self-approve when you are the sole CODEOWNER (`@eadala` self-review problem — see `GITHUB_SECURITY_BASELINE.md`).
- Do not merge your own PR without an independent reviewer when policy requires it.

## 7. After merge

- Pull the integration branch.
- Delete only your short-lived branch if instructed.
- Do not deploy from Cursor.
