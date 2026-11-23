# Phase 049 — Implementation Evidence

## Code changes

### 1. AI gateway tenant fail-closed

- **Added:** `artifacts/api-server/src/lib/aiGatewayTenant.ts`
  - `resolveAiGatewayOfficeId` — rejects non-string / empty / `"unknown"`.
  - `requireAiGatewayOfficeId` — fail-closed; optional admin aggregate bypass only when opted in.
- **Updated:** `artifacts/api-server/src/modules/ai/aiGateway.ts`
  - Routes use `requireAuthWithTenant` so `tenantId` / `isSuperAdmin` are server-set.
  - `/ai/query` requires real office id (rejects `unknown` / `platform`); 403 `TENANT_REQUIRED`.
  - Analytics use `isAiGatewayAdmin` (`isSuperAdmin`); optional aggregate bypass for SA only.
  - `/ai/query/cache-stats` restricted to SA.
- **Test:** `artifacts/api-server/src/tests/aiGatewayTenant.test.ts`
- **Script:** `pnpm --filter @workspace/api-server run test:ai-gateway-tenant`
- **Result:** PASS (2026-11-23 session)

### 2. Docker Compose secret hygiene

- `docker-compose.yml`: `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme_local_only}`
- `DATABASE_URL` uses the same env default (local only; not production).

### 3. Backup / continuity automation

- `scripts/engineering/milestone-preserve.sh` — local checkpoint, bundle, checksum, integrity verify; remote gated.
- `scripts/engineering/remote-backup-push.sh` — private-repo checks, no Phase 031 overwrite, contamination blob check, no force/mirror.
- `scripts/engineering/session-continuity.sh` — start-of-session state read.
- Manifest: `docs/engineering/continuity/ENGINEERING_STATE.json`

### 4. Contaminated forensic capture redaction

- Redacted `docs/engineering/forensic-git-recovery-032r/evidence/baseline-capture.txt` (removed live `ghs_`/`gho_` material).
- Contaminated blob `3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925` no longer present in tip **tree**.
- Local milestone bundles use orphan clean-tree commits so ancestral contaminated objects are not packed.
- Full tip **ancestry** is not rewritten (non-destructive); Phase 031 private clean backup remains the immutable clean history evidence.

## Non-actions (intentional)

- No production deploy.
- No remote push of Phase 049 milestone (`ALLOW_REMOTE_BACKUP` left unset).
- No modification of `backup/phase-031-clean`.
- No fabricated Phase 018–030 history.
