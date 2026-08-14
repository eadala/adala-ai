# Boot-Created Tables — API Runtime DDL

**Schema authority:** `artifacts/api-server/migrations/*.sql` (apply via `psql`).
**لا تعتمد على boot لإنشاء جداول P0.** استخدم migrations `003→001→004→005→…→017` أولاً.

عند تشغيل API، تُنشأ جداول enterprise إضافية عبر `CREATE TABLE IF NOT EXISTS` في
`artifacts/api-server/src/**` (قائمة كاملة في `boot-created-tables.txt`).

## ensure* المُستدعاة عند Boot (`index.ts`)

| الدالة | الملف | سلوك الفشل |
|--------|-------|------------|
| `ensureOfficePageSlugs` | `index.ts` | `logger.warn` — data backfill فقط (لا DDL) |
| ~~`ensureStripeBufferTables`~~ | removed — schema via migration **011** | — |
| ~~`ensureReconciliationTable`~~ | removed — schema via migration **011** | — |
| ~~`ensureERPTables`~~ | removed — ERP schema via migration **013** | — |
| ~~`ensureBankruptcyTables`~~ | removed — Bankruptcy schema via migration **014** | — |
| ~~`ensureDocumentCenterSchema` V2 DDL~~ | removed — Document V2 via migration **033**; helper keeps 021 readiness checks only | — |
| `ensureDocumentCenterSchema` (readiness) | `documentCenter.ts` | `logger.error` for missing 021 tables |
| ~~`ensureJLWMSchema` DDL~~ | removed — 14 JLWM core tables via migration **034**; helper keeps SELECT-only readiness | — |
| `ensureJLWMSchema` (readiness) | `jlwm.schema.ts` | `console.error` if Migration 034 tables missing |
| ~~`ensureFuturePathsTable` + satellite DDL~~ | removed — 6 JLWM satellite tables via migration **035**; helpers keep SELECT-only readiness | — |
| `ensureFuturePathsTable` (+ satellite readiness) | `futureExplorer` / `simulationEngine` / `litigationIntelligence` / `predictionAccuracy` / `executiveIntelligence` / `legalCOO` | `console.error` if Migration 035 tables missing |
| ~~`ensureReliabilitySchema` DDL~~ | removed — 5 Reliability tables via migration **036**; helper keeps SELECT-only readiness | — |
| `ensureReliabilitySchema` (readiness) | `reliabilityEngine.ts` | `console.error` if Migration 036 tables missing |
| ~~`ensureBankruptcyV2Tables`~~ | removed — Bankruptcy schema via migration **014** | — |
| ~~`ensureBankruptcyV3Tables`~~ | removed — Bankruptcy schema via migration **014** | — |
| ~~`ensurePerformanceIndexes`~~ | removed — indexes via migration **010** | — |
| ~~`ensurePaymentCols`~~ | removed — `payment_transactions` via migration **012** | — |
| ~~`ensureGatewaySettingsTables`~~ | removed — `moyasar_settings` / `checkout_settings` via migration **032** | — |

## ensure* أخرى (lazy — عند أول طلب HTTP)

معظمها `.catch(() => {})` أو `catch { return null }` — **تفشل بصمت** إذا التبعيات ناقصة:

- ~~`ensureEventsTable`~~ — removed; `system_events` via migration **005**
- ~~`ensureTable` (planCms/onboarding/trial)~~ — removed; schema via migration **005** (planCms keeps seed only)
- ~~`ensureTables` (contracts)~~ — removed; schema via migration **004**
- ~~`ensureERPTables`~~ — removed; ERP schema via migration **013**
- ~~`ensureJournalTables` DDL~~ — removed; seed-only via migration **013** schema
- ~~`ensureDemoColumns` (bankruptcy demo)~~ — no-op; `is_demo` columns via migration **014**
- ~~`ensureTables` (branches)~~ — removed; `office_branches`, `tasks.branch_id`, and branch indexes via migration **015**
- ~~`ensureFullTextSearch` (internal-messages)~~ — removed; `office_messages.search_vector` and `idx_messages_search` via migration **016**
- ~~`ensureCaseIdColumn` (internal-messages)~~ — removed; `office_messages.case_id` TEXT via migration **030** (Stage 22); no Runtime INTEGER ADD COLUMN
- ~~`ensureConversationTables`~~ — removed; `message_conversations` + `conversation_members` (+ `case_id TEXT`) via migration **031** (Stage 23.3B); compatible with **020** indexes
- ~~`ensureTables` (marketplace / client-portal / client-auth / homeCms)~~ — removed; schema via migration **038** (homeCms keeps singleton seed DML)
- ~~Runtime `CREATE`/`ALTER` for `office_ai_credits` / `ai_credit_transactions` / `ai_usage_logs`~~ — removed via migration **039**; `aiChat` / `aiCredits` keep readiness + platform seed DML (`INSERT … ON CONFLICT (office_id)`)
- ~~Runtime `CREATE` for `ai_provider_config` / `office_ai_settings`~~ — removed via migration **040**; `aiProviderEngine` keeps readiness (`to_regclass`) + provider seed DML (`INSERT … ON CONFLICT (provider)`) and settings upserts (`ON CONFLICT (office_id)`)
- ~~Runtime `CREATE`/`INDEX` for `ai_events` / `ai_events_office_status_idx`~~ — removed via migration **041**; `aiEvents` keeps readiness (`to_regclass`) + insert/read/dismiss/scan DML (application `WHERE NOT EXISTS` dedupe preserved)
- `ensureTables` — `production-os.ts`, `control-tower.ts`, ...
- `ensureVersioningTables` — `tenantVersioning.ts` (يحتاج `office_members`)
- `ensureGovernanceTables` — `governanceKernel.ts`
- `ensureJournalTables(officeId)` — CoA **seed only** (no DDL)
- ~~`ensureAutopilotTable`~~ — removed; `case_autopilot_reports` via migration **028**

## جداول P0 مغطاة بـ Migrations (لا تنتظر boot)

| الجدول | Migration |
|--------|-----------|
| `office_registry` | 003 |
| `office_members` | 005 |
| `trial_offices` | 005 |
| `onboarding_state` | 005 |
| `system_events` | 005 |
| `plan_cms` | 005 |
| `contract_templates` | 004 |
| `storage_folders` | 009 |
| `office_ledger` | 010 |
| `office_entitlements` | **025** |
| `platform_billing_invoices` | **025** |
| `promo_codes` | **026** |
| `gift_subscriptions` | **026** |
| `event_daily_counts` | **027** (preflight → clean dups if `BLOCKED_CLEAN_DUPLICATES` → apply → verify UNIQUE → deploy) |
| `case_autopilot_reports` | **028** (preflight → clean dups if `BLOCKED_CLEAN_DUPLICATES` → apply → verify PK(case_id) → deploy) |
| `stripe_events` | 011 |
| `stripe_dead_letters` | 011 |
| `stripe_reconciliation_log` | 011 |
| `payment_transactions` | 012 |
| `office_erp_ledger` | 013 |
| `financial_anomalies` | 013 |
| `chart_of_accounts` | 013 |
| `journal_entries` | 013 |
| `journal_items` | 013 |
| `bankruptcy_cases` | 014 |
| `bk_creditors` | 014 |
| `bk_claims` | 014 |
| `bk_claim_documents` | 014 |
| `bk_assets` | 014 |
| `bk_asset_valuations` | 014 |
| `bk_meetings` | 014 |
| `bk_distributions` | 014 |
| `bk_distribution_items` | 014 |
| `bk_reports` | 014 |
| `bk_ai_analysis` | 014 |
| `bk_timeline` | 014 |
| `bk_audit_logs` | 014 |
| `bk_notifications` | 014 |
| `bk_workflows` | 014 |
| `bk_workflow_steps` | 014 |
| `bk_workflow_events` | 014 |
| `bk_tasks` | 014 |
| `bk_task_comments` | 014 |
| `bk_task_assignments` | 014 |
| `bk_templates` | 014 |
| `bk_alerts` | 014 |
| `bk_opening_requests` | 014 |
| `bk_opening_request_documents` | 014 |
| `bk_emergency_locks` | 014 |
| `tasks` | 015 |
| `office_branches` | 015 |
| `office_messages.search_vector` | 016 |
| `office_messages.case_id` TEXT | **030** (preflight → apply INTEGER→TEXT exact `::text` → preflight ALREADY_CORRECT; FK deferred; Runtime `ensureCaseIdColumn` removed) |
| `message_conversations` / `conversation_members` | **031** (preflight → apply CREATE/repair + `case_id TEXT` + indexes; FK legacy-safe; Runtime `ensureConversationTables` removed; compatible with **020**) |
| `document_center_files` / `document_ai_metadata` / `rag_chunks` | **021** |
| `documents` V2 extension cols + `document_versions` / `document_permissions` / `storage_migration_log` / `document_retention_policies` | **033** (preflight → apply → re-preflight ALREADY_CORRECT → verify-schema → deploy; compliance `retention_policies` untouched) |
| `client_accounts` / `client_sessions` / `client_case_links` / `client_portal_tokens` / `case_timeline` / `portal_uploads` / `marketplace_services` / `marketplace_orders` (+ `clients.client_account_id`) | **038** (preflight → apply → re-preflight ALREADY_CORRECT → verify-schema → deploy; `home_cms` owned by 038 but not P0; storefront 003/004/006 untouched) |
| `office_ai_credits` / `ai_credit_transactions` / `ai_usage_logs` | **039** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; seed DML preserved; `usage_logs` remains **003**) |
| `ai_provider_config` / `office_ai_settings` | **040** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE removed; seed/upsert DML preserved) |
| `ai_events` (+ `ai_events_office_status_idx`) | **041** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE/INDEX removed; insert/dismiss/scan DML preserved) |

## Docker Production — ماذا يحتوي الصورة؟

`infra/Dockerfile.api` و `Dockerfile` (root) ينسخان فقط:

- `artifacts/api-server/dist/` (bundle)
- `node_modules/` (runtime)
- `public/` (frontend في root Dockerfile)

**غير موجود في الصورة:**

- `artifacts/api-server/migrations/`
- `scripts/db/`
- `psql` / `pg_dump` / `pg_restore`

**أين تُشغَّل الأوامر:** من **خارج الحاوية** — ops host، CI، jump box مع `DATABASE_URL`.
مثال:

```bash
cd /opt/adala   # clone المستودع على السيرفر
export DATABASE_URL="postgresql://..."
bash scripts/db/backup-restore.sh backup
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f artifacts/api-server/migrations/003_drizzle_baseline_safe.sql
# ...
bash scripts/db/verify-schema.sh
```

## اختبار Integration محلي

```bash
# يتطلب PostgreSQL محلي (لا Production)
bash scripts/db/test-migrations.integration.sh
pnpm --filter @workspace/api-server run test:schema-authority
```
