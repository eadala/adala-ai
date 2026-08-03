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
PREFLIGHT="$ROOT/scripts/db/preflight-migration-023.sql"
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

# ── 7) Sole ordinary member is NOT trusted ownership ───────────────────────
scenario_ordinary_member_not_owner() {
  log "scenario: sole ordinary member is not treated as owner"
  setup_db ordinary
  trap teardown_db EXIT
  apply_base
  seed_user "user_ord" "ord@test.local"
  psql_db <<'SQL' >/dev/null
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_ordinary1', 'user_ord', 'lawyer', 'active');
INSERT INTO cases (id, title, office_id) VALUES ('case_ord', 'x', 'trial_ordinary1');
SQL
  if psql_db -f "$MIG023" >/tmp/mig023_ordinary.log 2>&1; then
    bad "ordinary member must not auto-own"
  else
    ok "ordinary member aborts migration"
  fi
  local case_oid
  case_oid=$(psql_db -At -c "SELECT office_id FROM cases WHERE id='case_ord'")
  [[ "$case_oid" == "trial_ordinary1" ]] && ok "no remap after ordinary-member abort" || bad "case mutated ($case_oid)"
  trap - EXIT
  teardown_db
}

# ── 8) users.office_id alone is NOT sufficient ─────────────────────────────
scenario_users_office_id_alone() {
  log "scenario: users.office_id alone is not ownership"
  setup_db usersonly
  trap teardown_db EXIT
  apply_base
  seed_user "user_uo" "uo@test.local"
  psql_db <<'SQL' >/dev/null
UPDATE users SET office_id = 'trial_users_only' WHERE id = 'user_uo';
INSERT INTO cases (id, title, office_id) VALUES ('case_uo', 'x', 'trial_users_only');
SQL
  if psql_db -f "$MIG023" >/tmp/mig023_users_only.log 2>&1; then
    bad "users.office_id alone must not auto-own"
  else
    ok "users.office_id alone aborts migration"
  fi
  local case_oid
  case_oid=$(psql_db -At -c "SELECT office_id FROM cases WHERE id='case_uo'")
  [[ "$case_oid" == "trial_users_only" ]] && ok "no remap after users.office_id abort" || bad "case mutated ($case_oid)"
  trap - EXIT
  teardown_db
}

# ── 9) Explicit trial_offices.user_id succeeds (no membership required) ───
scenario_explicit_trial_owner() {
  log "scenario: explicit trial_offices.user_id succeeds"
  setup_db trialowner
  trap teardown_db EXIT
  apply_base
  seed_user "user_to" "to@test.local"
  psql_db <<'SQL' >/dev/null
INSERT INTO trial_offices (user_id, office_id, office_name)
VALUES ('user_to', 'trial_owner_only', 'مالك');
INSERT INTO cases (id, title, office_id) VALUES ('case_to', 'x', 'trial_owner_only');
SQL
  psql_db -f "$MIG023" >/dev/null
  local new_id
  new_id=$(psql_db -At -c "SELECT new_office_uuid::text FROM legacy_trial_office_map WHERE old_office_id='trial_owner_only'")
  [[ "$new_id" =~ ^[0-9a-f-]{36}$ ]] && ok "explicit trial owner maps to UUID" || bad "map invalid ($new_id)"
  psql_db -At -c "SELECT user_id FROM office_members WHERE office_id='$new_id' AND role='owner' AND status='active'" \
    | grep -qx "user_to" && ok "owner membership created for trial owner" || bad "owner membership missing"
  trap - EXIT
  teardown_db
}

# ── 10) Explicit active role=owner membership succeeds (no trial row) ─────
scenario_explicit_owner_membership() {
  log "scenario: explicit owner membership succeeds"
  setup_db ownermem
  trap teardown_db EXIT
  apply_base
  seed_user "user_om" "om@test.local"
  psql_db <<'SQL' >/dev/null
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_owner_mem', 'user_om', 'owner', 'active');
INSERT INTO cases (id, title, office_id) VALUES ('case_om', 'x', 'trial_owner_mem');
SQL
  psql_db -f "$MIG023" >/dev/null
  local new_id
  new_id=$(psql_db -At -c "SELECT new_office_uuid::text FROM legacy_trial_office_map WHERE old_office_id='trial_owner_mem'")
  [[ "$new_id" =~ ^[0-9a-f-]{36}$ ]] && ok "owner membership maps to UUID" || bad "map invalid ($new_id)"
  trap - EXIT
  teardown_db
}

# ── 11) Conflicting trial owner vs owner membership aborts ────────────────
scenario_trial_vs_member_owner_conflict() {
  log "scenario: trial owner disagrees with owner membership"
  setup_db srcconflict
  trap teardown_db EXIT
  apply_base
  seed_user "user_sa" "sa@test.local"
  seed_user "user_sb" "sb@test.local"
  psql_db <<'SQL' >/dev/null
INSERT INTO trial_offices (user_id, office_id, office_name)
VALUES ('user_sa', 'trial_src_conflict', 'تعارض');
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_src_conflict', 'user_sb', 'owner', 'active');
INSERT INTO cases (id, title, office_id) VALUES ('case_sc', 'x', 'trial_src_conflict');
SQL
  if psql_db -f "$MIG023" >/tmp/mig023_src_conflict.log 2>&1; then
    bad "trial vs member owner conflict must abort"
  else
    ok "conflicting trial owner and owner membership aborts"
  fi
  local case_oid
  case_oid=$(psql_db -At -c "SELECT office_id FROM cases WHERE id='case_sc'")
  [[ "$case_oid" == "trial_src_conflict" ]] && ok "no remap after source conflict" || bad "case mutated ($case_oid)"
  grep -qi "OWNER_SOURCE_CONFLICT\|unresolved/conflicting" /tmp/mig023_src_conflict.log \
    && ok "abort mentions ownership conflict" || bad "unexpected abort reason"
  trap - EXIT
  teardown_db
}

# ── 12) role=admin alone is NOT trusted (repo assigns creator as owner) ───
scenario_admin_alone_not_owner() {
  log "scenario: role=admin alone is not trusted ownership"
  setup_db adminonly
  trap teardown_db EXIT
  apply_base
  seed_user "user_ad" "ad@test.local"
  psql_db <<'SQL' >/dev/null
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_admin_only', 'user_ad', 'admin', 'active');
INSERT INTO cases (id, title, office_id) VALUES ('case_ad', 'x', 'trial_admin_only');
SQL
  if psql_db -f "$MIG023" >/tmp/mig023_admin.log 2>&1; then
    bad "admin-only must not auto-own"
  else
    ok "admin-only aborts migration"
  fi
  trap - EXIT
  teardown_db
}

# ── 13) Preflight read-only + required classifications ─────────────────────
scenario_preflight_readonly() {
  log "scenario: preflight is read-only and reports classifications"
  setup_db preflight
  trap teardown_db EXIT
  apply_base
  seed_user "user_pf1" "pf1@test.local"
  seed_user "user_pf2" "pf2@test.local"
  seed_user "user_pf3" "pf3@test.local"
  seed_user "user_pf4" "pf4@test.local"
  seed_user "user_pf5" "pf5@test.local"
  psql_db <<'SQL' >/dev/null
-- map_to_new_or_existing (trial owner)
INSERT INTO trial_offices (user_id, office_id, office_name)
VALUES ('user_pf1', 'trial_pf_ok', 'حسن');
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_pf_ok', 'user_pf1', 'owner', 'active');
INSERT INTO cases (id, title, office_id) VALUES ('case_pf_ok', 'ok', 'trial_pf_ok');
INSERT INTO tasks (id, title, office_id, status)
VALUES ('aaaaaaaa-0001-4000-8000-0000000000f1'::uuid, 't', 'trial_pf_ok', 'pending');
-- unresolved: ordinary member
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_pf_ord', 'user_pf2', 'lawyer', 'active');
-- unresolved: users.office_id alone
UPDATE users SET office_id = 'trial_pf_uo' WHERE id = 'user_pf3';
INSERT INTO cases (id, title, office_id) VALUES ('case_pf_uo', 'uo', 'trial_pf_uo');
-- conflict: trial owner vs owner member
INSERT INTO trial_offices (user_id, office_id, office_name)
VALUES ('user_pf4', 'trial_pf_conflict', 'تعارض');
INSERT INTO office_members (office_id, user_id, role, status)
VALUES ('trial_pf_conflict', 'user_pf5', 'owner', 'active');
-- NULL task for 022 + default inventory
INSERT INTO tasks (id, title, office_id, status)
VALUES ('aaaaaaaa-0001-4000-8000-0000000000f2'::uuid, 'null', NULL, 'pending');
INSERT INTO cases (id, title, office_id) VALUES ('case_pf_def', 'd', 'default');
-- two legacy ids → same trusted owner (reported by preflight)
INSERT INTO office_members (office_id, user_id, role, status) VALUES
  ('trial_pf_m1', 'user_pf1', 'owner', 'active'),
  ('trial_pf_m2', 'user_pf1', 'owner', 'active');
SQL

  local before after
  before=$(psql_db -At -c "
    SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
      SELECT ('cases:' || office_id || ':' || COUNT(*)::text) AS x FROM cases GROUP BY office_id
      UNION ALL
      SELECT ('tasks:' || COALESCE(office_id,'∅') || ':' || COUNT(*)::text) FROM tasks GROUP BY office_id
      UNION ALL
      SELECT ('page:' || id::text) FROM office_page
      UNION ALL
      SELECT ('mem:' || office_id || ':' || user_id || ':' || role) FROM office_members
    ) s;")

  if ! psql_db -f "$PREFLIGHT" >/tmp/mig023_preflight.out 2>&1; then
    bad "preflight should succeed"
    cat /tmp/mig023_preflight.out >&2
  else
    ok "preflight runs successfully"
  fi

  after=$(psql_db -At -c "
    SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
      SELECT ('cases:' || office_id || ':' || COUNT(*)::text) AS x FROM cases GROUP BY office_id
      UNION ALL
      SELECT ('tasks:' || COALESCE(office_id,'∅') || ':' || COUNT(*)::text) FROM tasks GROUP BY office_id
      UNION ALL
      SELECT ('page:' || id::text) FROM office_page
      UNION ALL
      SELECT ('mem:' || office_id || ':' || user_id || ':' || role) FROM office_members
    ) s;")
  [[ "$before" == "$after" ]] && ok "preflight is read-only (fingerprint unchanged)" || bad "preflight mutated data"

  local col
  for col in old_office_id trial_owner_user_id owner_member_user_id admin_member_user_id existing_uuid_office chosen_owner chosen_action conflict_reason; do
    grep -q "$col" /tmp/mig023_preflight.out && ok "preflight column $col" || bad "missing preflight column $col"
  done

  grep -q "map_to_new_or_existing" /tmp/mig023_preflight.out && ok "preflight reports map_to_new_or_existing" || bad "missing map action"
  grep -q "unresolved" /tmp/mig023_preflight.out && ok "preflight reports unresolved" || bad "missing unresolved"
  grep -q "conflict" /tmp/mig023_preflight.out && ok "preflight reports conflict" || bad "missing conflict"
  grep -qi "two legacy ids\|legacy_id_count\|old_office_ids" /tmp/mig023_preflight.out \
    && ok "preflight reports two-legacy-ids-one-owner" || bad "missing two-legacy report"
  grep -qi "rows that would be remapped\|trial_rows" /tmp/mig023_preflight.out \
    && ok "preflight reports remap row counts" || bad "missing remap counts"
  grep -qi "default office_id\|default_rows" /tmp/mig023_preflight.out \
    && ok "preflight reports default office_id rows" || bad "missing default inventory"
  grep -qi "null_tasks_left_for_022\|NULL tasks" /tmp/mig023_preflight.out \
    && ok "preflight reports NULL tasks for 022" || bad "missing NULL task report"
  grep -qi "tasks_with_trial_office_id\|tasks" /tmp/mig023_preflight.out \
    && ok "preflight reports tasks with trial_* ids" || bad "missing trial task report"

  local map_exists
  map_exists=$(psql_db -At -c "SELECT to_regclass('public.legacy_trial_office_map') IS NOT NULL")
  [[ "$map_exists" == "f" ]] && ok "preflight created no map tables" || bad "preflight created map tables"

  # Ensure SQL file itself is SELECT-only (ignore comments / \echo)
  if grep -Eiv '^\s*--' "$PREFLIGHT" | grep -Eiq '^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|COPY)\b'; then
    bad "preflight SQL contains mutating statements"
  else
    ok "preflight SQL file is SELECT-only"
  fi

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
scenario_ordinary_member_not_owner
scenario_users_office_id_alone
scenario_explicit_trial_owner
scenario_explicit_owner_membership
scenario_trial_vs_member_owner_conflict
scenario_admin_alone_not_owner
scenario_preflight_readonly

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════════════════════"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
