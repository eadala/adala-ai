#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# test-migration-023.integration.sh — Stage 15.2c legacy trial_* → UUID
#
# Ephemeral local PostgreSQL only. Does NOT touch production.
# Usage (repo root):
#   bash scripts/db/test-migration-023.integration.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG023="$ROOT/artifacts/api-server/migrations/023_trial_uuid_offices.sql"
MIGRATIONS_BASE=(
  "$ROOT/artifacts/api-server/migrations/003_drizzle_baseline_safe.sql"
  "$ROOT/artifacts/api-server/migrations/001_tenant_isolation.sql"
  "$ROOT/artifacts/api-server/migrations/004_legal_core_extensions.sql"
  "$ROOT/artifacts/api-server/migrations/005_tenant_platform_tables.sql"
)
MIGRATION_007="$ROOT/artifacts/api-server/migrations/007_office_storage_quota_text_tenant.sql"
MIGRATION_008="$ROOT/artifacts/api-server/migrations/008_storage_files_text_tenant.sql"
MIGRATION_015="$ROOT/artifacts/api-server/migrations/015_tasks_branches_schema.sql"

PASS=0
FAIL=0

ok()   { echo "  ✅ $*"; PASS=$((PASS + 1)); }
bad()  { echo "  ❌ $*"; FAIL=$((FAIL + 1)); }
log()  { echo ""; echo "══ $*"; }

require_cmd() {
  command -v psql >/dev/null || { echo "psql required"; exit 2; }
}

ensure_role() {
  sudo -u postgres psql -c "DO \$\$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'adala_test') THEN
      CREATE ROLE adala_test LOGIN PASSWORD 'test' SUPERUSER;
    END IF;
  END \$\$;" >/dev/null 2>&1 || true
}

setup_db() {
  local suffix="$1"
  TEST_DB="adala_023_${suffix}_$$"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${TEST_DB}\";" >/dev/null 2>&1 || true
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${TEST_DB}\";" >/dev/null
}

psql_db() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$TEST_DB" "$@"
}

teardown_db() {
  [[ -n "${TEST_DB:-}" ]] && sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"${TEST_DB}\";" >/dev/null 2>&1 || true
}

apply_base() {
  for f in "${MIGRATIONS_BASE[@]}"; do
    psql_db -f "$f" >/dev/null
  done
  psql_db -f "$MIGRATION_007" >/dev/null
  psql_db -f "$MIGRATION_008" >/dev/null
  psql_db -f "$MIGRATION_015" >/dev/null
}

seed_user() {
  local uid="$1" email="$2"
  psql_db -c "INSERT INTO users (id, email, full_name, status, role)
              VALUES ('${uid}', '${email}', 'Test User', 'active', 'lawyer')
              ON CONFLICT (id) DO NOTHING;" >/dev/null
}

# ── 1) One normal legacy trial user ────────────────────────────────────────
scenario_one_legacy_user() {
  log "scenario: one normal legacy trial user"
  setup_db one
  trap teardown_db EXIT
  apply_base
  seed_user "user_a" "a@test.local"
  psql_db <<'SQL' >/dev/null
INSERT INTO trial_offices (user_id, office_id, office_name)
VALUES ('user_a', 'trial_aaaa1111', 'مكتب أ');
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_aaaa1111', 'user_a', 'owner', 'active');
UPDATE users SET office_id = 'trial_aaaa1111' WHERE id = 'user_a';
INSERT INTO onboarding_state (user_id, office_id, completed, step)
VALUES ('user_a', 'trial_aaaa1111', true, 10);
INSERT INTO cases (id, title, office_id) VALUES ('case_a1', 'قضية', 'trial_aaaa1111');
INSERT INTO tasks (id, title, office_id, status)
VALUES ('aaaaaaaa-0001-4000-8000-0000000000a1'::uuid, 'مهمة', 'trial_aaaa1111', 'pending');
SQL
  psql_db -f "$MIG023" >/dev/null
  local new_id
  new_id=$(psql_db -At -c "SELECT new_office_uuid::text FROM legacy_trial_office_map WHERE old_office_id='trial_aaaa1111'")
  [[ "$new_id" =~ ^[0-9a-f-]{36}$ ]] && ok "mapped to UUID $new_id" || bad "expected UUID map"
  psql_db -At -c "SELECT office_id FROM office_members WHERE user_id='user_a' AND status='active'" | grep -qx "$new_id" \
    && ok "membership remapped" || bad "membership not remapped"
  psql_db -At -c "SELECT office_id FROM cases WHERE id='case_a1'" | grep -qx "$new_id" \
    && ok "case remapped by exact old id" || bad "case not remapped"
  psql_db -At -c "SELECT office_id FROM tasks WHERE id='aaaaaaaa-0001-4000-8000-0000000000a1'::uuid" | grep -qx "$new_id" \
    && ok "task trial_* remapped" || bad "task not remapped"
  psql_db -At -c "SELECT COUNT(*) FROM office_members WHERE status='active' AND office_id LIKE 'trial_%'" | grep -qx 0 \
    && ok "no active trial_* memberships" || bad "trial_* membership remains"
  trap - EXIT
  teardown_db
}

# ── 2) Two legacy ids for one owner → one UUID ─────────────────────────────
scenario_two_ids_one_owner() {
  log "scenario: two trial_* ids for one owner"
  setup_db two
  trap teardown_db EXIT
  apply_base
  seed_user "user_b" "b@test.local"
  psql_db <<'SQL' >/dev/null
INSERT INTO trial_offices (user_id, office_id, office_name)
VALUES ('user_b', 'trial_bbbb0001', 'مكتب ب');
INSERT INTO office_members (office_id, user_id, role, status) VALUES
  ('trial_bbbb0001', 'user_b', 'owner', 'active'),
  ('trial_bbbb0002', 'user_b', 'owner', 'active');
INSERT INTO cases (id, title, office_id) VALUES
  ('case_b1', 'c1', 'trial_bbbb0001'),
  ('case_b2', 'c2', 'trial_bbbb0002');
SQL
  psql_db -f "$MIG023" >/dev/null
  local n
  n=$(psql_db -At -c "SELECT COUNT(DISTINCT new_office_uuid) FROM legacy_trial_office_map WHERE owner_user_id='user_b'")
  [[ "$n" == "1" ]] && ok "both trial ids map to one UUID" || bad "expected one UUID for owner, got $n"
  n=$(psql_db -At -c "SELECT COUNT(DISTINCT office_id) FROM cases WHERE id IN ('case_b1','case_b2')")
  [[ "$n" == "1" ]] && ok "both cases share canonical office" || bad "cases not collapsed"
  n=$(psql_db -At -c "SELECT COUNT(*) FROM office_members WHERE user_id='user_b' AND status='active'")
  [[ "$n" == "1" ]] && ok "single active membership" || bad "duplicate active memberships remain ($n)"
  trap - EXIT
  teardown_db
}

# ── 3) Conflicting owners → fail closed / full rollback ────────────────────
scenario_conflict_owners() {
  log "scenario: one trial_* with conflicting owners"
  setup_db conflict
  trap teardown_db EXIT
  apply_base
  seed_user "user_c1" "c1@test.local"
  seed_user "user_c2" "c2@test.local"
  psql_db <<'SQL' >/dev/null
INSERT INTO trial_offices (user_id, office_id, office_name)
VALUES ('user_c1', 'trial_conflict1', 'مكتب');
INSERT INTO office_members (office_id, user_id, role, status) VALUES
  ('trial_conflict1', 'user_c1', 'owner', 'active'),
  ('trial_conflict1', 'user_c2', 'owner', 'active');
INSERT INTO cases (id, title, office_id) VALUES ('case_c1', 'x', 'trial_conflict1');
SQL
  if psql_db -f "$MIG023" >/tmp/mig023_conflict.log 2>&1; then
    bad "migration should have failed on conflicting owners"
  else
    ok "migration aborted on conflict"
  fi
  # Transaction rollback: map table may exist empty from CREATE TABLE before DO fails...
  # CREATE TABLE is in same txn as DO — full rollback means map table gone OR empty.
  local case_oid
  case_oid=$(psql_db -At -c "SELECT office_id FROM cases WHERE id='case_c1'")
  [[ "$case_oid" == "trial_conflict1" ]] && ok "case unchanged after rollback" || bad "case was remapped despite conflict ($case_oid)"
  local map_exists
  map_exists=$(psql_db -At -c "SELECT to_regclass('public.legacy_trial_office_map') IS NOT NULL")
  if [[ "$map_exists" == "t" ]]; then
    local mc
    mc=$(psql_db -At -c "SELECT COUNT(*) FROM legacy_trial_office_map")
    [[ "$mc" == "0" ]] && ok "no map rows after failed migration" || bad "map rows persisted after conflict ($mc)"
  else
    ok "map table rolled back with transaction"
  fi
  trap - EXIT
  teardown_db
}

# ── 4) Owner already has UUID office ───────────────────────────────────────
scenario_existing_uuid() {
  log "scenario: owner already has UUID office"
  setup_db existing
  trap teardown_db EXIT
  apply_base
  seed_user "user_d" "d@test.local"
  local existing="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  psql_db <<SQL >/dev/null
INSERT INTO office_page (id, slug, name, plan)
VALUES ('${existing}'::uuid, 'existing-d', 'مكتب قائم', 'starter');
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('${existing}', 'user_d', 'owner', 'active');
INSERT INTO trial_offices (user_id, office_id, office_name)
VALUES ('user_d', 'trial_dddd0001', 'قديم');
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_dddd0001', 'user_d', 'owner', 'active');
INSERT INTO cases (id, title, office_id) VALUES ('case_d1', 'y', 'trial_dddd0001');
SQL
  psql_db -f "$MIG023" >/dev/null
  local mapped
  mapped=$(psql_db -At -c "SELECT new_office_uuid::text FROM legacy_trial_office_map WHERE old_office_id='trial_dddd0001'")
  [[ "$mapped" == "$existing" ]] && ok "reused existing UUID office" || bad "created second office ($mapped)"
  local pages
  pages=$(psql_db -At -c "SELECT COUNT(*) FROM office_page WHERE slug LIKE 'migrated-%' OR id='${existing}'::uuid")
  # existing page only — migrated slug should not appear for this owner
  local migrated
  migrated=$(psql_db -At -c "SELECT COUNT(*) FROM office_page WHERE slug LIKE 'migrated-%' AND id != '${existing}'::uuid")
  # Actually we might not create migrated page — count pages for user
  pages=$(psql_db -At -c "SELECT COUNT(*) FROM office_page")
  [[ "$pages" == "1" ]] && ok "no second office_page created" || bad "unexpected office_page count $pages"
  psql_db -At -c "SELECT office_id FROM cases WHERE id='case_d1'" | grep -qx "$existing" \
    && ok "business row remapped to existing UUID" || bad "case not on existing UUID"
  trap - EXIT
  teardown_db
}

# ── 5) NULL task left for 022; default unresolved ──────────────────────────
scenario_null_task_and_default() {
  log "scenario: NULL task unchanged; default unresolved"
  setup_db nulldef
  trap teardown_db EXIT
  apply_base
  seed_user "user_e" "e@test.local"
  psql_db <<'SQL' >/dev/null
INSERT INTO trial_offices (user_id, office_id, office_name)
VALUES ('user_e', 'trial_eeee0001', 'هـ');
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_eeee0001', 'user_e', 'owner', 'active');
INSERT INTO tasks (id, title, office_id, status)
VALUES ('aaaaaaaa-0001-4000-8000-0000000000e1'::uuid, 'orphan', NULL, 'pending');
INSERT INTO cases (id, title, office_id) VALUES ('case_def', 'defaulted', 'default');
SQL
  psql_db -f "$MIG023" >/dev/null
  local null_oid
  null_oid=$(psql_db -At -c "SELECT office_id IS NULL FROM tasks WHERE id='aaaaaaaa-0001-4000-8000-0000000000e1'::uuid")
  [[ "$null_oid" == "t" ]] && ok "NULL task left for Migration 022" || bad "NULL task was altered"
  psql_db -At -c "SELECT office_id FROM cases WHERE id='case_def'" | grep -qx "default" \
    && ok "default case left unresolved" || bad "default case was remapped"
  local def_rows
  def_rows=$(psql_db -At -c "SELECT COUNT(*) FROM legacy_default_office_unresolved WHERE table_name='cases'")
  [[ "$def_rows" -ge 1 ]] && ok "default inventory recorded" || bad "default inventory missing"
  trap - EXIT
  teardown_db
}

# ── 6) Idempotent re-run ───────────────────────────────────────────────────
scenario_idempotent_rerun() {
  log "scenario: migration rerun / idempotency"
  setup_db idem
  trap teardown_db EXIT
  apply_base
  seed_user "user_f" "f@test.local"
  psql_db <<'SQL' >/dev/null
INSERT INTO trial_offices (user_id, office_id, office_name)
VALUES ('user_f', 'trial_ffff0001', 'و');
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_ffff0001', 'user_f', 'owner', 'active');
INSERT INTO cases (id, title, office_id) VALUES ('case_f1', 'z', 'trial_ffff0001');
SQL
  psql_db -f "$MIG023" >/dev/null
  local first
  first=$(psql_db -At -c "SELECT new_office_uuid::text FROM legacy_trial_office_map WHERE old_office_id='trial_ffff0001'")
  psql_db -f "$MIG023" >/dev/null
  local second count_map pages
  second=$(psql_db -At -c "SELECT new_office_uuid::text FROM legacy_trial_office_map WHERE old_office_id='trial_ffff0001'")
  count_map=$(psql_db -At -c "SELECT COUNT(*) FROM legacy_trial_office_map WHERE old_office_id='trial_ffff0001'")
  pages=$(psql_db -At -c "SELECT COUNT(*) FROM office_page")
  [[ "$first" == "$second" && "$count_map" == "1" ]] && ok "rerun keeps same UUID mapping" || bad "idempotency broken"
  [[ "$pages" == "1" ]] && ok "rerun does not create extra office_page" || bad "extra office_page on rerun ($pages)"
  trap - EXIT
  teardown_db
}

require_cmd
ensure_role
log "Migration 023 integration tests (local PostgreSQL)"
scenario_one_legacy_user
scenario_two_ids_one_owner
scenario_conflict_owners
scenario_existing_uuid
scenario_null_task_and_default
scenario_idempotent_rerun

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════════════════════"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
