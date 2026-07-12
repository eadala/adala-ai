# Database Migrations — عدالة AI

**لا تستخدم `drizzle-kit push` على Production.**

جميع الملفات هنا idempotent وآمنة للتشغيل اليدوي عبر `psql`.

## ترتيب التنفيذ (Production فارغة أو ناقصة)

من **جذر المستودع**:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/adala"

# 0) تحقق قبل التنفيذ
bash scripts/db/verify-schema.sh

# 1) نسخة احتياطية (إلزامي إذا كانت DB موجودة)
bash scripts/db/backup-restore.sh backup

# 2) Core Drizzle baseline (47 جدول)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/003_drizzle_baseline_safe.sql

# 3) Tenant isolation columns + indexes
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/001_tenant_isolation.sql

# 4) Legal core extensions
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/004_legal_core_extensions.sql

# 5) Tenant/platform tables
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/005_tenant_platform_tables.sql

# 6) Post-migration API support — login_logs + office_page.website_config
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/006_post_migration_api_support.sql

# 7) تحقق بعد التنفيذ
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

## جداول P0 (تسبب أخطاء runtime إن غابت)

| الجدول / العمود | Migration | مصدر الكود |
|-----------------|-----------|------------|
| `office_registry` | 003 | `tenantMiddleware.ts`, `goLiveMetrics.ts` |
| `office_members` | 005 | `tenantMiddleware.ts` |
| `office_page` | 003 | Marketplace |
| `office_page.website_config` | **006** | Drizzle `officePageTable`, `websiteBuilder.ts`, `/office/public/:slug` |
| `login_logs` | **006** | `loginTracking.ts`, SOC, `launchGate.ts` |
| `web_vitals` / `route_analytics` | **006** | `routes/metrics.ts` |
| `cases`, `contracts` | 003 + 004 | Legal core |

## اختبارات Integration (قبل PR)

```bash
bash scripts/db/test-migrations.integration.sh
```

يغطي: DB فارغة (003→001→004→005→006)، Production-like بدون `website_config`/`login_logs`، idempotency لـ 006، والمسارات المبلّغ عنها.
