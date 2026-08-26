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
- ~~Runtime `CREATE` for `ai_agents` / `agent_actions` + cron `CREATE`/`INDEX` for `agent_job_logs`~~ — removed via migration **042**; `agentRuntime` keeps readiness + seed DML (`ON CONFLICT (id)`); `agentCron` keeps readiness + job-log DML
- ~~Runtime `CREATE`/`INDEX` for `case_ai_insights` / `idx_case_ai_insights_case`~~ — removed via migration **043**; `case.ai` keeps readiness (`to_regclass`) + analysis/insight/task DML
- ~~Runtime `CREATE` for `ai_coo_notif_settings`~~ — removed via migration **044**; `aiCoo` keeps readiness (`to_regclass`) + GET/PATCH/notify DML
- ~~Runtime `CREATE` for `support_ai_analysis` / `support_knowledge_base`~~ — removed via migration **045**; `support-ai` keeps readiness (`to_regclass`) + analysis/KB DML (KB seed duplicate follow-up)
- ~~Runtime `CREATE`/`ALTER`/`INDEX` from `ensureEnterpriseSchema`~~ — removed via migration **046**; `support-enterprise` keeps readiness (`to_regclass`) + ticket/audit/visitor DML
- ~~Runtime `CREATE` from `calendar.ensureTables`~~ — removed via migration **047**; `calendar` keeps readiness (`to_regclass`) + event/reminder DML
- ~~Runtime `CREATE` from `hrInternal.ensureTables`~~ — removed via migration **048**; `hrInternal` keeps readiness (`to_regclass`) + announcements/requests/leave-balance DML
- ~~Runtime `CREATE` from `hrPerformance.ensureTables`~~ — removed via migration **049**; `hrPerformance` keeps readiness (`to_regclass`) + hr_settings seed (`ON CONFLICT (key)`) + evaluation/incentive DML
- ~~Runtime `CREATE`/`INDEX` from `ensureHREnterpriseTables`~~ — removed via migration **050**; `hr-enterprise` keeps readiness (`to_regclass`) + role seed/ON CONFLICT + membership/workflow/audit DML
- ~~Runtime `CREATE` for `office_notification_settings`~~ — removed via migration **051**; `notifications` keeps readiness (`to_regclass`) + GET/PATCH upsert (`ON CONFLICT (office_id, event_type)`) + listener reads
- ~~Runtime `CREATE INDEX` IIFE (`idx_msgs_*` / `idx_rcpt_*` / `idx_attach_msg`)~~ — removed via migration **052**; `internal-messages` keeps readiness (`to_regclass`) + folder/tenant DML
- ~~Runtime `CREATE`/`INDEX` IIFEs from `soc.ts` / `auditCenter.ts` / `complianceCenter.ts` / `drCenter.ts` / `mfaCenter.ts`~~ — removed via migration **053**; modules keep readiness (`to_regclass`) + SA DML, ON CONFLICT, and compliance/retention seeds
- ~~Runtime `CREATE`/`INDEX` IIFEs from `control-tower.ts` / `launchGate.ts` / `governanceKernel.ts` / `certification.ts` / `admin.ts` / `engineering.ts` / `production-os.ts` / `productionLaunch.ts` / `saas-os.ts`~~ — removed via migration **054**; modules keep readiness (`to_regclass`) + DML/SA preserved
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
| `documents` V2 extension cols + `document_versions` / `document_permissions` / `storage_migration_log` / `document_retention_policies` | **033** (preflight → apply → re-preflight ALREADY_CORRECT → verify-schema → deploy; compliance `retention_policies` owned by **053**, not 033) |
| `client_accounts` / `client_sessions` / `client_case_links` / `client_portal_tokens` / `case_timeline` / `portal_uploads` / `marketplace_services` / `marketplace_orders` (+ `clients.client_account_id`) | **038** (preflight → apply → re-preflight ALREADY_CORRECT → verify-schema → deploy; `home_cms` owned by 038 but not P0; storefront 003/004/006 untouched) |
| `office_ai_credits` / `ai_credit_transactions` / `ai_usage_logs` | **039** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; seed DML preserved; `usage_logs` remains **003**) |
| `ai_provider_config` / `office_ai_settings` | **040** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE removed; seed/upsert DML preserved) |
| `ai_events` (+ `ai_events_office_status_idx`) | **041** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE/INDEX removed; insert/dismiss/scan DML preserved) |
| `ai_agents` / `agent_actions` / `agent_job_logs` (+ `idx_agent_job_logs_created` DESC / `idx_agent_job_logs_type`) | **042** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE/INDEX removed; seed + job-log DML preserved; no invented FK/UNIQUE) |
| `case_ai_insights` (+ `idx_case_ai_insights_case`) | **043** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE/INDEX removed; analysis/insight DML preserved; TEXT office_id/case_id; no invented FK/UNIQUE) |
| `ai_coo_notif_settings` (+ `UNIQUE(office_id)`) | **044** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE removed; GET/PATCH/notify DML + ON CONFLICT preserved; TEXT office_id; no invented FK) |
| `support_ai_analysis` (+ `UNIQUE(ticket_id)`) / `support_knowledge_base` (PK only) | **045** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE removed; analysis ON CONFLICT + KB DML preserved; no invented KB UNIQUE/FK; `ai_score` deferred to Enterprise) |
| `support_tickets` extensions (+ `ai_score`) / `support_ticket_attachments` (+ FK CASCADE) / `support_ticket_audit` / `support_visitor_profiles` (+ `UNIQUE(email)`) + 7 indexes | **046** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE/ALTER/INDEX removed; DML preserved; no office_id backfill; orphans/wrong UNIQUE/INDEX fail-closed) |
| `events` / `event_reminders` (+ FK CASCADE) + `idx_events_case_id` / `idx_events_office_start` | **047** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE removed; calendar/cases/AI DML preserved; 020 index shapes; no invented UNIQUE/case_id FK) |
| `hr_announcements` / `employee_requests` / `leave_balances` (+ exact `UNIQUE(employee_id, leave_type, year)`) | **048** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE removed; HR Internal DML + tenant predicates preserved; no invented FK/index/extra UNIQUE) |
| `performance_evaluations` / `employee_incentives` (+ `office_id`) / `hr_settings` (+ exact `UNIQUE(key)`) | **049** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE removed; office_id from live DML; hr_settings seed ON CONFLICT preserved; no invented FK/index) |
| `hr_roles` / `hr_memberships` / `hr_workflows` / `hr_audit_logs` (+ UNIQUEs + `idx_hrwf_office` / `idx_hral_office`) | **050** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE/INDEX removed; ON CONFLICT + tenant DML preserved; no invented FK) |
| `office_notification_settings` (+ exact `UNIQUE(office_id, event_type)`) | **051** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE removed; GET/PATCH/listener DML + ON CONFLICT preserved; TIMESTAMP updated_at; no invented FK) |
| Messaging Runtime indexes (`idx_msgs_*` / `idx_rcpt_*` / `idx_attach_msg`) | **052** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → deploy; Runtime CREATE INDEX IIFE removed; re-asserts 020 shapes + `idx_msgs_office_folder`; skip when recipients/attachments tables absent; no DROP INDEX) |
| Security Centers (`security_sessions` / `security_alerts` / `blocked_ips` / `mfa_status_cache` / `audit_coverage_rules` / `audit_risk_scores` / `compliance_controls` / `data_requests` / `retention_policies` / `legal_holds` / `dr_*` / `high_risk_op_log` / `recovery_codes` + UNIQUEs + `idx_audit_logs_*` + FK CASCADE) | **053** (preflight → BLOCK=stop → SAFE/ALREADY apply → re-preflight → verify-schema → deploy; Runtime CREATE/INDEX removed; seeds + ON CONFLICT + SA DML preserved; no DROP) |

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
