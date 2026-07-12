#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# backup-restore.sh — PostgreSQL backup & restore for Adala Production
#
# Usage (from repo root):
#   DATABASE_URL="postgresql://..." bash scripts/db/backup-restore.sh backup
#   DATABASE_URL="postgresql://..." bash scripts/db/backup-restore.sh restore /path/to/dump.custom
#
# Requires: pg_dump, pg_restore, psql
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ACTION="${1:-}"
DUMP_PATH="${2:-}"
BACKUP_DIR="${BACKUP_DIR:-/opt/adala/backups}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"

usage() {
  cat <<'EOF'
Adala DB Backup / Restore

Commands:
  backup [output_dir]   Create custom-format pg_dump (default: /opt/adala/backups)
  restore <dump_file>   Restore from custom-format dump (DESTRUCTIVE — drops objects)
  list [dir]            List available backups

Environment:
  DATABASE_URL   Required — PostgreSQL connection string
  BACKUP_DIR     Optional — default backup directory

Examples:
  DATABASE_URL="postgresql://adala:pass@host:5432/adala" \
    bash scripts/db/backup-restore.sh backup

  DATABASE_URL="postgresql://adala:pass@host:5432/adala" \
    bash scripts/db/backup-restore.sh restore /opt/adala/backups/adala_20260712T080000Z.dump

Rollback plan:
  1. Always run `backup` immediately before applying migrations
  2. If migration fails or app breaks, run `restore` with the pre-migration dump
  3. Verify with: bash scripts/db/verify-schema.sh
EOF
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL is not set"
  usage
  exit 2
fi

for cmd in pg_dump pg_restore psql; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ $cmd not found — install postgresql-client"
    exit 2
  fi
done

case "$ACTION" in
  backup)
    OUT_DIR="${DUMP_PATH:-$BACKUP_DIR}"
    mkdir -p "$OUT_DIR"
    OUT_FILE="$OUT_DIR/adala_${TIMESTAMP}.dump"
    echo "▶ Backing up to: $OUT_FILE"
    pg_dump \
      --format=custom \
      --no-owner \
      --no-privileges \
      --verbose \
      --file="$OUT_FILE" \
      "$DATABASE_URL"
    SIZE=$(du -h "$OUT_FILE" | cut -f1)
    echo "✅ Backup complete ($SIZE)"
    echo "   Restore: bash scripts/db/backup-restore.sh restore $OUT_FILE"
    ;;

  restore)
    if [[ -z "$DUMP_PATH" || ! -f "$DUMP_PATH" ]]; then
      echo "❌ Provide path to .dump file: backup-restore.sh restore /path/to/file.dump"
      exit 1
    fi
    echo "⚠️  RESTORE will overwrite existing objects in the database"
    echo "   Source: $DUMP_PATH"
    echo "   Target: $DATABASE_URL"
    CONFIRM="${RESTORE_CONFIRM:-}"
    if [[ -z "$CONFIRM" ]]; then
      read -r -p "Type RESTORE to confirm: " CONFIRM
    fi
    if [[ "$CONFIRM" != "RESTORE" ]]; then
      echo "Aborted."
      exit 1
    fi
    echo "▶ Restoring..."
    pg_restore \
      --no-owner \
      --no-privileges \
      --if-exists \
      --clean \
      --verbose \
      -d "$DATABASE_URL" \
      "$DUMP_PATH" || true
    echo "✅ Restore finished (non-fatal errors from --clean are normal)"
    echo "   Verify: bash scripts/db/verify-schema.sh"
    ;;

  list)
    DIR="${DUMP_PATH:-$BACKUP_DIR}"
    if [[ ! -d "$DIR" ]]; then
      echo "No backup directory: $DIR"
      exit 0
    fi
    echo "Backups in $DIR:"
    ls -lh "$DIR"/*.dump 2>/dev/null || echo "  (none)"
    ;;

  *)
    usage
    exit 1
    ;;
esac
