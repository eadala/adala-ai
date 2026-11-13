# Release Management — Adalah AI

## Versioning

- Use Semantic Versioning: `MAJOR.MINOR.PATCH` (e.g. `v1.4.0`).
- Annotated tags only: `git tag -a vX.Y.Z -m "…"`.
- GitHub Releases must reference the **exact commit SHA** and **tree SHA**.

## Identity record (mandatory in every release note)

```
Commit: <40-char SHA>
Tree:   <40-char tree SHA>
Tag:    vX.Y.Z (if any)
CI:     <workflow run URL(s)>
Migrations touched: <list or "none">
Deploy: NOT STARTED | AUTHORIZED | COMPLETE (with verified deployed SHA)
```

Verify with:

```bash
./scripts/release/verify-release.sh <commit-or-tag>
./scripts/release/verify-release.sh --compare <from> <to>
```

## Frozen release candidate (immutable)

| Field | Value |
|-------|--------|
| Commit | `5441523302a1513f07b5dc08f028d848a0bad5b4` |
| Tree | `cd84a7f277c481dc5c96d707dde4e78d7f18e713` |
| PRs | `#138 ⊂ #139 ⊂ #140` |
| Production-ready tag | **Do not create** until production GO is separately authorized |

Do not amend, rebase, squash, cherry-pick onto, or retag this candidate as production.

## Release flow

1. Stabilize on `develop` (or a `release/x.y.z` cut).
2. Open release PR into `main` after reviews + CI.
3. After merge authorization, create annotated tag on the **merged main tip** (not a guess).
4. Publish GitHub Release using `.github/RELEASE_TEMPLATE.md`.
5. Deploy only after Coolify/operator authorization (see `DEPLOYMENT_SAFETY.md`).
6. Record verified **deployed** SHA independently (Coolify UI / container inspect). Never assume tag == production.

## Migration rules

- All production DDL via numbered files under `artifacts/api-server/migrations/`.
- Never apply migrations from Cursor against production.
- Release notes must list migration IDs added since previous release.
- Rollback that requires reversing migrations needs DBA review (`RECOVERY_AND_ROLLBACK.md`).

## What not to do

- Do not tag `main` tip as production without deployed-SHA proof.
- Do not tag the frozen RC as `production-ready`.
- Do not auto-deploy from this document.
