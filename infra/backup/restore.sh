#!/bin/bash
# استعادة نسخة احتياطية
# الاستخدام: bash infra/backup/restore.sh /opt/adala/backups/adala_20240101_020000.sql.gz
set -e

BACKUP_FILE="${1:?أدخل مسار النسخة: ./restore.sh /path/to/backup.sql.gz}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ الملف غير موجود: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  سيتم استبدال قاعدة البيانات الحالية بالنسخة: $BACKUP_FILE"
read -p "متأكد؟ (اكتب 'نعم' للمتابعة): " CONFIRM
[ "$CONFIRM" != "نعم" ] && echo "تم الإلغاء." && exit 0

cd /opt/adala/infra

echo "🔄 إيقاف API مؤقتاً..."
docker compose stop api

echo "📥 استعادة البيانات..."
gunzip -c "$BACKUP_FILE" | docker exec -i adala-db psql -U adala adala

echo "🚀 إعادة تشغيل API..."
docker compose start api

echo "✅ تمت الاستعادة بنجاح"
