# ARC Phase 2C-1 GitHub Validation

## Verified facts (fixture / simulated)

- Read-only adapter; no push/merge/release/settings mutations.
- Repository allowlisting — unauthorized repo → `repository_not_allowlisted`.
- Immutable commit SHA format checks; optional live git commit fetch when authorized.
- Workflow / PR review / release metadata retrieval interfaces.
- Pagination (`page` / `pageSize` capped ≤ 50).
- Cache freshness metadata (`cacheAgeMs`).
- Rate-limit and timeout simulation → DEGRADED / UNAVAILABLE.
- Token redaction via `sanitizeForLog` / `redactSecrets`.
- **Deployed production identity is never inferred from GitHub** (`productionDeployedIdentityFromGithub` → UNVERIFIED).

## Live GitHub integration

**BLOCKED** — `ARC_GITHUB_TOKEN` / GitHub App installation token not present. No broad PAT introduced. Fixture retained.

## Restrictions honored

No push, merge, releases, or repository setting changes performed.

## Status

**PASS** (fixture + security controls) · **BLOCKED** (live authorized read)
