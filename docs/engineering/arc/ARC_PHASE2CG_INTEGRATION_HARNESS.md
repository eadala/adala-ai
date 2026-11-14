# ARC Phase 2C-G Integration Harness

## Purpose

Isolated runner that classifies each check as one of:

- `VERIFIED_FIXTURE`
- `VERIFIED_LIVE_TEST`
- `BLOCKED_NO_CREDENTIALS`
- `BLOCKED_NO_AUTHORIZATION`
- `FAILED`

Fixture success is **never** reported as live success.

## Entry points

| Interface | Path |
|---|---|
| Library | `runIntegrationHarness()` in `lib/integrationHarness.ts` |
| HTTP | `GET /api/arc/integration/harness` |
| Config probe | `GET /api/arc/integration/config` |

## Coverage

- Local OIDC fixture verify
- Optional live OIDC JWKS probe (only if configured)
- Local GitHub fixture + allowlist deny
- Optional live GitHub repository read
- Safety: no `deployment:execute`, Coolify `executeDeploy=false`, AI lacks deploy/approve
- `harnessDeployTriggerAvailable() === false`

## Default result (this environment)

Without live credentials: fixture cases `VERIFIED_FIXTURE`; live cases `BLOCKED_NO_CREDENTIALS` / fixture-not-requested.

## Status

**PASS** (harness implemented + tested)
