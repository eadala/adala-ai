#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# verify-schema.sh — READ-ONLY schema audit for Production PostgreSQL
#
# Usage (from repo root):
#   DATABASE_URL="postgresql://..." bash scripts/db/verify-schema.sh
#
# Exit codes:
#   0 — all P0 tables and columns present
#   1 — missing P0 tables or columns
#   2 — DATABASE_URL not set or psql unavailable
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
P0_TABLES="$ROOT/scripts/db/expected-tables-p0.txt"
P0_COLUMNS="$ROOT/scripts/db/expected-columns-p0.txt"
BASELINE_MANIFEST="$ROOT/lib/db/drizzle/0000_baseline.sql"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL is not set"
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql not found — install postgresql-client"
  exit 2
fi

PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At)

echo "═══════════════════════════════════════════════════════════"
echo "  Adala DB Schema Verification (read-only)"
echo "  $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Connection test ─────────────────────────────────────────────────────────
echo "▶ Connection"
"${PSQL[@]}" -c "SELECT version();" | head -1
DB_SIZE=$("${PSQL[@]}" -c "SELECT pg_size_pretty(pg_database_size(current_database()));")
TABLE_COUNT=$("${PSQL[@]}" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
echo "  Database size: $DB_SIZE"
echo "  Public tables: $TABLE_COUNT"
echo ""

# ── P0 tables ─────────────────────────────────────────────────────────────
echo "▶ P0 tables (runtime blockers)"
MISSING_TABLES=()
while IFS= read -r table || [[ -n "$table" ]]; do
  [[ -z "$table" || "$table" =~ ^# ]] && continue
  exists=$("${PSQL[@]}" -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$table');")
  if [[ "$exists" == "t" ]]; then
    rows=$("${PSQL[@]}" -c "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "ERR")
    printf "  ✅ %-30s (%s rows)\n" "$table" "$rows"
  else
    printf "  ❌ %-30s MISSING\n" "$table"
    MISSING_TABLES+=("$table")
  fi
done < "$P0_TABLES"
echo ""

# ── P0 columns ────────────────────────────────────────────────────────────
echo "▶ P0 columns"
MISSING_COLUMNS=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  table="${line%%.*}"
  column="${line#*.}"
  exists=$("${PSQL[@]}" -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='$table' AND column_name='$column');")
  if [[ "$exists" == "t" ]]; then
    printf "  ✅ %s.%s\n" "$table" "$column"
  else
    printf "  ❌ %s.%s MISSING\n" "$table" "$column"
    MISSING_COLUMNS+=("$line")
  fi
done < "$P0_COLUMNS"
echo ""

# ── Drizzle baseline tables (47) ──────────────────────────────────────────
echo "▶ Drizzle baseline tables (from 0000_baseline.sql)"
BASELINE_TABLES=()
if [[ -f "$BASELINE_MANIFEST" ]]; then
  while IFS= read -r t; do
    BASELINE_TABLES+=("$t")
  done < <(sed -n 's/^CREATE TABLE "\([^"]*\)".*/\1/p' "$BASELINE_MANIFEST" | sort -u)
fi

MISSING_BASELINE=()
for table in "${BASELINE_TABLES[@]}"; do
  exists=$("${PSQL[@]}" -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$table');")
  if [[ "$exists" != "t" ]]; then
    MISSING_BASELINE+=("$table")
  fi
done

if [[ ${#MISSING_BASELINE[@]} -eq 0 ]]; then
  echo "  ✅ All ${#BASELINE_TABLES[@]} baseline tables present"
else
  echo "  ❌ Missing ${#MISSING_BASELINE[@]} / ${#BASELINE_TABLES[@]} baseline tables:"
  for t in "${MISSING_BASELINE[@]}"; do
    echo "     - $t"
  done
fi
echo ""

# ── Extra tables in DB not in baseline (informational) ────────────────────
echo "▶ Extra public tables (not in Drizzle baseline — may be boot-created)"
EXTRA=$("${PSQL[@]}" -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name;
")
BASELINE_SET=$(printf '%s\n' "${BASELINE_TABLES[@]}" | sort)
EXTRA_COUNT=0
while IFS= read -r t; do
  [[ -z "$t" ]] && continue
  if ! echo "$BASELINE_SET" | grep -qx "$t"; then
    ((EXTRA_COUNT++)) || true
  fi
done <<< "$EXTRA"
echo "  ℹ️  $EXTRA_COUNT tables beyond baseline (normal after API boot)"
echo ""

# ── Summary ───────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  SUMMARY"
echo "═══════════════════════════════════════════════════════════"
ERR=0
if [[ ${#MISSING_TABLES[@]} -gt 0 ]]; then
  echo "  ❌ Missing P0 tables (${#MISSING_TABLES[@]}): ${MISSING_TABLES[*]}"
  ERR=1
else
  echo "  ✅ All P0 tables present"
fi
if [[ ${#MISSING_COLUMNS[@]} -gt 0 ]]; then
  echo "  ❌ Missing P0 columns (${#MISSING_COLUMNS[@]}): ${MISSING_COLUMNS[*]}"
  ERR=1
else
  echo "  ✅ All P0 columns present"
fi
if [[ ${#MISSING_BASELINE[@]} -gt 0 ]]; then
  echo "  ⚠️  Missing baseline tables: apply 003_drizzle_baseline_safe.sql"
  ERR=1
fi

if [[ $ERR -eq 0 ]]; then
  echo ""
  echo "✅ Schema verification PASSED"
else
  echo ""
  echo "❌ Schema verification FAILED — see migrations/README.md"
fi
exit $ERR
