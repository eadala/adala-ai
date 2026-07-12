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
MIGRATIONS=(
  "$ROOT/artifacts/api-server/migrations/003_drizzle_baseline_safe.sql"
  "$ROOT/artifacts/api-server/migrations/001_tenant_isolation.sql"
  "$ROOT/artifacts/api-server/migrations/004_legal_core_extensions.sql"
  "$ROOT/artifacts/api-server/migrations/005_tenant_platform_tables.sql"
)

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

apply_migrations() {
  for f in "${MIGRATIONS[@]}"; do
    psql_db -f "$f" >/dev/null
  done
}

# ── Scenario 1: empty database ─────────────────────────────────────────────
scenario_empty_db() {
  log "Scenario 1 — empty DB → migrations 003,001,004,005 → verify-schema"
  setup_db "empty"
  trap teardown_db EXIT

  apply_migrations

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

  apply_migrations
  apply_migrations

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
  apply_migrations

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
  apply_migrations

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

# ── Main ─────────────────────────────────────────────────────────────────────
require_cmd
ensure_test_role
log "DB migration integration tests (local PostgreSQL only)"
scenario_empty_db
scenario_partial_idempotent
check_schema_alignment
scenario_backup_restore

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
echo "═══════════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
