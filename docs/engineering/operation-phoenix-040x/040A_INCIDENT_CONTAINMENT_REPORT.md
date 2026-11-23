# 040A — Incident Containment Report

## Credential (no values)

| Field | Result | Class |
|-------|--------|-------|
| SECRET_PROVIDER | GitHub | VERIFIED (prefix `ghs_`) |
| SECRET_TYPE | GitHub App / Actions server-to-server token (`ghs_`, len=48) + JWT-shaped companion | VERIFIED |
| Environment | **Unknown** (typical cloud-agent / GitHub App integration — not proven prod/staging/dev) | UNKNOWN |
| Potentially active | **Assume yes until revoked** — do not authenticate/test | INFERRED |

## Reachability

| Scope | Present? | Class |
|-------|----------|-------|
| Current HEAD tree | YES (`baseline-capture.txt`) | VERIFIED |
| Master checkpoint ancestry | YES (blob `3f1a3e36…`) | VERIFIED |
| Phase 031 ancestry / tree | **NO** | VERIFIED |
| Public `origin/main` history | **NO** | VERIFIED |
| Local-only | YES relative to public origin | VERIFIED |

## Severity

**P0 — CONTAINED_LOCALLY / NOT_PUBLIC_ON_ORIGIN_MAIN**  
Still requires owner revocation because the token may remain valid at GitHub even if not public.

## Affected services (potential)

- GitHub App / installation token consumers
- Cursor cloud-agent GitHub integration (if this token originated there)
- Any automation that captured remotes into `baseline-capture.txt`

## Rotation instructions (owner — do not paste secrets into chat)

1. GitHub → Settings → Applications / Installed GitHub Apps → revoke/rotate the relevant app installation token **or** regenerate Actions credentials for the integration that issued `ghs_`.
2. If Cursor/GitHub cloud integration was the source, rotate that connection’s credentials from Cursor dashboard / GitHub authorized apps.
3. Invalidate any associated JWT sessions if applicable.
4. Review GitHub audit log for the token’s lifetime (org/user audit log) — **authorization required** for account access.
5. Do **not** re-commit unredacted capture files.

## Audit-log review

**Necessary:** YES if token could access private repos or org resources. Requires owner login — **BLOCKED** for this agent (`gh api user` previously 403).

## History rewrite

**Not performed.** Forensic file preserved locally; excluded from clean export.

**SECRET_ROTATION_STATUS:** PENDING_OWNER_ACTION
