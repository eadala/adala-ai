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

apply_all_migrations() {
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

# ── Scenario 1: empty database ─────────────────────────────────────────────
scenario_empty_db() {
  log "Scenario 1 — empty DB → migrations 003,001,004,005,006,007,008,009,010,011,012,013 → verify-schema"
  setup_db "empty"
  trap teardown_db EXIT

  apply_all_migrations

  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify-empty.log 2>&1; then
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

  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify-partial.log 2>&1; then
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
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify-006.log 2>&1; then
    ok "verify-schema.sh passed after 006→013"
  else
    bad "verify-schema.sh failed after 006→013"
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

  # P0 includes Stripe (011) + payments (012) + ERP (013)
  apply_migration_011
  apply_migration_012
  apply_migration_013
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify-010.log 2>&1; then
    ok "A: verify-schema.sh passed after 010→013"
  else
    bad "A: verify-schema.sh failed after 010→013"; tail -20 /tmp/verify-010.log
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
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify-011.log 2>&1; then
    ok "A: verify-schema.sh passed after 011→013"
  else
    bad "A: verify-schema.sh failed after 011→013"; tail -20 /tmp/verify-011.log
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
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify-012.log 2>&1; then
    ok "A: verify-schema.sh passed after 012+013"
  else
    bad "A: verify-schema.sh failed after 012+013"; tail -20 /tmp/verify-012.log
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
  log "Scenario 3g — migration 013: fresh / complete / partial / unique dup / invalid checks / idempotent"

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

  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify-013.log 2>&1; then
    ok "A: verify-schema.sh passed after 013"
  else
    bad "A: verify-schema.sh failed after 013"; tail -20 /tmp/verify-013.log
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

  apply_migration_013
  ok "D/F: re-run 013 after unique skip succeeded"

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

  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify-endpoints.log 2>&1; then
    ok "verify-schema.sh passed after full chain including 006→013"
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

  trap - EXIT
  teardown_db
}

# ── Main ─────────────────────────────────────────────────────────────────────
require_cmd
ensure_test_role
log "DB migration integration tests (local PostgreSQL only)"
scenario_empty_db
scenario_partial_idempotent
scenario_migration_006_idempotent
scenario_migration_007_text_tenant
scenario_migration_008_storage_files
scenario_migration_010_office_ledger
scenario_migration_011_stripe_infra
scenario_migration_012_payment_transactions
scenario_migration_013_erp
check_schema_alignment
scenario_reported_endpoints
scenario_incomplete_schema_no_runtime_ddl
scenario_backup_restore

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
echo "═══════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
