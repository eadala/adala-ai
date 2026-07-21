# Database Migrations — عدالة AI

**Schema authority:** `artifacts/api-server/migrations/*.sql` is the sole
production DDL source. Do **not** use `drizzle-kit push` on Production.
Do **not** add Runtime `CREATE TABLE` / boot `ALTER TABLE` for tables already
covered here — apply the numbered migration instead.

`lib/db/src/schema` is the ORM type source only (Drizzle queries).

جميع الملفات هنا idempotent وآمنة للتشغيل اليدوي عبر `psql`.

## ترتيب التنفيذ (Production فارغة أو ناقصة)

من **جذر المستودع** (`/opt/adala` أو clone path):

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/adala"

# 0) تحقق قبل التنفيذ
bash scripts/db/verify-schema.sh

# 1) نسخة احتياطية (إلزامي إذا كانت DB موجودة)
bash scripts/db/backup-restore.sh backup

# 2) Core Drizzle baseline (47 جدول) — يشمل office_registry, cases, contracts
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/003_drizzle_baseline_safe.sql

# 3) Tenant isolation columns + indexes (موجود مسبقاً على main)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/001_tenant_isolation.sql

# 4) Legal core extensions — contract_templates + cases columns
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/004_legal_core_extensions.sql

# 5) Tenant/platform tables — office_members, trial_offices, plan_cms, ...
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/005_tenant_platform_tables.sql

# 6) Post-migration API support — login_logs + office_page.website_config + metrics
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/006_post_migration_api_support.sql

# 7) Storage quota TEXT tenant model — office_storage_quota
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/007_office_storage_quota_text_tenant.sql

# 8) Storage files TEXT tenant model — storage_files
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/008_storage_files_text_tenant.sql

# 9) Storage folders + folder_permissions
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/009_storage_folders.sql

# 10) office_ledger + performance indexes (Schema Authority Batch 2)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/010_office_ledger_performance_indexes.sql

# 11) Stripe infrastructure — stripe_events / dead_letters / reconciliation_log
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/011_stripe_infrastructure_tables.sql

# 12) payment_transactions (Schema Authority Batch 4)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/012_payment_transactions.sql

# 13) ERP schema — office_erp_ledger / anomalies / CoA / journal
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/013_erp_schema.sql

# 14) تحقق بعد التنفيذ
bash scripts/db/verify-schema.sh
```

## ملفات Migration

| الملف | الغرض |
|-------|--------|
| `001_tenant_isolation.sql` | `office_id` + indexes + backfill |
| `003_drizzle_baseline_safe.sql` | 47 جدول من `lib/db/drizzle/0000_baseline.sql` |
| `004_legal_core_extensions.sql` | `contract_templates` + أعمدة `contracts`/`cases` |
| `005_tenant_platform_tables.sql` | `office_members`, `trial_offices`, `plan_cms`, ... |
| `006_post_migration_api_support.sql` | `login_logs`, `office_page.website_config`, `web_vitals`, `route_analytics` |
| `007_office_storage_quota_text_tenant.sql` | `office_storage_quota` TEXT tenant key (trial_* / permanent); drop FK to `office_page` |
| `008_storage_files_text_tenant.sql` | `storage_files` formal CREATE (TEXT `office_id`); fixes Production `42P01` |
| `009_storage_folders.sql` | `storage_folders` + `folder_permissions` |
| `010_office_ledger_performance_indexes.sql` | `office_ledger` + performance indexes for tables in 001–009 |
| `011_stripe_infrastructure_tables.sql` | `stripe_events`, `stripe_dead_letters`, `stripe_reconciliation_log` |
| `012_payment_transactions.sql` | `payment_transactions` (incl. settlement + gateway columns) |
| `013_erp_schema.sql` | `office_erp_ledger`, `financial_anomalies`, `chart_of_accounts`, `journal_entries`, `journal_items` |

> **Deferred indexes (not in 010):** `idx_tasks_office_due`, `idx_tasks_status`,
> `idx_reminders_office_due` must be added in the future numbered migration that
> formally `CREATE`s the `tasks` and `reminders` tables. Do not re-run 010 for them.


## جداول P0 (تسبب أخطاء runtime إن غابت)

| الجدول / العمود | Migration | مصدر الكود |
|-----------------|-----------|------------|
| `office_registry` | 003 | `goLiveMetrics.ts`, `tenantResolver.ts` |
| `cases` | 003 + 004 (columns) | Legal core, JLWM |
| `contracts` | 003 + 004 (columns) | `contracts.ts` |
| `contract_templates` | 004 | `contracts.ts` (no Runtime DDL) |
| `office_members` | 005 | `tenantMiddleware.ts` (لا CREATE في الكود!) |
| `office_page` | 003 | Marketplace, tenant |
| `office_page.website_config` | **006** | Drizzle `officePageTable`, `websiteBuilder.ts`, `/office/public/:slug` |
| `login_logs` | **006** | `loginTracking.ts`, SOC, `launchGate.ts` |
| `web_vitals` / `route_analytics` | **006** | `routes/metrics.ts` |
| `office_storage_quota` | **007** | `storage.ts` POST `/storage/files` quota upsert |
| `storage_files` | **008** | `storageFileRegister.ts` / POST `/storage/files` insert |
| `storage_folders` | **009** | `storage.ts` folder management |
| `office_ledger` | **010** | billing / Stripe webhooks / reconcile |
| `stripe_events` | **011** | `stripeEventBuffer.ts` webhook buffer |
| `stripe_dead_letters` | **011** | Stripe DLQ |
| `stripe_reconciliation_log` | **011** | `stripeReconcile.ts` |
| `payment_transactions` | **012** | `payments.ts` / financial engine |
| `office_erp_ledger` | **013** | `erp-ledger.ts` double-entry |
| `financial_anomalies` | **013** | ERP reconcile / financial-guard |
| `chart_of_accounts` | **013** | `journalAccounting.ts` (seed retained) |
| `journal_entries` / `journal_items` | **013** | double-entry journal |
| `clients` | 003 | Legal core |

## ما يبقى بعد Migrations (boot-time)

~100 جدول enterprise تُنشأ عند أول boot للـ API عبر `ensure*Tables()` في
`artifacts/api-server/src/index.ts` والوحدات. هذه migrations تغطي **P0 + baseline**
فقط. بعد تطبيق 003–013، شغّل API مرة واحدة لإكمال الجداول المتبقية (enterprise).

جداول مغطاة بـ 004/005/010/011/012/013 لم تعد تُنشأ عبر Runtime DDL:
`contract_*`, `trial_offices`, `onboarding_state`, `system_events`, `plan_cms`, `office_ledger`,
`stripe_events`, `stripe_dead_letters`, `stripe_reconciliation_log`, `payment_transactions`,
`office_erp_ledger`, `financial_anomalies`, `chart_of_accounts`, `journal_entries`, `journal_items`
(+ performance indexes من `ensurePerformanceIndexes`).
`moyasar_settings` / `checkout_settings` remain Runtime DDL via `ensureGatewaySettingsTables()`.
`ensureJournalTables` retains CoA seed only (no DDL).

## Rollback

راجع `scripts/db/backup-restore.sh restore` — الاستعادة من pg_dump هي الطريقة الآمنة.
`DROP TABLE` يدوي غير موصى به على Production.

## اختبارات Integration (قبل PR)

```bash
# PostgreSQL محلي فقط — لا يلمس Production
bash scripts/db/test-migrations.integration.sh
pnpm --filter @workspace/api-server run test:schema-authority
```

يغطي: DB فارغة (003→001→004→005→006→007→008→009→010→011→012→013)، Production-like بدون `website_config`/`login_logs`،
idempotency لـ 006/007/008/009/010/011/012/013، محاذاة schema، backup/restore، والمسارات المبلّغ عنها.

راجع `scripts/db/boot-created-tables.md` لقائمة جداول boot وقيود Docker.
