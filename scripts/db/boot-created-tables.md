# Boot-Created Tables — API Runtime DDL

**لا تعتمد على boot لإنشاء جداول P0.** استخدم migrations `003→001→004→005` أولاً.

عند تشغيل API، تُنشأ **188 جدولاً** إضافياً عبر `CREATE TABLE IF NOT EXISTS` في
`artifacts/api-server/src/**` (قائمة كاملة في `boot-created-tables.txt`).

## ensure* المُستدعاة عند Boot (`index.ts`)

| الدالة | الملف | سلوك الفشل |
|--------|-------|------------|
| `ensureAdHocColumns` | `index.ts` | `logger.warn` — يفشل إذا `cases`/`office_page`/`office_orders` ناقصة |
| `ensureStripeBufferTables` | `stripeEventBuffer.ts` | `logger.error` — يحتاج `stripe` schema من `runMigrations` |
| `ensureReconciliationTable` | `stripeReconcile.ts` | `logger.error` |
| `ensureERPTables` | `erp-ledger.ts` | `logger.error` — FK على جداول مالية |
| `ensureBankruptcyTables` | `bankruptcy.ts` | `logger.error` |
| `ensureDocumentCenterSchema` | `documentCenter.ts` | `logger.error` |
| `ensureJLWMSchema` + 6 جداول فرعية | `jlwm/index.ts` | `logger.error` لكل واحدة |
| `ensureReliabilitySchema` | `reliabilityEngine.ts` | `logger.error` |
| `ensureBankruptcyV2Tables` | `bankruptcyV2.ts` | `logger.error` |
| `ensureBankruptcyV3Tables` | `bankruptcyV3.ts` | `logger.error` |
| `ensurePerformanceIndexes` | `index.ts` | `.catch(() => {})` — **صامت** |

## ensure* أخرى (lazy — عند أول طلب HTTP)

معظمها `.catch(() => {})` أو `catch { return null }` — **تفشل بصمت** إذا التبعيات ناقصة:

- `ensureEventsTable` — `eventBus.ts` (يُستدعى عند import)
- `ensureTable` — `planCms.ts`, `onboarding.ts`, `trialOnboarding.ts`
- `ensureTables` — `contracts.ts`, `marketplace.ts`, `production-os.ts`, `control-tower.ts`, ...
- `ensureVersioningTables` — `tenantVersioning.ts` (يحتاج `office_members`)
- `ensureGovernanceTables` — `governanceKernel.ts`
- `ensureJournalTables(officeId)` — per-tenant، يُستدعى عند أول استخدام ERP

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
```
