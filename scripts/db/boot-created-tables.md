# Boot-Created Tables — API Runtime DDL

**Schema authority:** `artifacts/api-server/migrations/*.sql` (apply via `psql`).
**لا تعتمد على boot لإنشاء جداول P0.** استخدم migrations `003→001→004→005→…→009` أولاً.

عند تشغيل API، تُنشأ جداول enterprise إضافية عبر `CREATE TABLE IF NOT EXISTS` في
`artifacts/api-server/src/**` (قائمة كاملة في `boot-created-tables.txt`).

## ensure* المُستدعاة عند Boot (`index.ts`)

| الدالة | الملف | سلوك الفشل |
|--------|-------|------------|
| `ensureOfficePageSlugs` | `index.ts` | `logger.warn` — data backfill فقط (لا DDL) |
| ~~`ensureStripeBufferTables`~~ | removed — schema via migration **011** | — |
| ~~`ensureReconciliationTable`~~ | removed — schema via migration **011** | — |
| ~~`ensureERPTables`~~ | removed — ERP schema via migration **013** | — |
| `ensureBankruptcyTables` | `bankruptcy.ts` | `logger.error` |
| `ensureDocumentCenterSchema` | `documentCenter.ts` | `logger.error` |
| `ensureJLWMSchema` + 6 جداول فرعية | `jlwm/index.ts` | `logger.error` لكل واحد |
| `ensureReliabilitySchema` | `reliabilityEngine.ts` | `logger.error` |
| `ensureBankruptcyV2Tables` | `bankruptcyV2.ts` | `logger.error` |
| `ensureBankruptcyV3Tables` | `bankruptcyV3.ts` | `logger.error` |
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
