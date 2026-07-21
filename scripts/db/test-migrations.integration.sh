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

apply_all_migrations() {
  apply_migrations_base
  apply_migration_006
  apply_migration_007
  apply_migration_008
  apply_migration_009
}

# ── Scenario 1: empty database ─────────────────────────────────────────────
scenario_empty_db() {
  log "Scenario 1 — empty DB → migrations 003,001,004,005,006,007,008,009 → verify-schema"
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

  # P0 includes office_storage_quota (007) + storage_files (008)
  apply_migration_007
  apply_migration_008
  if bash "$ROOT/scripts/db/verify-schema.sh" >/tmp/verify-006.log 2>&1; then
    ok "verify-schema.sh passed after 006+007+008"
  else
    bad "verify-schema.sh failed after 006+007+008"
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
    ok "verify-schema.sh passed after full chain including 006+007+008"
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
  if ! grep -qE 'CREATE TABLE|ensureTable|ensureLoginLogs|ensureTables|ensureEventsTable|ensureAdHocColumns' \
      "$ROOT/artifacts/api-server/src/modules/platform/loginTracking.ts" \
      "$ROOT/artifacts/api-server/src/routes/metrics.ts" \
      "$ROOT/artifacts/api-server/src/modules/legal-core/contracts.ts" \
      "$ROOT/artifacts/api-server/src/core/eventBus.ts" \
      "$ROOT/artifacts/api-server/src/modules/platform/trialOnboarding.ts" \
      "$ROOT/artifacts/api-server/src/modules/platform/onboarding.ts" \
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
check_schema_alignment
scenario_reported_endpoints
scenario_incomplete_schema_no_runtime_ddl
scenario_backup_restore

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
echo "═══════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
