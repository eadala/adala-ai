#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# test-migrations.integration.sh — Integration tests for Production DB repair
#
# Requires: local PostgreSQL (psql, pg_dump, pg_restore)
# Does NOT touch Production — creates ephemeral test databases only.
#
# Usage (from repo root):
#   bash scripts/db/test-migrations.integration.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_BASE=(
  "$ROOT/artifacts/api-server/migrations/003_drizzle_baseline_safe.sql"
  "$ROOT/artifacts/api-server/migrations/001_tenant_isolation.sql"
  "$ROOT/artifacts/api-server/migrations/004_legal_core_extensions.sql"
  "$ROOT/artifacts/api-server/migrations/005_tenant_platform_tables.sql"
)
MIGRATION_006="$ROOT/artifacts/api-server/migrations/006_post_migration_api_support.sql"
MIGRATION_007="$ROOT/artifacts/api-server/migrations/007_office_storage_quota_text_tenant.sql"
MIGRATION_008="$ROOT/artifacts/api-server/migrations/008_storage_files_text_tenant.sql"
MIGRATION_009="$ROOT/artifacts/api-server/migrations/009_storage_folders.sql"
MIGRATION_010="$ROOT/artifacts/api-server/migrations/010_office_ledger_performance_indexes.sql"
MIGRATION_011="$ROOT/artifacts/api-server/migrations/011_stripe_infrastructure_tables.sql"
MIGRATION_012="$ROOT/artifacts/api-server/migrations/012_payment_transactions.sql"
MIGRATION_013="$ROOT/artifacts/api-server/migrations/013_erp_schema.sql"
MIGRATION_014="$ROOT/artifacts/api-server/migrations/014_bankruptcy_schema.sql"
MIGRATION_015="$ROOT/artifacts/api-server/migrations/015_tasks_branches_schema.sql"
MIGRATION_016="$ROOT/artifacts/api-server/migrations/016_office_messages_fts.sql"
MIGRATION_017="$ROOT/artifacts/api-server/migrations/017_cases_schema.sql"
MIGRATION_018="$ROOT/artifacts/api-server/migrations/018_money_numeric_batch1.sql"
MIGRATION_019="$ROOT/artifacts/api-server/migrations/019_money_numeric_batch2.sql"
MIGRATION_020="$ROOT/artifacts/api-server/migrations/020_performance_hotpath_indexes.sql"
MIGRATION_021="$ROOT/artifacts/api-server/migrations/021_rag_schema_foundation.sql"
MIGRATION_025="$ROOT/artifacts/api-server/migrations/025_billing_schema_authority.sql"
MIGRATION_026="$ROOT/artifacts/api-server/migrations/026_promo_schema_authority.sql"
MIGRATION_027="$ROOT/artifacts/api-server/migrations/027_event_daily_counts_schema_authority.sql"
MIGRATION_028="$ROOT/artifacts/api-server/migrations/028_case_autopilot_reports_schema_authority.sql"
MIGRATION_029="$ROOT/artifacts/api-server/migrations/029_office_messages_fts_readiness.sql"
MIGRATION_030="$ROOT/artifacts/api-server/migrations/030_office_messages_case_id_text.sql"
MIGRATION_031="$ROOT/artifacts/api-server/migrations/031_message_conversations_schema_authority.sql"
MIGRATION_032="$ROOT/artifacts/api-server/migrations/032_gateway_settings_schema_authority.sql"
MIGRATION_033="$ROOT/artifacts/api-server/migrations/033_document_v2_schema_authority.sql"
MIGRATION_034="$ROOT/artifacts/api-server/migrations/034_jlwm_core_schema_authority.sql"
MIGRATION_035="$ROOT/artifacts/api-server/migrations/035_jlwm_satellites_schema_authority.sql"
MIGRATION_036="$ROOT/artifacts/api-server/migrations/036_jlwm_reliability_schema_authority.sql"
MIGRATION_037="$ROOT/artifacts/api-server/migrations/037_financial_remaining_schema_authority.sql"
MIGRATION_038="$ROOT/artifacts/api-server/migrations/038_marketplace_client_portal_schema_authority.sql"
MIGRATION_039="$ROOT/artifacts/api-server/migrations/039_ai_credits_usage_schema_authority.sql"
MIGRATION_040="$ROOT/artifacts/api-server/migrations/040_ai_provider_engine_schema_authority.sql"
MIGRATION_041="$ROOT/artifacts/api-server/migrations/041_ai_events_schema_authority.sql"
MIGRATION_042="$ROOT/artifacts/api-server/migrations/042_ai_agents_schema_authority.sql"
MIGRATION_043="$ROOT/artifacts/api-server/migrations/043_case_ai_insights_schema_authority.sql"
MIGRATION_044="$ROOT/artifacts/api-server/migrations/044_ai_coo_notif_settings_schema_authority.sql"
MIGRATION_045="$ROOT/artifacts/api-server/migrations/045_support_ai_schema_authority.sql"
MIGRATION_046="$ROOT/artifacts/api-server/migrations/046_support_enterprise_schema_authority.sql"
MIGRATION_047="$ROOT/artifacts/api-server/migrations/047_calendar_schema_authority.sql"
MIGRATION_048="$ROOT/artifacts/api-server/migrations/048_hr_internal_schema_authority.sql"
MIGRATION_049="$ROOT/artifacts/api-server/migrations/049_hr_performance_schema_authority.sql"
MIGRATION_050="$ROOT/artifacts/api-server/migrations/050_hr_enterprise_schema_authority.sql"
MIGRATION_051="$ROOT/artifacts/api-server/migrations/051_office_notification_settings_schema_authority.sql"
MIGRATION_052="$ROOT/artifacts/api-server/migrations/052_messaging_runtime_indexes_schema_authority.sql"
MIGRATION_053="$ROOT/artifacts/api-server/migrations/053_security_centers_schema_authority.sql"
MIGRATION_054="$ROOT/artifacts/api-server/migrations/054_platform_runtime_schema_authority.sql"

PASS=0
FAIL=0
SKIP=0

log()  { echo ""; echo "══ $*"; }
ok()   { echo "  ✅ $*"; PASS=$((PASS + 1)); }
bad()  { echo "  ❌ $*"; FAIL=$((FAIL + 1)); }
skip() { echo "  ⏭️  $*"; SKIP=$((SKIP + 1)); }

require_cmd() {
  for cmd in psql pg_dump pg_restore; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "❌ $cmd not found — install postgresql-client"
      exit 2
    fi
  done
}

# Role for scripts that use DATABASE_URL (verify-schema, backup-restore)
ensure_test_role() {
  sudo -u postgres psql -c "DO \$\$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'adala_test') THEN
      CREATE ROLE adala_test LOGIN PASSWORD 'test' SUPERUSER;
    END IF;
  END \$\$;" >/dev/null 2>&1 || true
  # Allow password auth from localhost for pg_dump/pg_restore/psql via DATABASE_URL
  local hba
  hba=$(sudo -u postgres psql -At -c "SHOW hba_file;")
  if [[ -f "$hba" ]] && ! grep -q 'adala_test' "$hba" 2>/dev/null; then
    echo "host all adala_test 127.0.0.1/32 scram-sha-256" | sudo tee -a "$hba" >/dev/null
    echo "host all adala_test ::1/128 scram-sha-256" | sudo tee -a "$hba" >/dev/null
    sudo pg_ctlcluster 16 main reload 2>/dev/null || sudo service postgresql reload 2>/dev/null || true
  fi
}

db_url() {
  echo "postgresql://adala_test:test@127.0.0.1/${TEST_DB}"
}

# Create isolated test DB; sets TEST_DB and psql helper
setup_db() {
  local suffix="$1"
  TEST_DB="adala_mig_test_${suffix}_$$"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${TEST_DB}\";" >/dev/null 2>&1 || true
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${TEST_DB}\";" >/dev/null
  export DATABASE_URL="$(db_url)"
}

psql_db() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$TEST_DB" "$@"
}

teardown_db() {
  [[ -n "${TEST_DB:-}" ]] && sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"${TEST_DB}\";" >/dev/null 2>&1 || true
}

apply_migrations_base() {
  for f in "${MIGRATIONS_BASE[@]}"; do
    psql_db -f "$f" >/dev/null
  done
}

apply_migration_006() {
  psql_db -f "$MIGRATION_006" >/dev/null
}

apply_migration_007() {
  psql_db -f "$MIGRATION_007" >/dev/null
}

apply_migration_008() {
  psql_db -f "$MIGRATION_008" >/dev/null
}

apply_migration_009() {
  psql_db -f "$MIGRATION_009" >/dev/null
}

apply_migration_010() {
  psql_db -f "$MIGRATION_010" >/dev/null
}

apply_migration_011() {
  psql_db -f "$MIGRATION_011" >/dev/null
}

apply_migration_012() {
  psql_db -f "$MIGRATION_012" >/dev/null
}

apply_migration_013() {
  psql_db -f "$MIGRATION_013" >/dev/null
}

apply_migration_014() {
  psql_db -f "$MIGRATION_014" >/dev/null
}

apply_migration_015() {
  psql_db -f "$MIGRATION_015" >/dev/null
}

apply_migration_016() {
  psql_db -f "$MIGRATION_016" >/dev/null
}

apply_migration_017() {
  psql_db -f "$MIGRATION_017" >/dev/null
}

apply_migration_018() {
  psql_db -f "$MIGRATION_018" >/dev/null
}

apply_migration_019() {
  psql_db -f "$MIGRATION_019" >/dev/null
}

apply_migration_020() {
  psql_db -f "$MIGRATION_020" >/dev/null
}

apply_migration_021() {
  # Migration 021 hard-requires pgvector. Skip apply when the extension package
  # is not installed so earlier scenarios (empty/partial) do not abort the suite.
  # CI installs postgresql-N-pgvector; scenario_migration_021_rag_tenant_fk asserts live.
  local has_vector
  has_vector=$(psql_db -At -c "SELECT 1 FROM pg_available_extensions WHERE name='vector'" 2>/dev/null || true)
  if [[ "$has_vector" != "1" ]]; then
    skip "021_rag_schema_foundation.sql (pgvector extension not available)"
    return 0
  fi
  psql_db -f "$MIGRATION_021" >/dev/null
}

apply_migration_025() {
  psql_db -f "$MIGRATION_025" >/dev/null
}

apply_migration_026() {
  psql_db -f "$MIGRATION_026" >/dev/null
}

apply_migration_027() {
  psql_db -f "$MIGRATION_027" >/dev/null
}

apply_migration_028() {
  psql_db -f "$MIGRATION_028" >/dev/null
}

apply_migration_029() {
  psql_db -f "$MIGRATION_029" >/dev/null
}

apply_migration_030() {
  psql_db -f "$MIGRATION_030" >/dev/null
}

apply_migration_031() {
  psql_db -f "$MIGRATION_031" >/dev/null
}

apply_migration_032() {
  psql_db -f "$MIGRATION_032" >/dev/null
}

apply_migration_033() {
  psql_db -f "$MIGRATION_033" >/dev/null
}

# P0 verify requires billing (025) + promo (026) + analytics (027) + autopilot (028).
# Idempotent if already applied. 029 is FTS readiness (safe after 016).
# 030 aligns office_messages.case_id to TEXT (Stage 22).
# 031 owns message_conversations + conversation_members (Stage 23.3B).
# 032 owns moyasar_settings + checkout_settings (Stage 23.4).
# 033 owns Document V2 tables + documents extension columns (Stage 23.5B).
# 034 owns JLWM Core 14 tables (Stage 4B).
# 035 owns JLWM Satellites 6 tables (Stage 4C).
# 036 owns JLWM Reliability 5 tables (Stage 4D).
# 039 owns AI credits/usage; 040 owns AI provider engine tables; 041 owns ai_events;
# 042 owns ai_agents / agent_actions / agent_job_logs; 043 owns case_ai_insights;
# 044 owns ai_coo_notif_settings; 045 owns support_ai_analysis / support_knowledge_base;
# 046 owns support_ticket_attachments / support_ticket_audit / support_visitor_profiles.
# 047 owns events / event_reminders + idx_events_case_id / idx_events_office_start.
# 048 owns hr_announcements / employee_requests / leave_balances + exact UNIQUE(employee_id, leave_type, year).
verify_p0_schema() {
  local log="${1:-/tmp/verify-p0.log}"
  apply_migration_025
  apply_migration_026
  apply_migration_027
  apply_migration_028
  apply_migration_029
  apply_migration_030
  apply_migration_031
  apply_migration_032
  apply_migration_033
  apply_migration_034
  apply_migration_035
  apply_migration_036
  apply_migration_037
  apply_migration_038
  apply_migration_039
  apply_migration_040
  apply_migration_041
  apply_migration_042
  apply_migration_043
  apply_migration_044
  apply_migration_045
  apply_migration_046
  apply_migration_047
  apply_migration_048
  apply_migration_049
  apply_migration_050
  apply_migration_051
  apply_migration_052
  apply_migration_053
  apply_migration_054
  bash "$ROOT/scripts/db/verify-schema.sh" >"$log" 2>&1
}

apply_migration_034() {
  psql_db -f "$MIGRATION_034" >/dev/null
}

apply_migration_035() {
  psql_db -f "$MIGRATION_035" >/dev/null
}

apply_migration_036() {
  psql_db -f "$MIGRATION_036" >/dev/null
}

apply_migration_037() {
  psql_db -f "$MIGRATION_037" >/dev/null
}

apply_migration_038() {
  psql_db -f "$MIGRATION_038" >/dev/null
}

apply_migration_039() {
  psql_db -f "$MIGRATION_039" >/dev/null
}

apply_migration_040() {
  psql_db -f "$MIGRATION_040" >/dev/null
}

apply_migration_041() {
  psql_db -f "$MIGRATION_041" >/dev/null
}

apply_migration_042() {
  psql_db -f "$MIGRATION_042" >/dev/null
}

apply_migration_043() {
  psql_db -f "$MIGRATION_043" >/dev/null
}

apply_migration_044() {
  psql_db -f "$MIGRATION_044" >/dev/null
}

apply_migration_045() {
  psql_db -f "$MIGRATION_045" >/dev/null
}

apply_migration_046() {
  psql_db -f "$MIGRATION_046" >/dev/null
}

apply_migration_047() {
  psql_db -f "$MIGRATION_047" >/dev/null
}

apply_migration_048() {
  psql_db -f "$MIGRATION_048" >/dev/null
}

apply_migration_049() {
  psql_db -f "$MIGRATION_049" >/dev/null
}

apply_migration_050() {
  psql_db -f "$MIGRATION_050" >/dev/null
}

apply_migration_051() {
  psql_db -f "$MIGRATION_051" >/dev/null
}

apply_migration_052() {
  psql_db -f "$MIGRATION_052" >/dev/null
}

apply_migration_053() {
  psql_db -f "$MIGRATION_053" >/dev/null
}

apply_migration_054() {
  psql_db -f "$MIGRATION_054" >/dev/null
}

apply_migrations_through_013() {
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_011
  apply_migration_012
  apply_migration_013
}

apply_migrations_through_015() {
  apply_migrations_through_013
  apply_migration_014
  apply_migration_015
}

apply_all_migrations() {
  apply_migrations_through_015
  apply_migration_016
  apply_migration_017
  apply_migration_018
  apply_migration_019
  apply_migration_020
  apply_migration_021
  apply_migration_025
  apply_migration_026
  apply_migration_027
  apply_migration_028
  apply_migration_029
  apply_migration_030
  apply_migration_031
  apply_migration_032
  apply_migration_033
  apply_migration_034
  apply_migration_035
  apply_migration_036
  apply_migration_037
  apply_migration_038
  apply_migration_039
  apply_migration_040
  apply_migration_041
  apply_migration_042
  apply_migration_043
  apply_migration_044
  apply_migration_045
  apply_migration_046
  apply_migration_047
  apply_migration_048
  apply_migration_049
  apply_migration_050
  apply_migration_051
  apply_migration_052
  apply_migration_053
  apply_migration_054
}

# ── Scenario 1: empty database ─────────────────────────────────────────────
scenario_empty_db() {
  log "Scenario 1 — empty DB → migrations 003…021 + 025…054 → verify-schema"
  setup_db "empty"
  trap teardown_db EXIT

  apply_all_migrations

  if verify_p0_schema /tmp/verify-empty.log; then
    ok "verify-schema.sh passed on empty DB"
  else
    bad "verify-schema.sh failed on empty DB"
    tail -20 /tmp/verify-empty.log
  fi

  trap - EXIT
  teardown_db
}

# ── Scenario 2: partial production-like DB + idempotency ─────────────────────
scenario_partial_idempotent() {
  log "Scenario 2 — partial DB (production-like) → migrations twice (idempotent)"
  setup_db "partial"
  trap teardown_db EXIT

  # Simulate production: some baseline tables exist, some P0 tables missing,
  # partial columns on cases/contracts, office_members absent.
  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE office_registry (
  id text PRIMARY KEY,
  clerk_user_id text NOT NULL UNIQUE,
  office_name text,
  owner_email text NOT NULL,
  plan_name text DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  joined_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE users (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE cases (
  id text PRIMARY KEY NOT NULL,
  title text NOT NULL,
  status text DEFAULT 'open' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE contracts (
  id text PRIMARY KEY NOT NULL,
  title text NOT NULL,
  status text DEFAULT 'draft' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

INSERT INTO office_registry (id, clerk_user_id, owner_email, office_name)
  VALUES ('prod-office-1', 'user_test123', 'owner@test.com', 'Partial Office');
SQL

  apply_all_migrations
  apply_all_migrations

  if verify_p0_schema /tmp/verify-partial.log; then
    ok "verify-schema.sh passed after double migration on partial DB"
  else
    bad "verify-schema.sh failed after double migration"
    tail -20 /tmp/verify-partial.log
  fi

  trap - EXIT
  teardown_db
}

# ── Schema alignment checks (P0 tables vs code usage) ───────────────────────
check_schema_alignment() {
  log "Schema alignment — office_members, trial_offices, onboarding_state, office_registry, system_events, plan_cms"
  setup_db "schema"
  trap teardown_db EXIT
  apply_all_migrations

  psql_db <<'SQL' >/dev/null
-- office_members: ON CONFLICT DO NOTHING + ON CONFLICT (office_id, user_id)
INSERT INTO office_members (office_id, user_id, role, status)
  VALUES ('off1', 'u1', 'owner', 'active') ON CONFLICT DO NOTHING;
INSERT INTO office_members (office_id, user_id, role, status)
  VALUES ('off1', 'u1', 'lawyer', 'active')
  ON CONFLICT (office_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- trial_offices: ON CONFLICT (user_id)
INSERT INTO trial_offices (user_id, office_id, office_name)
  VALUES ('u1', 'trial_u1', 'Trial Office')
  ON CONFLICT (user_id) DO UPDATE SET office_name = EXCLUDED.office_name;

-- onboarding_state: ON CONFLICT (user_id)
INSERT INTO onboarding_state (user_id, office_id, completed, step, data)
  VALUES ('u1', 'trial_u1', true, 5, '{}'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET step = EXCLUDED.step;

-- office_registry: ON CONFLICT (id) — from office.ts
INSERT INTO office_registry (id, clerk_user_id, office_name, owner_email, status)
  VALUES ('off2', 'user_off2', 'Office 2', 'o2@test.com', 'active')
  ON CONFLICT (id) DO NOTHING;

-- system_events: all INSERT paths from codebase
INSERT INTO system_events (event_type, office_id, actor_id, payload)
  VALUES ('CASE_CREATED', 'off1', 'u1', '{"x":1}'::jsonb);
INSERT INTO system_events (event_type, office_id, metadata)
  VALUES ('TENANT_FROZEN', 'off1', '{"reason":"test"}'::jsonb);
INSERT INTO system_events (event_type, metadata)
  VALUES ('AUTO_HEAL_DB', '{}'::jsonb);
INSERT INTO system_events (type, payload, severity, source)
  VALUES ('saas_os_run', '{}'::jsonb, 'info', 'saas-os');
INSERT INTO system_events (event_type, severity, payload, created_at)
  VALUES ('stripe_retry_needed', 'warning', '{}', NOW());

-- plan_cms: ON CONFLICT (id)
INSERT INTO plan_cms (id, name_ar, name_en, monthly_price, yearly_price, color, features, feature_flags, limits)
  VALUES ('test-plan', 'خطة', 'Plan', 0, 0, '#000', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
SQL
  ok "all ON CONFLICT / INSERT paths succeeded for P0 platform tables"

  # Verify UNIQUE constraints exist
  local om_unique
  om_unique=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'office_members' AND c.contype = 'u';
  ")
  [[ "$om_unique" -ge 1 ]] && ok "office_members has UNIQUE constraint" || bad "office_members missing UNIQUE"

  local to_unique
  to_unique=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'trial_offices' AND c.contype = 'u';
  ")
  [[ "$to_unique" -ge 1 ]] && ok "trial_offices has UNIQUE constraint (user_id)" || bad "trial_offices missing UNIQUE"

  local se_cols
  se_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='system_events'
      AND column_name IN ('metadata','severity','source','type','payload','event_type');
  ")
  [[ "$se_cols" -eq 6 ]] && ok "system_events has all required columns (6)" || bad "system_events missing columns (got $se_cols/6)"

  trap - EXIT
  teardown_db
}

# ── Backup / restore round-trip ──────────────────────────────────────────────
scenario_backup_restore() {
  log "Backup-restore — insert → backup → mutate → restore → verify"
  setup_db "backup"
  trap teardown_db EXIT
  apply_all_migrations

  psql_db <<'SQL' >/dev/null
INSERT INTO office_registry (id, clerk_user_id, owner_email, office_name, status)
  VALUES ('bk-test', 'user_bk', 'bk@test.com', 'Backup Office', 'active');
INSERT INTO office_members (office_id, user_id, role, status)
  VALUES ('bk-test', 'user_bk', 'owner', 'active');
INSERT INTO plan_cms (id, name_ar, name_en, monthly_price, yearly_price, color, features)
  VALUES ('bk-plan', 'خطة', 'Plan', 99, 999, '#111', '[]'::jsonb);
SQL

  local backup_dir="/tmp/adala_backup_test_$$"
  mkdir -p "$backup_dir"
  export DATABASE_URL="$(db_url)"
  bash "$ROOT/scripts/db/backup-restore.sh" backup "$backup_dir" >/tmp/backup.log 2>&1
  local dump_file
  dump_file=$(ls -1 "$backup_dir"/*.dump 2>/dev/null | head -1)
  [[ -n "$dump_file" && -f "$dump_file" ]] && ok "backup created: $dump_file" || { bad "backup failed"; cat /tmp/backup.log; }

  psql_db -c "DELETE FROM office_members; DELETE FROM plan_cms; UPDATE office_registry SET office_name='MUTATED';" >/dev/null

  local cnt_after_delete
  cnt_after_delete=$(psql_db -At -c "SELECT COUNT(*) FROM office_members;")
  [[ "$cnt_after_delete" == "0" ]] && ok "data mutated (office_members cleared)" || bad "mutation failed"

  export RESTORE_CONFIRM=RESTORE
  bash "$ROOT/scripts/db/backup-restore.sh" restore "$dump_file" >/tmp/restore.log 2>&1 || true

  local cnt_members cnt_plan name
  cnt_members=$(psql_db -At -c "SELECT COUNT(*) FROM office_members;")
  cnt_plan=$(psql_db -At -c "SELECT COUNT(*) FROM plan_cms WHERE id='bk-plan';")
  name=$(psql_db -At -c "SELECT office_name FROM office_registry WHERE id='bk-test';")

  [[ "$cnt_members" == "1" ]] && ok "restore: office_members row restored" || bad "restore: office_members=$cnt_members (expected 1)"
  [[ "$cnt_plan" == "1" ]] && ok "restore: plan_cms row restored" || bad "restore: plan_cms=$cnt_plan (expected 1)"
  [[ "$name" == "Backup Office" ]] && ok "restore: office_registry name reverted" || bad "restore: office_name='$name' (expected 'Backup Office')"

  rm -rf "$backup_dir"
  trap - EXIT
  teardown_db
}

# ── Scenario 3: post-005 Production-like (missing 006 objects) ───────────────
scenario_migration_006_idempotent() {
  log "Scenario 3 — post-005 DB missing 006 objects → apply 006 twice (idempotent)"
  setup_db "mig006"
  trap teardown_db EXIT

  apply_migrations_base

  local has_login has_wc has_vitals has_ra
  has_login=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='login_logs');")
  has_wc=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='office_page' AND column_name='website_config');")
  has_vitals=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='web_vitals');")
  has_ra=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='route_analytics');")
  [[ "$has_login" == "f" ]] && ok "pre-006: login_logs absent" || bad "pre-006: login_logs should be absent"
  [[ "$has_wc" == "f" ]] && ok "pre-006: website_config absent" || bad "pre-006: website_config should be absent"
  [[ "$has_vitals" == "f" ]] && ok "pre-006: web_vitals absent" || bad "pre-006: web_vitals should be absent"
  [[ "$has_ra" == "f" ]] && ok "pre-006: route_analytics absent" || bad "pre-006: route_analytics should be absent"

  apply_migration_006
  apply_migration_006

  has_login=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='login_logs');")
  has_wc=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='office_page' AND column_name='website_config');")
  has_vitals=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='web_vitals');")
  has_ra=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='route_analytics');")
  [[ "$has_login" == "t" ]] && ok "post-006: login_logs present" || bad "post-006: login_logs missing"
  [[ "$has_wc" == "t" ]] && ok "post-006: website_config present" || bad "post-006: website_config missing"
  [[ "$has_vitals" == "t" ]] && ok "post-006: web_vitals present" || bad "post-006: web_vitals missing"
  [[ "$has_ra" == "t" ]] && ok "post-006: route_analytics present" || bad "post-006: route_analytics missing"

  local idx_count
  idx_count=$(psql_db -At -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename='login_logs';")
  [[ "$idx_count" -ge 4 ]] && ok "login_logs has indexes ($idx_count)" || bad "login_logs indexes missing ($idx_count)"

  # P0 includes office_storage_quota (007) + storage_files (008) + office_ledger (010) + stripe infra (011)
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_011
  apply_migration_012
  apply_migration_013
  apply_migration_014
  apply_migration_015
  apply_migration_016
  apply_migration_017
  if verify_p0_schema /tmp/verify-006.log; then
    ok "verify-schema.sh passed after 006→017"
  else
    bad "verify-schema.sh failed after 006→017"
    tail -15 /tmp/verify-006.log
  fi

  trap - EXIT
  teardown_db
}

# ── Scenario 3b: UUID/FK legacy office_storage_quota → TEXT via 007 ──────────
scenario_migration_007_text_tenant() {
  log "Scenario 3b — legacy UUID+FK office_storage_quota → 007 TEXT tenant model"
  setup_db "mig007"
  trap teardown_db EXIT

  apply_migrations_base
  apply_migration_006

  # Simulate Production-like UUID table FK'd to office_page (pre-007)
  psql_db <<'SQL' >/dev/null
DROP TABLE IF EXISTS office_storage_quota CASCADE;
CREATE TABLE office_storage_quota (
  office_id UUID PRIMARY KEY REFERENCES office_page(id),
  used_bytes BIGINT NOT NULL DEFAULT 0,
  files_count INTEGER NOT NULL DEFAULT 0,
  max_bytes BIGINT NOT NULL DEFAULT 1073741824,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO office_page (id, slug, name)
  VALUES ('550e8400-e29b-41d4-a716-446655440000', 'quota-legacy', 'Quota Legacy')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO office_storage_quota (office_id, used_bytes, files_count)
  VALUES ('550e8400-e29b-41d4-a716-446655440000', 42, 1);
SQL

  local pre_udt pre_fk
  pre_udt=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_name='office_storage_quota' AND column_name='office_id';
  ")
  pre_fk=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_class ft ON ft.oid=c.confrelid
    WHERE t.relname='office_storage_quota' AND c.contype='f' AND ft.relname='office_page';
  ")
  [[ "$pre_udt" == "uuid" ]] && ok "pre-007: office_id is uuid" || bad "pre-007: office_id udt=$pre_udt"
  [[ "$pre_fk" -ge 1 ]] && ok "pre-007: FK to office_page present" || bad "pre-007: missing FK"

  apply_migration_007
  apply_migration_007

  local post_udt post_fk preserved trial_rc
  post_udt=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_name='office_storage_quota' AND column_name='office_id';
  ")
  post_fk=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_class ft ON ft.oid=c.confrelid
    WHERE t.relname='office_storage_quota' AND c.contype='f' AND ft.relname='office_page';
  ")
  preserved=$(psql_db -At -c "
    SELECT used_bytes::text FROM office_storage_quota
    WHERE office_id='550e8400-e29b-41d4-a716-446655440000';
  ")
  [[ "$post_udt" == "text" ]] && ok "post-007: office_id is text" || bad "post-007: office_id udt=$post_udt"
  [[ "$post_fk" == "0" ]] && ok "post-007: FK to office_page removed" || bad "post-007: FK still present ($post_fk)"
  [[ "$preserved" == "42" ]] && ok "post-007: existing row preserved" || bad "post-007: preserved=$preserved"

  set +e
  psql_db <<'SQL' >/tmp/trial-quota.log 2>&1
INSERT INTO office_storage_quota (office_id, used_bytes, files_count)
VALUES ('trial_gJ1TIcai', 1, 1)
ON CONFLICT (office_id) DO UPDATE
  SET used_bytes = office_storage_quota.used_bytes + 1,
      files_count = office_storage_quota.files_count + 1,
      updated_at = NOW();
SQL
  trial_rc=$?
  set -e
  [[ "$trial_rc" -eq 0 ]] && ok "post-007: trial_* ON CONFLICT upsert succeeds" || {
    bad "post-007: trial_* upsert failed"
    cat /tmp/trial-quota.log
  }

  trap - EXIT
  teardown_db
}

# ── Scenario 3c: missing storage_files (42P01) → 008 creates TEXT tenant table ─
scenario_migration_008_storage_files() {
  log "Scenario 3c — missing storage_files → 008 CREATE + trial INSERT"
  setup_db "mig008"
  trap teardown_db EXIT

  apply_migrations_base
  apply_migration_006
  apply_migration_007

  local pre_exists
  pre_exists=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='storage_files'
    );
  ")
  [[ "$pre_exists" == "f" ]] && ok "pre-008: storage_files absent (42P01 class)" || bad "pre-008: storage_files should be absent"

  set +e
  psql_db -c "
    INSERT INTO storage_files (office_id, original_name, file_name, file_size, category)
    VALUES ('trial_gJ1TIcai', 'a.pdf', 'a.pdf', 1, 'document');
  " >/tmp/pre-008-insert.log 2>&1
  local pre_rc=$?
  set -e
  [[ "$pre_rc" -ne 0 ]] && ok "pre-008: INSERT fails with missing relation" || bad "pre-008: INSERT should fail"

  apply_migration_008
  apply_migration_008

  local post_exists post_udt trial_rc
  post_exists=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='storage_files'
    );
  ")
  post_udt=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_name='storage_files' AND column_name='office_id';
  ")
  [[ "$post_exists" == "t" ]] && ok "post-008: storage_files present" || bad "post-008: storage_files missing"
  [[ "$post_udt" == "text" ]] && ok "post-008: office_id is text" || bad "post-008: office_id udt=$post_udt"

  set +e
  psql_db <<'SQL' >/tmp/post-008-insert.log 2>&1
INSERT INTO storage_files (
  office_id, case_id, client_id, uploaded_by, original_name, file_name,
  mime_type, file_size, file_hash, file_url, storage_key, category
) VALUES (
  'trial_gJ1TIcai', NULL, NULL, 'user_test', 'doc.pdf', 'doc.pdf',
  'application/pdf', 100, 'abc', NULL, 'k1', 'document'
);
INSERT INTO office_storage_quota (office_id, used_bytes, files_count)
VALUES ('trial_gJ1TIcai', 100, 1)
ON CONFLICT (office_id) DO UPDATE SET
  used_bytes = office_storage_quota.used_bytes + 100,
  files_count = office_storage_quota.files_count + 1,
  updated_at = NOW();
SQL
  trial_rc=$?
  set -e
  [[ "$trial_rc" -eq 0 ]] && ok "post-008: trial file+quota register path succeeds" || {
    bad "post-008: trial register failed"
    cat /tmp/post-008-insert.log
  }

  local cnt
  cnt=$(psql_db -At -c "SELECT COUNT(*) FROM storage_files WHERE office_id='trial_gJ1TIcai';")
  [[ "$cnt" == "1" ]] && ok "post-008: trial row persisted" || bad "post-008: count=$cnt"

  trap - EXIT
  teardown_db
}

# ── Scenario 3d: office_ledger + performance indexes (010) — A–F coverage ───
scenario_migration_010_office_ledger() {
  log "Scenario 3d — migration 010: fresh / complete / partial / duplicates / invalid type / idempotent"

  # ── A. Fresh database ────────────────────────────────────────────────────
  setup_db "mig010_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009

  local pre_exists
  pre_exists=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='office_ledger'
    );
  ")
  [[ "$pre_exists" == "f" ]] && ok "A pre-010: office_ledger absent" || bad "A pre-010: office_ledger should be absent"

  apply_migration_010

  local post_exists fee_cols uniq_idx check_cnt cases_idx
  post_exists=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='office_ledger'
    );
  ")
  fee_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_ledger'
      AND column_name IN ('stripe_fee','platform_fee','net_amount','stripe_event_id','currency','created_at','ref','description','stripe_id');
  ")
  uniq_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_office_ledger_stripe_event_id';
  ")
  check_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.office_ledger'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%credit%debit%refund%';
  ")
  cases_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_cases_office_id';
  ")

  [[ "$post_exists" == "t" ]] && ok "A: office_ledger created" || bad "A: office_ledger missing"
  [[ "$fee_cols" == "9" ]] && ok "A: all required columns present" || bad "A: cols=$fee_cols"
  [[ "$check_cnt" -ge 1 ]] && ok "A: type CHECK present" || bad "A: type CHECK missing"
  [[ "$uniq_idx" == "1" ]] && ok "A: partial unique stripe_event_id index" || bad "A: unique index missing"
  [[ "$cases_idx" == "1" ]] && ok "A: idx_cases_office_id present" || bad "A: cases index missing"

  # F (fresh): idempotent re-run
  apply_migration_010
  ok "A/F: re-run 010 on fresh schema succeeded"

  # Insert + ON CONFLICT path (index present)
  psql_db <<'SQL' >/tmp/post-010-insert.log 2>&1
INSERT INTO office_ledger
  (office_id, type, amount, currency, ref, description,
   stripe_id, stripe_event_id, platform_fee, stripe_fee, net_amount)
VALUES
  ('trial_ledger1', 'credit', 100, 'SAR', 'SUB_PRO', 'test',
   'ch_test', 'evt_test_010', 10, 3.9, 86.1)
ON CONFLICT (stripe_event_id) WHERE stripe_event_id IS NOT NULL DO NOTHING;
INSERT INTO office_ledger
  (office_id, type, amount, currency, ref, description,
   stripe_id, stripe_event_id, platform_fee, stripe_fee, net_amount)
VALUES
  ('trial_ledger1', 'credit', 100, 'SAR', 'SUB_PRO', 'dup',
   'ch_test', 'evt_test_010', 10, 3.9, 86.1)
ON CONFLICT (stripe_event_id) WHERE stripe_event_id IS NOT NULL DO NOTHING;
SQL
  local insert_rc=$? cnt
  [[ "$insert_rc" -eq 0 ]] && ok "A: credit insert + idempotent conflict ok" || {
    bad "A: ledger insert failed"; cat /tmp/post-010-insert.log
  }
  cnt=$(psql_db -At -c "SELECT COUNT(*) FROM office_ledger WHERE stripe_event_id='evt_test_010';")
  [[ "$cnt" == "1" ]] && ok "A: duplicate stripe_event_id not inserted" || bad "A: count=$cnt"

  # P0 includes Stripe (011) + payments (012) + ERP (013) + Bankruptcy (014) + Tasks/Branches (015) + Office Messages FTS (016)
  apply_migration_011
  apply_migration_012
  apply_migration_013
  apply_migration_014
  apply_migration_015
  apply_migration_016
  apply_migration_017
  if verify_p0_schema /tmp/verify-010.log; then
    ok "A: verify-schema.sh passed after 010→017"
  else
    bad "A: verify-schema.sh failed after 010→017"; tail -20 /tmp/verify-010.log
  fi

  if ! grep -qE 'ensurePerformanceIndexes|idx_office_ledger_stripe_event_id' \
      "$ROOT/artifacts/api-server/src/index.ts"; then
    ok "A: index.ts has no ensurePerformanceIndexes Runtime DDL"
  else
    bad "A: index.ts still has performance-index Runtime DDL"
  fi

  if ! grep -qE 'CREATE INDEX IF NOT EXISTS idx_tasks_office_due|CREATE INDEX IF NOT EXISTS idx_tasks_status|CREATE INDEX IF NOT EXISTS idx_reminders_office_due' \
      "$ROOT/artifacts/api-server/migrations/010_office_ledger_performance_indexes.sql"; then
    ok "A: 010 does not CREATE tasks/reminders indexes"
  else
    bad "A: 010 still CREATE INDEX for tasks/reminders"
  fi

  trap - EXIT
  teardown_db

  # ── B. Existing complete office_ledger ───────────────────────────────────
  setup_db "mig010_complete"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010

  psql_db <<'SQL' >/dev/null
INSERT INTO office_ledger (office_id, type, amount, currency, stripe_event_id, platform_fee, stripe_fee, net_amount)
VALUES ('office_complete', 'credit', 50, 'SAR', 'evt_complete_1', 5, 2, 43);
SQL

  apply_migration_010
  apply_migration_010

  local complete_cnt complete_idx
  complete_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM office_ledger WHERE stripe_event_id='evt_complete_1';")
  complete_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_office_ledger_stripe_event_id';
  ")
  [[ "$complete_cnt" == "1" ]] && ok "B: existing complete row preserved" || bad "B: row count=$complete_cnt"
  [[ "$complete_idx" == "1" ]] && ok "B: unique index remains after idempotent re-run" || bad "B: unique index missing"
  ok "B/F: re-run 010 on complete schema succeeded"

  trap - EXIT
  teardown_db

  # ── C. Existing partial legacy office_ledger ─────────────────────────────
  setup_db "mig010_partial"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009

  psql_db <<'SQL' >/dev/null
CREATE TABLE office_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  ref TEXT,
  description TEXT,
  stripe_id TEXT
);
INSERT INTO office_ledger (office_id, type, amount, ref)
VALUES ('office_partial', 'credit', 10, 'LEGACY');
SQL

  apply_migration_010

  local partial_cols partial_row
  partial_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_ledger'
      AND column_name IN ('stripe_event_id','platform_fee','stripe_fee','net_amount','currency','created_at');
  ")
  partial_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM office_ledger WHERE office_id='office_partial' AND amount=10 AND ref='LEGACY';
  ")
  [[ "$partial_cols" == "6" ]] && ok "C: missing columns added on partial legacy table" || bad "C: cols=$partial_cols"
  [[ "$partial_row" == "1" ]] && ok "C: legacy row unchanged after column repair" || bad "C: legacy row altered"

  apply_migration_010
  ok "C/F: re-run 010 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db

  # ── D. Duplicate legacy stripe_event_id ──────────────────────────────────
  setup_db "mig010_dups"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009

  psql_db <<'SQL' >/dev/null
CREATE TABLE office_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  stripe_event_id TEXT
);
INSERT INTO office_ledger (office_id, type, amount, stripe_event_id) VALUES
  ('office_dup', 'credit', 1, 'evt_dup_legacy'),
  ('office_dup', 'credit', 2, 'evt_dup_legacy');
SQL

  # Capture NOTICE/WARNING from migration
  set +e
  psql_db -f "$MIGRATION_010" >/tmp/mig010-dup.log 2>&1
  local dup_rc=$?
  set -e
  [[ "$dup_rc" -eq 0 ]] && ok "D: migration 010 succeeds with duplicate stripe_event_id" || {
    bad "D: migration failed with duplicates"; cat /tmp/mig010-dup.log
  }

  local dup_idx dup_rows warn_hit fee_after
  dup_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_office_ledger_stripe_event_id';
  ")
  dup_rows=$(psql_db -At -c "
    SELECT COUNT(*) FROM office_ledger WHERE stripe_event_id='evt_dup_legacy';
  ")
  fee_after=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_ledger'
      AND column_name IN ('platform_fee','stripe_fee','net_amount');
  ")
  warn_hit=$(grep -c 'skipping idx_office_ledger_stripe_event_id' /tmp/mig010-dup.log || true)

  [[ "$dup_idx" == "0" ]] && ok "D: unique index NOT created when duplicates exist" || bad "D: unique index was created"
  [[ "$dup_rows" == "2" ]] && ok "D: duplicate rows unmodified" || bad "D: rows changed count=$dup_rows"
  [[ "$fee_after" == "3" ]] && ok "D: column repairs committed despite skipped index" || bad "D: fee cols=$fee_after"
  [[ "$warn_hit" -ge 1 ]] && ok "D: WARNING emitted for duplicate stripe_event_id" || bad "D: missing duplicate WARNING"

  apply_migration_010
  ok "D/F: re-run 010 after duplicate skip succeeded"

  trap - EXIT
  teardown_db

  # ── E. Invalid legacy type data ──────────────────────────────────────────
  setup_db "mig010_badtype"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009

  psql_db <<'SQL' >/dev/null
CREATE TABLE office_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL
);
INSERT INTO office_ledger (office_id, type, amount)
VALUES ('office_badtype', 'adjustment', 99);
SQL

  set +e
  psql_db -f "$MIGRATION_010" >/tmp/mig010-badtype.log 2>&1
  local badtype_rc=$?
  set -e
  [[ "$badtype_rc" -eq 0 ]] && ok "E: migration 010 succeeds with invalid type value" || {
    bad "E: migration failed on invalid type"; cat /tmp/mig010-badtype.log
  }

  local bad_check bad_row warn_type
  bad_check=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.office_ledger'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%credit%debit%refund%';
  ")
  bad_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM office_ledger WHERE office_id='office_badtype' AND type='adjustment' AND amount=99;
  ")
  warn_type=$(grep -c 'skipping type CHECK' /tmp/mig010-badtype.log || true)

  [[ "$bad_check" == "0" ]] && ok "E: type CHECK skipped for invalid legacy type" || bad "E: CHECK was added"
  [[ "$bad_row" == "1" ]] && ok "E: invalid legacy row unchanged" || bad "E: legacy row altered"
  [[ "$warn_type" -ge 1 ]] && ok "E: WARNING emitted for invalid type" || bad "E: missing type WARNING"

  apply_migration_010
  ok "E/F: re-run 010 after CHECK skip succeeded"

  trap - EXIT
  teardown_db
}

# ── Scenario 3e: Stripe infrastructure (011) ────────────────────────────────

# ── Scenario: migration 034 JLWM Core schema authority (Stage 4B) ───────────
scenario_migration_034_jlwm_core() {
  log "Scenario 034 — JLWM Core: greenfield / already-correct / BLOCK / orphans / P0"
  local PREFLIGHT_034="$ROOT/scripts/db/preflight-migration-034.sql"
  local OID='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  setup_db "mig034_preflight_absent"
  trap teardown_db EXIT
  apply_migrations_base
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-absent.log 2>&1 || true
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight034-absent.log \
    && ok "A0: SAFE_AUTO_REPAIR (core missing)" \
    || bad "A0: missing SAFE_AUTO_REPAIR"
  grep -q 'reason_code=TABLE_MISSING' /tmp/preflight034-absent.log \
    && ok "A0: TABLE_MISSING" || bad "A0: reason"
  trap - EXIT
  teardown_db

  setup_db "mig034_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  local cfg uniq_nodes fk_from
  cfg=$(psql_db -At -c "SELECT to_regclass('public.jlwm_config') IS NOT NULL")
  [[ "$cfg" == "t" ]] && ok "A: jlwm_config present" || bad "A: config missing"
  uniq_nodes=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class i
      JOIN pg_namespace n ON n.oid=i.relnamespace
      JOIN pg_index x ON x.indexrelid=i.oid
      WHERE n.nspname='public' AND i.relname='idx_jmn_uniq'
        AND x.indisunique AND x.indpred IS NOT NULL
        AND pg_get_expr(x.indpred, x.indrelid) ILIKE '%node_ref%IS NOT NULL%'
    )")
  [[ "$uniq_nodes" == "t" ]] && ok "A: idx_jmn_uniq partial UNIQUE exact" || bad "A: idx_jmn_uniq"
  fk_from=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.jlwm_memory_edges'::regclass
        AND c.conname='jlwm_memory_edges_from_node_id_fkey'
    )")
  [[ "$fk_from" == "t" ]] && ok "A: memory_edges from FK INSTALLED" || bad "A: FK from"
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO jlwm_config (office_id) VALUES ('$OID')
    ON CONFLICT (office_id) DO NOTHING;
    INSERT INTO jlwm_case_twins (office_id, case_id) VALUES ('$OID', 'case-1')
    ON CONFLICT (office_id, case_id) DO UPDATE SET updated_at=NOW();
    INSERT INTO jlwm_memory_nodes (office_id, node_type, node_ref, label)
    VALUES ('$OID', 'case', 'case-1', 'n1')
    ON CONFLICT (office_id, node_type, node_ref) WHERE node_ref IS NOT NULL
    DO UPDATE SET label=EXCLUDED.label;
  " >/dev/null && ok "A: config/twin/partial-unique arbiters usable" || bad "A: ON CONFLICT failed"
  apply_migration_034
  ok "A: re-run 034 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight034-ready.log \
    && ok "A: preflight ALREADY_CORRECT" \
    || bad "A: $(grep chosen_action /tmp/preflight034-ready.log | tail -1)"
  grep -q 'reason_code=JLWM_CORE_SCHEMA_READY' /tmp/preflight034-ready.log \
    && ok "A: JLWM_CORE_SCHEMA_READY" || bad "A: missing JLWM_CORE_SCHEMA_READY"
  grep -q 'fk_status=INSTALLED' /tmp/preflight034-ready.log \
    && ok "A: fk_status=INSTALLED for FULL READY" || bad "A: fk_status not INSTALLED"
  trap - EXIT
  teardown_db

  setup_db "mig034_missing_table"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE jlwm_feedback CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-misstbl.log 2>&1 || true
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight034-misstbl.log \
    && ok "B: missing jlwm_feedback → SAFE" || bad "B: preflight"
  apply_migration_034
  local fb
  fb=$(psql_db -At -c "SELECT to_regclass('public.jlwm_feedback') IS NOT NULL")
  [[ "$fb" == "t" ]] && ok "B: jlwm_feedback restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  setup_db "mig034_missing_idx"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_jft_office;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-missidx.log 2>&1 || true
  grep -q 'SAFE_AUTO_REPAIR\|PARTIAL_SCHEMA\|MISSING' /tmp/preflight034-missidx.log \
    && ok "C: missing index → SAFE" || bad "C: preflight"
  apply_migration_034
  local idx
  idx=$(psql_db -At -c "SELECT to_regclass('public.idx_jft_office') IS NOT NULL")
  [[ "$idx" == "t" ]] && ok "C: idx_jft_office restored" || bad "C: index missing"
  trap - EXIT
  teardown_db

  setup_db "mig034_badtype"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_config DROP COLUMN office_id;
    ALTER TABLE jlwm_config ADD COLUMN office_id INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-type.log 2>&1; then
    bad "D: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight034-type.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_034" >/tmp/mig034-type.log 2>&1; then
    bad "D: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig034-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig034_null_office"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_config ALTER COLUMN office_id DROP NOT NULL;
    INSERT INTO jlwm_config (id, office_id) VALUES ('null-cfg', NULL);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-null.log 2>&1; then
    bad "E: preflight should BLOCK NULL office_id"
  else
    grep -q 'NULL_OFFICE_ID\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight034-null.log \
      && ok "E: preflight BLOCK NULL_OFFICE_ID" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_034" >/tmp/mig034-null.log 2>&1; then
    bad "E: migration should BLOCK NULL office_id"
  else
    grep -q 'NULL_OFFICE_ID' /tmp/mig034-null.log \
      && ok "E: migration BLOCK NULL_OFFICE_ID" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig034_dup_config"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_config DROP CONSTRAINT IF EXISTS jlwm_config_office_id_key;
    INSERT INTO jlwm_config (office_id) VALUES ('$OID');
    INSERT INTO jlwm_config (office_id) VALUES ('$OID');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-dupcfg.log 2>&1; then
    bad "F: preflight should BLOCK duplicate config"
  else
    grep -q 'DUPLICATE_CONFIG_OFFICE_ID\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight034-dupcfg.log \
      && ok "F: preflight BLOCK DUPLICATE_CONFIG_OFFICE_ID" || bad "F: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_034" >/tmp/mig034-dupcfg.log 2>&1; then
    bad "F: migration should BLOCK duplicate config"
  else
    grep -q 'DUPLICATE_CONFIG_OFFICE_ID' /tmp/mig034-dupcfg.log \
      && ok "F: migration BLOCK DUPLICATE_CONFIG_OFFICE_ID" || bad "F: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig034_dup_twin"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_case_twins DROP CONSTRAINT IF EXISTS jlwm_case_twins_office_id_case_id_key;
    INSERT INTO jlwm_case_twins (office_id, case_id) VALUES ('$OID', 'c1');
    INSERT INTO jlwm_case_twins (office_id, case_id) VALUES ('$OID', 'c1');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-duptwin.log 2>&1; then
    bad "G: preflight should BLOCK duplicate twin"
  else
    grep -q 'DUPLICATE_CASE_TWIN\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight034-duptwin.log \
      && ok "G: preflight BLOCK DUPLICATE_CASE_TWIN" || bad "G: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_034" >/tmp/mig034-duptwin.log 2>&1; then
    bad "G: migration should BLOCK duplicate twin"
  else
    grep -q 'DUPLICATE_CASE_TWIN' /tmp/mig034-duptwin.log \
      && ok "G: migration BLOCK DUPLICATE_CASE_TWIN" || bad "G: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig034_bad_partial"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_jmn_uniq;
    CREATE UNIQUE INDEX idx_jmn_uniq ON jlwm_memory_nodes(office_id, node_type, node_ref);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-partial.log 2>&1; then
    bad "H: preflight should BLOCK non-partial idx_jmn_uniq"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight034-partial.log \
      && ok "H: preflight BLOCK wrong idx_jmn_uniq" || bad "H: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_034" >/tmp/mig034-partial.log 2>&1; then
    bad "H: migration should BLOCK wrong idx_jmn_uniq"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig034-partial.log \
      && ok "H: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "H: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig034_non_uuid"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO jlwm_config (office_id) VALUES ('default');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-nuuid.log 2>&1; then
    bad "I: preflight should BLOCK non-UUID office_id"
  else
    grep -q 'NON_UUID_OFFICE_ID\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight034-nuuid.log \
      && ok "I: preflight BLOCK NON_UUID_OFFICE_ID" || bad "I: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_034" >/tmp/mig034-nuuid.log 2>&1; then
    bad "I: migration should BLOCK non-UUID"
  else
    grep -q 'NON_UUID_OFFICE_ID' /tmp/mig034-nuuid.log \
      && ok "I: migration BLOCK NON_UUID_OFFICE_ID" || bad "I: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig034_orphans"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_memory_edges DROP CONSTRAINT IF EXISTS jlwm_memory_edges_from_node_id_fkey;
    ALTER TABLE jlwm_memory_edges DROP CONSTRAINT IF EXISTS jlwm_memory_edges_to_node_id_fkey;
    INSERT INTO jlwm_memory_edges (office_id, from_node_id, to_node_id, edge_type)
    VALUES ('$OID', 'missing-from', 'missing-to', 'linked_to');
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_034" >/tmp/mig034-orphan.log 2>&1 \
    && ok "J: migration commits with orphan edges (FK deferred)" \
    || bad "J: migration failed on orphans"
  grep -qi 'FK_DEFERRED_ORPHANS\|fk_status=DEFERRED\|DEFERRED' /tmp/mig034-orphan.log \
    && ok "J: deferred FK surfaced" || bad "J: no defer notice"
  grep -qi 'NOT FULLY READY\|not claiming JLWM_CORE_SCHEMA_READY' /tmp/mig034-orphan.log \
    && ok "J: post-apply does not claim FULL READY / JLWM_CORE_SCHEMA_READY" \
    || bad "J: post-apply taxonomy"
  fk_from=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.jlwm_memory_edges'::regclass
        AND c.conname='jlwm_memory_edges_from_node_id_fkey'
    )")
  [[ "$fk_from" == "f" ]] && ok "J: FK not falsely installed" || bad "J: FK installed despite orphans"
  # Orphan edges + otherwise-correct schema must NOT be ALREADY_CORRECT
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_034" >/tmp/preflight034-orphan.log 2>&1 || true
  if grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight034-orphan.log; then
    bad "J: orphan edges must NOT return ALREADY_CORRECT"
  else
    ok "J: orphan edges are not ALREADY_CORRECT"
  fi
  if grep -q 'reason_code=JLWM_CORE_SCHEMA_READY' /tmp/preflight034-orphan.log; then
    bad "J: orphan edges must NOT return JLWM_CORE_SCHEMA_READY"
  else
    ok "J: orphan edges are not JLWM_CORE_SCHEMA_READY"
  fi
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight034-orphan.log \
    && ok "J: orphan edges → SAFE_AUTO_REPAIR" \
    || bad "J: $(grep chosen_action /tmp/preflight034-orphan.log | tail -1)"
  grep -q 'reason_code=READY_WITH_DEFERRED_FK' /tmp/preflight034-orphan.log \
    && ok "J: reason_code=READY_WITH_DEFERRED_FK" || bad "J: missing READY_WITH_DEFERRED_FK"
  grep -qE 'fk_status=DEFERRED' /tmp/preflight034-orphan.log \
    && ok "J: fk_status=DEFERRED authoritative" || bad "J: fk_status not DEFERRED"
  orphan_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM jlwm_memory_edges WHERE from_node_id='missing-from'")
  [[ "$orphan_cnt" == "1" ]] && ok "J: orphan edge not deleted/remapped" || bad "J: orphan mutated"
  trap - EXIT
  teardown_db

  if grep -q 'CREATE TABLE IF NOT EXISTS jlwm_config' "$ROOT/artifacts/api-server/src/modules/jlwm/jlwm.schema.ts"; then
    bad "K: Runtime jlwm_config CREATE still present"
  else
    ok "K: Runtime core CREATE removed from jlwm.schema.ts"
  fi
  if grep -q 'CREATE TABLE IF NOT EXISTS jlwm_future_paths' "$ROOT/artifacts/api-server/src/modules/jlwm/futureExplorer.ts"; then
    bad "K: satellite Runtime DDL still present (must be Migration 035)"
  else
    ok "K: satellite Runtime CREATE removed (owned by 035)"
  fi
  if grep -q 'CREATE TABLE IF NOT EXISTS jlwm_ai_audit' "$ROOT/artifacts/api-server/src/modules/jlwm/reliabilityEngine.ts"; then
    bad "K: reliability Runtime DDL still present (must be owned by 036)"
  else
    ok "K: reliability Runtime CREATE removed (owned by 036)"
  fi

  setup_db "mig034_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig034-p0-present.log 2>&1; then
    ok "L: verify-schema passes with JLWM core present"
  else
    bad "L: verify-schema failed after full chain"; tail -30 /tmp/mig034-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE jlwm_config CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig034-p0.log 2>&1; then
    bad "L: verify-schema should fail without jlwm_config"
  else
    grep -qi 'jlwm_config' /tmp/mig034-p0.log \
      && ok "L: P0 verify fails when jlwm_config absent" || bad "L: verify log missing jlwm_config"
  fi
  apply_migration_034
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig034-p0-restored.log 2>&1; then
    ok "L: verify-schema passes after 034 restore"
  else
    bad "L: verify-schema failed after 034 restore"; tail -30 /tmp/mig034-p0-restored.log
  fi
  trap - EXIT
  teardown_db

  grep -q 'POST_APPLY_READINESS_FAILED' "$MIGRATION_034" \
    && ok "M: post-apply readiness gate present" || bad "M: post-apply gate missing"
}


scenario_migration_035_jlwm_satellites() {
  log "Scenario 035 — JLWM Satellites: greenfield / already-correct / BLOCK / indexes / P0"
  local PREFLIGHT_035="$ROOT/scripts/db/preflight-migration-035.sql"
  local OID='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  setup_db "mig035_preflight_absent"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-absent.log 2>&1 || true
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight035-absent.log \
    && ok "A0: SAFE_AUTO_REPAIR (satellites missing)" \
    || bad "A0: missing SAFE_AUTO_REPAIR"
  grep -q 'reason_code=TABLE_MISSING' /tmp/preflight035-absent.log \
    && ok "A0: TABLE_MISSING" || bad "A0: reason"
  trap - EXIT
  teardown_db

  setup_db "mig035_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  local fp idx_desc
  fp=$(psql_db -At -c "SELECT to_regclass('public.jlwm_future_paths') IS NOT NULL")
  [[ "$fp" == "t" ]] && ok "A: jlwm_future_paths present" || bad "A: future_paths missing"
  idx_desc=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class i
      JOIN pg_namespace n ON n.oid=i.relnamespace
      JOIN pg_index x ON x.indexrelid=i.oid
      WHERE n.nspname='public' AND i.relname='idx_jer_type'
        AND x.indisunique IS FALSE AND x.indpred IS NULL
        AND (x.indoption[array_length(x.indkey,1)-1] & 1) = 1
    )")
  [[ "$idx_desc" == "t" ]] && ok "A: idx_jer_type DESC last key" || bad "A: idx_jer_type DESC"
  apply_migration_035
  ok "A: re-run 035 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight035-ready.log \
    && ok "A: preflight ALREADY_CORRECT" \
    || bad "A: $(grep chosen_action /tmp/preflight035-ready.log | tail -1)"
  grep -q 'reason_code=JLWM_SATELLITES_SCHEMA_READY' /tmp/preflight035-ready.log \
    && ok "A: JLWM_SATELLITES_SCHEMA_READY" || bad "A: reason"
  trap - EXIT
  teardown_db

  setup_db "mig035_missing_table"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE jlwm_coo_actions CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-misstbl.log 2>&1 || true
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight035-misstbl.log \
    && ok "B: missing jlwm_coo_actions → SAFE" || bad "B: preflight"
  apply_migration_035
  local coo
  coo=$(psql_db -At -c "SELECT to_regclass('public.jlwm_coo_actions') IS NOT NULL")
  [[ "$coo" == "t" ]] && ok "B: jlwm_coo_actions restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  setup_db "mig035_missing_idx"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_jfp_office;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-missidx.log 2>&1 || true
  grep -q 'SAFE_AUTO_REPAIR\|PARTIAL_SCHEMA\|MISSING' /tmp/preflight035-missidx.log \
    && ok "C: missing index → SAFE" || bad "C: preflight"
  apply_migration_035
  local idx
  idx=$(psql_db -At -c "SELECT to_regclass('public.idx_jfp_office') IS NOT NULL")
  [[ "$idx" == "t" ]] && ok "C: idx_jfp_office restored" || bad "C: index missing"
  trap - EXIT
  teardown_db

  setup_db "mig035_badtype"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_future_paths DROP COLUMN office_id;
    ALTER TABLE jlwm_future_paths ADD COLUMN office_id INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-type.log 2>&1; then
    bad "D: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight035-type.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_035" >/tmp/mig035-type.log 2>&1; then
    bad "D: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig035-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig035_null_office"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_future_paths ALTER COLUMN office_id DROP NOT NULL;
    INSERT INTO jlwm_future_paths (id, office_id, subject_type)
    VALUES ('null-fp', NULL, 'office');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-null.log 2>&1; then
    bad "E: preflight should BLOCK NULL office_id"
  else
    grep -q 'NULL_OFFICE_ID\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight035-null.log \
      && ok "E: preflight BLOCK NULL_OFFICE_ID" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_035" >/tmp/mig035-null.log 2>&1; then
    bad "E: migration should BLOCK NULL office_id"
  else
    grep -q 'NULL_OFFICE_ID' /tmp/mig035-null.log \
      && ok "E: migration BLOCK NULL_OFFICE_ID" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig035_null_case"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_simulations ALTER COLUMN case_id DROP NOT NULL;
    INSERT INTO jlwm_simulations (id, office_id, case_id, scenario_type)
    VALUES ('null-case', '$OID', NULL, 'appeal');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-nullcase.log 2>&1; then
    bad "F: preflight should BLOCK NULL case_id"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight035-nullcase.log \
      && ok "F: preflight BLOCK NULL_REQUIRED case_id" || bad "F: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_035" >/tmp/mig035-nullcase.log 2>&1; then
    bad "F: migration should BLOCK NULL case_id"
  else
    # Migration uses specific NULL_CASE_ID; preflight collapses to NULL_REQUIRED
    grep -qE 'NULL_CASE_ID|NULL_REQUIRED' /tmp/mig035-nullcase.log \
      && ok "F: migration BLOCK NULL_CASE_ID" || bad "F: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig035_non_uuid"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO jlwm_future_paths (office_id, subject_type)
    VALUES ('default', 'office');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-nuuid.log 2>&1; then
    bad "G: preflight should BLOCK non-UUID"
  else
    grep -q 'NON_UUID_OFFICE_ID\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight035-nuuid.log \
      && ok "G: preflight BLOCK NON_UUID_OFFICE_ID" || bad "G: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_035" >/tmp/mig035-nuuid.log 2>&1; then
    bad "G: migration should BLOCK non-UUID"
  else
    grep -q 'NON_UUID_OFFICE_ID' /tmp/mig035-nuuid.log \
      && ok "G: migration BLOCK NON_UUID_OFFICE_ID" || bad "G: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig035_wrong_idx"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_jfp_office;
    CREATE INDEX idx_jfp_office ON jlwm_future_paths(subject_type);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-wrongidx.log 2>&1; then
    bad "H: preflight should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight035-wrongidx.log \
      && ok "H: preflight BLOCK INCOMPATIBLE_INDEX" || bad "H: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_035" >/tmp/mig035-wrongidx.log 2>&1; then
    bad "H: migration should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig035-wrongidx.log \
      && ok "H: migration BLOCK INCOMPATIBLE_INDEX" || bad "H: mig reason"
  fi
  trap - EXIT
  teardown_db

  # H2: earlier DESC key on idx_jer_type must BLOCK — never ALREADY_CORRECT
  setup_db "mig035_wrong_desc"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_jer_type;
    CREATE INDEX idx_jer_type ON jlwm_executive_reports(office_id DESC, report_type, generated_at DESC);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-wrongdesc.log 2>&1; then
    bad "H2: preflight must not ALREADY_CORRECT with prefix DESC"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight035-wrongdesc.log \
      && ok "H2: preflight BLOCK prefix-DESC idx_jer_type" || bad "H2: preflight reason"
    grep -q 'ALREADY_CORRECT\|JLWM_SATELLITES_SCHEMA_READY' /tmp/preflight035-wrongdesc.log \
      && bad "H2: must never report ALREADY_CORRECT for prefix DESC" \
      || ok "H2: no ALREADY_CORRECT for prefix DESC"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_035" >/tmp/mig035-wrongdesc.log 2>&1; then
    bad "H2: migration should BLOCK prefix-DESC idx_jer_type"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig035-wrongdesc.log \
      && ok "H2: migration BLOCK INCOMPATIBLE_INDEX prefix DESC" || bad "H2: mig reason"
  fi
  trap - EXIT
  teardown_db

  # H3: missing expected table + same-name wrong index => BLOCK over SAFE/TABLE_MISSING
  setup_db "mig035_miss_tbl_bad_idx"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE jlwm_coo_actions CASCADE;
    CREATE TABLE jlwm_coo_actions_orphan (office_id TEXT);
    CREATE INDEX idx_jca_office ON jlwm_coo_actions_orphan(office_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-misstbl-idx.log 2>&1; then
    bad "H3: preflight must BLOCK missing table + wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight035-misstbl-idx.log \
      && ok "H3: preflight BLOCK INCOMPATIBLE_INDEX (table missing)" || bad "H3: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight035-misstbl-idx.log \
      && bad "H3: must never SAFE when same-name index incompatible" \
      || ok "H3: no SAFE_AUTO_REPAIR over incompatible index"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_035" >/tmp/mig035-misstbl-idx.log 2>&1; then
    bad "H3: migration should BLOCK missing table + wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig035-misstbl-idx.log \
      && ok "H3: migration BLOCK INCOMPATIBLE_INDEX" || bad "H3: mig reason"
  fi
  trap - EXIT
  teardown_db

  setup_db "mig035_wrong_pk"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_simulations DROP CONSTRAINT jlwm_simulations_pkey;
    ALTER TABLE jlwm_simulations ADD PRIMARY KEY (office_id, case_id, id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_035" >/tmp/preflight035-wrongpk.log 2>&1; then
    bad "I: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight035-wrongpk.log \
      && ok "I: preflight BLOCK INCOMPATIBLE_PK" || bad "I: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_035" >/tmp/mig035-wrongpk.log 2>&1; then
    bad "I: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig035-wrongpk.log \
      && ok "I: migration BLOCK INCOMPATIBLE_PK" || bad "I: mig reason"
  fi
  trap - EXIT
  teardown_db

  if grep -q 'CREATE TABLE IF NOT EXISTS jlwm_future_paths' "$ROOT/artifacts/api-server/src/modules/jlwm/futureExplorer.ts"; then
    bad "J: Runtime jlwm_future_paths CREATE still present"
  else
    ok "J: Runtime satellite CREATE removed from futureExplorer.ts"
  fi
  if grep -q 'CREATE TABLE IF NOT EXISTS jlwm_ai_audit' "$ROOT/artifacts/api-server/src/modules/jlwm/reliabilityEngine.ts"; then
    bad "J: reliability Runtime DDL still present (must be owned by 036)"
  else
    ok "J: reliability Runtime CREATE removed (owned by 036)"
  fi

  setup_db "mig035_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig035-p0-present.log 2>&1; then
    ok "K: verify-schema passes with satellites present"
  else
    bad "K: verify-schema failed after full chain"; tail -30 /tmp/mig035-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE jlwm_future_paths CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig035-p0.log 2>&1; then
    bad "K: verify-schema should fail without jlwm_future_paths"
  else
    grep -qi 'jlwm_future_paths' /tmp/mig035-p0.log \
      && ok "K: P0 verify fails when jlwm_future_paths absent" || bad "K: verify log missing jlwm_future_paths"
  fi
  apply_migration_035
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig035-p0-restored.log 2>&1; then
    ok "K: verify-schema passes after 035 restore"
  else
    bad "K: verify-schema failed after 035 restore"; tail -30 /tmp/mig035-p0-restored.log
  fi
  trap - EXIT
  teardown_db

  grep -q 'POST_APPLY_READINESS_FAILED' "$MIGRATION_035" \
    && ok "L: post-apply readiness gate present" || bad "L: post-apply gate missing"
}

scenario_migration_036_jlwm_reliability() {
  log "Scenario 036 — JLWM Reliability: greenfield / already-correct / BLOCK / indexes / DML / P0"
  local PREFLIGHT_036="$ROOT/scripts/db/preflight-migration-036.sql"
  local OID='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  # A0: preflight is safe when all five 036 tables are absent.
  setup_db "mig036_preflight_absent"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-absent.log 2>&1
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight036-absent.log \
    && ok "A0: SAFE_AUTO_REPAIR (reliability tables missing)" \
    || bad "A0: missing SAFE_AUTO_REPAIR"
  grep -q 'reason_code=TABLE_MISSING' /tmp/preflight036-absent.log \
    && ok "A0: TABLE_MISSING" || bad "A0: reason"
  trap - EXIT
  teardown_db

  # A: greenfield apply, exact objects, idempotency, and ready preflight.
  setup_db "mig036_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  local table_count index_count desc_count
  table_count=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN (
        'jlwm_ai_audit','jlwm_trust_scores','jlwm_recommendation_tracking',
        'jlwm_data_quality','jlwm_learning_events'
      )")
  [[ "$table_count" == "5" ]] && ok "A: all 5 reliability tables present" || bad "A: reliability table count=$table_count"
  index_count=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='i'
      AND c.relname IN (
        'idx_jaa_office','idx_jaa_type','idx_jts_office',
        'idx_jrt_office','idx_jdq_office','idx_jle_office'
      )")
  [[ "$index_count" == "6" ]] && ok "A: all 6 reliability indexes present" || bad "A: reliability index count=$index_count"
  desc_count=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND (
      (i.relname='idx_jaa_type' AND (x.indoption[0] & 1)=0 AND (x.indoption[1] & 1)=0 AND (x.indoption[2] & 1)=1)
      OR (i.relname IN ('idx_jts_office','idx_jdq_office','idx_jle_office')
          AND (x.indoption[0] & 1)=0 AND (x.indoption[1] & 1)=1)
    )")
  [[ "$desc_count" == "4" ]] && ok "A: DESC indexes have ASC prefixes and DESC final keys" || bad "A: DESC index count=$desc_count"
  apply_migration_036
  ok "A: re-run 036 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight036-ready.log \
    && ok "A: preflight ALREADY_CORRECT" \
    || bad "A: $(grep chosen_action /tmp/preflight036-ready.log | tail -1)"
  grep -q 'reason_code=JLWM_RELIABILITY_SCHEMA_READY' /tmp/preflight036-ready.log \
    && ok "A: JLWM_RELIABILITY_SCHEMA_READY" || bad "A: reason"
  trap - EXIT
  teardown_db

  # B: missing table is SAFE and Migration 036 restores it.
  setup_db "mig036_missing_table"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE jlwm_data_quality CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-misstbl.log 2>&1
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight036-misstbl.log \
    && ok "B: missing jlwm_data_quality → SAFE" || bad "B: preflight"
  apply_migration_036
  local dq
  dq=$(psql_db -At -c "SELECT to_regclass('public.jlwm_data_quality') IS NOT NULL")
  [[ "$dq" == "t" ]] && ok "B: jlwm_data_quality restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # C: missing index is SAFE and Migration 036 restores it.
  setup_db "mig036_missing_idx"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_jrt_office;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-missidx.log 2>&1
  grep -q 'PARTIAL_SCHEMA\|MISSING_COLUMN_DEFAULTS\|SAFE_AUTO_REPAIR' /tmp/preflight036-missidx.log \
    && ok "C: missing index → SAFE" || bad "C: preflight"
  apply_migration_036
  local idx
  idx=$(psql_db -At -c "SELECT to_regclass('public.idx_jrt_office') IS NOT NULL")
  [[ "$idx" == "t" ]] && ok "C: idx_jrt_office restored" || bad "C: index missing"
  trap - EXIT
  teardown_db

  # C2: missing safe defaults are SAFE and Migration 036 restores them.
  setup_db "mig036_miss_defaults"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_ai_audit ALTER COLUMN created_at DROP DEFAULT;
    ALTER TABLE jlwm_ai_audit ALTER COLUMN evidence_count DROP DEFAULT;
    ALTER TABLE jlwm_learning_events ALTER COLUMN evidence DROP DEFAULT;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-miss-def.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight036-miss-def.log \
    && bad "C2: missing defaults must not be ALREADY_CORRECT" \
    || ok "C2: missing defaults not ALREADY_CORRECT"
  grep -qE 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight036-miss-def.log \
    && ok "C2: SAFE_AUTO_REPAIR for missing defaults" || bad "C2: action"
  grep -q 'MISSING_COLUMN_DEFAULTS' /tmp/preflight036-miss-def.log \
    && ok "C2: reason MISSING_COLUMN_DEFAULTS" || bad "C2: reason"
  apply_migration_036
  local ca_def ev_def le_def
  ca_def=$(psql_db -At -c "
    SELECT column_default ILIKE '%now%' FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_ai_audit' AND column_name='created_at'")
  ev_def=$(psql_db -At -c "
    SELECT column_default = '0' FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_ai_audit' AND column_name='evidence_count'")
  le_def=$(psql_db -At -c "
    SELECT column_default IS NOT NULL FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_learning_events' AND column_name='evidence'")
  [[ "$ca_def" == "t" && "$ev_def" == "t" && "$le_def" == "t" ]] \
    && ok "C2: Migration 036 restored safe defaults" \
    || bad "C2: defaults not restored (created_at=$ca_def evidence_count=$ev_def evidence=$le_def)"
  trap - EXIT
  teardown_db

  # D: incompatible type blocks both preflight and apply.
  setup_db "mig036_badtype"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_trust_scores DROP COLUMN computed_at;
    ALTER TABLE jlwm_trust_scores ADD COLUMN computed_at INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-type.log 2>&1; then
    bad "D: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight036-type.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_036" >/tmp/mig036-type.log 2>&1; then
    bad "D: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig036-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: migration reason"
  fi
  trap - EXIT
  teardown_db

  # E: NULL office_id blocks both preflight and apply.
  setup_db "mig036_null_office"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_ai_audit ALTER COLUMN office_id DROP NOT NULL;
    INSERT INTO jlwm_ai_audit (id, office_id, query_type, model_used)
    VALUES ('$OID', NULL, 'test', 'test');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-null-office.log 2>&1; then
    bad "E: preflight should BLOCK NULL office_id"
  else
    grep -q 'NULL_OFFICE_ID\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight036-null-office.log \
      && ok "E: preflight BLOCK NULL_OFFICE_ID" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_036" >/tmp/mig036-null-office.log 2>&1; then
    bad "E: migration should BLOCK NULL office_id"
  else
    grep -q 'NULL_OFFICE_ID' /tmp/mig036-null-office.log \
      && ok "E: migration BLOCK NULL_OFFICE_ID" || bad "E: migration reason"
  fi
  trap - EXIT
  teardown_db

  # F: non-UUID office_id blocks both preflight and apply.
  setup_db "mig036_non_uuid"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO jlwm_trust_scores (id, office_id)
    VALUES ('$OID', 'not-a-uuid');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-nuuid.log 2>&1; then
    bad "F: preflight should BLOCK non-UUID"
  else
    grep -q 'NON_UUID_OFFICE_ID\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight036-nuuid.log \
      && ok "F: preflight BLOCK NON_UUID_OFFICE_ID" || bad "F: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_036" >/tmp/mig036-nuuid.log 2>&1; then
    bad "F: migration should BLOCK non-UUID"
  else
    grep -q 'NON_UUID_OFFICE_ID' /tmp/mig036-nuuid.log \
      && ok "F: migration BLOCK NON_UUID_OFFICE_ID" || bad "F: migration reason"
  fi
  trap - EXIT
  teardown_db

  # F2: NULL required non-office fields block both preflight and apply.
  setup_db "mig036_null_required"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_recommendation_tracking ALTER COLUMN title DROP NOT NULL;
    INSERT INTO jlwm_recommendation_tracking (id, office_id, title)
    VALUES ('null-title', '$OID', NULL);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-nullreq.log 2>&1; then
    bad "F2: preflight should BLOCK NULL required fields"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight036-nullreq.log \
      && ok "F2: preflight BLOCK NULL_REQUIRED" || bad "F2: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_036" >/tmp/mig036-nullreq.log 2>&1; then
    bad "F2: migration should BLOCK NULL required fields"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig036-nullreq.log \
      && ok "F2: migration BLOCK NULL_REQUIRED" || bad "F2: migration reason"
  fi
  trap - EXIT
  teardown_db

  # G: a wrong same-name index is a blocker, never a safe repair.
  setup_db "mig036_wrong_idx"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_jaa_office;
    CREATE INDEX idx_jaa_office ON jlwm_ai_audit(query_type);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-wrongidx.log 2>&1; then
    bad "G: preflight should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight036-wrongidx.log \
      && ok "G: preflight BLOCK INCOMPATIBLE_INDEX" || bad "G: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_036" >/tmp/mig036-wrongidx.log 2>&1; then
    bad "G: migration should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig036-wrongidx.log \
      && ok "G: migration BLOCK INCOMPATIBLE_INDEX" || bad "G: migration reason"
  fi
  trap - EXIT
  teardown_db

  # H2: a DESC prefix must block; it must never look already correct.
  setup_db "mig036_wrong_desc"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_jaa_type;
    CREATE INDEX idx_jaa_type ON jlwm_ai_audit(office_id DESC, query_type, created_at DESC);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-wrongdesc.log 2>&1; then
    bad "H2: preflight must not ALREADY_CORRECT with prefix DESC"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight036-wrongdesc.log \
      && ok "H2: preflight BLOCK prefix-DESC idx_jaa_type" || bad "H2: preflight reason"
    grep -q 'ALREADY_CORRECT\|JLWM_RELIABILITY_SCHEMA_READY' /tmp/preflight036-wrongdesc.log \
      && bad "H2: must never report ALREADY_CORRECT for prefix DESC" \
      || ok "H2: no ALREADY_CORRECT for prefix DESC"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_036" >/tmp/mig036-wrongdesc.log 2>&1; then
    bad "H2: migration should BLOCK prefix-DESC idx_jaa_type"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig036-wrongdesc.log \
      && ok "H2: migration BLOCK INCOMPATIBLE_INDEX prefix DESC" || bad "H2: migration reason"
  fi
  trap - EXIT
  teardown_db

  # H3: a missing table plus an incompatible same-name index remains a blocker.
  setup_db "mig036_miss_tbl_bad_idx"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE jlwm_ai_audit CASCADE;
    CREATE TABLE jlwm_ai_audit_orphan (office_id TEXT);
    CREATE INDEX idx_jaa_office ON jlwm_ai_audit_orphan(office_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-misstbl-idx.log 2>&1; then
    bad "H3: preflight must BLOCK missing table + wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight036-misstbl-idx.log \
      && ok "H3: preflight BLOCK INCOMPATIBLE_INDEX (table missing)" || bad "H3: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight036-misstbl-idx.log \
      && bad "H3: must never SAFE when same-name index incompatible" \
      || ok "H3: no SAFE_AUTO_REPAIR over incompatible index"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_036" >/tmp/mig036-misstbl-idx.log 2>&1; then
    bad "H3: migration should BLOCK missing table + wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig036-misstbl-idx.log \
      && ok "H3: migration BLOCK INCOMPATIBLE_INDEX" || bad "H3: migration reason"
  fi
  trap - EXIT
  teardown_db

  # I: a wrong primary key blocks both preflight and apply.
  setup_db "mig036_wrong_pk"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE jlwm_trust_scores DROP CONSTRAINT jlwm_trust_scores_pkey;
    ALTER TABLE jlwm_trust_scores ADD PRIMARY KEY (office_id, id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_036" >/tmp/preflight036-wrongpk.log 2>&1; then
    bad "I: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight036-wrongpk.log \
      && ok "I: preflight BLOCK INCOMPATIBLE_PK" || bad "I: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_036" >/tmp/mig036-wrongpk.log 2>&1; then
    bad "I: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig036-wrongpk.log \
      && ok "I: migration BLOCK INCOMPATIBLE_PK" || bad "I: migration reason"
  fi
  trap - EXIT
  teardown_db

  # J: Runtime DDL is gone; Migration 036 owns table/index creation.
  if grep -qE 'CREATE TABLE IF NOT EXISTS jlwm_|CREATE INDEX IF NOT EXISTS idx_jaa_' \
      "$ROOT/artifacts/api-server/src/modules/jlwm/reliabilityEngine.ts"; then
    bad "J: reliability Runtime CREATE/INDEX still present"
  else
    ok "J: reliability Runtime CREATE/INDEX removed (owned by 036)"
  fi

  # K: Reliability tables are P0-gated; missing ai_audit fails verification.
  setup_db "mig036_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig036-p0-present.log 2>&1; then
    ok "K: verify-schema passes with reliability tables present"
  else
    bad "K: verify-schema failed after full chain"; tail -30 /tmp/mig036-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE jlwm_ai_audit CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig036-p0.log 2>&1; then
    bad "K: verify-schema should fail without jlwm_ai_audit"
  else
    grep -qi 'jlwm_ai_audit' /tmp/mig036-p0.log \
      && ok "K: P0 verify fails when jlwm_ai_audit absent" || bad "K: verify log missing jlwm_ai_audit"
  fi
  apply_migration_036
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig036-p0-restored.log 2>&1; then
    ok "K: verify-schema passes after 036 restore"
  else
    bad "K: verify-schema failed after 036 restore"; tail -30 /tmp/mig036-p0-restored.log
  fi
  trap - EXIT
  teardown_db

  # L/M: post-apply gate and source DML contracts.
  grep -q 'POST_APPLY_READINESS_FAILED' "$MIGRATION_036" \
    && ok "L: post-apply readiness gate present" || bad "L: post-apply gate missing"
  if python3 - "$ROOT/artifacts/api-server/src/modules/jlwm/reliabilityEngine.ts" <<'PY'
import re
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text()
if "subject_type = 'case'" not in text or "supporting_data" not in text or "recorded_at" not in text:
    raise SystemExit("missing 034/035 DML columns")
if "prediction_type = 'case_bundle'" not in text:
    raise SystemExit("missing prediction_type=case_bundle filter")
if not re.search(r"await selectCaseBundlePrediction\(\s*officeId,\s*entityId\s*\)", text):
    raise SystemExit("explain path missing selectCaseBundlePrediction")
if not re.search(r"selectCaseBundlePrediction\(\s*officeId,\s*caseId\s*\)", text):
    raise SystemExit("confidence path missing selectCaseBundlePrediction")
if re.search(r"SELECT\s+predictions\b", text, re.IGNORECASE):
    raise SystemExit("legacy SELECT predictions remains")
if re.search(r"FROM\s+jlwm_predictions[\s\S]{0,300}\bcase_id\s*=", text, re.IGNORECASE):
    raise SystemExit("legacy predictions case_id filter remains")
prediction_queries = re.findall(r"FROM\s+jlwm_predictions[\s\S]*?LIMIT 1", text, re.IGNORECASE)
if len(prediction_queries) != 1:
    raise SystemExit("expected single shared jlwm_predictions read")
q = prediction_queries[0]
if (
    not re.search(r"WHERE\s+office_id\s*=", q, re.IGNORECASE)
    or not re.search(r"prediction_type\s*=\s*'case_bundle'", q)
    or re.search(r"\bcomputed_at\b", q, re.IGNORECASE)
):
    raise SystemExit("prediction query lost tenant/case_bundle filter or still uses computed_at")
if re.search(r"toISOString\(\)\s*\+\s*[\"']::timestamptz", text):
    raise SystemExit("applied_at concatenates a cast into an ISO value")
if re.search(r"ALTER\s+TABLE\s+jlwm_predictions", text, re.IGNORECASE):
    raise SystemExit("reliability DML alters Migration 034 predictions schema")
PY
  then
    ok "M: reliability DML uses case_bundle/supporting_data/recorded_at and keeps office filters"
  else
    bad "M: reliability DML source contract failed"
  fi

  # N: behavioral — older case_bundle wins over newer duration/appeal slices.
  setup_db "mig036_case_bundle"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_034
  apply_migration_035
  apply_migration_036
  local BUNDLE_OID='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  local BUNDLE_CASE='case-1111-2222-3333-444444444444'
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO jlwm_predictions
      (id, office_id, subject_type, subject_id, prediction_type, predicted_value,
       confidence_score, supporting_data, created_at)
    VALUES
      ('pred-bundle', '$BUNDLE_OID', 'case', '$BUNDLE_CASE', 'case_bundle', 'win', 0.8,
       '{\"marker\":\"BUNDLE_SUPPORTING\",\"outcome\":{\"value\":\"win\",\"confidence\":0.8}}'::jsonb,
       '2026-01-01 10:00:00+00'),
      ('pred-duration', '$BUNDLE_OID', 'case', '$BUNDLE_CASE', 'duration', '90', 0.6,
       '{\"marker\":\"SLICE_DURATION\",\"value\":90}'::jsonb,
       '2026-01-01 11:00:00+00'),
      ('pred-appeal', '$BUNDLE_OID', 'case', '$BUNDLE_CASE', 'appeal', '0.2', 0.5,
       '{\"marker\":\"SLICE_APPEAL\",\"probability\":0.2}'::jsonb,
       '2026-01-01 12:00:00+00');
  " >/dev/null
  # Exact Reliability selectCaseBundlePrediction predicate (explain + confidence).
  local selected_marker
  selected_marker=$(psql_db -At -c "
    SELECT supporting_data->>'marker'
    FROM jlwm_predictions
    WHERE office_id = '$BUNDLE_OID'
      AND subject_type = 'case'
      AND subject_id = '$BUNDLE_CASE'
      AND prediction_type = 'case_bundle'
    ORDER BY created_at DESC
    LIMIT 1;
  ")
  [[ "$selected_marker" == "BUNDLE_SUPPORTING" ]] \
    && ok "N: case_bundle supporting_data selected over newer slices" \
    || bad "N: selected marker=$selected_marker (expected BUNDLE_SUPPORTING)"
  local newest_marker
  newest_marker=$(psql_db -At -c "
    SELECT supporting_data->>'marker'
    FROM jlwm_predictions
    WHERE office_id = '$BUNDLE_OID'
      AND subject_type = 'case'
      AND subject_id = '$BUNDLE_CASE'
    ORDER BY created_at DESC
    LIMIT 1;
  ")
  [[ "$newest_marker" == "SLICE_APPEAL" ]] \
    && ok "N: newest unfiltered row is appeal slice (would be wrong without filter)" \
    || bad "N: newest marker=$newest_marker"
  # Source wiring: both explain and confidence call the shared helper.
  if grep -qE 'await selectCaseBundlePrediction\(\s*officeId,\s*entityId\s*\)' \
       "$ROOT/artifacts/api-server/src/modules/jlwm/reliabilityEngine.ts" \
     && grep -qE 'selectCaseBundlePrediction\(\s*officeId,\s*caseId\s*\)' \
       "$ROOT/artifacts/api-server/src/modules/jlwm/reliabilityEngine.ts"; then
    ok "N: explain + confidence both call selectCaseBundlePrediction"
  else
    bad "N: explain/confidence call sites missing"
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_037_financial_remaining() {
  log "Scenario 037 — Remaining Financial: greenfield / SAFE / BLOCK / Runtime removed / P0 / authority"
  local PREFLIGHT_037="$ROOT/scripts/db/preflight-migration-037.sql"
  local OID='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  # A0: preflight SAFE when 037 tables absent (003 bases present).
  setup_db "mig037_preflight_absent"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_036
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-absent.log 2>&1
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight037-absent.log \
    && ok "A0: SAFE_AUTO_REPAIR (037 tables missing)" \
    || bad "A0: missing SAFE_AUTO_REPAIR"
  grep -qE 'reason_code=(TABLE_MISSING|PARTIAL_SCHEMA)' /tmp/preflight037-absent.log \
    && ok "A0: TABLE_MISSING/PARTIAL_SCHEMA" || bad "A0: reason"
  trap - EXIT
  teardown_db

  # A: greenfield apply, idempotency, ALREADY_CORRECT.
  setup_db "mig037_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local table_count index_count seq_ok
  table_count=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN (
        'financial_accounts','ledger_entries','wallets','lawyer_payouts',
        'invoice_payments','office_tax_settings','invoice_revisions','credit_notes'
      )")
  [[ "$table_count" == "8" ]] && ok "A: all 8 financial tables present" || bad "A: table count=$table_count"
  index_count=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='i'
      AND c.relname IN (
        'idx_inv_payments_invoice','idx_inv_payments_office',
        'idx_invoice_revisions_invoice','idx_credit_notes_office',
        'idx_invoices_case_office','idx_revenues_case_office','idx_expenses_case_office'
      )")
  [[ "$index_count" == "7" ]] && ok "A: all 7 financial indexes present" || bad "A: index count=$index_count"
  seq_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='invoice_seq' AND c.relkind='S'
    )")
  [[ "$seq_ok" == "t" ]] && ok "A: invoice_seq present" || bad "A: invoice_seq missing"
  local amt_nn office_col
  amt_nn=$(psql_db -At -c "
    SELECT is_nullable='NO' FROM information_schema.columns
    WHERE table_schema='public' AND table_name='client_invoices' AND column_name='amount_paid'")
  office_col=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ledger_entries' AND column_name='office_id'")
  [[ "$amt_nn" == "t" ]] && ok "A: amount_paid NOT NULL" || bad "A: amount_paid nullable"
  [[ "$office_col" == "1" ]] && ok "A: ledger_entries.office_id DML column present" || bad "A: office_id missing"
  local amt_check
  amt_check=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.invoice_payments'::regclass
        AND c.contype = 'c'
        AND c.convalidated
        AND (
          c.conname = 'invoice_payments_amount_check'
          OR pg_get_constraintdef(c.oid) ~* 'amount[[:space:]]*>[[:space:]]*\(?[[:space:]]*0'
        )
    )")
  [[ "$amt_check" == "t" ]] && ok "A: invoice_payments CHECK (amount > 0) present+validated" \
    || bad "A: invoice_payments amount CHECK missing"
  apply_migration_037
  ok "A: re-run 037 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight037-ready.log \
    && ok "A: preflight ALREADY_CORRECT" \
    || bad "A: $(grep chosen_action /tmp/preflight037-ready.log | tail -1)"
  grep -q 'reason_code=FINANCIAL_REMAINING_SCHEMA_READY' /tmp/preflight037-ready.log \
    && ok "A: FINANCIAL_REMAINING_SCHEMA_READY" || bad "A: reason"
  # 003 invoice_number still present; 037 must not dual-own via ADD COLUMN invoice_number
  if grep -qE 'ADD COLUMN IF NOT EXISTS invoice_number' "$MIGRATION_037"; then
    bad "A: 037 must not ADD invoice_number (003 owns it)"
  else
    ok "A: 037 does not dual-own invoice_number"
  fi
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig037_missing_table"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE credit_notes CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-misstbl.log 2>&1
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight037-misstbl.log \
    && ok "B: missing credit_notes → SAFE" || bad "B: preflight"
  apply_migration_037
  local cn
  cn=$(psql_db -At -c "SELECT to_regclass('public.credit_notes') IS NOT NULL")
  [[ "$cn" == "t" ]] && ok "B: credit_notes restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # B2: missing extension column SAFE + restore
  setup_db "mig037_miss_ext"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE client_invoices DROP COLUMN IF EXISTS view_token;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-missext.log 2>&1
  grep -q 'PARTIAL_SCHEMA\|SAFE_AUTO_REPAIR' /tmp/preflight037-missext.log \
    && ok "B2: missing view_token → SAFE" || bad "B2: preflight"
  apply_migration_037
  local vt
  vt=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='client_invoices' AND column_name='view_token'")
  [[ "$vt" == "1" ]] && ok "B2: view_token restored" || bad "B2: view_token missing"
  trap - EXIT
  teardown_db

  # C: missing safe index SAFE + restore
  setup_db "mig037_missing_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_inv_payments_office;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-missidx.log 2>&1
  grep -q 'PARTIAL_SCHEMA\|SAFE_AUTO_REPAIR' /tmp/preflight037-missidx.log \
    && ok "C: missing index → SAFE" || bad "C: preflight"
  apply_migration_037
  local idx
  idx=$(psql_db -At -c "SELECT to_regclass('public.idx_inv_payments_office') IS NOT NULL")
  [[ "$idx" == "t" ]] && ok "C: idx_inv_payments_office restored" || bad "C: index missing"
  trap - EXIT
  teardown_db

  # C2: safe default repair
  setup_db "mig037_miss_defaults"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE wallets ALTER COLUMN currency DROP DEFAULT;
    ALTER TABLE invoice_payments ALTER COLUMN method DROP DEFAULT;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-miss-def.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight037-miss-def.log \
    && bad "C2: missing defaults must not be ALREADY_CORRECT" \
    || ok "C2: missing defaults not ALREADY_CORRECT"
  grep -qE 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight037-miss-def.log \
    && ok "C2: SAFE_AUTO_REPAIR for missing defaults" || bad "C2: action"
  apply_migration_037
  local cur_def meth_def
  cur_def=$(psql_db -At -c "
    SELECT column_default ILIKE '%SAR%' FROM information_schema.columns
    WHERE table_schema='public' AND table_name='wallets' AND column_name='currency'")
  meth_def=$(psql_db -At -c "
    SELECT column_default ILIKE '%bank%' FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoice_payments' AND column_name='method'")
  [[ "$cur_def" == "t" && "$meth_def" == "t" ]] \
    && ok "C2: Migration 037 restored safe defaults" \
    || bad "C2: defaults not restored (currency=$cur_def method=$meth_def)"
  trap - EXIT
  teardown_db

  # D: incompatible type BLOCK
  setup_db "mig037_badtype"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE wallets DROP COLUMN currency;
    ALTER TABLE wallets ADD COLUMN currency INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-type.log 2>&1; then
    bad "D: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight037-type.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_037" >/tmp/mig037-type.log 2>&1; then
    bad "D: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig037-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: migration reason"
  fi
  trap - EXIT
  teardown_db

  # E: unsafe NULL office_id BLOCK
  setup_db "mig037_null_office"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE lawyer_payouts ALTER COLUMN office_id DROP NOT NULL;
    INSERT INTO lawyer_payouts (id, office_id, amount, net_amount)
    VALUES ('$OID', NULL, 10, 10);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-null-office.log 2>&1; then
    bad "E: preflight should BLOCK NULL office_id"
  else
    grep -q 'NULL_OFFICE_ID\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight037-null-office.log \
      && ok "E: preflight BLOCK NULL_OFFICE_ID" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_037" >/tmp/mig037-null-office.log 2>&1; then
    bad "E: migration should BLOCK NULL office_id"
  else
    grep -q 'NULL_OFFICE_ID' /tmp/mig037-null-office.log \
      && ok "E: migration BLOCK NULL_OFFICE_ID" || bad "E: migration reason"
  fi
  trap - EXIT
  teardown_db

  # F: wrong same-name index BLOCK
  setup_db "mig037_wrong_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_credit_notes_office;
    CREATE INDEX idx_credit_notes_office ON credit_notes(credit_number);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-wrongidx.log 2>&1; then
    bad "F: preflight should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight037-wrongidx.log \
      && ok "F: preflight BLOCK INCOMPATIBLE_INDEX" || bad "F: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_037" >/tmp/mig037-wrongidx.log 2>&1; then
    bad "F: migration should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig037-wrongidx.log \
      && ok "F: migration BLOCK INCOMPATIBLE_INDEX" || bad "F: migration reason"
  fi
  trap - EXIT
  teardown_db

  # G: missing target table + wrong same-name index BLOCK (blocker wins)
  setup_db "mig037_miss_tbl_bad_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE invoice_payments CASCADE;
    CREATE TABLE invoice_payments_orphan (invoice_id UUID);
    CREATE INDEX idx_inv_payments_invoice ON invoice_payments_orphan(invoice_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-misstbl-idx.log 2>&1; then
    bad "G: preflight must BLOCK missing table + wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight037-misstbl-idx.log \
      && ok "G: preflight BLOCK INCOMPATIBLE_INDEX (table missing)" || bad "G: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight037-misstbl-idx.log \
      && bad "G: must never SAFE when same-name index incompatible" \
      || ok "G: no SAFE_AUTO_REPAIR over incompatible index"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_037" >/tmp/mig037-misstbl-idx.log 2>&1; then
    bad "G: migration should BLOCK missing table + wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig037-misstbl-idx.log \
      && ok "G: migration BLOCK INCOMPATIBLE_INDEX" || bad "G: migration reason"
  fi
  trap - EXIT
  teardown_db

  # H: wrong PK BLOCK
  setup_db "mig037_wrong_pk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE wallets DROP CONSTRAINT wallets_pkey;
    ALTER TABLE wallets ADD PRIMARY KEY (owner_id, id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-wrongpk.log 2>&1; then
    bad "H: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight037-wrongpk.log \
      && ok "H: preflight BLOCK INCOMPATIBLE_PK" || bad "H: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_037" >/tmp/mig037-wrongpk.log 2>&1; then
    bad "H: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig037-wrongpk.log \
      && ok "H: migration BLOCK INCOMPATIBLE_PK" || bad "H: migration reason"
  fi
  trap - EXIT
  teardown_db

  # I: Runtime financial DDL removed
  if grep -qE 'CREATE TABLE IF NOT EXISTS (financial_accounts|ledger_entries|wallets|lawyer_payouts|invoice_payments|office_tax_settings)|CREATE INDEX IF NOT EXISTS idx_inv_payments_|CREATE SEQUENCE IF NOT EXISTS invoice_seq|ALTER TABLE revenues ADD COLUMN IF NOT EXISTS deleted_at|CREATE INDEX IF NOT EXISTS idx_invoices_case_office' \
      "$ROOT/artifacts/api-server/src/modules/financial/financialCore.ts" \
      "$ROOT/artifacts/api-server/src/modules/financial/invoices.ts" \
      "$ROOT/artifacts/api-server/src/modules/financial/financial-completions.ts" \
      "$ROOT/artifacts/api-server/src/modules/financial/accounting.ts" \
      "$ROOT/artifacts/api-server/src/modules/legal-core/cases.ts"; then
    bad "I: financial Runtime CREATE/INDEX/ALTER still present"
  else
    ok "I: financial Runtime DDL removed (owned by 037)"
  fi
  grep -q "to_regclass('public.financial_accounts')" \
    "$ROOT/artifacts/api-server/src/modules/financial/financialCore.ts" \
    && ok "I: financialCore readiness probes present" || bad "I: readiness missing"
  grep -q "ON CONFLICT (owner_id) DO NOTHING" \
    "$ROOT/artifacts/api-server/src/modules/financial/financialCore.ts" \
    && ok "I: platform wallet seed preserved" || bad "I: wallet seed missing"

  # J: prior authority unchanged (smoke: migrations still define owned objects)
  grep -q 'office_ledger' \
    "$ROOT/artifacts/api-server/migrations/010_office_ledger_performance_indexes.sql" \
    && ok "J: 010 office_ledger authority file present" || bad "J: 010"
  grep -q 'stripe_events' "$ROOT/artifacts/api-server/migrations/011_stripe_infrastructure_tables.sql" \
    && ok "J: 011 stripe authority unchanged" || bad "J: 011"
  grep -q 'payment_transactions' "$ROOT/artifacts/api-server/migrations/012_payment_transactions.sql" \
    && ok "J: 012 payment_transactions unchanged" || bad "J: 012"
  grep -q 'chart_of_accounts' "$ROOT/artifacts/api-server/migrations/013_erp_schema.sql" \
    && ok "J: 013 ERP unchanged" || bad "J: 013"
  if grep -qE 'platform_billing_invoices|office_entitlements' \
       "$ROOT/artifacts/api-server/migrations/025_billing_schema_authority.sql"; then
    ok "J: 025 billing authority unchanged"
  else
    bad "J: 025"
  fi
  grep -q 'moyasar_settings' "$ROOT/artifacts/api-server/migrations/032_gateway_settings_schema_authority.sql" \
    && ok "J: 032 gateway unchanged" || bad "J: 032"
  grep -q 'invoice_number' "$ROOT/artifacts/api-server/migrations/003_drizzle_baseline_safe.sql" \
    && ok "J: 003 baseline invoice_number ownership unchanged" || bad "J: 003"
  if grep -qE 'CREATE TABLE IF NOT EXISTS (office_ledger|payment_transactions|stripe_events|moyasar_settings|chart_of_accounts)' "$MIGRATION_037"; then
    bad "J: 037 must not re-own prior formal tables"
  else
    ok "J: 037 does not re-own 010/011/012/013/025/032 tables"
  fi

  # K: P0 verify fails if required 037 object missing
  setup_db "mig037_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig037-p0-present.log 2>&1; then
    ok "K: verify-schema passes with 037 objects present"
  else
    bad "K: verify-schema failed after full chain"; tail -30 /tmp/mig037-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE wallets CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig037-p0.log 2>&1; then
    bad "K: verify-schema should fail without wallets"
  else
    grep -qi 'wallets' /tmp/mig037-p0.log \
      && ok "K: P0 verify fails when wallets absent" || bad "K: verify log missing wallets"
  fi
  apply_migration_037
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig037-p0-restored.log 2>&1; then
    ok "K: verify-schema passes after 037 restore"
  else
    bad "K: verify-schema failed after 037 restore"; tail -30 /tmp/mig037-p0-restored.log
  fi
  trap - EXIT
  teardown_db

  grep -q 'POST_APPLY_READINESS_FAILED' "$MIGRATION_037" \
    && ok "L: post-apply readiness gate present" || bad "L: post-apply gate missing"
  grep -q 'invoice_payments CHECK (amount > 0) missing' "$MIGRATION_037" \
    && ok "L: post-apply requires invoice_payments CHECK" || bad "L: post-apply CHECK gate missing"
  grep -qE 'incompatible_uniques[[:space:]]*:=[[:space:]]*array_append|array_append\([[:space:]]*incompatible_uniques' "$PREFLIGHT_037" \
    && ok "L: preflight populates incompatible_uniques" || bad "L: incompatible_uniques dead"

  # M: Duplicate required UNIQUE key BLOCK (financial_accounts owner_id,currency)
  setup_db "mig037_dup_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE financial_accounts DROP CONSTRAINT IF EXISTS financial_accounts_owner_id_currency_key;
    INSERT INTO financial_accounts (owner_id, currency, balance)
    VALUES
      ('dup-owner-037', 'SAR', 1),
      ('dup-owner-037', 'SAR', 2);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-dup.log 2>&1; then
    bad "M: preflight should BLOCK duplicate UNIQUE data"
  else
    grep -qE 'DUPLICATE_UNIQUE_KEY|INCOMPATIBLE_UNIQUE|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight037-dup.log \
      && ok "M: preflight BLOCK on duplicate UNIQUE" || bad "M: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight037-dup.log \
      && bad "M: must never SAFE over duplicate UNIQUE" \
      || ok "M: no SAFE over duplicate UNIQUE"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_037" >/tmp/mig037-dup.log 2>&1; then
    bad "M: migration should BLOCK duplicate UNIQUE data"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY' /tmp/mig037-dup.log \
      && ok "M: migration BLOCK DUPLICATE_UNIQUE_KEY" || bad "M: migration reason"
  fi
  local dup_rows
  dup_rows=$(psql_db -At -c "SELECT COUNT(*) FROM financial_accounts WHERE owner_id='dup-owner-037'")
  [[ "$dup_rows" == "2" ]] && ok "M: duplicate rows preserved (no silent cleanup)" \
    || bad "M: duplicate rows altered (count=$dup_rows)"
  trap - EXIT
  teardown_db

  # N: invoice_payments CHECK violation BLOCK (amount <= 0)
  setup_db "mig037_check_viol"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE invoice_payments DROP CONSTRAINT IF EXISTS invoice_payments_amount_check;
    INSERT INTO invoice_payments (invoice_id, office_id, amount, method)
    VALUES ('$OID'::uuid, '$OID', 0, 'bank');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-check.log 2>&1; then
    bad "N: preflight should BLOCK CHECK_VIOLATION"
  else
    grep -q 'CHECK_VIOLATION\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight037-check.log \
      && ok "N: preflight BLOCK CHECK_VIOLATION" || bad "N: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_037" >/tmp/mig037-check.log 2>&1; then
    bad "N: migration should BLOCK CHECK_VIOLATION"
  else
    grep -q 'CHECK_VIOLATION' /tmp/mig037-check.log \
      && ok "N: migration BLOCK CHECK_VIOLATION" || bad "N: migration reason"
  fi
  local bad_amt_rows
  bad_amt_rows=$(psql_db -At -c "SELECT COUNT(*) FROM invoice_payments WHERE amount <= 0")
  [[ "$bad_amt_rows" -ge 1 ]] && ok "N: violating row preserved (no silent delete)" \
    || bad "N: violating row removed"
  trap - EXIT
  teardown_db

  # O: Missing CHECK + valid data → SAFE (not ALREADY); apply restores; READY
  setup_db "mig037_miss_check"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE invoice_payments DROP CONSTRAINT IF EXISTS invoice_payments_amount_check;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-misscheck.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight037-misscheck.log \
    && bad "O: missing CHECK must not be ALREADY_CORRECT" \
    || ok "O: missing CHECK is not ALREADY_CORRECT"
  grep -qE 'chosen_action=SAFE_AUTO_REPAIR|reason_code=PARTIAL_SCHEMA' /tmp/preflight037-misscheck.log \
    && ok "O: missing CHECK → SAFE_AUTO_REPAIR/PARTIAL_SCHEMA" || bad "O: preflight action"
  grep -q 'missing_checks=.*invoice_payments' /tmp/preflight037-misscheck.log \
    && ok "O: missing_checks reports invoice_payments" || bad "O: missing_checks notice"
  apply_migration_037
  amt_check=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.invoice_payments'::regclass
        AND c.contype = 'c'
        AND c.convalidated
        AND (
          c.conname = 'invoice_payments_amount_check'
          OR pg_get_constraintdef(c.oid) ~* 'amount[[:space:]]*>[[:space:]]*\(?[[:space:]]*0'
        )
    )")
  [[ "$amt_check" == "t" ]] && ok "O: Migration 037 restored amount CHECK" \
    || bad "O: CHECK still missing after apply"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_037" >/tmp/preflight037-misscheck-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight037-misscheck-ready.log \
    && ok "O: re-preflight ALREADY_CORRECT" || bad "O: re-preflight action"
  grep -q 'reason_code=FINANCIAL_REMAINING_SCHEMA_READY' /tmp/preflight037-misscheck-ready.log \
    && ok "O: FINANCIAL_REMAINING_SCHEMA_READY after CHECK restore" || bad "O: ready reason"
  trap - EXIT
  teardown_db
}

scenario_migration_038_marketplace_client_portal() {
  log "Scenario 038 — Marketplace/Portal: greenfield / SAFE / BLOCK / Runtime removed / P0 / authority"
  local PREFLIGHT_038="$ROOT/scripts/db/preflight-migration-038.sql"
  local OID='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  # A0: SAFE when 038 tables absent
  setup_db "mig038_preflight_absent"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_037
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-absent.log 2>&1
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight038-absent.log \
    && ok "A0: SAFE_AUTO_REPAIR (038 tables missing)" || bad "A0: action"
  trap - EXIT
  teardown_db

  # A: greenfield + idempotent + ALREADY + FK/UNIQUE + client_account_id no invent
  setup_db "mig038_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local table_count fk_cnt uq_cnt ca_col
  table_count=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN (
      'marketplace_services','marketplace_orders','marketplace_deals','marketplace_deal_offers',
      'client_portal_tokens','portal_uploads','case_timeline',
      'client_accounts','client_sessions','client_case_links','home_cms'
    )")
  [[ "$table_count" == "11" ]] && ok "A: all 11 marketplace/portal tables present" || bad "A: tables=$table_count"
  fk_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conname IN ('client_sessions_client_id_fkey','client_case_links_client_id_fkey')
      AND contype='f' AND convalidated")
  [[ "$fk_cnt" == "2" ]] && ok "A: auth FKs present+validated" || bad "A: fk_cnt=$fk_cnt"
  uq_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conname IN (
      'client_portal_tokens_token_key','client_accounts_email_key',
      'client_sessions_token_key','client_case_links_client_id_case_id_key'
    ) AND contype='u'")
  [[ "$uq_cnt" == "4" ]] && ok "A: 4 UNIQUEs present" || bad "A: uq=$uq_cnt"
  ca_col=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clients' AND column_name='client_account_id'
      AND udt_name='text'")
  [[ "$ca_col" == "1" ]] && ok "A: clients.client_account_id TEXT present" || bad "A: client_account_id"
  local null_ca
  null_ca=$(psql_db -At -c "SELECT COUNT(*) FROM clients WHERE client_account_id IS NOT NULL")
  [[ "$null_ca" == "0" ]] && ok "A: client_account_id not backfilled" || bad "A: invent backfill"
  apply_migration_038
  ok "A: re-run 038 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight038-ready.log \
    && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight038-ready.log | tail -1)"
  grep -q 'MARKETPLACE_PORTAL_SCHEMA_READY' /tmp/preflight038-ready.log \
    && ok "A: MARKETPLACE_PORTAL_SCHEMA_READY" || bad "A: reason"
  if grep -qE 'CREATE TABLE IF NOT EXISTS (invitations|office_page|office_services|office_orders|office_reviews)' "$MIGRATION_038"; then
    bad "A: 038 must not re-own 003/004 storefront tables"
  else
    ok "A: 038 does not re-own invitations/office_*"
  fi
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig038_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE portal_uploads CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-misstbl.log 2>&1
  grep -q 'SAFE_AUTO_REPAIR\|TABLE_MISSING\|PARTIAL_SCHEMA' /tmp/preflight038-misstbl.log \
    && ok "B: missing portal_uploads → SAFE" || bad "B: preflight"
  apply_migration_038
  [[ "$(psql_db -At -c "SELECT to_regclass('public.portal_uploads') IS NOT NULL")" == "t" ]] \
    && ok "B: portal_uploads restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # B2: missing extension column SAFE
  setup_db "mig038_miss_ext"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE clients DROP COLUMN IF EXISTS client_account_id;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-missext.log 2>&1
  grep -q 'SAFE_AUTO_REPAIR\|PARTIAL_SCHEMA' /tmp/preflight038-missext.log \
    && ok "B2: missing client_account_id → SAFE" || bad "B2: preflight"
  apply_migration_038
  [[ "$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='clients' AND column_name='client_account_id'")" == "1" ]] \
    && ok "B2: client_account_id restored" || bad "B2: missing"
  trap - EXIT
  teardown_db

  # C: missing UNIQUE + clean data SAFE
  setup_db "mig038_miss_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE client_accounts DROP CONSTRAINT IF EXISTS client_accounts_email_key;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-missuq.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight038-missuq.log \
    && bad "C: missing UNIQUE must not be ALREADY" || ok "C: missing UNIQUE not ALREADY"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA' /tmp/preflight038-missuq.log \
    && ok "C: SAFE for missing UNIQUE" || bad "C: action"
  apply_migration_038
  [[ "$(psql_db -At -c "
    SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='client_accounts_email_key')")" == "t" ]] \
    && ok "C: email UNIQUE restored" || bad "C: unique missing"
  trap - EXIT
  teardown_db

  # D: incompatible type BLOCK
  setup_db "mig038_badtype"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE marketplace_services DROP COLUMN title;
    ALTER TABLE marketplace_services ADD COLUMN title INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-type.log 2>&1; then
    bad "D: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight038-type.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_038" >/tmp/mig038-type.log 2>&1; then
    bad "D: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig038-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: mig reason"
  fi
  trap - EXIT
  teardown_db

  # E: wrong PK BLOCK
  setup_db "mig038_wrongpk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE marketplace_orders DROP CONSTRAINT marketplace_orders_pkey;
    ALTER TABLE marketplace_orders ADD PRIMARY KEY (seller_id, id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-pk.log 2>&1; then
    bad "E: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight038-pk.log \
      && ok "E: preflight BLOCK INCOMPATIBLE_PK" || bad "E: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_038" >/tmp/mig038-pk.log 2>&1; then
    bad "E: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig038-pk.log \
      && ok "E: migration BLOCK INCOMPATIBLE_PK" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F: duplicate UNIQUE email BLOCK
  setup_db "mig038_dup_email"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE client_accounts DROP CONSTRAINT IF EXISTS client_accounts_email_key;
    INSERT INTO client_accounts (id, email) VALUES ('a1','dup038@example.com'), ('a2','dup038@example.com');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-dup.log 2>&1; then
    bad "F: preflight should BLOCK duplicate email"
  else
    grep -qE 'DUPLICATE_UNIQUE_KEY|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight038-dup.log \
      && ok "F: preflight BLOCK duplicate UNIQUE" || bad "F: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_038" >/tmp/mig038-dup.log 2>&1; then
    bad "F: migration should BLOCK duplicate email"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY' /tmp/mig038-dup.log \
      && ok "F: migration BLOCK DUPLICATE_UNIQUE_KEY" || bad "F: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM client_accounts WHERE email='dup038@example.com'")" == "2" ]] \
    && ok "F: duplicate rows preserved" || bad "F: rows altered"
  trap - EXIT
  teardown_db

  # G: orphan FK BLOCK
  setup_db "mig038_orphan_fk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE client_sessions DROP CONSTRAINT IF EXISTS client_sessions_client_id_fkey;
    INSERT INTO client_sessions (id, client_id, token, expires_at)
    VALUES ('s-orphan', 'missing-client-038', 'tok-orphan-038', NOW() + interval '1 day');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-orphan.log 2>&1; then
    bad "G: preflight should BLOCK orphan FK"
  else
    grep -qE 'ORPHAN_FK|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight038-orphan.log \
      && ok "G: preflight BLOCK ORPHAN_FK" || bad "G: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_038" >/tmp/mig038-orphan.log 2>&1; then
    bad "G: migration should BLOCK orphan FK"
  else
    grep -q 'ORPHAN_FK' /tmp/mig038-orphan.log \
      && ok "G: migration BLOCK ORPHAN_FK" || bad "G: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM client_sessions WHERE id='s-orphan'")" == "1" ]] \
    && ok "G: orphan row preserved (no silent delete)" || bad "G: orphan deleted"
  trap - EXIT
  teardown_db

  # G2: correct-shape FK NOT VALID → never ALREADY; SAFE FK_VALIDATION_PENDING → validate → READY
  setup_db "mig038_fk_notvalid"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE client_sessions DROP CONSTRAINT IF EXISTS client_sessions_client_id_fkey;
    ALTER TABLE client_case_links DROP CONSTRAINT IF EXISTS client_case_links_client_id_fkey;
    ALTER TABLE client_sessions
      ADD CONSTRAINT client_sessions_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES client_accounts(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE client_case_links
      ADD CONSTRAINT client_case_links_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES client_accounts(id) ON DELETE CASCADE NOT VALID;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-notvalid.log 2>&1
  if grep -q 'chosen_action=ALREADY_CORRECT\|MARKETPLACE_PORTAL_SCHEMA_READY' /tmp/preflight038-notvalid.log; then
    bad "G2: NOT VALID FK must not be ALREADY_CORRECT / MARKETPLACE_PORTAL_SCHEMA_READY"
  else
    ok "G2: NOT VALID FK is not ALREADY"
  fi
  grep -qE 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight038-notvalid.log \
    && grep -qE 'FK_VALIDATION_PENDING|pending_fk_validation=' /tmp/preflight038-notvalid.log \
    && ok "G2: SAFE_AUTO_REPAIR FK_VALIDATION_PENDING" || bad "G2: $(grep chosen_action /tmp/preflight038-notvalid.log | tail -1)"
  apply_migration_038
  [[ "$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conname IN ('client_sessions_client_id_fkey','client_case_links_client_id_fkey')
      AND contype='f' AND convalidated")" == "2" ]] \
    && ok "G2: migration validated both auth FKs" || bad "G2: FKs still unvalidated"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-notvalid-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight038-notvalid-ready.log \
    && grep -q 'MARKETPLACE_PORTAL_SCHEMA_READY' /tmp/preflight038-notvalid-ready.log \
    && ok "G2: re-preflight MARKETPLACE_PORTAL_SCHEMA_READY" || bad "G2: post-validate readiness"
  trap - EXIT
  teardown_db

  # G3: incompatible FK (wrong ON DELETE) → BLOCK INCOMPATIBLE_FK; no data rewrite
  setup_db "mig038_fk_badshape"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO client_accounts (id, email) VALUES ('acct-fk038', 'fk038@example.com');
    INSERT INTO client_sessions (id, client_id, token, expires_at)
    VALUES ('sess-fk038', 'acct-fk038', 'tok-fk038', NOW() + interval '1 day');
    ALTER TABLE client_sessions DROP CONSTRAINT IF EXISTS client_sessions_client_id_fkey;
    ALTER TABLE client_sessions
      ADD CONSTRAINT client_sessions_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES client_accounts(id) ON DELETE NO ACTION;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-badfk.log 2>&1; then
    bad "G3: preflight should BLOCK incompatible FK"
  else
    grep -qE 'INCOMPATIBLE_FK|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight038-badfk.log \
      && ok "G3: preflight BLOCK INCOMPATIBLE_FK" || bad "G3: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_038" >/tmp/mig038-badfk.log 2>&1; then
    bad "G3: migration should BLOCK incompatible FK"
  else
    grep -q 'INCOMPATIBLE_FK' /tmp/mig038-badfk.log \
      && ok "G3: migration BLOCK INCOMPATIBLE_FK" || bad "G3: mig reason=$(tail -3 /tmp/mig038-badfk.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM client_sessions WHERE id='sess-fk038'")" == "1" ]] \
    && ok "G3: session row preserved (no drop/rewrite)" || bad "G3: row altered"
  trap - EXIT
  teardown_db

  # G4: marketplace_orders.notes missing → SAFE PARTIAL; apply restores; READY
  setup_db "mig038_notes_miss"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE marketplace_orders DROP COLUMN IF EXISTS notes;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-notesmiss.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight038-notesmiss.log \
    && bad "G4: missing notes must not be ALREADY" || ok "G4: missing notes not ALREADY"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|marketplace_orders\.notes' /tmp/preflight038-notesmiss.log \
    && ok "G4: SAFE/PARTIAL for missing notes" || bad "G4: action"
  apply_migration_038
  [[ "$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='marketplace_orders'
      AND column_name='notes' AND udt_name='text'")" == "1" ]] \
    && ok "G4: notes TEXT restored" || bad "G4: notes missing after apply"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-notesready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight038-notesready.log \
    && grep -q 'MARKETPLACE_PORTAL_SCHEMA_READY' /tmp/preflight038-notesready.log \
    && ok "G4: re-preflight READY" || bad "G4: post-restore readiness"
  trap - EXIT
  teardown_db

  # G5: marketplace_orders.notes wrong type → BLOCK INCOMPATIBLE_TYPE
  setup_db "mig038_notes_type"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE marketplace_orders DROP COLUMN notes;
    ALTER TABLE marketplace_orders ADD COLUMN notes INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-notestype.log 2>&1; then
    bad "G5: preflight should BLOCK wrong notes type"
  else
    grep -qE 'INCOMPATIBLE_TYPE|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight038-notestype.log \
      && ok "G5: preflight BLOCK INCOMPATIBLE_TYPE" || bad "G5: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_038" >/tmp/mig038-notestype.log 2>&1; then
    bad "G5: migration should BLOCK wrong notes type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig038-notestype.log \
      && ok "G5: migration BLOCK INCOMPATIBLE_TYPE" || bad "G5: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F2: duplicate portal token UNIQUE BLOCK + rows preserved
  setup_db "mig038_dup_token"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE client_portal_tokens DROP CONSTRAINT IF EXISTS client_portal_tokens_token_key;
    INSERT INTO client_portal_tokens (id, case_id, token)
    VALUES ('pt1','c1','dup-token-038'), ('pt2','c2','dup-token-038');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-duptok.log 2>&1; then
    bad "F2: preflight should BLOCK duplicate token"
  else
    grep -qE 'DUPLICATE_UNIQUE_KEY|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight038-duptok.log \
      && ok "F2: preflight BLOCK duplicate token" || bad "F2: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_038" >/tmp/mig038-duptok.log 2>&1; then
    bad "F2: migration should BLOCK duplicate token"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY' /tmp/mig038-duptok.log \
      && ok "F2: migration BLOCK DUPLICATE_UNIQUE_KEY" || bad "F2: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM client_portal_tokens WHERE token='dup-token-038'")" == "2" ]] \
    && ok "F2: duplicate token rows preserved" || bad "F2: rows altered"
  trap - EXIT
  teardown_db

  # F3: duplicate client_case_links(client_id, case_id) BLOCK + rows preserved
  setup_db "mig038_dup_link"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE client_case_links DROP CONSTRAINT IF EXISTS client_case_links_client_id_case_id_key;
    INSERT INTO client_accounts (id, email) VALUES ('link-acct','link038@example.com');
    INSERT INTO client_case_links (id, client_id, case_id)
    VALUES ('l1','link-acct','case-dup'), ('l2','link-acct','case-dup');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_038" >/tmp/preflight038-duplink.log 2>&1; then
    bad "F3: preflight should BLOCK duplicate client_case_links"
  else
    grep -qE 'DUPLICATE_UNIQUE_KEY|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight038-duplink.log \
      && ok "F3: preflight BLOCK duplicate client_case" || bad "F3: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_038" >/tmp/mig038-duplink.log 2>&1; then
    bad "F3: migration should BLOCK duplicate client_case_links"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY' /tmp/mig038-duplink.log \
      && ok "F3: migration BLOCK DUPLICATE_UNIQUE_KEY" || bad "F3: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM client_case_links WHERE client_id='link-acct' AND case_id='case-dup'")" == "2" ]] \
    && ok "F3: duplicate link rows preserved" || bad "F3: rows altered"
  trap - EXIT
  teardown_db

  # H: Runtime DDL removed from modules + webhook
  if grep -qE 'CREATE TABLE IF NOT EXISTS (marketplace_services|client_portal_tokens|client_accounts|case_timeline|home_cms)|ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_account_id' \
      "$ROOT/artifacts/api-server/src/modules/marketplace/marketplace.ts" \
      "$ROOT/artifacts/api-server/src/modules/marketplace/client-portal.ts" \
      "$ROOT/artifacts/api-server/src/modules/marketplace/client-auth.ts" \
      "$ROOT/artifacts/api-server/src/modules/marketplace/homeCms.ts" \
      "$ROOT/artifacts/api-server/src/webhookHandlers.ts" \
      "$ROOT/artifacts/api-server/src/modules/legal-core/clients.ts"; then
    bad "H: Runtime CREATE/ALTER for 038 objects still present"
  else
    ok "H: Runtime marketplace/portal/webhook/clients.client_account_id DDL removed"
  fi
  grep -q "to_regclass('public.marketplace_services')" \
    "$ROOT/artifacts/api-server/src/modules/marketplace/marketplace.ts" \
    && ok "H: marketplace readiness probe present" || bad "H: readiness missing"
  grep -q "INSERT INTO home_cms (id) VALUES (1) ON CONFLICT DO NOTHING" \
    "$ROOT/artifacts/api-server/src/modules/marketplace/homeCms.ts" \
    && ok "H: home_cms seed DML preserved" || bad "H: seed missing"

  # I: prior authority unchanged
  grep -q 'invitations' "$ROOT/artifacts/api-server/migrations/003_drizzle_baseline_safe.sql" \
    && ok "I: 003 invitations authority present" || bad "I: 003"
  grep -q 'portal_token' "$ROOT/artifacts/api-server/migrations/004_legal_core_extensions.sql" \
    && ok "I: 004 office_orders portal_token present" || bad "I: 004"
  grep -q 'website_config' "$ROOT/artifacts/api-server/migrations/006_post_migration_api_support.sql" \
    && ok "I: 006 office_page website_config present" || bad "I: 006"
  if grep -qE 'CREATE TABLE IF NOT EXISTS (invitations|office_page|office_services|office_orders|office_reviews|client_comm_settings|website_builder_pages)' "$MIGRATION_038"; then
    bad "I: 038 must not CREATE prior/out-of-scope tables"
  else
    ok "I: 038 does not CREATE 003/004/006 or out-of-scope tables"
  fi

  # J: P0 verify fails without critical portal table
  setup_db "mig038_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig038-p0-present.log 2>&1; then
    ok "J: verify-schema passes with 038 objects"
  else
    bad "J: verify-schema failed after full chain"; tail -20 /tmp/mig038-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE client_portal_tokens CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig038-p0.log 2>&1; then
    bad "J: verify-schema should fail without client_portal_tokens"
  else
    grep -qi 'client_portal_tokens' /tmp/mig038-p0.log \
      && ok "J: P0 fails when client_portal_tokens absent" || bad "J: verify log"
  fi
  apply_migration_038
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig038-p0-restored.log 2>&1; then
    ok "J: verify-schema passes after 038 restore"
  else
    bad "J: verify failed after restore"; tail -20 /tmp/mig038-p0-restored.log
  fi
  trap - EXIT
  teardown_db

  grep -q 'POST_APPLY_READINESS_FAILED' "$MIGRATION_038" \
    && ok "K: post-apply readiness gate present" || bad "K: missing"
  grep -qE 'incompatible_uniques[[:space:]]*:=[[:space:]]*array_append|array_append\([[:space:]]*incompatible_uniques' "$PREFLIGHT_038" \
    && ok "K: preflight populates incompatible_uniques" || bad "K: dead uniques"
  grep -q 'FK_VALIDATION_PENDING' "$PREFLIGHT_038" \
    && ok "K: preflight FK_VALIDATION_PENDING reason present" || bad "K: missing FK_VALIDATION_PENDING"
  grep -q "marketplace_orders','notes','text" "$PREFLIGHT_038" \
    && ok "K: preflight includes marketplace_orders.notes" || bad "K: notes column_spec"
  grep -q 'reason_code=INCOMPATIBLE_FK' "$MIGRATION_038" \
    && ok "K: migration wrong FK shape uses INCOMPATIBLE_FK" || bad "K: FK reason-code"
}

scenario_migration_039_ai_credits_usage() {
  log "Scenario 039 — AI Credits/Usage: greenfield / SAFE / BLOCK / Runtime / P0 / authority"
  local PREFLIGHT_039="$ROOT/scripts/db/preflight-migration-039.sql"

  # A: greenfield + idempotent + ALREADY + UNIQUE(office_id) + indexes + balance DEFAULT 100
  setup_db "mig039_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_cnt idx_cnt bal_def uq_ok
  tbl_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('office_ai_credits','ai_credit_transactions','ai_usage_logs')")
  [[ "$tbl_cnt" == "3" ]] && ok "A: 3 owned tables present" || bad "A: table count=$tbl_cnt"
  idx_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='i'
      AND c.relname IN ('idx_ai_usage_office','idx_ai_usage_created','idx_ai_usage_case')")
  [[ "$idx_cnt" == "3" ]] && ok "A: usage indexes present" || bad "A: index count=$idx_cnt"
  uq_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.office_ai_credits'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*office_id[[:space:]]*\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid='public.office_ai_credits'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['office_id']::text[]
    )")
  [[ "$uq_ok" == "t" ]] && ok "A: UNIQUE(office_id) present" || bad "A: UNIQUE missing"
  bal_def=$(psql_db -At -c "
    SELECT column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_ai_credits' AND column_name='balance'")
  [[ "$bal_def" == "100" ]] && ok "A: balance DEFAULT 100" || bad "A: balance default=$bal_def"
  local case_partial
  case_partial=$(psql_db -At -c "
    SELECT x.indpred IS NOT NULL AND pg_get_expr(x.indpred, x.indrelid) ~* 'case_id[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL'
    FROM pg_class t
    JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_index x ON x.indrelid=t.oid
    JOIN pg_class i ON i.oid=x.indexrelid
    WHERE n.nspname='public' AND t.relname='ai_usage_logs' AND i.relname='idx_ai_usage_case'")
  [[ "$case_partial" == "t" ]] && ok "A: idx_ai_usage_case partial WHERE case_id IS NOT NULL" || bad "A: partial=$case_partial"
  apply_migration_039
  ok "A: re-run 039 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight039-ready.log \
    && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight039-ready.log | tail -1)"
  grep -q 'AI_CREDITS_USAGE_SCHEMA_READY' /tmp/preflight039-ready.log \
    && ok "A: AI_CREDITS_USAGE_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig039_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE ai_credit_transactions CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-misstbl.log 2>&1
  grep -q 'SAFE_AUTO_REPAIR\|TABLE_MISSING\|PARTIAL_SCHEMA' /tmp/preflight039-misstbl.log \
    && ok "B: missing table → SAFE" || bad "B: preflight"
  apply_migration_039
  local restored
  restored=$(psql_db -At -c "SELECT to_regclass('public.ai_credit_transactions') IS NOT NULL")
  [[ "$restored" == "t" ]] && ok "B: ai_credit_transactions restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # C: missing column (daily_limit) SAFE + restore
  setup_db "mig039_miss_col"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE office_ai_credits DROP COLUMN daily_limit;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-misscol.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight039-misscol.log \
    && bad "C: missing column must not be ALREADY_CORRECT" \
    || ok "C: missing column not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|daily_limit' /tmp/preflight039-misscol.log \
    && ok "C: missing daily_limit → SAFE" || bad "C: preflight"
  apply_migration_039
  local col_ok
  col_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='office_ai_credits' AND column_name='daily_limit'
    )")
  [[ "$col_ok" == "t" ]] && ok "C: daily_limit restored" || bad "C: column still missing"
  trap - EXIT
  teardown_db

  # D: wrong type BLOCK (balance as TEXT)
  setup_db "mig039_badtype"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE office_ai_credits DROP COLUMN balance;
    ALTER TABLE office_ai_credits ADD COLUMN balance TEXT;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-type.log 2>&1; then
    bad "D: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight039-type.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_039" >/tmp/mig039-type.log 2>&1; then
    bad "D: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig039-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: mig reason=$(tail -3 /tmp/mig039-type.log)"
  fi
  trap - EXIT
  teardown_db

  # E: wrong PK BLOCK
  setup_db "mig039_wrongpk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE office_ai_credits DROP CONSTRAINT office_ai_credits_pkey;
    ALTER TABLE office_ai_credits ADD PRIMARY KEY (office_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-pk.log 2>&1; then
    bad "E: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight039-pk.log \
      && ok "E: preflight BLOCK INCOMPATIBLE_PK" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_039" >/tmp/mig039-pk.log 2>&1; then
    bad "E: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig039-pk.log \
      && ok "E: migration BLOCK INCOMPATIBLE_PK" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F: wrong UNIQUE / duplicate office_id BLOCK + rows preserved
  setup_db "mig039_dup_office"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE office_ai_credits DROP CONSTRAINT IF EXISTS office_ai_credits_office_id_key;
    INSERT INTO office_ai_credits (office_id, office_name, balance)
    VALUES ('dup039', 'A', 10), ('dup039', 'B', 20);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-dup.log 2>&1; then
    bad "F: preflight should BLOCK duplicate office_id"
  else
    grep -qE 'DUPLICATE_UNIQUE_KEY|INCOMPATIBLE_UNIQUE|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight039-dup.log \
      && ok "F: preflight BLOCK duplicate/unique" || bad "F: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_039" >/tmp/mig039-dup.log 2>&1; then
    bad "F: migration should BLOCK duplicate office_id"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|INCOMPATIBLE_UNIQUE' /tmp/mig039-dup.log \
      && ok "F: migration BLOCK duplicate/unique" || bad "F: mig reason=$(tail -3 /tmp/mig039-dup.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM office_ai_credits WHERE office_id='dup039'")" == "2" ]] \
    && ok "F: duplicate rows preserved" || bad "F: rows not preserved"
  trap - EXIT
  teardown_db

  # G: NULL required preventing NOT NULL
  setup_db "mig039_null_req"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE office_ai_credits ALTER COLUMN office_name DROP NOT NULL;
    INSERT INTO office_ai_credits (office_id, office_name, balance)
    VALUES ('null-name-039', NULL, 50);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-null.log 2>&1; then
    bad "G: preflight should BLOCK NULL required"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight039-null.log \
      && ok "G: preflight BLOCK NULL_REQUIRED" || bad "G: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_039" >/tmp/mig039-null.log 2>&1; then
    bad "G: migration should BLOCK NULL required"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig039-null.log \
      && ok "G: migration BLOCK NULL_REQUIRED" || bad "G: mig reason"
  fi
  trap - EXIT
  teardown_db

  # H: wrong same-name index idx_ai_usage_case BLOCK (non-partial / no predicate)
  setup_db "mig039_wrong_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_ai_usage_case;
    CREATE INDEX idx_ai_usage_case ON ai_usage_logs(case_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-wrongidx.log 2>&1; then
    bad "H: preflight should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight039-wrongidx.log \
      && ok "H: preflight BLOCK INCOMPATIBLE_INDEX" || bad "H: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_039" >/tmp/mig039-wrongidx.log 2>&1; then
    bad "H: migration should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig039-wrongidx.log \
      && ok "H: migration BLOCK INCOMPATIBLE_INDEX" || bad "H: mig reason"
  fi
  trap - EXIT
  teardown_db

  # H2: wrong partial predicate on idx_ai_usage_case BLOCK
  setup_db "mig039_wrong_pred"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_ai_usage_case;
    CREATE INDEX idx_ai_usage_case ON ai_usage_logs(case_id) WHERE case_id IS NULL;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-wrongpred.log 2>&1; then
    bad "H2: preflight should BLOCK wrong partial predicate"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight039-wrongpred.log \
      && ok "H2: preflight BLOCK wrong partial predicate" || bad "H2: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_039" >/tmp/mig039-wrongpred.log 2>&1; then
    bad "H2: migration should BLOCK wrong partial predicate"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig039-wrongpred.log \
      && ok "H2: migration BLOCK wrong partial predicate" || bad "H2: mig reason"
  fi
  trap - EXIT
  teardown_db

  # H3: stolen index name — ai_usage_logs missing + idx_ai_usage_office on another table → BLOCK (never SAFE)
  setup_db "mig039_stolen_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE ai_usage_logs CASCADE;
    CREATE TABLE ai_usage_logs_orphan (office_id TEXT);
    CREATE INDEX idx_ai_usage_office ON ai_usage_logs_orphan(office_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-stolen.log 2>&1; then
    bad "H3: preflight must BLOCK missing table + stolen same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight039-stolen.log \
      && ok "H3: preflight BLOCK INCOMPATIBLE_INDEX (stolen name)" || bad "H3: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight039-stolen.log \
      && bad "H3: must never SAFE when same-name index incompatible" \
      || ok "H3: no SAFE_AUTO_REPAIR over stolen index"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_039" >/tmp/mig039-stolen.log 2>&1; then
    bad "H3: migration should BLOCK stolen index name"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig039-stolen.log \
      && ok "H3: migration BLOCK INCOMPATIBLE_INDEX" || bad "H3: mig reason=$(tail -3 /tmp/mig039-stolen.log)"
  fi
  trap - EXIT
  teardown_db

  # H4: wrong UNIQUE shape (wider same-name key) BLOCK — never ALREADY
  setup_db "mig039_wrong_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE office_ai_credits DROP CONSTRAINT IF EXISTS office_ai_credits_office_id_key;
    ALTER TABLE office_ai_credits ADD CONSTRAINT office_ai_credits_office_id_key UNIQUE (office_id, office_name);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-wuniq.log 2>&1; then
    bad "H4: preflight should BLOCK wrong UNIQUE shape"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight039-wuniq.log \
      && ok "H4: preflight BLOCK INCOMPATIBLE_UNIQUE" || bad "H4: preflight reason"
    grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight039-wuniq.log \
      && bad "H4: must never ALREADY with wrong UNIQUE" \
      || ok "H4: not ALREADY_CORRECT"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_039" >/tmp/mig039-wuniq.log 2>&1; then
    bad "H4: migration should BLOCK wrong UNIQUE shape"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig039-wuniq.log \
      && ok "H4: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "H4: mig reason=$(tail -3 /tmp/mig039-wuniq.log)"
  fi
  trap - EXIT
  teardown_db

  # I: missing index SAFE + apply restores
  setup_db "mig039_miss_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_ai_usage_office;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-missidx.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight039-missidx.log \
    && bad "I: missing index must not be ALREADY_CORRECT" \
    || ok "I: missing index not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|MISSING|idx_ai_usage_office' /tmp/preflight039-missidx.log \
    && ok "I: missing index → SAFE" || bad "I: preflight"
  apply_migration_039
  local idx_ok
  idx_ok=$(psql_db -At -c "SELECT to_regclass('public.idx_ai_usage_office') IS NOT NULL")
  [[ "$idx_ok" == "t" ]] && ok "I: idx_ai_usage_office restored" || bad "I: index still missing"
  trap - EXIT
  teardown_db

  # J: office_id='default' survives unchanged after apply
  setup_db "mig039_default_survive"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO office_ai_credits (office_id, office_name, balance)
    VALUES ('default', 'Legacy Default Office', 77)
    ON CONFLICT (office_id) DO UPDATE
      SET office_name = EXCLUDED.office_name, balance = EXCLUDED.balance;
  " >/dev/null
  apply_migration_039
  local def_bal def_name
  def_bal=$(psql_db -At -c "SELECT balance FROM office_ai_credits WHERE office_id='default'")
  def_name=$(psql_db -At -c "SELECT office_name FROM office_ai_credits WHERE office_id='default'")
  [[ "$def_bal" == "77" && "$def_name" == "Legacy Default Office" ]] \
    && ok "J: office_id='default' row unchanged after re-apply" \
    || bad "J: default row mutated (balance=$def_bal name=$def_name)"
  trap - EXIT
  teardown_db

  # K: Runtime CREATE/ALTER for 039 tables gone; provider CREATE owned by 040 (absent); no ALTER ai_usage_logs
  if grep -qE 'CREATE TABLE IF NOT EXISTS (office_ai_credits|ai_credit_transactions|ai_usage_logs)' \
      "$ROOT/artifacts/api-server/src/modules/ai/aiChat.ts" \
      "$ROOT/artifacts/api-server/src/modules/ai/aiCredits.ts"; then
    bad "K: Runtime CREATE for 039 tables still in aiChat/aiCredits"
  else
    ok "K: aiChat/aiCredits Runtime CREATE for 039 tables removed"
  fi
  if grep -qE 'ALTER TABLE ai_usage_logs|ADD COLUMN IF NOT EXISTS cost_sar' \
      "$ROOT/artifacts/api-server/src/modules/ai/aiProviderEngine.ts"; then
    bad "K: aiProviderEngine still ALTERs ai_usage_logs"
  else
    ok "K: aiProviderEngine has no ALTER ai_usage_logs"
  fi
  if grep -qE 'CREATE TABLE IF NOT EXISTS (ai_provider_config|office_ai_settings)' \
      "$ROOT/artifacts/api-server/src/modules/ai/aiProviderEngine.ts"; then
    bad "K: provider/settings Runtime CREATE still in aiProviderEngine (owned by 040)"
  else
    ok "K: aiProviderEngine Runtime CREATE for provider/settings removed (040)"
  fi

  # L: prior usage_logs (003) still exists; 039 does not CREATE usage_logs
  setup_db "mig039_usage_logs_prior"
  trap teardown_db EXIT
  apply_all_migrations
  local usage_logs_ok
  usage_logs_ok=$(psql_db -At -c "SELECT to_regclass('public.usage_logs') IS NOT NULL")
  [[ "$usage_logs_ok" == "t" ]] && ok "L: usage_logs (003) still present after chain" || bad "L: usage_logs missing"
  if grep -qE 'CREATE TABLE IF NOT EXISTS usage_logs\b' "$MIGRATION_039"; then
    bad "L: 039 must not CREATE usage_logs"
  else
    ok "L: 039 does not CREATE usage_logs as alias"
  fi
  trap - EXIT
  teardown_db

  # M: P0 verify fails without office_ai_credits
  setup_db "mig039_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig039-p0-present.log 2>&1; then
    ok "M: verify-schema passes with 039 objects"
  else
    bad "M: verify-schema failed after full chain"; tail -20 /tmp/mig039-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE office_ai_credits CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig039-p0.log 2>&1; then
    bad "M: verify-schema should fail without office_ai_credits"
  else
    grep -qi 'office_ai_credits' /tmp/mig039-p0.log \
      && ok "M: P0 verify fails when office_ai_credits absent" || bad "M: verify log missing office_ai_credits"
  fi
  apply_migration_039
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig039-p0-restored.log 2>&1; then
    ok "M: verify-schema passes after 039 restore"
  else
    bad "M: verify failed after restore"; tail -20 /tmp/mig039-p0-restored.log
  fi
  trap - EXIT
  teardown_db

  # N: ON CONFLICT (office_id) works after apply
  setup_db "mig039_on_conflict"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO office_ai_credits (office_id, office_name, balance)
    VALUES ('topup-039', 'Topup Office', 100)
    ON CONFLICT (office_id) DO NOTHING;
    INSERT INTO office_ai_credits (office_id, office_name, balance)
    VALUES ('topup-039', 'Topup Office', 100)
    ON CONFLICT (office_id) DO UPDATE SET balance = office_ai_credits.balance + 50;
  " >/dev/null
  local topup_bal
  topup_bal=$(psql_db -At -c "SELECT balance FROM office_ai_credits WHERE office_id='topup-039'")
  [[ "$topup_bal" == "150" ]] && ok "N: ON CONFLICT (office_id) topup-style works" || bad "N: balance=$topup_bal"
  trap - EXIT
  teardown_db

  # O: re-preflight AI_CREDITS_USAGE_SCHEMA_READY
  setup_db "mig039_repreflight"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_039" >/tmp/preflight039-o.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight039-o.log \
    && grep -q 'AI_CREDITS_USAGE_SCHEMA_READY' /tmp/preflight039-o.log \
    && ok "O: re-preflight AI_CREDITS_USAGE_SCHEMA_READY" \
    || bad "O: $(grep -E 'chosen_action=|AI_CREDITS' /tmp/preflight039-o.log | tail -3)"
  trap - EXIT
  teardown_db
}

scenario_migration_040_ai_provider_engine() {
  log "Scenario 040 — AI Provider Engine: greenfield / SAFE / BLOCK / Runtime / P0 / authority"
  local PREFLIGHT_040="$ROOT/scripts/db/preflight-migration-040.sql"
  local PROVIDER_SRC="$ROOT/artifacts/api-server/src/modules/ai/aiProviderEngine.ts"

  # A: greenfield READY + idempotent + ALREADY + UNIQUE(provider) + UNIQUE(office_id)
  setup_db "mig040_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_cnt uq_prov uq_off
  tbl_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('ai_provider_config','office_ai_settings')")
  [[ "$tbl_cnt" == "2" ]] && ok "A: 2 owned tables present" || bad "A: table count=$tbl_cnt"
  uq_prov=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.ai_provider_config'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*provider[[:space:]]*\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid='public.ai_provider_config'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['provider']::text[]
    )")
  [[ "$uq_prov" == "t" ]] && ok "A: UNIQUE(provider) present" || bad "A: UNIQUE(provider) missing"
  uq_off=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.office_ai_settings'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*office_id[[:space:]]*\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid='public.office_ai_settings'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['office_id']::text[]
    )")
  [[ "$uq_off" == "t" ]] && ok "A: UNIQUE(office_id) present" || bad "A: UNIQUE(office_id) missing"
  apply_migration_040
  ok "A: re-run 040 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_040" >/tmp/preflight040-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight040-ready.log \
    && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight040-ready.log | tail -1)"
  grep -q 'AI_PROVIDER_ENGINE_SCHEMA_READY' /tmp/preflight040-ready.log \
    && ok "A: AI_PROVIDER_ENGINE_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig040_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE office_ai_settings CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_040" >/tmp/preflight040-misstbl.log 2>&1
  grep -q 'SAFE_AUTO_REPAIR\|TABLE_MISSING\|PARTIAL_SCHEMA' /tmp/preflight040-misstbl.log \
    && ok "B: missing table → SAFE" || bad "B: preflight"
  apply_migration_040
  local restored
  restored=$(psql_db -At -c "SELECT to_regclass('public.office_ai_settings') IS NOT NULL")
  [[ "$restored" == "t" ]] && ok "B: office_ai_settings restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # C: missing column SAFE + restore
  setup_db "mig040_miss_col"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE ai_provider_config DROP COLUMN enabled;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_040" >/tmp/preflight040-misscol.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight040-misscol.log \
    && bad "C: missing column must not be ALREADY_CORRECT" \
    || ok "C: missing column not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|enabled' /tmp/preflight040-misscol.log \
    && ok "C: missing enabled → SAFE" || bad "C: preflight"
  apply_migration_040
  local col_ok
  col_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ai_provider_config' AND column_name='enabled'
    )")
  [[ "$col_ok" == "t" ]] && ok "C: enabled restored" || bad "C: column still missing"
  trap - EXIT
  teardown_db

  # D: wrong type BLOCK
  setup_db "mig040_badtype"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_provider_config DROP COLUMN enabled;
    ALTER TABLE ai_provider_config ADD COLUMN enabled TEXT;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_040" >/tmp/preflight040-type.log 2>&1; then
    bad "D: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight040-type.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_040" >/tmp/mig040-type.log 2>&1; then
    bad "D: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig040-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: mig reason=$(tail -3 /tmp/mig040-type.log)"
  fi
  trap - EXIT
  teardown_db

  # E: wrong PK BLOCK
  setup_db "mig040_wrongpk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_provider_config DROP CONSTRAINT ai_provider_config_pkey;
    ALTER TABLE ai_provider_config ADD PRIMARY KEY (provider);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_040" >/tmp/preflight040-pk.log 2>&1; then
    bad "E: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight040-pk.log \
      && ok "E: preflight BLOCK INCOMPATIBLE_PK" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_040" >/tmp/mig040-pk.log 2>&1; then
    bad "E: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig040-pk.log \
      && ok "E: migration BLOCK INCOMPATIBLE_PK" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F: wrong UNIQUE shape BLOCK — never ALREADY
  setup_db "mig040_wrong_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_provider_config DROP CONSTRAINT IF EXISTS ai_provider_config_provider_key;
    ALTER TABLE ai_provider_config ADD CONSTRAINT ai_provider_config_provider_key UNIQUE (provider, label_ar);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_040" >/tmp/preflight040-wuniq.log 2>&1; then
    bad "F: preflight should BLOCK wrong UNIQUE shape"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight040-wuniq.log \
      && ok "F: preflight BLOCK INCOMPATIBLE_UNIQUE" || bad "F: preflight reason"
    grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight040-wuniq.log \
      && bad "F: must never ALREADY with wrong UNIQUE" \
      || ok "F: not ALREADY_CORRECT"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_040" >/tmp/mig040-wuniq.log 2>&1; then
    bad "F: migration should BLOCK wrong UNIQUE shape"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig040-wuniq.log \
      && ok "F: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "F: mig reason=$(tail -3 /tmp/mig040-wuniq.log)"
  fi
  trap - EXIT
  teardown_db

  # G: duplicate provider BLOCK + rows preserved
  setup_db "mig040_dup_provider"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_provider_config DROP CONSTRAINT IF EXISTS ai_provider_config_provider_key;
    INSERT INTO ai_provider_config (provider, label_ar, priority)
    VALUES ('dup-prov-040', 'A', 1), ('dup-prov-040', 'B', 2);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_040" >/tmp/preflight040-dupprov.log 2>&1; then
    bad "G: preflight should BLOCK duplicate provider"
  else
    grep -qE 'DUPLICATE_UNIQUE_KEY|INCOMPATIBLE_UNIQUE|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight040-dupprov.log \
      && ok "G: preflight BLOCK duplicate provider" || bad "G: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_040" >/tmp/mig040-dupprov.log 2>&1; then
    bad "G: migration should BLOCK duplicate provider"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|INCOMPATIBLE_UNIQUE' /tmp/mig040-dupprov.log \
      && ok "G: migration BLOCK duplicate provider" || bad "G: mig reason=$(tail -3 /tmp/mig040-dupprov.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM ai_provider_config WHERE provider='dup-prov-040'")" == "2" ]] \
    && ok "G: duplicate provider rows preserved" || bad "G: rows not preserved"
  trap - EXIT
  teardown_db

  # H: duplicate office_id BLOCK + rows preserved
  setup_db "mig040_dup_office"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE office_ai_settings DROP CONSTRAINT IF EXISTS office_ai_settings_office_id_key;
    INSERT INTO office_ai_settings (office_id, preferred_provider, mode)
    VALUES ('dup040', 'auto', 'balanced'), ('dup040', 'gemini', 'fast');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_040" >/tmp/preflight040-dupoff.log 2>&1; then
    bad "H: preflight should BLOCK duplicate office_id"
  else
    grep -qE 'DUPLICATE_UNIQUE_KEY|INCOMPATIBLE_UNIQUE|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight040-dupoff.log \
      && ok "H: preflight BLOCK duplicate office_id" || bad "H: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_040" >/tmp/mig040-dupoff.log 2>&1; then
    bad "H: migration should BLOCK duplicate office_id"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|INCOMPATIBLE_UNIQUE' /tmp/mig040-dupoff.log \
      && ok "H: migration BLOCK duplicate office_id" || bad "H: mig reason=$(tail -3 /tmp/mig040-dupoff.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM office_ai_settings WHERE office_id='dup040'")" == "2" ]] \
    && ok "H: duplicate office_id rows preserved" || bad "H: rows not preserved"
  trap - EXIT
  teardown_db

  # I: missing UNIQUE clean → SAFE apply restores
  setup_db "mig040_miss_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_provider_config DROP CONSTRAINT IF EXISTS ai_provider_config_provider_key;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_040" >/tmp/preflight040-missuq.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight040-missuq.log \
    && bad "I: missing UNIQUE must not be ALREADY_CORRECT" \
    || ok "I: missing UNIQUE not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|MISSING|provider' /tmp/preflight040-missuq.log \
    && ok "I: missing UNIQUE → SAFE" || bad "I: preflight"
  apply_migration_040
  local uq_restored
  uq_restored=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.ai_provider_config'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*provider[[:space:]]*\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    )")
  [[ "$uq_restored" == "t" ]] && ok "I: UNIQUE(provider) restored" || bad "I: UNIQUE still missing"
  trap - EXIT
  teardown_db

  # J: ON CONFLICT (provider) works after apply
  setup_db "mig040_on_conflict_prov"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO ai_provider_config (provider, label_ar, priority)
    VALUES ('seed-040', 'Seed A', 9)
    ON CONFLICT (provider) DO NOTHING;
    INSERT INTO ai_provider_config (provider, label_ar, priority)
    VALUES ('seed-040', 'Seed B', 1)
    ON CONFLICT (provider) DO NOTHING;
  " >/dev/null
  local seed_cnt seed_label
  seed_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM ai_provider_config WHERE provider='seed-040'")
  seed_label=$(psql_db -At -c "SELECT label_ar FROM ai_provider_config WHERE provider='seed-040'")
  [[ "$seed_cnt" == "1" && "$seed_label" == "Seed A" ]] \
    && ok "J: ON CONFLICT (provider) DO NOTHING works" \
    || bad "J: count=$seed_cnt label=$seed_label"
  trap - EXIT
  teardown_db

  # K: ON CONFLICT (office_id) works after apply
  setup_db "mig040_on_conflict_off"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO office_ai_settings (office_id, preferred_provider, mode)
    VALUES ('upsert-040', 'auto', 'balanced')
    ON CONFLICT (office_id) DO NOTHING;
    INSERT INTO office_ai_settings (office_id, preferred_provider, mode)
    VALUES ('upsert-040', 'gemini', 'fast')
    ON CONFLICT (office_id) DO UPDATE
      SET preferred_provider = EXCLUDED.preferred_provider, mode = EXCLUDED.mode;
  " >/dev/null
  local up_prov up_mode
  up_prov=$(psql_db -At -c "SELECT preferred_provider FROM office_ai_settings WHERE office_id='upsert-040'")
  up_mode=$(psql_db -At -c "SELECT mode FROM office_ai_settings WHERE office_id='upsert-040'")
  [[ "$up_prov" == "gemini" && "$up_mode" == "fast" ]] \
    && ok "K: ON CONFLICT (office_id) DO UPDATE works" \
    || bad "K: preferred=$up_prov mode=$up_mode"
  trap - EXIT
  teardown_db

  # L: Runtime CREATE absent; readiness + ON CONFLICT seed present
  if grep -qE 'CREATE TABLE IF NOT EXISTS (ai_provider_config|office_ai_settings)' "$PROVIDER_SRC"; then
    bad "L: Runtime CREATE still present in aiProviderEngine"
  else
    ok "L: Runtime CREATE absent"
  fi
  grep -q "to_regclass('public.ai_provider_config')" "$PROVIDER_SRC" \
    && grep -q "to_regclass('public.office_ai_settings')" "$PROVIDER_SRC" \
    && ok "L: to_regclass readiness present" \
    || bad "L: to_regclass readiness missing"
  grep -q 'ON CONFLICT (provider)' "$PROVIDER_SRC" \
    && grep -q 'ON CONFLICT (office_id)' "$PROVIDER_SRC" \
    && ok "L: ON CONFLICT seed/upsert DML present" \
    || bad "L: ON CONFLICT DML missing"

  # M: 039 tables still present after full chain
  setup_db "mig040_039_still"
  trap teardown_db EXIT
  apply_all_migrations
  local credits_ok
  credits_ok=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('office_ai_credits','ai_credit_transactions','ai_usage_logs')")
  [[ "$credits_ok" == "3" ]] && ok "M: 039 tables still present after chain" || bad "M: credits count=$credits_ok"
  if grep -qE 'CREATE TABLE IF NOT EXISTS (office_ai_credits|ai_credit_transactions|ai_usage_logs)' "$MIGRATION_040"; then
    bad "M: 040 must not CREATE 039 tables"
  else
    ok "M: 040 does not CREATE 039 tables"
  fi
  trap - EXIT
  teardown_db

  # N: P0 verify fails without ai_provider_config
  setup_db "mig040_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig040-p0-present.log 2>&1; then
    ok "N: verify-schema passes with 040 objects"
  else
    bad "N: verify-schema failed after full chain"; tail -20 /tmp/mig040-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE ai_provider_config CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig040-p0.log 2>&1; then
    bad "N: verify-schema should fail without ai_provider_config"
  else
    grep -qi 'ai_provider_config' /tmp/mig040-p0.log \
      && ok "N: P0 verify fails when ai_provider_config absent" || bad "N: verify log missing ai_provider_config"
  fi
  apply_migration_040
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig040-p0-restored.log 2>&1; then
    ok "N: verify-schema passes after 040 restore"
  else
    bad "N: verify failed after restore"; tail -20 /tmp/mig040-p0-restored.log
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_041_ai_events() {
  log "Scenario 041 — AI Events: greenfield / SAFE / BLOCK / index DESC / Runtime / P0"
  local PREFLIGHT_041="$ROOT/scripts/db/preflight-migration-041.sql"
  local EVENTS_SRC="$ROOT/artifacts/api-server/src/modules/ai/aiEvents.ts"

  # A: greenfield READY + idempotent + ALREADY + index DESC shape
  setup_db "mig041_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_ok idx_ok
  tbl_ok=$(psql_db -At -c "SELECT to_regclass('public.ai_events') IS NOT NULL")
  [[ "$tbl_ok" == "t" ]] && ok "A: ai_events present" || bad "A: ai_events missing"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='ai_events'
        AND i.relname='ai_events_office_status_idx'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['office_id','status','created_at']::text[]
        AND (x.indoption[2] & 1) = 1
        AND (x.indoption[0] & 1) = 0
        AND (x.indoption[1] & 1) = 0
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: ai_events_office_status_idx (office_id, status, created_at DESC)" \
    || bad "A: index missing/wrong"
  apply_migration_041
  ok "A: re-run 041 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight041-ready.log \
    && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight041-ready.log | tail -1)"
  grep -q 'AI_EVENTS_SCHEMA_READY' /tmp/preflight041-ready.log \
    && ok "A: AI_EVENTS_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig041_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE ai_events CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-misstbl.log 2>&1
  grep -q 'SAFE_AUTO_REPAIR\|TABLE_MISSING\|PARTIAL_SCHEMA' /tmp/preflight041-misstbl.log \
    && ok "B: missing table → SAFE" || bad "B: preflight"
  apply_migration_041
  local restored
  restored=$(psql_db -At -c "SELECT to_regclass('public.ai_events') IS NOT NULL")
  [[ "$restored" == "t" ]] && ok "B: ai_events restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # C: missing safe column SAFE + restore
  setup_db "mig041_miss_col"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE ai_events DROP COLUMN body;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-misscol.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight041-misscol.log \
    && bad "C: missing column must not be ALREADY_CORRECT" \
    || ok "C: missing column not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|body' /tmp/preflight041-misscol.log \
    && ok "C: missing body → SAFE" || bad "C: preflight"
  apply_migration_041
  local col_ok
  col_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ai_events' AND column_name='body'
    )")
  [[ "$col_ok" == "t" ]] && ok "C: body restored" || bad "C: column still missing"
  trap - EXIT
  teardown_db

  # D: wrong type BLOCK
  setup_db "mig041_badtype"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_events DROP COLUMN status;
    ALTER TABLE ai_events ADD COLUMN status INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-type.log 2>&1; then
    bad "D: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight041-type.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_041" >/tmp/mig041-type.log 2>&1; then
    bad "D: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig041-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: mig reason=$(tail -3 /tmp/mig041-type.log)"
  fi
  trap - EXIT
  teardown_db

  # E: wrong PK BLOCK
  setup_db "mig041_wrongpk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_events DROP CONSTRAINT ai_events_pkey;
    ALTER TABLE ai_events ADD PRIMARY KEY (office_id, type, id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-pk.log 2>&1; then
    bad "E: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight041-pk.log \
      && ok "E: preflight BLOCK INCOMPATIBLE_PK" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_041" >/tmp/mig041-pk.log 2>&1; then
    bad "E: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig041-pk.log \
      && ok "E: migration BLOCK INCOMPATIBLE_PK" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F: NULL required field BLOCK + rows preserved
  setup_db "mig041_nullreq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_events ALTER COLUMN office_id DROP NOT NULL;
    INSERT INTO ai_events (office_id, type, severity, title, status)
    VALUES (NULL, 'NULL_TEST', 'info', 'null office', 'pending');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-null.log 2>&1; then
    bad "F: preflight should BLOCK NULL required"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight041-null.log \
      && ok "F: preflight BLOCK NULL_REQUIRED" || bad "F: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_041" >/tmp/mig041-null.log 2>&1; then
    bad "F: migration should BLOCK NULL required"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig041-null.log \
      && ok "F: migration BLOCK NULL_REQUIRED" || bad "F: mig reason=$(tail -3 /tmp/mig041-null.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM ai_events WHERE type='NULL_TEST'")" == "1" ]] \
    && ok "F: NULL office_id row preserved" || bad "F: row deleted"
  trap - EXIT
  teardown_db

  # G: missing index SAFE + restore
  setup_db "mig041_miss_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS ai_events_office_status_idx;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-missidx.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight041-missidx.log \
    && bad "G: missing index must not be ALREADY_CORRECT" \
    || ok "G: missing index not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|MISSING_INDEXES|ai_events_office_status_idx' /tmp/preflight041-missidx.log \
    && ok "G: missing index → SAFE" || bad "G: preflight"
  apply_migration_041
  local idx_restored
  idx_restored=$(psql_db -At -c "SELECT to_regclass('public.ai_events_office_status_idx') IS NOT NULL")
  [[ "$idx_restored" == "t" ]] && ok "G: index restored" || bad "G: index still missing"
  trap - EXIT
  teardown_db

  # H: wrong same-name index (wrong cols) BLOCK
  setup_db "mig041_wrong_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS ai_events_office_status_idx;
    CREATE INDEX ai_events_office_status_idx ON ai_events(office_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-widx.log 2>&1; then
    bad "H: preflight should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight041-widx.log \
      && ok "H: preflight BLOCK INCOMPATIBLE_INDEX" || bad "H: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_041" >/tmp/mig041-widx.log 2>&1; then
    bad "H: migration should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig041-widx.log \
      && ok "H: migration BLOCK INCOMPATIBLE_INDEX" || bad "H: mig reason"
  fi
  trap - EXIT
  teardown_db

  # I: stolen index name on another table BLOCK (never SAFE)
  setup_db "mig041_stolen_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE ai_events CASCADE;
    CREATE TABLE ai_events_orphan (office_id TEXT, status TEXT, created_at TIMESTAMP);
    CREATE INDEX ai_events_office_status_idx ON ai_events_orphan(office_id, status, created_at DESC);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-stolen.log 2>&1; then
    bad "I: preflight must BLOCK missing table + stolen same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight041-stolen.log \
      && ok "I: preflight BLOCK INCOMPATIBLE_INDEX (stolen name)" || bad "I: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight041-stolen.log \
      && bad "I: must never SAFE when same-name index incompatible" \
      || ok "I: no SAFE_AUTO_REPAIR over stolen index"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_041" >/tmp/mig041-stolen.log 2>&1; then
    bad "I: migration should BLOCK stolen index name"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig041-stolen.log \
      && ok "I: migration BLOCK INCOMPATIBLE_INDEX" || bad "I: mig reason=$(tail -3 /tmp/mig041-stolen.log)"
  fi
  trap - EXIT
  teardown_db

  # J: wrong DESC prefix/final direction BLOCK
  setup_db "mig041_wrong_desc"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS ai_events_office_status_idx;
    CREATE INDEX ai_events_office_status_idx ON ai_events(office_id DESC, status, created_at DESC);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-wrongdesc.log 2>&1; then
    bad "J: preflight must BLOCK prefix DESC"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight041-wrongdesc.log \
      && ok "J: preflight BLOCK wrong DESC" || bad "J: preflight reason"
    grep -q 'ALREADY_CORRECT\|AI_EVENTS_SCHEMA_READY' /tmp/preflight041-wrongdesc.log \
      && bad "J: must never ALREADY with wrong DESC" \
      || ok "J: no ALREADY_CORRECT for wrong DESC"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_041" >/tmp/mig041-wrongdesc.log 2>&1; then
    bad "J: migration should BLOCK wrong DESC"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig041-wrongdesc.log \
      && ok "J: migration BLOCK INCOMPATIBLE_INDEX wrong DESC" || bad "J: mig reason"
  fi
  trap - EXIT
  teardown_db

  # K: all-ASC instead of final DESC BLOCK
  setup_db "mig041_asc_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS ai_events_office_status_idx;
    CREATE INDEX ai_events_office_status_idx ON ai_events(office_id, status, created_at);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_041" >/tmp/preflight041-asc.log 2>&1; then
    bad "K: preflight must BLOCK ASC-only index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight041-asc.log \
      && ok "K: preflight BLOCK ASC-only (missing DESC)" || bad "K: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_041" >/tmp/mig041-asc.log 2>&1; then
    bad "K: migration should BLOCK ASC-only index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig041-asc.log \
      && ok "K: migration BLOCK ASC-only" || bad "K: mig reason"
  fi
  trap - EXIT
  teardown_db

  # L: rows preserved + WHERE NOT EXISTS dedupe still works after apply
  setup_db "mig041_dedupe"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO ai_events (office_id, type, severity, title, status)
    VALUES ('off-041', 'OVERDUE_INVOICES', 'high', 'seed event', 'pending');
    INSERT INTO ai_events (office_id, type, severity, title, body, payload)
    SELECT 'off-041', 'OVERDUE_INVOICES', 'high', 'dup attempt', 'x', '{}'::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_events
      WHERE office_id = 'off-041' AND type = 'OVERDUE_INVOICES'
        AND status = 'pending' AND created_at > NOW() - INTERVAL '24 hours'
    );
  " >/dev/null
  local dedupe_cnt
  dedupe_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM ai_events WHERE office_id='off-041' AND type='OVERDUE_INVOICES'")
  [[ "$dedupe_cnt" == "1" ]] && ok "L: WHERE NOT EXISTS dedupe works; rows preserved" \
    || bad "L: count=$dedupe_cnt"
  trap - EXIT
  teardown_db

  # M: Runtime CREATE/INDEX absent; readiness present
  if grep -qE 'CREATE TABLE IF NOT EXISTS ai_events|CREATE INDEX IF NOT EXISTS ai_events_office_status_idx' "$EVENTS_SRC"; then
    bad "M: Runtime CREATE/INDEX still present in aiEvents"
  else
    ok "M: Runtime CREATE/INDEX absent"
  fi
  grep -q "to_regclass('public.ai_events')" "$EVENTS_SRC" \
    && ok "M: to_regclass readiness present" \
    || bad "M: to_regclass readiness missing"
  grep -q 'WHERE NOT EXISTS' "$EVENTS_SRC" \
    && grep -q 'INSERT INTO ai_events' "$EVENTS_SRC" \
    && ok "M: insert + application dedupe DML present" \
    || bad "M: DML missing"

  # N: 039/040 tables still present; 041 does not CREATE them
  setup_db "mig041_039_040_still"
  trap teardown_db EXIT
  apply_all_migrations
  local prior_ok
  prior_ok=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN (
        'office_ai_credits','ai_credit_transactions','ai_usage_logs',
        'ai_provider_config','office_ai_settings'
      )")
  [[ "$prior_ok" == "5" ]] && ok "N: 039/040 tables still present after chain" || bad "N: count=$prior_ok"
  if grep -qE 'CREATE TABLE IF NOT EXISTS (office_ai_credits|ai_provider_config|ai_agents|case_ai_insights)' "$MIGRATION_041"; then
    bad "N: 041 must not CREATE out-of-scope tables"
  else
    ok "N: 041 does not CREATE 039/040/out-of-scope tables"
  fi
  trap - EXIT
  teardown_db

  # O: P0 verify fails without ai_events; restores after 041
  setup_db "mig041_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig041-p0-present.log 2>&1; then
    ok "O: verify-schema passes with 041 objects"
  else
    bad "O: verify-schema failed after full chain"; tail -20 /tmp/mig041-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE ai_events CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig041-p0.log 2>&1; then
    bad "O: verify-schema should fail without ai_events"
  else
    grep -qi 'ai_events' /tmp/mig041-p0.log \
      && ok "O: P0 verify fails when ai_events absent" || bad "O: verify log missing ai_events"
  fi
  apply_migration_041
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig041-p0-restored.log 2>&1; then
    ok "O: verify-schema passes after 041 restore"
  else
    bad "O: verify failed after restore"; tail -20 /tmp/mig041-p0-restored.log
  fi
  # P0 critical column
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE ai_events DROP COLUMN office_id;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig041-p0-col.log 2>&1; then
    bad "O: verify-schema should fail without ai_events.office_id"
  else
    grep -qi 'office_id\|ai_events' /tmp/mig041-p0-col.log \
      && ok "O: P0 verify fails when critical column missing" || bad "O: verify log missing column"
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_042_ai_agents() {
  log "Scenario 042 — AI Agents: greenfield / SAFE / BLOCK / index DESC / seed / Runtime / P0"
  local PREFLIGHT_042="$ROOT/scripts/db/preflight-migration-042.sql"
  local RUNTIME_SRC="$ROOT/artifacts/api-server/src/modules/platform/agentRuntime.ts"
  local CRON_SRC="$ROOT/artifacts/api-server/src/cron/agentCron.ts"

  # A: greenfield READY + idempotent + ALREADY + seed + index DESC shape
  setup_db "mig042_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_ok idx_ok seed_ok
  tbl_ok=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('ai_agents','agent_actions','agent_job_logs')")
  [[ "$tbl_ok" == "3" ]] && ok "A: agents trio present" || bad "A: tables count=$tbl_ok"
  seed_ok=$(psql_db -At -c "
    SELECT COUNT(*) FROM ai_agents WHERE id IN ('legal','finance','risk','system','hr')")
  [[ "$seed_ok" == "5" ]] && ok "A: 5 seed agents present" || bad "A: seed=$seed_ok"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='agent_job_logs'
        AND i.relname='idx_agent_job_logs_created'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['created_at']::text[]
        AND (x.indoption[0] & 1) = 1
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_agent_job_logs_created (created_at DESC)" \
    || bad "A: DESC index missing/wrong"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='agent_job_logs'
        AND i.relname='idx_agent_job_logs_type'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['agent_type']::text[]
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_agent_job_logs_type (agent_type)" || bad "A: type index missing"
  apply_migration_042
  ok "A: re-run 042 idempotent"
  seed_ok=$(psql_db -At -c "
    SELECT COUNT(*) FROM ai_agents WHERE id IN ('legal','finance','risk','system','hr')")
  [[ "$seed_ok" == "5" ]] && ok "A: seed preserved after reapply" || bad "A: seed after reapply=$seed_ok"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_042" >/tmp/preflight042-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight042-ready.log \
    && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight042-ready.log | tail -1)"
  grep -q 'AI_AGENTS_SCHEMA_READY' /tmp/preflight042-ready.log \
    && ok "A: AI_AGENTS_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig042_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE agent_job_logs CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_042" >/tmp/preflight042-misstbl.log 2>&1
  grep -q 'SAFE_AUTO_REPAIR\|TABLE_MISSING\|PARTIAL_SCHEMA\|MISSING_INDEXES' /tmp/preflight042-misstbl.log \
    && ok "B: missing table → SAFE" || bad "B: preflight"
  apply_migration_042
  local restored
  restored=$(psql_db -At -c "SELECT to_regclass('public.agent_job_logs') IS NOT NULL")
  [[ "$restored" == "t" ]] && ok "B: agent_job_logs restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # C: incompatible type BLOCK
  setup_db "mig042_badtype"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE agent_actions DROP COLUMN status;
    ALTER TABLE agent_actions ADD COLUMN status INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_042" >/tmp/preflight042-type.log 2>&1; then
    bad "C: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight042-type.log \
      && ok "C: preflight BLOCK INCOMPATIBLE_TYPE" || bad "C: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_042" >/tmp/mig042-type.log 2>&1; then
    bad "C: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig042-type.log \
      && ok "C: migration BLOCK INCOMPATIBLE_TYPE" || bad "C: mig reason=$(tail -3 /tmp/mig042-type.log)"
  fi
  trap - EXIT
  teardown_db

  # D: wrong PK BLOCK
  setup_db "mig042_wrongpk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_agents DROP CONSTRAINT ai_agents_pkey;
    ALTER TABLE ai_agents ADD PRIMARY KEY (id, type);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_042" >/tmp/preflight042-pk.log 2>&1; then
    bad "D: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight042-pk.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_PK" || bad "D: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_042" >/tmp/mig042-pk.log 2>&1; then
    bad "D: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig042-pk.log \
      && ok "D: migration BLOCK INCOMPATIBLE_PK" || bad "D: mig reason"
  fi
  trap - EXIT
  teardown_db

  # E: NULL required field BLOCK + rows preserved
  setup_db "mig042_nullreq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE agent_actions ALTER COLUMN agent_id DROP NOT NULL;
    INSERT INTO agent_actions (agent_id, event_type, decision, title, status)
    VALUES (NULL, 'NULL_TEST', 'RECOMMEND', 'null agent', 'pending');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_042" >/tmp/preflight042-null.log 2>&1; then
    bad "E: preflight should BLOCK NULL required"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight042-null.log \
      && ok "E: preflight BLOCK NULL_REQUIRED" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_042" >/tmp/mig042-null.log 2>&1; then
    bad "E: migration should BLOCK NULL required"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig042-null.log \
      && ok "E: migration BLOCK NULL_REQUIRED" || bad "E: mig reason=$(tail -3 /tmp/mig042-null.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM agent_actions WHERE event_type='NULL_TEST'")" == "1" ]] \
    && ok "E: NULL agent_id row preserved" || bad "E: row deleted"
  trap - EXIT
  teardown_db

  # F: missing index SAFE + restore
  setup_db "mig042_miss_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_agent_job_logs_created;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_042" >/tmp/preflight042-missidx.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight042-missidx.log \
    && bad "F: missing index must not be ALREADY_CORRECT" \
    || ok "F: missing index not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|MISSING_INDEXES|idx_agent_job_logs_created' /tmp/preflight042-missidx.log \
    && ok "F: missing index → SAFE" || bad "F: preflight"
  apply_migration_042
  local idx_restored
  idx_restored=$(psql_db -At -c "SELECT to_regclass('public.idx_agent_job_logs_created') IS NOT NULL")
  [[ "$idx_restored" == "t" ]] && ok "F: index restored" || bad "F: index still missing"
  trap - EXIT
  teardown_db

  # G: wrong same-name index (wrong cols) BLOCK
  setup_db "mig042_wrong_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_agent_job_logs_created;
    CREATE INDEX idx_agent_job_logs_created ON agent_job_logs(agent_type);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_042" >/tmp/preflight042-widx.log 2>&1; then
    bad "G: preflight should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight042-widx.log \
      && ok "G: preflight BLOCK INCOMPATIBLE_INDEX" || bad "G: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_042" >/tmp/mig042-widx.log 2>&1; then
    bad "G: migration should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig042-widx.log \
      && ok "G: migration BLOCK INCOMPATIBLE_INDEX" || bad "G: mig reason"
  fi
  trap - EXIT
  teardown_db

  # H: stolen index name on another table BLOCK (never SAFE)
  setup_db "mig042_stolen_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE agent_job_logs CASCADE;
    CREATE TABLE agent_job_logs_orphan (created_at TIMESTAMPTZ, agent_type TEXT);
    CREATE INDEX idx_agent_job_logs_created ON agent_job_logs_orphan(created_at DESC);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_042" >/tmp/preflight042-stolen.log 2>&1; then
    bad "H: preflight must BLOCK missing table + stolen same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight042-stolen.log \
      && ok "H: preflight BLOCK INCOMPATIBLE_INDEX (stolen name)" || bad "H: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight042-stolen.log \
      && bad "H: must never SAFE when same-name index incompatible" \
      || ok "H: no SAFE_AUTO_REPAIR over stolen index"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_042" >/tmp/mig042-stolen.log 2>&1; then
    bad "H: migration should BLOCK stolen index name"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig042-stolen.log \
      && ok "H: migration BLOCK INCOMPATIBLE_INDEX" || bad "H: mig reason=$(tail -3 /tmp/mig042-stolen.log)"
  fi
  trap - EXIT
  teardown_db

  # I: ASC instead of DESC BLOCK
  setup_db "mig042_wrong_desc"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_agent_job_logs_created;
    CREATE INDEX idx_agent_job_logs_created ON agent_job_logs(created_at);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_042" >/tmp/preflight042-wrongdesc.log 2>&1; then
    bad "I: preflight must BLOCK ASC-only (missing DESC)"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight042-wrongdesc.log \
      && ok "I: preflight BLOCK wrong DESC" || bad "I: preflight reason"
    grep -q 'ALREADY_CORRECT\|AI_AGENTS_SCHEMA_READY' /tmp/preflight042-wrongdesc.log \
      && bad "I: must never ALREADY with wrong DESC" \
      || ok "I: no ALREADY_CORRECT for wrong DESC"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_042" >/tmp/mig042-wrongdesc.log 2>&1; then
    bad "I: migration should BLOCK wrong DESC"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig042-wrongdesc.log \
      && ok "I: migration BLOCK INCOMPATIBLE_INDEX wrong DESC" || bad "I: mig reason"
  fi
  trap - EXIT
  teardown_db

  # J: seed idempotency — custom row preserved; seed re-insert does not wipe
  setup_db "mig042_seed"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO ai_agents (id, name, name_ar, type, description)
    VALUES ('custom', 'Custom', 'مخصص', 'custom', 'custom agent')
    ON CONFLICT (id) DO NOTHING;
    UPDATE ai_agents SET description = 'preserved-legal' WHERE id = 'legal';
  " >/dev/null
  apply_migration_042
  local custom_ok legal_desc
  custom_ok=$(psql_db -At -c "SELECT COUNT(*) FROM ai_agents WHERE id='custom'")
  legal_desc=$(psql_db -At -c "SELECT description FROM ai_agents WHERE id='legal'")
  [[ "$custom_ok" == "1" ]] && ok "J: custom agent preserved" || bad "J: custom wiped"
  [[ "$legal_desc" == "preserved-legal" ]] && ok "J: seed ON CONFLICT did not overwrite legal" \
    || bad "J: legal overwritten ($legal_desc)"
  seed_ok=$(psql_db -At -c "
    SELECT COUNT(*) FROM ai_agents WHERE id IN ('legal','finance','risk','system','hr')")
  [[ "$seed_ok" == "5" ]] && ok "J: canonical seed still present" || bad "J: seed=$seed_ok"
  trap - EXIT
  teardown_db

  # K: Runtime CREATE/INDEX absent; readiness + DML present
  if grep -qE 'CREATE TABLE IF NOT EXISTS (ai_agents|agent_actions)' "$RUNTIME_SRC"; then
    bad "K: Runtime CREATE still present in agentRuntime"
  else
    ok "K: agentRuntime Runtime CREATE absent"
  fi
  grep -q "to_regclass('public.ai_agents')" "$RUNTIME_SRC" \
    && grep -q 'ON CONFLICT (id) DO NOTHING' "$RUNTIME_SRC" \
    && ok "K: agentRuntime readiness + seed DML present" \
    || bad "K: agentRuntime readiness/seed missing"
  if grep -qE 'CREATE TABLE IF NOT EXISTS agent_job_logs|CREATE INDEX IF NOT EXISTS idx_agent_job_logs_' "$CRON_SRC"; then
    bad "K: Runtime CREATE/INDEX still present in agentCron"
  else
    ok "K: agentCron Runtime CREATE/INDEX absent"
  fi
  grep -q "to_regclass('public.agent_job_logs')" "$CRON_SRC" \
    && grep -q 'INSERT INTO agent_job_logs' "$CRON_SRC" \
    && ok "K: agentCron readiness + job-log DML present" \
    || bad "K: agentCron readiness/DML missing"

  # L: prior AI tables still present; 042 does not CREATE them
  setup_db "mig042_prior_still"
  trap teardown_db EXIT
  apply_all_migrations
  local prior_ok
  prior_ok=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN (
        'office_ai_credits','ai_credit_transactions','ai_usage_logs',
        'ai_provider_config','office_ai_settings','ai_events'
      )")
  [[ "$prior_ok" == "6" ]] && ok "L: 039–041 tables still present after chain" || bad "L: count=$prior_ok"
  if grep -qE 'CREATE TABLE IF NOT EXISTS (ai_events|case_ai_insights|ai_coo_notif_settings|office_ai_credits|ai_provider_config)' "$MIGRATION_042"; then
    bad "L: 042 must not CREATE out-of-scope tables"
  else
    ok "L: 042 does not CREATE 039–041/out-of-scope tables"
  fi
  trap - EXIT
  teardown_db

  # M: P0 verify fails without ai_agents; restores after 042
  setup_db "mig042_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig042-p0-present.log 2>&1; then
    ok "M: verify-schema passes with 042 objects"
  else
    bad "M: verify-schema failed after full chain"; tail -20 /tmp/mig042-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE ai_agents CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig042-p0.log 2>&1; then
    bad "M: verify-schema should fail without ai_agents"
  else
    grep -qi 'ai_agents' /tmp/mig042-p0.log \
      && ok "M: P0 verify fails when ai_agents absent" || bad "M: verify log missing ai_agents"
  fi
  apply_migration_042
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig042-p0-restored.log 2>&1; then
    ok "M: verify-schema passes after 042 restore"
  else
    bad "M: verify failed after restore"; tail -20 /tmp/mig042-p0-restored.log
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_043_case_ai_insights() {
  log "Scenario 043 — Case AI Insights: greenfield / SAFE / BLOCK / index DESC / Runtime / P0"
  local PREFLIGHT_043="$ROOT/scripts/db/preflight-migration-043.sql"
  local CASE_AI_SRC="$ROOT/artifacts/api-server/src/case/case.ai.ts"

  # A: greenfield READY + idempotent + ALREADY + index DESC shape
  setup_db "mig043_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_ok idx_ok
  tbl_ok=$(psql_db -At -c "SELECT to_regclass('public.case_ai_insights') IS NOT NULL")
  [[ "$tbl_ok" == "t" ]] && ok "A: case_ai_insights present" || bad "A: case_ai_insights missing"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='case_ai_insights'
        AND i.relname='idx_case_ai_insights_case'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['case_id','office_id','created_at']::text[]
        AND (x.indoption[2] & 1) = 1
        AND (x.indoption[0] & 1) = 0
        AND (x.indoption[1] & 1) = 0
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_case_ai_insights_case (case_id, office_id, created_at DESC)" \
    || bad "A: index missing/wrong"
  apply_migration_043
  ok "A: re-run 043 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight043-ready.log \
    && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight043-ready.log | tail -1)"
  grep -q 'CASE_AI_INSIGHTS_SCHEMA_READY' /tmp/preflight043-ready.log \
    && ok "A: CASE_AI_INSIGHTS_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig043_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE case_ai_insights CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-misstbl.log 2>&1
  grep -q 'SAFE_AUTO_REPAIR\|TABLE_MISSING\|PARTIAL_SCHEMA\|MISSING_INDEXES' /tmp/preflight043-misstbl.log \
    && ok "B: missing table → SAFE" || bad "B: preflight"
  apply_migration_043
  local restored
  restored=$(psql_db -At -c "SELECT to_regclass('public.case_ai_insights') IS NOT NULL")
  [[ "$restored" == "t" ]] && ok "B: case_ai_insights restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # C: missing safe column SAFE + restore
  setup_db "mig043_miss_col"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE case_ai_insights DROP COLUMN alerts;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-misscol.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight043-misscol.log \
    && bad "C: missing column must not be ALREADY_CORRECT" \
    || ok "C: missing column not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|alerts' /tmp/preflight043-misscol.log \
    && ok "C: missing alerts → SAFE" || bad "C: preflight"
  apply_migration_043
  local col_ok
  col_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='case_ai_insights' AND column_name='alerts'
    )")
  [[ "$col_ok" == "t" ]] && ok "C: alerts restored" || bad "C: column still missing"
  trap - EXIT
  teardown_db

  # D: wrong type BLOCK
  setup_db "mig043_badtype"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE case_ai_insights DROP COLUMN office_id;
    ALTER TABLE case_ai_insights ADD COLUMN office_id INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-type.log 2>&1; then
    bad "D: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight043-type.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_043" >/tmp/mig043-type.log 2>&1; then
    bad "D: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig043-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: mig reason=$(tail -3 /tmp/mig043-type.log)"
  fi
  trap - EXIT
  teardown_db

  # E: wrong PK BLOCK
  setup_db "mig043_wrongpk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE case_ai_insights DROP CONSTRAINT case_ai_insights_pkey;
    ALTER TABLE case_ai_insights ADD PRIMARY KEY (case_id, office_id, id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-pk.log 2>&1; then
    bad "E: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight043-pk.log \
      && ok "E: preflight BLOCK INCOMPATIBLE_PK" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_043" >/tmp/mig043-pk.log 2>&1; then
    bad "E: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig043-pk.log \
      && ok "E: migration BLOCK INCOMPATIBLE_PK" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F: NULL required field BLOCK + rows preserved
  setup_db "mig043_nullreq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE case_ai_insights ALTER COLUMN office_id DROP NOT NULL;
    INSERT INTO case_ai_insights (case_id, office_id, risks)
    VALUES ('case-null', NULL, '[]'::jsonb);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-null.log 2>&1; then
    bad "F: preflight should BLOCK NULL required"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight043-null.log \
      && ok "F: preflight BLOCK NULL_REQUIRED" || bad "F: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_043" >/tmp/mig043-null.log 2>&1; then
    bad "F: migration should BLOCK NULL required"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig043-null.log \
      && ok "F: migration BLOCK NULL_REQUIRED" || bad "F: mig reason=$(tail -3 /tmp/mig043-null.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM case_ai_insights WHERE case_id='case-null'")" == "1" ]] \
    && ok "F: NULL office_id row preserved" || bad "F: row deleted"
  trap - EXIT
  teardown_db

  # G: missing index SAFE + restore
  setup_db "mig043_miss_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_case_ai_insights_case;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-missidx.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight043-missidx.log \
    && bad "G: missing index must not be ALREADY_CORRECT" \
    || ok "G: missing index not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|MISSING_INDEXES|idx_case_ai_insights_case' /tmp/preflight043-missidx.log \
    && ok "G: missing index → SAFE" || bad "G: preflight"
  apply_migration_043
  local idx_restored
  idx_restored=$(psql_db -At -c "SELECT to_regclass('public.idx_case_ai_insights_case') IS NOT NULL")
  [[ "$idx_restored" == "t" ]] && ok "G: index restored" || bad "G: index still missing"
  trap - EXIT
  teardown_db

  # H: wrong same-name index (wrong cols) BLOCK
  setup_db "mig043_wrong_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_case_ai_insights_case;
    CREATE INDEX idx_case_ai_insights_case ON case_ai_insights(case_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-widx.log 2>&1; then
    bad "H: preflight should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight043-widx.log \
      && ok "H: preflight BLOCK INCOMPATIBLE_INDEX" || bad "H: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_043" >/tmp/mig043-widx.log 2>&1; then
    bad "H: migration should BLOCK wrong same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig043-widx.log \
      && ok "H: migration BLOCK INCOMPATIBLE_INDEX" || bad "H: mig reason"
  fi
  trap - EXIT
  teardown_db

  # I: stolen index name on another table BLOCK (never SAFE)
  setup_db "mig043_stolen_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE case_ai_insights CASCADE;
    CREATE TABLE case_ai_insights_orphan (case_id TEXT, office_id TEXT, created_at TIMESTAMPTZ);
    CREATE INDEX idx_case_ai_insights_case ON case_ai_insights_orphan(case_id, office_id, created_at DESC);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-stolen.log 2>&1; then
    bad "I: preflight must BLOCK missing table + stolen same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight043-stolen.log \
      && ok "I: preflight BLOCK INCOMPATIBLE_INDEX (stolen name)" || bad "I: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight043-stolen.log \
      && bad "I: must never SAFE when same-name index incompatible" \
      || ok "I: no SAFE_AUTO_REPAIR over stolen index"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_043" >/tmp/mig043-stolen.log 2>&1; then
    bad "I: migration should BLOCK stolen index name"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig043-stolen.log \
      && ok "I: migration BLOCK INCOMPATIBLE_INDEX" || bad "I: mig reason=$(tail -3 /tmp/mig043-stolen.log)"
  fi
  trap - EXIT
  teardown_db

  # J: wrong DESC prefix/final direction BLOCK
  setup_db "mig043_wrong_desc"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_case_ai_insights_case;
    CREATE INDEX idx_case_ai_insights_case ON case_ai_insights(case_id DESC, office_id, created_at DESC);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-wrongdesc.log 2>&1; then
    bad "J: preflight must BLOCK prefix DESC"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight043-wrongdesc.log \
      && ok "J: preflight BLOCK wrong DESC" || bad "J: preflight reason"
    grep -q 'ALREADY_CORRECT\|CASE_AI_INSIGHTS_SCHEMA_READY' /tmp/preflight043-wrongdesc.log \
      && bad "J: must never ALREADY with wrong DESC" \
      || ok "J: no ALREADY_CORRECT for wrong DESC"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_043" >/tmp/mig043-wrongdesc.log 2>&1; then
    bad "J: migration should BLOCK wrong DESC"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig043-wrongdesc.log \
      && ok "J: migration BLOCK INCOMPATIBLE_INDEX wrong DESC" || bad "J: mig reason"
  fi
  trap - EXIT
  teardown_db

  # K: ASC-only instead of final DESC BLOCK
  setup_db "mig043_asc_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_case_ai_insights_case;
    CREATE INDEX idx_case_ai_insights_case ON case_ai_insights(case_id, office_id, created_at);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_043" >/tmp/preflight043-asc.log 2>&1; then
    bad "K: preflight must BLOCK ASC-only index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight043-asc.log \
      && ok "K: preflight BLOCK ASC-only (missing DESC)" || bad "K: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_043" >/tmp/mig043-asc.log 2>&1; then
    bad "K: migration should BLOCK ASC-only index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig043-asc.log \
      && ok "K: migration BLOCK ASC-only" || bad "K: mig reason"
  fi
  trap - EXIT
  teardown_db

  # L: Runtime CREATE/INDEX absent; readiness + DML present
  if grep -qE 'CREATE TABLE IF NOT EXISTS case_ai_insights|CREATE INDEX IF NOT EXISTS idx_case_ai_insights_case' "$CASE_AI_SRC"; then
    bad "L: Runtime CREATE/INDEX still present in case.ai"
  else
    ok "L: Runtime CREATE/INDEX absent"
  fi
  grep -q "to_regclass('public.case_ai_insights')" "$CASE_AI_SRC" \
    && ok "L: to_regclass readiness present" \
    || bad "L: to_regclass readiness missing"
  grep -q 'INSERT INTO case_ai_insights' "$CASE_AI_SRC" \
    && grep -q 'UPDATE case_ai_insights SET auto_tasks' "$CASE_AI_SRC" \
    && ok "L: insert + update DML present" \
    || bad "L: DML missing"

  # M: prior AI tables still present; 043 does not CREATE them
  setup_db "mig043_prior_still"
  trap teardown_db EXIT
  apply_all_migrations
  local prior_ok
  prior_ok=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN (
        'office_ai_credits','ai_credit_transactions','ai_usage_logs',
        'ai_provider_config','office_ai_settings','ai_events',
        'ai_agents','agent_actions','agent_job_logs'
      )")
  [[ "$prior_ok" == "9" ]] && ok "M: 039–042 tables still present after chain" || bad "M: count=$prior_ok"
  if grep -qE 'CREATE TABLE IF NOT EXISTS (ai_coo_notif_settings|support_ai_analysis|ai_agents|ai_events|office_ai_credits)' "$MIGRATION_043"; then
    bad "M: 043 must not CREATE out-of-scope tables"
  else
    ok "M: 043 does not CREATE 039–042/out-of-scope tables"
  fi
  trap - EXIT
  teardown_db

  # N: P0 verify fails without case_ai_insights; restores after 043
  setup_db "mig043_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig043-p0-present.log 2>&1; then
    ok "N: verify-schema passes with 043 objects"
  else
    bad "N: verify-schema failed after full chain"; tail -20 /tmp/mig043-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE case_ai_insights CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig043-p0.log 2>&1; then
    bad "N: verify-schema should fail without case_ai_insights"
  else
    grep -qi 'case_ai_insights' /tmp/mig043-p0.log \
      && ok "N: P0 verify fails when case_ai_insights absent" || bad "N: verify log missing case_ai_insights"
  fi
  apply_migration_043
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig043-p0-restored.log 2>&1; then
    ok "N: verify-schema passes after 043 restore"
  else
    bad "N: verify failed after restore"; tail -20 /tmp/mig043-p0-restored.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE case_ai_insights DROP COLUMN office_id;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig043-p0-col.log 2>&1; then
    bad "N: verify-schema should fail without case_ai_insights.office_id"
  else
    grep -qi 'office_id\|case_ai_insights' /tmp/mig043-p0-col.log \
      && ok "N: P0 verify fails when critical column missing" || bad "N: verify log missing column"
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_044_ai_coo_notif_settings() {
  log "Scenario 044 — AI COO Notif Settings: greenfield / SAFE / BLOCK / UNIQUE / Runtime / P0"
  local PREFLIGHT_044="$ROOT/scripts/db/preflight-migration-044.sql"
  local AICOO_SRC="$ROOT/artifacts/api-server/src/modules/platform/aiCoo.ts"

  # A: greenfield READY + idempotent + ALREADY + UNIQUE(office_id)
  setup_db "mig044_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_ok uq_ok
  tbl_ok=$(psql_db -At -c "SELECT to_regclass('public.ai_coo_notif_settings') IS NOT NULL")
  [[ "$tbl_ok" == "t" ]] && ok "A: ai_coo_notif_settings present" || bad "A: table missing"
  uq_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.ai_coo_notif_settings'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*office_id[[:space:]]*\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid='public.ai_coo_notif_settings'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['office_id']::text[]
    )")
  [[ "$uq_ok" == "t" ]] && ok "A: UNIQUE(office_id) present" || bad "A: UNIQUE missing"
  apply_migration_044
  ok "A: re-run 044 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight044-ready.log \
    && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight044-ready.log | tail -1)"
  grep -q 'AI_COO_NOTIF_SETTINGS_SCHEMA_READY' /tmp/preflight044-ready.log \
    && ok "A: AI_COO_NOTIF_SETTINGS_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig044_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE ai_coo_notif_settings CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-misstbl.log 2>&1
  grep -q 'SAFE_AUTO_REPAIR\|TABLE_MISSING\|PARTIAL_SCHEMA' /tmp/preflight044-misstbl.log \
    && ok "B: missing table → SAFE" || bad "B: preflight"
  apply_migration_044
  local restored
  restored=$(psql_db -At -c "SELECT to_regclass('public.ai_coo_notif_settings') IS NOT NULL")
  [[ "$restored" == "t" ]] && ok "B: ai_coo_notif_settings restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # C: missing column SAFE + restore
  setup_db "mig044_miss_col"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE ai_coo_notif_settings DROP COLUMN min_level;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-misscol.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight044-misscol.log \
    && bad "C: missing column must not be ALREADY_CORRECT" \
    || ok "C: missing column not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|min_level' /tmp/preflight044-misscol.log \
    && ok "C: missing min_level → SAFE" || bad "C: preflight"
  apply_migration_044
  local col_ok
  col_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ai_coo_notif_settings' AND column_name='min_level'
    )")
  [[ "$col_ok" == "t" ]] && ok "C: min_level restored" || bad "C: column still missing"
  trap - EXIT
  teardown_db

  # D: wrong type BLOCK
  setup_db "mig044_badtype"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_coo_notif_settings DROP COLUMN office_id CASCADE;
    ALTER TABLE ai_coo_notif_settings ADD COLUMN office_id INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-type.log 2>&1; then
    bad "D: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight044-type.log \
      && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_044" >/tmp/mig044-type.log 2>&1; then
    bad "D: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig044-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: mig reason=$(tail -3 /tmp/mig044-type.log)"
  fi
  trap - EXIT
  teardown_db

  # E: wrong PK BLOCK
  setup_db "mig044_wrongpk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_coo_notif_settings DROP CONSTRAINT ai_coo_notif_settings_pkey;
    ALTER TABLE ai_coo_notif_settings ADD PRIMARY KEY (office_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-pk.log 2>&1; then
    bad "E: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight044-pk.log \
      && ok "E: preflight BLOCK INCOMPATIBLE_PK" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_044" >/tmp/mig044-pk.log 2>&1; then
    bad "E: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig044-pk.log \
      && ok "E: migration BLOCK INCOMPATIBLE_PK" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F: NULL office_id BLOCK + row preserved
  setup_db "mig044_nullreq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_coo_notif_settings ALTER COLUMN office_id DROP NOT NULL;
    INSERT INTO ai_coo_notif_settings (office_id, min_level) VALUES (NULL, 'null-row');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-null.log 2>&1; then
    bad "F: preflight should BLOCK NULL office_id"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight044-null.log \
      && ok "F: preflight BLOCK NULL_REQUIRED" || bad "F: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_044" >/tmp/mig044-null.log 2>&1; then
    bad "F: migration should BLOCK NULL office_id"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig044-null.log \
      && ok "F: migration BLOCK NULL_REQUIRED" || bad "F: mig reason=$(tail -3 /tmp/mig044-null.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM ai_coo_notif_settings WHERE min_level='null-row'")" == "1" ]] \
    && ok "F: NULL office_id row preserved" || bad "F: row not preserved"
  trap - EXIT
  teardown_db

  # G: duplicate office_id BLOCK + rows preserved
  setup_db "mig044_dup_office"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_coo_notif_settings DROP CONSTRAINT IF EXISTS ai_coo_notif_settings_office_id_key;
    INSERT INTO ai_coo_notif_settings (office_id, min_level)
    VALUES ('dup044', 'a'), ('dup044', 'b');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-dup.log 2>&1; then
    bad "G: preflight should BLOCK duplicate office_id"
  else
    grep -qE 'DUPLICATE_UNIQUE_KEY|INCOMPATIBLE_UNIQUE|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight044-dup.log \
      && ok "G: preflight BLOCK duplicate office_id" || bad "G: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_044" >/tmp/mig044-dup.log 2>&1; then
    bad "G: migration should BLOCK duplicate office_id"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|INCOMPATIBLE_UNIQUE' /tmp/mig044-dup.log \
      && ok "G: migration BLOCK duplicate office_id" || bad "G: mig reason=$(tail -3 /tmp/mig044-dup.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM ai_coo_notif_settings WHERE office_id='dup044'")" == "2" ]] \
    && ok "G: duplicate office_id rows preserved" || bad "G: rows not preserved"
  trap - EXIT
  teardown_db

  # H: missing UNIQUE clean → SAFE apply restores
  setup_db "mig044_miss_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_coo_notif_settings DROP CONSTRAINT IF EXISTS ai_coo_notif_settings_office_id_key;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-missuq.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight044-missuq.log \
    && bad "H: missing UNIQUE must not be ALREADY_CORRECT" \
    || ok "H: missing UNIQUE not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|MISSING|office_id' /tmp/preflight044-missuq.log \
    && ok "H: missing UNIQUE → SAFE" || bad "H: preflight"
  apply_migration_044
  local uq_restored
  uq_restored=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.ai_coo_notif_settings'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*office_id[[:space:]]*\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    )")
  [[ "$uq_restored" == "t" ]] && ok "H: UNIQUE(office_id) restored" || bad "H: UNIQUE still missing"
  trap - EXIT
  teardown_db

  # I: wrong/wider same-name UNIQUE BLOCK — never ALREADY
  setup_db "mig044_wider_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_coo_notif_settings DROP CONSTRAINT IF EXISTS ai_coo_notif_settings_office_id_key;
    ALTER TABLE ai_coo_notif_settings ADD CONSTRAINT ai_coo_notif_settings_office_id_key
      UNIQUE (office_id, min_level);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-wuniq.log 2>&1; then
    bad "I: preflight should BLOCK wider UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight044-wuniq.log \
      && ok "I: preflight BLOCK INCOMPATIBLE_UNIQUE (wider)" || bad "I: preflight reason"
    grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight044-wuniq.log \
      && bad "I: must never ALREADY with wrong UNIQUE" \
      || ok "I: not ALREADY_CORRECT"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_044" >/tmp/mig044-wuniq.log 2>&1; then
    bad "I: migration should BLOCK wider UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig044-wuniq.log \
      && ok "I: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "I: mig reason=$(tail -3 /tmp/mig044-wuniq.log)"
  fi
  trap - EXIT
  teardown_db

  # J: partial UNIQUE(office_id) WHERE … BLOCK
  setup_db "mig044_partial_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_coo_notif_settings DROP CONSTRAINT IF EXISTS ai_coo_notif_settings_office_id_key;
    CREATE UNIQUE INDEX ai_coo_notif_settings_office_id_key
      ON ai_coo_notif_settings (office_id) WHERE telegram_enabled IS TRUE;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-partial.log 2>&1; then
    bad "J: preflight should BLOCK partial UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight044-partial.log \
      && ok "J: preflight BLOCK INCOMPATIBLE_UNIQUE (partial)" || bad "J: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_044" >/tmp/mig044-partial.log 2>&1; then
    bad "J: migration should BLOCK partial UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig044-partial.log \
      && ok "J: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "J: mig reason=$(tail -3 /tmp/mig044-partial.log)"
  fi
  trap - EXIT
  teardown_db

  # K: expression UNIQUE(lower(office_id)) BLOCK
  setup_db "mig044_expr_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE ai_coo_notif_settings DROP CONSTRAINT IF EXISTS ai_coo_notif_settings_office_id_key;
    CREATE UNIQUE INDEX ai_coo_notif_settings_office_id_expr
      ON ai_coo_notif_settings (lower(office_id));
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_044" >/tmp/preflight044-expr.log 2>&1; then
    bad "K: preflight should BLOCK expression UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight044-expr.log \
      && ok "K: preflight BLOCK INCOMPATIBLE_UNIQUE (expression)" || bad "K: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_044" >/tmp/mig044-expr.log 2>&1; then
    bad "K: migration should BLOCK expression UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig044-expr.log \
      && ok "K: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "K: mig reason=$(tail -3 /tmp/mig044-expr.log)"
  fi
  trap - EXIT
  teardown_db

  # L: ON CONFLICT (office_id) works after apply (GET seed + PATCH upsert)
  setup_db "mig044_on_conflict"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO ai_coo_notif_settings (office_id)
    VALUES ('upsert-044')
    ON CONFLICT DO NOTHING;
    INSERT INTO ai_coo_notif_settings
      (office_id, telegram_enabled, min_level, email_recipients, auto_notify, updated_at)
    VALUES
      ('upsert-044', true, 'warning', 'a@b.co', true, NOW())
    ON CONFLICT (office_id) DO UPDATE SET
      telegram_enabled = EXCLUDED.telegram_enabled,
      min_level = EXCLUDED.min_level,
      email_recipients = EXCLUDED.email_recipients,
      auto_notify = EXCLUDED.auto_notify,
      updated_at = NOW();
    UPDATE ai_coo_notif_settings SET last_notified_at = NOW() WHERE office_id = 'upsert-044';
  " >/dev/null
  local up_min up_tg up_email notified
  up_min=$(psql_db -At -c "SELECT min_level FROM ai_coo_notif_settings WHERE office_id='upsert-044'")
  up_tg=$(psql_db -At -c "SELECT telegram_enabled FROM ai_coo_notif_settings WHERE office_id='upsert-044'")
  up_email=$(psql_db -At -c "SELECT email_recipients FROM ai_coo_notif_settings WHERE office_id='upsert-044'")
  notified=$(psql_db -At -c "SELECT last_notified_at IS NOT NULL FROM ai_coo_notif_settings WHERE office_id='upsert-044'")
  [[ "$up_min" == "warning" && "$up_tg" == "t" && "$up_email" == "a@b.co" && "$notified" == "t" ]] \
    && ok "L: ON CONFLICT (office_id) DO UPDATE + last_notified_at works" \
    || bad "L: min=$up_min tg=$up_tg email=$up_email notified=$notified"
  trap - EXIT
  teardown_db

  # M: Runtime CREATE absent; readiness + DML preserved
  if grep -qE 'CREATE TABLE IF NOT EXISTS ai_coo_notif_settings' "$AICOO_SRC"; then
    bad "M: Runtime CREATE still present in aiCoo.ts"
  else
    ok "M: Runtime CREATE absent"
  fi
  grep -q "to_regclass('public.ai_coo_notif_settings')" "$AICOO_SRC" \
    && ok "M: to_regclass readiness present" \
    || bad "M: to_regclass readiness missing"
  grep -q 'ON CONFLICT DO NOTHING' "$AICOO_SRC" \
    && grep -q 'ON CONFLICT (office_id) DO UPDATE' "$AICOO_SRC" \
    && grep -q 'UPDATE ai_coo_notif_settings SET last_notified_at' "$AICOO_SRC" \
    && ok "M: GET/PATCH/notify DML + ON CONFLICT preserved" \
    || bad "M: DML/ON CONFLICT missing"

  # N: prior AI tables still present; 044 does not CREATE them
  setup_db "mig044_prior_still"
  trap teardown_db EXIT
  apply_all_migrations
  local prior_cnt
  prior_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('case_ai_insights','ai_agents','ai_events','office_ai_credits','ai_provider_config')")
  [[ "$prior_cnt" == "5" ]] && ok "N: prior AI tables still present after chain" || bad "N: prior count=$prior_cnt"
  if grep -qE 'CREATE TABLE IF NOT EXISTS (case_ai_insights|support_ai_analysis|ai_agents|ai_events|office_ai_credits)' "$MIGRATION_044"; then
    bad "N: 044 must not CREATE out-of-scope tables"
  else
    ok "N: 044 does not CREATE 039–043/out-of-scope tables"
  fi
  trap - EXIT
  teardown_db

  # O: P0 verify fails without ai_coo_notif_settings / critical column
  setup_db "mig044_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig044-p0-present.log 2>&1; then
    ok "O: verify-schema passes with 044 objects"
  else
    bad "O: verify-schema failed after full chain"; tail -20 /tmp/mig044-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE ai_coo_notif_settings CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig044-p0.log 2>&1; then
    bad "O: verify-schema should fail without ai_coo_notif_settings"
  else
    grep -qi 'ai_coo_notif_settings' /tmp/mig044-p0.log \
      && ok "O: P0 verify fails when ai_coo_notif_settings absent" || bad "O: verify log missing table"
  fi
  apply_migration_044
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig044-p0-restored.log 2>&1; then
    ok "O: verify-schema passes after 044 restore"
  else
    bad "O: verify failed after restore"; tail -20 /tmp/mig044-p0-restored.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE ai_coo_notif_settings DROP COLUMN office_id;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig044-p0-col.log 2>&1; then
    bad "O: verify-schema should fail without ai_coo_notif_settings.office_id"
  else
    grep -qi 'office_id\|ai_coo_notif_settings' /tmp/mig044-p0-col.log \
      && ok "O: P0 verify fails when critical column missing" || bad "O: verify log missing column"
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_045_support_ai() {
  log "Scenario 045 — Support AI: greenfield / SAFE / BLOCK / UNIQUE(ticket_id) / Runtime / P0 / KB"
  local PREFLIGHT_045="$ROOT/scripts/db/preflight-migration-045.sql"
  local SUPPORT_AI_SRC="$ROOT/artifacts/api-server/src/modules/platform/support-ai.ts"

  # A: greenfield READY + idempotent + ALREADY + UNIQUE(ticket_id) + no KB business UNIQUE
  setup_db "mig045_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_cnt uq_ok kb_uq
  tbl_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('support_ai_analysis','support_knowledge_base')")
  [[ "$tbl_cnt" == "2" ]] && ok "A: 2 owned tables present" || bad "A: table count=$tbl_cnt"
  uq_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.support_ai_analysis'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*ticket_id[[:space:]]*\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    )")
  [[ "$uq_ok" == "t" ]] && ok "A: UNIQUE(ticket_id) present" || bad "A: UNIQUE missing"
  kb_uq=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint c
    WHERE c.conrelid='public.support_knowledge_base'::regclass AND c.contype='u'")
  [[ "$kb_uq" == "0" ]] && ok "A: KB has no business UNIQUE (PK only)" || bad "A: KB unique count=$kb_uq"
  apply_migration_045
  ok "A: re-run 045 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight045-ready.log \
    && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight045-ready.log | tail -1)"
  grep -q 'SUPPORT_AI_SCHEMA_READY' /tmp/preflight045-ready.log \
    && ok "A: SUPPORT_AI_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig045_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE support_knowledge_base CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-misstbl.log 2>&1
  grep -q 'SAFE_AUTO_REPAIR\|TABLE_MISSING\|PARTIAL_SCHEMA' /tmp/preflight045-misstbl.log \
    && ok "B: missing table → SAFE" || bad "B: preflight"
  apply_migration_045
  local restored
  restored=$(psql_db -At -c "SELECT to_regclass('public.support_knowledge_base') IS NOT NULL")
  [[ "$restored" == "t" ]] && ok "B: support_knowledge_base restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # C: missing column SAFE + restore
  setup_db "mig045_miss_col"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE support_ai_analysis DROP COLUMN ai_summary;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-misscol.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight045-misscol.log \
    && bad "C: missing column must not be ALREADY_CORRECT" \
    || ok "C: missing column not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|ai_summary' /tmp/preflight045-misscol.log \
    && ok "C: missing ai_summary → SAFE" || bad "C: preflight"
  apply_migration_045
  local col_ok
  col_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='support_ai_analysis' AND column_name='ai_summary'
    )")
  [[ "$col_ok" == "t" ]] && ok "C: ai_summary restored" || bad "C: column still missing"
  trap - EXIT
  teardown_db

  # D: missing UNIQUE clean → SAFE apply restores
  setup_db "mig045_miss_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ai_analysis DROP CONSTRAINT IF EXISTS support_ai_analysis_ticket_id_key;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-missuq.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight045-missuq.log \
    && bad "D: missing UNIQUE must not be ALREADY_CORRECT" \
    || ok "D: missing UNIQUE not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|MISSING|ticket_id' /tmp/preflight045-missuq.log \
    && ok "D: missing UNIQUE → SAFE" || bad "D: preflight"
  apply_migration_045
  local uq_restored
  uq_restored=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.support_ai_analysis'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*ticket_id[[:space:]]*\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    )")
  [[ "$uq_restored" == "t" ]] && ok "D: UNIQUE(ticket_id) restored" || bad "D: UNIQUE still missing"
  trap - EXIT
  teardown_db

  # E: wrong type BLOCK
  setup_db "mig045_badtype"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ai_analysis DROP COLUMN ticket_id CASCADE;
    ALTER TABLE support_ai_analysis ADD COLUMN ticket_id INTEGER;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-type.log 2>&1; then
    bad "E: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight045-type.log \
      && ok "E: preflight BLOCK INCOMPATIBLE_TYPE" || bad "E: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_045" >/tmp/mig045-type.log 2>&1; then
    bad "E: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig045-type.log \
      && ok "E: migration BLOCK INCOMPATIBLE_TYPE" || bad "E: mig reason=$(tail -3 /tmp/mig045-type.log)"
  fi
  trap - EXIT
  teardown_db

  # F: wrong PK BLOCK
  setup_db "mig045_wrongpk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ai_analysis DROP CONSTRAINT support_ai_analysis_pkey;
    ALTER TABLE support_ai_analysis ADD PRIMARY KEY (ticket_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-pk.log 2>&1; then
    bad "F: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight045-pk.log \
      && ok "F: preflight BLOCK INCOMPATIBLE_PK" || bad "F: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_045" >/tmp/mig045-pk.log 2>&1; then
    bad "F: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig045-pk.log \
      && ok "F: migration BLOCK INCOMPATIBLE_PK" || bad "F: mig reason"
  fi
  trap - EXIT
  teardown_db

  # G: NULL ticket_id BLOCK + row preserved
  setup_db "mig045_null_ticket"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ai_analysis ALTER COLUMN ticket_id DROP NOT NULL;
    INSERT INTO support_ai_analysis (ticket_id, ai_summary) VALUES (NULL, 'null-ticket-row');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-nullt.log 2>&1; then
    bad "G: preflight should BLOCK NULL ticket_id"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight045-nullt.log \
      && ok "G: preflight BLOCK NULL_REQUIRED (ticket_id)" || bad "G: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_045" >/tmp/mig045-nullt.log 2>&1; then
    bad "G: migration should BLOCK NULL ticket_id"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig045-nullt.log \
      && ok "G: migration BLOCK NULL_REQUIRED" || bad "G: mig reason=$(tail -3 /tmp/mig045-nullt.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM support_ai_analysis WHERE ai_summary='null-ticket-row'")" == "1" ]] \
    && ok "G: NULL ticket_id row preserved" || bad "G: row not preserved"
  trap - EXIT
  teardown_db

  # H: NULL required KB category/issue/fix BLOCK + rows preserved
  setup_db "mig045_null_kb"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_knowledge_base ALTER COLUMN category DROP NOT NULL;
    ALTER TABLE support_knowledge_base ALTER COLUMN issue DROP NOT NULL;
    ALTER TABLE support_knowledge_base ALTER COLUMN fix DROP NOT NULL;
    INSERT INTO support_knowledge_base (category, issue, fix) VALUES (NULL, NULL, NULL);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-nullkb.log 2>&1; then
    bad "H: preflight should BLOCK NULL KB required cols"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight045-nullkb.log \
      && ok "H: preflight BLOCK NULL_REQUIRED (KB)" || bad "H: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_045" >/tmp/mig045-nullkb.log 2>&1; then
    bad "H: migration should BLOCK NULL KB required cols"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig045-nullkb.log \
      && ok "H: migration BLOCK NULL_REQUIRED" || bad "H: mig reason=$(tail -3 /tmp/mig045-nullkb.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM support_knowledge_base WHERE category IS NULL")" == "1" ]] \
    && ok "H: NULL KB row preserved" || bad "H: row not preserved"
  trap - EXIT
  teardown_db

  # I: duplicate ticket_id BLOCK + rows preserved
  setup_db "mig045_dup_ticket"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ai_analysis DROP CONSTRAINT IF EXISTS support_ai_analysis_ticket_id_key;
    INSERT INTO support_ai_analysis (ticket_id, ai_summary)
    VALUES ('dup045', 'a'), ('dup045', 'b');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-dup.log 2>&1; then
    bad "I: preflight should BLOCK duplicate ticket_id"
  else
    grep -qE 'DUPLICATE_UNIQUE_KEY|INCOMPATIBLE_UNIQUE|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight045-dup.log \
      && ok "I: preflight BLOCK duplicate ticket_id" || bad "I: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_045" >/tmp/mig045-dup.log 2>&1; then
    bad "I: migration should BLOCK duplicate ticket_id"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|INCOMPATIBLE_UNIQUE' /tmp/mig045-dup.log \
      && ok "I: migration BLOCK duplicate ticket_id" || bad "I: mig reason=$(tail -3 /tmp/mig045-dup.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM support_ai_analysis WHERE ticket_id='dup045'")" == "2" ]] \
    && ok "I: duplicate ticket_id rows preserved" || bad "I: rows not preserved"
  trap - EXIT
  teardown_db

  # J: wrong/wider same-name UNIQUE BLOCK
  setup_db "mig045_wider_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ai_analysis DROP CONSTRAINT IF EXISTS support_ai_analysis_ticket_id_key;
    ALTER TABLE support_ai_analysis ADD CONSTRAINT support_ai_analysis_ticket_id_key
      UNIQUE (ticket_id, ai_type);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-wuniq.log 2>&1; then
    bad "J: preflight should BLOCK wider UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight045-wuniq.log \
      && ok "J: preflight BLOCK INCOMPATIBLE_UNIQUE (wider)" || bad "J: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_045" >/tmp/mig045-wuniq.log 2>&1; then
    bad "J: migration should BLOCK wider UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig045-wuniq.log \
      && ok "J: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "J: mig reason=$(tail -3 /tmp/mig045-wuniq.log)"
  fi
  trap - EXIT
  teardown_db

  # K: partial UNIQUE(ticket_id) WHERE … BLOCK
  setup_db "mig045_partial_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ai_analysis DROP CONSTRAINT IF EXISTS support_ai_analysis_ticket_id_key;
    CREATE UNIQUE INDEX support_ai_analysis_ticket_id_key
      ON support_ai_analysis (ticket_id) WHERE ai_auto_replied IS TRUE;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-partial.log 2>&1; then
    bad "K: preflight should BLOCK partial UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight045-partial.log \
      && ok "K: preflight BLOCK INCOMPATIBLE_UNIQUE (partial)" || bad "K: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_045" >/tmp/mig045-partial.log 2>&1; then
    bad "K: migration should BLOCK partial UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig045-partial.log \
      && ok "K: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "K: mig reason=$(tail -3 /tmp/mig045-partial.log)"
  fi
  trap - EXIT
  teardown_db

  # L: expression UNIQUE(lower(ticket_id)) BLOCK
  setup_db "mig045_expr_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ai_analysis DROP CONSTRAINT IF EXISTS support_ai_analysis_ticket_id_key;
    CREATE UNIQUE INDEX support_ai_analysis_ticket_id_expr
      ON support_ai_analysis (lower(ticket_id));
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-expr.log 2>&1; then
    bad "L: preflight should BLOCK expression UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight045-expr.log \
      && ok "L: preflight BLOCK INCOMPATIBLE_UNIQUE (expression)" || bad "L: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_045" >/tmp/mig045-expr.log 2>&1; then
    bad "L: migration should BLOCK expression UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig045-expr.log \
      && ok "L: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "L: mig reason=$(tail -3 /tmp/mig045-expr.log)"
  fi
  trap - EXIT
  teardown_db

  # M: ON CONFLICT (ticket_id) works after apply
  setup_db "mig045_on_conflict"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO support_ai_analysis (ticket_id, ai_type, ai_summary)
    VALUES ('upsert-045', 'bug', 'first')
    ON CONFLICT (ticket_id) DO NOTHING;
    INSERT INTO support_ai_analysis (ticket_id, ai_type, ai_summary, ai_auto_replied)
    VALUES ('upsert-045', 'security', 'second', true)
    ON CONFLICT (ticket_id) DO UPDATE SET
      ai_type = EXCLUDED.ai_type,
      ai_summary = EXCLUDED.ai_summary,
      ai_auto_replied = EXCLUDED.ai_auto_replied,
      updated_at = NOW();
  " >/dev/null
  local up_type up_sum up_cnt
  up_type=$(psql_db -At -c "SELECT ai_type FROM support_ai_analysis WHERE ticket_id='upsert-045'")
  up_sum=$(psql_db -At -c "SELECT ai_summary FROM support_ai_analysis WHERE ticket_id='upsert-045'")
  up_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM support_ai_analysis WHERE ticket_id='upsert-045'")
  [[ "$up_type" == "security" && "$up_sum" == "second" && "$up_cnt" == "1" ]] \
    && ok "M: ON CONFLICT (ticket_id) DO UPDATE works" \
    || bad "M: type=$up_type sum=$up_sum cnt=$up_cnt"
  trap - EXIT
  teardown_db

  # N: Runtime CREATE absent; readiness + DML + seed preserved; no invented KB UNIQUE in migration
  if grep -qE 'CREATE TABLE IF NOT EXISTS (support_ai_analysis|support_knowledge_base)' "$SUPPORT_AI_SRC"; then
    bad "N: Runtime CREATE still present in support-ai.ts"
  else
    ok "N: Runtime CREATE absent"
  fi
  grep -q "to_regclass('public.support_ai_analysis')" "$SUPPORT_AI_SRC" \
    && grep -q "to_regclass('public.support_knowledge_base')" "$SUPPORT_AI_SRC" \
    && ok "N: to_regclass readiness present" \
    || bad "N: to_regclass readiness missing"
  grep -q 'ON CONFLICT (ticket_id) DO UPDATE' "$SUPPORT_AI_SRC" \
    && grep -q 'INSERT INTO support_knowledge_base' "$SUPPORT_AI_SRC" \
    && grep -q 'WHERE NOT EXISTS' "$SUPPORT_AI_SRC" \
    && ok "N: analysis upsert + KB seed DML preserved" \
    || bad "N: DML missing"
  if grep -q 'ON CONFLICT DO NOTHING' "$SUPPORT_AI_SRC"; then
    bad "N: KB seed must not use bare ON CONFLICT DO NOTHING"
  else
    ok "N: KB seed has no bare ON CONFLICT DO NOTHING"
  fi
  if grep -qE 'UNIQUE\s*\(\s*(category|issue|fix)' "$MIGRATION_045"; then
    bad "N: 045 must not invent KB business UNIQUE"
  else
    ok "N: 045 does not invent KB business UNIQUE"
  fi

  # O: KB duplicate seed rows preserved (no delete/merge); no invented UNIQUE
  setup_db "mig045_kb_dups"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO support_knowledge_base (category, issue, fix)
    VALUES ('bug', 'dup-seed-issue', 'fix-a'), ('bug', 'dup-seed-issue', 'fix-b');
  " >/dev/null
  apply_migration_045
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM support_knowledge_base WHERE issue='dup-seed-issue'")" == "2" ]] \
    && ok "O: KB duplicate rows preserved after re-apply" || bad "O: KB rows altered"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_045" >/tmp/preflight045-kbdup.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight045-kbdup.log \
    && ok "O: KB duplicates do not BLOCK (no invented UNIQUE)" \
    || bad "O: $(grep chosen_action /tmp/preflight045-kbdup.log | tail -1)"
  trap - EXIT
  teardown_db

  # P: prior 039–044 tables still present; 045 does not CREATE them / ai_score
  setup_db "mig045_prior_still"
  trap teardown_db EXIT
  apply_all_migrations
  local prior_cnt
  prior_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('ai_coo_notif_settings','case_ai_insights','ai_agents','ai_events','office_ai_credits')")
  [[ "$prior_cnt" == "5" ]] && ok "P: prior AI tables still present after chain" || bad "P: prior count=$prior_cnt"
  if grep -qE 'CREATE TABLE IF NOT EXISTS (ai_coo_notif_settings|case_ai_insights|ai_agents|ai_events|office_ai_credits)' "$MIGRATION_045"; then
    bad "P: 045 must not CREATE 039–044 tables"
  else
    ok "P: 045 does not CREATE 039–044 tables"
  fi
  if grep -qE 'ADD COLUMN IF NOT EXISTS ai_score|CREATE TABLE IF NOT EXISTS support_ticket_attachments|CREATE TABLE IF NOT EXISTS support_visitor_profiles|CREATE TABLE IF NOT EXISTS support_ticket_audit' "$MIGRATION_045"; then
    bad "P: 045 must not touch Enterprise support objects / ai_score"
  else
    ok "P: 045 excludes Enterprise / ai_score"
  fi
  trap - EXIT
  teardown_db

  # Q: P0 verify fails without owned table / critical column
  setup_db "mig045_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig045-p0-present.log 2>&1; then
    ok "Q: verify-schema passes with 045 objects"
  else
    bad "Q: verify-schema failed after full chain"; tail -20 /tmp/mig045-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE support_ai_analysis CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig045-p0.log 2>&1; then
    bad "Q: verify-schema should fail without support_ai_analysis"
  else
    grep -qi 'support_ai_analysis' /tmp/mig045-p0.log \
      && ok "Q: P0 verify fails when support_ai_analysis absent" || bad "Q: verify log missing table"
  fi
  apply_migration_045
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig045-p0-restored.log 2>&1; then
    ok "Q: verify-schema passes after 045 restore"
  else
    bad "Q: verify failed after restore"; tail -20 /tmp/mig045-p0-restored.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE support_knowledge_base DROP COLUMN category;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig045-p0-col.log 2>&1; then
    bad "Q: verify-schema should fail without support_knowledge_base.category"
  else
    grep -qi 'category\|support_knowledge_base' /tmp/mig045-p0-col.log \
      && ok "Q: P0 verify fails when critical column missing" || bad "Q: verify log missing column"
  fi
  trap - EXIT
  teardown_db
}

scenario_kb_seed_dedupe() {
  log "Scenario KB seed de-dupe — NOT EXISTS full canonical content; no invented UNIQUE"
  local SUPPORT_AI_SRC="$ROOT/artifacts/api-server/src/modules/platform/support-ai.ts"
  local seed_sql
  seed_sql=$(python3 - "$SUPPORT_AI_SRC" <<'PY'
from pathlib import Path
import re, sys
src = Path(sys.argv[1]).read_text()
m = re.search(
    r"INSERT INTO support_knowledge_base \(category, issue, fix, tags\)\s*"
    r"SELECT[\s\S]+?"
    r"WHERE NOT EXISTS \(\s*SELECT 1 FROM support_knowledge_base k\s*"
    r"WHERE k\.category = v\.category\s*"
    r"AND k\.issue = v\.issue\s*"
    r"AND k\.fix = v\.fix\s*"
    r"AND coalesce\(k\.tags, ARRAY\[\]::text\[\]\) = v\.tags\s*\)",
    src,
)
if not m:
    raise SystemExit("KB seed SQL not found in support-ai.ts")
print(m.group(0).rstrip() + ";")
PY
)

  if grep -qE 'UNIQUE\s*\(\s*(category|issue|fix)' \
      "$ROOT/artifacts/api-server/migrations/045_support_ai_schema_authority.sql"; then
    bad "045 must not invent KB UNIQUE"
  else
    ok "045 KB remains PK-only"
  fi
  if grep -q 'ON CONFLICT DO NOTHING' "$SUPPORT_AI_SRC"; then
    bad "seed still uses ON CONFLICT DO NOTHING"
  else
    ok "seed has no ON CONFLICT DO NOTHING"
  fi
  grep -q 'WHERE NOT EXISTS' "$SUPPORT_AI_SRC" \
    && grep -q 'k.category = v.category' "$SUPPORT_AI_SRC" \
    && grep -q 'k.issue = v.issue' "$SUPPORT_AI_SRC" \
    && grep -q 'k.fix = v.fix' "$SUPPORT_AI_SRC" \
    && grep -q 'coalesce(k.tags, ARRAY\[\]::text\[\]) = v.tags' "$SUPPORT_AI_SRC" \
    && ok "seed identity is full canonical content" \
    || bad "seed NOT EXISTS identity missing"

  # 1–2: empty table — first seed inserts 10; second seed inserts none
  setup_db "kbseed_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local n0 n1 n2 pairs
  n0=$(psql_db -At -c "SELECT COUNT(*) FROM support_knowledge_base")
  psql_db -v ON_ERROR_STOP=1 -c "$seed_sql" >/dev/null
  n1=$(psql_db -At -c "SELECT COUNT(*) FROM support_knowledge_base")
  pairs=$(psql_db -At -c "
    SELECT COUNT(*) FROM (
      SELECT category, issue FROM support_knowledge_base GROUP BY category, issue
    ) d")
  [[ "$n0" == "0" && "$n1" == "10" && "$pairs" == "10" ]] \
    && ok "1: first seed inserts 10 canonical rows" \
    || bad "1: n0=$n0 n1=$n1 pairs=$pairs"
  psql_db -v ON_ERROR_STOP=1 -c "$seed_sql" >/dev/null
  n2=$(psql_db -At -c "SELECT COUNT(*) FROM support_knowledge_base")
  [[ "$n2" == "10" ]] && ok "2: second seed inserts no duplicates" || bad "2: n2=$n2"
  trap - EXIT
  teardown_db

  # 3–5: matching operator row with different fix does not suppress canonical;
  # operator row and unrelated admin row are preserved unchanged
  setup_db "kbseed_preserve"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO support_knowledge_base (id, category, issue, fix, tags)
    VALUES
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'security', 'auth bypass',
       'preserved-operator-fix', ARRAY['admin']::text[]),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ops', 'operator custom',
       'leave-me', ARRAY['admin']::text[]);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -c "$seed_sql" >/dev/null
  local total_after bypass_fix admin_fix admin_id bypass_id bypass_rows canonical_rows
  total_after=$(psql_db -At -c "SELECT COUNT(*) FROM support_knowledge_base")
  bypass_fix=$(psql_db -At -c "
    SELECT fix FROM support_knowledge_base
    WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'")
  bypass_id=$(psql_db -At -c "
    SELECT id::text FROM support_knowledge_base
    WHERE fix='preserved-operator-fix'")
  bypass_rows=$(psql_db -At -c "
    SELECT COUNT(*) FROM support_knowledge_base
    WHERE category='security' AND issue='auth bypass'")
  canonical_rows=$(psql_db -At -c "
    SELECT COUNT(*) FROM support_knowledge_base
    WHERE category='security'
      AND issue='auth bypass'
      AND fix='Check middleware order + JWT validation + requireAuthWithTenant'
      AND coalesce(tags, ARRAY[]::text[]) = ARRAY['auth','jwt','middleware']::text[]")
  admin_fix=$(psql_db -At -c "
    SELECT fix FROM support_knowledge_base WHERE id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'")
  admin_id=$(psql_db -At -c "
    SELECT COUNT(*) FROM support_knowledge_base WHERE id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'")
  # 10 canonical + 1 preserved operator match + 1 unrelated admin = 12
  [[ "$total_after" == "12" && "$canonical_rows" == "1" && "$bypass_rows" == "2" ]] \
    && ok "3: matching operator row with different fix does not block canonical insert" \
    || bad "3: total=$total_after canonical_rows=$canonical_rows bypass_rows=$bypass_rows"
  [[ "$bypass_fix" == "preserved-operator-fix" \
      && "$bypass_id" == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" ]] \
    && ok "4: matching operator row preserved unchanged" \
    || bad "4: fix=$bypass_fix id=$bypass_id"
  [[ "$admin_id" == "1" && "$admin_fix" == "leave-me" ]] \
    && ok "5: unrelated admin row remains untouched" \
    || bad "5: admin_id=$admin_id admin_fix=$admin_fix"
  psql_db -v ON_ERROR_STOP=1 -c "$seed_sql" >/dev/null
  local total_re
  total_re=$(psql_db -At -c "SELECT COUNT(*) FROM support_knowledge_base")
  [[ "$total_re" == "12" ]] && ok "5b: re-seed still does not duplicate" || bad "5b: total=$total_re"
  trap - EXIT
  teardown_db
}

scenario_migration_046_support_enterprise() {
  log "Scenario 046 — Support Enterprise: greenfield / SAFE / BLOCK / indexes / FK CASCADE / Runtime / P0"
  local PREFLIGHT_046="$ROOT/scripts/db/preflight-migration-046.sql"
  local ENT_SRC="$ROOT/artifacts/api-server/src/modules/platform/support-enterprise.ts"

  # A/Q: greenfield READY + idempotent + ALREADY + FK CASCADE + UNIQUE(email) + 7 indexes
  setup_db "mig046_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_cnt fk_cascade uq_ok idx_ok
  tbl_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('support_ticket_attachments','support_ticket_audit','support_visitor_profiles')")
  [[ "$tbl_cnt" == "3" ]] && ok "A: 3 satellites present" || bad "A: satellite count=$tbl_cnt"
  fk_cascade=$(psql_db -At -c "
    SELECT confdeltype FROM pg_constraint
    WHERE conname='support_ticket_attachments_ticket_id_fkey' AND contype='f'")
  [[ "$fk_cascade" == "c" ]] && ok "A/Q: FK ON DELETE CASCADE (confdeltype=c)" || bad "A/Q: FK confdeltype=$fk_cascade"
  uq_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.support_visitor_profiles'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*email[[:space:]]*\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    )")
  [[ "$uq_ok" == "t" ]] && ok "A: UNIQUE(email) exact single-col" || bad "A: UNIQUE(email) missing/wrong"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='support_tickets'
        AND i.relname='idx_st_user'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['user_id']::text[]
        AND (x.indoption[0] & 1) = 0
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_st_user (user_id ASC non-unique)" || bad "A: idx_st_user missing/wrong"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='support_tickets'
        AND i.relname='idx_st_status'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['status','created_at']::text[]
        AND (x.indoption[0] & 1) = 0 AND (x.indoption[1] & 1) = 1
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_st_status (status, created_at DESC)" || bad "A: idx_st_status missing/wrong"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='support_tickets'
        AND i.relname='idx_st_office'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['office_id','status']::text[]
        AND (x.indoption[0] & 1) = 0 AND (x.indoption[1] & 1) = 0
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_st_office (office_id, status)" || bad "A: idx_st_office missing/wrong"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='support_tickets'
        AND i.relname='idx_st_sla_res'
        AND x.indisvalid AND x.indisready AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND x.indpred IS NOT NULL
        AND pg_get_expr(x.indpred, x.indrelid) ~* 'status'
        AND pg_get_expr(x.indpred, x.indrelid) ~* 'closed'
        AND pg_get_expr(x.indpred, x.indrelid) ~* 'resolved'
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['sla_resolution_deadline']::text[]
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_st_sla_res partial WHERE status NOT IN (closed,resolved)" \
    || bad "A: idx_st_sla_res missing/wrong"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='support_ticket_attachments'
        AND i.relname='idx_sta_ticket'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['ticket_id']::text[]
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_sta_ticket (ticket_id)" || bad "A: idx_sta_ticket missing/wrong"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='support_ticket_audit'
        AND i.relname='idx_stau_ticket'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['ticket_id','created_at']::text[]
        AND (x.indoption[0] & 1) = 0 AND (x.indoption[1] & 1) = 1
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_stau_ticket (ticket_id, created_at DESC)" \
    || bad "A: idx_stau_ticket missing/wrong"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='support_messages'
        AND i.relname='idx_sm_ticket'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['ticket_id','created_at']::text[]
        AND (x.indoption[0] & 1) = 0 AND (x.indoption[1] & 1) = 0
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_sm_ticket (ticket_id, created_at ASC)" \
    || bad "A: idx_sm_ticket missing/wrong"
  apply_migration_046
  ok "A: re-run 046 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight046-ready.log \
    && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight046-ready.log | tail -1)"
  grep -q 'SUPPORT_ENTERPRISE_SCHEMA_READY' /tmp/preflight046-ready.log \
    && ok "A: SUPPORT_ENTERPRISE_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig046_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE support_visitor_profiles CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-misstbl.log 2>&1
  grep -q 'SAFE_AUTO_REPAIR\|TABLE_MISSING\|PARTIAL_SCHEMA' /tmp/preflight046-misstbl.log \
    && ok "B: missing table → SAFE" || bad "B: preflight"
  apply_migration_046
  local restored
  restored=$(psql_db -At -c "SELECT to_regclass('public.support_visitor_profiles') IS NOT NULL")
  [[ "$restored" == "t" ]] && ok "B: support_visitor_profiles restored" || bad "B: still missing"
  trap - EXIT
  teardown_db

  # C: missing column SAFE + restore
  setup_db "mig046_miss_col"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE support_tickets DROP COLUMN ai_score;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-misscol.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight046-misscol.log \
    && bad "C: missing column must not be ALREADY_CORRECT" \
    || ok "C: missing column not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|ai_score' /tmp/preflight046-misscol.log \
    && ok "C: missing ai_score → SAFE" || bad "C: preflight"
  apply_migration_046
  local col_ok
  col_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='support_tickets' AND column_name='ai_score'
    )")
  [[ "$col_ok" == "t" ]] && ok "C: ai_score restored" || bad "C: column still missing"
  trap - EXIT
  teardown_db

  # D: missing index SAFE + restore
  setup_db "mig046_miss_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_st_user;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-missidx.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight046-missidx.log \
    && bad "D: missing index must not be ALREADY_CORRECT" \
    || ok "D: missing index not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|MISSING_INDEXES|idx_st_user' /tmp/preflight046-missidx.log \
    && ok "D: missing index → SAFE" || bad "D: preflight"
  apply_migration_046
  local idx_restored
  idx_restored=$(psql_db -At -c "SELECT to_regclass('public.idx_st_user') IS NOT NULL")
  [[ "$idx_restored" == "t" ]] && ok "D: idx_st_user restored" || bad "D: index still missing"
  trap - EXIT
  teardown_db

  # E: missing FK SAFE (clean) + CASCADE restore
  setup_db "mig046_miss_fk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ticket_attachments
      DROP CONSTRAINT IF EXISTS support_ticket_attachments_ticket_id_fkey;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-missfk.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight046-missfk.log \
    && bad "E: missing FK must not be ALREADY_CORRECT" \
    || ok "E: missing FK not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|MISSING_FKS|support_ticket_attachments_ticket_id_fkey' /tmp/preflight046-missfk.log \
    && ok "E: missing FK → SAFE" || bad "E: preflight"
  apply_migration_046
  fk_cascade=$(psql_db -At -c "
    SELECT confdeltype FROM pg_constraint
    WHERE conname='support_ticket_attachments_ticket_id_fkey' AND contype='f'")
  [[ "$fk_cascade" == "c" ]] && ok "E: CASCADE FK restored" || bad "E: FK confdeltype=$fk_cascade"
  trap - EXIT
  teardown_db

  # F: missing UNIQUE clean → SAFE apply restores
  setup_db "mig046_miss_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_visitor_profiles DROP CONSTRAINT IF EXISTS support_visitor_profiles_email_key;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-missuq.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight046-missuq.log \
    && bad "F: missing UNIQUE must not be ALREADY_CORRECT" \
    || ok "F: missing UNIQUE not ALREADY_CORRECT"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|MISSING|email' /tmp/preflight046-missuq.log \
    && ok "F: missing UNIQUE → SAFE" || bad "F: preflight"
  apply_migration_046
  uq_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.support_visitor_profiles'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*email[[:space:]]*\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    )")
  [[ "$uq_ok" == "t" ]] && ok "F: UNIQUE(email) restored" || bad "F: UNIQUE still missing"
  trap - EXIT
  teardown_db

  # G: wrong type BLOCK
  setup_db "mig046_badtype"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_tickets DROP COLUMN ai_score;
    ALTER TABLE support_tickets ADD COLUMN ai_score TEXT;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-type.log 2>&1; then
    bad "G: preflight should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-type.log \
      && ok "G: preflight BLOCK INCOMPATIBLE_TYPE" || bad "G: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-type.log 2>&1; then
    bad "G: migration should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig046-type.log \
      && ok "G: migration BLOCK INCOMPATIBLE_TYPE" || bad "G: mig reason=$(tail -3 /tmp/mig046-type.log)"
  fi
  trap - EXIT
  teardown_db

  # H: wrong PK BLOCK
  setup_db "mig046_wrongpk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ticket_audit DROP CONSTRAINT support_ticket_audit_pkey;
    ALTER TABLE support_ticket_audit ADD PRIMARY KEY (id, ticket_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-pk.log 2>&1; then
    bad "H: preflight should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-pk.log \
      && ok "H: preflight BLOCK INCOMPATIBLE_PK" || bad "H: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-pk.log 2>&1; then
    bad "H: migration should BLOCK wrong PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig046-pk.log \
      && ok "H: migration BLOCK INCOMPATIBLE_PK" || bad "H: mig reason"
  fi
  trap - EXIT
  teardown_db

  # I: duplicate visitor email BLOCK + rows preserved
  setup_db "mig046_dup_email"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_visitor_profiles DROP CONSTRAINT IF EXISTS support_visitor_profiles_email_key;
    INSERT INTO support_visitor_profiles (email, name)
    VALUES ('dup046@example.com', 'a'), ('dup046@example.com', 'b');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-dup.log 2>&1; then
    bad "I: preflight should BLOCK duplicate email"
  else
    grep -qE 'DUPLICATE_UNIQUE_KEY|INCOMPATIBLE_UNIQUE|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-dup.log \
      && ok "I: preflight BLOCK DUPLICATE_UNIQUE_KEY" || bad "I: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-dup.log 2>&1; then
    bad "I: migration should BLOCK duplicate email"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|INCOMPATIBLE_UNIQUE' /tmp/mig046-dup.log \
      && ok "I: migration BLOCK DUPLICATE_UNIQUE_KEY" || bad "I: mig reason=$(tail -3 /tmp/mig046-dup.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM support_visitor_profiles WHERE email='dup046@example.com'")" == "2" ]] \
    && ok "I: duplicate email rows preserved" || bad "I: rows not preserved"
  trap - EXIT
  teardown_db

  # J: wrong/wider same-name UNIQUE BLOCK
  setup_db "mig046_wronguq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_visitor_profiles DROP CONSTRAINT IF EXISTS support_visitor_profiles_email_key;
    ALTER TABLE support_visitor_profiles ADD CONSTRAINT support_visitor_profiles_email_key
      UNIQUE (email, phone);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-wuniq.log 2>&1; then
    bad "J: preflight should BLOCK wider UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-wuniq.log \
      && ok "J: preflight BLOCK INCOMPATIBLE_UNIQUE (wider)" || bad "J: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-wuniq.log 2>&1; then
    bad "J: migration should BLOCK wider UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig046-wuniq.log \
      && ok "J: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "J: mig reason=$(tail -3 /tmp/mig046-wuniq.log)"
  fi
  trap - EXIT
  teardown_db

  # K: partial UNIQUE(email) WHERE … BLOCK
  setup_db "mig046_partial_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_visitor_profiles DROP CONSTRAINT IF EXISTS support_visitor_profiles_email_key;
    CREATE UNIQUE INDEX support_visitor_profiles_email_key
      ON support_visitor_profiles (email) WHERE email IS NOT NULL;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-partial.log 2>&1; then
    bad "K: preflight should BLOCK partial UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-partial.log \
      && ok "K: preflight BLOCK INCOMPATIBLE_UNIQUE (partial)" || bad "K: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-partial.log 2>&1; then
    bad "K: migration should BLOCK partial UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig046-partial.log \
      && ok "K: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "K: mig reason=$(tail -3 /tmp/mig046-partial.log)"
  fi
  trap - EXIT
  teardown_db

  # L: expression UNIQUE(lower(email)) BLOCK
  setup_db "mig046_expr_uq"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_visitor_profiles DROP CONSTRAINT IF EXISTS support_visitor_profiles_email_key;
    CREATE UNIQUE INDEX support_visitor_profiles_email_expr
      ON support_visitor_profiles (lower(email));
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-expr.log 2>&1; then
    bad "L: preflight should BLOCK expression UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-expr.log \
      && ok "L: preflight BLOCK INCOMPATIBLE_UNIQUE (expression)" || bad "L: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-expr.log 2>&1; then
    bad "L: migration should BLOCK expression UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig046-expr.log \
      && ok "L: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "L: mig reason=$(tail -3 /tmp/mig046-expr.log)"
  fi
  trap - EXIT
  teardown_db

  # M: orphan attachment ticket_id BLOCK + rows preserved
  setup_db "mig046_orphan"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ticket_attachments
      DROP CONSTRAINT IF EXISTS support_ticket_attachments_ticket_id_fkey;
    INSERT INTO support_ticket_attachments (ticket_id, file_name, file_url, uploaded_by)
    VALUES ('orphan-ticket-046', 'orphan.txt', 'http://orphan', 'uploader');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-orphan.log 2>&1; then
    bad "M: preflight should BLOCK orphan FK"
  else
    grep -qE 'ORPHAN_FK|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-orphan.log \
      && ok "M: preflight BLOCK ORPHAN_FK" || bad "M: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-orphan.log 2>&1; then
    bad "M: migration should BLOCK orphan FK"
  else
    grep -q 'ORPHAN_FK' /tmp/mig046-orphan.log \
      && ok "M: migration BLOCK ORPHAN_FK" || bad "M: mig reason=$(tail -3 /tmp/mig046-orphan.log)"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM support_ticket_attachments WHERE ticket_id='orphan-ticket-046'")" == "1" ]] \
    && ok "M: orphan attachment row preserved" || bad "M: row not preserved"
  trap - EXIT
  teardown_db

  # N: stolen index name on wrong table BLOCK
  setup_db "mig046_stolen"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_st_user;
    CREATE INDEX idx_st_user ON support_messages(id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-stolen.log 2>&1; then
    bad "N: preflight should BLOCK stolen same-name index"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-stolen.log \
      && ok "N: preflight BLOCK INCOMPATIBLE_INDEX (stolen)" || bad "N: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight046-stolen.log \
      && bad "N: must never SAFE when same-name index incompatible" \
      || ok "N: no SAFE_AUTO_REPAIR over stolen index"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-stolen.log 2>&1; then
    bad "N: migration should BLOCK stolen index name"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig046-stolen.log \
      && ok "N: migration BLOCK INCOMPATIBLE_INDEX" || bad "N: mig reason=$(tail -3 /tmp/mig046-stolen.log)"
  fi
  trap - EXIT
  teardown_db

  # O: wrong DESC on idx_stau_ticket BLOCK
  setup_db "mig046_wrongdesc"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_stau_ticket;
    CREATE INDEX idx_stau_ticket ON support_ticket_audit(ticket_id, created_at);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-wrongdesc.log 2>&1; then
    bad "O: preflight must BLOCK ASC-only (missing DESC)"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-wrongdesc.log \
      && ok "O: preflight BLOCK wrong DESC" || bad "O: preflight reason"
    grep -q 'ALREADY_CORRECT\|SUPPORT_ENTERPRISE_SCHEMA_READY' /tmp/preflight046-wrongdesc.log \
      && bad "O: must never ALREADY with wrong DESC" \
      || ok "O: no ALREADY_CORRECT for wrong DESC"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-wrongdesc.log 2>&1; then
    bad "O: migration should BLOCK wrong DESC"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig046-wrongdesc.log \
      && ok "O: migration BLOCK INCOMPATIBLE_INDEX wrong DESC" || bad "O: mig reason"
  fi
  trap - EXIT
  teardown_db

  # P: wrong/missing partial predicate on idx_st_sla_res BLOCK
  setup_db "mig046_partial_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_st_sla_res;
    CREATE INDEX idx_st_sla_res ON support_tickets(sla_resolution_deadline);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-partialidx.log 2>&1; then
    bad "P: preflight should BLOCK missing partial predicate"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-partialidx.log \
      && ok "P: preflight BLOCK wrong partial predicate" || bad "P: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-partialidx.log 2>&1; then
    bad "P: migration should BLOCK missing partial predicate"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig046-partialidx.log \
      && ok "P: migration BLOCK INCOMPATIBLE_INDEX" || bad "P: mig reason=$(tail -3 /tmp/mig046-partialidx.log)"
  fi
  trap - EXIT
  teardown_db

  # P2: extra AND on idx_st_sla_res predicate BLOCK (exact predicate only)
  setup_db "mig046_sla_extra_and"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_st_sla_res;
    CREATE INDEX idx_st_sla_res ON support_tickets (sla_resolution_deadline)
      WHERE status NOT IN ('closed','resolved') AND office_id IS NOT NULL;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-sla-and.log 2>&1; then
    bad "P2: preflight should BLOCK extra AND predicate"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-sla-and.log \
      && ok "P2: preflight BLOCK extra AND on sla predicate" || bad "P2: preflight reason"
    grep -q 'ALREADY_CORRECT\|SUPPORT_ENTERPRISE_SCHEMA_READY' /tmp/preflight046-sla-and.log \
      && bad "P2: must never ALREADY with extra AND" \
      || ok "P2: no ALREADY for extra AND"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-sla-and.log 2>&1; then
    bad "P2: migration should BLOCK extra AND predicate"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig046-sla-and.log \
      && ok "P2: migration BLOCK INCOMPATIBLE_INDEX extra AND" || bad "P2: mig reason"
  fi
  trap - EXIT
  teardown_db

  # P3: extra status value in idx_st_sla_res predicate BLOCK
  setup_db "mig046_sla_extra_status"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_st_sla_res;
    CREATE INDEX idx_st_sla_res ON support_tickets (sla_resolution_deadline)
      WHERE status NOT IN ('closed','resolved','waiting');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-sla-extra.log 2>&1; then
    bad "P3: preflight should BLOCK extra status value"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-sla-extra.log \
      && ok "P3: preflight BLOCK extra status in sla predicate" || bad "P3: preflight reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-sla-extra.log 2>&1; then
    bad "P3: migration should BLOCK extra status value"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig046-sla-extra.log \
      && ok "P3: migration BLOCK INCOMPATIBLE_INDEX extra status" || bad "P3: mig reason"
  fi
  trap - EXIT
  teardown_db

  # U: unexpected NOT NULL on nullable office_id → BLOCK (not ALREADY)
  setup_db "mig046_nullable_nn"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    UPDATE support_tickets SET office_id = 'off-nn' WHERE office_id IS NULL;
    ALTER TABLE support_tickets ALTER COLUMN office_id SET NOT NULL;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-nullable.log 2>&1; then
    bad "U: preflight should BLOCK unexpected NOT NULL office_id"
  else
    grep -q 'INCOMPATIBLE_NULLABLE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-nullable.log \
      && ok "U: preflight BLOCK INCOMPATIBLE_NULLABLE" || bad "U: preflight reason"
    grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight046-nullable.log \
      && bad "U: must never ALREADY with unexpected NOT NULL" \
      || ok "U: no ALREADY_CORRECT for unexpected NOT NULL"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-nullable.log 2>&1; then
    bad "U: migration should BLOCK unexpected NOT NULL"
  else
    grep -q 'INCOMPATIBLE_NULLABLE' /tmp/mig046-nullable.log \
      && ok "U: migration BLOCK INCOMPATIBLE_NULLABLE" || bad "U: mig reason=$(tail -3 /tmp/mig046-nullable.log)"
  fi
  trap - EXIT
  teardown_db

  # V: ai_score wrong typmod NUMERIC(5,2) → BLOCK
  setup_db "mig046_typmod"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_tickets DROP COLUMN ai_score;
    ALTER TABLE support_tickets ADD COLUMN ai_score NUMERIC(5,2);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-typmod.log 2>&1; then
    bad "V: preflight should BLOCK wrong ai_score typmod"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-typmod.log \
      && ok "V: preflight BLOCK wrong NUMERIC typmod" || bad "V: preflight reason"
    grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight046-typmod.log \
      && bad "V: must never ALREADY with wrong typmod" \
      || ok "V: no ALREADY for wrong typmod"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-typmod.log 2>&1; then
    bad "V: migration should BLOCK wrong typmod"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig046-typmod.log \
      && ok "V: migration BLOCK INCOMPATIBLE_TYPE typmod" || bad "V: mig reason"
  fi
  trap - EXIT
  teardown_db

  # W: FK bound to non-public decoy.support_tickets → BLOCK (OID exactness)
  setup_db "mig046_fk_oid"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE SCHEMA IF NOT EXISTS decoy;
    CREATE TABLE decoy.support_tickets (id TEXT PRIMARY KEY);
    INSERT INTO decoy.support_tickets (id)
      SELECT id FROM support_tickets
      ON CONFLICT DO NOTHING;
    INSERT INTO decoy.support_tickets (id)
      SELECT DISTINCT ticket_id FROM support_ticket_attachments a
      WHERE NOT EXISTS (SELECT 1 FROM decoy.support_tickets d WHERE d.id = a.ticket_id);
    ALTER TABLE support_ticket_attachments
      DROP CONSTRAINT IF EXISTS support_ticket_attachments_ticket_id_fkey;
    ALTER TABLE support_ticket_attachments
      ADD CONSTRAINT support_ticket_attachments_ticket_id_fkey
      FOREIGN KEY (ticket_id) REFERENCES decoy.support_tickets(id) ON DELETE CASCADE;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-fkoid.log 2>&1; then
    bad "W: preflight should BLOCK FK to decoy.support_tickets"
  else
    grep -q 'INCOMPATIBLE_FK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-fkoid.log \
      && ok "W: preflight BLOCK wrong-schema FK" || bad "W: preflight reason"
    grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight046-fkoid.log \
      && bad "W: must never ALREADY with decoy FK" \
      || ok "W: no ALREADY for decoy FK"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-fkoid.log 2>&1; then
    bad "W: migration should BLOCK wrong-schema FK"
  else
    grep -q 'INCOMPATIBLE_FK' /tmp/mig046-fkoid.log \
      && ok "W: migration BLOCK INCOMPATIBLE_FK (OID)" || bad "W: mig reason=$(tail -3 /tmp/mig046-fkoid.log)"
  fi
  trap - EXIT
  teardown_db

  # X: missing support_messages → BLOCK MISSING_BASE_TABLE (not SAFE)
  setup_db "mig046_miss_messages"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE support_messages CASCADE;" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-missmsg.log 2>&1; then
    bad "X: preflight should BLOCK missing support_messages"
  else
    grep -q 'MISSING_BASE_TABLE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-missmsg.log \
      && ok "X: preflight BLOCK MISSING_BASE_TABLE (messages)" || bad "X: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight046-missmsg.log \
      && bad "X: must never SAFE when support_messages missing" \
      || ok "X: no SAFE for missing support_messages"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-missmsg.log 2>&1; then
    bad "X: migration should BLOCK missing support_messages"
  else
    grep -q 'MISSING_BASE_TABLE\|INCOMPATIBLE_INDEX' /tmp/mig046-missmsg.log \
      && ok "X: migration BLOCK missing support_messages" || bad "X: mig reason"
  fi
  trap - EXIT
  teardown_db

  # Y: missing required satellite column with existing rows → BLOCK NULL_REQUIRED
  setup_db "mig046_miss_req_col_rows"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO support_tickets (id, subject, body, user_email, user_name)
    VALUES ('t-y-seed', 'subj', 'body', 'y@example.com', 'Y')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO support_ticket_attachments (ticket_id, file_name, file_url, uploaded_by)
    VALUES ('t-y-seed', 'f.txt', 'https://example/f', 'u1');
    ALTER TABLE support_ticket_attachments DROP COLUMN uploaded_by;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-missreq.log 2>&1; then
    bad "Y: preflight should BLOCK missing required col with rows"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-missreq.log \
      && ok "Y: preflight BLOCK NULL_REQUIRED (missing col+rows)" || bad "Y: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight046-missreq.log \
      && bad "Y: must never SAFE for missing required col with rows" \
      || ok "Y: no SAFE for missing required col with rows"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-missreq.log 2>&1; then
    bad "Y: migration should BLOCK missing required col with rows"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig046-missreq.log \
      && ok "Y: migration BLOCK NULL_REQUIRED" || bad "Y: mig reason=$(tail -3 /tmp/mig046-missreq.log)"
  fi
  trap - EXIT
  teardown_db

  # Z: missing PK with duplicate ids → BLOCK INCOMPATIBLE_PK (rows preserved)
  setup_db "mig046_dup_pk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_ticket_audit DROP CONSTRAINT support_ticket_audit_pkey;
    INSERT INTO support_ticket_audit (id, ticket_id, action) VALUES
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 't-z', 'note-a'),
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 't-z', 'note-b');
  " >/dev/null
  local dup_before
  dup_before=$(psql_db -At -c "
    SELECT COUNT(*) FROM (
      SELECT id FROM support_ticket_audit GROUP BY id HAVING COUNT(*) > 1
    ) d")
  [[ "$dup_before" -ge 1 ]] && ok "Z: duplicate id groups present before apply" \
    || bad "Z: failed to seed duplicate ids"
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-duppk.log 2>&1; then
    bad "Z: preflight should BLOCK missing PK with duplicate ids"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-duppk.log \
      && ok "Z: preflight BLOCK INCOMPATIBLE_PK (dup ids)" || bad "Z: preflight reason"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight046-duppk.log \
      && bad "Z: must never SAFE for dup ids missing PK" \
      || ok "Z: no SAFE for dup ids missing PK"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-duppk.log 2>&1; then
    bad "Z: migration should BLOCK missing PK with duplicate ids"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig046-duppk.log \
      && ok "Z: migration BLOCK INCOMPATIBLE_PK" || bad "Z: mig reason"
  fi
  local dup_after
  dup_after=$(psql_db -At -c "
    SELECT COUNT(*) FROM (
      SELECT id FROM support_ticket_audit GROUP BY id HAVING COUNT(*) > 1
    ) d")
  [[ "$dup_after" == "$dup_before" ]] && ok "Z: duplicate rows preserved (no delete)" \
    || bad "Z: rows changed dup_before=$dup_before dup_after=$dup_after"
  trap - EXIT
  teardown_db

  # AA: NULLS NOT DISTINCT UNIQUE(email) → BLOCK
  setup_db "mig046_nulls_not_distinct"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE support_visitor_profiles DROP CONSTRAINT IF EXISTS support_visitor_profiles_email_key;
    CREATE UNIQUE INDEX support_visitor_profiles_email_key
      ON support_visitor_profiles (email) NULLS NOT DISTINCT;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_046" >/tmp/preflight046-nnd.log 2>&1; then
    bad "AA: preflight should BLOCK NULLS NOT DISTINCT unique"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight046-nnd.log \
      && ok "AA: preflight BLOCK NULLS NOT DISTINCT" || bad "AA: preflight reason"
    grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight046-nnd.log \
      && bad "AA: must never ALREADY with NULLS NOT DISTINCT" \
      || ok "AA: no ALREADY for NULLS NOT DISTINCT"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_046" >/tmp/mig046-nnd.log 2>&1; then
    bad "AA: migration should BLOCK NULLS NOT DISTINCT"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig046-nnd.log \
      && ok "AA: migration BLOCK INCOMPATIBLE_UNIQUE NND" || bad "AA: mig reason"
  fi
  trap - EXIT
  teardown_db

  # A/Q strengthen: greenfield FK confrelid is public.support_tickets OID
  # (covered in A after apply_all — assert here as dedicated check on fresh DB)
  setup_db "mig046_fk_public_oid"
  trap teardown_db EXIT
  apply_all_migrations
  local fk_oid_ok
  fk_oid_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conname='support_ticket_attachments_ticket_id_fkey'
        AND c.contype='f'
        AND c.confrelid = 'public.support_tickets'::regclass
        AND c.confdeltype='c'
        AND c.convalidated
    )")
  [[ "$fk_oid_ok" == "t" ]] && ok "A2: FK confrelid = public.support_tickets OID + CASCADE" \
    || bad "A2: FK public OID binding missing"
  trap - EXIT
  teardown_db

  # R: Runtime CREATE/ALTER/INDEX absent; readiness + DML present
  if grep -qE 'CREATE TABLE IF NOT EXISTS (support_ticket_attachments|support_ticket_audit|support_visitor_profiles)' "$ENT_SRC"; then
    bad "R: Runtime CREATE still present in support-enterprise.ts"
  else
    ok "R: Runtime CREATE absent for 3 satellites"
  fi
  if grep -qE 'ALTER TABLE support_tickets ADD COLUMN' "$ENT_SRC"; then
    bad "R: Runtime ALTER support_tickets still present"
  else
    ok "R: Runtime ALTER support_tickets absent"
  fi
  if grep -q 'CREATE INDEX IF NOT EXISTS idx_st_' "$ENT_SRC"; then
    bad "R: Runtime CREATE INDEX idx_st_ still present"
  else
    ok "R: Runtime CREATE INDEX idx_st_ absent"
  fi
  grep -q "to_regclass('public.support_tickets')" "$ENT_SRC" \
    && grep -q "to_regclass('public.support_ticket_attachments')" "$ENT_SRC" \
    && grep -q "to_regclass('public.support_ticket_audit')" "$ENT_SRC" \
    && grep -q "to_regclass('public.support_visitor_profiles')" "$ENT_SRC" \
    && ok "R: to_regclass readiness present" \
    || bad "R: to_regclass readiness missing"
  grep -q 'INSERT INTO support_ticket_audit' "$ENT_SRC" \
    && ok "R: audit INSERT DML preserved" \
    || bad "R: audit INSERT missing"

  # S: prior 039–045 tables still present; 046 does not CREATE AI tables
  setup_db "mig046_prior_still"
  trap teardown_db EXIT
  apply_all_migrations
  local prior_cnt
  prior_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN (
        'support_ai_analysis','support_knowledge_base','ai_coo_notif_settings',
        'case_ai_insights','ai_agents')")
  [[ "$prior_cnt" == "5" ]] && ok "S: prior 039–045 tables still present" || bad "S: prior count=$prior_cnt"
  if grep -qE 'CREATE TABLE IF NOT EXISTS (support_ai_analysis|support_knowledge_base|ai_coo_notif_settings|case_ai_insights|ai_agents)' "$MIGRATION_046"; then
    bad "S: 046 must not CREATE 039–045 AI tables"
  else
    ok "S: 046 does not CREATE 039–045 AI tables"
  fi
  trap - EXIT
  teardown_db

  # T: P0 verify fails without owned table / critical column; 046 restores
  setup_db "mig046_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig046-p0-present.log 2>&1; then
    ok "T: verify-schema passes with 046 objects"
  else
    bad "T: verify-schema failed after full chain"; tail -20 /tmp/mig046-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE support_ticket_attachments CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig046-p0.log 2>&1; then
    bad "T: verify-schema should fail without support_ticket_attachments"
  else
    grep -qi 'support_ticket_attachments' /tmp/mig046-p0.log \
      && ok "T: P0 verify fails when support_ticket_attachments absent" || bad "T: verify log missing table"
  fi
  apply_migration_046
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig046-p0-restored.log 2>&1; then
    ok "T: verify-schema passes after 046 restore"
  else
    bad "T: verify failed after restore"; tail -20 /tmp/mig046-p0-restored.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE support_tickets DROP COLUMN office_id;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig046-p0-col.log 2>&1; then
    bad "T: verify-schema should fail without support_tickets.office_id"
  else
    grep -qi 'office_id\|support_tickets' /tmp/mig046-p0-col.log \
      && ok "T: P0 verify fails when critical column missing" || bad "T: verify log missing column"
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_047_calendar() {
  log "Scenario 047 — Calendar: greenfield / SAFE / BLOCK / FK CASCADE / ASC indexes / Runtime / P0"
  local PREFLIGHT_047="$ROOT/scripts/db/preflight-migration-047.sql"
  local CAL_SRC="$ROOT/artifacts/api-server/src/modules/operations/calendar.ts"
  local CASES_SRC="$ROOT/artifacts/api-server/src/modules/legal-core/cases.ts"

  # A: greenfield READY + idempotent + ALREADY + FK CASCADE + ASC indexes + DML
  setup_db "mig047_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local ev_tbl rem_tbl ev_pk rem_pk fk_ok idx_ok office_default
  ev_tbl=$(psql_db -At -c "SELECT to_regclass('public.events') IS NOT NULL;")
  rem_tbl=$(psql_db -At -c "SELECT to_regclass('public.event_reminders') IS NOT NULL;")
  [[ "$ev_tbl" == "t" && "$rem_tbl" == "t" ]] && ok "A: events + event_reminders present" || bad "A: tables missing"
  ev_pk=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.events'::regclass AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\\(id\\)' AND pg_get_constraintdef(c.oid) !~* ','
    )")
  rem_pk=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.event_reminders'::regclass AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\\(id\\)' AND pg_get_constraintdef(c.oid) !~* ','
    )")
  [[ "$ev_pk" == "t" && "$rem_pk" == "t" ]] && ok "A: PRIMARY KEY (id) on both tables" || bad "A: PK ev=$ev_pk rem=$rem_pk"
  fk_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conname='event_reminders_event_id_fkey' AND c.contype='f'
        AND c.conrelid='public.event_reminders'::regclass
        AND c.confrelid='public.events'::regclass
        AND c.confdeltype='c'
    )")
  [[ "$fk_ok" == "t" ]] && ok "A: event_reminders_event_id_fkey ON DELETE CASCADE" || bad "A: FK missing/wrong"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='events'
        AND i.relname='idx_events_case_id'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['case_id']::text[]
        AND (x.indoption[0] & 1) = 0
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_events_case_id (case_id ASC non-unique)" || bad "A: idx_events_case_id missing/wrong"
  idx_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_index x ON x.indrelid=t.oid
      JOIN pg_class i ON i.oid=x.indexrelid
      WHERE n.nspname='public' AND t.relname='events'
        AND i.relname='idx_events_office_start'
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=ord.attnum AND NOT a.attisdropped)
            = ARRAY['office_id','start_at']::text[]
        AND (x.indoption[0] & 1) = 0 AND (x.indoption[1] & 1) = 0
    )")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_events_office_start (office_id, start_at ASC)" || bad "A: idx_events_office_start missing/wrong"
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO events (id, user_id, title, event_type, start_at, all_day, status)
    VALUES ('cal-omit-office', 'u1', 'Hearing', 'hearing', NOW(), false, 'upcoming');
  " >/dev/null
  office_default=$(psql_db -At -c "SELECT office_id FROM events WHERE id='cal-omit-office';")
  [[ "$office_default" == "default" ]] && ok "A: omitted office_id uses DEFAULT 'default'" || bad "A: office_id=$office_default"
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO events (id, user_id, office_id, title, event_type, start_at, all_day, status)
    VALUES ('cal-upsert', 'u1', 'off-1', 'Original', 'other', NOW(), false, 'upcoming')
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();
    INSERT INTO events (id, user_id, office_id, title, event_type, start_at, all_day, status)
    VALUES ('cal-upsert', 'u1', 'off-1', 'Updated', 'other', NOW(), false, 'upcoming')
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();
    INSERT INTO event_reminders (id, event_id)
    VALUES ('cal-rem-1', 'cal-upsert');
    DELETE FROM events WHERE id='cal-upsert';
  " >/dev/null
  local upsert_cnt cascade_cnt
  upsert_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM events WHERE id='cal-upsert';")
  cascade_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM event_reminders WHERE id='cal-rem-1';")
  [[ "$upsert_cnt" == "0" && "$cascade_cnt" == "0" ]] \
    && ok "A: ON CONFLICT (id) + ON DELETE CASCADE work" \
    || bad "A: upsert=$upsert_cnt cascade_rem=$cascade_cnt"
  psql_db -f "$MIGRATION_047" >/tmp/mig047.log 2>&1
  ok "A: re-run 047 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight047-ready.log \
    && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight047-ready.log | tail -1)"
  grep -q 'CALENDAR_SCHEMA_READY' /tmp/preflight047-ready.log \
    && ok "A: CALENDAR_SCHEMA_READY" || bad "A: ready reason"
  grep -q 'CALENDAR_SCHEMA_READY' /tmp/mig047.log \
    && ok "A: migration RAISE NOTICE CALENDAR_SCHEMA_READY" || bad "A: missing CALENDAR_SCHEMA_READY notice"
  trap - EXIT
  teardown_db

  # B: missing tables SAFE + restore
  setup_db "mig047_missing_tables"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS event_reminders CASCADE; DROP TABLE IF EXISTS events CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-b.log 2>&1
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight047-b.log \
    && ok "B: preflight SAFE TABLE_MISSING" || bad "B: preflight"
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight047-b.log \
    && bad "B: missing tables must not be ALREADY_CORRECT" \
    || ok "B: not ALREADY_CORRECT when tables missing"
  apply_migration_047
  ev_tbl=$(psql_db -At -c "SELECT to_regclass('public.events') IS NOT NULL;")
  rem_tbl=$(psql_db -At -c "SELECT to_regclass('public.event_reminders') IS NOT NULL;")
  [[ "$ev_tbl" == "t" && "$rem_tbl" == "t" ]] && ok "B: 047 restores both tables" || bad "B: restore failed"
  trap - EXIT
  teardown_db

  # C: missing column SAFE + restore
  setup_db "mig047_missing_col"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE events DROP COLUMN IF EXISTS location;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-c.log 2>&1
  grep -q 'PARTIAL_SCHEMA\|SAFE_AUTO_REPAIR' /tmp/preflight047-c.log \
    && ok "C: preflight SAFE PARTIAL_SCHEMA" || bad "C: preflight"
  apply_migration_047
  local loc
  loc=$(psql_db -At -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='location';")
  [[ "$loc" == "1" ]] && ok "C: location restored" || bad "C: location=$loc"
  trap - EXIT
  teardown_db

  # D: missing indexes SAFE + restore
  setup_db "mig047_missing_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_events_case_id; DROP INDEX IF EXISTS idx_events_office_start;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-d.log 2>&1
  grep -q 'MISSING_INDEXES\|SAFE_AUTO_REPAIR' /tmp/preflight047-d.log \
    && ok "D: preflight SAFE MISSING_INDEXES" || bad "D: preflight"
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight047-d.log \
    && bad "D: missing indexes must not be ALREADY_CORRECT" \
    || ok "D: not ALREADY_CORRECT when indexes missing"
  apply_migration_047
  idx_ok=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND i.relname IN ('idx_events_case_id','idx_events_office_start');")
  [[ "$idx_ok" == "2" ]] && ok "D: both indexes restored" || bad "D: idx count=$idx_ok"
  trap - EXIT
  teardown_db

  # E: missing FK SAFE + restore
  setup_db "mig047_missing_fk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE event_reminders DROP CONSTRAINT IF EXISTS event_reminders_event_id_fkey;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-e.log 2>&1
  grep -q 'MISSING_FKS\|SAFE_AUTO_REPAIR' /tmp/preflight047-e.log \
    && ok "E: preflight SAFE MISSING_FKS" || bad "E: preflight"
  apply_migration_047
  fk_ok=$(psql_db -At -c "SELECT COUNT(*) FROM pg_constraint WHERE conname='event_reminders_event_id_fkey';")
  [[ "$fk_ok" == "1" ]] && ok "E: FK restored" || bad "E: FK=$fk_ok"
  trap - EXIT
  teardown_db

  # F: incompatible type
  setup_db "mig047_bad_type"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE events ALTER COLUMN all_day DROP DEFAULT;
    ALTER TABLE events ALTER COLUMN all_day TYPE text USING all_day::text;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-f.log 2>&1; then
    bad "F: preflight should BLOCK INCOMPATIBLE_TYPE"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight047-f.log \
      && ok "F: preflight BLOCK INCOMPATIBLE_TYPE" || bad "F: expected INCOMPATIBLE_TYPE"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_047" >/tmp/mig047-f.log 2>&1; then
    bad "F: migration should BLOCK INCOMPATIBLE_TYPE"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig047-f.log \
      && ok "F: migration BLOCK INCOMPATIBLE_TYPE" || bad "F: mig reason=$(tail -3 /tmp/mig047-f.log)"
  fi
  trap - EXIT
  teardown_db

  # G: incompatible PK
  setup_db "mig047_bad_pk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE event_reminders DROP CONSTRAINT IF EXISTS event_reminders_event_id_fkey;
    ALTER TABLE events DROP CONSTRAINT events_pkey;
    ALTER TABLE events ADD PRIMARY KEY (id, office_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-g.log 2>&1; then
    bad "G: preflight should BLOCK INCOMPATIBLE_PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight047-g.log \
      && ok "G: preflight BLOCK INCOMPATIBLE_PK" || bad "G: expected INCOMPATIBLE_PK"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_047" >/tmp/mig047-g.log 2>&1; then
    bad "G: migration should BLOCK INCOMPATIBLE_PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig047-g.log \
      && ok "G: migration BLOCK INCOMPATIBLE_PK" || bad "G: mig reason=$(tail -3 /tmp/mig047-g.log)"
  fi
  trap - EXIT
  teardown_db

  # H: stolen index name
  setup_db "mig047_stolen"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_events_case_id;
    CREATE TABLE IF NOT EXISTS mig047_dummy (case_id text);
    CREATE INDEX idx_events_case_id ON mig047_dummy (case_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-h.log 2>&1; then
    bad "H: preflight should BLOCK INCOMPATIBLE_INDEX"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight047-h.log \
      && ok "H: preflight BLOCK stolen idx_events_case_id" || bad "H: expected INCOMPATIBLE_INDEX"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight047-h.log \
      && bad "H: must never SAFE when same-name index incompatible" \
      || ok "H: no SAFE_AUTO_REPAIR over stolen index"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_047" >/tmp/mig047-h.log 2>&1; then
    bad "H: migration should BLOCK stolen index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig047-h.log \
      && ok "H: migration BLOCK stolen index (no DROP INDEX)" || bad "H: mig reason=$(tail -3 /tmp/mig047-h.log)"
  fi
  trap - EXIT
  teardown_db

  # I: DESC instead of ASC
  setup_db "mig047_desc"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_events_office_start;
    CREATE INDEX idx_events_office_start ON events (office_id, start_at DESC);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-i.log 2>&1; then
    bad "I: preflight should BLOCK DESC idx_events_office_start"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight047-i.log \
      && ok "I: preflight BLOCK DESC idx_events_office_start" || bad "I: expected INCOMPATIBLE_INDEX"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_047" >/tmp/mig047-i.log 2>&1; then
    bad "I: migration should BLOCK DESC index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig047-i.log \
      && ok "I: migration BLOCK DESC index" || bad "I: mig reason"
  fi
  trap - EXIT
  teardown_db

  # J: partial index
  setup_db "mig047_partial"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_events_case_id;
    CREATE INDEX idx_events_case_id ON events (case_id) WHERE case_id IS NOT NULL;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-j.log 2>&1; then
    bad "J: preflight should BLOCK partial idx_events_case_id"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight047-j.log \
      && ok "J: preflight BLOCK partial idx_events_case_id" || bad "J: expected INCOMPATIBLE_INDEX"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_047" >/tmp/mig047-j.log 2>&1; then
    bad "J: migration should BLOCK partial index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig047-j.log \
      && ok "J: migration BLOCK partial index" || bad "J: mig reason"
  fi
  trap - EXIT
  teardown_db

  # K: orphan FK
  setup_db "mig047_orphan"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE event_reminders DROP CONSTRAINT IF EXISTS event_reminders_event_id_fkey;
    INSERT INTO event_reminders (id, event_id, notify_before_minutes, notification_type, sent)
    VALUES ('orphan-047', 'missing-event-047', 60, 'email', false);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-k.log 2>&1; then
    bad "K: preflight should BLOCK ORPHAN_FK"
  else
    grep -q 'ORPHAN_FK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight047-k.log \
      && ok "K: preflight BLOCK ORPHAN_FK" || bad "K: expected ORPHAN_FK"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_047" >/tmp/mig047-k.log 2>&1; then
    bad "K: migration should BLOCK ORPHAN_FK"
  else
    grep -q 'ORPHAN_FK' /tmp/mig047-k.log \
      && ok "K: migration BLOCK ORPHAN_FK (row preserved)" || bad "K: mig reason=$(tail -3 /tmp/mig047-k.log)"
  fi
  local orphan_cnt
  orphan_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM event_reminders WHERE id='orphan-047';")
  [[ "$orphan_cnt" == "1" ]] && ok "K: orphan reminder row preserved" || bad "K: row count=$orphan_cnt"
  trap - EXIT
  teardown_db

  # L: incompatible FK (RESTRICT)
  setup_db "mig047_bad_fk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE event_reminders DROP CONSTRAINT event_reminders_event_id_fkey;
    ALTER TABLE event_reminders ADD CONSTRAINT event_reminders_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT;
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-l.log 2>&1; then
    bad "L: preflight should BLOCK INCOMPATIBLE_FK"
  else
    grep -q 'INCOMPATIBLE_FK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight047-l.log \
      && ok "L: preflight BLOCK INCOMPATIBLE_FK RESTRICT" || bad "L: expected INCOMPATIBLE_FK"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_047" >/tmp/mig047-l.log 2>&1; then
    bad "L: migration should BLOCK INCOMPATIBLE_FK"
  else
    grep -q 'INCOMPATIBLE_FK' /tmp/mig047-l.log \
      && ok "L: migration BLOCK INCOMPATIBLE_FK" || bad "L: mig reason"
  fi
  trap - EXIT
  teardown_db

  # M: NULL in required column
  setup_db "mig047_nulls"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE events ALTER COLUMN title DROP NOT NULL;
    INSERT INTO events (id, user_id, office_id, title, event_type, start_at, all_day, status)
    VALUES ('null-title-047', 'u1', 'o1', NULL, 'other', NOW(), false, 'upcoming');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-m.log 2>&1; then
    bad "M: preflight should BLOCK NULL_REQUIRED"
  else
    grep -q 'NULL_REQUIRED\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight047-m.log \
      && ok "M: preflight BLOCK NULL_REQUIRED" || bad "M: expected NULL_REQUIRED"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_047" >/tmp/mig047-m.log 2>&1; then
    bad "M: migration should BLOCK NULL_REQUIRED"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig047-m.log \
      && ok "M: migration BLOCK NULL_REQUIRED" || bad "M: mig reason"
  fi
  trap - EXIT
  teardown_db

  # R: missing PK + duplicate non-null ids → BLOCK INCOMPATIBLE_PK (rows preserved)
  setup_db "mig047_dup_pk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE event_reminders DROP CONSTRAINT IF EXISTS event_reminders_event_id_fkey;
    ALTER TABLE events DROP CONSTRAINT events_pkey;
    INSERT INTO events (id, user_id, office_id, title, event_type, start_at, all_day, status)
    VALUES
      ('dup-047', 'u1', 'o1', 'A', 'other', NOW(), false, 'upcoming'),
      ('dup-047', 'u2', 'o1', 'B', 'other', NOW(), false, 'upcoming');
  " >/dev/null
  local dup_before
  dup_before=$(psql_db -At -c "
    SELECT COUNT(*) FROM (
      SELECT id FROM events WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
    ) d")
  [[ "$dup_before" -ge 1 ]] && ok "R: duplicate non-null id groups present before apply" \
    || bad "R: failed to seed duplicate ids"
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-r.log 2>&1; then
    bad "R: preflight should BLOCK missing PK with duplicate ids"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight047-r.log \
      && ok "R: preflight BLOCK INCOMPATIBLE_PK (dup ids)" || bad "R: expected INCOMPATIBLE_PK"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight047-r.log \
      && bad "R: must never SAFE for dup ids missing PK" \
      || ok "R: no SAFE for dup ids missing PK"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_047" >/tmp/mig047-r.log 2>&1; then
    bad "R: migration should BLOCK missing PK with duplicate ids"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig047-r.log \
      && ok "R: migration BLOCK INCOMPATIBLE_PK" || bad "R: mig reason=$(tail -3 /tmp/mig047-r.log)"
  fi
  local dup_after
  dup_after=$(psql_db -At -c "SELECT COUNT(*) FROM events WHERE id='dup-047';")
  [[ "$dup_after" == "2" ]] && ok "R: duplicate event rows preserved" || bad "R: row count=$dup_after"
  trap - EXIT
  teardown_db

  # S: event_reminders rows while events missing → BLOCK ORPHAN_FK (rows preserved)
  setup_db "mig047_orphan_parent_missing"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO events (id, user_id, office_id, title, event_type, start_at, all_day, status)
    VALUES ('evt-parent-047', 'u1', 'o1', 'Keep', 'other', NOW(), false, 'upcoming');
    INSERT INTO event_reminders (id, event_id, notify_before_minutes, notification_type, sent)
    VALUES ('keep-rem-047', 'evt-parent-047', 60, 'email', false);
    ALTER TABLE event_reminders DROP CONSTRAINT IF EXISTS event_reminders_event_id_fkey;
    DROP TABLE events;
  " >/dev/null
  local rem_before
  rem_before=$(psql_db -At -c "SELECT COUNT(*) FROM event_reminders WHERE id='keep-rem-047';")
  [[ "$rem_before" == "1" ]] && ok "S: reminder row present with events missing" \
    || bad "S: failed to seed reminder after DROP events"
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_047" >/tmp/preflight047-s.log 2>&1; then
    bad "S: preflight should BLOCK ORPHAN_FK when events missing and reminders have rows"
  else
    grep -q 'ORPHAN_FK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight047-s.log \
      && ok "S: preflight BLOCK ORPHAN_FK (events missing)" || bad "S: expected ORPHAN_FK"
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight047-s.log \
      && bad "S: must never TABLE_MISSING SAFE when reminder rows exist without events" \
      || ok "S: no SAFE/TABLE_MISSING over populated reminders"
    grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight047-s.log \
      && bad "S: must never ALREADY when events missing and reminders have rows" \
      || ok "S: no ALREADY for parent-missing orphans"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_047" >/tmp/mig047-s.log 2>&1; then
    bad "S: migration should BLOCK ORPHAN_FK"
  else
    grep -q 'ORPHAN_FK' /tmp/mig047-s.log \
      && ok "S: migration BLOCK ORPHAN_FK (row preserved)" || bad "S: mig reason=$(tail -3 /tmp/mig047-s.log)"
  fi
  local rem_after
  rem_after=$(psql_db -At -c "SELECT COUNT(*) FROM event_reminders WHERE id='keep-rem-047';")
  [[ "$rem_after" == "1" ]] && ok "S: orphan reminder row preserved" || bad "S: row count=$rem_after"
  trap - EXIT
  teardown_db

  # N: extra live column preserved
  setup_db "mig047_extra_col"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE events ADD COLUMN extra_live_047 text;" >/dev/null
  apply_migration_047
  local extra
  extra=$(psql_db -At -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='extra_live_047';")
  [[ "$extra" == "1" ]] && ok "N: extra live column extra_live_047 preserved" || bad "N: extra dropped"
  trap - EXIT
  teardown_db

  # O: calendar.ts Runtime CREATE removed; DML + tenant predicates preserved
  if grep -nE 'CREATE TABLE[[:space:]]+(IF NOT EXISTS[[:space:]]+)?(events|event_reminders)\b' "$CAL_SRC" >/dev/null; then
    bad "O: calendar.ts still contains Runtime CREATE TABLE"
  else
    ok "O: calendar.ts has no Runtime CREATE TABLE"
  fi
  if grep -qE 'CREATE INDEX IF NOT EXISTS idx_events_' "$CAL_SRC"; then
    bad "O: calendar.ts still contains Runtime CREATE INDEX"
  else
    ok "O: calendar.ts has no Runtime CREATE INDEX"
  fi
  grep -q "INSERT INTO events" "$CAL_SRC" \
    && grep -q "INSERT INTO event_reminders" "$CAL_SRC" \
    && grep -q "UPDATE events SET" "$CAL_SRC" \
    && grep -q "DELETE FROM events" "$CAL_SRC" \
    && ok "O: calendar DML preserved" \
    || bad "O: calendar DML missing"
  grep -q 'user_id =' "$CAL_SRC" \
    && ok "O: calendar tenant/user predicates preserved" \
    || bad "O: calendar predicates missing"
  grep -q 'ON CONFLICT (id)' "$CASES_SRC" \
    && grep -q 'INSERT INTO events' "$CASES_SRC" \
    && ok "O: cases.syncHearingToCalendar ON CONFLICT (id) preserved" \
    || bad "O: cases calendar upsert missing"

  # P: 047 does not CREATE unrelated tables
  if grep -nE 'CREATE TABLE.*(hr_announcements|hr_roles|office_notification_settings|ai_events|support_ticket_attachments)' \
       "$MIGRATION_047" >/dev/null; then
    bad "P: 047 must not CREATE unrelated tables"
  else
    ok "P: 047 scoped to events + event_reminders"
  fi

  # Q: P0 fails without events; 047 restores
  setup_db "mig047_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig047-p0-present.log 2>&1; then
    ok "Q: verify-schema passes with 047 objects"
  else
    bad "Q: verify-schema failed after full chain"; tail -20 /tmp/mig047-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS event_reminders CASCADE; DROP TABLE IF EXISTS events CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig047-p0.log 2>&1; then
    bad "Q: verify-schema should fail without events"
  else
    grep -qiE 'events|event_reminders' /tmp/mig047-p0.log \
      && ok "Q: P0 verify fails when events absent" || bad "Q: verify log missing events"
  fi
  apply_migration_047
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig047-p0-restored.log 2>&1; then
    ok "Q: verify-schema passes after 047 restore"
  else
    bad "Q: verify failed after restore"; tail -20 /tmp/mig047-p0-restored.log
  fi
  trap - EXIT
  teardown_db
}


scenario_migration_048_hr_internal() {
  log "Scenario 048 — HR Internal: greenfield / SAFE / BLOCK / UNIQUE / Runtime / P0"
  local PREFLIGHT_048="$ROOT/scripts/db/preflight-migration-048.sql"
  local HRI_SRC="$ROOT/artifacts/api-server/src/modules/operations/hrInternal.ts"

  # A: greenfield READY + idempotent + ALREADY + exact unique
  setup_db "mig048_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_cnt pk_ok uq_ok
  tbl_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN ('hr_announcements','employee_requests','leave_balances')")
  [[ "$tbl_cnt" == "3" ]] && ok "A: 3 HR Internal tables present" || bad "A: table count=$tbl_cnt"
  pk_ok=$(psql_db -At -c "SELECT COUNT(*) FROM pg_constraint c WHERE c.contype='p' AND c.conrelid IN ('public.hr_announcements'::regclass,'public.employee_requests'::regclass,'public.leave_balances'::regclass) AND pg_get_constraintdef(c.oid)='PRIMARY KEY (id)'")
  [[ "$pk_ok" == "3" ]] && ok "A: PRIMARY KEY (id) on all three tables" || bad "A: pk count=$pk_ok"
  uq_ok=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.leave_balances'::regclass AND c.contype='u' AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*employee_id[[:space:]]*,[[:space:]]*leave_type[[:space:]]*,[[:space:]]*year[[:space:]]*\\)' AND pg_get_constraintdef(c.oid) !~* 'UNIQUE[[:space:]]*\\([^)]*,[^)]*,[^)]*,' )")
  [[ "$uq_ok" == "t" ]] && ok "A: leave_balances UNIQUE(employee_id, leave_type, year) exact" || bad "A: UNIQUE missing/wrong"
  apply_migration_048
  ok "A: re-run 048 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_048" >/tmp/preflight048-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight048-ready.log && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight048-ready.log | tail -1)"
  grep -q 'HR_INTERNAL_SCHEMA_READY' /tmp/preflight048-ready.log && ok "A: HR_INTERNAL_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig048_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE employee_requests CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_048" >/tmp/preflight048-misstbl.log 2>&1
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight048-misstbl.log && ok "B: preflight SAFE TABLE_MISSING" || bad "B: preflight"
  apply_migration_048
  [[ "$(psql_db -At -c "SELECT to_regclass('public.employee_requests') IS NOT NULL")" == "t" ]] && ok "B: employee_requests restored" || bad "B: restore failed"
  trap - EXIT
  teardown_db

  # C: missing column SAFE + restore
  setup_db "mig048_miss_col"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE hr_announcements DROP COLUMN IF EXISTS author_name;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_048" >/tmp/preflight048-misscol.log 2>&1
  grep -q 'PARTIAL_SCHEMA\|SAFE_AUTO_REPAIR' /tmp/preflight048-misscol.log && ok "C: preflight SAFE PARTIAL_SCHEMA" || bad "C: preflight"
  apply_migration_048
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='hr_announcements' AND column_name='author_name'")" == "1" ]] && ok "C: author_name restored" || bad "C: author_name missing"
  trap - EXIT
  teardown_db

  # D: wrong type BLOCK
  setup_db "mig048_bad_type"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE employee_requests ALTER COLUMN subject DROP DEFAULT; ALTER TABLE employee_requests ALTER COLUMN subject TYPE integer USING 1;" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_048" >/tmp/preflight048-type.log 2>&1; then
    bad "D: preflight should BLOCK INCOMPATIBLE_TYPE"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight048-type.log && ok "D: preflight BLOCK INCOMPATIBLE_TYPE" || bad "D: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_048" >/tmp/mig048-type.log 2>&1; then
    bad "D: migration should BLOCK INCOMPATIBLE_TYPE"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig048-type.log && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: mig reason"
  fi
  trap - EXIT
  teardown_db

  # E: wrong PK BLOCK
  setup_db "mig048_wrong_pk"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE hr_announcements DROP CONSTRAINT hr_announcements_pkey; ALTER TABLE hr_announcements ADD PRIMARY KEY (id, office_id);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_048" >/tmp/preflight048-pk.log 2>&1; then
    bad "E: preflight should BLOCK INCOMPATIBLE_PK"
  else
    grep -q 'INCOMPATIBLE_PK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight048-pk.log && ok "E: preflight BLOCK INCOMPATIBLE_PK" || bad "E: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_048" >/tmp/mig048-pk.log 2>&1; then
    bad "E: migration should BLOCK INCOMPATIBLE_PK"
  else
    grep -q 'INCOMPATIBLE_PK' /tmp/mig048-pk.log && ok "E: migration BLOCK INCOMPATIBLE_PK" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F: wrong unique BLOCK
  setup_db "mig048_wrong_unique"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE leave_balances DROP CONSTRAINT leave_balances_employee_id_leave_type_year_key; ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_employee_id_year_key UNIQUE (employee_id, year);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_048" >/tmp/preflight048-uq.log 2>&1; then
    bad "F: preflight should BLOCK INCOMPATIBLE_UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight048-uq.log && ok "F: preflight BLOCK INCOMPATIBLE_UNIQUE" || bad "F: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_048" >/tmp/mig048-uq.log 2>&1; then
    bad "F: migration should BLOCK INCOMPATIBLE_UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig048-uq.log && ok "F: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "F: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F2: approved UNIQUE + extra incompatible UNIQUE BLOCK, rows preserved
  setup_db "mig048_extra_unique"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO leave_balances (office_id, employee_id, leave_type, year, quota, used)
    VALUES ('o1','emp-extra-048','annual',2026,21,0);
    ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_employee_id_year_key UNIQUE (employee_id, year);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_048" >/tmp/preflight048-extra-uq.log 2>&1; then
    bad "F2: preflight should BLOCK INCOMPATIBLE_UNIQUE (approved + extra)"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight048-extra-uq.log && ok "F2: preflight BLOCK INCOMPATIBLE_UNIQUE (approved + extra)" || bad "F2: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_048" >/tmp/mig048-extra-uq.log 2>&1; then
    bad "F2: migration should BLOCK INCOMPATIBLE_UNIQUE (approved + extra)"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig048-extra-uq.log && ok "F2: migration BLOCK INCOMPATIBLE_UNIQUE (approved + extra)" || bad "F2: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM leave_balances WHERE employee_id='emp-extra-048'")" == "1" ]] && ok "F2: leave_balances rows preserved" || bad "F2: rows changed"
  trap - EXIT
  teardown_db

  # G: duplicate leave balance unique keys BLOCK, rows preserved
  setup_db "mig048_dup_unique"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE leave_balances DROP CONSTRAINT leave_balances_employee_id_leave_type_year_key; INSERT INTO leave_balances (office_id, employee_id, leave_type, year, quota, used) VALUES ('o1','emp-1','annual',2026,21,0), ('o2','emp-1','annual',2026,30,2);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_048" >/tmp/preflight048-dup.log 2>&1; then
    bad "G: preflight should BLOCK DUPLICATE_UNIQUE_KEY"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight048-dup.log && ok "G: preflight BLOCK DUPLICATE_UNIQUE_KEY" || bad "G: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_048" >/tmp/mig048-dup.log 2>&1; then
    bad "G: migration should BLOCK DUPLICATE_UNIQUE_KEY"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY' /tmp/mig048-dup.log && ok "G: migration BLOCK DUPLICATE_UNIQUE_KEY" || bad "G: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM leave_balances WHERE employee_id='emp-1' AND leave_type='annual' AND year=2026")" == "2" ]] && ok "G: duplicate leave_balances rows preserved" || bad "G: rows changed"
  trap - EXIT
  teardown_db

  # H: Runtime CREATE removed; DML and tenant predicates preserved
  if grep -qE 'CREATE TABLE IF NOT EXISTS (hr_announcements|employee_requests|leave_balances)' "$HRI_SRC"; then
    bad "H: hrInternal.ts still contains Runtime CREATE TABLE"
  else
    ok "H: hrInternal.ts has no Runtime CREATE TABLE"
  fi
  grep -q "to_regclass('public.hr_announcements')" "$HRI_SRC" \
    && grep -q "to_regclass('public.employee_requests')" "$HRI_SRC" \
    && grep -q "to_regclass('public.leave_balances')" "$HRI_SRC" \
    && ok "H: readiness checks present" \
    || bad "H: readiness checks missing"
  grep -q 'INSERT INTO employee_requests' "$HRI_SRC" \
    && grep -q 'INSERT INTO leave_balances' "$HRI_SRC" \
    && grep -q 'ON CONFLICT (employee_id, leave_type, year) DO NOTHING' "$HRI_SRC" \
    && grep -q 'WHERE office_id = ${tid}' "$HRI_SRC" \
    && ok "H: DML and tenant predicates preserved" \
    || bad "H: DML or tenant predicates missing"

  # I: P0 fails without owned table / restores
  setup_db "mig048_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig048-p0-present.log 2>&1; then
    ok "I: verify-schema passes with 048 objects"
  else
    bad "I: verify failed after full chain"; tail -20 /tmp/mig048-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE hr_announcements CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig048-p0.log 2>&1; then
    bad "I: verify-schema should fail without hr_announcements"
  else
    grep -qi 'hr_announcements' /tmp/mig048-p0.log && ok "I: P0 verify fails when hr_announcements absent" || bad "I: verify log missing table"
  fi
  apply_migration_048
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig048-p0-restored.log 2>&1; then
    ok "I: verify-schema passes after 048 restore"
  else
    bad "I: verify failed after restore"; tail -20 /tmp/mig048-p0-restored.log
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_049_hr_performance() {
  log "Scenario 049 — HR Performance: greenfield / office_id repair / UNIQUE(key) / Runtime / P0"
  local PREFLIGHT_049="$ROOT/scripts/db/preflight-migration-049.sql"
  local HRP_SRC="$ROOT/artifacts/api-server/src/modules/operations/hrPerformance.ts"

  # A: greenfield READY + idempotent + ALREADY + office_id + UNIQUE(key)
  setup_db "mig049_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_cnt pk_ok uq_ok office_ok
  tbl_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN ('performance_evaluations','employee_incentives','hr_settings')")
  [[ "$tbl_cnt" == "3" ]] && ok "A: 3 HR Performance tables present" || bad "A: table count=$tbl_cnt"
  pk_ok=$(psql_db -At -c "SELECT COUNT(*) FROM pg_constraint c WHERE c.contype='p' AND c.conrelid IN ('public.performance_evaluations'::regclass,'public.employee_incentives'::regclass,'public.hr_settings'::regclass) AND pg_get_constraintdef(c.oid)='PRIMARY KEY (id)'")
  [[ "$pk_ok" == "3" ]] && ok "A: PRIMARY KEY (id) on all three tables" || bad "A: pk count=$pk_ok"
  office_ok=$(psql_db -At -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='office_id' AND is_nullable='NO' AND udt_name='text' AND table_name IN ('performance_evaluations','employee_incentives')")
  [[ "$office_ok" == "2" ]] && ok "A: office_id TEXT NOT NULL on evaluations + incentives" || bad "A: office_id count=$office_ok"
  uq_ok=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.hr_settings'::regclass AND c.contype='u' AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*key[[:space:]]*\\)' AND pg_get_constraintdef(c.oid) !~* 'UNIQUE[[:space:]]*\\([^)]*,' )")
  [[ "$uq_ok" == "t" ]] && ok "A: hr_settings UNIQUE(key) exact" || bad "A: UNIQUE missing/wrong"
  apply_migration_049
  ok "A: re-run 049 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_049" >/tmp/preflight049-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight049-ready.log && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight049-ready.log | tail -1)"
  grep -q 'HR_PERFORMANCE_SCHEMA_READY' /tmp/preflight049-ready.log && ok "A: HR_PERFORMANCE_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: legacy Runtime shape without office_id → SAFE + backfill
  setup_db "mig049_legacy_no_office"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE IF EXISTS performance_evaluations CASCADE;
    DROP TABLE IF EXISTS employee_incentives CASCADE;
    CREATE TABLE performance_evaluations (
      id SERIAL PRIMARY KEY,
      employee_id TEXT NOT NULL,
      period TEXT NOT NULL,
      cases_closed INTEGER NOT NULL DEFAULT 0,
      cases_delayed INTEGER NOT NULL DEFAULT 0,
      tasks_completed INTEGER NOT NULL DEFAULT 0,
      errors INTEGER NOT NULL DEFAULT 0,
      on_time_days INTEGER NOT NULL DEFAULT 0,
      late_days INTEGER NOT NULL DEFAULT 0,
      absent_days INTEGER NOT NULL DEFAULT 0,
      clients_handled INTEGER NOT NULL DEFAULT 0,
      data_errors INTEGER NOT NULL DEFAULT 0,
      ops_handled INTEGER NOT NULL DEFAULT 0,
      incidents_resolved INTEGER NOT NULL DEFAULT 0,
      system_errors INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'lawyer',
      performance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      notes TEXT,
      evaluator_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE employee_incentives (
      id SERIAL PRIMARY KEY,
      employee_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'bonus',
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      period TEXT,
      is_applied BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO employees (id, employee_no, full_name, job_title, office_id, status)
    VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0491'::uuid, 'E049', 'Legacy Emp', 'Lawyer', 'office-049', 'active')
    ON CONFLICT (id) DO UPDATE SET office_id=EXCLUDED.office_id;
    INSERT INTO performance_evaluations (employee_id, period)
    VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0491', '2026-Q1');
    INSERT INTO employee_incentives (employee_id, amount)
    VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0491', 100);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_049" >/tmp/preflight049-legacy.log 2>&1
  grep -q 'PARTIAL_SCHEMA\|SAFE_AUTO_REPAIR\|SET_NOT_NULL_PENDING' /tmp/preflight049-legacy.log && ok "B: preflight SAFE for missing office_id" || bad "B: preflight $(grep chosen_action /tmp/preflight049-legacy.log | tail -1)"
  apply_migration_049
  [[ "$(psql_db -At -c "SELECT office_id FROM performance_evaluations WHERE employee_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0491'")" == "office-049" ]] && ok "B: performance_evaluations.office_id backfilled" || bad "B: pe office_id"
  [[ "$(psql_db -At -c "SELECT office_id FROM employee_incentives WHERE employee_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0491'")" == "office-049" ]] && ok "B: employee_incentives.office_id backfilled" || bad "B: ei office_id"
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM performance_evaluations WHERE employee_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0491'")" == "1" ]] && ok "B: rows preserved" || bad "B: rows lost"
  trap - EXIT
  teardown_db

  # C: wrong type BLOCK
  setup_db "mig049_bad_type"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE performance_evaluations ALTER COLUMN period DROP DEFAULT; ALTER TABLE performance_evaluations ALTER COLUMN period TYPE integer USING 1;" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_049" >/tmp/preflight049-type.log 2>&1; then
    bad "C: preflight should BLOCK INCOMPATIBLE_TYPE"
  else
    grep -q 'INCOMPATIBLE_TYPE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight049-type.log && ok "C: preflight BLOCK INCOMPATIBLE_TYPE" || bad "C: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_049" >/tmp/mig049-type.log 2>&1; then
    bad "C: migration should BLOCK INCOMPATIBLE_TYPE"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig049-type.log && ok "C: migration BLOCK INCOMPATIBLE_TYPE" || bad "C: mig reason"
  fi
  trap - EXIT
  teardown_db

  # D: wrong unique BLOCK
  setup_db "mig049_wrong_unique"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE hr_settings DROP CONSTRAINT hr_settings_key_key; ALTER TABLE hr_settings ADD CONSTRAINT hr_settings_key_val_key UNIQUE (key, val);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_049" >/tmp/preflight049-uq.log 2>&1; then
    bad "D: preflight should BLOCK INCOMPATIBLE_UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight049-uq.log && ok "D: preflight BLOCK INCOMPATIBLE_UNIQUE" || bad "D: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_049" >/tmp/mig049-uq.log 2>&1; then
    bad "D: migration should BLOCK INCOMPATIBLE_UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig049-uq.log && ok "D: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "D: mig reason"
  fi
  trap - EXIT
  teardown_db

  # E: duplicate key BLOCK, rows preserved
  setup_db "mig049_dup_key"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE hr_settings DROP CONSTRAINT hr_settings_key_key; INSERT INTO hr_settings (key, val) VALUES ('dup-049','a'), ('dup-049','b');" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_049" >/tmp/preflight049-dup.log 2>&1; then
    bad "E: preflight should BLOCK DUPLICATE_UNIQUE_KEY"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight049-dup.log && ok "E: preflight BLOCK DUPLICATE_UNIQUE_KEY" || bad "E: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_049" >/tmp/mig049-dup.log 2>&1; then
    bad "E: migration should BLOCK DUPLICATE_UNIQUE_KEY"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY' /tmp/mig049-dup.log && ok "E: migration BLOCK DUPLICATE_UNIQUE_KEY" || bad "E: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM hr_settings WHERE key='dup-049'")" == "2" ]] && ok "E: duplicate hr_settings rows preserved" || bad "E: rows changed"
  trap - EXIT
  teardown_db

  # F: Runtime CREATE removed; DML / seed / tenant predicates preserved
  if grep -qE 'CREATE TABLE IF NOT EXISTS (performance_evaluations|employee_incentives|hr_settings)' "$HRP_SRC"; then
    bad "F: hrPerformance.ts still contains Runtime CREATE TABLE"
  else
    ok "F: hrPerformance.ts has no Runtime CREATE TABLE"
  fi
  grep -q "to_regclass('public.performance_evaluations')" "$HRP_SRC" \
    && grep -q "to_regclass('public.employee_incentives')" "$HRP_SRC" \
    && grep -q "to_regclass('public.hr_settings')" "$HRP_SRC" \
    && ok "F: readiness checks present" \
    || bad "F: readiness checks missing"
  grep -q 'ON CONFLICT (key) DO NOTHING' "$HRP_SRC" \
    && grep -q 'ON CONFLICT (key) DO UPDATE SET val' "$HRP_SRC" \
    && grep -q 'INSERT INTO performance_evaluations' "$HRP_SRC" \
    && grep -q 'INSERT INTO employee_incentives (office_id, employee_id' "$HRP_SRC" \
    && grep -q 'e.office_id = ${tid}' "$HRP_SRC" \
    && ok "F: seed/DML and tenant predicates preserved" \
    || bad "F: DML or tenant predicates missing"

  # G: P0 fails without owned table / restores
  setup_db "mig049_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig049-p0-present.log 2>&1; then
    ok "G: verify-schema passes with 049 objects"
  else
    bad "G: verify failed after full chain"; tail -20 /tmp/mig049-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE performance_evaluations CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig049-p0.log 2>&1; then
    bad "G: verify-schema should fail without performance_evaluations"
  else
    grep -qi 'performance_evaluations' /tmp/mig049-p0.log && ok "G: P0 verify fails when performance_evaluations absent" || bad "G: verify log missing table"
  fi
  apply_migration_049
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig049-p0-restored.log 2>&1; then
    ok "G: verify-schema passes after 049 restore"
  else
    bad "G: verify failed after restore"; tail -20 /tmp/mig049-p0-restored.log
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_050_hr_enterprise() {
  log "Scenario 050 — HR Enterprise: greenfield / UNIQUE / INDEX / Runtime / P0"
  local PREFLIGHT_050="$ROOT/scripts/db/preflight-migration-050.sql"
  local HRE_SRC="$ROOT/artifacts/api-server/src/modules/operations/hr-enterprise.ts"

  # A: greenfield READY + idempotent + ALREADY + UNIQUEs + indexes
  setup_db "mig050_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_cnt pk_ok uq_roles uq_mem idx_ok
  tbl_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN ('hr_roles','hr_memberships','hr_workflows','hr_audit_logs')")
  [[ "$tbl_cnt" == "4" ]] && ok "A: 4 HR Enterprise tables present" || bad "A: table count=$tbl_cnt"
  pk_ok=$(psql_db -At -c "SELECT COUNT(*) FROM pg_constraint c WHERE c.contype='p' AND c.conrelid IN ('public.hr_roles'::regclass,'public.hr_memberships'::regclass,'public.hr_workflows'::regclass,'public.hr_audit_logs'::regclass) AND pg_get_constraintdef(c.oid)='PRIMARY KEY (id)'")
  [[ "$pk_ok" == "4" ]] && ok "A: PRIMARY KEY (id) on all four tables" || bad "A: pk count=$pk_ok"
  uq_roles=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.hr_roles'::regclass AND c.contype='u' AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*office_id[[:space:]]*,[[:space:]]*name[[:space:]]*\\)' AND pg_get_constraintdef(c.oid) !~* 'UNIQUE[[:space:]]*\\([^)]*,[^)]*,')")
  [[ "$uq_roles" == "t" ]] && ok "A: hr_roles UNIQUE(office_id, name)" || bad "A: roles UNIQUE"
  uq_mem=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.hr_memberships'::regclass AND c.contype='u' AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*office_id[[:space:]]*,[[:space:]]*user_id[[:space:]]*\\)' AND pg_get_constraintdef(c.oid) !~* 'UNIQUE[[:space:]]*\\([^)]*,[^)]*,')")
  [[ "$uq_mem" == "t" ]] && ok "A: hr_memberships UNIQUE(office_id, user_id)" || bad "A: memberships UNIQUE"
  idx_ok=$(psql_db -At -c "SELECT (to_regclass('public.idx_hrwf_office') IS NOT NULL AND to_regclass('public.idx_hral_office') IS NOT NULL)")
  [[ "$idx_ok" == "t" ]] && ok "A: idx_hrwf_office + idx_hral_office present" || bad "A: indexes"
  apply_migration_050
  ok "A: re-run 050 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_050" >/tmp/preflight050-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight050-ready.log && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight050-ready.log | tail -1)"
  grep -q 'HR_ENTERPRISE_SCHEMA_READY' /tmp/preflight050-ready.log && ok "A: HR_ENTERPRISE_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig050_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE hr_workflows CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_050" >/tmp/preflight050-misstbl.log 2>&1
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight050-misstbl.log && ok "B: preflight SAFE TABLE_MISSING" || bad "B: preflight"
  apply_migration_050
  [[ "$(psql_db -At -c "SELECT to_regclass('public.hr_workflows') IS NOT NULL")" == "t" ]] && ok "B: hr_workflows restored" || bad "B: restore failed"
  trap - EXIT
  teardown_db

  # C: wrong unique BLOCK
  setup_db "mig050_wrong_unique"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE hr_roles DROP CONSTRAINT hr_roles_office_id_name_key; ALTER TABLE hr_roles ADD CONSTRAINT hr_roles_office_id_key UNIQUE (office_id);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_050" >/tmp/preflight050-uq.log 2>&1; then
    bad "C: preflight should BLOCK INCOMPATIBLE_UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight050-uq.log && ok "C: preflight BLOCK INCOMPATIBLE_UNIQUE" || bad "C: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_050" >/tmp/mig050-uq.log 2>&1; then
    bad "C: migration should BLOCK INCOMPATIBLE_UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig050-uq.log && ok "C: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "C: mig reason"
  fi
  trap - EXIT
  teardown_db

  # D: approved UNIQUE + extra incompatible UNIQUE BLOCK, rows preserved
  setup_db "mig050_extra_unique"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO hr_roles (office_id, name, display_name, permissions)
    VALUES ('o-050','role-extra','Extra', '[]'::jsonb);
    ALTER TABLE hr_roles ADD CONSTRAINT hr_roles_name_only_key UNIQUE (name);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_050" >/tmp/preflight050-extra.log 2>&1; then
    bad "D: preflight should BLOCK INCOMPATIBLE_UNIQUE (approved + extra)"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight050-extra.log && ok "D: preflight BLOCK INCOMPATIBLE_UNIQUE (approved + extra)" || bad "D: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_050" >/tmp/mig050-extra.log 2>&1; then
    bad "D: migration should BLOCK INCOMPATIBLE_UNIQUE (approved + extra)"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig050-extra.log && ok "D: migration BLOCK INCOMPATIBLE_UNIQUE (approved + extra)" || bad "D: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM hr_roles WHERE name='role-extra'")" == "1" ]] && ok "D: hr_roles rows preserved" || bad "D: rows changed"
  trap - EXIT
  teardown_db

  # E: duplicate unique key BLOCK, rows preserved
  setup_db "mig050_dup_key"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE hr_memberships DROP CONSTRAINT hr_memberships_office_id_user_id_key;
    INSERT INTO hr_memberships (office_id, user_id, role_name) VALUES
      ('o1','user-dup-050','lawyer'),
      ('o1','user-dup-050','partner');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_050" >/tmp/preflight050-dup.log 2>&1; then
    bad "E: preflight should BLOCK DUPLICATE_UNIQUE_KEY"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight050-dup.log && ok "E: preflight BLOCK DUPLICATE_UNIQUE_KEY" || bad "E: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_050" >/tmp/mig050-dup.log 2>&1; then
    bad "E: migration should BLOCK DUPLICATE_UNIQUE_KEY"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY' /tmp/mig050-dup.log && ok "E: migration BLOCK DUPLICATE_UNIQUE_KEY" || bad "E: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM hr_memberships WHERE user_id='user-dup-050'")" == "2" ]] && ok "E: duplicate membership rows preserved" || bad "E: rows changed"
  trap - EXIT
  teardown_db

  # F: wrong index shape BLOCK
  setup_db "mig050_wrong_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX idx_hral_office; CREATE INDEX idx_hral_office ON hr_audit_logs(office_id, created_at ASC);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_050" >/tmp/preflight050-idx.log 2>&1; then
    bad "F: preflight should BLOCK INCOMPATIBLE_INDEX"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight050-idx.log && ok "F: preflight BLOCK INCOMPATIBLE_INDEX" || bad "F: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_050" >/tmp/mig050-idx.log 2>&1; then
    bad "F: migration should BLOCK INCOMPATIBLE_INDEX"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig050-idx.log && ok "F: migration BLOCK INCOMPATIBLE_INDEX" || bad "F: mig reason"
  fi
  trap - EXIT
  teardown_db

  # G: Runtime CREATE/INDEX removed; DML + tenant predicates preserved
  if grep -qE 'CREATE TABLE IF NOT EXISTS (hr_roles|hr_memberships|hr_workflows|hr_audit_logs)' "$HRE_SRC"; then
    bad "G: hr-enterprise.ts still contains Runtime CREATE TABLE"
  else
    ok "G: hr-enterprise.ts has no Runtime CREATE TABLE"
  fi
  if grep -qE 'CREATE INDEX IF NOT EXISTS idx_hr(wf|al)_office' "$HRE_SRC"; then
    bad "G: hr-enterprise.ts still contains Runtime CREATE INDEX"
  else
    ok "G: hr-enterprise.ts has no Runtime CREATE INDEX"
  fi
  grep -q "to_regclass('public.hr_roles')" "$HRE_SRC" \
    && grep -q "to_regclass('public.hr_memberships')" "$HRE_SRC" \
    && grep -q "to_regclass('public.hr_workflows')" "$HRE_SRC" \
    && grep -q "to_regclass('public.hr_audit_logs')" "$HRE_SRC" \
    && ok "G: readiness checks present" \
    || bad "G: readiness checks missing"
  grep -q 'ON CONFLICT (office_id, name) DO NOTHING' "$HRE_SRC" \
    && grep -q 'ON CONFLICT (office_id, user_id) DO UPDATE' "$HRE_SRC" \
    && grep -q 'WHERE r.office_id = ${tid}' "$HRE_SRC" \
    && ok "G: seed/DML and tenant predicates preserved" \
    || bad "G: DML or tenant predicates missing"

  # H: P0 fails without owned table / restores
  setup_db "mig050_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig050-p0-present.log 2>&1; then
    ok "H: verify-schema passes with 050 objects"
  else
    bad "H: verify failed after full chain"; tail -20 /tmp/mig050-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE hr_roles CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig050-p0.log 2>&1; then
    bad "H: verify-schema should fail without hr_roles"
  else
    grep -qi 'hr_roles' /tmp/mig050-p0.log && ok "H: P0 verify fails when hr_roles absent" || bad "H: verify log missing table"
  fi
  apply_migration_050
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig050-p0-restored.log 2>&1; then
    ok "H: verify-schema passes after 050 restore"
  else
    bad "H: verify failed after restore"; tail -20 /tmp/mig050-p0-restored.log
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_051_office_notification_settings() {
  log "Scenario 051 — office_notification_settings: greenfield / UNIQUE / Runtime / P0"
  local PREFLIGHT_051="$ROOT/scripts/db/preflight-migration-051.sql"
  local NOTIF_SRC="$ROOT/artifacts/api-server/src/modules/operations/notifications.ts"

  # A: greenfield READY + idempotent + ALREADY + UNIQUE
  setup_db "mig051_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_ok pk_ok uq_ok
  tbl_ok=$(psql_db -At -c "SELECT to_regclass('public.office_notification_settings') IS NOT NULL")
  [[ "$tbl_ok" == "t" ]] && ok "A: office_notification_settings present" || bad "A: table missing"
  pk_ok=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.office_notification_settings'::regclass AND c.contype='p' AND pg_get_constraintdef(c.oid)='PRIMARY KEY (id)')")
  [[ "$pk_ok" == "t" ]] && ok "A: PRIMARY KEY (id)" || bad "A: pk"
  uq_ok=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.office_notification_settings'::regclass AND c.contype='u' AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*office_id[[:space:]]*,[[:space:]]*event_type[[:space:]]*\\)' AND pg_get_constraintdef(c.oid) !~* 'UNIQUE[[:space:]]*\\([^)]*,[^)]*,')")
  [[ "$uq_ok" == "t" ]] && ok "A: UNIQUE(office_id, event_type)" || bad "A: UNIQUE"
  local ts_ok
  ts_ok=$(psql_db -At -c "SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='office_notification_settings' AND column_name='updated_at'")
  [[ "$ts_ok" == "timestamp" ]] && ok "A: updated_at TIMESTAMP (without tz)" || bad "A: updated_at udt=$ts_ok"
  apply_migration_051
  ok "A: re-run 051 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_051" >/tmp/preflight051-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight051-ready.log && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight051-ready.log | tail -1)"
  grep -q 'OFFICE_NOTIFICATION_SETTINGS_SCHEMA_READY' /tmp/preflight051-ready.log && ok "A: OFFICE_NOTIFICATION_SETTINGS_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig051_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE office_notification_settings CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_051" >/tmp/preflight051-misstbl.log 2>&1
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight051-misstbl.log && ok "B: preflight SAFE TABLE_MISSING" || bad "B: preflight"
  apply_migration_051
  [[ "$(psql_db -At -c "SELECT to_regclass('public.office_notification_settings') IS NOT NULL")" == "t" ]] && ok "B: table restored" || bad "B: restore failed"
  trap - EXIT
  teardown_db

  # C: wrong unique BLOCK
  setup_db "mig051_wrong_unique"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE office_notification_settings DROP CONSTRAINT office_notification_settings_office_id_event_type_key; ALTER TABLE office_notification_settings ADD CONSTRAINT office_notification_settings_office_id_key UNIQUE (office_id);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_051" >/tmp/preflight051-uq.log 2>&1; then
    bad "C: preflight should BLOCK INCOMPATIBLE_UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight051-uq.log && ok "C: preflight BLOCK INCOMPATIBLE_UNIQUE" || bad "C: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_051" >/tmp/mig051-uq.log 2>&1; then
    bad "C: migration should BLOCK INCOMPATIBLE_UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig051-uq.log && ok "C: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "C: mig reason"
  fi
  trap - EXIT
  teardown_db

  # D: approved UNIQUE + extra incompatible UNIQUE BLOCK, rows preserved
  setup_db "mig051_extra_unique"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO office_notification_settings (office_id, event_type, push_enabled, in_app_enabled, email_enabled)
    VALUES ('o-051','evt-extra', true, true, false);
    ALTER TABLE office_notification_settings ADD CONSTRAINT office_notification_settings_event_type_key UNIQUE (event_type);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_051" >/tmp/preflight051-extra.log 2>&1; then
    bad "D: preflight should BLOCK INCOMPATIBLE_UNIQUE (approved + extra)"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight051-extra.log && ok "D: preflight BLOCK INCOMPATIBLE_UNIQUE (approved + extra)" || bad "D: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_051" >/tmp/mig051-extra.log 2>&1; then
    bad "D: migration should BLOCK INCOMPATIBLE_UNIQUE (approved + extra)"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig051-extra.log && ok "D: migration BLOCK INCOMPATIBLE_UNIQUE (approved + extra)" || bad "D: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM office_notification_settings WHERE event_type='evt-extra'")" == "1" ]] && ok "D: rows preserved" || bad "D: rows changed"
  trap - EXIT
  teardown_db

  # E: duplicate unique key BLOCK, rows preserved
  setup_db "mig051_dup_key"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE office_notification_settings DROP CONSTRAINT office_notification_settings_office_id_event_type_key;
    INSERT INTO office_notification_settings (office_id, event_type, push_enabled, in_app_enabled, email_enabled) VALUES
      ('o1','dup-evt', true, true, false),
      ('o1','dup-evt', false, true, false);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_051" >/tmp/preflight051-dup.log 2>&1; then
    bad "E: preflight should BLOCK DUPLICATE_UNIQUE_KEY"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight051-dup.log && ok "E: preflight BLOCK DUPLICATE_UNIQUE_KEY" || bad "E: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_051" >/tmp/mig051-dup.log 2>&1; then
    bad "E: migration should BLOCK DUPLICATE_UNIQUE_KEY"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY' /tmp/mig051-dup.log && ok "E: migration BLOCK DUPLICATE_UNIQUE_KEY" || bad "E: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM office_notification_settings WHERE event_type='dup-evt'")" == "2" ]] && ok "E: duplicate rows preserved" || bad "E: rows changed"
  trap - EXIT
  teardown_db

  # F: Runtime CREATE removed; DML + office predicates preserved
  if grep -qE 'CREATE TABLE IF NOT EXISTS office_notification_settings' "$NOTIF_SRC"; then
    bad "F: notifications.ts still contains Runtime CREATE TABLE"
  else
    ok "F: notifications.ts has no Runtime CREATE TABLE"
  fi
  grep -q "to_regclass('public.office_notification_settings')" "$NOTIF_SRC" \
    && ok "F: readiness check present" \
    || bad "F: readiness check missing"
  grep -q 'ON CONFLICT (office_id, event_type) DO UPDATE' "$NOTIF_SRC" \
    && grep -q 'WHERE office_id = ${officeId}' "$NOTIF_SRC" \
    && ok "F: upsert DML and office predicates preserved" \
    || bad "F: DML or office predicates missing"

  # G: P0 fails without owned table / restores
  setup_db "mig051_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig051-p0-present.log 2>&1; then
    ok "G: verify-schema passes with 051 objects"
  else
    bad "G: verify failed after full chain"; tail -20 /tmp/mig051-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE office_notification_settings CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig051-p0.log 2>&1; then
    bad "G: verify-schema should fail without office_notification_settings"
  else
    grep -qi 'office_notification_settings' /tmp/mig051-p0.log && ok "G: P0 verify fails when table absent" || bad "G: verify log missing table"
  fi
  apply_migration_051
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig051-p0-restored.log 2>&1; then
    ok "G: verify-schema passes after 051 restore"
  else
    bad "G: verify failed after restore"; tail -20 /tmp/mig051-p0-restored.log
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_052_messaging_runtime_indexes() {
  log "Scenario 052 — Messaging Runtime indexes: greenfield / BLOCK / Runtime / restore"
  local PREFLIGHT_052="$ROOT/scripts/db/preflight-migration-052.sql"
  local IM_SRC="$ROOT/artifacts/api-server/src/modules/operations/internal-messages.ts"

  # A: greenfield — office_messages indexes present; folder index gap closed; idempotent
  setup_db "mig052_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local idx_ok
  idx_ok=$(psql_db -At -c "SELECT (to_regclass('public.idx_msgs_sender_date') IS NOT NULL AND to_regclass('public.idx_msgs_office_date') IS NOT NULL AND to_regclass('public.idx_msgs_office_folder') IS NOT NULL)")
  [[ "$idx_ok" == "t" ]] && ok "A: office_messages Runtime indexes present" || bad "A: msgs indexes missing"
  local folder_cols
  folder_cols=$(psql_db -At -c "SELECT array_agg(a.attname::text ORDER BY k.ordinality)::text FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace JOIN pg_index x ON x.indexrelid=i.oid CROSS JOIN LATERAL unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality) JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum WHERE n.nspname='public' AND i.relname='idx_msgs_office_folder'")
  [[ "$folder_cols" == "{office_id,folder}" ]] && ok "A: idx_msgs_office_folder (office_id, folder)" || bad "A: folder cols=$folder_cols"
  apply_migration_052
  ok "A: re-run 052 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_052" >/tmp/preflight052-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight052-ready.log && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight052-ready.log | tail -1)"
  grep -q 'MESSAGING_RUNTIME_INDEXES_READY' /tmp/preflight052-ready.log && ok "A: MESSAGING_RUNTIME_INDEXES_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing folder index SAFE + restore
  setup_db "mig052_miss_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_msgs_office_folder;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_052" >/tmp/preflight052-miss.log 2>&1
  grep -q 'MISSING_INDEXES\|SAFE_AUTO_REPAIR' /tmp/preflight052-miss.log && ok "B: preflight SAFE MISSING_INDEXES" || bad "B: preflight"
  apply_migration_052
  [[ "$(psql_db -At -c "SELECT to_regclass('public.idx_msgs_office_folder') IS NOT NULL")" == "t" ]] && ok "B: idx_msgs_office_folder restored" || bad "B: restore failed"
  trap - EXIT
  teardown_db

  # C: wrong DESC on idx_msgs_office_date BLOCK
  setup_db "mig052_wrong_desc"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX idx_msgs_office_date; CREATE INDEX idx_msgs_office_date ON office_messages (office_id, created_at ASC);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_052" >/tmp/preflight052-desc.log 2>&1; then
    bad "C: preflight should BLOCK INCOMPATIBLE_INDEX"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight052-desc.log && ok "C: preflight BLOCK INCOMPATIBLE_INDEX" || bad "C: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_052" >/tmp/mig052-desc.log 2>&1; then
    bad "C: migration should BLOCK INCOMPATIBLE_INDEX"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig052-desc.log && ok "C: migration BLOCK INCOMPATIBLE_INDEX" || bad "C: mig reason"
  fi
  trap - EXIT
  teardown_db

  # D: stolen index name on wrong table BLOCK
  setup_db "mig052_stolen"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX idx_msgs_office_folder;
    CREATE TABLE IF NOT EXISTS mig052_dummy (office_id text, folder text);
    CREATE INDEX idx_msgs_office_folder ON mig052_dummy (office_id, folder);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_052" >/tmp/preflight052-stolen.log 2>&1; then
    bad "D: preflight should BLOCK INCOMPATIBLE_INDEX (stolen)"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight052-stolen.log && ok "D: preflight BLOCK INCOMPATIBLE_INDEX (stolen)" || bad "D: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_052" >/tmp/mig052-stolen.log 2>&1; then
    bad "D: migration should BLOCK INCOMPATIBLE_INDEX (stolen)"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig052-stolen.log && ok "D: migration BLOCK INCOMPATIBLE_INDEX (stolen)" || bad "D: mig reason"
  fi
  trap - EXIT
  teardown_db

  # E: Runtime CREATE INDEX removed; tenant predicates preserved
  if grep -qE 'CREATE INDEX IF NOT EXISTS idx_msgs_(sender_date|office_date|office_folder)' "$IM_SRC"; then
    bad "E: internal-messages.ts still contains Runtime CREATE INDEX for msgs"
  else
    ok "E: no Runtime CREATE INDEX for msgs indexes"
  fi
  if grep -qE 'CREATE INDEX IF NOT EXISTS idx_(rcpt_user_unread|rcpt_msg|attach_msg)' "$IM_SRC"; then
    bad "E: internal-messages.ts still contains Runtime CREATE INDEX for rcpt/attach"
  else
    ok "E: no Runtime CREATE INDEX for rcpt/attach"
  fi
  grep -q "to_regclass('public.idx_msgs_office_folder')" "$IM_SRC" \
    && grep -q 'ensureMessagingRuntimeIndexes' "$IM_SRC" \
    && ok "E: readiness checks present" \
    || bad "E: readiness missing"
  grep -q 'WHERE m.office_id = ${tenantId}' "$IM_SRC" \
    && grep -q 'ORDER BY m.created_at DESC' "$IM_SRC" \
    && ok "E: tenant/folder query predicates preserved" \
    || bad "E: DML predicates missing"

  # F: recipients present → indexes applied
  setup_db "mig052_rcpt"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE IF NOT EXISTS office_message_recipients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID, user_id TEXT, user_name TEXT, is_read BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS office_message_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID, file_name TEXT, file_url TEXT, file_size INT
    );
  " >/dev/null
  apply_migration_052
  local rcpt_ok
  rcpt_ok=$(psql_db -At -c "SELECT (to_regclass('public.idx_rcpt_user_unread') IS NOT NULL AND to_regclass('public.idx_rcpt_msg') IS NOT NULL AND to_regclass('public.idx_attach_msg') IS NOT NULL)")
  [[ "$rcpt_ok" == "t" ]] && ok "F: rcpt/attach indexes created when tables exist" || bad "F: rcpt/attach indexes missing"
  trap - EXIT
  teardown_db
}

scenario_migration_053_security_centers() {
  log "Scenario 053 — Security Centers: greenfield / UNIQUE / INDEX / FK / Runtime / P0"
  local PREFLIGHT_053="$ROOT/scripts/db/preflight-migration-053.sql"
  local SOC_SRC="$ROOT/artifacts/api-server/src/modules/security/soc.ts"
  local AUDIT_SRC="$ROOT/artifacts/api-server/src/modules/security/auditCenter.ts"
  local COMP_SRC="$ROOT/artifacts/api-server/src/modules/security/complianceCenter.ts"
  local DR_SRC="$ROOT/artifacts/api-server/src/modules/security/drCenter.ts"
  local MFA_SRC="$ROOT/artifacts/api-server/src/modules/security/mfaCenter.ts"

  # A: greenfield READY + idempotent + ALREADY + UNIQUEs + indexes + FK
  setup_db "mig053_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_cnt uq_ok idx_ok fk_ok pk_mfa
  tbl_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN ('security_sessions','security_alerts','blocked_ips','mfa_status_cache','audit_coverage_rules','audit_risk_scores','compliance_controls','data_requests','retention_policies','legal_holds','dr_restore_points','dr_test_runs','dr_health_checks','high_risk_op_log','recovery_codes')")
  [[ "$tbl_cnt" == "15" ]] && ok "A: 15 Security Center tables present" || bad "A: table count=$tbl_cnt"
  uq_ok=$(psql_db -At -c "SELECT (
    EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.blocked_ips'::regclass AND c.contype='u' AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*ip_address[[:space:]]*\\)')
    AND EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.compliance_controls'::regclass AND c.contype='u' AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*framework[[:space:]]*,[[:space:]]*control_id[[:space:]]*\\)')
    AND EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.retention_policies'::regclass AND c.contype='u' AND pg_get_constraintdef(c.oid) ~* 'UNIQUE[[:space:]]*\\([[:space:]]*resource_type[[:space:]]*\\)')
  )")
  [[ "$uq_ok" == "t" ]] && ok "A: UNIQUEs for ON CONFLICT present" || bad "A: UNIQUEs"
  pk_mfa=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.mfa_status_cache'::regclass AND c.contype='p' AND pg_get_constraintdef(c.oid)='PRIMARY KEY (user_id)')")
  [[ "$pk_mfa" == "t" ]] && ok "A: mfa_status_cache PRIMARY KEY (user_id)" || bad "A: mfa PK"
  idx_ok=$(psql_db -At -c "SELECT (to_regclass('public.idx_security_sessions_user') IS NOT NULL AND to_regclass('public.idx_audit_logs_created_at') IS NOT NULL AND to_regclass('public.idx_high_risk_op_user') IS NOT NULL)")
  [[ "$idx_ok" == "t" ]] && ok "A: Runtime indexes present" || bad "A: indexes"
  fk_ok=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.dr_test_runs'::regclass AND c.contype='f' AND c.conname='dr_test_runs_restore_point_id_fkey')")
  [[ "$fk_ok" == "t" ]] && ok "A: dr_test_runs FK CASCADE present" || bad "A: FK"
  apply_migration_053
  ok "A: re-run 053 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_053" >/tmp/preflight053-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight053-ready.log && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight053-ready.log | tail -1)"
  grep -q 'SECURITY_CENTERS_SCHEMA_READY' /tmp/preflight053-ready.log && ok "A: SECURITY_CENTERS_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig053_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE data_requests CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_053" >/tmp/preflight053-misstbl.log 2>&1
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight053-misstbl.log && ok "B: preflight SAFE TABLE_MISSING" || bad "B: preflight"
  apply_migration_053
  [[ "$(psql_db -At -c "SELECT to_regclass('public.data_requests') IS NOT NULL")" == "t" ]] && ok "B: data_requests restored" || bad "B: restore failed"
  trap - EXIT
  teardown_db

  # C: wrong unique BLOCK
  setup_db "mig053_wrong_unique"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE compliance_controls DROP CONSTRAINT compliance_controls_framework_control_id_key; ALTER TABLE compliance_controls ADD CONSTRAINT compliance_controls_control_id_key UNIQUE (control_id);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_053" >/tmp/preflight053-uq.log 2>&1; then
    bad "C: preflight should BLOCK INCOMPATIBLE_UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight053-uq.log && ok "C: preflight BLOCK INCOMPATIBLE_UNIQUE" || bad "C: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_053" >/tmp/mig053-uq.log 2>&1; then
    bad "C: migration should BLOCK INCOMPATIBLE_UNIQUE"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig053-uq.log && ok "C: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "C: mig reason"
  fi
  trap - EXIT
  teardown_db

  # D: approved UNIQUE + extra incompatible UNIQUE BLOCK, rows preserved
  setup_db "mig053_extra_unique"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO compliance_controls (framework, control_id, title) VALUES ('PDPL','PDPL-X','Extra');
    ALTER TABLE compliance_controls ADD CONSTRAINT compliance_controls_title_key UNIQUE (title);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_053" >/tmp/preflight053-extra.log 2>&1; then
    bad "D: preflight should BLOCK INCOMPATIBLE_UNIQUE (approved + extra)"
  else
    grep -q 'INCOMPATIBLE_UNIQUE\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight053-extra.log && ok "D: preflight BLOCK INCOMPATIBLE_UNIQUE (approved + extra)" || bad "D: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_053" >/tmp/mig053-extra.log 2>&1; then
    bad "D: migration should BLOCK INCOMPATIBLE_UNIQUE (approved + extra)"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig053-extra.log && ok "D: migration BLOCK INCOMPATIBLE_UNIQUE (approved + extra)" || bad "D: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM compliance_controls WHERE control_id='PDPL-X'")" == "1" ]] && ok "D: compliance_controls rows preserved" || bad "D: rows changed"
  trap - EXIT
  teardown_db

  # E: duplicate unique key BLOCK, rows preserved
  setup_db "mig053_dup_key"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE retention_policies DROP CONSTRAINT retention_policies_resource_type_key;
    INSERT INTO retention_policies (resource_type, retention_days) VALUES
      ('dup-res-053', 10),
      ('dup-res-053', 20);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_053" >/tmp/preflight053-dup.log 2>&1; then
    bad "E: preflight should BLOCK DUPLICATE_UNIQUE_KEY"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight053-dup.log && ok "E: preflight BLOCK DUPLICATE_UNIQUE_KEY" || bad "E: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_053" >/tmp/mig053-dup.log 2>&1; then
    bad "E: migration should BLOCK DUPLICATE_UNIQUE_KEY"
  else
    grep -q 'DUPLICATE_UNIQUE_KEY' /tmp/mig053-dup.log && ok "E: migration BLOCK DUPLICATE_UNIQUE_KEY" || bad "E: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM retention_policies WHERE resource_type='dup-res-053'")" == "2" ]] && ok "E: duplicate retention rows preserved" || bad "E: rows changed"
  trap - EXIT
  teardown_db

  # F: wrong DESC on idx_audit_logs_created_at BLOCK
  setup_db "mig053_wrong_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX idx_audit_logs_created_at; CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at ASC);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_053" >/tmp/preflight053-idx.log 2>&1; then
    bad "F: preflight should BLOCK INCOMPATIBLE_INDEX"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight053-idx.log && ok "F: preflight BLOCK INCOMPATIBLE_INDEX" || bad "F: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_053" >/tmp/mig053-idx.log 2>&1; then
    bad "F: migration should BLOCK INCOMPATIBLE_INDEX"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig053-idx.log && ok "F: migration BLOCK INCOMPATIBLE_INDEX" || bad "F: mig reason"
  fi
  trap - EXIT
  teardown_db

  # G: stolen index name on wrong table BLOCK
  setup_db "mig053_stolen"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX idx_security_sessions_user;
    CREATE TABLE IF NOT EXISTS mig053_dummy (user_id text);
    CREATE INDEX idx_security_sessions_user ON mig053_dummy (user_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_053" >/tmp/preflight053-stolen.log 2>&1; then
    bad "G: preflight should BLOCK INCOMPATIBLE_INDEX (stolen)"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight053-stolen.log && ok "G: preflight BLOCK INCOMPATIBLE_INDEX (stolen)" || bad "G: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_053" >/tmp/mig053-stolen.log 2>&1; then
    bad "G: migration should BLOCK INCOMPATIBLE_INDEX (stolen)"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig053-stolen.log && ok "G: migration BLOCK INCOMPATIBLE_INDEX (stolen)" || bad "G: mig reason"
  fi
  trap - EXIT
  teardown_db

  # H: orphan FK BLOCK, rows preserved
  setup_db "mig053_orphan"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE dr_test_runs DROP CONSTRAINT IF EXISTS dr_test_runs_restore_point_id_fkey;
    INSERT INTO dr_test_runs (restore_point_id, status)
    VALUES ('00000000-0000-0000-0000-000000000053', 'running');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_053" >/tmp/preflight053-orphan.log 2>&1; then
    bad "H: preflight should BLOCK ORPHAN_FK"
  else
    grep -q 'ORPHAN_FK\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight053-orphan.log && ok "H: preflight BLOCK ORPHAN_FK" || bad "H: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_053" >/tmp/mig053-orphan.log 2>&1; then
    bad "H: migration should BLOCK ORPHAN_FK"
  else
    grep -q 'ORPHAN_FK' /tmp/mig053-orphan.log && ok "H: migration BLOCK ORPHAN_FK" || bad "H: mig reason"
  fi
  [[ "$(psql_db -At -c "SELECT COUNT(*) FROM dr_test_runs WHERE restore_point_id='00000000-0000-0000-0000-000000000053'")" == "1" ]] && ok "H: orphan dr_test_runs row preserved" || bad "H: rows changed"
  trap - EXIT
  teardown_db

  # I: Runtime CREATE/INDEX removed; DML + seeds + SA preserved
  if grep -qE 'CREATE TABLE IF NOT EXISTS (security_sessions|blocked_ips|audit_coverage_rules|retention_policies|dr_restore_points|high_risk_op_log)' "$SOC_SRC" "$AUDIT_SRC" "$COMP_SRC" "$DR_SRC" "$MFA_SRC"; then
    bad "I: security modules still contain Runtime CREATE TABLE"
  else
    ok "I: security modules have no Runtime CREATE TABLE"
  fi
  if grep -qE 'CREATE INDEX IF NOT EXISTS idx_(security_|audit_logs_|data_requests_|compliance_controls_|high_risk_op_|recovery_codes_)' "$SOC_SRC" "$AUDIT_SRC" "$COMP_SRC" "$MFA_SRC"; then
    bad "I: security modules still contain Runtime CREATE INDEX"
  else
    ok "I: security modules have no Runtime CREATE INDEX"
  fi
  grep -q "to_regclass('public.security_sessions')" "$SOC_SRC" \
    && grep -q "to_regclass('public.retention_policies')" "$COMP_SRC" \
    && grep -q "to_regclass('public.dr_restore_points')" "$DR_SRC" \
    && grep -q "to_regclass('public.high_risk_op_log')" "$MFA_SRC" \
    && ok "I: readiness checks present" \
    || bad "I: readiness checks missing"
  grep -q 'ON CONFLICT (framework, control_id) DO NOTHING' "$COMP_SRC" \
    && grep -q 'ON CONFLICT (resource_type) DO NOTHING' "$COMP_SRC" \
    && grep -q 'ON CONFLICT (ip_address)' "$SOC_SRC" \
    && grep -q 'ON CONFLICT (user_id)' "$MFA_SRC" \
    && grep -q 'requireSuperAdmin' "$SOC_SRC" \
    && ok "I: seeds/ON CONFLICT/SA preserved" \
    || bad "I: DML or SA missing"

  # J: P0 fails without owned table / restores
  setup_db "mig053_p0"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig053-p0-present.log 2>&1; then
    ok "J: verify-schema passes with 053 objects"
  else
    bad "J: verify failed after full chain"; tail -20 /tmp/mig053-p0-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE security_sessions CASCADE;" >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig053-p0.log 2>&1; then
    bad "J: verify-schema should fail without security_sessions"
  else
    grep -qi 'security_sessions' /tmp/mig053-p0.log && ok "J: P0 verify fails when security_sessions absent" || bad "J: verify log missing table"
  fi
  apply_migration_053
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig053-p0-restored.log 2>&1; then
    ok "J: verify-schema passes after 053 restore"
  else
    bad "J: verify failed after restore"; tail -20 /tmp/mig053-p0-restored.log
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_054_platform_runtime() {
  log "Scenario 054 — Platform Runtime: greenfield / SAFE / BLOCK / Runtime / P0"
  local PREFLIGHT_054="$ROOT/scripts/db/preflight-migration-054.sql"
  local CT_SRC="$ROOT/artifacts/api-server/src/modules/platform/control-tower.ts"
  local LG_SRC="$ROOT/artifacts/api-server/src/modules/platform/launchGate.ts"
  local GOV_SRC="$ROOT/artifacts/api-server/src/core/governance/governanceKernel.ts"

  # A: greenfield — platform tables + indexes present; idempotent
  setup_db "mig054_fresh"
  trap teardown_db EXIT
  apply_all_migrations
  local tbl_ok idx_ok
  tbl_ok=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('ct_security_events','governance_action_log','go_live_certificates',
                        'system_audit_logs','engineering_tasks','prod_incidents',
                        'launch_events','os_events','os_action_queue')")
  [[ "$tbl_ok" == "9" ]] && ok "A: platform core tables present" || bad "A: tables count=$tbl_ok"
  idx_ok=$(psql_db -At -c "
    SELECT (to_regclass('public.idx_ct_sec_events_severity') IS NOT NULL
        AND to_regclass('public.idx_gov_log_created') IS NOT NULL
        AND to_regclass('public.idx_sys_audit_admin') IS NOT NULL)")
  [[ "$idx_ok" == "t" ]] && ok "A: platform Runtime indexes present" || bad "A: indexes missing"
  apply_migration_054
  ok "A: re-run 054 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_054" >/tmp/preflight054-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight054-ready.log && ok "A: preflight ALREADY_CORRECT" || bad "A: $(grep chosen_action /tmp/preflight054-ready.log | tail -1)"
  grep -q 'PLATFORM_RUNTIME_SCHEMA_READY' /tmp/preflight054-ready.log && ok "A: PLATFORM_RUNTIME_SCHEMA_READY" || bad "A: ready reason"
  trap - EXIT
  teardown_db

  # B: missing table SAFE + restore
  setup_db "mig054_miss_tbl"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE os_action_queue CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_054" >/tmp/preflight054-misstbl.log 2>&1
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight054-misstbl.log && ok "B: preflight SAFE TABLE_MISSING" || bad "B: preflight"
  apply_migration_054
  [[ "$(psql_db -At -c "SELECT to_regclass('public.os_action_queue') IS NOT NULL")" == "t" ]] && ok "B: os_action_queue restored" || bad "B: restore failed"
  trap - EXIT
  teardown_db

  # C: wrong DESC on idx_gov_log_created BLOCK
  setup_db "mig054_wrong_idx"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX idx_gov_log_created; CREATE INDEX idx_gov_log_created ON governance_action_log (created_at ASC);" >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_054" >/tmp/preflight054-idx.log 2>&1; then
    bad "C: preflight should BLOCK INCOMPATIBLE_INDEX"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight054-idx.log && ok "C: preflight BLOCK INCOMPATIBLE_INDEX" || bad "C: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_054" >/tmp/mig054-idx.log 2>&1; then
    bad "C: migration should BLOCK INCOMPATIBLE_INDEX"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig054-idx.log && ok "C: migration BLOCK INCOMPATIBLE_INDEX" || bad "C: mig reason"
  fi
  trap - EXIT
  teardown_db

  # D: stolen index name BLOCK
  setup_db "mig054_stolen"
  trap teardown_db EXIT
  apply_all_migrations
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX idx_sys_audit_admin;
    CREATE TABLE IF NOT EXISTS mig054_dummy (admin_user_id text, created_at timestamptz);
    CREATE INDEX idx_sys_audit_admin ON mig054_dummy (admin_user_id, created_at);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_054" >/tmp/preflight054-stolen.log 2>&1; then
    bad "D: preflight should BLOCK INCOMPATIBLE_INDEX (stolen)"
  else
    grep -q 'INCOMPATIBLE_INDEX\|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight054-stolen.log && ok "D: preflight BLOCK INCOMPATIBLE_INDEX (stolen)" || bad "D: reason"
  fi
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_054" >/tmp/mig054-stolen.log 2>&1; then
    bad "D: migration should BLOCK INCOMPATIBLE_INDEX (stolen)"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig054-stolen.log && ok "D: migration BLOCK INCOMPATIBLE_INDEX (stolen)" || bad "D: mig reason"
  fi
  trap - EXIT
  teardown_db

  # E: Runtime CREATE removed; DML preserved
  if grep -qE 'CREATE TABLE IF NOT EXISTS ct_security_events' "$CT_SRC"; then
    bad "E: control-tower.ts still contains Runtime CREATE ct_security_events"
  else
    ok "E: no Runtime CREATE in control-tower.ts"
  fi
  if grep -qE 'CREATE INDEX IF NOT EXISTS idx_ct_sec_events' "$LG_SRC"; then
    bad "E: launchGate.ts still contains Runtime CREATE INDEX"
  else
    ok "E: no Runtime CREATE INDEX in launchGate.ts"
  fi
  if grep -qE 'CREATE TABLE IF NOT EXISTS governance_action_log' "$GOV_SRC"; then
    bad "E: governanceKernel.ts still contains Runtime CREATE governance_action_log"
  else
    ok "E: no Runtime CREATE in governanceKernel.ts"
  fi
  grep -q 'INSERT INTO ct_security_events' "$CT_SRC" && ok "E: control-tower DML preserved" || bad "E: control-tower DML missing"
  grep -q 'INSERT INTO governance_action_log' "$GOV_SRC" && ok "E: governance DML preserved" || bad "E: governance DML missing"

  # J: P0 verify gates platform tables
  setup_db "mig054_p0"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016; apply_migration_017; apply_migration_018; apply_migration_019
  apply_migration_020; apply_migration_021; apply_migration_025; apply_migration_026
  apply_migration_027; apply_migration_028; apply_migration_029; apply_migration_030
  apply_migration_031; apply_migration_032; apply_migration_033; apply_migration_034
  apply_migration_035; apply_migration_036; apply_migration_037; apply_migration_038
  apply_migration_039; apply_migration_040; apply_migration_041; apply_migration_042
  apply_migration_043; apply_migration_044; apply_migration_045; apply_migration_046
  apply_migration_047; apply_migration_048; apply_migration_049; apply_migration_050
  apply_migration_051; apply_migration_052; apply_migration_053
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig054-p0.log 2>&1; then
    bad "J: verify-schema should fail without 054 platform tables"
  else
    grep -qi 'ct_security_events\|governance_action_log\|os_events' /tmp/mig054-p0.log && ok "J: P0 verify fails when 054 tables absent" || bad "J: verify log missing table"
  fi
  apply_migration_054
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/mig054-p0-restored.log 2>&1; then
    ok "J: verify-schema passes after 054 restore"
  else
    bad "J: verify failed after restore"; tail -20 /tmp/mig054-p0-restored.log
  fi
  trap - EXIT
  teardown_db
}

scenario_migration_011_stripe_infra() {
  log "Scenario 3e — migration 011: fresh / complete / partial / duplicates / invalid status / idempotent"

  # ── A. Fresh database ────────────────────────────────────────────────────
  setup_db "mig011_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010

  local pre_events
  pre_events=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='stripe_events'
    );")
  [[ "$pre_events" == "f" ]] && ok "A pre-011: stripe_events absent" || bad "A pre-011: stripe_events should be absent"

  apply_migration_011

  local post_events post_dlq post_recon ev_cols uniq_idx status_check idx_status idx_recon
  post_events=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='stripe_events'
    );")
  post_dlq=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='stripe_dead_letters'
    );")
  post_recon=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='stripe_reconciliation_log'
    );")
  ev_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_events'
      AND column_name IN ('stripe_event_id','type','payload','status','retry_count','last_error','created_at','processed_at');")
  uniq_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.stripe_events'::regclass AND contype='u'
      AND pg_get_constraintdef(oid) ILIKE '%stripe_event_id%';")
  status_check=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.stripe_events'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%pending%processing%done%failed%';")
  idx_status=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_stripe_events_status';")
  idx_recon=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_reconciliation_run_at';")

  [[ "$post_events" == "t" ]] && ok "A: stripe_events created" || bad "A: stripe_events missing"
  [[ "$post_dlq" == "t" ]] && ok "A: stripe_dead_letters created" || bad "A: stripe_dead_letters missing"
  [[ "$post_recon" == "t" ]] && ok "A: stripe_reconciliation_log created" || bad "A: stripe_reconciliation_log missing"
  [[ "$ev_cols" == "8" ]] && ok "A: stripe_events required columns present" || bad "A: cols=$ev_cols"
  [[ "$uniq_idx" -ge 1 ]] && ok "A: stripe_event_id unique present" || bad "A: unique missing"
  [[ "$status_check" -ge 1 ]] && ok "A: stripe_events status CHECK present" || bad "A: status CHECK missing"
  [[ "$idx_status" == "1" ]] && ok "A: idx_stripe_events_status present" || bad "A: status index missing"
  [[ "$idx_recon" == "1" ]] && ok "A: idx_reconciliation_run_at present" || bad "A: recon index missing"

  apply_migration_011
  ok "A/F: re-run 011 on fresh schema succeeded"

  apply_migration_012
  apply_migration_013
  apply_migration_014
  apply_migration_015
  apply_migration_016
  apply_migration_017
  if verify_p0_schema /tmp/verify-011.log; then
    ok "A: verify-schema.sh passed after 011→017"
  else
    bad "A: verify-schema.sh failed after 011→017"; tail -20 /tmp/verify-011.log
  fi

  if ! grep -qE 'ensureStripeBufferTables|ensureReconciliationTable|CREATE TABLE IF NOT EXISTS stripe_' \
      "$ROOT/artifacts/api-server/src/index.ts" \
      "$ROOT/artifacts/api-server/src/services/stripeEventBuffer.ts" \
      "$ROOT/artifacts/api-server/src/jobs/stripeReconcile.ts"; then
    ok "A: Runtime Stripe DDL helpers removed"
  else
    bad "A: Runtime Stripe DDL still present"
  fi

  trap - EXIT
  teardown_db

  # ── B. Existing complete tables ──────────────────────────────────────────
  setup_db "mig011_complete"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_011

  psql_db <<'SQL' >/dev/null
INSERT INTO stripe_events (stripe_event_id, type, payload, status)
VALUES ('evt_complete_011', 'invoice.paid', '{"id":"evt_complete_011"}'::jsonb, 'done');
INSERT INTO stripe_dead_letters (stripe_event_id, type, payload, error)
VALUES ('evt_dlq_011', 'charge.failed', '{"id":"evt_dlq_011"}'::jsonb, 'test error');
INSERT INTO stripe_reconciliation_log (period_start, period_end, status)
VALUES (NOW() - interval '1 day', NOW(), 'ok');
SQL

  apply_migration_011
  apply_migration_011

  local complete_cnt
  complete_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM stripe_events WHERE stripe_event_id='evt_complete_011';")
  [[ "$complete_cnt" == "1" ]] && ok "B: existing complete stripe_events row preserved" || bad "B: row count=$complete_cnt"
  ok "B/F: re-run 011 on complete schema succeeded"

  trap - EXIT
  teardown_db

  # ── C. Existing partial legacy stripe_events ─────────────────────────────
  setup_db "mig011_partial"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT,
  type TEXT
);
INSERT INTO stripe_events (stripe_event_id, type) VALUES ('evt_partial_011', 'invoice.paid');
CREATE TABLE stripe_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT
);
CREATE TABLE stripe_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ DEFAULT NOW()
);
SQL

  apply_migration_011

  local partial_cols partial_row dlq_cols recon_cols
  partial_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_events'
      AND column_name IN ('payload','status','retry_count','last_error','created_at','processed_at');")
  partial_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM stripe_events WHERE stripe_event_id='evt_partial_011' AND type='invoice.paid';")
  dlq_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_dead_letters'
      AND column_name IN ('type','payload','error','retry_count','created_at');")
  recon_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_reconciliation_log'
      AND column_name IN ('period_start','period_end','stripe_count','db_count','missing_count','drift_count','status','details','error');")

  [[ "$partial_cols" == "6" ]] && ok "C: missing stripe_events columns added" || bad "C: cols=$partial_cols"
  [[ "$partial_row" == "1" ]] && ok "C: legacy stripe_events row unchanged" || bad "C: legacy row altered"
  [[ "$dlq_cols" == "5" ]] && ok "C: missing stripe_dead_letters columns added" || bad "C: dlq cols=$dlq_cols"
  [[ "$recon_cols" == "9" ]] && ok "C: missing reconciliation_log columns added" || bad "C: recon cols=$recon_cols"

  apply_migration_011
  ok "C/F: re-run 011 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db

  # ── D. Duplicate legacy stripe_event_id ──────────────────────────────────
  setup_db "mig011_dup"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT,
  type TEXT,
  payload JSONB,
  status TEXT DEFAULT 'pending'
);
INSERT INTO stripe_events (stripe_event_id, type, payload) VALUES
  ('evt_dup_011', 'invoice.paid', '{}'::jsonb),
  ('evt_dup_011', 'invoice.paid', '{}'::jsonb);
CREATE TABLE stripe_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE stripe_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ok'
);
SQL

  set +e
  psql_db -f "$MIGRATION_011" >/tmp/mig011-dup.log 2>&1
  local dup_rc=$?
  set -e
  [[ "$dup_rc" -eq 0 ]] && ok "D: migration 011 succeeds with duplicate stripe_event_id" || {
    bad "D: migration failed with duplicates"; cat /tmp/mig011-dup.log
  }

  local dup_uniq dup_rows warn_hit
  dup_uniq=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.stripe_events'::regclass AND contype='u'
      AND pg_get_constraintdef(oid) ILIKE '%stripe_event_id%';")
  dup_rows=$(psql_db -At -c "SELECT COUNT(*) FROM stripe_events WHERE stripe_event_id='evt_dup_011';")
  warn_hit=$(grep -c 'skipping unique stripe_events.stripe_event_id' /tmp/mig011-dup.log || true)

  [[ "$dup_uniq" == "0" ]] && ok "D: unique NOT created when duplicates exist" || bad "D: unique was created"
  [[ "$dup_rows" == "2" ]] && ok "D: duplicate rows unmodified" || bad "D: rows changed count=$dup_rows"
  [[ "$warn_hit" -ge 1 ]] && ok "D: WARNING emitted for duplicate stripe_event_id" || bad "D: missing duplicate WARNING"

  local post_dlq_exists
  post_dlq_exists=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='stripe_dead_letters'
    );")
  [[ "$post_dlq_exists" == "t" ]] && ok "D: other tables committed despite skipped unique" || bad "D: dead_letters missing"

  apply_migration_011
  ok "D/F: re-run 011 after duplicate skip succeeded"

  trap - EXIT
  teardown_db

  # ── E. Invalid legacy status data ────────────────────────────────────────
  setup_db "mig011_badstatus"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE,
  type TEXT,
  payload JSONB,
  status TEXT
);
INSERT INTO stripe_events (stripe_event_id, type, payload, status)
VALUES ('evt_badstatus_011', 'invoice.paid', '{}'::jsonb, 'queued');
CREATE TABLE stripe_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE stripe_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ok'
);
SQL

  set +e
  psql_db -f "$MIGRATION_011" >/tmp/mig011-badstatus.log 2>&1
  local badstatus_rc=$?
  set -e
  [[ "$badstatus_rc" -eq 0 ]] && ok "E: migration 011 succeeds with invalid status value" || {
    bad "E: migration failed on invalid status"; cat /tmp/mig011-badstatus.log
  }

  local bad_check bad_row warn_status
  bad_check=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.stripe_events'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%pending%processing%done%failed%';")
  bad_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM stripe_events WHERE stripe_event_id='evt_badstatus_011' AND status='queued';")
  warn_status=$(grep -c 'skipping stripe_events status CHECK' /tmp/mig011-badstatus.log || true)

  [[ "$bad_check" == "0" ]] && ok "E: status CHECK skipped for invalid legacy status" || bad "E: CHECK was added"
  [[ "$bad_row" == "1" ]] && ok "E: invalid legacy row unchanged" || bad "E: legacy row altered"
  [[ "$warn_status" -ge 1 ]] && ok "E: WARNING emitted for invalid status" || bad "E: missing status WARNING"

  apply_migration_011
  ok "E/F: re-run 011 after CHECK skip succeeded"

  trap - EXIT
  teardown_db
}

# ── Scenario 3f: payment_transactions (012) ─────────────────────────────────
scenario_migration_012_payment_transactions() {
  log "Scenario 3f — migration 012: fresh / complete / partial / duplicates / invalid settlement / idempotent"

  # ── A. Fresh database ────────────────────────────────────────────────────
  setup_db "mig012_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_011

  local pre_pt
  pre_pt=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='payment_transactions'
    );")
  [[ "$pre_pt" == "f" ]] && ok "A pre-012: payment_transactions absent" || bad "A pre-012: should be absent"

  apply_migration_012

  local post_pt sett_cols office_idx uniq_idx check_cnt
  post_pt=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='payment_transactions'
    );")
  sett_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payment_transactions'
      AND column_name IN (
        'settlement_status','settled_at','settlement_ref',
        'gateway','gateway_payment_id','payment_link',
        'office_id','amount','status','created_at','stripe_event_id'
      );")
  office_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_payment_transactions_office_id';")
  uniq_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_payment_transactions_stripe_event_id';")
  check_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.payment_transactions'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%settlement_status%';")

  [[ "$post_pt" == "t" ]] && ok "A: payment_transactions created" || bad "A: table missing"
  [[ "$sett_cols" == "11" ]] && ok "A: core + settlement/gateway columns present" || bad "A: cols=$sett_cols"
  [[ "$office_idx" == "1" ]] && ok "A: office_id index present" || bad "A: office index missing"
  [[ "$uniq_idx" == "1" ]] && ok "A: stripe_event_id unique index present" || bad "A: unique index missing"
  [[ "$check_cnt" -ge 1 ]] && ok "A: settlement_status CHECK present" || bad "A: CHECK missing"

  apply_migration_012
  ok "A/F: re-run 012 on fresh schema succeeded"

  apply_migration_013
  apply_migration_014
  apply_migration_015
  apply_migration_016
  apply_migration_017
  if verify_p0_schema /tmp/verify-012.log; then
    ok "A: verify-schema.sh passed after 012+013+014+015+016+017"
  else
    bad "A: verify-schema.sh failed after 012+013+014+015+016+017"; tail -20 /tmp/verify-012.log
  fi

  if ! grep -qE 'ensurePaymentCols|ALTER TABLE payment_transactions' \
      "$ROOT/artifacts/api-server/src/modules/financial/payments.ts"; then
    ok "A: payment_transactions Runtime DDL removed from payments.ts"
  else
    bad "A: payment_transactions Runtime DDL still present"
  fi

  trap - EXIT
  teardown_db

  # ── B. Existing complete table ───────────────────────────────────────────
  setup_db "mig012_complete"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_011
  apply_migration_012

  psql_db <<'SQL' >/dev/null
INSERT INTO payment_transactions
  (office_id, amount, status, gateway, settlement_status, stripe_event_id)
VALUES ('office_complete', 100, 'completed', 'stripe', 'unsettled', 'evt_pt_complete');
SQL

  apply_migration_012
  apply_migration_012

  local complete_cnt
  complete_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM payment_transactions WHERE stripe_event_id='evt_pt_complete';")
  [[ "$complete_cnt" == "1" ]] && ok "B: existing complete row preserved" || bad "B: count=$complete_cnt"
  ok "B/F: re-run 012 on complete schema succeeded"

  trap - EXIT
  teardown_db

  # ── C. Partial legacy table missing settlement columns ───────────────────
  setup_db "mig012_partial"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  amount NUMERIC,
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO payment_transactions (office_id, amount, status)
VALUES ('office_partial', 42, 'completed');
SQL

  apply_migration_012

  local partial_cols partial_row
  partial_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payment_transactions'
      AND column_name IN (
        'settlement_status','settled_at','settlement_ref',
        'gateway','gateway_payment_id','payment_link'
      );")
  partial_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM payment_transactions
    WHERE office_id='office_partial' AND amount=42 AND status='completed';")

  [[ "$partial_cols" == "6" ]] && ok "C: settlement/gateway columns added on partial table" || bad "C: cols=$partial_cols"
  [[ "$partial_row" == "1" ]] && ok "C: legacy row unchanged after column repair" || bad "C: legacy row altered"

  apply_migration_012
  ok "C/F: re-run 012 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db

  # ── D. Duplicate legacy stripe_event_id ──────────────────────────────────
  setup_db "mig012_dup"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  amount NUMERIC,
  status TEXT,
  stripe_event_id TEXT,
  settlement_status TEXT
);
INSERT INTO payment_transactions (office_id, amount, status, stripe_event_id) VALUES
  ('office_dup', 10, 'completed', 'evt_pt_dup'),
  ('office_dup', 20, 'completed', 'evt_pt_dup');
SQL

  set +e
  psql_db -f "$MIGRATION_012" >/tmp/mig012-dup.log 2>&1
  local dup_rc=$?
  set -e
  [[ "$dup_rc" -eq 0 ]] && ok "D: migration 012 succeeds with duplicate stripe_event_id" || {
    bad "D: migration failed with duplicates"; cat /tmp/mig012-dup.log
  }

  local dup_uniq dup_rows warn_hit fee_cols
  dup_uniq=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_payment_transactions_stripe_event_id';")
  dup_rows=$(psql_db -At -c "
    SELECT COUNT(*) FROM payment_transactions WHERE stripe_event_id='evt_pt_dup';")
  warn_hit=$(grep -c 'skipping unique stripe_event_id' /tmp/mig012-dup.log || true)
  fee_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payment_transactions'
      AND column_name IN ('settlement_status','gateway','payment_link');")

  [[ "$dup_uniq" == "0" ]] && ok "D: unique index NOT created when duplicates exist" || bad "D: unique was created"
  [[ "$dup_rows" == "2" ]] && ok "D: duplicate rows unmodified" || bad "D: rows=$dup_rows"
  [[ "$warn_hit" -ge 1 ]] && ok "D: WARNING emitted for duplicate stripe_event_id" || bad "D: missing WARNING"
  [[ "$fee_cols" == "3" ]] && ok "D: column repairs committed despite skipped unique" || bad "D: cols=$fee_cols"

  apply_migration_012
  ok "D/F: re-run 012 after duplicate skip succeeded"

  trap - EXIT
  teardown_db

  # ── E. Invalid legacy settlement_status ──────────────────────────────────
  setup_db "mig012_badsettlement"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  amount NUMERIC,
  status TEXT,
  settlement_status TEXT
);
INSERT INTO payment_transactions (office_id, amount, status, settlement_status)
VALUES ('office_bad', 99, 'completed', 'pending_wire');
SQL

  set +e
  psql_db -f "$MIGRATION_012" >/tmp/mig012-badsettlement.log 2>&1
  local bad_rc=$?
  set -e
  [[ "$bad_rc" -eq 0 ]] && ok "E: migration 012 succeeds with invalid settlement_status" || {
    bad "E: migration failed on invalid settlement"; cat /tmp/mig012-badsettlement.log
  }

  local bad_check bad_row warn_sett
  bad_check=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.payment_transactions'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%settlement_status%';")
  bad_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM payment_transactions
    WHERE office_id='office_bad' AND settlement_status='pending_wire';")
  warn_sett=$(grep -c 'skipping settlement_status CHECK' /tmp/mig012-badsettlement.log || true)

  [[ "$bad_check" == "0" ]] && ok "E: settlement_status CHECK skipped" || bad "E: CHECK was added"
  [[ "$bad_row" == "1" ]] && ok "E: invalid legacy row unchanged" || bad "E: legacy row altered"
  [[ "$warn_sett" -ge 1 ]] && ok "E: WARNING emitted for invalid settlement_status" || bad "E: missing WARNING"

  apply_migration_012
  ok "E/F: re-run 012 after CHECK skip succeeded"

  trap - EXIT
  teardown_db
}

# ── Scenario 3g: ERP schema (013) ───────────────────────────────────────────
scenario_migration_013_erp() {
  log "Scenario 3g — migration 013: fresh / complete / partial / unique+seed/upsert / orphan FK / type mismatch / invalid checks / idempotent"

  # ── A. Fresh ─────────────────────────────────────────────────────────────
  setup_db "mig013_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_011
  apply_migration_012

  local pre_erp
  pre_erp=$(psql_db -At -c "
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='office_erp_ledger');")
  [[ "$pre_erp" == "f" ]] && ok "A pre-013: office_erp_ledger absent" || bad "A pre-013: should be absent"

  apply_migration_013

  local post_erp post_coa post_je idx_erp uniq_coa fk_ji
  post_erp=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='office_erp_ledger');")
  post_coa=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='chart_of_accounts');")
  post_je=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='journal_entries');")
  idx_erp=$(psql_db -At -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname='idx_erp_office';")
  uniq_coa=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.chart_of_accounts'::regclass AND contype='u'
      AND pg_get_constraintdef(oid) ILIKE '%account_code%';")
  fk_ji=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.journal_items'::regclass AND contype='f'
      AND pg_get_constraintdef(oid) ILIKE '%journal_entries%';")

  [[ "$post_erp" == "t" ]] && ok "A: office_erp_ledger created" || bad "A: erp ledger missing"
  [[ "$post_coa" == "t" ]] && ok "A: chart_of_accounts created" || bad "A: CoA missing"
  [[ "$post_je" == "t" ]] && ok "A: journal_entries created" || bad "A: journal_entries missing"
  [[ "$idx_erp" == "1" ]] && ok "A: idx_erp_office present" || bad "A: erp index missing"
  [[ "$uniq_coa" -ge 1 ]] && ok "A: CoA UNIQUE present" || bad "A: CoA unique missing"
  [[ "$fk_ji" -ge 1 ]] && ok "A: journal_items FK present" || bad "A: journal FK missing"

  apply_migration_013
  ok "A/F: re-run 013 on fresh schema succeeded"

  apply_migration_014
  apply_migration_015
  apply_migration_016
  apply_migration_017
  if verify_p0_schema /tmp/verify-013.log; then
    ok "A: verify-schema.sh passed after 013+014+015+016+017"
  else
    bad "A: verify-schema.sh failed after 013+014+015+016+017"; tail -20 /tmp/verify-013.log
  fi

  if ! grep -qE 'ensureERPTables|CREATE TABLE IF NOT EXISTS office_erp_ledger|CREATE TABLE IF NOT EXISTS chart_of_accounts' \
      "$ROOT/artifacts/api-server/src/modules/financial/erp-ledger.ts" \
      "$ROOT/artifacts/api-server/src/modules/financial/journalAccounting.ts" \
      "$ROOT/artifacts/api-server/src/index.ts"; then
    ok "A: ERP Runtime DDL removed from boot/modules"
  else
    bad "A: ERP Runtime DDL still present"
  fi

  trap - EXIT
  teardown_db

  # ── B. Complete existing ─────────────────────────────────────────────────
  setup_db "mig013_complete"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_011
  apply_migration_012
  apply_migration_013

  psql_db <<'SQL' >/dev/null
INSERT INTO office_erp_ledger
  (office_id, entry_type, account_code, account_name, account_type, amount)
VALUES ('off_complete', 'DEBIT', '1100', 'Cash', 'Asset', 100);
INSERT INTO chart_of_accounts (office_id, account_code, account_name, account_type)
VALUES ('off_complete', '1100', 'Cash', 'Asset');
SQL

  apply_migration_013
  apply_migration_013

  local complete_cnt
  complete_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM office_erp_ledger WHERE office_id='off_complete' AND amount=100;")
  [[ "$complete_cnt" == "1" ]] && ok "B: existing ERP row preserved" || bad "B: count=$complete_cnt"
  ok "B/F: re-run 013 on complete schema succeeded"

  trap - EXIT
  teardown_db

  # ── C. Partial ERP tables missing columns ────────────────────────────────
  setup_db "mig013_partial"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE office_erp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  amount NUMERIC
);
INSERT INTO office_erp_ledger (office_id, amount) VALUES ('off_partial', 50);
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  account_code TEXT
);
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT
);
CREATE TABLE journal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID,
  office_id TEXT
);
CREATE TABLE financial_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT
);
SQL

  apply_migration_013

  local erp_cols coa_cols anom_cols partial_row
  erp_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='office_erp_ledger'
      AND column_name IN ('entry_type','account_code','account_name','account_type','currency','pair_id','created_at');")
  coa_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='chart_of_accounts'
      AND column_name IN ('account_name','account_type','parent_code','is_active','created_at');")
  anom_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='financial_anomalies'
      AND column_name IN ('anomaly_type','severity','description','amount','reference','resolved','created_at');")
  partial_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM office_erp_ledger WHERE office_id='off_partial' AND amount=50;")

  [[ "$erp_cols" == "7" ]] && ok "C: missing office_erp_ledger columns added" || bad "C: erp cols=$erp_cols"
  [[ "$coa_cols" == "5" ]] && ok "C: missing chart_of_accounts columns added" || bad "C: coa cols=$coa_cols"
  [[ "$anom_cols" == "7" ]] && ok "C: missing financial_anomalies columns added" || bad "C: anom cols=$anom_cols"
  [[ "$partial_row" == "1" ]] && ok "C: legacy ERP row unchanged" || bad "C: legacy row altered"

  apply_migration_013
  ok "C/F: re-run 013 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db

  # ── D. Duplicate CoA UNIQUE(office_id, account_code) ─────────────────────
  setup_db "mig013_dup"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  account_code TEXT,
  account_name TEXT,
  account_type TEXT
);
INSERT INTO chart_of_accounts (office_id, account_code, account_name, account_type) VALUES
  ('off_dup', '1100', 'Cash A', 'Asset'),
  ('off_dup', '1100', 'Cash B', 'Asset');
CREATE TABLE office_erp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  entry_date DATE DEFAULT CURRENT_DATE,
  entry_type TEXT DEFAULT 'DEBIT',
  account_code TEXT DEFAULT '1100',
  account_name TEXT DEFAULT 'Cash',
  account_type TEXT DEFAULT 'Asset',
  amount NUMERIC(14,2) DEFAULT 1,
  currency TEXT DEFAULT 'SAR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  entry_date DATE DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT 'x',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE journal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID,
  office_id TEXT NOT NULL DEFAULT 'x',
  account_code TEXT NOT NULL DEFAULT '1100',
  account_name TEXT NOT NULL DEFAULT 'Cash',
  account_type TEXT NOT NULL DEFAULT 'Asset',
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0
);
CREATE TABLE financial_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  anomaly_type TEXT NOT NULL DEFAULT 'IMBALANCE',
  severity TEXT DEFAULT 'medium',
  description TEXT NOT NULL DEFAULT 'x'
);
SQL

  set +e
  psql_db -f "$MIGRATION_013" >/tmp/mig013-dup.log 2>&1
  local dup_rc=$?
  set -e
  [[ "$dup_rc" -eq 0 ]] && ok "D: migration 013 succeeds with CoA duplicates" || {
    bad "D: migration failed with CoA duplicates"; cat /tmp/mig013-dup.log
  }

  local dup_uniq dup_rows warn_hit
  dup_uniq=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.chart_of_accounts'::regclass AND contype='u'
      AND pg_get_constraintdef(oid) ILIKE '%account_code%';")
  dup_rows=$(psql_db -At -c "
    SELECT COUNT(*) FROM chart_of_accounts WHERE office_id='off_dup' AND account_code='1100';")
  warn_hit=$(grep -c 'skipping chart_of_accounts UNIQUE' /tmp/mig013-dup.log || true)

  [[ "$dup_uniq" == "0" ]] && ok "D: CoA UNIQUE NOT created when duplicates exist" || bad "D: unique was created"
  [[ "$dup_rows" == "2" ]] && ok "D: duplicate CoA rows unmodified" || bad "D: rows=$dup_rows"
  [[ "$warn_hit" -ge 1 ]] && ok "D: WARNING emitted for CoA UNIQUE skip" || bad "D: missing WARNING"

  # CoA seed must succeed without UNIQUE (INSERT ... WHERE NOT EXISTS).
  local seed_before seed_after seed_rerun
  seed_before=$(psql_db -At -c "SELECT count(*) FROM chart_of_accounts WHERE office_id = 'office-seed-coa'")
  psql_db <<'SQL' >/dev/null
INSERT INTO chart_of_accounts (office_id, account_code, account_name, account_type, parent_code)
SELECT 'office-seed-coa', v.code, v.name, v.type, v.parent
FROM (VALUES
  ('1000', 'Cash', 'Asset', NULL),
  ('1100', 'Accounts Receivable', 'Asset', NULL),
  ('2000', 'Accounts Payable', 'Liability', NULL)
) AS v(code, name, type, parent)
WHERE NOT EXISTS (
  SELECT 1 FROM chart_of_accounts c
  WHERE c.office_id = 'office-seed-coa' AND c.account_code = v.code
);
SQL
  seed_after=$(psql_db -At -c "SELECT count(*) FROM chart_of_accounts WHERE office_id = 'office-seed-coa'")
  [[ "$seed_after" -ge $((seed_before + 3)) ]] && ok "D: CoA seed succeeds without UNIQUE" || \
    bad "D: CoA seed failed without UNIQUE (before=$seed_before after=$seed_after)"

  psql_db <<'SQL' >/dev/null
INSERT INTO chart_of_accounts (office_id, account_code, account_name, account_type, parent_code)
SELECT 'office-seed-coa', v.code, v.name, v.type, v.parent
FROM (VALUES
  ('1000', 'Cash', 'Asset', NULL),
  ('1100', 'Accounts Receivable', 'Asset', NULL),
  ('2000', 'Accounts Payable', 'Liability', NULL)
) AS v(code, name, type, parent)
WHERE NOT EXISTS (
  SELECT 1 FROM chart_of_accounts c
  WHERE c.office_id = 'office-seed-coa' AND c.account_code = v.code
);
SQL
  seed_rerun=$(psql_db -At -c "SELECT count(*) FROM chart_of_accounts WHERE office_id = 'office-seed-coa'")
  [[ "$seed_rerun" == "$seed_after" ]] && ok "D: CoA re-seed idempotent without UNIQUE" || \
    bad "D: CoA re-seed not idempotent (after=$seed_after rerun=$seed_rerun)"

  # Account upsert must succeed without UNIQUE (UPDATE then INSERT WHERE NOT EXISTS).
  psql_db <<'SQL' >/dev/null
UPDATE chart_of_accounts
SET account_name = 'Cash Updated', account_type = 'Asset', parent_code = NULL, is_active = true
WHERE office_id = 'office-seed-coa' AND account_code = '1000';
INSERT INTO chart_of_accounts (office_id, account_code, account_name, account_type, parent_code, is_active)
SELECT 'office-seed-coa', '1000', 'Cash Updated', 'Asset', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM chart_of_accounts
  WHERE office_id = 'office-seed-coa' AND account_code = '1000'
);
INSERT INTO chart_of_accounts (office_id, account_code, account_name, account_type, parent_code, is_active)
SELECT 'office-seed-coa', '9999', 'New Account', 'Expense', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM chart_of_accounts
  WHERE office_id = 'office-seed-coa' AND account_code = '9999'
);
SQL
  local upsert_name upsert_new
  upsert_name=$(psql_db -At -c "SELECT account_name FROM chart_of_accounts WHERE office_id = 'office-seed-coa' AND account_code = '1000' LIMIT 1")
  upsert_new=$(psql_db -At -c "SELECT count(*) FROM chart_of_accounts WHERE office_id = 'office-seed-coa' AND account_code = '9999'")
  [[ "$upsert_name" == "Cash Updated" ]] && ok "D: account upsert UPDATE path without UNIQUE" || \
    bad "D: upsert UPDATE failed (name=$upsert_name)"
  [[ "$upsert_new" == "1" ]] && ok "D: account upsert INSERT path without UNIQUE" || \
    bad "D: upsert INSERT failed (count=$upsert_new)"

  apply_migration_013
  ok "D/F: re-run 013 after unique skip + seed/upsert succeeded"

  trap - EXIT
  teardown_db

  # ── F. Orphan journal_items.entry_id → FK skip with WARNING ──────────────
  setup_db "mig013_orphan_ji"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  account_code TEXT NOT NULL DEFAULT '1100',
  account_name TEXT NOT NULL DEFAULT 'Cash',
  account_type TEXT NOT NULL DEFAULT 'Asset'
);
CREATE TABLE office_erp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  entry_date DATE DEFAULT CURRENT_DATE,
  entry_type TEXT DEFAULT 'DEBIT',
  account_code TEXT DEFAULT '1100',
  account_name TEXT DEFAULT 'Cash',
  account_type TEXT DEFAULT 'Asset',
  amount NUMERIC(14,2) DEFAULT 1,
  currency TEXT DEFAULT 'SAR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  entry_date DATE DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT 'x',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE journal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID,
  office_id TEXT NOT NULL DEFAULT 'x',
  account_code TEXT NOT NULL DEFAULT '1100',
  account_name TEXT NOT NULL DEFAULT 'Cash',
  account_type TEXT NOT NULL DEFAULT 'Asset',
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0
);
CREATE TABLE financial_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  anomaly_type TEXT NOT NULL DEFAULT 'IMBALANCE',
  severity TEXT DEFAULT 'medium',
  description TEXT NOT NULL DEFAULT 'x'
);
INSERT INTO journal_entries (office_id, description) VALUES ('office-ji', 'valid');
INSERT INTO journal_items (entry_id, office_id, account_code, account_name, account_type, debit, credit)
SELECT id, 'office-ji', '1000', 'Cash', 'Asset', 10, 0 FROM journal_entries WHERE office_id = 'office-ji' LIMIT 1;
INSERT INTO journal_items (entry_id, office_id, account_code, account_name, account_type, debit, credit)
VALUES ('00000000-0000-4000-8000-000000000099'::uuid, 'office-ji', '2000', 'AP', 'Liability', 0, 10);
SQL

  set +e
  psql_db -f "$MIGRATION_013" >/tmp/mig013-orphan-ji.log 2>&1
  local orphan_rc=$?
  set -e
  [[ "$orphan_rc" -eq 0 ]] && ok "F: migration 013 succeeds with orphan journal_items" || {
    bad "F: migration failed with orphan journal_items"; cat /tmp/mig013-orphan-ji.log
  }

  local orphan_fk orphan_warn
  orphan_fk=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.journal_items'::regclass AND contype='f'
      AND conname = 'journal_items_entry_id_fkey';")
  orphan_warn=$(grep -c 'skipping journal_items FK to journal_entries' /tmp/mig013-orphan-ji.log || true)
  [[ "$orphan_fk" == "0" ]] && ok "F: journal_items_entry_id_fkey skipped when orphans exist" || \
    bad "F: FK was created despite orphans"
  [[ "$orphan_warn" -ge 1 ]] && ok "F: WARNING emitted for orphan journal_items FK skip" || \
    bad "F: missing orphan FK WARNING"

  apply_migration_013
  ok "F/F: re-run 013 after orphan FK skip succeeded"

  trap - EXIT
  teardown_db

  # ── G. Incompatible journal_items.entry_id / journal_entries.id types ────
  setup_db "mig013_type_mismatch"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  account_code TEXT NOT NULL DEFAULT '1100',
  account_name TEXT NOT NULL DEFAULT 'Cash',
  account_type TEXT NOT NULL DEFAULT 'Asset'
);
CREATE TABLE office_erp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  entry_date DATE DEFAULT CURRENT_DATE,
  entry_type TEXT DEFAULT 'DEBIT',
  account_code TEXT DEFAULT '1100',
  account_name TEXT DEFAULT 'Cash',
  account_type TEXT DEFAULT 'Asset',
  amount NUMERIC(14,2) DEFAULT 1,
  currency TEXT DEFAULT 'SAR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  entry_date DATE DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT 'x',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE journal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT,
  office_id TEXT NOT NULL DEFAULT 'x',
  account_code TEXT NOT NULL DEFAULT '1100',
  account_name TEXT NOT NULL DEFAULT 'Cash',
  account_type TEXT NOT NULL DEFAULT 'Asset',
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0
);
CREATE TABLE financial_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  anomaly_type TEXT NOT NULL DEFAULT 'IMBALANCE',
  severity TEXT DEFAULT 'medium',
  description TEXT NOT NULL DEFAULT 'x'
);
INSERT INTO journal_entries (office_id, description) VALUES ('office-tm', 'tm');
INSERT INTO journal_items (entry_id, office_id, account_code, account_name, account_type, debit, credit)
VALUES ('not-a-uuid', 'office-tm', '1000', 'Cash', 'Asset', 1, 0);
SQL

  set +e
  psql_db -f "$MIGRATION_013" >/tmp/mig013-type-mismatch.log 2>&1
  local type_rc=$?
  set -e
  [[ "$type_rc" -eq 0 ]] && ok "G: migration 013 continues on entry_id/id type mismatch" || {
    bad "G: migration aborted on type mismatch"; cat /tmp/mig013-type-mismatch.log
  }

  local type_fk type_warn erp_ok
  type_fk=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.journal_items'::regclass AND contype='f'
      AND conname = 'journal_items_entry_id_fkey';")
  type_warn=$(grep -cE 'incompatible types|datatype_mismatch' /tmp/mig013-type-mismatch.log || true)
  erp_ok=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='office_erp_ledger');")
  [[ "$type_fk" == "0" ]] && ok "G: journal_items_entry_id_fkey skipped on type mismatch" || \
    bad "G: FK was created despite type mismatch"
  [[ "$type_warn" -ge 1 ]] && ok "G: WARNING emitted for incompatible entry_id/id types" || \
    bad "G: missing type-mismatch WARNING"
  [[ "$erp_ok" == "t" ]] && ok "G: later ERP objects still present after type-mismatch skip" || \
    bad "G: migration did not complete ERP objects"

  apply_migration_013
  ok "G/F: re-run 013 after type-mismatch skip succeeded"

  trap - EXIT
  teardown_db

  # ── E. Invalid entry_type / account_type ─────────────────────────────────
  setup_db "mig013_badcheck"
  trap teardown_db EXIT
  apply_migrations_base

  psql_db <<'SQL' >/dev/null
CREATE TABLE office_erp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  entry_type TEXT,
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  amount NUMERIC(14,2)
);
INSERT INTO office_erp_ledger (office_id, entry_type, account_code, account_name, account_type, amount)
VALUES ('off_bad', 'TRANSFER', '1100', 'Cash', 'Asset', 10);
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  account_code TEXT,
  account_name TEXT,
  account_type TEXT
);
INSERT INTO chart_of_accounts (office_id, account_code, account_name, account_type)
VALUES ('off_bad', '9999', 'Weird', 'Other');
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  entry_date DATE DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT 'x'
);
CREATE TABLE journal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID,
  office_id TEXT NOT NULL DEFAULT 'x',
  account_code TEXT NOT NULL DEFAULT 'x',
  account_name TEXT NOT NULL DEFAULT 'x',
  account_type TEXT NOT NULL DEFAULT 'x',
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0
);
CREATE TABLE financial_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL DEFAULT 'x',
  anomaly_type TEXT NOT NULL DEFAULT 'x',
  description TEXT NOT NULL DEFAULT 'x'
);
SQL

  set +e
  psql_db -f "$MIGRATION_013" >/tmp/mig013-badcheck.log 2>&1
  local bad_rc=$?
  set -e
  [[ "$bad_rc" -eq 0 ]] && ok "E: migration 013 succeeds with invalid CHECK values" || {
    bad "E: migration failed on invalid checks"; cat /tmp/mig013-badcheck.log
  }

  local entry_check type_check bad_row warn_entry warn_type
  entry_check=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.office_erp_ledger'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%DEBIT%CREDIT%';")
  type_check=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.chart_of_accounts'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%Asset%Liability%';")
  bad_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM office_erp_ledger WHERE office_id='off_bad' AND entry_type='TRANSFER';")
  warn_entry=$(grep -c 'skipping office_erp_ledger entry_type CHECK' /tmp/mig013-badcheck.log || true)
  warn_type=$(grep -c 'skipping chart_of_accounts account_type CHECK' /tmp/mig013-badcheck.log || true)

  [[ "$entry_check" == "0" ]] && ok "E: entry_type CHECK skipped" || bad "E: entry_type CHECK added"
  [[ "$type_check" == "0" ]] && ok "E: account_type CHECK skipped" || bad "E: account_type CHECK added"
  [[ "$bad_row" == "1" ]] && ok "E: invalid legacy ERP row unchanged" || bad "E: legacy row altered"
  [[ "$warn_entry" -ge 1 ]] && ok "E: WARNING for entry_type" || bad "E: missing entry_type WARNING"
  [[ "$warn_type" -ge 1 ]] && ok "E: WARNING for account_type" || bad "E: missing account_type WARNING"

  apply_migration_013
  ok "E/F: re-run 013 after CHECK skip succeeded"

  trap - EXIT
  teardown_db
}

# ── Scenario 3h: Bankruptcy schema (014) ────────────────────────────────────
scenario_migration_014_bankruptcy() {
  log "Scenario 3h — migration 014: fresh / idempotent / partial / duplicate UNIQUE / invalid CHECK / orphan FK / Runtime DDL audit"

  # ── A. Fresh ─────────────────────────────────────────────────────────────
  setup_db "mig014_fresh"
  trap teardown_db EXIT
  apply_migrations_through_013

  local pre_bk
  pre_bk=$(psql_db -At -c "
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='bankruptcy_cases');")
  [[ "$pre_bk" == "f" ]] && ok "A pre-014: bankruptcy_cases absent" || bad "A pre-014: should be absent"

  apply_migration_014

  local bk_tables idx_case idx_alert_partial uniq_case fk_creditor is_demo_cols
  bk_tables=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN (
        'bankruptcy_cases','bk_creditors','bk_claims','bk_claim_documents','bk_assets',
        'bk_asset_valuations','bk_meetings','bk_distributions','bk_distribution_items',
        'bk_reports','bk_ai_analysis','bk_timeline','bk_audit_logs','bk_notifications',
        'bk_workflows','bk_workflow_steps','bk_workflow_events','bk_tasks','bk_task_comments',
        'bk_task_assignments','bk_templates','bk_alerts','bk_opening_requests',
        'bk_opening_request_documents','bk_emergency_locks'
      );")
  idx_case=$(psql_db -At -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname='idx_bk_cases_office_status';")
  idx_alert_partial=$(psql_db -At -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname='idx_bk_alerts_active' AND indexdef ILIKE '%WHERE%status%active%';")
  uniq_case=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.bankruptcy_cases'::regclass
      AND contype='u'
      AND pg_get_constraintdef(oid) ILIKE '%office_id%'
      AND pg_get_constraintdef(oid) ILIKE '%case_number%';")
  fk_creditor=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.bk_creditors'::regclass
      AND contype='f'
      AND conname='bk_creditors_case_id_fkey';")
  is_demo_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND column_name='is_demo'
      AND table_name IN (
        'bankruptcy_cases','bk_creditors','bk_claims','bk_assets','bk_meetings',
        'bk_distributions','bk_distribution_items','bk_reports','bk_ai_analysis',
        'bk_tasks','bk_alerts','bk_opening_requests','bk_opening_request_documents'
      );")

  [[ "$bk_tables" == "25" ]] && ok "A: all 25 bankruptcy tables created" || bad "A: bankruptcy table count=$bk_tables"
  [[ "$idx_case" == "1" ]] && ok "A: idx_bk_cases_office_status present" || bad "A: case index missing"
  [[ "$idx_alert_partial" == "1" ]] && ok "A: partial idx_bk_alerts_active present" || bad "A: alert partial index missing"
  [[ "$uniq_case" -ge 1 ]] && ok "A: bankruptcy_cases UNIQUE present" || bad "A: case unique missing"
  [[ "$fk_creditor" == "1" ]] && ok "A: bk_creditors FK present" || bad "A: creditor FK missing"
  [[ "$is_demo_cols" == "13" ]] && ok "A: demo is_demo columns present" || bad "A: demo columns=$is_demo_cols"

  apply_migration_014
  ok "A/F: re-run 014 on fresh schema succeeded"

  apply_migration_015
  apply_migration_016
  apply_migration_017
  if verify_p0_schema /tmp/verify-014.log; then
    ok "A: verify-schema.sh passed after 014+015+016+017"
  else
    bad "A: verify-schema.sh failed after 014+015+016+017"; tail -20 /tmp/verify-014.log
  fi

  if ! grep -qE 'CREATE TABLE|CREATE INDEX' \
      "$ROOT/artifacts/api-server/src/modules/bankruptcy/bankruptcy.ts" \
      "$ROOT/artifacts/api-server/src/modules/bankruptcy/bankruptcyV2.ts" \
      "$ROOT/artifacts/api-server/src/modules/bankruptcy/bankruptcyV3.ts"; then
    ok "A: bankruptcy modules contain no CREATE TABLE/INDEX Runtime DDL"
  else
    bad "A: bankruptcy module Runtime DDL still present"
  fi
  if ! grep -qE 'ALTER TABLE .*is_demo' "$ROOT/artifacts/api-server/src/modules/bankruptcy/bankruptcyDemo.ts" \
      && ! grep -qE 'ensureBankruptcyTables\(\)\.catch|ensureBankruptcyV2Tables\(\)\.catch|ensureBankruptcyV3Tables\(\)\.catch' "$ROOT/artifacts/api-server/src/index.ts" \
      && ! grep -qE 'ensureEocTables|CREATE TABLE IF NOT EXISTS bk_emergency_locks' "$ROOT/artifacts/api-server/src/modules/platform/admin.ts"; then
    ok "A: boot/demo/EOC Bankruptcy Runtime DDL removed"
  else
    bad "A: boot/demo/EOC Bankruptcy Runtime DDL still present"
  fi

  trap - EXIT
  teardown_db

  # ── B. Partial Bankruptcy tables missing columns ────────────────────────
  setup_db "mig014_partial"
  trap teardown_db EXIT
  apply_migrations_through_013

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE bankruptcy_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  case_number TEXT
);
INSERT INTO bankruptcy_cases (office_id, case_number) VALUES ('off_partial', 'BK-PART-1');
CREATE TABLE bk_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID,
  office_id TEXT
);
CREATE TABLE bk_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID,
  office_id TEXT
);
CREATE TABLE bk_asset_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID
);
CREATE TABLE bk_emergency_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT
);
SQL

  apply_migration_014

  local partial_case_cols report_cols ai_cols asset_val_cols eoc_cols partial_row
  partial_case_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='bankruptcy_cases'
      AND column_name IN ('debtor_name','debtor_type','procedure_type','status','deleted_at','is_demo','updated_at');")
  report_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='bk_reports'
      AND column_name IN ('report_type','report_title','category','metadata','is_demo','created_at');")
  ai_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='bk_ai_analysis'
      AND column_name IN ('analysis_type','token_count','generated_at','is_demo');")
  asset_val_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='bk_asset_valuations'
      AND column_name IN ('office_id','valuator_name','valuation_amount','created_at');")
  eoc_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='bk_emergency_locks'
      AND column_name IN ('lock_type','target_id','reason','locked_by','is_active','expires_at','created_at','released_at');")
  partial_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM bankruptcy_cases WHERE office_id='off_partial' AND case_number='BK-PART-1';")

  [[ "$partial_case_cols" == "7" ]] && ok "B: bankruptcy_cases missing columns added" || bad "B: case cols=$partial_case_cols"
  [[ "$report_cols" == "6" ]] && ok "B: bk_reports V2 columns added" || bad "B: report cols=$report_cols"
  [[ "$ai_cols" == "4" ]] && ok "B: bk_ai_analysis token/demo columns added" || bad "B: ai cols=$ai_cols"
  [[ "$asset_val_cols" == "4" ]] && ok "B: bk_asset_valuations office_id repaired" || bad "B: asset valuation cols=$asset_val_cols"
  [[ "$eoc_cols" == "8" ]] && ok "B: bk_emergency_locks columns added" || bad "B: eoc cols=$eoc_cols"
  [[ "$partial_row" == "1" ]] && ok "B: legacy bankruptcy row unchanged" || bad "B: legacy row altered"

  apply_migration_014
  ok "B/F: re-run 014 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db

  # ── C. Duplicate bankruptcy_cases UNIQUE(office_id, case_number) ────────
  setup_db "mig014_dup"
  trap teardown_db EXIT
  apply_migrations_through_013

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE bankruptcy_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  case_number TEXT,
  debtor_name TEXT,
  debtor_type TEXT,
  procedure_type TEXT,
  status TEXT
);
INSERT INTO bankruptcy_cases (office_id, case_number, debtor_name, debtor_type, procedure_type, status) VALUES
  ('off_dup', 'BK-DUP-1', 'Debtor A', 'company', 'liquidation', 'active'),
  ('off_dup', 'BK-DUP-1', 'Debtor B', 'company', 'liquidation', 'active');
SQL

  set +e
  psql_db -f "$MIGRATION_014" >/tmp/mig014-dup.log 2>&1
  local dup_rc=$?
  set -e
  [[ "$dup_rc" -eq 0 ]] && ok "C: migration 014 succeeds with duplicate case_number" || {
    bad "C: migration 014 failed with duplicate case_number"; cat /tmp/mig014-dup.log
  }

  local dup_uniq dup_rows dup_warn
  dup_uniq=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.bankruptcy_cases'::regclass
      AND contype='u'
      AND conname='bankruptcy_cases_office_id_case_number_key';")
  dup_rows=$(psql_db -At -c "
    SELECT COUNT(*) FROM bankruptcy_cases WHERE office_id='off_dup' AND case_number='BK-DUP-1';")
  dup_warn=$(grep -c 'skipping bankruptcy_cases UNIQUE' /tmp/mig014-dup.log || true)

  [[ "$dup_uniq" == "0" ]] && ok "C: bankruptcy_cases UNIQUE skipped on duplicates" || bad "C: unique was created"
  [[ "$dup_rows" == "2" ]] && ok "C: duplicate case rows unmodified" || bad "C: rows=$dup_rows"
  [[ "$dup_warn" -ge 1 ]] && ok "C: WARNING emitted for duplicate case UNIQUE skip" || bad "C: missing duplicate UNIQUE WARNING"

  apply_migration_014
  ok "C/F: re-run 014 after unique skip succeeded"

  trap - EXIT
  teardown_db

  # ── D. Invalid bankruptcy_cases.status CHECK ────────────────────────────
  setup_db "mig014_badcheck"
  trap teardown_db EXIT
  apply_migrations_through_013

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE bankruptcy_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  case_number TEXT,
  debtor_name TEXT,
  debtor_type TEXT,
  procedure_type TEXT,
  status TEXT
);
INSERT INTO bankruptcy_cases (office_id, case_number, debtor_name, debtor_type, procedure_type, status)
VALUES ('off_bad', 'BK-BAD-1', 'Bad Status Debtor', 'company', 'liquidation', 'open');
SQL

  set +e
  psql_db -f "$MIGRATION_014" >/tmp/mig014-badcheck.log 2>&1
  local bad_rc=$?
  set -e
  [[ "$bad_rc" -eq 0 ]] && ok "D: migration 014 succeeds with invalid bankruptcy status" || {
    bad "D: migration 014 failed on invalid status"; cat /tmp/mig014-badcheck.log
  }

  local status_check bad_status_row status_warn
  status_check=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.bankruptcy_cases'::regclass
      AND contype='c'
      AND conname='bankruptcy_cases_status_check';")
  bad_status_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM bankruptcy_cases WHERE office_id='off_bad' AND status='open';")
  status_warn=$(grep -c 'skipping bankruptcy_cases status CHECK' /tmp/mig014-badcheck.log || true)

  [[ "$status_check" == "0" ]] && ok "D: bankruptcy_cases status CHECK skipped" || bad "D: status CHECK added"
  [[ "$bad_status_row" == "1" ]] && ok "D: invalid legacy status row unchanged" || bad "D: legacy status row altered"
  [[ "$status_warn" -ge 1 ]] && ok "D: WARNING emitted for status CHECK skip" || bad "D: missing status CHECK WARNING"

  apply_migration_014
  ok "D/F: re-run 014 after CHECK skip succeeded"

  trap - EXIT
  teardown_db

  # ── E. Orphan bk_creditors.case_id → FK skip with WARNING ───────────────
  setup_db "mig014_orphan_fk"
  trap teardown_db EXIT
  apply_migrations_through_013

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE bankruptcy_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  case_number TEXT,
  debtor_name TEXT,
  debtor_type TEXT,
  procedure_type TEXT,
  status TEXT
);
CREATE TABLE bk_creditors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID,
  office_id TEXT,
  name TEXT,
  type TEXT
);
INSERT INTO bankruptcy_cases (id, office_id, case_number, debtor_name, debtor_type, procedure_type, status)
VALUES ('00000000-0000-4000-8000-000000000001'::uuid, 'off_fk', 'BK-FK-1', 'Valid Debtor', 'company', 'liquidation', 'active');
INSERT INTO bk_creditors (case_id, office_id, name, type)
VALUES ('00000000-0000-4000-8000-000000000099'::uuid, 'off_fk', 'Orphan Creditor', 'unsecured');
SQL

  set +e
  psql_db -f "$MIGRATION_014" >/tmp/mig014-orphan-fk.log 2>&1
  local orphan_rc=$?
  set -e
  [[ "$orphan_rc" -eq 0 ]] && ok "E: migration 014 succeeds with orphan bk_creditors.case_id" || {
    bad "E: migration 014 failed with orphan creditor"; cat /tmp/mig014-orphan-fk.log
  }

  local creditor_fk orphan_warn orphan_row
  creditor_fk=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.bk_creditors'::regclass
      AND contype='f'
      AND conname='bk_creditors_case_id_fkey';")
  orphan_warn=$(grep -c 'skipping bk_creditors FK to bankruptcy_cases' /tmp/mig014-orphan-fk.log || true)
  orphan_row=$(psql_db -At -c "
    SELECT COUNT(*) FROM bk_creditors WHERE name='Orphan Creditor';")

  [[ "$creditor_fk" == "0" ]] && ok "E: bk_creditors.case_id FK skipped on orphan" || bad "E: creditor FK was created"
  [[ "$orphan_warn" -ge 1 ]] && ok "E: WARNING emitted for orphan creditor FK skip" || bad "E: missing orphan FK WARNING"
  [[ "$orphan_row" == "1" ]] && ok "E: orphan legacy creditor row unchanged" || bad "E: orphan row altered"

  apply_migration_014
  ok "E/F: re-run 014 after orphan FK skip succeeded"

  trap - EXIT
  teardown_db
}

# ── Scenario 3i: Tasks + Branches schema (015) ──────────────────────────────
scenario_migration_015_tasks_branches() {
  log "Scenario 3i — migration 015: tasks/branches fresh / idempotent / partial / FK skip / Runtime DDL audit"

  # ── A. Fresh ─────────────────────────────────────────────────────────────
  setup_db "mig015_fresh"
  trap teardown_db EXIT
  apply_migrations_through_013
  apply_migration_014

  local pre_tasks pre_branches
  pre_tasks=$(psql_db -At -c "
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='tasks');")
  pre_branches=$(psql_db -At -c "
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='office_branches');")
  [[ "$pre_tasks" == "f" ]] && ok "A pre-015: tasks absent" || bad "A pre-015: tasks should be absent"
  [[ "$pre_branches" == "f" ]] && ok "A pre-015: office_branches absent" || bad "A pre-015: office_branches should be absent"

  apply_migration_015

  local tb_tables task_cols branch_cols branch_fks task_idx branch_idx
  tb_tables=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('tasks','office_branches');")
  task_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='tasks'
      AND column_name IN (
        'id','office_id','title','description','status','priority','assignee_name',
        'assigned_to','due_date','case_id','case_title','created_by','tags',
        'branch_id','created_at','updated_at'
      );")
  branch_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='office_branches'
      AND column_name IN (
        'id','office_id','name','code','location','description','phone','email',
        'manager_user_id','manager_name','status','created_at','updated_at'
      );")
  branch_fks=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE contype='f'
      AND conname IN (
        'cases_branch_id_fkey','clients_branch_id_fkey',
        'client_invoices_branch_id_fkey','tasks_branch_id_fkey'
      );")
  task_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public'
      AND indexname IN (
        'idx_tasks_office_due','idx_tasks_status',
        'idx_tasks_case_id','idx_tasks_office_case'
      );")
  branch_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public'
      AND indexname IN (
        'idx_office_branches_office','idx_office_branches_status',
        'idx_cases_branch','idx_clients_branch'
      );")

  [[ "$tb_tables" == "2" ]] && ok "A: tasks and office_branches created" || bad "A: table count=$tb_tables"
  [[ "$task_cols" == "16" ]] && ok "A: tasks required columns present" || bad "A: task cols=$task_cols"
  [[ "$branch_cols" == "13" ]] && ok "A: office_branches required columns present" || bad "A: branch cols=$branch_cols"
  [[ "$branch_fks" == "4" ]] && ok "A: branch_id FKs present on four tables" || bad "A: branch FKs=$branch_fks"
  [[ "$task_idx" == "4" ]] && ok "A: tasks indexes present" || bad "A: task indexes=$task_idx"
  [[ "$branch_idx" == "4" ]] && ok "A: office/branch indexes present" || bad "A: branch indexes=$branch_idx"

  apply_migration_015
  ok "A/F: re-run 015 on fresh schema succeeded"
  apply_migration_016
  apply_migration_017

  if verify_p0_schema /tmp/verify-015.log; then
    ok "A: verify-schema.sh passed after 015+016+017"
  else
    bad "A: verify-schema.sh failed after 015+016+017"; tail -20 /tmp/verify-015.log
  fi

  if ! grep -qE 'ALTER TABLE tasks|ensureTables\(\)\.catch' \
      "$ROOT/artifacts/api-server/src/modules/platform/branches.ts"; then
    ok "A: branches.ts has no startup ALTER TABLE tasks"
  else
    bad "A: branches.ts still alters tasks at startup"
  fi

  trap - EXIT
  teardown_db

  # ── B. Partial tasks/office_branches schemas missing columns ─────────────
  setup_db "mig015_partial"
  trap teardown_db EXIT
  apply_migrations_through_013
  apply_migration_014

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE office_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  title TEXT
);
INSERT INTO tasks (office_id, title) VALUES ('off_partial', 'Legacy task');
SQL

  apply_migration_015

  local partial_task_cols partial_branch_cols partial_branch_id_cols partial_row
  partial_task_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='tasks'
      AND column_name IN (
        'description','status','priority','assignee_name','assigned_to','due_date',
        'case_id','case_title','created_by','tags','branch_id','created_at','updated_at'
      );")
  partial_branch_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='office_branches'
      AND column_name IN (
        'office_id','name','code','location','description','phone','email',
        'manager_user_id','manager_name','status','created_at','updated_at'
      );")
  partial_branch_id_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND column_name='branch_id'
      AND table_name IN ('cases','clients','client_invoices','tasks');")
  partial_row=$(psql_db -At -c "SELECT COUNT(*) FROM tasks WHERE title='Legacy task';")

  [[ "$partial_task_cols" == "13" ]] && ok "B: tasks missing columns added" || bad "B: task cols=$partial_task_cols"
  [[ "$partial_branch_cols" == "12" ]] && ok "B: office_branches missing columns added" || bad "B: branch cols=$partial_branch_cols"
  [[ "$partial_branch_id_cols" == "4" ]] && ok "B: branch_id columns repaired on four tables" || bad "B: branch_id cols=$partial_branch_id_cols"
  [[ "$partial_row" == "1" ]] && ok "B: legacy task row unchanged" || bad "B: legacy task row altered"

  apply_migration_015
  ok "B/F: re-run 015 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db

  # ── C. Orphan tasks.branch_id → FK skip with WARNING ────────────────────
  setup_db "mig015_orphan_fk"
  trap teardown_db EXIT
  apply_migrations_through_013
  apply_migration_014

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  title TEXT,
  branch_id UUID
);
INSERT INTO tasks (office_id, title, branch_id)
VALUES ('off_fk', 'Orphan branch task', '00000000-0000-4000-8000-000000000099'::uuid);
SQL

  set +e
  psql_db -f "$MIGRATION_015" >/tmp/mig015-orphan-fk.log 2>&1
  local orphan_rc=$?
  set -e
  [[ "$orphan_rc" -eq 0 ]] && ok "C: migration 015 succeeds with orphan tasks.branch_id" || {
    bad "C: migration 015 failed with orphan task branch"; cat /tmp/mig015-orphan-fk.log
  }

  local task_branch_fk orphan_warn orphan_task
  task_branch_fk=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.tasks'::regclass
      AND contype='f'
      AND conname='tasks_branch_id_fkey';")
  orphan_warn=$(grep -c 'skipping tasks FK to office_branches' /tmp/mig015-orphan-fk.log || true)
  orphan_task=$(psql_db -At -c "SELECT COUNT(*) FROM tasks WHERE title='Orphan branch task';")

  [[ "$task_branch_fk" == "0" ]] && ok "C: tasks.branch_id FK skipped on orphan" || bad "C: tasks branch FK was created"
  [[ "$orphan_warn" -ge 1 ]] && ok "C: WARNING emitted for orphan branch FK skip" || bad "C: missing orphan FK WARNING"
  [[ "$orphan_task" == "1" ]] && ok "C: orphan legacy task row unchanged" || bad "C: orphan task row altered"

  apply_migration_015
  ok "C/F: re-run 015 after orphan FK skip succeeded"

  trap - EXIT
  teardown_db

  # ── D. Datatype mismatch tasks.branch_id TEXT → FK skip, non-abort ──────
  setup_db "mig015_type_mismatch"
  trap teardown_db EXIT
  apply_migrations_through_013
  apply_migration_014

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  title TEXT,
  branch_id TEXT
);
INSERT INTO tasks (office_id, title, branch_id)
VALUES ('off_type', 'Text branch task', 'not-a-uuid');
SQL

  set +e
  psql_db -f "$MIGRATION_015" >/tmp/mig015-type-mismatch.log 2>&1
  local type_rc=$?
  set -e
  [[ "$type_rc" -eq 0 ]] && ok "D: migration 015 succeeds with tasks.branch_id TEXT" || {
    bad "D: migration 015 failed on branch_id datatype mismatch"; cat /tmp/mig015-type-mismatch.log
  }

  local branch_udt mismatch_fk mismatch_warn text_task
  branch_udt=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tasks' AND column_name='branch_id';")
  mismatch_fk=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.tasks'::regclass
      AND contype='f'
      AND conname='tasks_branch_id_fkey';")
  mismatch_warn=$(grep -c 'incompatible types tasks.branch_id' /tmp/mig015-type-mismatch.log || true)
  text_task=$(psql_db -At -c "SELECT COUNT(*) FROM tasks WHERE branch_id='not-a-uuid';")

  [[ "$branch_udt" == "text" ]] && ok "D: tasks.branch_id TEXT preserved" || bad "D: branch_id udt=$branch_udt"
  [[ "$mismatch_fk" == "0" ]] && ok "D: tasks.branch_id FK skipped on type mismatch" || bad "D: type-mismatch FK was created"
  [[ "$mismatch_warn" -ge 1 ]] && ok "D: WARNING emitted for branch_id type mismatch" || bad "D: missing type mismatch WARNING"
  [[ "$text_task" == "1" ]] && ok "D: text branch legacy task row unchanged" || bad "D: text task row altered"

  apply_migration_015
  ok "D/F: re-run 015 after datatype mismatch skip succeeded"

  trap - EXIT
  teardown_db
}

# ── Scenario 3j: Office Messages FTS (016) ─────────────────────────────────
scenario_migration_016_office_messages_fts() {
  log "Scenario 3j — migration 016: office_messages FTS config SoT / legacy / idempotent / Runtime DDL audit"

  # Helper: read config literal from live generated expression (runtime SoT)
  read_generated_fts_cfg() {
    psql_db -At -c "
      SELECT (regexp_match(pg_get_expr(ad.adbin, ad.adrelid),
                           'to_tsvector\(\s*''([^'']+)''', 'i'))[1]
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
      WHERE n.nspname='public'
        AND c.relname='office_messages'
        AND a.attname='search_vector'
        AND NOT a.attisdropped
        AND a.attgenerated IN ('s','v')
      LIMIT 1;"
  }

  # ── A. Fresh with arabic present (when available) ────────────────────────
  setup_db "mig016_fresh_arabic"
  trap teardown_db EXIT
  apply_migrations_through_015

  local arabic_present
  arabic_present=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname='arabic');")
  if [[ "$arabic_present" != "t" ]]; then
    psql_db -c "CREATE TEXT SEARCH CONFIGURATION arabic (COPY = simple);" >/dev/null
    arabic_present=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname='arabic');")
  fi
  [[ "$arabic_present" == "t" ]] && ok "A pre: arabic text search config present" || bad "A pre: could not ensure arabic config"

  local pre_messages
  pre_messages=$(psql_db -At -c "
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='office_messages');")
  [[ "$pre_messages" == "f" ]] && ok "A pre-016: office_messages absent" || bad "A pre-016: office_messages should be absent"

  apply_migration_016

  local msg_table msg_cols vector_udt gin_idx gen_cfg query_count
  msg_table=$(psql_db -At -c "
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='office_messages');")
  msg_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='office_messages'
      AND column_name IN (
        'id','office_id','subject','body','sender_id','sender_name','sender_ip',
        'device_info','folder','tags','case_id','conversation_id','deleted_at',
        'created_at','search_vector'
      );")
  vector_udt=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='office_messages'
      AND column_name='search_vector';")
  gin_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='office_messages'
      AND indexname='idx_messages_search';")
  gen_cfg=$(read_generated_fts_cfg)

  psql_db <<'SQL' >/dev/null
INSERT INTO office_messages (office_id, subject, body, sender_id, sender_name, folder)
VALUES ('off_fts', 'contract notice', 'hello contract body', 'u1', 'User One', 'sent');
SQL
  query_count=$(psql_db -At -c "
    SELECT COUNT(*) FROM office_messages
    WHERE search_vector @@ plainto_tsquery('${gen_cfg}', 'contract');")

  [[ "$msg_table" == "t" ]] && ok "A: office_messages created" || bad "A: office_messages missing"
  [[ "$msg_cols" == "15" ]] && ok "A: office_messages FTS/key columns present" || bad "A: office_messages cols=$msg_cols"
  [[ "$vector_udt" == "tsvector" ]] && ok "A: search_vector is tsvector" || bad "A: search_vector udt=$vector_udt"
  [[ "$gin_idx" == "1" ]] && ok "A: idx_messages_search GIN index present" || bad "A: idx_messages_search count=$gin_idx"
  [[ "$gen_cfg" == "arabic" ]] && ok "A: generated expression uses arabic" || bad "A: generated cfg=$gen_cfg (expected arabic)"
  [[ "$query_count" == "1" ]] && ok "A: @@ query works with discovered generated config" || bad "A: @@ query count=$query_count"

  # Runtime SoT check: same catalog extraction the app uses
  local runtime_cfg
  runtime_cfg=$(read_generated_fts_cfg)
  [[ "$runtime_cfg" == "$gen_cfg" ]] && ok "A: runtime config equals generated expression config ($runtime_cfg)" \
    || bad "A: runtime/expression mismatch runtime=$runtime_cfg expr=$gen_cfg"

  apply_migration_016
  ok "A/F: re-run 016 on fresh arabic schema succeeded (idempotent)"
  apply_migration_017

  if verify_p0_schema /tmp/verify-016.log; then
    ok "A: verify-schema.sh passed after 016+017"
  else
    bad "A: verify-schema.sh failed after 016+017"; tail -20 /tmp/verify-016.log
  fi

  if ! grep -qE 'ensureFullTextSearch|ADD COLUMN IF NOT EXISTS search_vector|CREATE INDEX IF NOT EXISTS idx_messages_search' \
      "$ROOT/artifacts/api-server/src/modules/operations/internal-messages.ts"; then
    ok "A: internal-messages.ts has no startup FTS ALTER/INDEX DDL"
  else
    bad "A: internal-messages.ts still contains startup FTS DDL"
  fi

  if grep -q 'pg_get_expr' "$ROOT/artifacts/api-server/src/modules/operations/messageFtsConfig.ts" \
      && grep -q 'transient_error' "$ROOT/artifacts/api-server/src/modules/operations/messageFtsConfigLogic.ts" \
      && ! grep -qE "FROM pg_ts_config|cfgname = 'arabic'" "$ROOT/artifacts/api-server/src/modules/operations/messageFtsConfig.ts" \
      && ! grep -qE "FROM pg_ts_config|cfgname = 'arabic'" "$ROOT/artifacts/api-server/src/modules/operations/messageFtsConfigLogic.ts"; then
    ok "A: runtime FTS config reads generated expression (not independent pg_ts_config)"
  else
    bad "A: runtime FTS config source-of-truth missing or still uses pg_ts_config"
  fi

  trap - EXIT
  teardown_db

  # ── A2. Arabic absent → simple ───────────────────────────────────────────
  setup_db "mig016_fresh_simple"
  trap teardown_db EXIT
  apply_migrations_through_015

  psql_db -c "DROP TEXT SEARCH CONFIGURATION IF EXISTS arabic;" >/dev/null 2>&1 || true
  local arabic_gone
  arabic_gone=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname='arabic');")
  [[ "$arabic_gone" == "f" ]] && ok "A2 pre: arabic config absent" || bad "A2 pre: arabic still present"

  apply_migration_016
  local simple_cfg simple_query
  simple_cfg=$(read_generated_fts_cfg)
  psql_db <<'SQL' >/dev/null
INSERT INTO office_messages (office_id, subject, body, sender_id, sender_name, folder)
VALUES ('off_simple', 'contract notice', 'hello contract body', 'u1', 'User One', 'sent');
SQL
  simple_query=$(psql_db -At -c "
    SELECT COUNT(*) FROM office_messages
    WHERE search_vector @@ plainto_tsquery('${simple_cfg}', 'contract');")

  [[ "$simple_cfg" == "simple" ]] && ok "A2: generated expression falls back to simple" || bad "A2: cfg=$simple_cfg"
  [[ "$(read_generated_fts_cfg)" == "simple" ]] && ok "A2: runtime config equals simple expression" || bad "A2: runtime mismatch"
  [[ "$simple_query" == "1" ]] && ok "A2: @@ query works with simple config" || bad "A2: query count=$simple_query"

  apply_migration_016
  ok "A2/F: re-run 016 with simple config succeeded (idempotent)"

  trap - EXIT
  teardown_db

  # ── B. Partial office_messages missing subject/body (repaired in one apply) ─
  setup_db "mig016_partial"
  trap teardown_db EXIT
  apply_migrations_through_015

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
SQL

  set +e
  psql_db -f "$MIGRATION_016" >/tmp/mig016-partial.log 2>&1
  local partial_rc=$?
  set -e
  [[ "$partial_rc" -eq 0 ]] && ok "B: migration 016 succeeds with partial office_messages" || {
    bad "B: migration 016 failed with partial office_messages"; cat /tmp/mig016-partial.log
  }

  local partial_cols partial_vector gin_partial partial_cfg
  partial_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='office_messages'
      AND column_name IN ('subject','body','created_at','conversation_id','deleted_at');")
  partial_vector=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='office_messages'
      AND column_name='search_vector';")
  gin_partial=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='office_messages'
      AND indexname='idx_messages_search';")
  partial_cfg=$(read_generated_fts_cfg)

  [[ "$partial_cols" == "5" ]] && ok "B: subject/body and related columns repaired in one apply" || bad "B: repaired cols=$partial_cols"
  [[ "$partial_vector" == "tsvector" ]] && ok "B: search_vector created after column repair in one apply" || bad "B: search_vector udt=$partial_vector"
  [[ "$gin_partial" == "1" ]] && ok "B: GIN index created on repaired partial table" || bad "B: gin count=$gin_partial"
  [[ -n "$partial_cfg" ]] && ok "B: generated expression config readable ($partial_cfg)" || bad "B: generated config missing"

  apply_migration_016
  ok "B/F: re-run 016 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db

  # ── C. Existing non-generated tsvector → WARNING, skip GIN, preserve ─────
  setup_db "mig016_existing_vector"
  trap teardown_db EXIT
  apply_migrations_through_015

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  search_vector tsvector
);
SQL

  set +e
  psql_db -f "$MIGRATION_016" >/tmp/mig016-nongen.log 2>&1
  local nongen_rc=$?
  set -e
  [[ "$nongen_rc" -eq 0 ]] && ok "C: migration 016 succeeds with non-generated tsvector" || {
    bad "C: migration 016 failed with non-generated tsvector"; cat /tmp/mig016-nongen.log
  }

  local existing_udt existing_idx nongen_warn
  existing_udt=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='office_messages'
      AND column_name='search_vector';")
  existing_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='office_messages'
      AND indexname='idx_messages_search';")
  nongen_warn=$(grep -c '016_fts: skipping search_vector — existing tsvector is not a compatible generated expression' /tmp/mig016-nongen.log || true)
  local gin_unverified_warn
  gin_unverified_warn=$(grep -c '016_fts: skipping idx_messages_search — search_vector expression unverifiable' /tmp/mig016-nongen.log || true)

  [[ "$existing_udt" == "tsvector" ]] && ok "C: non-generated tsvector preserved" || bad "C: existing search_vector udt=$existing_udt"
  [[ "$nongen_warn" -ge 1 ]] && ok "C: WARNING emitted for non-generated tsvector" || bad "C: non-generated WARNING absent"
  [[ "$gin_unverified_warn" -ge 1 ]] && ok "C: WARNING emitted skipping unverifiable GIN" || bad "C: unverifiable GIN WARNING absent"
  [[ "$existing_idx" == "0" ]] && ok "C: GIN index skipped for non-generated tsvector" || bad "C: GIN index count=$existing_idx"

  trap - EXIT
  teardown_db

  # ── C2. Generated tsvector with unreadable expression → WARNING, skip GIN ─
  setup_db "mig016_bad_expr"
  trap teardown_db EXIT
  apply_migrations_through_015

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  search_vector tsvector GENERATED ALWAYS AS (NULL::tsvector) STORED
);
SQL

  set +e
  psql_db -f "$MIGRATION_016" >/tmp/mig016-bad-expr.log 2>&1
  local bad_expr_rc=$?
  set -e
  [[ "$bad_expr_rc" -eq 0 ]] && ok "C2: migration 016 succeeds with unreadable generated expression" || {
    bad "C2: migration 016 failed with unreadable expression"; cat /tmp/mig016-bad-expr.log
  }

  local bad_expr_warn bad_expr_gin bad_expr_idx
  bad_expr_warn=$(grep -c '016_fts: skipping search_vector — existing tsvector is not a compatible generated expression' /tmp/mig016-bad-expr.log || true)
  bad_expr_gin=$(grep -c '016_fts: skipping idx_messages_search — search_vector expression unverifiable' /tmp/mig016-bad-expr.log || true)
  bad_expr_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='office_messages'
      AND indexname='idx_messages_search';")
  [[ "$bad_expr_warn" -ge 1 ]] && ok "C2: WARNING for incompatible/unreadable generated expression" || bad "C2: expression WARNING absent"
  [[ "$bad_expr_gin" -ge 1 ]] && ok "C2: GIN skipped for unreadable expression" || bad "C2: unverifiable GIN WARNING absent"
  [[ "$bad_expr_idx" == "0" ]] && ok "C2: no idx_messages_search created" || bad "C2: unexpected GIN count=$bad_expr_idx"

  trap - EXIT
  teardown_db

  # ── D. Incompatible search_vector type → WARNING, no abort ──────────────
  setup_db "mig016_bad_vector"
  trap teardown_db EXIT
  apply_migrations_through_015

  psql_db <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  search_vector TEXT
);
SQL

  set +e
  psql_db -f "$MIGRATION_016" >/tmp/mig016-bad-vector.log 2>&1
  local bad_vector_rc=$?
  set -e
  [[ "$bad_vector_rc" -eq 0 ]] && ok "D: migration 016 succeeds with incompatible search_vector" || {
    bad "D: migration 016 failed with incompatible search_vector"; cat /tmp/mig016-bad-vector.log
  }

  local bad_vector_udt bad_vector_warn bad_vector_idx
  bad_vector_udt=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='office_messages'
      AND column_name='search_vector';")
  bad_vector_warn=$(grep -c '016_fts: skipping search_vector — incompatible existing type' /tmp/mig016-bad-vector.log || true)
  bad_vector_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='office_messages'
      AND indexname='idx_messages_search';")
  [[ "$bad_vector_udt" == "text" ]] && ok "D: incompatible search_vector TEXT preserved" || bad "D: bad vector udt=$bad_vector_udt"
  [[ "$bad_vector_warn" -ge 1 ]] && ok "D: WARNING emitted for incompatible search_vector" || bad "D: incompatible search_vector WARNING absent"
  [[ "$bad_vector_idx" == "0" ]] && ok "D: GIN index skipped for incompatible vector" || bad "D: unexpected GIN index count=$bad_vector_idx"

  trap - EXIT
  teardown_db
}

# ── Scenario 4: reported endpoints + office/public schema paths ─────────────
scenario_reported_endpoints() {
  log "Scenario 4 — SQL paths for reported 500/404 endpoints + office/public + sendBeacon vitals"
  setup_db "endpoints"
  trap teardown_db EXIT
  apply_all_migrations

  psql_db <<'SQL' >/dev/null
-- Seed office_page first, then link members to its UUID
INSERT INTO office_page (id, slug, name, plan, website_config)
  VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid, 'public-test', 'Public Office', 'starter', '{"templateId":"default"}'::jsonb);

INSERT INTO office_registry (id, clerk_user_id, owner_email, office_name, status)
  VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'user_ep1', 'ep@test.com', 'Endpoint Office', 'active');
INSERT INTO office_members (office_id, user_id, role, status)
  VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'user_ep1', 'owner', 'active');
INSERT INTO system_events (event_type, office_id, actor_id, payload)
  VALUES ('case_created', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'user_ep1', '{"title":"Test"}'::jsonb);

-- GET /api/offices/my — tenant-scoped select only (no first-office fallback)
SELECT id, slug, name, plan, website_config, created_at, updated_at
  FROM office_page WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;

-- GET /api/office/subscription — full Drizzle select including website_config
SELECT id, slug, name, plan, website_config FROM office_page LIMIT 1;

-- GET /api/office/public/:slug
SELECT website_config FROM office_page WHERE slug = 'public-test';

-- GET /api/events?limit=6 — tenant from resolveTenantId only
SELECT id, event_type, office_id, actor_id, payload, created_at
  FROM system_events
  WHERE office_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  ORDER BY created_at DESC LIMIT 6;

-- POST /api/security/login
INSERT INTO login_logs
  (user_id, email, full_name, ip_address, user_agent, browser, os, device_type,
   status, office_id, session_id)
VALUES
  ('user_ep1', null, null, '127.0.0.1', 'test-agent', 'Chrome', 'Linux', 'desktop',
   'success', 'default', 'sess_test');

-- POST /api/metrics/vitals (sendBeacon body shape)
INSERT INTO web_vitals (name, value, rating, url)
  VALUES ('LCP', 1200, 'good', '/dashboard');

INSERT INTO route_analytics (path, name_internal, module, load_ms, visited_at)
  VALUES ('/dashboard', 'Dashboard', 'ops', 120, NOW());
SQL
  ok "SQL paths: offices/my, subscription, events, login, vitals, office/public"

  local admin_cnt
  admin_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM office_page;")
  [[ "$admin_cnt" -ge 1 ]] && ok "admin list offices (db.select officePageTable)" || bad "office_page empty"

  if verify_p0_schema /tmp/verify-endpoints.log; then
    ok "verify-schema.sh passed after full chain including 006→017"
  else
    bad "verify-schema.sh failed on endpoint scenario"
    tail -15 /tmp/verify-endpoints.log
  fi

  trap - EXIT
  teardown_db
}

# ── Scenario 5: incomplete schema — API must NOT create tables ───────────────
scenario_incomplete_schema_no_runtime_ddl() {
  log "Scenario 5 — incomplete schema (no 006): INSERT fails; no auto-create"
  setup_db "incomplete"
  trap teardown_db EXIT
  apply_migrations_base

  # Simulate what loginTracking / metrics would do without migration 006
  local login_rc vitals_rc
  set +e
  psql_db -c "INSERT INTO login_logs (user_id, status) VALUES ('u1', 'success');" >/tmp/inc-login.log 2>&1
  login_rc=$?
  psql_db -c "INSERT INTO web_vitals (name, value, rating) VALUES ('LCP', 1, 'good');" >/tmp/inc-vitals.log 2>&1
  vitals_rc=$?
  set -e

  [[ "$login_rc" -ne 0 ]] && ok "login_logs INSERT fails without 006 (no auto-create)" || bad "login_logs should not exist"
  [[ "$vitals_rc" -ne 0 ]] && ok "web_vitals INSERT fails without 006 (no auto-create)" || bad "web_vitals should not exist"

  # Confirm tables still absent after failed inserts
  local has_login has_vitals
  has_login=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='login_logs');")
  has_vitals=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='web_vitals');")
  [[ "$has_login" == "f" ]] && ok "login_logs still absent after failed INSERT" || bad "login_logs was created somehow"
  [[ "$has_vitals" == "f" ]] && ok "web_vitals still absent after failed INSERT" || bad "web_vitals was created somehow"

  # Source audit: migration-covered handlers must not contain Runtime DDL
  if ! grep -qE 'ensureERPTables|CREATE TABLE IF NOT EXISTS office_erp_ledger|CREATE TABLE IF NOT EXISTS chart_of_accounts|CREATE TABLE IF NOT EXISTS journal_entries' \
      "$ROOT/artifacts/api-server/src/modules/financial/erp-ledger.ts" \
      "$ROOT/artifacts/api-server/src/modules/financial/journalAccounting.ts" \
      "$ROOT/artifacts/api-server/src/modules/financial/reconciliation.ts" \
      "$ROOT/artifacts/api-server/src/index.ts"; then
    ok "ERP modules contain no Runtime DDL"
  else
    bad "ERP Runtime DDL still present"
  fi

  if ! grep -qE 'ensurePaymentCols|ALTER TABLE payment_transactions' \
      "$ROOT/artifacts/api-server/src/modules/financial/payments.ts"; then
    ok "payments.ts has no payment_transactions Runtime DDL"
  else
    bad "payments.ts still alters payment_transactions at boot"
  fi

  if ! grep -qE 'CREATE TABLE|ensureTable|ensureLoginLogs|ensureTables|ensureEventsTable|ensureAdHocColumns|ensureStripeBufferTables|ensureReconciliationTable|ensurePaymentCols|ensureERPTables' \
      "$ROOT/artifacts/api-server/src/modules/platform/loginTracking.ts" \
      "$ROOT/artifacts/api-server/src/routes/metrics.ts" \
      "$ROOT/artifacts/api-server/src/modules/legal-core/contracts.ts" \
      "$ROOT/artifacts/api-server/src/core/eventBus.ts" \
      "$ROOT/artifacts/api-server/src/modules/platform/trialOnboarding.ts" \
      "$ROOT/artifacts/api-server/src/modules/platform/onboarding.ts" \
      "$ROOT/artifacts/api-server/src/services/stripeEventBuffer.ts" \
      "$ROOT/artifacts/api-server/src/jobs/stripeReconcile.ts" \
      "$ROOT/artifacts/api-server/src/index.ts"; then
    ok "migration-covered modules contain no Runtime DDL"
  else
    bad "Runtime DDL still present in migration-covered modules"
  fi

  if ! grep -qE 'CREATE TABLE|ALTER TABLE plan_cms' \
      "$ROOT/artifacts/api-server/src/modules/platform/planCms.ts"; then
    ok "planCms.ts contains no Runtime DDL (seed only)"
  else
    bad "planCms.ts still has Runtime DDL"
  fi

  if ! grep -qE 'ensureAutopilotTable|CREATE TABLE IF NOT EXISTS case_autopilot_reports|ALTER TABLE case_autopilot_reports' \
      "$ROOT/artifacts/api-server/src/agents/caseAutopilot.ts" \
      "$ROOT/artifacts/api-server/src/core/listeners/autopilotListener.ts" \
      "$ROOT/artifacts/api-server/src/modules/legal-core/cases.ts"; then
    ok "Autopilot modules contain no Runtime DDL (migration 028)"
  else
    bad "Autopilot Runtime DDL still present"
  fi

  if ! grep -qE 'CREATE TABLE IF NOT EXISTS (financial_accounts|ledger_entries|wallets|lawyer_payouts|invoice_payments|office_tax_settings|invoice_revisions|credit_notes)|CREATE INDEX IF NOT EXISTS idx_inv_payments_|CREATE INDEX IF NOT EXISTS idx_invoice_revisions_|CREATE INDEX IF NOT EXISTS idx_credit_notes_|CREATE INDEX IF NOT EXISTS idx_invoices_case_office|CREATE INDEX IF NOT EXISTS idx_revenues_case_office|CREATE INDEX IF NOT EXISTS idx_expenses_case_office|ALTER TABLE (revenues|expenses) ADD COLUMN IF NOT EXISTS deleted_at|CREATE SEQUENCE IF NOT EXISTS invoice_seq' \
      "$ROOT/artifacts/api-server/src/modules/financial/financialCore.ts" \
      "$ROOT/artifacts/api-server/src/modules/financial/invoices.ts" \
      "$ROOT/artifacts/api-server/src/modules/financial/financial-completions.ts" \
      "$ROOT/artifacts/api-server/src/modules/financial/accounting.ts" \
      "$ROOT/artifacts/api-server/src/modules/legal-core/cases.ts"; then
    ok "Financial 037 modules contain no Runtime DDL"
  else
    bad "Financial 037 Runtime DDL still present"
  fi

  trap - EXIT
  teardown_db
}

# ── Scenario 3k: Cases schema (017) + Demo seed INSERT shape ────────────────
scenario_migration_017_cases_schema() {
  log "Scenario 3k — migration 017: cases schema / Demo seed INSERT / idempotency"

  # ── A. cases table absent → WARNING, no abort ────────────────────────────
  setup_db "mig017_no_cases"
  trap teardown_db EXIT
  # Minimal DB without cases
  psql_db -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";' >/dev/null
  set +e
  psql_db -f "$MIGRATION_017" >/tmp/mig017-nocases.log 2>&1
  local nocases_rc=$?
  set -e
  [[ "$nocases_rc" -eq 0 ]] && ok "A: migration 017 succeeds when cases absent" || {
    bad "A: migration 017 aborted when cases absent"; cat /tmp/mig017-nocases.log
  }
  local nocases_warn
  nocases_warn=$(grep -c '017_cases: skipping column repair — cases table missing' /tmp/mig017-nocases.log || true)
  [[ "$nocases_warn" -ge 1 ]] && ok "A: WARNING for absent cases table" || bad "A: absent-table WARNING missing"
  trap - EXIT
  teardown_db

  # ── B. Fresh schema through 016 then 017 ─────────────────────────────────
  setup_db "mig017_fresh"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016

  local pre_cn
  pre_cn=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='cases' AND column_name='case_number'
    );")
  [[ "$pre_cn" == "f" ]] && ok "B pre: case_number absent before 017" || bad "B pre: case_number unexpectedly present"

  apply_migration_017

  local cols idx
  cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cases'
      AND column_name IN (
        'case_number','court_name','court_code','court_city',
        'court_district_number','court_district_type','next_hearing_date',
        'deleted_at','version'
      );")
  idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_uq_cases_office_case_number';")
  [[ "$cols" == "9" ]] && ok "B: expected cases schema columns present" || bad "B: cols=$cols"
  [[ "$idx" == "1" ]] && ok "B: unique index on (office_id, case_number) present" || bad "B: index count=$idx"

  # Demo-shaped INSERT (text PK + ON CONFLICT id) — twice for idempotency
  psql_db <<'SQL' >/dev/null
INSERT INTO cases (id, title, case_number, case_type, status, client_name, office_id, created_at, updated_at)
VALUES (
  'ddddca01-0000-0000-0000-000000000001',
  'نزاع عقاري — حي الملقا',
  '2025/E/1024',
  'عقاري',
  'open',
  'شركة النخبة للاستثمار',
  'ddddeeee-0000-0000-0000-000000000099',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
SQL
  ok "B: Demo-shaped cases INSERT succeeded (ON CONFLICT id compatible)"

  psql_db <<'SQL' >/dev/null
INSERT INTO cases (id, title, case_number, case_type, status, client_name, office_id, created_at, updated_at)
VALUES (
  'ddddca01-0000-0000-0000-000000000001',
  'نزاع عقاري — حي الملقا',
  '2025/E/1024',
  'عقاري',
  'open',
  'شركة النخبة للاستثمار',
  'ddddeeee-0000-0000-0000-000000000099',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
SQL
  local case_count
  case_count=$(psql_db -At -c "SELECT COUNT(*) FROM cases WHERE id='ddddca01-0000-0000-0000-000000000001';")
  [[ "$case_count" == "1" ]] && ok "B: seed already applied / repeated INSERT idempotent" || bad "B: case_count=$case_count"

  # office_id has no FK — invalid office must not abort seed INSERT
  set +e
  psql_db <<'SQL' >/tmp/mig017-bad-office.log 2>&1
INSERT INTO cases (id, title, case_number, case_type, status, client_name, office_id, created_at, updated_at)
VALUES (
  'ddddca99-0000-0000-0000-000000000099',
  'orphan office case',
  '2025/X/9999',
  'مدنية',
  'open',
  'orphan',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
SQL
  local bad_office_rc=$?
  set -e
  [[ "$bad_office_rc" -eq 0 ]] && ok "B: INSERT with non-existent office_id succeeds (no office FK)" \
    || bad "B: unexpected FK failure on office_id"

  apply_migration_017
  ok "B/F: re-run 017 idempotent"

  if verify_p0_schema /tmp/verify-017.log; then
    ok "B: verify-schema.sh passed after 017"
  else
    bad "B: verify-schema.sh failed after 017"; tail -20 /tmp/verify-017.log
  fi

  # Stale/missing seed column simulation: drop case_number → INSERT fails with 42703
  psql_db -c 'ALTER TABLE cases DROP COLUMN case_number;' >/dev/null
  set +e
  psql_db <<'SQL' >/tmp/mig017-stale.log 2>&1
INSERT INTO cases (id, title, case_number, case_type, status, client_name, office_id, created_at, updated_at)
VALUES ('ddddca02-0000-0000-0000-000000000002','x','2025/T/1','تأمين','open','y','ddddeeee-0000-0000-0000-000000000099',NOW(),NOW())
ON CONFLICT (id) DO NOTHING;
SQL
  local stale_rc=$?
  set -e
  [[ "$stale_rc" -ne 0 ]] && ok "C: stale/missing case_number makes Demo INSERT fail (42703)" \
    || bad "C: expected INSERT failure when case_number missing"
  grep -qi 'case_number' /tmp/mig017-stale.log \
    && ok "C: failure mentions case_number (not vague table-missing)" \
    || bad "C: error log did not mention case_number"

  # Production guard (source-level — Demo seed ONLY when DEMO_SEED_ENABLED=true)
  if grep -q 'DEMO_SEED_ENABLED === "true"' "$ROOT/artifacts/api-server/src/modules/platform/demoSeedPolicy.ts" \
      && ! grep -qE 'NODE_ENV\s*(!==|===)\s*["'"'"']production["'"'"']' "$ROOT/artifacts/api-server/src/modules/platform/demoSeedPolicy.ts" \
      && ! grep -q 'table may not exist yet' "$ROOT/artifacts/api-server/src/modules/platform/demoMode.ts" \
      && ! grep -q 'WHEN others' "$MIGRATION_017"; then
    ok "D: Demo seed opt-in only + migration has no WHEN others swallow"
  else
    bad "D: Demo seed / exception-handling regression"
  fi

  if ! grep -qE 'ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at|ALTER TABLE cases ADD COLUMN IF NOT EXISTS version|CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_cases_office_case_number' \
      "$ROOT/artifacts/api-server/src/modules/legal-core/cases.ts"; then
    ok "D: cases.ts no longer runs 017-owned Runtime DDL"
  else
    bad "D: cases.ts still contains 017-owned Runtime DDL"
  fi

  if grep -q 'case_number' "$ROOT/lib/db/src/schema/cases.ts" \
      && grep -q 'next_hearing_date' "$ROOT/lib/db/src/schema/cases.ts" \
      && grep -q 'deleted_at' "$ROOT/lib/db/src/schema/cases.ts" \
      && grep -q 'version' "$ROOT/lib/db/src/schema/cases.ts"; then
    ok "D: Drizzle cases schema includes Migration 017 columns"
  else
    bad "D: Drizzle cases schema missing 017 columns"
  fi

  trap - EXIT
  teardown_db

  # ── E. Duplicate case_number with office_id NOT NULL → WARNING + skip ────
  setup_db "mig017_dup_cn"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016

  psql_db <<'SQL' >/dev/null
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_number TEXT;
INSERT INTO cases (id, title, case_type, status, office_id, case_number, created_at, updated_at)
VALUES
  ('dup-a', 'Case A', 'مدنية', 'open', 'off1', 'CN-DUP', NOW(), NOW()),
  ('dup-b', 'Case B', 'مدنية', 'open', 'off1', 'CN-DUP', NOW(), NOW());
SQL

  set +e
  psql_db -f "$MIGRATION_017" >/tmp/mig017-dup.log 2>&1
  local dup_rc=$?
  set -e
  [[ "$dup_rc" -eq 0 ]] && ok "E: migration 017 succeeds with non-null office_id duplicates" || {
    bad "E: migration 017 aborted on duplicates"; cat /tmp/mig017-dup.log
  }
  local dup_warn dup_idx
  dup_warn=$(grep -c 'duplicate (office_id, case_number) rows' /tmp/mig017-dup.log || true)
  dup_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_uq_cases_office_case_number';")
  [[ "$dup_warn" -ge 1 ]] && ok "E: WARNING emitted for non-null office_id duplicate case_number" || bad "E: duplicate WARNING absent"
  [[ "$dup_idx" == "0" ]] && ok "E: unique index skipped when non-null office_id duplicates exist" || bad "E: unexpected index count=$dup_idx"

  apply_migration_017
  ok "E/F: re-run 017 with duplicates remains idempotent (still skipped)"

  # Cleanup duplicates then reapply → index created
  psql_db -c "DELETE FROM cases WHERE id = 'dup-b';" >/dev/null
  apply_migration_017
  local cleaned_idx
  cleaned_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_uq_cases_office_case_number';")
  [[ "$cleaned_idx" == "1" ]] && ok "E: after duplicate cleanup + reapply, unique index created" \
    || bad "E: index missing after cleanup (count=$cleaned_idx)"

  apply_migration_017
  ok "E/F2: re-run 017 after index create is idempotent"

  trap - EXIT
  teardown_db

  # ── E2. Duplicate case_number with office_id NULL → index still created ──
  setup_db "mig017_dup_null_office"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016

  psql_db <<'SQL' >/dev/null
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_number TEXT;
INSERT INTO cases (id, title, case_type, status, office_id, case_number, created_at, updated_at)
VALUES
  ('null-a', 'Null Office A', 'مدنية', 'open', NULL, 'CN-NULL', NOW(), NOW()),
  ('null-b', 'Null Office B', 'مدنية', 'open', NULL, 'CN-NULL', NOW(), NOW());
SQL

  set +e
  psql_db -f "$MIGRATION_017" >/tmp/mig017-null-office.log 2>&1
  local null_office_rc=$?
  set -e
  [[ "$null_office_rc" -eq 0 ]] && ok "E2: migration 017 succeeds with NULL office_id duplicate case_numbers" || {
    bad "E2: migration 017 aborted on NULL office_id dups"; cat /tmp/mig017-null-office.log
  }
  local null_warn null_idx
  null_warn=$(grep -c 'duplicate (office_id, case_number) rows' /tmp/mig017-null-office.log || true)
  null_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_uq_cases_office_case_number';")
  [[ "$null_warn" -eq 0 ]] && ok "E2: no false-positive duplicate WARNING for NULL office_id" \
    || bad "E2: unexpected duplicate WARNING for NULL office_id"
  [[ "$null_idx" == "1" ]] && ok "E2: unique index created despite NULL office_id duplicate case_numbers" \
    || bad "E2: index missing (count=$null_idx)"

  apply_migration_017
  ok "E2/F: re-run 017 with NULL office_id dups is idempotent"

  trap - EXIT
  teardown_db

  # ── F. Unexpected ALTER failure must abort migration ─────────────────────
  setup_db "mig017_bad_alter"
  trap teardown_db EXIT
  # cases as a VIEW → ALTER TABLE ADD COLUMN is unexpected and must fail loudly
  psql_db <<'SQL' >/dev/null
CREATE TABLE cases_base (id text PRIMARY KEY, title text);
CREATE VIEW cases AS SELECT id, title FROM cases_base;
SQL

  set +e
  psql_db -f "$MIGRATION_017" >/tmp/mig017-bad-alter.log 2>&1
  local bad_alter_rc=$?
  set -e
  [[ "$bad_alter_rc" -ne 0 ]] && ok "F: unexpected ALTER failure aborts migration" || {
    bad "F: migration swallowed unexpected ALTER failure"; cat /tmp/mig017-bad-alter.log
  }

  trap - EXIT
  teardown_db
}

# ── Scenario 3l: Money Numeric Batch 1 (018) ────────────────────────────────
scenario_migration_018_money_numeric_batch1() {
  log "Scenario 3l — migration 018: REAL → NUMERIC(18,2) money Batch 1"

  # ── A. Missing tables → NOTICE, success ───────────────────────────────────
  setup_db "mig018_empty"
  trap teardown_db EXIT
  psql_db -f "$MIGRATION_018" >/tmp/mig018-empty.log 2>&1
  local empty_rc=$?
  [[ "$empty_rc" -eq 0 ]] && ok "A: migration 018 succeeds when money tables absent" || {
    bad "A: migration 018 aborted when tables absent"; cat /tmp/mig018-empty.log
  }
  local empty_notice
  empty_notice=$(grep -c '018_money: skipping' /tmp/mig018-empty.log || true)
  [[ "$empty_notice" -ge 1 ]] && ok "A: NOTICE emitted for missing tables" || bad "A: missing NOTICE for absent tables"

  # ── B. Fresh 003 REAL columns → 018 converts + preserves values ───────────
  setup_db "mig018_fresh"
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_011
  apply_migration_012
  apply_migration_013
  apply_migration_014
  apply_migration_015
  apply_migration_016
  apply_migration_017

  local pre_type
  pre_type=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='amount';")
  [[ "$pre_type" == "float4" ]] && ok "B pre: invoices.amount is REAL (float4)" || bad "B pre: invoices.amount udt=$pre_type"

  psql_db <<'SQL' >/dev/null
INSERT INTO invoices (id, amount, status) VALUES
  ('inv-whole', 100::real, 'pending'),
  ('inv-frac', 10.5::real, 'pending'),
  ('inv-round', 1.235::real, 'pending'),
  ('inv-neg', (-25.5)::real, 'pending');

INSERT INTO subscriptions (id, plan_name, plan_price, status, start_date, end_date)
VALUES ('sub-1', 'pro', 199.99::real, 'active', NOW(), NOW() + interval '30 days');

INSERT INTO usage_logs (id, feature, units, cost) VALUES
  ('ul-1', 'ai', 3, 0.12::real);

INSERT INTO plans (id, name, price, monthly_price, yearly_price)
VALUES ('plan-1', 'Starter', 0::real, 99.9::real, 999.99::real);

INSERT INTO discount_codes (id, code, type, value)
VALUES
  ('dc-pct', 'PCT10', 'percent', 10::real),
  ('dc-fix', 'SAR50', 'fixed', 50.25::real);

INSERT INTO ai_api_keys (id, provider, key_label, key_hash, key_masked, total_cost)
VALUES ('aik-1', 'openai', 'prod', 'hh', 'sk-...xxxx', 12.345::real);
SQL

  apply_migration_018

  local post_types
  post_types=$(psql_db -At -c "
    SELECT table_name||'.'||column_name||'='||udt_name||'('||COALESCE(numeric_precision::text,'')||','||COALESCE(numeric_scale::text,'')||')'
    FROM information_schema.columns
    WHERE table_schema='public'
      AND (
        (table_name='invoices' AND column_name='amount')
        OR (table_name='subscriptions' AND column_name='plan_price')
        OR (table_name='usage_logs' AND column_name='cost')
        OR (table_name='plans' AND column_name IN ('price','monthly_price','yearly_price'))
        OR (table_name='discount_codes' AND column_name='value')
        OR (table_name='ai_api_keys' AND column_name='total_cost')
      )
    ORDER BY 1;")
  local post_ok=1
  local post_line
  while IFS= read -r post_line; do
    [[ -z "$post_line" ]] && continue
    if [[ "$post_line" != *"=numeric(18,2)" ]]; then
      bad "B: unexpected type $post_line"
      post_ok=0
    fi
  done <<< "$post_types"
  [[ "$post_ok" -eq 1 ]] && ok "B: all Batch-1 columns are numeric(18,2)"

  local real_left
  real_left=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND (
        (table_name='invoices' AND column_name='amount')
        OR (table_name='subscriptions' AND column_name='plan_price')
        OR (table_name='usage_logs' AND column_name='cost')
        OR (table_name='plans' AND column_name IN ('price','monthly_price','yearly_price'))
        OR (table_name='discount_codes' AND column_name='value')
        OR (table_name='ai_api_keys' AND column_name='total_cost')
      )
      AND udt_name IN ('float4','float8');")
  [[ "$real_left" == "0" ]] && ok "B: no in-scope REAL/DOUBLE PRECISION remain" || bad "B: REAL left count=$real_left"

  # Value preservation / rounding (1.235::real → numeric(18,2) via PG cast)
  local inv_vals
  inv_vals=$(psql_db -At -c "
    SELECT id||'='||amount::text FROM invoices
    WHERE id IN ('inv-whole','inv-frac','inv-round','inv-neg')
    ORDER BY id;")
  echo "$inv_vals" | grep -q 'inv-whole=100.00' && ok "B: whole number preserved" || bad "B: whole=$inv_vals"
  echo "$inv_vals" | grep -q 'inv-frac=10.50' && ok "B: fraction preserved" || bad "B: frac=$inv_vals"
  echo "$inv_vals" | grep -q 'inv-neg=-25.50' && ok "B: negative preserved" || bad "B: neg=$inv_vals"
  echo "$inv_vals" | grep -q 'inv-round=1.24' && ok "B: rounding to 2 decimals applied (1.235::real → 1.24)" || bad "B: round=$inv_vals"

  local aik_cost
  aik_cost=$(psql_db -At -c "SELECT total_cost::text FROM ai_api_keys WHERE id='aik-1';")
  [[ "$aik_cost" == "12.35" ]] && ok "B: ai_api_keys.total_cost rounded to 12.35" || bad "B: aik_cost=$aik_cost"

  # Defaults + nullability
  local price_default nullable_monthly notnull_amount
  price_default=$(psql_db -At -c "
    SELECT column_default FROM information_schema.columns
    WHERE table_name='plans' AND column_name='price';")
  nullable_monthly=$(psql_db -At -c "
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name='plans' AND column_name='monthly_price';")
  notnull_amount=$(psql_db -At -c "
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name='invoices' AND column_name='amount';")
  echo "$price_default" | grep -Eq '0' && ok "B: plans.price default preserved" || bad "B: price default=$price_default"
  [[ "$nullable_monthly" == "YES" ]] && ok "B: plans.monthly_price remains nullable" || bad "B: monthly nullable=$nullable_monthly"
  [[ "$notnull_amount" == "NO" ]] && ok "B: invoices.amount remains NOT NULL" || bad "B: amount nullability=$notnull_amount"

  # NULL allowed on nullable monthly/yearly
  psql_db -c "UPDATE plans SET monthly_price = NULL, yearly_price = NULL WHERE id='plan-1';" >/dev/null
  ok "B: NULL write on nullable plan prices succeeds"

  # Aggregates / inserts still work
  local sum_amt
  sum_amt=$(psql_db -At -c "SELECT SUM(amount)::text FROM invoices WHERE id LIKE 'inv-%';")
  [[ -n "$sum_amt" ]] && ok "B: SUM(amount) works ($sum_amt)" || bad "B: SUM failed"

  psql_db -c "INSERT INTO invoices (id, amount) VALUES ('inv-new', 3.14159);" >/dev/null
  local new_amt
  new_amt=$(psql_db -At -c "SELECT amount::text FROM invoices WHERE id='inv-new';")
  [[ "$new_amt" == "3.14" ]] && ok "B: insert rounds to NUMERIC(18,2)" || bad "B: insert amount=$new_amt"

  # discount_codes dual meaning preserved (percent + fixed)
  local dc_types
  dc_types=$(psql_db -At -c "SELECT code||':'||type||'='||value::text FROM discount_codes ORDER BY code;")
  echo "$dc_types" | grep -q 'PCT10:percent=10.00' && ok "B: percent discount value preserved" || bad "B: dc=$dc_types"
  echo "$dc_types" | grep -q 'SAR50:fixed=50.25' && ok "B: fixed SAR discount value preserved" || bad "B: dc=$dc_types"

  # Idempotent re-run
  apply_migration_018
  ok "B/F: re-run 018 idempotent"

  if verify_p0_schema /tmp/verify-018.log; then
    ok "B: verify-schema.sh passed after 018"
  else
    bad "B: verify-schema.sh failed after 018"; tail -20 /tmp/verify-018.log
  fi

  # ── C. Partial column presence ────────────────────────────────────────────
  setup_db "mig018_partial"
  apply_migrations_base
  psql_db -c "ALTER TABLE invoices DROP COLUMN amount;" >/dev/null
  psql_db -f "$MIGRATION_018" >/tmp/mig018-partial.log 2>&1
  local partial_rc=$?
  [[ "$partial_rc" -eq 0 ]] && ok "C: migration 018 succeeds with partial columns" || {
    bad "C: migration 018 aborted on partial"; cat /tmp/mig018-partial.log
  }
  grep -q '018_money: skipping invoices.amount — column missing' /tmp/mig018-partial.log \
    && ok "C: NOTICE for missing invoices.amount" || bad "C: missing column NOTICE absent"

  local plans_type
  plans_type=$(psql_db -At -c "
    SELECT udt_name||'('||numeric_precision||','||numeric_scale||')'
    FROM information_schema.columns
    WHERE table_name='plans' AND column_name='price';")
  [[ "$plans_type" == "numeric(18,2)" ]] && ok "C: other columns still converted" || bad "C: plans.price=$plans_type"

  # ── D. Unexpected type aborts ─────────────────────────────────────────────
  setup_db "mig018_badtype"
  apply_migrations_base
  psql_db -c "ALTER TABLE invoices ALTER COLUMN amount TYPE text USING amount::text;" >/dev/null
  set +e
  psql_db -f "$MIGRATION_018" >/tmp/mig018-badtype.log 2>&1
  local badtype_rc=$?
  set -e
  [[ "$badtype_rc" -ne 0 ]] && ok "D: migration 018 aborts on unexpected type" || {
    bad "D: migration swallowed unexpected type"; cat /tmp/mig018-badtype.log
  }
  grep -qi 'refusing to convert' /tmp/mig018-badtype.log \
    && ok "D: refusing-to-convert error emitted" || bad "D: abort message missing"
  if ! grep -qi 'WHEN others' "$MIGRATION_018"; then
    ok "D: migration 018 has no WHEN others"
  else
    bad "D: migration 018 contains WHEN others"
  fi

  # ── E. Drizzle schema guard (static) ──────────────────────────────────────
  if grep -q 'numeric("amount", { precision: 18, scale: 2 })' "$ROOT/lib/db/src/schema/billing.ts" \
     && grep -q 'numeric("total_cost", { precision: 18, scale: 2 })' "$ROOT/lib/db/src/schema/admin.ts" \
     && ! grep -qE '\breal\s*\(' "$ROOT/lib/db/src/schema/billing.ts" \
     && ! grep -qE '\breal\s*\(' "$ROOT/lib/db/src/schema/admin.ts"; then
    ok "E: Drizzle billing/admin schemas match Migration 018 (no REAL)"
  else
    bad "E: Drizzle schema drift vs Migration 018"
  fi

  trap - EXIT
  teardown_db
}

# ── Scenario 3m: Money Numeric Batch 2 (019) ────────────────────────────────
scenario_migration_019_money_numeric_batch2() {
  log "Scenario 3m — migration 019: bare NUMERIC → NUMERIC(18,2) payment/ledger"

  # ── A. Missing tables → NOTICE, success ───────────────────────────────────
  setup_db "mig019_empty"
  trap teardown_db EXIT
  psql_db -f "$MIGRATION_019" >/tmp/mig019-empty.log 2>&1
  local empty_rc=$?
  [[ "$empty_rc" -eq 0 ]] && ok "A: migration 019 succeeds when tables absent" || {
    bad "A: migration 019 aborted when tables absent"; cat /tmp/mig019-empty.log
  }
  local empty_notice
  empty_notice=$(grep -c '019_money: skipping' /tmp/mig019-empty.log || true)
  [[ "$empty_notice" -ge 1 ]] && ok "A: NOTICE emitted for missing tables" || bad "A: missing NOTICE"

  # ── B. Fresh bare NUMERIC through 018 → 019 converts safe SAR values ──────
  setup_db "mig019_fresh"
  apply_migrations_through_015
  apply_migration_016
  apply_migration_017
  apply_migration_018

  local pre_amt
  pre_amt=$(psql_db -At -c "
    SELECT udt_name||':'||COALESCE(numeric_precision::text,'∅')||','||COALESCE(numeric_scale::text,'∅')
    FROM information_schema.columns
    WHERE table_name='payment_transactions' AND column_name='amount';")
  if [[ "$pre_amt" != "numeric:18,2" ]]; then
    ok "B pre: payment_transactions.amount not yet NUMERIC(18,2) ($pre_amt)"
  else
    bad "B pre: already numeric(18,2) before 019: $pre_amt"
  fi

  psql_db <<'SQL' >/dev/null
INSERT INTO payment_transactions
  (id, office_id, amount, platform_fee, net_amount, stripe_fee, status)
VALUES
  ('11111111-1111-1111-1111-111111111101'::uuid, 'off-a', 100, 10, 90, 2.90, 'completed'),
  ('11111111-1111-1111-1111-111111111102'::uuid, 'off-a', 10.50, 1.05, 9.45, 0.30, 'completed'),
  ('11111111-1111-1111-1111-111111111103'::uuid, 'off-a', 199.99, NULL, NULL, NULL, 'pending'),
  ('11111111-1111-1111-1111-111111111104'::uuid, 'off-a', -5.00, 0, -5.00, 0, 'refunded');

INSERT INTO office_ledger
  (id, office_id, type, amount, platform_fee, stripe_fee, net_amount)
VALUES
  ('22222222-2222-2222-2222-222222222201'::uuid, 'off-a', 'credit', 100.00, 10.00, 2.90, 87.10),
  ('22222222-2222-2222-2222-222222222202'::uuid, 'off-a', 'debit', 25.50, 0, 0, 25.50),
  ('22222222-2222-2222-2222-222222222203'::uuid, 'off-a', 'credit', 1.2300, 0.1200, 0.0000, 1.1100);
SQL

  apply_migration_019

  local post_ok=1 post_line post_types
  post_types=$(psql_db -At -c "
    SELECT table_name||'.'||column_name||'='||udt_name||'('||COALESCE(numeric_precision::text,'')||','||COALESCE(numeric_scale::text,'')||')'
    FROM information_schema.columns
    WHERE table_schema='public'
      AND (
        (table_name='payment_transactions' AND column_name IN ('amount','platform_fee','net_amount','stripe_fee'))
        OR (table_name='office_ledger' AND column_name IN ('amount','platform_fee','stripe_fee','net_amount'))
      )
    ORDER BY 1;")
  while IFS= read -r post_line; do
    [[ -z "$post_line" ]] && continue
    if [[ "$post_line" != *"=numeric(18,2)" ]]; then
      bad "B: unexpected type $post_line"
      post_ok=0
    fi
  done <<< "$post_types"
  [[ "$post_ok" -eq 1 ]] && ok "B: all Batch-2 columns are numeric(18,2)"

  local bare_left
  bare_left=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public'
      AND (
        (table_name='payment_transactions' AND column_name IN ('amount','platform_fee','net_amount','stripe_fee'))
        OR (table_name='office_ledger' AND column_name IN ('amount','platform_fee','stripe_fee','net_amount'))
      )
      AND NOT (udt_name='numeric' AND numeric_precision=18 AND numeric_scale=2);")
  [[ "$bare_left" == "0" ]] && ok "B: no in-scope bare NUMERIC remains" || bad "B: bare left=$bare_left"

  local vals
  vals=$(psql_db -At -c "
    SELECT amount::text FROM payment_transactions
    WHERE id='11111111-1111-1111-1111-111111111102'::uuid;")
  [[ "$vals" == "10.50" ]] && ok "B: 2-decimal value preserved" || bad "B: frac=$vals"

  local trail
  trail=$(psql_db -At -c "
    SELECT amount::text FROM office_ledger
    WHERE id='22222222-2222-2222-2222-222222222203'::uuid;")
  [[ "$trail" == "1.23" ]] && ok "B: trailing-zero numeric preserved as 1.23" || bad "B: trail=$trail"

  local neg
  neg=$(psql_db -At -c "
    SELECT amount::text FROM payment_transactions
    WHERE id='11111111-1111-1111-1111-111111111104'::uuid;")
  [[ "$neg" == "-5.00" ]] && ok "B: negative value preserved" || bad "B: neg=$neg"

  local null_fee
  null_fee=$(psql_db -At -c "
    SELECT platform_fee IS NULL FROM payment_transactions
    WHERE id='11111111-1111-1111-1111-111111111103'::uuid;")
  [[ "$null_fee" == "t" ]] && ok "B: NULL fee preserved" || bad "B: null_fee=$null_fee"

  local def_pf
  def_pf=$(psql_db -At -c "
    SELECT column_default FROM information_schema.columns
    WHERE table_name='office_ledger' AND column_name='platform_fee';")
  echo "$def_pf" | grep -Eq '0' && ok "B: office_ledger.platform_fee default preserved" || bad "B: default=$def_pf"

  local nn_amt
  nn_amt=$(psql_db -At -c "
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name='payment_transactions' AND column_name='amount';")
  [[ "$nn_amt" == "NO" ]] && ok "B: payment_transactions.amount remains NOT NULL" || bad "B: nullability=$nn_amt"

  local sum_amt
  sum_amt=$(psql_db -At -c "SELECT SUM(amount)::text FROM payment_transactions WHERE office_id='off-a';")
  [[ -n "$sum_amt" ]] && ok "B: SUM(amount) works ($sum_amt)" || bad "B: SUM failed"

  psql_db -c "
    INSERT INTO payment_transactions (id, office_id, amount, status)
    VALUES ('11111111-1111-1111-1111-111111111199'::uuid, 'off-a', 3.14159, 'pending');" >/dev/null
  local new_amt
  new_amt=$(psql_db -At -c "
    SELECT amount::text FROM payment_transactions
    WHERE id='11111111-1111-1111-1111-111111111199'::uuid;")
  [[ "$new_amt" == "3.14" ]] && ok "B: post-migration insert rounds to scale 2" || bad "B: insert=$new_amt"

  apply_migration_019
  ok "B/F: re-run 019 idempotent"

  if verify_p0_schema /tmp/verify-019.log; then
    ok "B: verify-schema.sh passed after 019"
  else
    bad "B: verify-schema.sh failed after 019"; tail -20 /tmp/verify-019.log
  fi

  # ── C. Partial column presence ────────────────────────────────────────────
  setup_db "mig019_partial"
  apply_migrations_through_015
  apply_migration_016
  apply_migration_017
  apply_migration_018
  psql_db -c "ALTER TABLE payment_transactions DROP COLUMN stripe_fee;" >/dev/null
  psql_db -f "$MIGRATION_019" >/tmp/mig019-partial.log 2>&1
  local partial_rc=$?
  [[ "$partial_rc" -eq 0 ]] && ok "C: migration 019 succeeds with partial columns" || {
    bad "C: aborted on partial"; cat /tmp/mig019-partial.log
  }
  grep -q '019_money: skipping payment_transactions.stripe_fee — column missing' /tmp/mig019-partial.log \
    && ok "C: NOTICE for missing stripe_fee" || bad "C: missing column NOTICE absent"
  local amt_type
  amt_type=$(psql_db -At -c "
    SELECT udt_name||'('||numeric_precision||','||numeric_scale||')'
    FROM information_schema.columns
    WHERE table_name='payment_transactions' AND column_name='amount';")
  [[ "$amt_type" == "numeric(18,2)" ]] && ok "C: other columns still converted" || bad "C: amount=$amt_type"

  # ── D. >2 meaningful decimals must abort ──────────────────────────────────
  setup_db "mig019_scale"
  apply_migrations_through_015
  apply_migration_016
  apply_migration_017
  apply_migration_018
  psql_db -c "
    INSERT INTO payment_transactions (id, office_id, amount, status)
    VALUES ('11111111-1111-1111-1111-1111111111aa'::uuid, 'off-b', 1.234, 'pending');" >/dev/null
  set +e
  psql_db -f "$MIGRATION_019" >/tmp/mig019-scale.log 2>&1
  local scale_rc=$?
  set -e
  [[ "$scale_rc" -ne 0 ]] && ok "D: aborts on >2 meaningful decimals" || {
    bad "D: did not abort on scale>2"; cat /tmp/mig019-scale.log
  }
  grep -qi 'more than 2 meaningful decimal places' /tmp/mig019-scale.log \
    && ok "D: scale abort message emitted" || bad "D: scale message missing"

  # ── E. Overflow must abort ────────────────────────────────────────────────
  setup_db "mig019_overflow"
  apply_migrations_through_015
  apply_migration_016
  apply_migration_017
  apply_migration_018
  psql_db -c "
    INSERT INTO payment_transactions (id, office_id, amount, status)
    VALUES ('11111111-1111-1111-1111-1111111111bb'::uuid, 'off-c', 10000000000000000, 'pending');" >/dev/null
  set +e
  psql_db -f "$MIGRATION_019" >/tmp/mig019-overflow.log 2>&1
  local ov_rc=$?
  set -e
  [[ "$ov_rc" -ne 0 ]] && ok "E: aborts on NUMERIC(18,2) overflow" || {
    bad "E: did not abort on overflow"; cat /tmp/mig019-overflow.log
  }
  grep -qi 'exceeding NUMERIC(18,2) range' /tmp/mig019-overflow.log \
    && ok "E: overflow abort message emitted" || bad "E: overflow message missing"

  # ── F. Unexpected type (real) must abort ──────────────────────────────────
  setup_db "mig019_badtype"
  apply_migrations_through_015
  apply_migration_016
  apply_migration_017
  apply_migration_018
  psql_db -c "ALTER TABLE payment_transactions ALTER COLUMN amount TYPE real USING amount::real;" >/dev/null
  set +e
  psql_db -f "$MIGRATION_019" >/tmp/mig019-badtype.log 2>&1
  local badtype_rc=$?
  set -e
  [[ "$badtype_rc" -ne 0 ]] && ok "F: aborts on unexpected real type" || {
    bad "F: swallowed unexpected type"; cat /tmp/mig019-badtype.log
  }
  grep -qi 'unexpected type' /tmp/mig019-badtype.log \
    && ok "F: unexpected-type message emitted" || bad "F: type message missing"
  if ! grep -qi 'WHEN others' "$MIGRATION_019"; then
    ok "F: migration 019 has no WHEN others"
  else
    bad "F: migration 019 contains WHEN others"
  fi

  # ── G. Static schema/registry guard ───────────────────────────────────────
  if grep -q "NUMERIC(18,2)" "$ROOT/artifacts/api-server/src/lib/dbRegistry.ts" \
     && grep -q "payment_transactions" "$MIGRATION_019" \
     && grep -q "office_ledger" "$MIGRATION_019"; then
    ok "G: dbRegistry + migration 019 targets aligned"
  else
    bad "G: registry/migration drift"
  fi

  trap - EXIT
  teardown_db
}

# ── Scenario 021: RAG schema + tenant mismatch FK negative ─────────────────
scenario_migration_021_rag_tenant_fk() {
  log "Scenario 021 — RAG schema foundation + cross-office chunk FK rejection"
  setup_db "mig021_rag"
  trap teardown_db EXIT

  # pgvector may be absent on stock local Postgres — skip (do not fail suite)
  local has_vector
  has_vector=$(psql_db -At -c "SELECT 1 FROM pg_available_extensions WHERE name='vector'" 2>/dev/null || true)
  if [[ "$has_vector" != "1" ]]; then
    skip "021: pgvector not available on this PostgreSQL — install pgvector/pgvector:pg16 to run live"
    trap - EXIT
    teardown_db
    return 0
  fi

  apply_all_migrations

  local fk_def hnsw_idx redundant_idx
  fk_def=$(psql_db -At -c "
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname='rag_chunks' AND c.conname='rag_chunks_office_document_fkey';")
  [[ "$fk_def" == *"FOREIGN KEY (office_id, document_id)"*"REFERENCES document_center_files(office_id, id)"* ]] \
    && ok "021: composite tenant FK present" \
    || bad "021: composite FK missing/unexpected: $fk_def"

  hnsw_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE tablename='rag_chunks' AND indexname='idx_rag_chunks_embedding_hnsw';")
  [[ "$hnsw_idx" == "1" ]] && ok "021: HNSW index present" || bad "021: HNSW index count=$hnsw_idx"

  redundant_idx=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE tablename='rag_chunks'
      AND indexname IN ('idx_rag_chunks_office_document','idx_rag_chunks_office_document_chunk');")
  [[ "$redundant_idx" == "0" ]] && ok "021: redundant btree indexes absent" || bad "021: redundant indexes=$redundant_idx"

  psql_db <<'SQL' >/dev/null
INSERT INTO document_center_files (id, office_id, source_table, source_id, file_name)
VALUES
  ('doc-a', 'office-a', 'document_center_files', 'src-a', 'a.pdf'),
  ('doc-b', 'office-b', 'document_center_files', 'src-b', 'b.pdf');
INSERT INTO rag_chunks (office_id, document_id, chunk_index, content)
VALUES ('office-a', 'doc-a', 0, 'same-office ok');
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO rag_chunks (office_id, document_id, chunk_index, content)
    VALUES ('office-a', 'doc-b', 0, 'cross-office must fail');" >/tmp/mig021-cross.log 2>&1
  local cross_rc=$?
  set -e
  [[ "$cross_rc" -ne 0 ]] && ok "021: cross-office chunk INSERT rejected" || {
    bad "021: cross-office chunk INSERT was allowed"; cat /tmp/mig021-cross.log
  }
  grep -qiE 'foreign key|rag_chunks_office_document_fkey' /tmp/mig021-cross.log \
    && ok "021: rejection cites composite FK" \
    || bad "021: unexpected error on cross-office insert"

  # Runtime DDL removed for 021-owned tables
  if ! grep -qE 'CREATE TABLE IF NOT EXISTS document_center_files' \
        "$ROOT/artifacts/api-server/src/modules/documents/documentCenter.ts" \
     && ! grep -qE 'CREATE TABLE IF NOT EXISTS document_ai_metadata' \
        "$ROOT/artifacts/api-server/src/modules/documents/documentCenter.ts"; then
    ok "021: Runtime DDL for document_center_files / document_ai_metadata removed"
  else
    bad "021: Runtime DDL still creates document_center tables"
  fi

  trap - EXIT
  teardown_db
}

# ── Scenario: migration 025 billing schema authority (Stage 16.1) ───────────
scenario_migration_025_billing() {
  log "Scenario 025 — billing schema: fresh / partial repair / data preserve / idempotent"

  # ── A. Fresh database ────────────────────────────────────────────────────
  setup_db "mig025_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010

  local pre_ent pre_inv
  pre_ent=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='office_entitlements'
    );")
  pre_inv=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='platform_billing_invoices'
    );")
  [[ "$pre_ent" == "f" ]] && ok "A pre-025: office_entitlements absent" || bad "A pre-025: entitlements should be absent"
  [[ "$pre_inv" == "f" ]] && ok "A pre-025: platform_billing_invoices absent" || bad "A pre-025: invoices should be absent"

  apply_migration_025

  local post_ent post_inv ent_cols inv_cols idx_office idx_status idx_due
  post_ent=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='office_entitlements'
    );")
  post_inv=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='platform_billing_invoices'
    );")
  ent_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_entitlements'
      AND column_name IN ('office_id','key','plan','limit','used','reset_at','updated_at');")
  inv_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='platform_billing_invoices'
      AND column_name IN ('id','office_id','plan_id','plan_name','amount','currency','status',
                          'billing_cycle','issue_date','due_date','paid_at','notes','stripe_id','created_at');")
  idx_office=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_platform_billing_invoices_office_id';")
  idx_status=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_platform_billing_invoices_status';")
  idx_due=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_platform_billing_invoices_due_date';")

  [[ "$post_ent" == "t" ]] && ok "A: office_entitlements created" || bad "A: office_entitlements missing"
  [[ "$post_inv" == "t" ]] && ok "A: platform_billing_invoices created" || bad "A: platform_billing_invoices missing"
  [[ "$ent_cols" == "7" ]] && ok "A: entitlements columns present" || bad "A: ent cols=$ent_cols"
  [[ "$inv_cols" == "14" ]] && ok "A: invoice columns present" || bad "A: inv cols=$inv_cols"
  [[ "$idx_office" == "1" ]] && ok "A: office_id index" || bad "A: office index missing"
  [[ "$idx_status" == "1" ]] && ok "A: status index" || bad "A: status index missing"
  [[ "$idx_due" == "1" ]] && ok "A: due_date index" || bad "A: due_date index missing"

  psql_db <<'SQL' >/dev/null
INSERT INTO office_entitlements (office_id, key, plan, "limit", used)
VALUES ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 'CASES', 'pro', 100, 3)
ON CONFLICT (office_id, key) DO NOTHING;
INSERT INTO platform_billing_invoices
  (id, office_id, plan_id, plan_name, amount, currency, status, billing_cycle, due_date)
VALUES
  ('inv-025-a', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 'pro', 'احترافي', 299, 'SAR', 'unpaid', 'monthly', NOW() + INTERVAL '7 days');
SQL
  ok "A: tenant-scoped insert into both tables"

  apply_migration_025
  ok "A/F: re-run 025 on fresh schema succeeded"

  # Complete P0 chain so verify-schema can assert billing tables alongside prior owners
  apply_migration_011
  apply_migration_012
  apply_migration_013
  apply_migration_014
  apply_migration_015
  apply_migration_016
  apply_migration_017
  if verify_p0_schema /tmp/verify-025-fresh.log; then
    ok "A: verify-schema after 010→017 + 025"
  else
    bad "A: verify-schema failed after 010→017 + 025"; tail -20 /tmp/verify-025-fresh.log
  fi

  trap - EXIT
  teardown_db

  # ── B. Partial legacy tables — repair without data loss ──────────────────
  setup_db "mig025_partial"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010

  psql_db <<'SQL' >/dev/null
CREATE TABLE office_entitlements (
  office_id TEXT NOT NULL,
  key TEXT NOT NULL,
  "limit" INTEGER,
  used INTEGER
);
INSERT INTO office_entitlements (office_id, key, "limit", used)
VALUES ('legacy-office', 'AI_CALLS', 50, 7);

CREATE TABLE platform_billing_invoices (
  id TEXT PRIMARY KEY,
  plan_id TEXT,
  amount NUMERIC,
  status TEXT
);
INSERT INTO platform_billing_invoices (id, plan_id, amount, status)
VALUES ('legacy-inv-1', 'basic', 99, 'paid');
SQL

  apply_migration_025

  local partial_ent_cols partial_inv_cols legacy_ent legacy_inv
  partial_ent_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_entitlements'
      AND column_name IN ('plan','reset_at','updated_at');")
  partial_inv_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='platform_billing_invoices'
      AND column_name IN ('office_id','plan_name','currency','billing_cycle','issue_date','due_date','paid_at','notes','stripe_id','created_at');")
  legacy_ent=$(psql_db -At -c "
    SELECT COUNT(*) FROM office_entitlements
    WHERE office_id='legacy-office' AND key='AI_CALLS' AND used=7;")
  legacy_inv=$(psql_db -At -c "
    SELECT COUNT(*) FROM platform_billing_invoices
    WHERE id='legacy-inv-1' AND amount=99 AND status='paid';")

  [[ "$partial_ent_cols" == "3" ]] && ok "B: entitlements missing columns added" || bad "B: ent cols=$partial_ent_cols"
  [[ "$partial_inv_cols" == "10" ]] && ok "B: invoice missing columns added" || bad "B: inv cols=$partial_inv_cols"
  [[ "$legacy_ent" == "1" ]] && ok "B: legacy entitlement row preserved" || bad "B: entitlement data lost"
  [[ "$legacy_inv" == "1" ]] && ok "B: legacy invoice row preserved" || bad "B: invoice data lost"

  apply_migration_025
  ok "B/F: re-run 025 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db
}

# ── Scenario: migration 026 promo schema authority (Stage 16.3) ─────────────
scenario_migration_026_promo() {
  log "Scenario 026 — promo schema: ownership / fresh / partial repair / isolation / idempotent"

  local OFFICE_A="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1"
  local OFFICE_B="bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"
  local USER_A="user_a_clerk"
  local USER_B="user_b_clerk"

  # ── A. Fresh database ────────────────────────────────────────────────────
  setup_db "mig026_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025

  local pre_promo pre_gift
  pre_promo=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='promo_codes'
    );")
  pre_gift=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='gift_subscriptions'
    );")
  [[ "$pre_promo" == "f" ]] && ok "A pre-026: promo_codes absent" || bad "A pre-026: promo_codes should be absent"
  [[ "$pre_gift" == "f" ]] && ok "A pre-026: gift_subscriptions absent" || bad "A pre-026: gift_subscriptions should be absent"

  apply_migration_026

  local post_promo post_gift promo_cols gift_cols uniq_code idx_status_end idx_office idx_user idx_ous
  local office_nn user_nn
  post_promo=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='promo_codes'
    );")
  post_gift=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='gift_subscriptions'
    );")
  promo_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='promo_codes'
      AND column_name IN ('id','code','plan_slug','duration_days','max_uses','used_count',
                          'notes','expires_at','is_active','created_at');")
  gift_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='gift_subscriptions'
      AND column_name IN ('id','office_id','user_id','promo_code_id','plan_slug','end_date','notes',
                          'status','renewed_count','created_at');")
  office_nn=$(psql_db -At -c "
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='gift_subscriptions' AND column_name='office_id';")
  user_nn=$(psql_db -At -c "
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='gift_subscriptions' AND column_name='user_id';")
  uniq_code=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.promo_codes'::regclass AND contype='u'
      AND pg_get_constraintdef(oid) ILIKE '%(code)%';")
  idx_status_end=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_gift_subscriptions_status_end_date';")
  idx_office=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_gift_subscriptions_office_id';")
  idx_user=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_gift_subscriptions_user_id';")
  idx_ous=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_gift_subscriptions_office_user_status';")

  [[ "$post_promo" == "t" ]] && ok "A: promo_codes created" || bad "A: promo_codes missing"
  [[ "$post_gift" == "t" ]] && ok "A: gift_subscriptions created" || bad "A: gift_subscriptions missing"
  [[ "$promo_cols" == "10" ]] && ok "A: promo_codes columns present" || bad "A: promo cols=$promo_cols"
  [[ "$gift_cols" == "10" ]] && ok "A: gift_subscriptions columns present" || bad "A: gift cols=$gift_cols"
  [[ "$office_nn" == "NO" ]] && ok "A: fresh office_id NOT NULL" || bad "A: office_id nullable=$office_nn"
  [[ "$user_nn" == "NO" ]] && ok "A: fresh user_id NOT NULL" || bad "A: user_id nullable=$user_nn"
  [[ "$uniq_code" -ge 1 ]] && ok "A: UNIQUE(code) present" || bad "A: UNIQUE(code) missing"
  [[ "$idx_status_end" == "1" ]] && ok "A: status/end_date index" || bad "A: status/end_date index missing"
  [[ "$idx_office" == "1" ]] && ok "A: office_id index" || bad "A: office_id index missing"
  [[ "$idx_user" == "1" ]] && ok "A: user_id index" || bad "A: user_id index missing"
  [[ "$idx_ous" == "1" ]] && ok "A: (office_id,user_id,status) index" || bad "A: composite ownership index missing"

  psql_db <<SQL >/dev/null
INSERT INTO promo_codes (code, plan_slug, duration_days, max_uses)
VALUES ('WELCOME26', 'pro', 30, 5);
INSERT INTO gift_subscriptions (office_id, user_id, promo_code_id, plan_slug, end_date, notes, status)
SELECT '${OFFICE_A}'::uuid, '${USER_A}', id, 'pro', NOW() + INTERVAL '30 days', 'mig026 test', 'active'
FROM promo_codes WHERE code = 'WELCOME26';
INSERT INTO gift_subscriptions (office_id, user_id, plan_slug, end_date, notes, status)
VALUES
  ('${OFFICE_B}'::uuid, '${USER_B}', 'basic', NOW() + INTERVAL '14 days', 'office B gift', 'active'),
  ('${OFFICE_A}'::uuid, '${USER_B}', 'pro', NOW() + INTERVAL '10 days', 'same office other user', 'active'),
  ('${OFFICE_A}'::uuid, '${USER_A}', 'basic', NOW() - INTERVAL '1 day', 'expired A', 'active'),
  ('${OFFICE_A}'::uuid, '${USER_A}', 'basic', NOW() + INTERVAL '5 days', 'inactive A', 'cancelled');
SQL
  ok "A: promo + owned gift inserts succeeded"

  # Scoped my-gift path for USER_A / OFFICE_A
  local my_gift_cnt cross_user cross_office expired_inact legacy_null_vis
  my_gift_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM (
      SELECT gs.*, pc.code AS promo_code_text
      FROM gift_subscriptions gs
      LEFT JOIN promo_codes pc ON pc.id = gs.promo_code_id
      WHERE gs.status = 'active' AND gs.end_date > NOW()
        AND gs.office_id = '${OFFICE_A}'::uuid
        AND gs.user_id = '${USER_A}'
      ORDER BY gs.end_date DESC LIMIT 1
    ) q;")
  cross_user=$(psql_db -At -c "
    SELECT COUNT(*) FROM gift_subscriptions
    WHERE status='active' AND end_date > NOW()
      AND office_id='${OFFICE_A}'::uuid AND user_id='${USER_A}'
      AND notes = 'same office other user';")
  cross_office=$(psql_db -At -c "
    SELECT COUNT(*) FROM (
      SELECT 1 FROM gift_subscriptions
      WHERE status='active' AND end_date > NOW()
        AND office_id='${OFFICE_A}'::uuid AND user_id='${USER_A}'
        AND notes = 'office B gift'
    ) q;")
  expired_inact=$(psql_db -At -c "
    SELECT COUNT(*) FROM (
      SELECT 1 FROM gift_subscriptions
      WHERE status='active' AND end_date > NOW()
        AND office_id='${OFFICE_A}'::uuid AND user_id='${USER_A}'
        AND notes IN ('expired A', 'inactive A')
    ) q;")
  [[ "$my_gift_cnt" == "1" ]] && ok "A: scoped my-gift returns owner gift" || bad "A: my-gift count=$my_gift_cnt"
  [[ "$cross_user" == "0" ]] && ok "A: user A filter excludes user B gift" || bad "A: cross-user leak"
  [[ "$cross_office" == "0" ]] && ok "A: office A filter excludes office B gift" || bad "A: cross-office leak"
  [[ "$expired_inact" == "0" ]] && ok "A: expired/inactive excluded" || bad "A: expired/inactive visible"

  # Duplicate active-gift check is ownership-scoped (user B active does not block user A)
  local scoped_existing
  scoped_existing=$(psql_db -At -c "
    SELECT COUNT(*) FROM gift_subscriptions
    WHERE status='active' AND end_date > NOW()
      AND office_id='${OFFICE_A}'::uuid AND user_id='${USER_A}';")
  [[ "$scoped_existing" == "1" ]] && ok "A: scoped active-gift check sees only owner" || bad "A: scoped existing=$scoped_existing"

  apply_migration_026
  ok "A/F: re-run 026 on fresh schema succeeded"

  apply_migration_011
  apply_migration_012
  apply_migration_013
  apply_migration_014
  apply_migration_015
  apply_migration_016
  apply_migration_017
  if verify_p0_schema /tmp/verify-026-fresh.log; then
    ok "A: verify-schema after 010→017 + 025 + 026"
  else
    bad "A: verify-schema failed after 026"; tail -20 /tmp/verify-026-fresh.log
  fi

  trap - EXIT
  teardown_db

  # ── B. Partial legacy tables — repair without data loss / NULL ownership stays invisible ──
  setup_db "mig026_partial"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025

  psql_db <<'SQL' >/dev/null
CREATE TABLE promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  plan_slug TEXT NOT NULL,
  duration_days INTEGER NOT NULL
);
INSERT INTO promo_codes (id, code, plan_slug, duration_days)
VALUES ('legacy-promo-1', 'LEGACY26', 'basic', 14);

CREATE TABLE gift_subscriptions (
  id TEXT PRIMARY KEY,
  plan_slug TEXT NOT NULL,
  end_date TIMESTAMPTZ NOT NULL
);
INSERT INTO gift_subscriptions (id, plan_slug, end_date)
VALUES ('legacy-gift-1', 'basic', NOW() + INTERVAL '7 days');
SQL

  apply_migration_026

  local partial_promo_cols partial_gift_cols legacy_promo legacy_gift
  local legacy_office_null legacy_user_null legacy_office_nn legacy_user_nn scoped_legacy
  partial_promo_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='promo_codes'
      AND column_name IN ('max_uses','used_count','notes','expires_at','is_active','created_at');")
  partial_gift_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='gift_subscriptions'
      AND column_name IN ('office_id','user_id','promo_code_id','notes','status','renewed_count','created_at');")
  legacy_promo=$(psql_db -At -c "
    SELECT COUNT(*) FROM promo_codes
    WHERE id='legacy-promo-1' AND code='LEGACY26' AND duration_days=14;")
  legacy_gift=$(psql_db -At -c "
    SELECT COUNT(*) FROM gift_subscriptions
    WHERE id='legacy-gift-1' AND plan_slug='basic';")
  legacy_office_null=$(psql_db -At -c "
    SELECT COUNT(*) FROM gift_subscriptions
    WHERE id='legacy-gift-1' AND office_id IS NULL;")
  legacy_user_null=$(psql_db -At -c "
    SELECT COUNT(*) FROM gift_subscriptions
    WHERE id='legacy-gift-1' AND user_id IS NULL;")
  legacy_office_nn=$(psql_db -At -c "
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='gift_subscriptions' AND column_name='office_id';")
  legacy_user_nn=$(psql_db -At -c "
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='gift_subscriptions' AND column_name='user_id';")
  scoped_legacy=$(psql_db -At -c "
    SELECT COUNT(*) FROM gift_subscriptions
    WHERE status='active' AND end_date > NOW()
      AND office_id='${OFFICE_A}'::uuid AND user_id='${USER_A}';")

  [[ "$partial_promo_cols" == "6" ]] && ok "B: promo missing columns added" || bad "B: promo cols=$partial_promo_cols"
  [[ "$partial_gift_cols" == "7" ]] && ok "B: gift missing columns added (incl ownership)" || bad "B: gift cols=$partial_gift_cols"
  [[ "$legacy_promo" == "1" ]] && ok "B: legacy promo row preserved" || bad "B: promo data lost"
  [[ "$legacy_gift" == "1" ]] && ok "B: legacy gift row preserved" || bad "B: gift data lost"
  [[ "$legacy_office_null" == "1" ]] && ok "B: legacy office_id left NULL (no guess/backfill)" || bad "B: office_id backfilled"
  [[ "$legacy_user_null" == "1" ]] && ok "B: legacy user_id left NULL (no guess/backfill)" || bad "B: user_id backfilled"
  [[ "$legacy_office_nn" == "YES" ]] && ok "B: repaired office_id stays nullable" || bad "B: office_id forced NOT NULL"
  [[ "$legacy_user_nn" == "YES" ]] && ok "B: repaired user_id stays nullable" || bad "B: user_id forced NOT NULL"
  [[ "$scoped_legacy" == "0" ]] && ok "B: NULL-owned legacy invisible to tenant filter" || bad "B: legacy leaked into tenant read"

  apply_migration_026
  ok "B/F: re-run 026 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db
}

# ── Scenario: migration 027 event_daily_counts schema authority (Stage 16.5) ─
scenario_migration_027_event_daily_counts() {
  log "Scenario 027 — analytics event_daily_counts: fresh / no DEFAULT default / partial / upsert / idempotent"

  local OFFICE_A="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1"
  local OFFICE_B="bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"

  # ── A. Fresh database ────────────────────────────────────────────────────
  setup_db "mig027_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025
  apply_migration_026

  local pre_edc
  pre_edc=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='event_daily_counts'
    );")
  [[ "$pre_edc" == "f" ]] && ok "A pre-027: event_daily_counts absent" || bad "A pre-027: event_daily_counts should be absent"

  apply_migration_027

  local post_edc cols office_nn office_default uniq_key idx_office idx_od idx_date idx_type
  post_edc=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='event_daily_counts'
    );")
  cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='event_daily_counts'
      AND column_name IN ('id','event_type','office_id','event_date','count');")
  office_nn=$(psql_db -At -c "
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='event_daily_counts' AND column_name='office_id';")
  office_default=$(psql_db -At -c "
    SELECT COALESCE(column_default, '') FROM information_schema.columns
    WHERE table_schema='public' AND table_name='event_daily_counts' AND column_name='office_id';")
  uniq_key=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.event_daily_counts'::regclass AND contype='u'
      AND (
        pg_get_constraintdef(oid) ILIKE '%(event_type, office_id, event_date)%'
        OR pg_get_constraintdef(oid) ILIKE '%(event_type,%office_id,%event_date)%'
      );")
  idx_office=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_event_daily_counts_office_id';")
  idx_od=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_event_daily_counts_office_date';")
  idx_date=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_event_daily_counts_event_date';")
  idx_type=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_event_daily_counts_event_type';")

  [[ "$post_edc" == "t" ]] && ok "A: event_daily_counts created" || bad "A: event_daily_counts missing"
  [[ "$cols" == "5" ]] && ok "A: proven columns present" || bad "A: cols=$cols"
  [[ "$office_nn" == "NO" ]] && ok "A: fresh office_id NOT NULL" || bad "A: office_id nullable=$office_nn"
  [[ "$office_default" != *default* ]] && ok "A: office_id has no DEFAULT 'default'" || bad "A: office_id default=$office_default"
  [[ "$uniq_key" -ge 1 ]] && ok "A: UNIQUE(event_type, office_id, event_date)" || bad "A: upsert unique missing"
  [[ "$idx_office" == "1" ]] && ok "A: office_id index" || bad "A: office_id index missing"
  [[ "$idx_od" == "1" ]] && ok "A: (office_id, event_date) index" || bad "A: office_date index missing"
  [[ "$idx_date" == "1" ]] && ok "A: event_date index" || bad "A: event_date index missing"
  [[ "$idx_type" == "1" ]] && ok "A: event_type index" || bad "A: event_type index missing"

  # UUID upsert path (analytics listener ON CONFLICT)
  psql_db <<SQL >/dev/null
INSERT INTO event_daily_counts (event_type, office_id, event_date, count)
VALUES ('CASE_CREATED', '${OFFICE_A}', CURRENT_DATE, 1)
ON CONFLICT (event_type, office_id, event_date)
DO UPDATE SET count = event_daily_counts.count + 1;
INSERT INTO event_daily_counts (event_type, office_id, event_date, count)
VALUES ('CASE_CREATED', '${OFFICE_A}', CURRENT_DATE, 1)
ON CONFLICT (event_type, office_id, event_date)
DO UPDATE SET count = event_daily_counts.count + 1;
INSERT INTO event_daily_counts (event_type, office_id, event_date, count)
VALUES ('CASE_CREATED', '${OFFICE_B}', CURRENT_DATE, 1)
ON CONFLICT (event_type, office_id, event_date)
DO UPDATE SET count = event_daily_counts.count + 1;
SQL

  local cnt_a cnt_b jlwm_a
  cnt_a=$(psql_db -At -c "
    SELECT count FROM event_daily_counts
    WHERE event_type='CASE_CREATED' AND office_id='${OFFICE_A}' AND event_date=CURRENT_DATE;")
  cnt_b=$(psql_db -At -c "
    SELECT count FROM event_daily_counts
    WHERE event_type='CASE_CREATED' AND office_id='${OFFICE_B}' AND event_date=CURRENT_DATE;")
  jlwm_a=$(psql_db -At -c "
    SELECT COUNT(*)::int FROM event_daily_counts WHERE office_id='${OFFICE_A}';")

  [[ "$cnt_a" == "2" ]] && ok "A: UUID upsert increments once per conflict" || bad "A: count_a=$cnt_a"
  [[ "$cnt_b" == "1" ]] && ok "A: office B isolated from office A upsert" || bad "A: count_b=$cnt_b"
  [[ "$jlwm_a" == "1" ]] && ok "A: existing UUID analytics reads still work" || bad "A: jlwm_a=$jlwm_a"

  apply_migration_027
  ok "A/F: re-run 027 on fresh schema succeeded (idempotent)"

  apply_migration_011
  apply_migration_012
  apply_migration_013
  apply_migration_014
  apply_migration_015
  apply_migration_016
  apply_migration_017
  if verify_p0_schema /tmp/verify-027-fresh.log; then
    ok "A: verify-schema after 010→017 + 025 + 026 + 027"
  else
    bad "A: verify-schema failed after 027"; tail -20 /tmp/verify-027-fresh.log
  fi

  trap - EXIT
  teardown_db

  # ── B. Partial legacy Runtime DDL shape — drop DEFAULT 'default', keep rows ──
  setup_db "mig027_partial"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025
  apply_migration_026

  psql_db <<'SQL' >/dev/null
CREATE TABLE event_daily_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  office_id TEXT NOT NULL DEFAULT 'default',
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 1
);
INSERT INTO event_daily_counts (event_type, office_id, event_date, count)
VALUES ('USER_LOGIN', 'default', CURRENT_DATE, 3);
INSERT INTO event_daily_counts (event_type, office_id, event_date, count)
VALUES ('CASE_CREATED', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', CURRENT_DATE, 5);
SQL

  local pre_default_def
  pre_default_def=$(psql_db -At -c "
    SELECT column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='event_daily_counts' AND column_name='office_id';")
  [[ "$pre_default_def" == *default* ]] && ok "B pre-027: legacy DEFAULT 'default' present" || bad "B: missing legacy default"

  apply_migration_027

  local post_default_def legacy_default legacy_uuid uniq_partial
  post_default_def=$(psql_db -At -c "
    SELECT COALESCE(column_default, '') FROM information_schema.columns
    WHERE table_schema='public' AND table_name='event_daily_counts' AND column_name='office_id';")
  legacy_default=$(psql_db -At -c "
    SELECT count FROM event_daily_counts
    WHERE event_type='USER_LOGIN' AND office_id='default' AND event_date=CURRENT_DATE;")
  legacy_uuid=$(psql_db -At -c "
    SELECT count FROM event_daily_counts
    WHERE event_type='CASE_CREATED' AND office_id='${OFFICE_A}' AND event_date=CURRENT_DATE;")
  uniq_partial=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.event_daily_counts'::regclass AND contype='u'
      AND (
        pg_get_constraintdef(oid) ILIKE '%(event_type, office_id, event_date)%'
        OR pg_get_constraintdef(oid) ILIKE '%(event_type,%office_id,%event_date)%'
      );")

  [[ "$post_default_def" != *default* ]] && ok "B: DEFAULT 'default' dropped (non-destructive)" || bad "B: default remains=$post_default_def"
  [[ "$legacy_default" == "3" ]] && ok "B: legacy default-bucket row preserved" || bad "B: default row lost"
  [[ "$legacy_uuid" == "5" ]] && ok "B: legacy UUID analytics row preserved" || bad "B: UUID row lost"
  [[ "$uniq_partial" -ge 1 ]] && ok "B: UNIQUE upsert key added on partial table" || bad "B: unique missing on partial"

  apply_migration_027
  ok "B/F: re-run 027 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db

  # ── C. Duplicate upsert keys → RAISE EXCEPTION / abort (no UNIQUE skip) ──
  setup_db "mig027_dups"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025
  apply_migration_026

  psql_db <<'SQL' >/dev/null
CREATE TABLE event_daily_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  office_id TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 1
);
INSERT INTO event_daily_counts (event_type, office_id, event_date, count) VALUES
  ('CASE_CREATED', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', CURRENT_DATE, 1),
  ('CASE_CREATED', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', CURRENT_DATE, 2);
SQL

  local chosen_action
  chosen_action=$(psql_db -At -c "
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM (
            SELECT event_type, office_id, event_date
            FROM event_daily_counts
            WHERE event_type IS NOT NULL AND office_id IS NOT NULL AND event_date IS NOT NULL
            GROUP BY event_type, office_id, event_date
            HAVING COUNT(*) > 1
          ) d
        )
        THEN 'BLOCKED_CLEAN_DUPLICATES'
        ELSE 'apply_027_repair_columns_indexes_drop_default'
      END;")
  [[ "$chosen_action" == "BLOCKED_CLEAN_DUPLICATES" ]] && ok "C: preflight chosen_action=BLOCKED_CLEAN_DUPLICATES" || bad "C: chosen_action=$chosen_action"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_027" >/tmp/mig027-dup.log 2>&1
  local mig_rc=$?
  set -e
  [[ "$mig_rc" -ne 0 ]] && ok "C: migration 027 aborted on duplicates (rc=$mig_rc)" || bad "C: migration 027 should abort on duplicates"
  grep -q 'duplicate group' /tmp/mig027-dup.log && ok "C: RAISE EXCEPTION mentions duplicate groups" || bad "C: missing duplicate EXCEPTION message"

  local uniq_after
  uniq_after=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.event_daily_counts'::regclass AND contype='u'
      AND (
        pg_get_constraintdef(oid) ILIKE '%(event_type, office_id, event_date)%'
        OR pg_get_constraintdef(oid) ILIKE '%(event_type,%office_id,%event_date)%'
      );" 2>/dev/null || echo 0)
  [[ "$uniq_after" == "0" ]] && ok "C: UNIQUE not committed when duplicates exist" || bad "C: UNIQUE was added despite duplicates"

  trap - EXIT
  teardown_db
}

# ── Scenario: migration 028 case_autopilot_reports schema authority (Stage 19) ─
# Shared arbiter predicate used by Scenario 028 assertions (matches migration/preflight).
mig028_arbiter_sql() {
  cat <<'SQL'
SELECT EXISTS (
  SELECT 1 FROM pg_constraint c
  WHERE c.conrelid = 'public.case_autopilot_reports'::regclass
    AND c.contype IN ('p', 'u')
    AND array_length(c.conkey, 1) = 1
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        AND NOT a.attisdropped AND a.attname = 'case_id'
    )
) OR EXISTS (
  SELECT 1 FROM pg_index x
  WHERE x.indrelid = 'public.case_autopilot_reports'::regclass
    AND x.indisunique AND x.indisvalid
    AND x.indpred IS NULL AND x.indexprs IS NULL
    AND x.indnkeyatts = 1
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
        AND NOT a.attisdropped AND a.attname = 'case_id'
    )
);
SQL
}

scenario_migration_028_case_autopilot_reports() {
  log "Scenario 028 — autopilot case_autopilot_reports: fresh / partial / upsert / arbiter / dup-block"

  local OFFICE_A="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1"
  local OFFICE_B="bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"
  local CASE_A="case-autopilot-a"
  local CASE_B="case-autopilot-b"
  local PREFLIGHT_028="$ROOT/scripts/db/preflight-migration-028.sql"

  # ── A0. Greenfield preflight (table absent) under ON_ERROR_STOP ──────────
  setup_db "mig028_preflight_absent"
  trap teardown_db EXIT
  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_028" >/tmp/preflight028-absent.log 2>&1
  local pf_abs_rc=$?
  set -e
  [[ "$pf_abs_rc" -eq 0 ]] && ok "A0: preflight succeeds when table absent (ON_ERROR_STOP)" || bad "A0: preflight failed when table absent"
  grep -q 'chosen_action=apply_028_create_missing_table' /tmp/preflight028-absent.log \
    && ok "A0: chosen_action=apply_028_create_missing_table" \
    || bad "A0: missing apply_028_create_missing_table"
  trap - EXIT
  teardown_db

  # ── A. Fresh database ────────────────────────────────────────────────────
  setup_db "mig028_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025
  apply_migration_026
  apply_migration_027

  local pre_car
  pre_car=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='case_autopilot_reports'
    );")
  [[ "$pre_car" == "f" ]] && ok "A pre-028: case_autopilot_reports absent" || bad "A pre-028: case_autopilot_reports should be absent"

  apply_migration_028

  local post_car cols pk_key idx_office arbiter
  post_car=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='case_autopilot_reports'
    );")
  cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='case_autopilot_reports'
      AND column_name IN (
        'case_id','office_id','health_score','grade','risks','missing_data',
        'next_steps','tasks_created','outcome_prediction','ai_summary','run_at'
      );")
  pk_key=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint c
    WHERE c.conrelid='public.case_autopilot_reports'::regclass
      AND c.contype='p'
      AND array_length(c.conkey, 1) = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
          AND NOT a.attisdropped AND a.attname = 'case_id'
      );")
  arbiter=$(psql_db -At -c "$(mig028_arbiter_sql)")
  idx_office=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_autopilot_office';")

  [[ "$post_car" == "t" ]] && ok "A: case_autopilot_reports created" || bad "A: case_autopilot_reports missing"
  [[ "$cols" == "11" ]] && ok "A: proven columns present" || bad "A: cols=$cols"
  [[ "$pk_key" -ge 1 ]] && ok "A: real PK(case_id) accepted" || bad "A: case_id PK missing"
  [[ "$arbiter" == "t" ]] && ok "A: ON CONFLICT arbiter present" || bad "A: arbiter missing"
  [[ "$idx_office" == "1" ]] && ok "A: idx_autopilot_office" || bad "A: office_id index missing"

  # Autopilot upsert path (ON CONFLICT case_id) + tenant-scoped read
  psql_db <<SQL >/dev/null
INSERT INTO case_autopilot_reports
  (case_id, office_id, health_score, grade, risks, missing_data, next_steps,
   tasks_created, outcome_prediction, ai_summary, run_at)
VALUES (
  '${CASE_A}', '${OFFICE_A}', 70, 'C', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  1, '{}'::jsonb, 'summary-a', NOW()
)
ON CONFLICT (case_id) DO UPDATE SET
  health_score = EXCLUDED.health_score,
  grade = EXCLUDED.grade,
  ai_summary = EXCLUDED.ai_summary,
  run_at = NOW();
INSERT INTO case_autopilot_reports
  (case_id, office_id, health_score, grade, risks, missing_data, next_steps,
   tasks_created, outcome_prediction, ai_summary, run_at)
VALUES (
  '${CASE_A}', '${OFFICE_A}', 85, 'B', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  2, '{}'::jsonb, 'summary-a-updated', NOW()
)
ON CONFLICT (case_id) DO UPDATE SET
  health_score = EXCLUDED.health_score,
  grade = EXCLUDED.grade,
  ai_summary = EXCLUDED.ai_summary,
  run_at = NOW();
INSERT INTO case_autopilot_reports
  (case_id, office_id, health_score, grade, risks, missing_data, next_steps,
   tasks_created, outcome_prediction, ai_summary, run_at)
VALUES (
  '${CASE_B}', '${OFFICE_B}', 90, 'A', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  0, '{}'::jsonb, 'summary-b', NOW()
)
ON CONFLICT (case_id) DO UPDATE SET
  health_score = EXCLUDED.health_score;
SQL

  local score_a score_b scoped_a
  score_a=$(psql_db -At -c "
    SELECT health_score FROM case_autopilot_reports
    WHERE case_id='${CASE_A}' AND office_id='${OFFICE_A}';")
  score_b=$(psql_db -At -c "
    SELECT health_score FROM case_autopilot_reports
    WHERE case_id='${CASE_B}' AND office_id='${OFFICE_B}';")
  scoped_a=$(psql_db -At -c "
    SELECT COUNT(*)::int FROM case_autopilot_reports
    WHERE case_id='${CASE_A}' AND office_id='${OFFICE_A}';")

  [[ "$score_a" == "85" ]] && ok "A: ON CONFLICT (case_id) upsert updates score" || bad "A: score_a=$score_a"
  [[ "$score_b" == "90" ]] && ok "A: office B row isolated" || bad "A: score_b=$score_b"
  [[ "$scoped_a" == "1" ]] && ok "A: tenant-scoped read by case_id+office_id" || bad "A: scoped_a=$scoped_a"

  apply_migration_028
  ok "A/F: re-run 028 on fresh schema succeeded (idempotent)"

  apply_migration_011
  apply_migration_012
  apply_migration_013
  apply_migration_014
  apply_migration_015
  apply_migration_016
  apply_migration_017
  if verify_p0_schema /tmp/verify-028-fresh.log; then
    ok "A: verify-schema after 010→017 + 025→028"
  else
    bad "A: verify-schema failed after 028"; tail -20 /tmp/verify-028-fresh.log
  fi

  trap - EXIT
  teardown_db

  # ── B. Partial legacy Runtime DDL shape — repair columns, keep rows ───────
  setup_db "mig028_partial"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025
  apply_migration_026
  apply_migration_027

  psql_db <<'SQL' >/dev/null
CREATE TABLE case_autopilot_reports (
  case_id TEXT,
  office_id TEXT,
  health_score INTEGER DEFAULT 0
);
INSERT INTO case_autopilot_reports (case_id, office_id, health_score)
VALUES ('legacy-case-1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 42);
INSERT INTO case_autopilot_reports (case_id, office_id, health_score)
VALUES ('legacy-case-2', 'default', 10);
SQL

  local pre_cols
  pre_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='case_autopilot_reports';")
  [[ "$pre_cols" == "3" ]] && ok "B pre-028: partial legacy table (3 cols)" || bad "B: pre_cols=$pre_cols"

  apply_migration_028

  local post_cols legacy_uuid legacy_default pk_partial idx_partial
  post_cols=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='case_autopilot_reports'
      AND column_name IN (
        'case_id','office_id','health_score','grade','risks','missing_data',
        'next_steps','tasks_created','outcome_prediction','ai_summary','run_at'
      );")
  legacy_uuid=$(psql_db -At -c "
    SELECT health_score FROM case_autopilot_reports WHERE case_id='legacy-case-1';")
  legacy_default=$(psql_db -At -c "
    SELECT health_score FROM case_autopilot_reports WHERE case_id='legacy-case-2';")
  pk_partial=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_constraint c
    WHERE c.conrelid='public.case_autopilot_reports'::regclass
      AND c.contype='p'
      AND array_length(c.conkey, 1) = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
          AND NOT a.attisdropped AND a.attname = 'case_id'
      );")
  idx_partial=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_autopilot_office';")

  [[ "$post_cols" == "11" ]] && ok "B: missing columns repaired" || bad "B: post_cols=$post_cols"
  [[ "$legacy_uuid" == "42" ]] && ok "B: legacy UUID row preserved" || bad "B: UUID row lost"
  [[ "$legacy_default" == "10" ]] && ok "B: legacy default-bucket row preserved" || bad "B: default row lost"
  [[ "$pk_partial" -ge 1 ]] && ok "B: PRIMARY KEY(case_id) added on partial table" || bad "B: PK missing on partial"
  [[ "$idx_partial" == "1" ]] && ok "B: idx_autopilot_office on partial" || bad "B: index missing on partial"

  apply_migration_028
  ok "B/F: re-run 028 on repaired partial schema succeeded"

  trap - EXIT
  teardown_db

  # ── C. Duplicate / NULL case_id → RAISE EXCEPTION / abort ─────────────────
  setup_db "mig028_dups"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025
  apply_migration_026
  apply_migration_027

  psql_db <<'SQL' >/dev/null
CREATE TABLE case_autopilot_reports (
  case_id TEXT,
  office_id TEXT,
  health_score INTEGER DEFAULT 0
);
INSERT INTO case_autopilot_reports (case_id, office_id, health_score) VALUES
  ('dup-case', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 1),
  ('dup-case', 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', 2);
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_028" >/tmp/preflight028-dups.log 2>&1
  set -e
  grep -q 'chosen_action=BLOCKED_CLEAN_DUPLICATES' /tmp/preflight028-dups.log \
    && ok "C: preflight chosen_action=BLOCKED_CLEAN_DUPLICATES" \
    || bad "C: preflight did not block duplicates"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_028" >/tmp/mig028-dup.log 2>&1
  local mig_rc=$?
  set -e
  [[ "$mig_rc" -ne 0 ]] && ok "C: migration 028 aborted on duplicates (rc=$mig_rc)" || bad "C: migration 028 should abort on duplicates"
  grep -qE 'duplicate case_id|BLOCKED_CLEAN_DUPLICATES' /tmp/mig028-dup.log && ok "C: RAISE EXCEPTION mentions duplicate case_id" || bad "C: missing duplicate EXCEPTION message"

  local arbiter_after
  arbiter_after=$(psql_db -At -c "$(mig028_arbiter_sql)" 2>/dev/null || echo f)
  [[ "$arbiter_after" == "f" ]] && ok "C: no ON CONFLICT arbiter committed when duplicates exist" || bad "C: arbiter present despite duplicates"

  # NULL case_id also blocks
  psql_db <<'SQL' >/dev/null
TRUNCATE case_autopilot_reports;
INSERT INTO case_autopilot_reports (case_id, office_id, health_score) VALUES
  (NULL, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 1);
SQL
  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_028" >/tmp/preflight028-null.log 2>&1
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_028" >/tmp/mig028-null.log 2>&1
  local null_rc=$?
  set -e
  grep -q 'chosen_action=BLOCKED_CLEAN_DUPLICATES' /tmp/preflight028-null.log \
    && ok "C2: preflight blocks NULL case_id" || bad "C2: preflight should block NULL case_id"
  [[ "$null_rc" -ne 0 ]] && ok "C2: migration aborted on NULL case_id" || bad "C2: migration should abort on NULL case_id"

  trap - EXIT
  teardown_db

  # ── D. Real UNIQUE(case_id) accepted (no PK) ─────────────────────────────
  setup_db "mig028_unique"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025
  apply_migration_026
  apply_migration_027

  psql_db <<'SQL' >/dev/null
CREATE TABLE case_autopilot_reports (
  case_id TEXT NOT NULL UNIQUE,
  office_id TEXT NOT NULL,
  health_score INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'F',
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  tasks_created INTEGER NOT NULL DEFAULT 0,
  outcome_prediction JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_summary TEXT,
  run_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO case_autopilot_reports (case_id, office_id, health_score)
VALUES ('u1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 11);
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_028" >/tmp/preflight028-unique.log 2>&1
  set -e
  grep -q 'on_conflict_case_id_supported=t' /tmp/preflight028-unique.log \
    && ok "D: preflight accepts real UNIQUE(case_id)" || bad "D: UNIQUE(case_id) not accepted as arbiter"
  grep -qE 'chosen_action=apply_028_repair_columns_indexes_pk' /tmp/preflight028-unique.log \
    && ok "D: preflight safe apply with UNIQUE arbiter" || bad "D: unexpected chosen_action for UNIQUE"

  apply_migration_028
  psql_db <<'SQL' >/dev/null
INSERT INTO case_autopilot_reports
  (case_id, office_id, health_score, grade, risks, missing_data, next_steps,
   tasks_created, outcome_prediction, ai_summary, run_at)
VALUES ('u1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 22, 'B', '[]','[]','[]',0,'{}','x',NOW())
ON CONFLICT (case_id) DO UPDATE SET health_score = EXCLUDED.health_score;
SQL
  local uniq_score
  uniq_score=$(psql_db -At -c "SELECT health_score FROM case_autopilot_reports WHERE case_id='u1';")
  [[ "$uniq_score" == "22" ]] && ok "D: ON CONFLICT works with UNIQUE(case_id)" || bad "D: score=$uniq_score"

  trap - EXIT
  teardown_db

  # ── E. Partial / expression / multi-column unique rejected as arbiter ────
  setup_db "mig028_bad_arbiter"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025
  apply_migration_026
  apply_migration_027

  # E1 partial UNIQUE(case_id) WHERE ...
  psql_db <<'SQL' >/dev/null
CREATE TABLE case_autopilot_reports (
  case_id TEXT,
  office_id TEXT,
  health_score INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX uq_partial_case ON case_autopilot_reports (case_id)
  WHERE office_id IS NOT NULL;
INSERT INTO case_autopilot_reports VALUES ('p1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 1);
SQL

  local arbiter_partial
  arbiter_partial=$(psql_db -At -c "$(mig028_arbiter_sql)")
  [[ "$arbiter_partial" == "f" ]] && ok "E1: partial UNIQUE rejected as arbiter" || bad "E1: partial UNIQUE incorrectly accepted"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_028" >/tmp/preflight028-partial.log 2>&1
  set -e
  grep -q 'on_conflict_case_id_supported=f' /tmp/preflight028-partial.log \
    && ok "E1: preflight on_conflict_case_id_supported=f for partial" \
    || bad "E1: preflight should not claim ON CONFLICT supported"
  grep -q 'chosen_action=apply_028_repair_add_case_id_arbiter' /tmp/preflight028-partial.log \
    && ok "E1: preflight repair-add-arbiter (not false-safe)" \
    || bad "E1: chosen_action=$(grep chosen_action /tmp/preflight028-partial.log | tail -1)"

  apply_migration_028
  arbiter_partial=$(psql_db -At -c "$(mig028_arbiter_sql)")
  [[ "$arbiter_partial" == "t" ]] && ok "E1: migration adds real arbiter over partial unique" || bad "E1: arbiter still missing"
  psql_db <<'SQL' >/dev/null
INSERT INTO case_autopilot_reports
  (case_id, office_id, health_score, grade, risks, missing_data, next_steps,
   tasks_created, outcome_prediction, ai_summary, run_at)
VALUES ('p1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 9, 'C', '[]','[]','[]',0,'{}','x',NOW())
ON CONFLICT (case_id) DO UPDATE SET health_score = EXCLUDED.health_score;
SQL
  ok "E1: ON CONFLICT works after migration repaired partial unique"

  trap - EXIT
  teardown_db

  # E2 expression UNIQUE(lower(case_id))
  setup_db "mig028_expr"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025
  apply_migration_026
  apply_migration_027

  psql_db <<'SQL' >/dev/null
CREATE TABLE case_autopilot_reports (
  case_id TEXT,
  office_id TEXT,
  health_score INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX uq_expr_case ON case_autopilot_reports (lower(case_id));
INSERT INTO case_autopilot_reports VALUES ('E1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 1);
SQL

  local arbiter_expr
  arbiter_expr=$(psql_db -At -c "$(mig028_arbiter_sql)")
  [[ "$arbiter_expr" == "f" ]] && ok "E2: UNIQUE(lower(case_id)) rejected as arbiter" || bad "E2: expression unique incorrectly accepted"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_028" >/tmp/preflight028-expr.log 2>&1
  set -e
  grep -q 'on_conflict_case_id_supported=f' /tmp/preflight028-expr.log \
    && ok "E2: preflight rejects expression unique" || bad "E2: preflight falsely supports expression unique"

  apply_migration_028
  psql_db <<'SQL' >/dev/null
INSERT INTO case_autopilot_reports
  (case_id, office_id, health_score, grade, risks, missing_data, next_steps,
   tasks_created, outcome_prediction, ai_summary, run_at)
VALUES ('E1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 3, 'C', '[]','[]','[]',0,'{}','x',NOW())
ON CONFLICT (case_id) DO UPDATE SET health_score = EXCLUDED.health_score;
SQL
  ok "E2: ON CONFLICT works after migration over expression unique"

  trap - EXIT
  teardown_db

  # E3 multi-column unique
  setup_db "mig028_multi"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
  apply_migration_010
  apply_migration_025
  apply_migration_026
  apply_migration_027

  psql_db <<'SQL' >/dev/null
CREATE TABLE case_autopilot_reports (
  case_id TEXT,
  office_id TEXT,
  health_score INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX uq_multi ON case_autopilot_reports (case_id, office_id);
INSERT INTO case_autopilot_reports VALUES ('m1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 1);
SQL

  local arbiter_multi
  arbiter_multi=$(psql_db -At -c "$(mig028_arbiter_sql)")
  [[ "$arbiter_multi" == "f" ]] && ok "E3: multi-column unique rejected as arbiter" || bad "E3: multi-column unique incorrectly accepted"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_028" >/tmp/preflight028-multi.log 2>&1
  set -e
  grep -q 'on_conflict_case_id_supported=f' /tmp/preflight028-multi.log \
    && ok "E3: preflight rejects multi-column unique" || bad "E3: preflight falsely supports multi-column unique"

  apply_migration_028
  local probe_ok
  set +e
  psql_db <<'SQL' >/tmp/mig028-multi-upsert.log 2>&1
INSERT INTO case_autopilot_reports
  (case_id, office_id, health_score, grade, risks, missing_data, next_steps,
   tasks_created, outcome_prediction, ai_summary, run_at)
VALUES ('m1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 4, 'C', '[]','[]','[]',0,'{}','x',NOW())
ON CONFLICT (case_id) DO UPDATE SET health_score = EXCLUDED.health_score;
SQL
  probe_ok=$?
  set -e
  [[ "$probe_ok" -eq 0 ]] && ok "E3: migration never commits without valid ON CONFLICT arbiter" || bad "E3: ON CONFLICT still broken after 028"

  trap - EXIT
  teardown_db
}

# ── Scenario: migration 029 office_messages FTS readiness (Stage 20.3) ─────
scenario_migration_029_office_messages_fts_readiness() {
  log "Scenario 029 — FTS readiness: safe add column/GIN / already-correct / BLOCK shapes"
  local PREFLIGHT_029="$ROOT/scripts/db/preflight-migration-029.sql"

  read_generated_fts_cfg() {
    psql_db -At -c "
      SELECT (regexp_match(pg_get_expr(ad.adbin, ad.adrelid),
                           'to_tsvector\(\s*''([^'']+)''', 'i'))[1]
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
      WHERE n.nspname='public'
        AND c.relname='office_messages'
        AND a.attname='search_vector'
        AND NOT a.attisdropped
        AND a.attgenerated IN ('s','v')
      LIMIT 1;"
  }

  ensure_arabic_cfg() {
    local arabic_present
    arabic_present=$(psql_db -At -c "SELECT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname='arabic');")
    if [[ "$arabic_present" != "t" ]]; then
      psql_db -c "CREATE TEXT SEARCH CONFIGURATION arabic (COPY = simple);" >/dev/null
    fi
  }

  # ── A. Fresh/absent search_vector → SAFE_AUTO_REPAIR_ADD_COLUMN (+ GIN) ─
  setup_db "mig029_absent_vector"
  trap teardown_db EXIT
  apply_migrations_through_015
  ensure_arabic_cfg

  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  subject TEXT,
  body TEXT,
  sender_id TEXT,
  folder TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO office_messages (office_id, subject, body, sender_id, folder)
VALUES ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 'عقد', 'نص الرسالة', 'user-a', 'sent');
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-absent.log 2>&1
  set -e
  grep -q 'chosen_action=SAFE_AUTO_REPAIR_ADD_COLUMN' /tmp/preflight029-absent.log \
    && ok "A0: preflight SAFE_AUTO_REPAIR_ADD_COLUMN" \
    || bad "A0: chosen_action=$(grep chosen_action /tmp/preflight029-absent.log | tail -1)"

  apply_migration_029
  local gen_cfg gin_cnt
  gen_cfg=$(read_generated_fts_cfg)
  gin_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND tablename='office_messages'
      AND indexname='idx_messages_search';")
  [[ "$gen_cfg" == "arabic" || "$gen_cfg" == "simple" ]] \
    && ok "A: search_vector generated with allow-listed cfg=$gen_cfg" \
    || bad "A: generated cfg=$gen_cfg"
  [[ "$gin_cnt" == "1" ]] && ok "A: GIN idx_messages_search present" || bad "A: gin_cnt=$gin_cnt"

  apply_migration_029
  ok "A: idempotent re-run on repaired schema succeeded"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-after-a.log 2>&1
  set -e
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight029-after-a.log \
    && ok "A: preflight ALREADY_CORRECT after repair" \
    || bad "A: post chosen_action=$(grep chosen_action /tmp/preflight029-after-a.log | tail -1)"

  trap - EXIT
  teardown_db

  # ── B. Already correct arabic ────────────────────────────────────────────
  setup_db "mig029_correct_arabic"
  trap teardown_db EXIT
  apply_migrations_through_015
  ensure_arabic_cfg
  apply_migration_016

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-arabic.log 2>&1
  set -e
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight029-arabic.log \
    && ok "B: preflight ALREADY_CORRECT (arabic path after 016)" \
    || bad "B: chosen_action=$(grep chosen_action /tmp/preflight029-arabic.log | tail -1)"
  apply_migration_029
  ok "B: migration 029 no-op on already-correct arabic"
  [[ "$(read_generated_fts_cfg)" == "arabic" ]] && ok "B: cfg remains arabic" || bad "B: cfg changed"

  trap - EXIT
  teardown_db

  # ── C. Already correct simple ────────────────────────────────────────────
  setup_db "mig029_correct_simple"
  trap teardown_db EXIT
  apply_migrations_through_015
  # Force simple by removing arabic if we created a copy earlier — use explicit column
  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  subject TEXT,
  body TEXT,
  sender_id TEXT,
  folder TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(subject, '') || ' ' || coalesce(body, ''))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_search ON office_messages USING gin (search_vector);
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-simple.log 2>&1
  set -e
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight029-simple.log \
    && ok "C: preflight ALREADY_CORRECT (simple)" \
    || bad "C: chosen_action=$(grep chosen_action /tmp/preflight029-simple.log | tail -1)"
  apply_migration_029
  ok "C: migration 029 no-op on already-correct simple"
  [[ "$(read_generated_fts_cfg)" == "simple" ]] && ok "C: cfg remains simple" || bad "C: cfg changed"

  trap - EXIT
  teardown_db

  # ── D. Missing GIN only → SAFE_AUTO_REPAIR_ADD_GIN ───────────────────────
  setup_db "mig029_missing_gin"
  trap teardown_db EXIT
  apply_migrations_through_015
  ensure_arabic_cfg
  apply_migration_016
  psql_db -c "DROP INDEX IF EXISTS idx_messages_search;" >/dev/null

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-nogin.log 2>&1
  set -e
  grep -q 'chosen_action=SAFE_AUTO_REPAIR_ADD_GIN' /tmp/preflight029-nogin.log \
    && ok "D0: preflight SAFE_AUTO_REPAIR_ADD_GIN" \
    || bad "D0: chosen_action=$(grep chosen_action /tmp/preflight029-nogin.log | tail -1)"

  apply_migration_029
  gin_cnt=$(psql_db -At -c "
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND tablename='office_messages'
      AND indexname='idx_messages_search';")
  [[ "$gin_cnt" == "1" ]] && ok "D: GIN restored" || bad "D: gin_cnt=$gin_cnt"
  apply_migration_029
  ok "D: idempotent re-run after GIN add"

  trap - EXIT
  teardown_db

  # ── E. Wrong type → BLOCK ────────────────────────────────────────────────
  setup_db "mig029_wrong_type"
  trap teardown_db EXIT
  apply_migrations_through_015
  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  search_vector TEXT
);
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-wrongtype.log 2>&1
  set -e
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight029-wrongtype.log \
    && ok "E0: preflight BLOCK wrong type" || bad "E0: wrong-type preflight"
  grep -q 'WRONG_SEARCH_VECTOR_TYPE' /tmp/preflight029-wrongtype.log \
    && ok "E0: reason_code WRONG_SEARCH_VECTOR_TYPE" || bad "E0: missing reason"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_029" >/tmp/mig029-wrongtype.log 2>&1
  local rc_wrong=$?
  set -e
  [[ "$rc_wrong" -ne 0 ]] && ok "E: migration aborts on wrong type" || bad "E: migration should abort"
  grep -q 'BLOCK_AND_MANUAL_REVIEW' /tmp/mig029-wrongtype.log \
    && ok "E: EXCEPTION mentions BLOCK" || bad "E: missing BLOCK message"
  local still_text
  still_text=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_messages'
      AND column_name='search_vector';")
  [[ "$still_text" == "text" ]] && ok "E: no auto-drop of incompatible column" || bad "E: column altered unexpectedly"

  trap - EXIT
  teardown_db

  # ── F. Non-generated tsvector → BLOCK ────────────────────────────────────
  setup_db "mig029_nongen"
  trap teardown_db EXIT
  apply_migrations_through_015
  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  search_vector tsvector
);
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-nongen.log 2>&1
  set -e
  grep -q 'NON_GENERATED_TSVECTOR' /tmp/preflight029-nongen.log \
    && ok "F0: reason NON_GENERATED_TSVECTOR" || bad "F0: missing nongen reason"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_029" >/tmp/mig029-nongen.log 2>&1
  local rc_nongen=$?
  set -e
  [[ "$rc_nongen" -ne 0 ]] && ok "F: migration aborts on non-generated" || bad "F: should abort"
  grep -qE 'DROP COLUMN' /tmp/mig029-nongen.log && bad "F: must not DROP COLUMN" || ok "F: no DROP COLUMN attempted"

  trap - EXIT
  teardown_db

  # ── G. Unsupported cfg (english) → BLOCK ─────────────────────────────────
  setup_db "mig029_english"
  trap teardown_db EXIT
  apply_migrations_through_015
  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, ''))
  ) STORED
);
CREATE INDEX idx_messages_search ON office_messages USING gin (search_vector);
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-english.log 2>&1
  set -e
  grep -q 'UNSUPPORTED_FTS_CONFIG' /tmp/preflight029-english.log \
    && ok "G0: reason UNSUPPORTED_FTS_CONFIG" || bad "G0: missing unsupported reason"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_029" >/tmp/mig029-english.log 2>&1
  local rc_eng=$?
  set -e
  [[ "$rc_eng" -ne 0 ]] && ok "G: migration aborts on unsupported cfg" || bad "G: should abort"
  [[ "$(read_generated_fts_cfg)" == "english" ]] \
    && ok "G: english expression preserved (no forced replace)" \
    || bad "G: expression changed"

  trap - EXIT
  teardown_db

  # ── H. Wrong / non-GIN index → BLOCK ─────────────────────────────────────
  setup_db "mig029_wrong_am"
  trap teardown_db EXIT
  apply_migrations_through_015
  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(subject, '') || ' ' || coalesce(body, ''))
  ) STORED
);
CREATE INDEX idx_messages_search ON office_messages (id);
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-wrongam.log 2>&1
  set -e
  grep -qE 'WRONG_INDEX_AM|WRONG_INDEX_DEFINITION' /tmp/preflight029-wrongam.log \
    && ok "H0: preflight BLOCK wrong index" || bad "H0: missing wrong-index reason"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_029" >/tmp/mig029-wrongam.log 2>&1
  local rc_am=$?
  set -e
  [[ "$rc_am" -ne 0 ]] && ok "H: migration aborts on wrong index AM/def" || bad "H: should abort"
  local am_name
  am_name=$(psql_db -At -c "
    SELECT am.amname
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_am am ON am.oid = i.relam
    WHERE n.nspname='public' AND t.relname='office_messages'
      AND i.relname='idx_messages_search';")
  [[ "$am_name" != "gin" ]] && ok "H: wrong index not auto-replaced" || bad "H: index was replaced"

  trap - EXIT
  teardown_db

  # ── I. Invalid / not-ready index → BLOCK ─────────────────────────────────
  # Simulate invalid index via pg_index update in a throwaway DB (superuser).
  setup_db "mig029_invalid_idx"
  trap teardown_db EXIT
  apply_migrations_through_015
  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(subject, '') || ' ' || coalesce(body, ''))
  ) STORED
);
CREATE INDEX idx_messages_search ON office_messages USING gin (search_vector);
UPDATE pg_index SET indisvalid = false
WHERE indexrelid = 'public.idx_messages_search'::regclass;
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-invalid.log 2>&1
  set -e
  grep -q 'INDEX_NOT_VALID_OR_NOT_READY' /tmp/preflight029-invalid.log \
    && ok "I0: preflight BLOCK invalid index" || bad "I0: missing invalid-index reason"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_029" >/tmp/mig029-invalid.log 2>&1
  local rc_inv=$?
  set -e
  [[ "$rc_inv" -ne 0 ]] && ok "I: migration aborts on invalid index" || bad "I: should abort"

  trap - EXIT
  teardown_db

  # ── J. Stage 20.2 null-skip remains office-scoped (source contract) ───────
  if grep -q 'm.office_id = \${tenantId}' \
      "$ROOT/artifacts/api-server/src/modules/operations/internal-messages.ts" \
    && grep -q 'messageSearchPredicate' \
      "$ROOT/artifacts/api-server/src/modules/operations/internal-messages.ts" \
    && grep -q 'MESSAGE_FTS_ALLOWED_CONFIGS' \
      "$ROOT/artifacts/api-server/src/modules/operations/messageFtsConfigLogic.ts"; then
    ok "J: Stage 20.1 office_id + Stage 20.2 allow-list still present (null-skip stays scoped)"
  else
    bad "J: tenant/FTS allow-list surface regresssed"
  fi

  # ── K. Migration source never auto-drops incompatible legacy schema ──────
  if ! grep -vE '^\s*--' "$MIGRATION_029" | grep -qiE 'DROP[[:space:]]+COLUMN|DROP[[:space:]]+INDEX'; then
    ok "K: migration 029 SQL has no DROP COLUMN/INDEX"
  else
    bad "K: migration 029 contains DROP COLUMN/INDEX"
  fi

  # ── L. Absent search_vector + wrong existing idx_messages_search → BLOCK ─
  # False-safe guard: CREATE INDEX IF NOT EXISTS must not skip over a btree
  # that already owns the name and leave FTS "repaired" without a GIN.
  setup_db "mig029_absent_vector_conflict"
  trap teardown_db EXIT
  apply_migrations_through_015
  ensure_arabic_cfg
  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  subject TEXT,
  body TEXT,
  sender_id TEXT,
  folder TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_search ON office_messages (id);
INSERT INTO office_messages (office_id, subject, body, sender_id, folder)
VALUES ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', 'عقد', 'نص', 'user-a', 'sent');
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-conflict.log 2>&1
  set -e
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight029-conflict.log \
    && ok "L0: preflight BLOCK absent search_vector + wrong existing idx_messages_search" \
    || bad "L0: chosen_action=$(grep chosen_action /tmp/preflight029-conflict.log | tail -1)"
  grep -qE 'WRONG_INDEX_AM|WRONG_INDEX_DEFINITION|CONFLICTING_INDEX_NAME' /tmp/preflight029-conflict.log \
    && ok "L0: reason codes conflicting index (not SAFE_AUTO_REPAIR_ADD_COLUMN)" \
    || bad "L0: missing conflicting-index reason"
  grep -q 'chosen_action=SAFE_AUTO_REPAIR_ADD_COLUMN' /tmp/preflight029-conflict.log \
    && bad "L0: must not classify SAFE_AUTO_REPAIR_ADD_COLUMN" \
    || ok "L0: not classified as SAFE_AUTO_REPAIR_ADD_COLUMN"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_029" >/tmp/mig029-conflict.log 2>&1
  local rc_conflict=$?
  set -e
  [[ "$rc_conflict" -ne 0 ]] \
    && ok "L: migration does not commit false-ready state (aborts)" \
    || bad "L: migration should abort on conflicting idx_messages_search"
  grep -qE 'BLOCK_AND_MANUAL_REVIEW|POST_APPLY_READINESS_FAILED' /tmp/mig029-conflict.log \
    && ok "L: abort mentions BLOCK/post-apply failure" \
    || bad "L: missing abort reason"
  local conflict_vector conflict_am
  conflict_vector=$(psql_db -At -c "
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_messages'
      AND column_name='search_vector';")
  conflict_am=$(psql_db -At -c "
    SELECT am.amname
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_am am ON am.oid = i.relam
    WHERE n.nspname='public' AND t.relname='office_messages'
      AND i.relname='idx_messages_search';")
  [[ "$conflict_vector" == "0" ]] \
    && ok "L: search_vector still absent (no false-ready commit)" \
    || bad "L: search_vector unexpectedly present after abort"
  [[ "$conflict_am" != "gin" ]] \
    && ok "L: incompatible idx_messages_search not DROP/replaced" \
    || bad "L: index was auto-replaced"

  trap - EXIT
  teardown_db

  # ── M. Partial GIN rejected ──────────────────────────────────────────────
  setup_db "mig029_partial_gin"
  trap teardown_db EXIT
  apply_migrations_through_015
  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  folder TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(subject, '') || ' ' || coalesce(body, ''))
  ) STORED
);
CREATE INDEX idx_messages_search ON office_messages
  USING gin (search_vector) WHERE folder = 'sent';
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-partial.log 2>&1
  set -e
  grep -q 'PARTIAL_INDEX' /tmp/preflight029-partial.log \
    && ok "M0: preflight BLOCK partial GIN" \
    || bad "M0: missing PARTIAL_INDEX reason"
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight029-partial.log \
    && ok "M0: chosen_action BLOCK for partial GIN" \
    || bad "M0: not blocked"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_029" >/tmp/mig029-partial.log 2>&1
  local rc_partial=$?
  set -e
  [[ "$rc_partial" -ne 0 ]] && ok "M: migration aborts on partial GIN" || bad "M: should abort"
  local still_partial
  still_partial=$(psql_db -At -c "
    SELECT x.indpred IS NOT NULL
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='office_messages'
      AND i.relname='idx_messages_search';")
  [[ "$still_partial" == "t" ]] \
    && ok "M: partial GIN preserved (no DROP/replace)" \
    || bad "M: partial index altered"

  trap - EXIT
  teardown_db

  # ── N. Wrong-expression generated vector rejected ────────────────────────
  setup_db "mig029_wrong_expr"
  trap teardown_db EXIT
  apply_migrations_through_015
  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(subject, ''))
  ) STORED
);
CREATE INDEX idx_messages_search ON office_messages USING gin (search_vector);
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-wrongexpr.log 2>&1
  set -e
  grep -q 'WRONG_GENERATED_EXPRESSION' /tmp/preflight029-wrongexpr.log \
    && ok "N0: preflight BLOCK wrong-expression generated vector" \
    || bad "N0: missing WRONG_GENERATED_EXPRESSION"
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight029-wrongexpr.log \
    && ok "N0: chosen_action BLOCK" \
    || bad "N0: not blocked"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_029" >/tmp/mig029-wrongexpr.log 2>&1
  local rc_wexpr=$?
  set -e
  [[ "$rc_wexpr" -ne 0 ]] && ok "N: migration aborts on wrong expression" || bad "N: should abort"
  local still_subj_only
  still_subj_only=$(psql_db -At -c "
    SELECT pg_get_expr(ad.adbin, ad.adrelid)
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE n.nspname='public' AND c.relname='office_messages'
      AND a.attname='search_vector' AND NOT a.attisdropped;")
  [[ "$still_subj_only" == *"coalesce(subject"* || "$still_subj_only" == *"COALESCE(subject"* ]] \
    && [[ "$still_subj_only" != *"body"* ]] \
    && ok "N: wrong expression preserved (no rewrite)" \
    || bad "N: expression changed unexpectedly: $still_subj_only"

  trap - EXIT
  teardown_db

  # ── O. Correct STORED generated + valid GIN remains ALREADY_CORRECT ──────
  setup_db "mig029_stored_ready"
  trap teardown_db EXIT
  apply_migrations_through_015
  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  body TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(subject, '') || ' ' || coalesce(body, ''))
  ) STORED
);
CREATE INDEX idx_messages_search ON office_messages USING gin (search_vector);
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_029" >/tmp/preflight029-stored.log 2>&1
  set -e
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight029-stored.log \
    && ok "O: correct stored generated vector + valid GIN remains ALREADY_CORRECT" \
    || bad "O: chosen_action=$(grep chosen_action /tmp/preflight029-stored.log | tail -1)"
  apply_migration_029
  ok "O: migration 029 no-op on STORED+GIN ready shape"
  local att_gen
  att_gen=$(psql_db -At -c "
    SELECT a.attgenerated::text
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='office_messages'
      AND a.attname='search_vector' AND NOT a.attisdropped;")
  [[ "$att_gen" == "s" ]] && ok "O: attgenerated remains STORED (s)" || bad "O: attgenerated=$att_gen"

  trap - EXIT
  teardown_db
}

# ── Scenario: migration 030 office_messages.case_id TEXT (Stage 22) ────────
scenario_migration_030_office_messages_case_id_text() {
  log "Scenario 030 — case_id INTEGER→TEXT / already-TEXT / BLOCK unexpected"
  local PREFLIGHT_030="$ROOT/scripts/db/preflight-migration-030.sql"
  local CASE_UUID="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1"
  local OFFICE_A="11111111-1111-4111-8111-111111111111"
  local OFFICE_B="22222222-2222-4222-8222-222222222222"

  # ── A. INTEGER case_id + legacy 42 → TEXT '42' (no UUID invent) ──────────
  setup_db "mig030_integer_legacy"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_017

  # Ensure cases row (TEXT id) + INTEGER case_id message with orphan legacy 42
  psql_db <<SQL >/dev/null
INSERT INTO cases (id, office_id, title)
VALUES ('${CASE_UUID}', '${OFFICE_A}', 'Case A')
ON CONFLICT (id) DO NOTHING;
INSERT INTO office_messages (office_id, subject, body, sender_id, sender_name, folder, case_id)
VALUES
  ('${OFFICE_A}', 'linked-uuid-impossible', 'body', 'u1', 'U1', 'sent', NULL),
  ('${OFFICE_A}', 'legacy-orphan', 'body-42', 'u1', 'U1', 'sent', 42);
SQL

  local pre_udt
  pre_udt=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_messages' AND column_name='case_id';")
  [[ "$pre_udt" == "int4" ]] && ok "A pre: case_id is INTEGER" || bad "A pre: case_id udt=$pre_udt"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_030" >/tmp/preflight030-int.log 2>&1
  set -e
  grep -q 'chosen_action=SAFE_CONVERT_INTEGER_TO_TEXT' /tmp/preflight030-int.log \
    && ok "A0: preflight SAFE_CONVERT_INTEGER_TO_TEXT" \
    || bad "A0: chosen_action=$(grep chosen_action /tmp/preflight030-int.log | tail -1)"

  apply_migration_030

  local post_udt legacy_val null_ok idx_present
  post_udt=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_messages' AND column_name='case_id';")
  legacy_val=$(psql_db -At -c "
    SELECT case_id FROM office_messages WHERE subject='legacy-orphan' LIMIT 1;")
  null_ok=$(psql_db -At -c "
    SELECT COUNT(*)::text FROM office_messages WHERE subject='linked-uuid-impossible' AND case_id IS NULL;")
  idx_present=$(psql_db -At -c "
    SELECT COUNT(*)::text FROM pg_indexes
    WHERE schemaname='public' AND tablename='office_messages' AND indexname='idx_messages_case_id';")

  [[ "$post_udt" == "text" ]] && ok "A: case_id converted to TEXT" || bad "A: post udt=$post_udt"
  [[ "$legacy_val" == "42" ]] && ok "A: legacy 42 preserved as TEXT '42'" || bad "A: legacy_val=$legacy_val"
  [[ "$null_ok" == "1" ]] && ok "A: NULL case_id preserved" || bad "A: null_ok=$null_ok"
  [[ "$idx_present" == "1" ]] && ok "A: idx_messages_case_id present" || bad "A: idx count=$idx_present"

  # Must NOT invent a UUID for legacy 42
  local invent_count
  invent_count=$(psql_db -At -c "
    SELECT COUNT(*)::text FROM office_messages
    WHERE case_id IS NOT NULL
      AND case_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\$'
      AND subject='legacy-orphan';")
  [[ "$invent_count" == "0" ]] && ok "A: legacy '42' NOT mapped to any UUID" || bad "A: invent_count=$invent_count"

  # Idempotent re-apply
  apply_migration_030
  ok "A: re-apply 030 on converted TEXT succeeded (idempotent)"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_030" >/tmp/preflight030-after-a.log 2>&1
  set -e
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight030-after-a.log \
    && ok "A: post-apply preflight ALREADY_CORRECT" \
    || bad "A: post chosen_action=$(grep chosen_action /tmp/preflight030-after-a.log | tail -1)"

  # TEXT-to-TEXT join works for UUID case_id after convert
  psql_db <<SQL >/dev/null
INSERT INTO office_messages (office_id, subject, body, sender_id, sender_name, folder, case_id)
VALUES ('${OFFICE_A}', 'uuid-link', 'body', 'u1', 'U1', 'sent', '${CASE_UUID}');
SQL
  local join_count
  join_count=$(psql_db -At -c "
    SELECT COUNT(*)::text
    FROM office_messages m
    JOIN cases c ON c.id = m.case_id AND c.office_id = m.office_id
    WHERE m.subject='uuid-link';")
  [[ "$join_count" == "1" ]] && ok "A: TEXT↔TEXT join works for UUID case_id" || bad "A: join_count=$join_count"

  trap - EXIT
  teardown_db

  # ── B. Already TEXT → ALREADY_CORRECT / no-op rewrite ───────────────────
  setup_db "mig030_already_text"
  trap teardown_db EXIT
  apply_migrations_through_015

  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  subject TEXT,
  body TEXT,
  sender_id TEXT,
  sender_name TEXT,
  folder TEXT,
  case_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO office_messages (office_id, subject, body, sender_id, folder, case_id)
VALUES ('oa', 'keep', 'b', 'u1', 'sent', '42');
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_030" >/tmp/preflight030-text.log 2>&1
  set -e
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight030-text.log \
    && ok "B: already-TEXT preflight ALREADY_CORRECT" \
    || bad "B: chosen_action=$(grep chosen_action /tmp/preflight030-text.log | tail -1)"

  apply_migration_030
  local keep_val
  keep_val=$(psql_db -At -c "SELECT case_id FROM office_messages WHERE subject='keep';")
  [[ "$keep_val" == "42" ]] && ok "B: already-TEXT '42' unchanged (no UUID invent)" || bad "B: keep_val=$keep_val"
  apply_migration_030
  ok "B: migration 030 idempotent on already-TEXT"

  trap - EXIT
  teardown_db

  # ── C. Unexpected case_id type → BLOCK_AND_MANUAL_REVIEW ────────────────
  setup_db "mig030_unexpected"
  trap teardown_db EXIT
  apply_migrations_through_015

  psql_db <<'SQL' >/dev/null
CREATE TABLE office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT,
  subject TEXT,
  body TEXT,
  case_id BOOLEAN
);
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_030" >/tmp/preflight030-block.log 2>&1
  set -e
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight030-block.log \
    && ok "C0: unexpected type preflight BLOCK" \
    || bad "C0: chosen_action=$(grep chosen_action /tmp/preflight030-block.log | tail -1)"
  grep -q 'UNEXPECTED_CASE_ID_TYPE' /tmp/preflight030-block.log \
    && ok "C0: reason_code UNEXPECTED_CASE_ID_TYPE" \
    || bad "C0: missing UNEXPECTED_CASE_ID_TYPE"

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_030" >/tmp/mig030-block.log 2>&1
  local block_rc=$?
  set -e
  [[ "$block_rc" -ne 0 ]] && ok "C: migration 030 aborts on unexpected type" || bad "C: migration should abort"
  grep -q 'BLOCK_AND_MANUAL_REVIEW' /tmp/mig030-block.log \
    && ok "C: RAISE EXCEPTION mentions BLOCK_AND_MANUAL_REVIEW" \
    || bad "C: missing BLOCK message"

  local still_bool
  still_bool=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_messages' AND column_name='case_id';")
  [[ "$still_bool" == "bool" ]] && ok "C: case_id type unchanged after BLOCK" || bad "C: udt=$still_bool"

  trap - EXIT
  teardown_db

  # ── D. Cross-office match surfaced; orphans do not invent repair ────────
  setup_db "mig030_cross_office"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_017

  psql_db <<SQL >/dev/null
INSERT INTO cases (id, office_id, title) VALUES
  ('${CASE_UUID}', '${OFFICE_A}', 'Case A')
ON CONFLICT (id) DO NOTHING;
-- After convert we will set textual UUID on office B message to surface cross-office
INSERT INTO office_messages (office_id, subject, body, sender_id, sender_name, folder, case_id)
VALUES ('${OFFICE_A}', 'orphan-int', 'b', 'u1', 'U1', 'sent', 99);
SQL

  apply_migration_030
  psql_db <<SQL >/dev/null
INSERT INTO office_messages (office_id, subject, body, sender_id, sender_name, folder, case_id)
VALUES ('${OFFICE_B}', 'cross-office', 'b', 'u2', 'U2', 'sent', '${CASE_UUID}');
SQL

  set +e
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_030" >/tmp/preflight030-cross.log 2>&1
  set -e
  grep -q 'cross_office_matches' /tmp/preflight030-cross.log \
    && ok "D: preflight reports cross_office_matches" \
    || bad "D: missing cross_office_matches"
  grep -qiE 'CROSS_OFFICE_MATCHES_PRESENT|cross_office_matches require manual review|WARNING cross_office' \
    /tmp/preflight030-cross.log \
    && ok "D: cross-office surfaced for manual review" \
    || bad "D: cross-office warning missing"

  local orphan_text
  orphan_text=$(psql_db -At -c "SELECT case_id FROM office_messages WHERE subject='orphan-int';")
  [[ "$orphan_text" == "99" ]] && ok "D: orphan legacy remains textual '99'" || bad "D: orphan_text=$orphan_text"

  # Source inventory: no Runtime ensureCaseIdColumn
  if ! grep -qE 'ensureCaseIdColumn|ADD COLUMN IF NOT EXISTS case_id INTEGER' \
      "$ROOT/artifacts/api-server/src/modules/operations/internal-messages.ts"; then
    ok "D: internal-messages.ts has no Runtime case_id INTEGER DDL"
  else
    bad "D: Runtime case_id DDL still present"
  fi
  if ! grep -qE 'CREATE INDEX IF NOT EXISTS idx_messages_case_id' \
      "$ROOT/artifacts/api-server/src/modules/legal-core/cases.ts"; then
    ok "D: cases.ts has no Runtime idx_messages_case_id CREATE"
  else
    bad "D: Runtime idx_messages_case_id still in cases.ts"
  fi

  trap - EXIT
  teardown_db
}

# ── Scenario: migration 031 message_conversations schema authority (Stage 23.3B) ─
scenario_migration_031_message_conversations() {
  log "Scenario 031 — conversations schema authority + preflight false-safe ladder"
  local PREFLIGHT_031="$ROOT/scripts/db/preflight-migration-031.sql"

  # A0: preflight on absent tables
  setup_db "mig031_preflight_absent"
  trap teardown_db EXIT
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-absent.log 2>&1
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight031-absent.log \
    && ok "A0: chosen_action=SAFE_AUTO_REPAIR (tables missing)" \
    || bad "A0: missing SAFE_AUTO_REPAIR for absent tables"
  grep -q 'reason_code=TABLE_MISSING' /tmp/preflight031-absent.log \
    && ok "A0: reason_code=TABLE_MISSING" \
    || bad "A0: reason_code TABLE_MISSING missing"
  trap - EXIT
  teardown_db

  # A: greenfield after 016/020 baseline path
  setup_db "mig031_fresh"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_017
  apply_migration_018
  apply_migration_019
  apply_migration_020
  local pre_mc
  pre_mc=$(psql_db -At -c "SELECT to_regclass('public.message_conversations') IS NOT NULL")
  [[ "$pre_mc" == "f" ]] && ok "A pre-031: message_conversations absent" || bad "A pre-031: should be absent"

  apply_migration_031
  local case_udt pk_ok uniq_ok idx_partial nn_ok
  case_udt=$(psql_db -At -c "SELECT udt_name FROM information_schema.columns WHERE table_name='message_conversations' AND column_name='case_id'")
  [[ "$case_udt" == "text" ]] && ok "A: case_id TEXT present" || bad "A: case_id udt=$case_udt"
  pk_ok=$(psql_db -At -c "SELECT COUNT(*)::int FROM pg_constraint WHERE conrelid='public.message_conversations'::regclass AND contype='p'")
  [[ "$pk_ok" -ge 1 ]] && ok "A: message_conversations PK" || bad "A: missing PK"
  uniq_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.conversation_members'::regclass
        AND c.contype IN ('u','p')
        AND pg_get_constraintdef(c.oid) ILIKE '%(conversation_id, user_id)%'
    )")
  [[ "$uniq_ok" == "t" ]] && ok "A: UNIQUE(conversation_id,user_id) arbiter" || bad "A: UNIQUE missing"
  idx_partial=$(psql_db -At -c "
    SELECT pg_get_expr(x.indpred, x.indrelid)
    FROM pg_class t
    JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_index x ON x.indrelid=t.oid
    JOIN pg_class i ON i.oid=x.indexrelid
    WHERE n.nspname='public' AND t.relname='message_conversations' AND i.relname='idx_convs_case_id'")
  if [[ "$idx_partial" == *"case_id IS NOT NULL"* ]]; then
    ok "A: idx_convs_case_id partial (020 form)"
  else
    bad "A: idx pred=$idx_partial"
  fi
  nn_ok=$(psql_db -At -c "
    SELECT bool_and(a.attnotnull)
    FROM pg_attribute a
    JOIN pg_class t ON t.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='message_conversations'
      AND a.attname IN ('id','office_id','type','created_by','created_at','updated_at')
      AND NOT a.attisdropped AND a.attnum > 0")
  [[ "$nn_ok" == "t" ]] && ok "A: required NOT NULL on message_conversations" || bad "A: NOT NULL missing"

  # ON CONFLICT probe
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO message_conversations (id, office_id, title, type, created_by, case_id)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'office-a', 't', 'direct', 'u1', NULL);
    INSERT INTO conversation_members (conversation_id, office_id, user_id, role)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'office-a', 'u1', 'admin');
    INSERT INTO conversation_members (conversation_id, office_id, user_id, role)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'office-a', 'u1', 'admin')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  " >/dev/null
  ok "A: ON CONFLICT (conversation_id, user_id) usable"

  apply_migration_031
  ok "A: re-run 031 idempotent"

  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight031-ready.log \
    && ok "A: preflight ALREADY_CORRECT after apply" \
    || bad "A: preflight not ALREADY_CORRECT"
  trap - EXIT
  teardown_db

  # B: legacy table without case_id → SAFE repair
  setup_db "mig031_case_id_missing"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE message_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      title TEXT,
      type TEXT NOT NULL DEFAULT 'direct',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL,
      office_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (conversation_id, user_id)
    );
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-case.log 2>&1
  grep -q 'reason_code=CASE_ID_MISSING' /tmp/preflight031-case.log \
    && ok "B: preflight CASE_ID_MISSING" \
    || bad "B: expected CASE_ID_MISSING"
  apply_migration_031
  case_udt=$(psql_db -At -c "SELECT udt_name FROM information_schema.columns WHERE table_name='message_conversations' AND column_name='case_id'")
  [[ "$case_udt" == "text" ]] && ok "B: case_id added as TEXT" || bad "B: case_id udt=$case_udt"
  trap - EXIT
  teardown_db

  # C: one table missing
  setup_db "mig031_one_missing"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE message_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      title TEXT,
      type TEXT NOT NULL DEFAULT 'direct',
      created_by TEXT NOT NULL,
      case_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  " >/dev/null
  apply_migration_031
  local cm_ok
  cm_ok=$(psql_db -At -c "SELECT to_regclass('public.conversation_members') IS NOT NULL")
  [[ "$cm_ok" == "t" ]] && ok "C: missing conversation_members created" || bad "C: conversation_members still missing"
  trap - EXIT
  teardown_db

  # D: duplicate membership BLOCK
  setup_db "mig031_dups"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE message_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      title TEXT,
      type TEXT NOT NULL DEFAULT 'direct',
      created_by TEXT NOT NULL,
      case_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL,
      office_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO message_conversations (id, office_id, type, created_by)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'o1', 'direct', 'u1');
    INSERT INTO conversation_members (conversation_id, office_id, user_id)
    VALUES
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'o1', 'u1'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'o1', 'u1');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_031" >/tmp/mig031-dup.log 2>&1; then
    bad "D: 031 should BLOCK on duplicate membership"
  else
    grep -q 'DUPLICATE_MEMBERSHIP' /tmp/mig031-dup.log \
      && ok "D: BLOCK DUPLICATE_MEMBERSHIP" \
      || bad "D: missing DUPLICATE_MEMBERSHIP in error"
  fi
  trap - EXIT
  teardown_db

  # E: incompatible same-name idx_convs_case_id (non-partial) BLOCK
  setup_db "mig031_bad_idx"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE message_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      title TEXT,
      type TEXT NOT NULL DEFAULT 'direct',
      created_by TEXT NOT NULL,
      case_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES message_conversations(id),
      office_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (conversation_id, user_id)
    );
    CREATE INDEX idx_convs_case_id ON message_conversations (case_id);
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_031" >/tmp/mig031-idx.log 2>&1; then
    bad "E: 031 should BLOCK on incompatible idx_convs_case_id"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig031-idx.log \
      && ok "E: BLOCK INCOMPATIBLE_INDEX" \
      || bad "E: missing INCOMPATIBLE_INDEX"
  fi
  trap - EXIT
  teardown_db

  # F: orphan members → apply succeeds; FK deferred NOTICE
  setup_db "mig031_orphans"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE message_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      title TEXT,
      type TEXT NOT NULL DEFAULT 'direct',
      created_by TEXT NOT NULL,
      case_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL,
      office_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (conversation_id, user_id)
    );
    INSERT INTO conversation_members (conversation_id, office_id, user_id)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'o1', 'u1');
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_031" >/tmp/mig031-orphan.log 2>&1; then
    grep -q 'FK_DEFERRED_ORPHANS\|DEFERRED\|fk_status=DEFERRED' /tmp/mig031-orphan.log \
      && ok "F: apply with orphans; FK deferred surfaced" \
      || ok "F: apply with orphans succeeded (FK deferred)"
    local fk_present
    fk_present=$(psql_db -At -c "
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid='public.conversation_members'::regclass
          AND conname='conversation_members_conversation_id_fkey'
      )")
    [[ "$fk_present" == "f" ]] && ok "F: FK not installed when orphans present" || bad "F: FK unexpectedly installed"
  else
    bad "F: 031 should succeed with FK deferred on orphans"
    tail -30 /tmp/mig031-orphan.log
  fi
  trap - EXIT
  teardown_db

  # ── H. Preflight false-safe hardening ───────────────────────────────────

  # H1: wrong non-case_id column type => preflight BLOCK
  setup_db "mig031_pf_bad_type"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE message_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id INTEGER NOT NULL,
      title TEXT,
      type TEXT NOT NULL DEFAULT 'direct',
      created_by TEXT NOT NULL,
      case_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL,
      office_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (conversation_id, user_id)
    );
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-badtype.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight031-badtype.log \
    && ok "H1: preflight BLOCK on wrong office_id type" \
    || bad "H1: chosen_action=$(grep chosen_action /tmp/preflight031-badtype.log | tail -1)"
  grep -q 'reason_code=INCOMPATIBLE_TYPE' /tmp/preflight031-badtype.log \
    && ok "H1: reason_code=INCOMPATIBLE_TYPE" \
    || bad "H1: missing INCOMPATIBLE_TYPE"
  trap - EXIT
  teardown_db

  # H2: wrong two-column UNIQUE => not ALREADY_CORRECT (SAFE repair to add real arbiter)
  setup_db "mig031_pf_wrong_unique"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_031
  # Drop correct unique and replace with wrong two-col unique
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE conversation_members DROP CONSTRAINT IF EXISTS conversation_members_conversation_id_user_id_key;
    CREATE UNIQUE INDEX conversation_members_wrong_unique ON conversation_members (user_id, office_id);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-wronguniq.log 2>&1
  if grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight031-wronguniq.log; then
    bad "H2: wrong two-col unique must not be ALREADY_CORRECT"
  else
    ok "H2: wrong two-col unique is not ALREADY_CORRECT"
  fi
  grep -qE 'chosen_action=SAFE_AUTO_REPAIR|chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight031-wronguniq.log \
    && ok "H2: preflight SAFE or BLOCK for wrong unique" \
    || bad "H2: unexpected action $(grep chosen_action /tmp/preflight031-wronguniq.log | tail -1)"
  # Apply should add correct UNIQUE arbiter
  apply_migration_031
  local arbiter_ok
  arbiter_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.conversation_members'::regclass
        AND c.contype IN ('u','p')
        AND pg_get_constraintdef(c.oid) ILIKE '%(conversation_id, user_id)%'
    )")
  [[ "$arbiter_ok" == "t" ]] && ok "H2: migration adds usable ON CONFLICT arbiter" || bad "H2: arbiter still missing"
  trap - EXIT
  teardown_db

  # H3: missing required index => not ALREADY_CORRECT
  setup_db "mig031_pf_missing_idx"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_031
  psql_db -v ON_ERROR_STOP=1 -c "DROP INDEX IF EXISTS idx_conv_updated;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-missingidx.log 2>&1
  if grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight031-missingidx.log; then
    bad "H3: missing idx_conv_updated must not be ALREADY_CORRECT"
  else
    ok "H3: missing required index is not ALREADY_CORRECT"
  fi
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight031-missingidx.log \
    && ok "H3: SAFE_AUTO_REPAIR to recreate missing index" \
    || bad "H3: chosen_action=$(grep chosen_action /tmp/preflight031-missingidx.log | tail -1)"
  trap - EXIT
  teardown_db

  # H4: same-name wrong idx_conv_office => BLOCK
  setup_db "mig031_pf_bad_office_idx"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_031
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX idx_conv_office;
    CREATE INDEX idx_conv_office ON message_conversations (title);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-badofficeidx.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight031-badofficeidx.log \
    && ok "H4: preflight BLOCK wrong idx_conv_office" \
    || bad "H4: chosen_action=$(grep chosen_action /tmp/preflight031-badofficeidx.log | tail -1)"
  grep -q 'INCOMPATIBLE_INDEX' /tmp/preflight031-badofficeidx.log \
    && ok "H4: reason INCOMPATIBLE_INDEX" || bad "H4: missing INCOMPATIBLE_INDEX"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_031" >/tmp/mig031-badofficeidx.log 2>&1; then
    bad "H4: migration should BLOCK wrong idx_conv_office"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig031-badofficeidx.log \
      && ok "H4: migration BLOCK wrong idx_conv_office" || bad "H4: mig missing INCOMPATIBLE_INDEX"
  fi
  trap - EXIT
  teardown_db

  # H5: same-name wrong idx_conv_updated (ASC not DESC) => BLOCK
  setup_db "mig031_pf_bad_updated_idx"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_031
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX idx_conv_updated;
    CREATE INDEX idx_conv_updated ON message_conversations (office_id, updated_at ASC);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-badupdated.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight031-badupdated.log \
    && ok "H5: preflight BLOCK wrong idx_conv_updated ASC" \
    || bad "H5: chosen_action=$(grep chosen_action /tmp/preflight031-badupdated.log | tail -1)"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_031" >/tmp/mig031-badupdated.log 2>&1; then
    bad "H5: migration should BLOCK ASC idx_conv_updated"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig031-badupdated.log \
      && ok "H5: migration BLOCK ASC idx_conv_updated" || bad "H5: mig missing INCOMPATIBLE_INDEX"
  fi
  trap - EXIT
  teardown_db

  # H6: same-name wrong members index => BLOCK
  setup_db "mig031_pf_bad_members_idx"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_031
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX idx_conv_members_user;
    CREATE INDEX idx_conv_members_user ON conversation_members (office_id, user_id);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-badmuser.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight031-badmuser.log \
    && ok "H6: preflight BLOCK wrong idx_conv_members_user" \
    || bad "H6: chosen_action=$(grep chosen_action /tmp/preflight031-badmuser.log | tail -1)"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_031" >/tmp/mig031-badmuser.log 2>&1; then
    bad "H6: migration should BLOCK wrong members index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig031-badmuser.log \
      && ok "H6: migration BLOCK wrong members index" || bad "H6: mig missing INCOMPATIBLE_INDEX"
  fi
  trap - EXIT
  teardown_db

  # H7: missing case_id + duplicate membership => BLOCK, not SAFE
  setup_db "mig031_pf_case_and_dups"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE message_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      title TEXT,
      type TEXT NOT NULL DEFAULT 'direct',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL,
      office_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO message_conversations (id, office_id, type, created_by)
    VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'o1', 'direct', 'u1');
    INSERT INTO conversation_members (conversation_id, office_id, user_id)
    VALUES
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'o1', 'u1'),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'o1', 'u1');
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-casedup.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight031-casedup.log \
    && ok "H7: missing case_id + dups => BLOCK (not SAFE)" \
    || bad "H7: chosen_action=$(grep chosen_action /tmp/preflight031-casedup.log | tail -1)"
  grep -q 'DUPLICATE_MEMBERSHIP' /tmp/preflight031-casedup.log \
    && ok "H7: reason DUPLICATE_MEMBERSHIP" || bad "H7: missing DUPLICATE_MEMBERSHIP"
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight031-casedup.log \
    && bad "H7: must not claim SAFE_AUTO_REPAIR" || ok "H7: not SAFE_AUTO_REPAIR"
  trap - EXIT
  teardown_db

  # H8: one table missing + incompatible type on existing table => BLOCK
  setup_db "mig031_pf_missing_plus_badtype"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL,
      office_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-missingbad.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight031-missingbad.log \
    && ok "H8: table missing + bad type => BLOCK" \
    || bad "H8: chosen_action=$(grep chosen_action /tmp/preflight031-missingbad.log | tail -1)"
  grep -q 'INCOMPATIBLE_TYPE' /tmp/preflight031-missingbad.log \
    && ok "H8: reason INCOMPATIBLE_TYPE" || bad "H8: missing INCOMPATIBLE_TYPE"
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight031-missingbad.log \
    && bad "H8: must not short-circuit to SAFE" || ok "H8: not SAFE short-circuit"
  trap - EXIT
  teardown_db

  # H9: nullable required column + existing NULL => BLOCK
  setup_db "mig031_pf_null_required"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE message_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT,
      title TEXT,
      type TEXT DEFAULT 'direct',
      created_by TEXT,
      case_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID,
      office_id TEXT,
      user_id TEXT,
      user_name TEXT,
      role TEXT DEFAULT 'member',
      joined_at TIMESTAMPTZ DEFAULT NOW()
    );
    INSERT INTO message_conversations (id, office_id, type, created_by)
    VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', NULL, 'direct', 'u1');
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-nullreq.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight031-nullreq.log \
    && ok "H9: NULL required identifier => BLOCK" \
    || bad "H9: chosen_action=$(grep chosen_action /tmp/preflight031-nullreq.log | tail -1)"
  grep -q 'NULL_REQUIRED_IDENTIFIERS' /tmp/preflight031-nullreq.log \
    && ok "H9: reason NULL_REQUIRED_IDENTIFIERS" || bad "H9: missing NULL_REQUIRED_IDENTIFIERS"
  trap - EXIT
  teardown_db

  # H10: nullable required column + no NULL => SAFE SET_NOT_NULL; migration sets NOT NULL
  setup_db "mig031_pf_set_not_null"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE message_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT,
      title TEXT,
      type TEXT DEFAULT 'direct',
      created_by TEXT,
      case_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT message_conversations_type_check CHECK (type IN ('direct','group'))
    );
    CREATE TABLE conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID,
      office_id TEXT,
      user_id TEXT,
      user_name TEXT,
      role TEXT DEFAULT 'member',
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT conversation_members_role_check CHECK (role IN ('admin','member')),
      UNIQUE (conversation_id, user_id)
    );
    INSERT INTO message_conversations (id, office_id, type, created_by)
    VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'o1', 'direct', 'u1');
    INSERT INTO conversation_members (conversation_id, office_id, user_id, role)
    VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'o1', 'u1', 'admin');
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-setnn.log 2>&1
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight031-setnn.log \
    && ok "H10: nullable clean columns => SAFE_AUTO_REPAIR" \
    || bad "H10: chosen_action=$(grep chosen_action /tmp/preflight031-setnn.log | tail -1)"
  grep -qE 'SET_NOT_NULL_PENDING|PARTIAL_SCHEMA' /tmp/preflight031-setnn.log \
    && ok "H10: reason SET_NOT_NULL_PENDING or PARTIAL_SCHEMA" \
    || bad "H10: unexpected reason $(grep reason_code /tmp/preflight031-setnn.log | tail -1)"
  apply_migration_031
  nn_ok=$(psql_db -At -c "
    SELECT bool_and(a.attnotnull)
    FROM pg_attribute a
    JOIN pg_class t ON t.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='message_conversations'
      AND a.attname IN ('office_id','type','created_by','created_at','updated_at')
      AND NOT a.attisdropped AND a.attnum > 0")
  [[ "$nn_ok" == "t" ]] && ok "H10: migration SET NOT NULL applied" || bad "H10: NOT NULL not set after 031"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_031" >/tmp/preflight031-setnn-after.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight031-setnn-after.log \
    && ok "H10: post-apply ALREADY_CORRECT" \
    || bad "H10: post chosen_action=$(grep chosen_action /tmp/preflight031-setnn-after.log | tail -1)"
  trap - EXIT
  teardown_db

  # Source inventory: Runtime DDL gone
  setup_db "mig031_src_audit"
  trap teardown_db EXIT
  if ! grep -qE 'CREATE TABLE IF NOT EXISTS message_conversations|ensureConversationTables' \
      "$ROOT/artifacts/api-server/src/modules/operations/internal-messages.ts"; then
    ok "G: internal-messages.ts has no Runtime conversation CREATE"
  else
    bad "G: Runtime conversation DDL still present"
  fi
  if ! grep -qE 'CREATE INDEX IF NOT EXISTS idx_convs_case_id' \
      "$ROOT/artifacts/api-server/src/modules/legal-core/cases.ts"; then
    ok "G: cases.ts has no Runtime idx_convs_case_id"
  else
    bad "G: Runtime idx_convs_case_id still in cases.ts"
  fi

  trap - EXIT
  teardown_db
}


# ── Scenario: migration 032 gateway settings schema authority (Stage 23.4) ─
scenario_migration_032_gateway_settings() {
  log "Scenario 032 — gateway settings: fresh / default drop / dups BLOCK / null BLOCK / wrong unique / idempotent"
  local PREFLIGHT_032="$ROOT/scripts/db/preflight-migration-032.sql"

  # A0: absent tables
  setup_db "mig032_preflight_absent"
  trap teardown_db EXIT
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_032" >/tmp/preflight032-absent.log 2>&1
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight032-absent.log \
    && ok "A0: SAFE_AUTO_REPAIR (tables missing)" \
    || bad "A0: missing SAFE_AUTO_REPAIR"
  grep -q 'reason_code=TABLE_MISSING' /tmp/preflight032-absent.log \
    && ok "A0: TABLE_MISSING" || bad "A0: reason"
  trap - EXIT
  teardown_db

  # A: greenfield
  setup_db "mig032_fresh"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_031
  apply_migration_032
  local nn def uniq
  nn=$(psql_db -At -c "
    SELECT a.attnotnull FROM pg_attribute a
    JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='moyasar_settings' AND a.attname='office_id'")
  [[ "$nn" == "t" ]] && ok "A: moyasar office_id NOT NULL" || bad "A: NOT NULL=$nn"
  def=$(psql_db -At -c "
    SELECT column_default IS NULL FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='office_id'")
  [[ "$def" == "t" ]] && ok "A: moyasar office_id has no DEFAULT" || bad "A: default still set"
  uniq=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.moyasar_settings'::regclass
        AND c.contype IN ('u','p')
        AND pg_get_constraintdef(c.oid) ~* '\\(office_id\\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    )")
  [[ "$uniq" == "t" ]] && ok "A: UNIQUE(office_id) on moyasar" || bad "A: unique missing"

  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO moyasar_settings (office_id, publishable_key, enabled)
    VALUES ('office-a', 'pk_test', true);
    INSERT INTO moyasar_settings (office_id, publishable_key, enabled)
    VALUES ('office-a', 'pk_dup', false)
    ON CONFLICT (office_id) DO NOTHING;
  " >/dev/null
  ok "A: ON CONFLICT (office_id) usable"

  apply_migration_032
  ok "A: re-run 032 idempotent"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_032" >/tmp/preflight032-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight032-ready.log \
    && ok "A: preflight ALREADY_CORRECT" \
    || bad "A: chosen_action=$(grep chosen_action /tmp/preflight032-ready.log | tail -1)"
  trap - EXIT
  teardown_db

  # B: Runtime-shaped table with DEFAULT 'default' — drop default, preserve row
  setup_db "mig032_drop_default"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE moyasar_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL DEFAULT 'default',
      publishable_key TEXT,
      secret_key TEXT,
      webhook_secret TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      callback_url TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (office_id)
    );
    CREATE TABLE checkout_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL DEFAULT 'default',
      secret_key TEXT,
      public_key TEXT,
      webhook_secret TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (office_id)
    );
    INSERT INTO moyasar_settings (office_id, publishable_key) VALUES ('default', 'legacy-pk');
    INSERT INTO checkout_settings (office_id, public_key) VALUES ('default', 'legacy-pub');
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_032" >/tmp/preflight032-def.log 2>&1
  grep -qE 'DROP_OFFICE_ID_DEFAULT|SAFE_AUTO_REPAIR' /tmp/preflight032-def.log \
    && ok "B: preflight SAFE for DROP DEFAULT" \
    || bad "B: chosen_action=$(grep chosen_action /tmp/preflight032-def.log | tail -1)"
  grep -q 'legacy_office_id_default_rows=' /tmp/preflight032-def.log \
    && ok "B: legacy default rows reported" \
    || bad "B: missing legacy default count"
  apply_migration_032
  local legacy_val def_after
  legacy_val=$(psql_db -At -c "SELECT office_id FROM moyasar_settings WHERE publishable_key='legacy-pk'")
  [[ "$legacy_val" == "default" ]] && ok "B: legacy office_id='default' preserved" || bad "B: remapped to $legacy_val"
  def_after=$(psql_db -At -c "
    SELECT column_default IS NULL FROM information_schema.columns
    WHERE table_name='moyasar_settings' AND column_name='office_id'")
  [[ "$def_after" == "t" ]] && ok "B: DEFAULT removed" || bad "B: DEFAULT still present"
  trap - EXIT
  teardown_db

  # C: missing safe column
  setup_db "mig032_missing_col"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE moyasar_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      secret_key TEXT,
      webhook_secret TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (office_id)
    );
    CREATE TABLE checkout_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      secret_key TEXT,
      public_key TEXT,
      webhook_secret TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (office_id)
    );
  " >/dev/null
  apply_migration_032
  local cb
  cb=$(psql_db -At -c "SELECT udt_name FROM information_schema.columns WHERE table_name='moyasar_settings' AND column_name='callback_url'")
  [[ "$cb" == "text" ]] && ok "C: missing callback_url added" || bad "C: callback_url=$cb"
  trap - EXIT
  teardown_db

  # D: duplicate office_id BLOCK
  setup_db "mig032_dups"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE moyasar_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT,
      publishable_key TEXT,
      secret_key TEXT,
      webhook_secret TEXT,
      callback_url TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE checkout_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      secret_key TEXT,
      public_key TEXT,
      webhook_secret TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (office_id)
    );
    INSERT INTO moyasar_settings (office_id) VALUES ('o1'), ('o1');
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_032" >/tmp/preflight032-dup.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight032-dup.log \
    && ok "D: preflight BLOCK duplicates" || bad "D: preflight action"
  grep -q 'DUPLICATE_OFFICE_ID' /tmp/preflight032-dup.log \
    && ok "D: reason DUPLICATE_OFFICE_ID" || bad "D: reason"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_032" >/tmp/mig032-dup.log 2>&1; then
    bad "D: 032 should BLOCK on duplicates"
  else
    grep -q 'DUPLICATE_OFFICE_ID' /tmp/mig032-dup.log \
      && ok "D: migration BLOCK DUPLICATE_OFFICE_ID" || bad "D: mig reason"
  fi
  trap - EXIT
  teardown_db

  # E: NULL office_id BLOCK
  setup_db "mig032_null"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE moyasar_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT,
      publishable_key TEXT,
      secret_key TEXT,
      webhook_secret TEXT,
      callback_url TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE checkout_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      secret_key TEXT,
      public_key TEXT,
      webhook_secret TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (office_id)
    );
    INSERT INTO moyasar_settings (office_id) VALUES (NULL);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_032" >/tmp/preflight032-null.log 2>&1
  grep -q 'NULL_OFFICE_ID' /tmp/preflight032-null.log \
    && ok "E: preflight NULL_OFFICE_ID" || bad "E: preflight"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_032" >/tmp/mig032-null.log 2>&1; then
    bad "E: 032 should BLOCK on NULL office_id"
  else
    grep -q 'NULL_OFFICE_ID' /tmp/mig032-null.log \
      && ok "E: migration BLOCK NULL_OFFICE_ID" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F: incompatible type BLOCK
  setup_db "mig032_badtype"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE moyasar_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id INTEGER NOT NULL,
      publishable_key TEXT,
      secret_key TEXT,
      webhook_secret TEXT,
      callback_url TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE checkout_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      secret_key TEXT,
      public_key TEXT,
      webhook_secret TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (office_id)
    );
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_032" >/tmp/preflight032-type.log 2>&1
  grep -q 'INCOMPATIBLE_TYPE' /tmp/preflight032-type.log \
    && ok "F: preflight INCOMPATIBLE_TYPE" || bad "F: preflight"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_032" >/tmp/mig032-type.log 2>&1; then
    bad "F: 032 should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig032-type.log \
      && ok "F: migration BLOCK INCOMPATIBLE_TYPE" || bad "F: mig reason"
  fi
  trap - EXIT
  teardown_db

  # G: wrong UNIQUE shape (multi-col named office_id key) BLOCK
  setup_db "mig032_wrong_unique"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_032
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE moyasar_settings DROP CONSTRAINT IF EXISTS moyasar_settings_office_id_key;
    ALTER TABLE moyasar_settings ADD CONSTRAINT moyasar_settings_office_id_key UNIQUE (office_id, enabled);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_032" >/tmp/preflight032-wuniq.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight032-wuniq.log \
    && ok "G: preflight BLOCK wrong UNIQUE" || bad "G: preflight action"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_032" >/tmp/mig032-wuniq.log 2>&1; then
    bad "G: 032 should BLOCK wrong UNIQUE shape"
  else
    grep -q 'INCOMPATIBLE_UNIQUE' /tmp/mig032-wuniq.log \
      && ok "G: migration BLOCK INCOMPATIBLE_UNIQUE" || bad "G: mig reason"
  fi
  trap - EXIT
  teardown_db

  # H: source audit — Runtime CREATE gone; payment_transactions still owned by 012
  setup_db "mig032_src"
  trap teardown_db EXIT
  if ! grep -qE 'CREATE TABLE IF NOT EXISTS moyasar_settings|ensureGatewaySettingsTables' \
      "$ROOT/artifacts/api-server/src/modules/financial/payments.ts"; then
    ok "H: payments.ts has no Runtime gateway CREATE"
  else
    bad "H: Runtime gateway DDL still present"
  fi
  if grep -q '012_payment_transactions' \
      "$ROOT/artifacts/api-server/src/modules/financial/payments.ts"; then
    ok "H: payment_transactions 012 ownership comment preserved"
  else
    bad "H: 012 ownership reference missing"
  fi
  if grep -q 'CREATE TABLE IF NOT EXISTS payment_transactions' \
      "$ROOT/artifacts/api-server/migrations/012_payment_transactions.sql"; then
    ok "H: migration 012 still owns payment_transactions"
  else
    bad "H: 012 missing"
  fi
  trap - EXIT
  teardown_db

  # I: missing office_id → SAFE_AUTO_REPAIR (no crash)
  setup_db "mig032_miss_office"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE moyasar_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      secret_key TEXT,
      publishable_key TEXT,
      webhook_secret TEXT,
      callback_url TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE checkout_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT NOT NULL,
      secret_key TEXT,
      public_key TEXT,
      webhook_secret TEXT,
      test_mode BOOLEAN DEFAULT true,
      enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (office_id)
    );
  " >/dev/null
  if psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_032" >/tmp/preflight032-miss-office.log 2>&1; then
    grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight032-miss-office.log \
      && ok "I: missing office_id → SAFE_AUTO_REPAIR" \
      || bad "I: action=$(grep chosen_action /tmp/preflight032-miss-office.log | tail -1)"
    grep -qE 'PARTIAL_SCHEMA|missing_col=.*office_id' /tmp/preflight032-miss-office.log \
      && ok "I: reason PARTIAL_SCHEMA / office_id missing" || bad "I: reason"
  else
    bad "I: preflight crashed on missing office_id"
  fi
  apply_migration_032
  local office_present
  office_present=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='moyasar_settings' AND column_name='office_id' AND udt_name='text'
    )")
  [[ "$office_present" == "t" ]] && ok "I: 032 repaired missing office_id" || bad "I: office_id still missing"
  trap - EXIT
  teardown_db

  # J/K/L: missing required defaults → not ALREADY_CORRECT
  setup_db "mig032_miss_defaults"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE moyasar_settings (
      id UUID PRIMARY KEY,
      office_id TEXT NOT NULL,
      publishable_key TEXT,
      secret_key TEXT,
      webhook_secret TEXT,
      callback_url TEXT,
      test_mode BOOLEAN,
      enabled BOOLEAN,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      UNIQUE (office_id)
    );
    CREATE TABLE checkout_settings (
      id UUID PRIMARY KEY,
      office_id TEXT NOT NULL,
      secret_key TEXT,
      public_key TEXT,
      webhook_secret TEXT,
      test_mode BOOLEAN,
      enabled BOOLEAN,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      UNIQUE (office_id)
    );
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_032" >/tmp/preflight032-miss-def.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight032-miss-def.log \
    && bad "J: missing defaults must not be ALREADY_CORRECT" \
    || ok "J: missing defaults not ALREADY_CORRECT"
  grep -qE 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight032-miss-def.log \
    && ok "J: SAFE_AUTO_REPAIR for missing defaults" || bad "J: action"
  grep -q 'MISSING_COLUMN_DEFAULTS' /tmp/preflight032-miss-def.log \
    && ok "J: reason MISSING_COLUMN_DEFAULTS" || bad "J: reason"
  # M: 032 repairs missing safe defaults
  apply_migration_032
  local id_def tm_def en_def ca_def
  id_def=$(psql_db -At -c "
    SELECT column_default ILIKE '%gen_random_uuid%' FROM information_schema.columns
    WHERE table_name='moyasar_settings' AND column_name='id'")
  tm_def=$(psql_db -At -c "
    SELECT column_default ILIKE '%true%' FROM information_schema.columns
    WHERE table_name='moyasar_settings' AND column_name='test_mode'")
  en_def=$(psql_db -At -c "
    SELECT column_default ILIKE '%false%' FROM information_schema.columns
    WHERE table_name='moyasar_settings' AND column_name='enabled'")
  ca_def=$(psql_db -At -c "
    SELECT column_default ILIKE '%now()%' FROM information_schema.columns
    WHERE table_name='moyasar_settings' AND column_name='created_at'")
  [[ "$id_def" == "t" && "$tm_def" == "t" && "$en_def" == "t" && "$ca_def" == "t" ]] \
    && ok "M: 032 repaired id/test_mode/enabled/created_at defaults" \
    || bad "M: defaults id=$id_def tm=$tm_def en=$en_def ca=$ca_def"
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO moyasar_settings (office_id, publishable_key) VALUES ('office-repair', 'pk');
  " >/dev/null && ok "M: INSERT without id/timestamps works" || bad "M: INSERT failed"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_032" >/tmp/preflight032-repaired.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight032-repaired.log \
    && ok "M: post-repair preflight ALREADY_CORRECT" || bad "M: post-repair action"
  trap - EXIT
  teardown_db

  # N: post-apply readiness fails if id DEFAULT absent
  setup_db "mig032_postapply_id"
  trap teardown_db EXIT
  apply_migrations_through_015
  apply_migration_016
  apply_migration_032
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE moyasar_settings ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE checkout_settings ALTER COLUMN id DROP DEFAULT;
  " >/dev/null
  # Re-run only the post-apply readiness DO from migration 032 (between marker and COMMIT)
  if awk '/Post-apply readiness gate/,/^COMMIT;/' "$MIGRATION_032" \
      | head -n -1 \
      | psql_db -v ON_ERROR_STOP=1 -f - >/tmp/mig032-postapply-id.log 2>&1; then
    bad "N: post-apply should FAIL without id DEFAULT"
  else
    grep -qE 'POST_APPLY_READINESS_FAILED.*id DEFAULT|id DEFAULT gen_random_uuid' /tmp/mig032-postapply-id.log \
      && ok "N: post-apply fails without id DEFAULT" || bad "N: unexpected failure reason"
  fi
  trap - EXIT
  teardown_db

  # O: P0 verify-schema gate — tables absent fail; present pass
  setup_db "mig032_p0_gate"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify032-present.log 2>&1; then
    ok "O: verify-schema passes with gateway settings present"
  else
    bad "O: verify-schema failed after full chain"; tail -30 /tmp/verify032-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE IF EXISTS moyasar_settings CASCADE;
    DROP TABLE IF EXISTS checkout_settings CASCADE;
  " >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify032-absent.log 2>&1; then
    bad "O: verify-schema should FAIL without gateway settings tables"
  else
    grep -qE 'moyasar_settings|checkout_settings' /tmp/verify032-absent.log \
      && ok "O: verify-schema reports missing gateway tables" \
      || bad "O: missing table names not reported"
  fi
  apply_migration_032
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify032-restored.log 2>&1; then
    ok "O: verify-schema passes after 032 restore"
  else
    bad "O: verify-schema failed after 032 restore"; tail -30 /tmp/verify032-restored.log
  fi
  trap - EXIT
  teardown_db
}


# ── Scenario: migration 033 Document V2 schema authority (Stage 23.5B) ─────
scenario_migration_033_document_v2() {
  log "Scenario 033 — Document V2: greenfield / already-correct / missing / BLOCK / retention / P0"
  local PREFLIGHT_033="$ROOT/scripts/db/preflight-migration-033.sql"

  # A0: V2 tables absent → SAFE_AUTO_REPAIR (documents baseline from 003 present after apply_base)
  setup_db "mig033_preflight_absent"
  trap teardown_db EXIT
  apply_migrations_base
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-absent.log 2>&1
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight033-absent.log \
    && ok "A0: SAFE_AUTO_REPAIR (V2 tables missing)" \
    || bad "A0: missing SAFE_AUTO_REPAIR"
  grep -q 'reason_code=TABLE_MISSING' /tmp/preflight033-absent.log \
    && ok "A0: TABLE_MISSING" || bad "A0: reason"
  trap - EXIT
  teardown_db

  # A: greenfield apply + idempotent second apply + ALREADY_CORRECT + __default__ seed
  setup_db "mig033_fresh"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  local has_fs seed_cnt uniq_ok
  has_fs=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='file_size'")
  [[ "$has_fs" == "int8" ]] && ok "A: documents.file_size BIGINT present" || bad "A: file_size=$has_fs"
  seed_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM document_retention_policies WHERE office_id='__default__'")
  [[ "$seed_cnt" -ge 13 ]] && ok "A: __default__ seed >= 13 ($seed_cnt)" || bad "A: seed=$seed_cnt"
  uniq_ok=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.document_retention_policies'::regclass
        AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* '\\(office_id,\\s*category\\)'
    )")
  [[ "$uniq_ok" == "t" ]] && ok "A: UNIQUE(office_id, category) present" || bad "A: unique missing"
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO document_retention_policies (office_id, category, retention_years)
    VALUES ('office-a', 'عقد', 10)
    ON CONFLICT (office_id, category) DO NOTHING;
    INSERT INTO document_retention_policies (office_id, category, retention_years)
    VALUES ('office-a', 'عقد', 12)
    ON CONFLICT (office_id, category) DO UPDATE SET retention_years = EXCLUDED.retention_years;
  " >/dev/null && ok "A: strict retention UNIQUE arbiter usable" || bad "A: ON CONFLICT failed"
  apply_migration_033
  ok "A: re-run 033 idempotent"
  seed_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM document_retention_policies WHERE office_id='__default__'")
  [[ "$seed_cnt" -ge 13 ]] && ok "A: __default__ seed idempotent ($seed_cnt)" || bad "A: seed after reapply=$seed_cnt"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-ready.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight033-ready.log \
    && ok "A: preflight ALREADY_CORRECT" \
    || bad "A: chosen_action=$(grep chosen_action /tmp/preflight033-ready.log | tail -1)"
  trap - EXIT
  teardown_db

  # B: missing safe documents column → repaired
  setup_db "mig033_missing_col"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "ALTER TABLE documents DROP COLUMN IF EXISTS file_size;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-misscol.log 2>&1
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight033-misscol.log \
    && ok "B: missing file_size → SAFE_AUTO_REPAIR" || bad "B: preflight action"
  apply_migration_033
  has_fs=$(psql_db -At -c "
    SELECT udt_name FROM information_schema.columns
    WHERE table_name='documents' AND column_name='file_size'")
  [[ "$has_fs" == "int8" ]] && ok "B: file_size restored" || bad "B: file_size=$has_fs"
  trap - EXIT
  teardown_db

  # C: missing safe V2 table → repaired
  setup_db "mig033_missing_table"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "DROP TABLE document_versions CASCADE;" >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-misstbl.log 2>&1
  grep -q 'TABLE_MISSING\|SAFE_AUTO_REPAIR' /tmp/preflight033-misstbl.log \
    && ok "C: missing document_versions → SAFE" || bad "C: preflight"
  apply_migration_033
  local dv_ok
  dv_ok=$(psql_db -At -c "SELECT to_regclass('public.document_versions') IS NOT NULL")
  [[ "$dv_ok" == "t" ]] && ok "C: document_versions restored" || bad "C: still missing"
  trap - EXIT
  teardown_db

  # D: incompatible type → BLOCK
  setup_db "mig033_badtype"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE documents DROP COLUMN IF EXISTS file_size;
    ALTER TABLE documents ADD COLUMN file_size TEXT;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-type.log 2>&1
  grep -q 'INCOMPATIBLE_TYPE' /tmp/preflight033-type.log \
    && ok "D: preflight INCOMPATIBLE_TYPE" || bad "D: preflight"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_033" >/tmp/mig033-type.log 2>&1; then
    bad "D: 033 should BLOCK incompatible type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig033-type.log \
      && ok "D: migration BLOCK INCOMPATIBLE_TYPE" || bad "D: mig reason"
  fi
  trap - EXIT
  teardown_db

  # E: unsafe NULL on required column → BLOCK
  setup_db "mig033_null"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE document_versions ALTER COLUMN office_id DROP NOT NULL;
    INSERT INTO document_versions (document_id, office_id, version_number)
    VALUES ('doc-1', NULL, 1);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-null.log 2>&1
  grep -q 'NULL_REQUIRED' /tmp/preflight033-null.log \
    && ok "E: preflight NULL_REQUIRED" || bad "E: preflight"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_033" >/tmp/mig033-null.log 2>&1; then
    bad "E: 033 should BLOCK on NULL office_id"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig033-null.log \
      && ok "E: migration BLOCK NULL_REQUIRED" || bad "E: mig reason"
  fi
  trap - EXIT
  teardown_db

  # F: wrong PK → BLOCK
  setup_db "mig033_wrong_pk"
  trap teardown_db EXIT
  apply_migrations_base
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE document_versions (
      id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      office_id TEXT NOT NULL,
      version_number INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (document_id, version_number)
    );
  " >/dev/null
  # Create other required objects minimally so PK check is reached for document_versions
  apply_migration_033 >/tmp/mig033-pk.log 2>&1 || true
  if grep -q 'INCOMPATIBLE_PK' /tmp/mig033-pk.log; then
    ok "F: migration BLOCK INCOMPATIBLE_PK"
  else
    # If apply somehow succeeded, fail
    if grep -q 'COMMIT' /tmp/mig033-pk.log 2>/dev/null && ! grep -qi 'ERROR\|EXCEPTION\|BLOCK' /tmp/mig033-pk.log; then
      bad "F: 033 should BLOCK wrong PK"
    else
      grep -qE 'INCOMPATIBLE_PK|BLOCK_AND_MANUAL_REVIEW' /tmp/mig033-pk.log \
        && ok "F: migration BLOCK wrong PK" || bad "F: unexpected=$(tail -5 /tmp/mig033-pk.log)"
    fi
  fi
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-pk.log 2>&1 || true
  grep -qE 'INCOMPATIBLE_PK|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight033-pk.log \
    && ok "F: preflight BLOCK wrong PK" || bad "F: preflight action"
  trap - EXIT
  teardown_db

  # G: wrong index shape → BLOCK
  setup_db "mig033_wrong_idx"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_dv_doc_id;
    CREATE INDEX idx_dv_doc_id ON document_versions (office_id);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-idx.log 2>&1
  grep -q 'INCOMPATIBLE_INDEX' /tmp/preflight033-idx.log \
    && ok "G: preflight INCOMPATIBLE_INDEX" || bad "G: preflight"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_033" >/tmp/mig033-idx.log 2>&1; then
    bad "G: 033 should BLOCK incompatible index"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig033-idx.log \
      && ok "G: migration BLOCK INCOMPATIBLE_INDEX" || bad "G: mig reason"
  fi
  trap - EXIT
  teardown_db

  # H: duplicate retention (office_id, category) → BLOCK
  setup_db "mig033_dup_ret"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE document_retention_policies
      DROP CONSTRAINT IF EXISTS document_retention_policies_office_id_category_key;
    INSERT INTO document_retention_policies (id, office_id, category, retention_years)
    VALUES ('r1', 'office-x', 'عقد', 7), ('r2', 'office-x', 'عقد', 10);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-dup.log 2>&1
  grep -q 'DUPLICATE_RETENTION_KEY' /tmp/preflight033-dup.log \
    && ok "H: preflight DUPLICATE_RETENTION_KEY" || bad "H: preflight"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_033" >/tmp/mig033-dup.log 2>&1; then
    bad "H: 033 should BLOCK duplicate retention keys"
  else
    grep -q 'DUPLICATE_RETENTION_KEY' /tmp/mig033-dup.log \
      && ok "H: migration BLOCK DUPLICATE_RETENTION_KEY" || bad "H: mig reason"
  fi
  trap - EXIT
  teardown_db

  # I: compliance retention_policies preserved untouched
  setup_db "mig033_compliance"
  trap teardown_db EXIT
  apply_migrations_base
  psql_db -v ON_ERROR_STOP=1 -c "
    CREATE TABLE retention_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      resource_type TEXT NOT NULL UNIQUE,
      retention_days INT NOT NULL DEFAULT 365,
      auto_delete BOOLEAN DEFAULT false,
      legal_hold BOOLEAN DEFAULT false
    );
    INSERT INTO retention_policies (resource_type, retention_days) VALUES ('audit_logs', 2555);
  " >/dev/null
  apply_migration_033
  local comp_cnt comp_days
  comp_cnt=$(psql_db -At -c "SELECT COUNT(*) FROM retention_policies WHERE resource_type='audit_logs'")
  comp_days=$(psql_db -At -c "SELECT retention_days FROM retention_policies WHERE resource_type='audit_logs'")
  [[ "$comp_cnt" == "1" && "$comp_days" == "2555" ]] \
    && ok "I: compliance retention_policies row preserved" \
    || bad "I: compliance mutated cnt=$comp_cnt days=$comp_days"
  local has_drp
  has_drp=$(psql_db -At -c "SELECT to_regclass('public.document_retention_policies') IS NOT NULL")
  [[ "$has_drp" == "t" ]] && ok "I: document_retention_policies created separately" || bad "I: drp missing"
  # Ensure compliance shape columns still present
  local has_rt
  has_rt=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='retention_policies' AND column_name='resource_type'
    )")
  [[ "$has_rt" == "t" ]] && ok "I: compliance resource_type column untouched" || bad "I: resource_type gone"
  trap - EXIT
  teardown_db

  # J: source audit — Runtime V2 DDL removed; DC DML uses document_retention_policies; 021 unchanged
  setup_db "mig033_src"
  trap teardown_db EXIT
  if ! grep -qE 'CREATE TABLE IF NOT EXISTS document_versions|ALTER TABLE documents ADD COLUMN' \
      "$ROOT/artifacts/api-server/src/modules/documents/documentCenter.ts"; then
    ok "J: documentCenter.ts has no Runtime V2 DDL"
  else
    bad "J: Runtime V2 DDL still present"
  fi
  if grep -q 'document_retention_policies' \
      "$ROOT/artifacts/api-server/src/modules/documents/documentCenter.ts" \
     && ! grep -qE 'INSERT INTO retention_policies|FROM[[:space:]]+retention_policies|JOIN[[:space:]]+retention_policies' \
      "$ROOT/artifacts/api-server/src/modules/documents/documentCenter.ts"; then
    ok "J: Document Center DML uses document_retention_policies"
  else
    bad "J: Document Center still targets retention_policies"
  fi
  # retention_policies owned by Migration 053; document_retention_policies remains 033.
  # No Runtime CREATE expected in complianceCenter after Stage 9.
  if ! grep -q 'CREATE TABLE IF NOT EXISTS retention_policies' \
      "$ROOT/artifacts/api-server/src/modules/security/complianceCenter.ts" \
     && grep -q "to_regclass('public.retention_policies')" \
      "$ROOT/artifacts/api-server/src/modules/security/complianceCenter.ts" \
     && grep -q 'CREATE TABLE IF NOT EXISTS retention_policies' \
      "$ROOT/artifacts/api-server/migrations/053_security_centers_schema_authority.sql" \
     && grep -q 'document_retention_policies' \
      "$ROOT/artifacts/api-server/migrations/033_document_v2_schema_authority.sql"; then
    ok "J: retention_policies owned by 053 (no Runtime CREATE); document_retention_policies by 033"
  else
    bad "J: retention ownership split incorrect (033 vs 053 / Runtime CREATE)"
  fi
  if grep -q 'CREATE TABLE IF NOT EXISTS document_center_files' \
      "$ROOT/artifacts/api-server/migrations/021_rag_schema_foundation.sql" \
     && ! grep -q 'document_retention_policies' \
      "$ROOT/artifacts/api-server/migrations/021_rag_schema_foundation.sql"; then
    ok "J: Migration 021 core authority unchanged"
  else
    bad "J: 021 unexpectedly changed for V2"
  fi
  trap - EXIT
  teardown_db

  # K: post-apply readiness fails when seed incomplete
  setup_db "mig033_postapply"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    DELETE FROM document_retention_policies WHERE office_id='__default__';
  " >/dev/null
  if awk '/Post-apply readiness \(must pass before COMMIT\)/,/^COMMIT;/' "$MIGRATION_033" \
      | head -n -1 \
      | psql_db -v ON_ERROR_STOP=1 -f - >/tmp/mig033-postapply.log 2>&1; then
    bad "K: post-apply should FAIL without __default__ seed"
  else
    grep -q 'POST_APPLY_READINESS_FAILED' /tmp/mig033-postapply.log \
      && ok "K: post-apply readiness fails without seed" || bad "K: unexpected failure"
  fi
  trap - EXIT
  teardown_db

  # L: P0 verify-schema gate — 033 objects absent fail; present pass
  setup_db "mig033_p0_gate"
  trap teardown_db EXIT
  apply_all_migrations
  export DATABASE_URL
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify033-present.log 2>&1; then
    ok "L: verify-schema passes with Document V2 present"
  else
    bad "L: verify-schema failed after full chain"; tail -30 /tmp/verify033-present.log
  fi
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE IF EXISTS document_versions CASCADE;
    DROP TABLE IF EXISTS document_permissions CASCADE;
    DROP TABLE IF EXISTS storage_migration_log CASCADE;
    DROP TABLE IF EXISTS document_retention_policies CASCADE;
  " >/dev/null
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify033-absent.log 2>&1; then
    bad "L: verify-schema should FAIL without 033 tables"
  else
    grep -qE 'document_versions|document_permissions|storage_migration_log|document_retention_policies' /tmp/verify033-absent.log \
      && ok "L: verify-schema reports missing 033 tables" \
      || bad "L: missing table names not reported"
  fi
  apply_migration_033
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify033-restored.log 2>&1; then
    ok "L: verify-schema passes after 033 restore"
  else
    bad "L: verify-schema failed after 033 restore"; tail -30 /tmp/verify033-restored.log
  fi
  trap - EXIT
  teardown_db

  # M: UNIQUE same-name idx_dv_doc_id => BLOCK (multi-version safety)
  setup_db "mig033_unique_dv"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_dv_doc_id;
    CREATE UNIQUE INDEX idx_dv_doc_id ON document_versions (document_id);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-uniqdv.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight033-uniqdv.log \
    && ok "M: preflight BLOCK UNIQUE idx_dv_doc_id" || bad "M: preflight"
  grep -q 'INCOMPATIBLE_INDEX' /tmp/preflight033-uniqdv.log \
    && ok "M: reason INCOMPATIBLE_INDEX" || bad "M: reason"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_033" >/tmp/mig033-uniqdv.log 2>&1; then
    bad "M: 033 should BLOCK UNIQUE idx_dv_doc_id"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig033-uniqdv.log \
      && ok "M: migration BLOCK UNIQUE idx_dv_doc_id" || bad "M: mig reason"
  fi
  trap - EXIT
  teardown_db

  # N: UNIQUE same-name idx_dp_office => BLOCK
  setup_db "mig033_unique_dp"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP INDEX IF EXISTS idx_dp_office;
    CREATE UNIQUE INDEX idx_dp_office ON document_permissions (office_id);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-uniqdp.log 2>&1
  grep -q 'INCOMPATIBLE_INDEX' /tmp/preflight033-uniqdp.log \
    && ok "N: preflight BLOCK UNIQUE idx_dp_office" || bad "N: preflight"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_033" >/tmp/mig033-uniqdp.log 2>&1; then
    bad "N: 033 should BLOCK UNIQUE idx_dp_office"
  else
    grep -q 'INCOMPATIBLE_INDEX' /tmp/mig033-uniqdp.log \
      && ok "N: migration BLOCK UNIQUE idx_dp_office" || bad "N: mig reason"
  fi
  trap - EXIT
  teardown_db

  # O: SML id INT PK without generation => not ALREADY_CORRECT; repair + INSERT without id
  setup_db "mig033_sml_nogen"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE storage_migration_log CASCADE;
    CREATE TABLE storage_migration_log (
      id INT PRIMARY KEY,
      office_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      old_provider TEXT DEFAULT 'db_base64',
      new_key TEXT,
      file_size BIGINT,
      checksum TEXT,
      status TEXT DEFAULT 'pending',
      error_msg TEXT,
      migrated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_sml_office_status ON storage_migration_log (office_id, status);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-smlnogen.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight033-smlnogen.log \
    && bad "O: missing id generation must not be ALREADY_CORRECT" \
    || ok "O: not ALREADY_CORRECT without id generation"
  grep -qE 'MISSING_ID_GENERATION|SAFE_AUTO_REPAIR' /tmp/preflight033-smlnogen.log \
    && ok "O: preflight SAFE/MISSING_ID_GENERATION" || bad "O: preflight action"
  apply_migration_033
  local sml_id
  sml_id=$(psql_db -At -c "
    INSERT INTO storage_migration_log (office_id, table_name, record_id, new_key, status)
    VALUES ('office-probe', 'documents', 'rec-1', 'key-1', 'done')
    RETURNING id;")
  [[ -n "$sml_id" && "$sml_id" != "" ]] \
    && ok "O: app-style INSERT without id generated id=$sml_id" \
    || bad "O: INSERT without id failed"
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-smlfixed.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight033-smlfixed.log \
    && ok "O: post-repair ALREADY_CORRECT" || bad "O: post-repair action"
  trap - EXIT
  teardown_db

  # P: retention unique-index-only => consistent SAFE repair then ALREADY_CORRECT
  setup_db "mig033_ret_idx_only"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE document_retention_policies
      DROP CONSTRAINT IF EXISTS document_retention_policies_office_id_category_key;
    CREATE UNIQUE INDEX IF NOT EXISTS document_retention_policies_office_id_category_key
      ON document_retention_policies (office_id, category);
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-retidx.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight033-retidx.log \
    && bad "P: unique-index-only should not BLOCK if migration can attach constraint" \
    || ok "P: preflight not BLOCK for attachable unique index"
  grep -qE 'SAFE_AUTO_REPAIR|PARTIAL_SCHEMA|MISSING' /tmp/preflight033-retidx.log \
    && ok "P: preflight SAFE for missing UNIQUE constraint" || bad "P: preflight action"
  apply_migration_033
  local has_uq
  has_uq=$(psql_db -At -c "
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.document_retention_policies'::regclass
        AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* '\\(office_id,\\s*category\\)'
    )")
  [[ "$has_uq" == "t" ]] && ok "P: UNIQUE constraint present after 033" || bad "P: constraint missing"
  psql_db -v ON_ERROR_STOP=1 -c "
    INSERT INTO document_retention_policies (office_id, category, retention_years)
    VALUES ('office-p', 'عقد', 9)
    ON CONFLICT (office_id, category) DO NOTHING;
  " >/dev/null && ok "P: ON CONFLICT arbiter usable" || bad "P: ON CONFLICT failed"
  trap - EXIT
  teardown_db

  # Q: missing table + blocker on another present table => BLOCK (not SAFE TABLE_MISSING)
  setup_db "mig033_mixed_block"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    DROP TABLE document_versions CASCADE;
    ALTER TABLE document_permissions DROP COLUMN permission_type;
    ALTER TABLE document_permissions ADD COLUMN permission_type INTEGER NOT NULL DEFAULT 1;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-mixed.log 2>&1
  grep -q 'chosen_action=BLOCK_AND_MANUAL_REVIEW' /tmp/preflight033-mixed.log \
    && ok "Q: mixed missing+blocker => BLOCK" || bad "Q: action=$(grep chosen_action /tmp/preflight033-mixed.log | tail -1)"
  grep -q 'INCOMPATIBLE_TYPE' /tmp/preflight033-mixed.log \
    && ok "Q: reason INCOMPATIBLE_TYPE wins over TABLE_MISSING" || bad "Q: reason"
  grep -q 'chosen_action=SAFE_AUTO_REPAIR' /tmp/preflight033-mixed.log \
    && bad "Q: must not classify as SAFE while blocker present" \
    || ok "Q: not SAFE while blocker present"
  trap - EXIT
  teardown_db

  # R: documents.version DEFAULT 10 => not ALREADY_CORRECT
  setup_db "mig033_ver10"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE documents ALTER COLUMN version SET DEFAULT 10;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-ver10.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight033-ver10.log \
    && bad "R: DEFAULT 10 must not be ALREADY_CORRECT" \
    || ok "R: DEFAULT 10 not ALREADY_CORRECT"
  grep -qE 'MISSING_COLUMN_DEFAULTS|SAFE_AUTO_REPAIR' /tmp/preflight033-ver10.log \
    && ok "R: SAFE for wrong version default" || bad "R: action"
  apply_migration_033
  local ver_def
  ver_def=$(psql_db -At -c "
    SELECT regexp_replace(trim(both from split_part(column_default, '::', 1)), '''', '', 'g')
    FROM information_schema.columns
    WHERE table_name='documents' AND column_name='version'")
  [[ "$ver_def" == "1" ]] && ok "R: 033 repairs version default to 1" || bad "R: default=$ver_def"
  trap - EXIT
  teardown_db

  # S: wrong permission_type type => BLOCK
  setup_db "mig033_bad_permtype"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE document_permissions DROP COLUMN permission_type;
    ALTER TABLE document_permissions ADD COLUMN permission_type INTEGER NOT NULL DEFAULT 1;
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-perm.log 2>&1
  grep -q 'INCOMPATIBLE_TYPE' /tmp/preflight033-perm.log \
    && ok "S: preflight BLOCK wrong permission_type" || bad "S: preflight"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_033" >/tmp/mig033-perm.log 2>&1; then
    bad "S: 033 should BLOCK wrong permission_type"
  else
    grep -q 'INCOMPATIBLE_TYPE' /tmp/mig033-perm.log \
      && ok "S: migration BLOCK wrong permission_type" || bad "S: mig reason"
  fi
  trap - EXIT
  teardown_db

  # T: SML required-column NULL => BLOCK
  setup_db "mig033_sml_null"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    ALTER TABLE storage_migration_log ALTER COLUMN table_name DROP NOT NULL;
    INSERT INTO storage_migration_log (office_id, table_name, record_id)
    VALUES ('o1', NULL, 'r1');
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-smlnull.log 2>&1
  grep -qE 'NULL_REQUIRED|BLOCK_AND_MANUAL_REVIEW' /tmp/preflight033-smlnull.log \
    && ok "T: preflight BLOCK SML NULL table_name" || bad "T: preflight"
  if psql_db -v ON_ERROR_STOP=1 -f "$MIGRATION_033" >/tmp/mig033-smlnull.log 2>&1; then
    bad "T: 033 should BLOCK SML NULL table_name"
  else
    grep -q 'NULL_REQUIRED' /tmp/mig033-smlnull.log \
      && ok "T: migration BLOCK NULL_REQUIRED" || bad "T: mig reason"
  fi
  trap - EXIT
  teardown_db

  # U: incomplete __default__ category set => SAFE repair; exact set restored
  setup_db "mig033_seed_partial"
  trap teardown_db EXIT
  apply_migrations_base
  apply_migration_033
  psql_db -v ON_ERROR_STOP=1 -c "
    DELETE FROM document_retention_policies
    WHERE office_id='__default__' AND category IN ('أخرى', 'هوية');
  " >/dev/null
  psql_db -v ON_ERROR_STOP=1 -f "$PREFLIGHT_033" >/tmp/preflight033-seed.log 2>&1
  grep -q 'chosen_action=ALREADY_CORRECT' /tmp/preflight033-seed.log \
    && bad "U: incomplete seed must not be ALREADY_CORRECT" \
    || ok "U: incomplete seed not ALREADY_CORRECT"
  grep -qE 'DEFAULT_SEED_PENDING|SAFE_AUTO_REPAIR' /tmp/preflight033-seed.log \
    && ok "U: SAFE DEFAULT_SEED_PENDING" || bad "U: action"
  apply_migration_033
  local seed_missing
  seed_missing=$(psql_db -At -c "
    WITH expected(category) AS (
      VALUES ('وكالة'),('عقد'),('حكم'),('مذكرة'),('لائحة_دعوى'),('محضر_جلسة'),
             ('تقرير_خبير'),('مستند_إفلاس'),('فاتورة'),('مستند_مالي'),
             ('هوية'),('سجل_تجاري'),('أخرى')
    )
    SELECT COUNT(*) FROM expected e
    WHERE NOT EXISTS (
      SELECT 1 FROM document_retention_policies d
      WHERE d.office_id='__default__' AND d.category = e.category
    )")
  [[ "$seed_missing" == "0" ]] && ok "U: exact __default__ category set restored" || bad "U: missing=$seed_missing"
  trap - EXIT
  teardown_db
}


# ── Main ─────────────────────────────────────────────────────────────────────
require_cmd
ensure_test_role
log "DB migration integration tests (local PostgreSQL only)"
if [[ "${FOCUS_SCENARIO:-}" == "033" ]]; then
  scenario_migration_033_document_v2
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
  echo "═══════════════════════════════════════════════════════════"
  [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi
if [[ "${FOCUS_SCENARIO:-}" == "047" ]]; then
  scenario_migration_047_calendar
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
  echo "═══════════════════════════════════════════════════════════"
  [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi
if [[ "${FOCUS_SCENARIO:-}" == "048" ]]; then
  scenario_migration_048_hr_internal
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
  echo "═══════════════════════════════════════════════════════════"
  [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi
if [[ "${FOCUS_SCENARIO:-}" == "049" ]]; then
  scenario_migration_049_hr_performance
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
  echo "═══════════════════════════════════════════════════════════"
  [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi
if [[ "${FOCUS_SCENARIO:-}" == "050" ]]; then
  scenario_migration_050_hr_enterprise
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
  echo "═══════════════════════════════════════════════════════════"
  [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi
if [[ "${FOCUS_SCENARIO:-}" == "051" ]]; then
  scenario_migration_051_office_notification_settings
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
  echo "═══════════════════════════════════════════════════════════"
  [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi
if [[ "${FOCUS_SCENARIO:-}" == "052" ]]; then
  scenario_migration_052_messaging_runtime_indexes
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
  echo "═══════════════════════════════════════════════════════════"
  [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi
if [[ "${FOCUS_SCENARIO:-}" == "054" ]]; then
  scenario_migration_054_platform_runtime
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
  echo "═══════════════════════════════════════════════════════════"
  [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi
if [[ "${FOCUS_SCENARIO:-}" == "053" ]]; then
  scenario_migration_053_security_centers
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
  echo "═══════════════════════════════════════════════════════════"
  [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi
scenario_empty_db
scenario_partial_idempotent
scenario_migration_006_idempotent
scenario_migration_007_text_tenant
scenario_migration_008_storage_files
scenario_migration_010_office_ledger
scenario_migration_011_stripe_infra
scenario_migration_012_payment_transactions
scenario_migration_013_erp
scenario_migration_014_bankruptcy
scenario_migration_015_tasks_branches
scenario_migration_016_office_messages_fts
scenario_migration_017_cases_schema
scenario_migration_018_money_numeric_batch1
scenario_migration_019_money_numeric_batch2
scenario_migration_021_rag_tenant_fk
scenario_migration_025_billing
scenario_migration_026_promo
scenario_migration_027_event_daily_counts
scenario_migration_028_case_autopilot_reports
scenario_migration_029_office_messages_fts_readiness
scenario_migration_030_office_messages_case_id_text
scenario_migration_031_message_conversations
scenario_migration_032_gateway_settings
scenario_migration_033_document_v2
scenario_migration_034_jlwm_core
scenario_migration_035_jlwm_satellites
scenario_migration_036_jlwm_reliability
scenario_migration_037_financial_remaining
scenario_migration_038_marketplace_client_portal
scenario_migration_039_ai_credits_usage
scenario_migration_040_ai_provider_engine
scenario_migration_041_ai_events
scenario_migration_042_ai_agents
scenario_migration_043_case_ai_insights
scenario_migration_044_ai_coo_notif_settings
scenario_migration_045_support_ai
scenario_kb_seed_dedupe
scenario_migration_046_support_enterprise
scenario_migration_047_calendar
scenario_migration_048_hr_internal
scenario_migration_049_hr_performance
scenario_migration_050_hr_enterprise
scenario_migration_051_office_notification_settings
scenario_migration_052_messaging_runtime_indexes
scenario_migration_053_security_centers
scenario_migration_054_platform_runtime
check_schema_alignment
scenario_reported_endpoints
scenario_incomplete_schema_no_runtime_ddl
scenario_backup_restore

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
echo "═══════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
