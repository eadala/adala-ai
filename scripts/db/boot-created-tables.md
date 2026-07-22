# Boot-Created Tables — API Runtime DDL

**Schema authority:** `artifacts/api-server/migrations/*.sql` (apply via `psql`).
**لا تعتمد على boot لإنشاء جداول P0.** استخدم migrations `003→001→004→005→…→014` أولاً.

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
| `ensureDocumentCenterSchema` | `documentCenter.ts` | `logger.error` |
| `ensureJLWMSchema` + 6 جداول فرعية | `jlwm/index.ts` | `logger.error` لكل واحد |
| `ensureReliabilitySchema` | `reliabilityEngine.ts` | `logger.error` |
| ~~`ensureBankruptcyV2Tables`~~ | removed — Bankruptcy schema via migration **014** | — |
| ~~`ensureBankruptcyV3Tables`~~ | removed — Bankruptcy schema via migration **014** | — |
| ~~`ensurePerformanceIndexes`~~ | removed — indexes via migration **010** | — |
| ~~`ensurePaymentCols`~~ | removed — `payment_transactions` via migration **012** | — |
| `ensureGatewaySettingsTables` | `payments.ts` (module load) | `logger.error` — `moyasar_settings` / `checkout_settings` only |

## ensure* أخرى (lazy — عند أول طلب HTTP)

معظمها `.catch(() => {})` أو `catch { return null }` — **تفشل بصمت** إذا التبعيات ناقصة:

- ~~`ensureEventsTable`~~ — removed; `system_events` via migration **005**
- ~~`ensureTable` (planCms/onboarding/trial)~~ — removed; schema via migration **005** (planCms keeps seed only)
- ~~`ensureTables` (contracts)~~ — removed; schema via migration **004**
- ~~`ensureERPTables`~~ — removed; ERP schema via migration **013**
- ~~`ensureJournalTables` DDL~~ — removed; seed-only via migration **013** schema
- ~~`ensureDemoColumns` (bankruptcy demo)~~ — no-op; `is_demo` columns via migration **014**
- `ensureTables` — `marketplace.ts`, `production-os.ts`, `control-tower.ts`, ...
- `ensureVersioningTables` — `tenantVersioning.ts` (يحتاج `office_members`)
- `ensureGovernanceTables` — `governanceKernel.ts`
- `ensureJournalTables(officeId)` — CoA **seed only** (no DDL)

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
