#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# inspect-office-storage-quota.sh — READ-ONLY prod probe (always ROLLBACK)
#
# Confirms office_storage_quota.office_id type, FKs, indexes/constraints,
# and the exact SQLSTATE / constraint / detail from the failing upsert shape
# used by POST /api/storage/files (trial_* tenant id).
#
# Usage (ops host / Coolify jump box — NOT inside the API image):
#   DATABASE_URL="postgresql://..." bash scripts/db/inspect-office-storage-quota.sh
#
# Exit codes:
#   0 — inspection completed (does not imply schema is healthy)
#   2 — DATABASE_URL missing / psql unavailable / table missing
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL is not set"
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql not found — install postgresql-client"
  exit 2
fi

TRIAL_PROBE="${TRIAL_PROBE:-trial_gJ1TIcai}"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1)

echo "═══════════════════════════════════════════════════════════"
echo "  office_storage_quota inspection (read-only / ROLLBACK)"
echo "  $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "  probe office_id = ${TRIAL_PROBE}"
echo "═══════════════════════════════════════════════════════════"
echo ""

exists=$("${PSQL[@]}" -At -c "SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema='public' AND table_name='office_storage_quota'
);")
if [[ "$exists" != "t" ]]; then
  echo "❌ public.office_storage_quota does not exist"
  exit 2
fi

echo "▶ Columns"
"${PSQL[@]}" -c "
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'office_storage_quota'
ORDER BY ordinal_position;
"

echo "▶ Primary key / unique constraints"
"${PSQL[@]}" -c "
SELECT
  c.conname AS constraint_name,
  c.contype AS constraint_type,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'office_storage_quota'
  AND c.contype IN ('p', 'u')
ORDER BY c.contype, c.conname;
"

echo "▶ Foreign keys"
"${PSQL[@]}" -c "
SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition,
  ft.relname AS referenced_table
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
LEFT JOIN pg_class ft ON ft.oid = c.confrelid
WHERE n.nspname = 'public'
  AND t.relname = 'office_storage_quota'
  AND c.contype = 'f'
ORDER BY c.conname;
"

echo "▶ Indexes"
"${PSQL[@]}" -c "
SELECT
  i.relname AS index_name,
  ix.indisunique AS is_unique,
  ix.indisprimary AS is_primary,
  pg_get_indexdef(ix.indexrelid) AS index_def
FROM pg_index ix
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'office_storage_quota'
ORDER BY i.relname;
"

echo "▶ office_id column type (authoritative)"
office_id_udt=$("${PSQL[@]}" -At -c "
SELECT udt_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='office_storage_quota'
  AND column_name='office_id';
")
echo "  office_storage_quota.office_id udt_name = ${office_id_udt:-<<MISSING>>}"

fk_to_office_page=$("${PSQL[@]}" -At -c "
SELECT COALESCE(string_agg(c.conname, ','), '')
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_class ft ON ft.oid = c.confrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'office_storage_quota'
  AND c.contype = 'f'
  AND ft.relname = 'office_page';
")
if [[ -z "$fk_to_office_page" ]]; then
  echo "  FK to office_page: (none)"
else
  echo "  FK to office_page: ${fk_to_office_page}"
fi

has_conflict_target=$("${PSQL[@]}" -At -c "
SELECT EXISTS (
  SELECT 1
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'office_storage_quota'
    AND c.contype IN ('p', 'u')
    AND pg_get_constraintdef(c.oid) ILIKE '%(office_id)%'
) OR EXISTS (
  SELECT 1
  FROM pg_index ix
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'office_storage_quota'
    AND ix.indisunique
    AND pg_get_indexdef(ix.indexrelid) ILIKE '%(office_id)%'
);
")
echo "  UNIQUE/PK on (office_id) for ON CONFLICT: ${has_conflict_target}"

echo ""
echo "▶ Reproduce failing INSERT (BEGIN…ROLLBACK — no data committed)"
# Literal probe value escaped for SQL string (alphanumeric + underscore only expected).
if [[ ! "$TRIAL_PROBE" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "❌ TRIAL_PROBE contains unsafe characters"
  exit 2
fi

"${PSQL[@]}" <<SQL
BEGIN;
DO \$\$
DECLARE
  v_sqlstate text;
  v_msg text;
  v_detail text;
  v_hint text;
  v_constraint text;
  v_table text;
  v_column text;
BEGIN
  BEGIN
    INSERT INTO office_storage_quota (office_id, used_bytes, files_count)
    VALUES ('${TRIAL_PROBE}', 1, 1)
    ON CONFLICT (office_id) DO UPDATE
      SET used_bytes = office_storage_quota.used_bytes + 1,
          files_count = office_storage_quota.files_count + 1,
          updated_at = NOW();
    RAISE NOTICE 'PROBE_OK insert+upsert succeeded for ${TRIAL_PROBE}';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_sqlstate = RETURNED_SQLSTATE,
      v_msg = MESSAGE_TEXT,
      v_detail = PG_EXCEPTION_DETAIL,
      v_hint = PG_EXCEPTION_HINT,
      v_constraint = CONSTRAINT_NAME,
      v_table = TABLE_NAME,
      v_column = COLUMN_NAME;
    RAISE NOTICE 'PROBE_FAIL sqlstate=% constraint=% table=% column=%',
      v_sqlstate, COALESCE(v_constraint, ''), COALESCE(v_table, ''), COALESCE(v_column, '');
    RAISE NOTICE 'PROBE_FAIL message=%', v_msg;
    RAISE NOTICE 'PROBE_FAIL detail=%', COALESCE(v_detail, '');
    RAISE NOTICE 'PROBE_FAIL hint=%', COALESCE(v_hint, '');
  END;
END \$\$;
ROLLBACK;
SQL

echo ""
echo "▶ Verdict helpers"
if [[ "$office_id_udt" == "uuid" ]]; then
  echo "  CONFIRMED: office_id is UUID → prepare TEXT migration (preserve UNIQUE/PK for ON CONFLICT)"
elif [[ -n "$fk_to_office_page" ]]; then
  echo "  CONFIRMED: FK to office_page → drop FK + align office_id to TEXT tenant model"
else
  echo "  office_id udt_name=${office_id_udt:-unknown}; FK_office_page=(none or empty)"
  echo "  Read PROBE_FAIL sqlstate/constraint/detail above before any migration."
fi

echo ""
echo "Done. No schema or data changes were committed."
