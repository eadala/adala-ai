#!/bin/bash
# ═══════════════════════════════════════════════════════
# نسخ احتياطي يومي — PostgreSQL
# يُشغَّل تلقائياً عبر cron:
#   0 2 * * * /opt/adala/infra/backup/backup.sh >> /var/log/adala-backup.log 2>&1
# ═══════════════════════════════════════════════════════
set -e

BACKUP_DIR="/opt/adala/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/adala_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] 🗄️  بدء النسخ الاحتياطي..."

# ── Dump + Gzip ──────────────────────────────────────
docker exec adala-db \
  pg_dump -U adala adala --no-owner --no-privileges \
  | gzip -9 > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date)] ✅ تم: $BACKUP_FILE ($SIZE)"

# ── حذف النسخ القديمة (أكثر من RETENTION_DAYS أيام) ──
DELETED=$(find "$BACKUP_DIR" -name "adala_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete -print | wc -l)
[ "$DELETED" -gt 0 ] && echo "[$(date)] 🧹 حُذفت $DELETED نسخ قديمة"

# ── إجمالي النسخ المحفوظة ─────────────────────────────
COUNT=$(find "$BACKUP_DIR" -name "adala_*.sql.gz" | wc -l)
TOTAL=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "[$(date)] 📦 النسخ المحفوظة: $COUNT ملف ($TOTAL إجمالي)"

# ── تحقق من سلامة النسخة ─────────────────────────────
if gzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "[$(date)] ✅ النسخة سليمة"
else
  echo "[$(date)] ❌ خطأ: النسخة تالفة — $BACKUP_FILE"
  exit 1
fi
