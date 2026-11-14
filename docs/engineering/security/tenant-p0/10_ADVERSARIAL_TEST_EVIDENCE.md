# Adversarial Test Evidence

| Test | Command | Result |
|---|---|---|
| Pool GUC post-fix | `node artifacts/api-server/src/tests/tenantPoolGucContainment.adversarial.mjs` | PASS |
| P0 static | `pnpm exec tsx --test src/tests/tenantP0Remediation.static.test.ts` | 13/13 with Moyasar suite |
| Moyasar static | `pnpm exec tsx --test src/tests/tenantMoyasarWebhookIsolation.static.test.ts` | PASS |
| ARC regression | `cd artifacts/arc-server && pnpm test` | 129/129 PASS |
| HTTP two-tenant E2E | — | BLOCKED (no Clerk multi-tenant fixture harness this run) |
| Prompt injection E2E | — | BLOCKED / NOT_TESTED |
