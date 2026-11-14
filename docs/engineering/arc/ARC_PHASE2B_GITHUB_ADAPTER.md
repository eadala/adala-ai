# ARC Phase 2B GitHub Read-Only Adapter

## Interface

Typed `GithubAdapter`: repository, branch protection, PRs, reviews, commit checks, release metadata.

## Controls

- Default `ARC_GITHUB_MODE=fixture`.
- Allowlisted repos (`ARC_GITHUB_REPO_ALLOWLIST`).
- Fixed origin `https://api.github.com`; TLS via HTTPS; `redirect: error`.
- Timeouts, pagination caps, secret redaction.
- Token (`ARC_GITHUB_TOKEN`) backend-only — never returned in API bodies.

## Evidence semantics

Observations carry source, retrieval time, verification state, commit SHA when known.  
Workflow success ≠ required-check success ≠ human review ≠ release approval.

## Status

**PASS** (fixture + SSRF denial tests) · Live authenticated GitHub App: **UNVERIFIED**
