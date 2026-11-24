# ADALA-CD-FINAL-ACTIVATION-001 — Evidence

## Independently verified

| Fact | Evidence |
|------|----------|
| CI recovery run 45284681694 | **success** — all required jobs + ✅ All Gates Passed |
| Recovery SHA | `cb7722bc` on `cursor/ci-quality-gates-recovery-da81` (orphan; contam absent) |
| Production health | `https://adalahai.com/api/healthz` → 200 `{"ok":true,"status":"healthy"}` |
| Coolify prod source | Owner-stated `main` + Deploy on push — **not modified by agent** |
| Repo webhooks | Agent lacks `admin:repo_hook`; owner reported empty — **not modified** |
| Contaminated OID on `main`/`develop` | **NOT reachable** |
| Contaminated OID on phase-049 | **REACHABLE** |
| Coolify API in agent env | **Unavailable** |
| GitHub Actions vars/secrets API | **403** (push via git token works; settings API does not) |

## Credential incident

| Field | Finding |
|-------|---------|
| Type | GitHub App installation token class (`ghs_`) + JWT-shaped companion in forensic blob |
| Contaminated OID | `3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925` |
| Issuance/expiry in-repo | Capture metadata present; App installation tokens are short-lived (~1h) but **revocation of issuing installation is not evidenced** |
| Clearance | **NOT CONFIRMED** — production CD remains blocked |

## Agent actions this directive

- Staging CI-controlled workflow added (`cd-coolify-staging.yml`) — inactive by default
- Consolidated clean release candidate pushed (see FINAL REPORT)
- Develop-lineage automation land branch for mergeable PR (workflows/scripts only)
- No Coolify production branch change, no manual webhook add, no production redeploy
