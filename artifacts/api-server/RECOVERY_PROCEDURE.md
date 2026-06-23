# إجراءات التعافي من الكوارث — عدالة AI
## Disaster Recovery Procedures

**الإصدار:** 1.0 | **آخر تحديث:** 2026-06-23  
**المستهدفون:** مدير النظام / مهندس البنية التحتية

---

## فهرس الإجراءات

| الإجراء | الوقت المقدر | المتطلبات |
|---------|-------------|-----------|
| [DR-01] استعادة كاملة للمنصة | 2-4 ساعات | Docker + pg_dump |
| [DR-02] استعادة قاعدة البيانات فقط | 30-60 دقيقة | pg_dump |
| [DR-03] استعادة مكتب واحد (JSON) | 15-30 دقيقة | نسخة JSON + API |
| [DR-04] استعادة Replit (Checkpoint) | 5-10 دقائق | Replit Dashboard |
| [DR-05] اختبار التعافي (DR-Test) | 2-3 دقائق | API |

---

## DR-01: استعادة كاملة للمنصة (بيئة Docker)

### متى تُستخدم؟
- فقدان الخادم بالكامل
- تلف قاعدة البيانات غير قابل للإصلاح
- هجوم ransomware

### المتطلبات المسبقة
```
- ملف pg_dump: /opt/adala/backups/adala_YYYYMMDD_HHMMSS.sql.gz
- Docker + docker-compose مثبّتان
- نسخة من ملف .env
```

### الخطوات

```bash
# 1. استنسخ الكود وأعد ضبط البيئة
git clone <repo> /opt/adala
cd /opt/adala
cp .env.production .env

# 2. شغّل قاعدة البيانات فقط أولاً
docker compose up -d db

# 3. انتظر 10 ثوانٍ حتى تبدأ PostgreSQL
sleep 10

# 4. شغّل سكريبت الاستعادة
bash infra/backup/restore.sh /opt/adala/backups/adala_YYYYMMDD_HHMMSS.sql.gz
# ادخل "نعم" عند الطلب

# 5. شغّل بقية الخدمات
docker compose up -d

# 6. تحقق من الحالة
docker compose ps
curl -f http://localhost:8080/api/ && echo "✅ API يعمل"
```

### التحقق من نجاح الاستعادة
```bash
# تحقق من عدد المكاتب
docker exec adala-db psql -U adala adala -c \
  "SELECT COUNT(*) FROM office_registry;"

# تحقق من آخر قضية مُستعادة
docker exec adala-db psql -U adala adala -c \
  "SELECT COUNT(*) FROM cases; SELECT MAX(created_at) FROM cases;"
```

**RTO المتوقع:** 2-4 ساعات  
**RPO المتوقع:** حتى آخر pg_dump ناجح (مقصود: يومياً الساعة 02:00)

---

## DR-02: استعادة قاعدة البيانات فقط

### متى تُستخدم؟
- تلف جزئي في البيانات
- حذف عرضي لجداول أو سجلات كثيرة
- اختبار التعافي الدوري

```bash
# 1. أوقف API
docker compose stop api

# 2. استعد من النسخة
gunzip -c /opt/adala/backups/adala_YYYYMMDD_HHMMSS.sql.gz \
  | docker exec -i adala-db psql -U adala adala

# 3. أعد تشغيل API
docker compose start api

# 4. تحقق من سلامة البيانات
curl http://localhost:8080/api/backup/dr-test \
  -H "Authorization: Bearer <admin_token>"
```

**RTO المتوقع:** 30-60 دقيقة

---

## DR-03: استعادة مكتب واحد من نسخة JSON

### متى تُستخدم؟
- طلب استعادة بيانات مكتب قانوني واحد
- حذف عرضي للبيانات من قِبل المستخدم
- هجرة مكتب إلى نسخة جديدة

### الخطوات

```bash
# 1. اطلب من صاحب المكتب تحميل النسخة الاحتياطية JSON
# من لوحة التحكم: الإعدادات > النسخ الاحتياطي > تحميل

# 2. شغّل نقطة الاستيراد
curl -X POST https://your-domain/api/import \
  -H "Authorization: Bearer <office_user_token>" \
  -H "Content-Type: application/json" \
  -d @backup-YYYY-MM-DD.json

# 3. تحقق من النتيجة
# الاستجابة: { "ok": true, "imported": N }
```

### ما يتم استعادته
| البيانات | يُستعاد؟ |
|---------|---------|
| القضايا (cases) | ✅ |
| العملاء (clients) | ✅ |
| الفواتير | ⚠️ (metadata فقط) |
| العقود | ✅ |
| ملفات الوثائق المرفوعة | ❌ (محتوى الملف غير مشمول) |
| بيانات الموارد البشرية | ⚠️ (عبر import مخصص) |
| بيانات المحاسبة | ⚠️ (عبر import مخصص) |

**RTO المتوقع:** 15-30 دقيقة

---

## DR-04: استعادة في بيئة Replit (Checkpoint)

### متى تُستخدم؟
- بعد deployment فاشل أو تغيير كود أفسد النظام
- رجوع سريع لحالة سابقة مستقرة

### الخطوات

1. افتح Replit Dashboard
2. اذهب إلى History → Checkpoints
3. اختر آخر checkpoint ناجح
4. اضغط **Restore**
5. أعد تشغيل الـ workflow من لوحة التحكم

**RTO المتوقع:** 5-10 دقائق  
**ملاحظة:** يستعيد الكود والـ DB معاً إلى لحظة الـ checkpoint

---

## DR-05: اختبار التعافي الدوري (يُنصح أسبوعياً)

```bash
# شغّل DR-Test عبر API
curl -s "https://your-domain/api/backup/dr-test" \
  -H "Authorization: Bearer <token>" \
  -H "X-Office-Id: <office_id>" \
  | jq '{ok, rpo, rto, checks}'

# النتيجة المتوقعة (نجاح):
# {
#   "ok": true,
#   "rpo": "4.2h",
#   "rto": "< 2h (يدوي)",
#   "checks": {
#     "last_backup": { "ok": true },
#     "data_integrity": { "ok": true },
#     "db_live": { "ok": true },
#     "office_registry": { "ok": true }
#   }
# }
```

---

## قائمة مراجعة ما قبل الإنتاج (Backup Readiness Checklist)

```
[ ] pg_dump cron مُفعَّل على الخادم (0 2 * * *)
[ ] تحقق من وجود نسخة ناجحة في /opt/adala/backups/
[ ] DR-Test يُعطي ok: true لكل المكاتب النشطة
[ ] اختبار فعلي للاستعادة تم على بيئة staging
[ ] backup_settings مُهيَّأة لكل مستأجر
[ ] Cloud backup credentials محفوظة في backup_settings
[ ] فريق Ops يعرف مكان ملفات النسخ
[ ] وقت RTO/RPO موثّق ومُختبر
```

---

## جهات الاتصال في حالات الطوارئ

| المسؤولية | الإجراء |
|-----------|---------|
| تلف DB فوري | → DR-01 فوراً |
| حذف بيانات مكتب واحد | → DR-03 |
| مشكلة Replit | → DR-04 (Checkpoint) |
| فقدان الكود | → git clone من remote |
