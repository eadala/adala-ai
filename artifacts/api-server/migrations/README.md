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

# 14) Bankruptcy schema — bankruptcy_cases / bk_* tables
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/014_bankruptcy_schema.sql

# 15) Tasks + Branches schema — tasks / office_branches / branch_id FKs
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/015_tasks_branches_schema.sql

# 16) Office Messages FTS — office_messages / search_vector / GIN
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/016_office_messages_fts.sql

# 17) Cases schema — case_number / court_* / deleted_at / version
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/017_cases_schema.sql

# 18) Money Numeric Batch 1 — REAL → NUMERIC(18,2) for core SAR fields
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/018_money_numeric_batch1.sql

# 19) Money Numeric Batch 2 — bare NUMERIC → NUMERIC(18,2) payment/ledger
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/019_money_numeric_batch2.sql

# 20) Hot-path performance indexes (Stage 10.7) — CREATE INDEX only
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/020_performance_hotpath_indexes.sql

# 21) RAG schema foundation (Stage 11.2) — requires pgvector
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/021_rag_schema_foundation.sql

# 23) Legacy trial_* → UUID offices (Stage 15.2c) — MUST before 024
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/023_trial_uuid_offices.sql

# 24) Tasks tenant ownership + orphan quarantine (Stage 15) — after 023 only
#    Autopilot UUID office writes must be deployed before production apply.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/024_tasks_tenant_ownership.sql

# 25) Billing schema authority — office_entitlements + platform_billing_invoices (Stage 16.1)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/025_billing_schema_authority.sql

# 26) Promo schema authority — promo_codes + gift_subscriptions (Stage 16.3)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/026_promo_schema_authority.sql

# 27) Analytics schema authority — event_daily_counts (Stage 16.5)
#    Ops order (required — listener has no Runtime DDL):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-027.sql
#      b) if chosen_action = BLOCKED_CLEAN_DUPLICATES → clean duplicate
#         (event_type, office_id, event_date) groups; do NOT apply yet
#      c) apply 027 (aborts if duplicates remain — never commits without UNIQUE)
#      d) verify UNIQUE(event_type, office_id, event_date) exists
#      e) deploy API build
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-027.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/027_event_daily_counts_schema_authority.sql
psql "$DATABASE_URL" -At -c "
  SELECT COUNT(*) FROM pg_constraint
  WHERE conrelid = 'public.event_daily_counts'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(event_type, office_id, event_date)%';
"

# 28) Autopilot schema authority — case_autopilot_reports (Stage 19 / P2)
#    Ops order (required — ensureAutopilotTable removed):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-028.sql
#      b) if chosen_action = BLOCKED_CLEAN_DUPLICATES → clean duplicate/NULL
#         case_id rows; do NOT apply yet
#      c) apply 028 (aborts if duplicates remain — never commits without PK)
#      d) verify PRIMARY KEY / UNIQUE(case_id) exists
#      e) deploy API build
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-028.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/028_case_autopilot_reports_schema_authority.sql
psql "$DATABASE_URL" -At -c "
  SELECT COUNT(*) FROM pg_constraint
  WHERE conrelid = 'public.case_autopilot_reports'::regclass
    AND contype IN ('p', 'u')
    AND (
      pg_get_constraintdef(oid) ILIKE '%PRIMARY KEY (case_id)%'
      OR pg_get_constraintdef(oid) ILIKE '%UNIQUE (case_id)%'
    );
"

# 29) FTS readiness — office_messages search_vector / GIN (Stage 20.3)
#    Ops order (required — no destructive auto-repair):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-029.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → manual repair; do NOT apply
#      c) if lock_risk = HIGH → schedule maintenance window
#         (ADD GENERATED STORED may rewrite; GIN build may block writes)
#      d) apply 029 (SAFE add column / add GIN only; aborts on BLOCK shapes)
#      e) re-run preflight → expect ALREADY_CORRECT
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-029.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/029_office_messages_fts_readiness.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-029.sql

# 30) office_messages.case_id TEXT alignment (Stage 22)
#    Ops order (required — no invent integer→UUID mapping; FK deferred):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-030.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → manual repair; do NOT apply
#      c) if lock_risk = HIGH → schedule maintenance window
#         (ALTER COLUMN TYPE … USING rewrites; ACCESS EXCLUSIVE)
#      d) apply 030 (INTEGER→TEXT exact ::text; already-TEXT no-op)
#      e) re-run preflight → expect ALREADY_CORRECT
#    Legacy integer 42 becomes textual '42' unchanged — never mapped to a UUID.
#    Orphans remain; validating FK intentionally deferred until orphan review.
#    Runtime ensureCaseIdColumn removed — Migration 030 owns case_id TEXT.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-030.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/030_office_messages_case_id_text.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-030.sql

# 31) message_conversations + conversation_members schema authority (Stage 23.3B)
#    Ops order (required — no DROP; no invent ownership; FK may defer on orphans):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-031.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → manual repair; do NOT apply
#         (dups / NULL ids / incompatible types / incompatible same-name indexes)
#      c) apply 031 (CREATE/repair tables + case_id TEXT + indexes; FK legacy-safe)
#      d) re-run preflight → expect ALREADY_CORRECT (FK may still be deferred)
#    Migration 020 already owns matching hot-path indexes when tables exist;
#    031 is complete table authority and remains compatible with 020.
#    Runtime ensureConversationTables removed — deploy API only after 031.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-031.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/031_message_conversations_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-031.sql

# 32) moyasar_settings + checkout_settings schema authority (Stage 23.4)
#    Ops order (required — no DROP; no invent ownership; no auto-merge dups):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-032.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → manual repair; do NOT apply
#         (dups / NULL office_id / incompatible types / incompatible UNIQUE/PK)
#      c) apply 032 (CREATE/repair; DROP office_id DEFAULT; SET NOT NULL; UNIQUE)
#      d) re-run preflight → expect ALREADY_CORRECT
#    Legacy office_id='default' rows are preserved (reported, non-blocking).
#    Runtime ensureGatewaySettingsTables removed — deploy API only after 032.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-032.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/032_gateway_settings_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-032.sql

# 33) Document V2 schema authority (Stage 23.5B)
#    Ops order (required — no DROP; no invent/remap tenant data; no compliance touch):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-033.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → stop (incompatible types / NULL /
#         duplicate retention keys / incompatible PK/UNIQUE/INDEX)
#      c) apply 033 (documents extension cols + V2 tables + document_retention_policies seed)
#      d) re-run preflight → expect ALREADY_CORRECT
#      e) bash scripts/db/verify-schema.sh
#      f) deploy API
#    Does NOT copy compliance retention_policies. New table: document_retention_policies.
#    Runtime Document V2 DDL removed from ensureDocumentCenterSchema — deploy API only after 033.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-033.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/033_document_v2_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-033.sql

# 34) JLWM Core schema authority (Stage 4B)
#    Ops order (required — no DROP; no invent/remap/delete office_id):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-034.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → stop
#      c) apply 034 (14 core JLWM tables + indexes + partial unique + edges FK)
#      d) re-run preflight → expect ALREADY_CORRECT
#      e) bash scripts/db/verify-schema.sh
#      f) deploy API
#    Does NOT own satellites (035) or Reliability (036).
#    memory_edges FK is legacy-safe (DEFERRED on orphans; post-apply reports fk_status).
#    Runtime ensureJLWMSchema DDL removed — deploy API only after 034.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-034.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/034_jlwm_core_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-034.sql

# 35) JLWM Satellites schema authority (Stage 4C)
#    Ops order (required — no DROP; no invent/remap/delete office_id):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-035.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → stop
#      c) apply 035 (6 satellite tables + indexes)
#      d) re-run preflight → expect ALREADY_CORRECT
#      e) bash scripts/db/verify-schema.sh
#      f) deploy API
#    Does NOT own Reliability (036).
#    Runtime satellite ensure* DDL removed — deploy API only after 035.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-035.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/035_jlwm_satellites_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-035.sql

# 36) JLWM Reliability schema authority (Stage 4D)
#    Ops order (required — no DROP; no invent/remap/delete office_id):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-036.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → stop
#      c) apply 036 (5 Reliability tables + 6 indexes)
#      d) re-run preflight → expect ALREADY_CORRECT
#      e) bash scripts/db/verify-schema.sh
#      f) deploy API
#    Runtime ensureReliabilitySchema CREATE/INDEX removed — deploy API only after 036.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-036.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/036_jlwm_reliability_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-036.sql

# 37) Remaining Financial Runtime schema authority (Stage 5B)
#    Ops order (required — do NOT apply to production without approval):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-037.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → stop / manual review
#      c) if SAFE_AUTO_REPAIR or ALREADY_CORRECT → apply 037
#      d) re-run preflight → expect ALREADY_CORRECT
#      e) bash scripts/db/verify-schema.sh
#      f) deploy API
#    Owns: financial_accounts, ledger_entries (+ DML office_id), wallets,
#    lawyer_payouts, invoice_payments, office_tax_settings, invoice_revisions,
#    credit_notes, invoice_seq; client_invoices extensions (not invoice_number);
#    revenues/expenses.deleted_at; case financial indexes.
#    Does NOT re-own 003/010/011/012/013/019/025/032.
#    Runtime financial CREATE/ALTER/INDEX removed — deploy API only after 037.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-037.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/037_financial_remaining_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-037.sql

# 38) Marketplace + Client Portal Runtime schema authority (Stage 6B)
#    Ops order (required — do NOT apply to production without approval):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-038.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → stop / manual review
#      c) if SAFE_AUTO_REPAIR or ALREADY_CORRECT → apply 038
#      d) re-run preflight → expect ALREADY_CORRECT
#      e) bash scripts/db/verify-schema.sh
#      f) deploy API
#    Owns: marketplace_services/orders/deals/deal_offers; client_portal_tokens;
#    portal_uploads; case_timeline; client_accounts/sessions/case_links (auth FK);
#    home_cms; clients.client_account_id TEXT nullable (no backfill).
#    Does NOT re-own invitations/office_page/office_services/office_orders/office_reviews
#    (003/004/006). Does NOT own client_comm_settings/website_builder_pages/
#    clients.deleted_at/appointments.
#    Runtime marketplace/portal/auth/homeCms/webhook CREATE+ALTER removed —
#    deploy API only after 038.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-038.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/038_marketplace_client_portal_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-038.sql

# 39) AI Credits + Usage Runtime schema authority (Stage 7B)
#    Ops order (required — do NOT apply to production without approval):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-039.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → stop / manual review
#      c) if SAFE_AUTO_REPAIR or ALREADY_CORRECT → apply 039
#      d) re-run preflight → expect ALREADY_CORRECT
#      e) bash scripts/db/verify-schema.sh
#      f) deploy API
#    Owns: office_ai_credits (+ UNIQUE(office_id), balance DEFAULT 100,
#    daily/monthly limit columns); ai_credit_transactions; ai_usage_logs
#    (+ idx_ai_usage_office / idx_ai_usage_created / partial idx_ai_usage_case).
#    Does NOT CREATE usage_logs (003) or ai_provider_config / office_ai_settings
#    (040). office_id='default' is a deliberate business key (never remapped/blocked).
#    Runtime CREATE/ALTER for credits/usage removed from aiChat/aiCredits —
#    deploy API after 039 (provider/settings CREATE owned by 040).
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-039.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/039_ai_credits_usage_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-039.sql

# 40) AI Provider Engine Runtime schema authority (Stage 7E)
#    Ops order (required — do NOT apply to production without approval):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-040.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → stop / manual review
#      c) if SAFE_AUTO_REPAIR or ALREADY_CORRECT → apply 040
#      d) re-run preflight → expect ALREADY_CORRECT
#      e) bash scripts/db/verify-schema.sh
#      f) deploy API
#    Owns: ai_provider_config (+ UNIQUE(provider) for ON CONFLICT (provider));
#    office_ai_settings (+ UNIQUE(office_id) for ON CONFLICT (office_id)).
#    Does NOT CREATE office_ai_credits / ai_credit_transactions / ai_usage_logs
#    (039), ai_events, agents, support AI, orphan credit/session tables.
#    No invented FK. office_id is TEXT business key (no UUID-only enforcement).
#    Runtime CREATE removed from aiProviderEngine; readiness + seed/upsert DML
#    preserved — deploy API after 040.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-040.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/040_ai_provider_engine_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-040.sql

# 41) AI Events Runtime schema authority (Stage 7E)
#    Ops order (required — do NOT apply to production without approval):
#      a) psql "$DATABASE_URL" -f scripts/db/preflight-migration-041.sql
#      b) if chosen_action = BLOCK_AND_MANUAL_REVIEW → stop / manual review
#      c) if SAFE_AUTO_REPAIR or ALREADY_CORRECT → apply 041
#      d) re-run preflight → expect ALREADY_CORRECT
#      e) bash scripts/db/verify-schema.sh
#      f) deploy API
#    Owns: ai_events (+ ai_events_office_status_idx (office_id, status, created_at DESC)).
#    Does NOT CREATE agents / case_ai_insights / ai_coo / support AI / orphans /
#    039–040 objects. No invented UNIQUE/FK (dedupe is WHERE NOT EXISTS).
#    office_id is TEXT business key (no UUID-only enforcement).
#    created_at is TIMESTAMP (without time zone) — exact Runtime contract.
#    Runtime CREATE/INDEX removed from aiEvents; readiness + DML preserved —
#    deploy API after 041.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-041.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/migrations/041_ai_events_schema_authority.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/db/preflight-migration-041.sql

# 42) تحقق بعد التنفيذ
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
| `014_bankruptcy_schema.sql` | `bankruptcy_cases` + 24 `bk_*` Bankruptcy tables |
| `015_tasks_branches_schema.sql` | `tasks` + `office_branches` + branch assignment FKs/indexes |
| `016_office_messages_fts.sql` | `office_messages` + `search_vector` + `idx_messages_search` |
| `017_cases_schema.sql` | `cases.case_number` / court_* / `deleted_at` / `version` + unique index |
| `018_money_numeric_batch1.sql` | REAL → `NUMERIC(18,2)` for invoices/subscriptions/usage_logs/plans/discount_codes/ai_api_keys money columns |
| `019_money_numeric_batch2.sql` | bare `NUMERIC` → `NUMERIC(18,2)` for `payment_transactions` / `office_ledger` fee & amount columns |
| `020_performance_hotpath_indexes.sql` | High-impact hot-path indexes (conversations, storage ACL, HR, events) — `CREATE INDEX` only |
| `021_rag_schema_foundation.sql` | pgvector + `document_center_files` / `document_ai_metadata` formalization + `rag_chunks` with composite tenant FK `(office_id, document_id) → (office_id, id)` + `vector(1536)` HNSW (Stage 11.2). **Requires pgvector-enabled Postgres (≥0.5).** Coolify: changing repo `docker-compose` does **not** change the deployed DB image — switch Coolify Postgres to `pgvector/pgvector:pg16` (or equivalent) **before** applying 021. Same major (16→16 pgvector) can keep the existing data volume; major upgrades need dump/restore. Embedding contract: Decision A — keep `vector(1536)` (text-embedding-3-small); Stage 11.3 must reject incompatible dims. |
| `023_trial_uuid_offices.sql` | Legacy `trial_*` → canonical `office_page` UUID remap (Stage 15.2c). Run **before** 024. |
| `024_tasks_tenant_ownership.sql` | Strict `tasks.office_id` backfill + orphan quarantine + `NOT NULL` (Stage 15). **Requires 023 first.** Autopilot UUID office writes must be deployed before production apply. |
| `025_billing_schema_authority.sql` | Formal `office_entitlements` + `platform_billing_invoices` (Stage 16.1). Fixes Billing GET 500s; tenant-scoped reads in app code. |
| `026_promo_schema_authority.sql` | Formal `promo_codes` + `gift_subscriptions` (Stage 16.3). Fixes `GET /api/promo/my-gift` 500 when tables absent. Gifts require `office_id` + `user_id`; tenant reads are ownership-scoped. |
| `027_event_daily_counts_schema_authority.sql` | Formal `event_daily_counts` (Stage 16.5). Removes Runtime DDL + `office_id DEFAULT 'default'`; analytics upserts require canonical Office UUID. Duplicate upsert-key groups abort apply (`BLOCKED_CLEAN_DUPLICATES`). Preflight: `scripts/db/preflight-migration-027.sql`. Ops: preflight → clean dups → apply 027 → verify UNIQUE → deploy. |
| `028_case_autopilot_reports_schema_authority.sql` | Formal `case_autopilot_reports` (Stage 19 / P2). Removes Runtime DDL (`ensureAutopilotTable`). Supports Autopilot `ON CONFLICT (case_id)` upsert + `idx_autopilot_office`. Arbiter must be real `PRIMARY KEY`/`UNIQUE(case_id)` (or non-partial non-expression unique index on `case_id` only); probe upsert before COMMIT. Duplicate/NULL `case_id` → `BLOCKED_CLEAN_DUPLICATES`. Preflight: `scripts/db/preflight-migration-028.sql`. Ops: preflight → clean/block → apply 028 → verify arbiter → deploy. |
| `029_office_messages_fts_readiness.sql` | FTS readiness follow-up to 016 (Stage 20.3). SAFE only: add missing generated STORED `search_vector` (`arabic`|`simple` + intended subject+body expression) and/or missing GIN `idx_messages_search`. BLOCK when `idx_messages_search` already exists with incompatible shape (incl. absent `search_vector` + name conflict), wrong type, non-STORED, wrong expression, partial/wrong/invalid index — no DROP COLUMN/INDEX. Post-apply GIN readiness gate before COMMIT. Preflight: `scripts/db/preflight-migration-029.sql` (`chosen_action` + `lock_risk`). Ops: preflight → block/manual or schedule HIGH lock_risk → apply 029 → preflight ALREADY_CORRECT. |
| `030_office_messages_case_id_text.sql` | Align `office_messages.case_id` with authoritative `cases.id` TEXT (Stage 22). SAFE: INTEGER→TEXT via exact `case_id::text` (legacy `42` → `'42'`); already-TEXT is no-op. Never invent integer→UUID mappings; never NULL/delete orphans; validating FK intentionally deferred until legacy orphan review. Ensures schema-owned `idx_messages_case_id`. BLOCK on unexpected/incompatible `case_id` types. Runtime `ensureCaseIdColumn` removed. Preflight: `scripts/db/preflight-migration-030.sql` (`chosen_action` + orphan/cross-office counts + `lock_risk`). Ops: preflight → block/manual or schedule HIGH lock_risk → apply 030 → preflight ALREADY_CORRECT. |
| `031_message_conversations_schema_authority.sql` | Formal `message_conversations` + `conversation_members` (Stage 23.3B). Includes required `case_id TEXT` (Runtime CREATE omitted it). Indexes: `idx_conv_office`, `idx_convs_case_id` (020 partial form), `idx_conv_members_*`, `idx_conv_updated` `(office_id, updated_at DESC)`. Compatible with Migration **020** index-only authority (020 not rewritten). FK `conversation_members→message_conversations` ON DELETE CASCADE is legacy-safe (skip + WARNING on orphans; post-apply reports `fk_status=INSTALLED|DEFERRED|PENDING`). Safe `SET NOT NULL` on required columns when no NULL rows. BLOCK on dups/NULL ids/incompatible types/incompatible same-name indexes (no DROP INDEX). Runtime `ensureConversationTables` removed. Preflight: `scripts/db/preflight-migration-031.sql` (inspect → blockers → SAFE → ALREADY_CORRECT; never short-circuits past blockers). Ops: preflight → block/manual or apply 031 → preflight ALREADY_CORRECT → deploy API. |
| `032_gateway_settings_schema_authority.sql` | Formal `moyasar_settings` + `checkout_settings` (Stage 23.4). `office_id TEXT NOT NULL` with **no** DEFAULT (drops legacy DEFAULT `'default'` only; row values preserved). Strict `UNIQUE(office_id)`. No FK. BLOCK on NULL/duplicate `office_id`, incompatible types/PK/UNIQUE. Runtime `ensureGatewaySettingsTables` removed. Preflight: `scripts/db/preflight-migration-032.sql`. Ops: preflight → block/manual or apply 032 → preflight ALREADY_CORRECT → deploy API. |
| `033_document_v2_schema_authority.sql` | Document V2 schema authority (Stage 23.5B). Owns `documents` extension columns (`storage_key`/`storage_provider`/`checksum`/`version`/`is_archived`/`legal_category`/`tags`/`migrated_at`/`file_size`), `document_versions`, `document_permissions`, `storage_migration_log`, and **new** `document_retention_policies` (strict `UNIQUE(office_id, category)` + `__default__` seed). Does **not** alter/drop/re-own compliance `retention_policies`. No invented UNIQUE on `storage_migration_log`. BLOCK on incompatible types/NULL/PK/UNIQUE/INDEX and duplicate retention keys. Runtime V2 DDL removed from `ensureDocumentCenterSchema`. Preflight: `scripts/db/preflight-migration-033.sql`. Ops: preflight → block/manual or apply 033 → preflight ALREADY_CORRECT → verify-schema → deploy API. |
| `034_jlwm_core_schema_authority.sql` | JLWM Core schema authority (Stage 4B). Owns the 14 tables from former `ensureJLWMSchema()`: `jlwm_config` (+ `UNIQUE(office_id)`), `jlwm_memory_nodes` (+ partial `UNIQUE idx_jmn_uniq (office_id,node_type,node_ref) WHERE node_ref IS NOT NULL`), `jlwm_memory_edges` (+ FK→nodes ON DELETE CASCADE, legacy-safe defer on orphans), world/patterns/command/twins/predictions/recommendations/radar/feedback. Twin UNIQUEs: `(office_id,case_id)`, `(office_id,client_id)`, `(office_id,snapshot_date)`. BLOCK on incompatible types/NULL/non-UUID `office_id`/duplicate arbiters/wrong PK/UNIQUE/INDEX. No invented UNIQUEs for targetless `ON CONFLICT DO NOTHING`. Does **not** own satellites (035) or Reliability (036). Runtime core DDL removed; seed DML preserved. Preflight: `scripts/db/preflight-migration-034.sql`. Ops: preflight → block/manual or apply 034 → preflight ALREADY_CORRECT → verify-schema → deploy API. |
| `035_jlwm_satellites_schema_authority.sql` | JLWM Satellites schema authority (Stage 4C). Owns the 6 tables from former Runtime satellite ensure*: `jlwm_future_paths`, `jlwm_simulations`, `jlwm_litigation_intel`, `jlwm_accuracy_records`, `jlwm_executive_reports`, `jlwm_coo_actions` (+ exact named indexes including DESC on `idx_jer_type` / `idx_jca_priority`). BLOCK on incompatible types/NULL/non-UUID `office_id`/NULL required identifiers/wrong PK/INDEX. No invented UNIQUEs. Does **not** own Reliability (036). Runtime satellite CREATE/INDEX removed; DML preserved. Preflight: `scripts/db/preflight-migration-035.sql`. Ops: preflight → block/manual or apply 035 → re-preflight → verify-schema → deploy API. |
| `036_jlwm_reliability_schema_authority.sql` | JLWM Reliability schema authority (Stage 4D). Owns the 5 tables from former `ensureReliabilitySchema()`: `jlwm_ai_audit`, `jlwm_trust_scores`, `jlwm_recommendation_tracking`, `jlwm_data_quality`, `jlwm_learning_events` (+ exact named indexes including DESC on `idx_jaa_type` / `idx_jts_office` / `idx_jdq_office` / `idx_jle_office`). BLOCK on incompatible types/NULL/non-UUID `office_id`/NULL required identifiers/wrong PK/INDEX. No invented UNIQUEs. Runtime Reliability CREATE/INDEX removed; DML preserved (+ narrow 034/035 column compatibility fixes in app). Preflight: `scripts/db/preflight-migration-036.sql`. Ops: preflight → block/manual or apply 036 → re-preflight → verify-schema → deploy API. |
| `037_financial_remaining_schema_authority.sql` | Remaining Financial Runtime schema authority (Stage 5B). Owns former Runtime DDL from `financialCore` / `invoices` / `financial-completions` / accounting soft-delete / cases financial indexes: `financial_accounts`, `ledger_entries` (+ DML-required `office_id`), `wallets`, `lawyer_payouts`, `invoice_payments` (+ payment indexes), `office_tax_settings`, `invoice_revisions`, `credit_notes`, `invoice_seq`; `client_invoices` extensions (`client_name`, `tax_enabled`, `amount_paid`, `view_token`, `zatca_uuid`, `qr_code_data`, `locked_at`, `linked_credit_note_id` — **not** `invoice_number`, owned by 003); `revenues.deleted_at` / `expenses.deleted_at`; `idx_invoices_case_office` / `idx_revenues_case_office` / `idx_expenses_case_office`. Runtime UNIQUEs: `(owner_id,currency)` / `wallets(owner_id)` / `office_tax_settings(office_id)`. Does **not** re-own ledger/Stripe/payments/ERP/billing/gateway (010–013/019/025/032) or baseline invoices/revenues/expenses (003). Platform wallet seed remains app DML. Preflight: `scripts/db/preflight-migration-037.sql`. Ops: preflight → BLOCK=stop → SAFE/ALREADY apply 037 → re-preflight → verify-schema → deploy API. |
| `038_marketplace_client_portal_schema_authority.sql` | Marketplace + Client Portal Runtime schema authority (Stage 6B). Owns former Runtime DDL from `marketplace` / `client-portal` / `client-auth` / `homeCms` / webhook+clients extension: `marketplace_services`, `marketplace_orders`, `marketplace_deals`, `marketplace_deal_offers`, `client_portal_tokens` (+ UNIQUE token), `portal_uploads`, `case_timeline`, `client_accounts` (+ UNIQUE email), `client_sessions` (+ UNIQUE token + FK CASCADE→`client_accounts`), `client_case_links` (+ UNIQUE(client_id,case_id) + FK CASCADE→`client_accounts`; auth shape), `home_cms` (global singleton), `clients.client_account_id` TEXT nullable (no backfill). Does **not** invent `office_id` on marketplace_*/portal tokens/home_cms. Does **not** re-own invitations/office_page/office_services/office_orders/office_reviews (003/004/006). Does **not** own `client_comm_settings` / `website_builder_pages` / `clients.deleted_at` / appointments. Orphan FK → `ORPHAN_FK` fail-closed (no silent delete/NOT VALID “ready”). Runtime CREATE/ALTER removed; homeCms singleton seed DML preserved. Preflight: `scripts/db/preflight-migration-038.sql`. Ops: preflight → BLOCK=stop → SAFE/ALREADY apply 038 → re-preflight → verify-schema → deploy API. |
| `039_ai_credits_usage_schema_authority.sql` | AI Credits + Usage Runtime schema authority (Stage 7B). Owns former Runtime DDL from `aiChat` / `aiCredits` / merged `ai_usage_logs` ALTERs: `office_ai_credits` (+ `UNIQUE(office_id)`, `balance DEFAULT 100`, daily/monthly limit-and-usage columns), `ai_credit_transactions` (append-only; no invented UNIQUE/FK), `ai_usage_logs` (+ exact `idx_ai_usage_office` / `idx_ai_usage_created` / partial `idx_ai_usage_case`). Does **not** CREATE `usage_logs` (003) or `ai_provider_config` / `office_ai_settings` (040) / agents. `office_id='default'` is a deliberate business key (informational in preflight; never remapped/blocked). BLOCK on incompatible types/NULL required/PK/UNIQUE/INDEX and duplicate `office_id`. Runtime CREATE/ALTER for 039 tables removed; seed DML (`ON CONFLICT (office_id)`) preserved. Preflight: `scripts/db/preflight-migration-039.sql`. Ops: preflight → BLOCK=stop → SAFE/ALREADY apply 039 → re-preflight → verify-schema → deploy API. |
| `040_ai_provider_engine_schema_authority.sql` | AI Provider Engine Runtime schema authority (Stage 7E). Owns former Runtime DDL from `aiProviderEngine.ensureTables`: `ai_provider_config` (+ `UNIQUE(provider)` for seed `ON CONFLICT (provider) DO NOTHING`), `office_ai_settings` (+ `UNIQUE(office_id)` for upsert `ON CONFLICT (office_id) DO UPDATE`). Does **not** CREATE credits/usage (039), agents, or invent FK. `office_id` remains TEXT business key (no UUID-only enforcement). BLOCK on incompatible types/NULL required/PK/UNIQUE and duplicate `provider` / `office_id`. Runtime CREATE removed; readiness + seed/upsert DML preserved. Preflight: `scripts/db/preflight-migration-040.sql`. Ops: preflight → BLOCK=stop → SAFE/ALREADY apply 040 → re-preflight → verify-schema → deploy API. |
| `041_ai_events_schema_authority.sql` | AI Events Runtime schema authority (Stage 7E). Owns former Runtime DDL from `aiEvents.ensureTables`: `ai_events` + exact `ai_events_office_status_idx` `(office_id, status, created_at DESC)`. Does **not** invent UNIQUE/FK (dedupe remains application `WHERE NOT EXISTS`). Does **not** CREATE agents / case insights / COO / support AI / orphans / 039–040 objects. `office_id` TEXT business key; `created_at` is `TIMESTAMP` (without time zone). BLOCK on incompatible types/NULL required/PK/INDEX (incl. stolen name + wrong DESC bits). Runtime CREATE/INDEX removed; readiness + insert/read/dismiss/scan DML preserved. Preflight: `scripts/db/preflight-migration-041.sql`. Ops: preflight → BLOCK=stop → SAFE/ALREADY apply 041 → re-preflight → verify-schema → deploy API. |

> **Deferred indexes (not in 010):** `idx_tasks_office_due` and
> `idx_tasks_status` are now owned by **015** with the formal `tasks` table.
> `idx_reminders_office_due` remains deferred to the future numbered migration
> that formally `CREATE`s `reminders`. Do not re-run 010 for it.


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
| `office_entitlements` | **025** | billing overview / entitlements / provisioning |
| `platform_billing_invoices` | **025** | billing platform invoices + stats |
| `promo_codes` | **026** | promo admin + redeem |
| `gift_subscriptions` | **026** | `GET /promo/my-gift`, redeem, office subscription gift check (scoped by `office_id` + `user_id`) |
| `event_daily_counts` | **027** | Analytics wildcard listener daily rollups; JLWM enterprise report counts (scoped by `office_id`) |
| `case_autopilot_reports` | **028** | Autopilot health snapshots (`runCaseAutopilot` upsert; GET health scoped by `case_id` + `office_id`) |
| `stripe_events` | **011** | `stripeEventBuffer.ts` webhook buffer |
| `stripe_dead_letters` | **011** | Stripe DLQ |
| `stripe_reconciliation_log` | **011** | `stripeReconcile.ts` |
| `payment_transactions` | **012** | `payments.ts` / financial engine |
| `office_erp_ledger` | **013** | `erp-ledger.ts` double-entry |
| `financial_anomalies` | **013** | ERP reconcile / financial-guard |
| `chart_of_accounts` | **013** | `journalAccounting.ts` (seed retained) |
| `journal_entries` / `journal_items` | **013** | double-entry journal |
| `bankruptcy_cases` / `bk_*` Bankruptcy tables | **014** | Bankruptcy case, workflow, opening request, demo, and EOC modules |
| `tasks` | **015** | Office/legal tasks (`/office-tasks`, case tasks, JLWM) |
| `office_branches` + `branch_id` FKs | **015** | `branches.ts` |
| `office_messages.search_vector` | **016** | `internal-messages.ts` FTS search |
| `cases.case_number` / court_* / `deleted_at` / `version` | **017** | legal-core cases + Demo seed |
| `clients` | 003 | Legal core |

## ما يبقى بعد Migrations (boot-time)

~100 جدول enterprise تُنشأ عند أول boot للـ API عبر `ensure*Tables()` في
`artifacts/api-server/src/index.ts` والوحدات. هذه migrations تغطي **P0 + baseline**
فقط. بعد تطبيق 003–017، شغّل API مرة واحدة لإكمال الجداول المتبقية (enterprise).
بعد تطبيق **016** لم يعد FTS الخاص بـ `office_messages.search_vector` يُنشأ عبر Runtime DDL.
بعد تطبيق **017** لم تعد أعمدة `cases.case_number` / court / soft-delete تُنشأ عبر Runtime DDL.
بعد تطبيق **027** لم يعد `event_daily_counts` يُنشأ عبر Runtime DDL في `analyticsListener.ts`.
بعد تطبيق **028** لم يعد `case_autopilot_reports` يُنشأ عبر Runtime DDL (`ensureAutopilotTable` في `caseAutopilot.ts`).

جداول مغطاة بـ 004/005/010/011/012/013/014/015/016/017 لم تعد تُنشأ عبر Runtime DDL:
`contract_*`, `trial_offices`, `onboarding_state`, `system_events`, `plan_cms`, `office_ledger`,
`stripe_events`, `stripe_dead_letters`, `stripe_reconciliation_log`, `payment_transactions`,
`office_erp_ledger`, `financial_anomalies`, `chart_of_accounts`, `journal_entries`, `journal_items`,
`bankruptcy_cases`, `bk_creditors`, `bk_claims`, `bk_claim_documents`, `bk_assets`,
`bk_asset_valuations`, `bk_meetings`, `bk_distributions`, `bk_distribution_items`, `bk_reports`,
`bk_ai_analysis`, `bk_timeline`, `bk_audit_logs`, `bk_notifications`, `bk_workflows`,
`bk_workflow_steps`, `bk_workflow_events`, `bk_tasks`, `bk_task_comments`, `bk_task_assignments`,
`bk_templates`, `bk_alerts`, `bk_opening_requests`, `bk_opening_request_documents`,
`bk_emergency_locks`, `tasks`, `office_branches`, `office_messages.search_vector`,
`cases.case_number` / court_* / `deleted_at` / `version`
(+ performance indexes من `ensurePerformanceIndexes`).
`moyasar_settings` / `checkout_settings` owned by migration **032** (Runtime `ensureGatewaySettingsTables` removed).

Document V2 (`document_versions` / `document_permissions` / `storage_migration_log` / `document_retention_policies` + `documents` extension columns including `file_size`) owned by migration **033** (Runtime V2 DDL removed from `ensureDocumentCenterSchema`). Compliance `retention_policies` remains Runtime in `complianceCenter.ts` and is intentionally separate.

JLWM Core (14 tables from former `ensureJLWMSchema`) owned by migration **034**. P0-gated minimum: `jlwm_config`, `jlwm_memory_nodes`, `jlwm_memory_edges`, `jlwm_case_twins`, `jlwm_client_twins`, `jlwm_firm_twin` (additional core tables are owned by 034 but not all are P0-gated to keep the deploy gate focused on rebuild/twin critical path).

JLWM Satellites (6 tables from former Runtime satellite ensure*) owned by migration **035** and P0-gated: `jlwm_future_paths`, `jlwm_simulations`, `jlwm_litigation_intel`, `jlwm_accuracy_records`, `jlwm_executive_reports`, `jlwm_coo_actions`. Reliability (5 tables from former `ensureReliabilitySchema`) owned by migration **036** and P0-gated: `jlwm_ai_audit`, `jlwm_trust_scores`, `jlwm_recommendation_tracking`, `jlwm_data_quality`, `jlwm_learning_events`.

Remaining Financial Runtime (Stage 5B / **037**) P0-gated for production-critical financial routes (`/fincore/*`, invoice payments, tax settings, credit notes/revisions, accounting soft-delete, invoice public-view extensions): `financial_accounts`, `ledger_entries`, `wallets`, `lawyer_payouts`, `invoice_payments`, `office_tax_settings`, `invoice_revisions`, `credit_notes`, plus extension columns on `client_invoices` / `revenues.deleted_at` / `expenses.deleted_at` / `ledger_entries.office_id`. Baseline `client_invoices` / `revenues` / `expenses` tables remain Migration **003** authority.
`ensureJournalTables` retains CoA seed only (no DDL).

Marketplace + Client Portal Runtime (Stage 6B / **038**) P0-gated for critical portal/auth/marketplace routes: `client_accounts`, `client_sessions`, `client_case_links`, `client_portal_tokens`, `case_timeline`, `portal_uploads`, `marketplace_services`, `marketplace_orders`, plus `clients.client_account_id`. `home_cms` is formally owned by 038 but not P0-gated (global CMS singleton; not required for API boot/routing). Storefront tables (`invitations` / `office_page` / `office_services` / `office_orders` / `office_reviews`) remain **003/004/006** authority.

AI Credits + Usage Runtime (Stage 7B / **039**) P0-gated for AI chat/credits/usage routes: `office_ai_credits`, `ai_credit_transactions`, `ai_usage_logs` (essential columns include `balance` / `daily_limit` / `cost_sar`). Baseline `usage_logs` remains Migration **003** authority (039 does not alias or re-CREATE it).

AI Provider Engine Runtime (Stage 7E / **040**) P0-gated for provider/settings routes: `ai_provider_config`, `office_ai_settings` (essential columns include `provider` / `enabled` / `priority` / `office_id` / `preferred_provider` / `mode`). Runtime CREATE removed from `aiProviderEngine`; readiness + seed/upsert DML preserved.

AI Events Runtime (Stage 7E / **041**) P0-gated for autonomous event routes: `ai_events` (essential columns include `office_id` / `status` / `created_at` / `type`). Exact index `ai_events_office_status_idx` `(office_id, status, created_at DESC)`. Runtime CREATE/INDEX removed from `aiEvents`; readiness + insert/dismiss/scan DML preserved.

## Rollback

راجع `scripts/db/backup-restore.sh restore` — الاستعادة من pg_dump هي الطريقة الآمنة.
`DROP TABLE` يدوي غير موصى به على Production.

## اختبارات Integration (قبل PR)

```bash
# PostgreSQL محلي فقط — لا يلمس Production
bash scripts/db/test-migrations.integration.sh
pnpm --filter @workspace/api-server run test:schema-authority
```

يغطي: DB فارغة (003→001→004→005→006→007→008→009→010→011→012→013→014→015→016)، Production-like بدون `website_config`/`login_logs`،
idempotency لـ 006/007/008/009/010/011/012/013/014/015/016، محاذاة schema، backup/restore، والمسارات المبلّغ عنها.

راجع `scripts/db/boot-created-tables.md` لقائمة جداول boot وقيود Docker.
