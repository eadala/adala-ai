#!/usr/bin/env bash
# Disposable PostgreSQL RLS / tenant isolation harness.
# LOCAL ONLY — never touches production.
# Uses FORCE RLS + non-superuser app role so policies are enforceable in-test.
# (Production migration 059 uses ENABLE without FORCE; app must not use table-owner roles.)
set -euo pipefail
PASS=0; FAIL=0
ok(){ echo "  ✅ $*"; PASS=$((PASS+1)); }
bad(){ echo "  ❌ $*"; FAIL=$((FAIL+1)); }
require_cmd(){ command -v "$1" >/dev/null || { echo "FAIL: missing $1"; exit 2; }; }
require_cmd psql
require_cmd sudo

TEST_DB="adala_rls_live_$$"
APP_ROLE="adala_rls_app_$$"
OFFICE_A="11111111-1111-4111-8111-111111111111"
OFFICE_B="22222222-2222-4222-8222-222222222222"

cleanup(){
  sudo -n -u postgres psql -v ON_ERROR_STOP=0 -c "DROP DATABASE IF EXISTS \"${TEST_DB}\";" >/dev/null 2>&1 || true
  sudo -n -u postgres psql -v ON_ERROR_STOP=0 -c "DROP ROLE IF EXISTS \"${APP_ROLE}\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== live-rls-tenant-harness ==="
echo "TEST_DB=$TEST_DB"

sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${TEST_DB}\";" >/dev/null
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${TEST_DB}\";" >/dev/null
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d "$TEST_DB" <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE ${APP_ROLE} LOGIN PASSWORD 'rls_app_test' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO ${APP_ROLE};

CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL,
  title TEXT NOT NULL
);
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL,
  full_name TEXT NOT NULL
);
CREATE TABLE rag_chunks_probe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  content TEXT NOT NULL
);

INSERT INTO cases(id, office_id, title) VALUES
  ('case-a', '${OFFICE_A}', 'قضية أ'),
  ('case-b', '${OFFICE_B}', 'قضية ب');
INSERT INTO clients(id, office_id, full_name) VALUES
  ('client-a', '${OFFICE_A}', 'عميل أ'),
  ('client-b', '${OFFICE_B}', 'عميل ب');
INSERT INTO rag_chunks_probe(office_id, document_id, content) VALUES
  ('${OFFICE_A}', 'doc-a', 'سر مكتب أ'),
  ('${OFFICE_B}', 'doc-b', 'سر مكتب ب');

DO \$\$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['cases','clients','rag_chunks_probe'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY rls_%I ON %I FOR ALL TO PUBLIC USING (
         office_id = nullif(current_setting(''app.current_tenant'', true), '''')
         OR current_setting(''app.bypass_rls'', true) = ''on''
       ) WITH CHECK (
         office_id = nullif(current_setting(''app.current_tenant'', true), '''')
         OR current_setting(''app.bypass_rls'', true) = ''on''
       )', t, t);
  END LOOP;
END\$\$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE};
SQL

# Run SQL as app role; print only the final scalar on last line
q() {
  local sql="$1"
  PGPASSWORD=rls_app_test psql -h 127.0.0.1 -U "$APP_ROLE" -d "$TEST_DB" -v ON_ERROR_STOP=1 -At -c "$sql" | tail -n 1
}

echo "--- T1 missing tenant context fails closed ---"
n=$(q "SELECT set_config('app.bypass_rls','off',true); SELECT set_config('app.current_tenant','',true); SELECT count(*)::text FROM cases;")
[[ "$n" == "0" ]] && ok "empty tenant reads 0 cases" || bad "empty tenant leaked rows n=$n"

echo "--- T2 unset tenant fails closed ---"
n=$(q "SELECT set_config('app.bypass_rls','off',true); SELECT count(*)::text FROM clients;")
[[ "$n" == "0" ]] && ok "unset tenant reads 0 clients" || bad "unset tenant leaked n=$n"

echo "--- T3 cross-tenant read denied ---"
n=$(q "SELECT set_config('app.bypass_rls','off',true); SELECT set_config('app.current_tenant','${OFFICE_A}',true); SELECT count(*)::text FROM cases WHERE office_id='${OFFICE_B}';")
[[ "$n" == "0" ]] && ok "office A cannot read office B cases" || bad "cross-tenant read n=$n"

echo "--- T4 same-tenant read allowed ---"
n=$(q "SELECT set_config('app.bypass_rls','off',true); SELECT set_config('app.current_tenant','${OFFICE_A}',true); SELECT count(*)::text FROM cases WHERE office_id='${OFFICE_A}';")
[[ "$n" == "1" ]] && ok "office A reads own case" || bad "same-tenant read n=$n"

echo "--- T5 cross-tenant write denied ---"
if PGPASSWORD=rls_app_test psql -h 127.0.0.1 -U "$APP_ROLE" -d "$TEST_DB" -v ON_ERROR_STOP=1 -At -c \
  "SELECT set_config('app.bypass_rls','off',true); SELECT set_config('app.current_tenant','${OFFICE_A}',true); INSERT INTO cases(id,office_id,title) VALUES('case-x','${OFFICE_B}','leak');" \
  >/tmp/rls_write_err 2>&1; then
  bad "cross-tenant insert unexpectedly succeeded"
else
  ok "cross-tenant insert rejected"
fi

echo "--- T6 tenant switch does not retain prior privileges ---"
n=$(q "SELECT set_config('app.bypass_rls','off',true); SELECT set_config('app.current_tenant','${OFFICE_A}',true); SELECT set_config('app.current_tenant','${OFFICE_B}',true); SELECT count(*)::text FROM cases WHERE office_id='${OFFICE_A}';")
[[ "$n" == "0" ]] && ok "after switch to B, A rows invisible" || bad "tenant switch retained A n=$n"

echo "--- T7 bypass_rls scoped ---"
n=$(q "SELECT set_config('app.bypass_rls','on',true); SELECT set_config('app.current_tenant','',true); SELECT count(*)::text FROM cases;")
[[ "$n" == "2" ]] && ok "bypass_rls=on sees all cases" || bad "bypass unexpected n=$n"
n=$(q "SELECT set_config('app.bypass_rls','off',true); SELECT set_config('app.current_tenant','',true); SELECT count(*)::text FROM cases;")
[[ "$n" == "0" ]] && ok "bypass cleared fails closed again" || bad "bypass leak n=$n"

echo "--- T8 RAG probe cross-tenant ---"
n=$(q "SELECT set_config('app.bypass_rls','off',true); SELECT set_config('app.current_tenant','${OFFICE_B}',true); SELECT count(*)::text FROM rag_chunks_probe WHERE content LIKE '%مكتب أ%';")
[[ "$n" == "0" ]] && ok "RAG probe denies cross-tenant content" || bad "RAG probe leak n=$n"

echo "--- T9 connection GUC isolation (sequential sessions) ---"
n=$(PGPASSWORD=rls_app_test psql -h 127.0.0.1 -U "$APP_ROLE" -d "$TEST_DB" -At -c "SELECT count(*)::text FROM cases;" | tail -n 1)
[[ "$n" == "0" ]] && ok "fresh connection has no tenant privilege" || bad "GUC leaked across connections n=$n"

echo "RESULT_PASS=$PASS RESULT_FAIL=$FAIL"
if [[ "$FAIL" -ne 0 ]]; then
  echo "RESULT=VERIFIED_FAIL"
  exit 1
fi
echo "RESULT=VERIFIED_PASS"
exit 0
