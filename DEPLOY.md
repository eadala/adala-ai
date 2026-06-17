# 🚀 دليل النشر — عدالة AI على Hetzner + Coolify

## البنية العامة

```
GitHub (الكود)
    ↓  webhook تلقائي
Coolify (CI/CD)
    ↓  docker build & deploy
Hetzner Cloud (الخادم)
    ├── عدالة AI (Node.js + Frontend)
    ├── PostgreSQL
    └── Ollama (اختياري — نموذج AI محلي)
```

---

## الخطوة 1 — إعداد خادم Hetzner

### اختيار الخادم المناسب

| الخطة | المواصفات | السعر | الاستخدام |
|---|---|---|---|
| CX22 | 2 vCPU / 4GB / 40GB | ~6$/شهر | مرحلة الإطلاق (حتى 50 مكتب) |
| CX32 | 4 vCPU / 8GB / 80GB | ~12$/شهر | نمو (حتى 200 مكتب) |
| CX42 | 8 vCPU / 16GB / 160GB | ~24$/شهر | مع Ollama محلي |

### إنشاء الخادم

1. سجّل في [hetzner.com](https://hetzner.com)
2. أنشئ Server: **Ubuntu 24.04** + منطقة **eu-central** (فرنكفورت)
3. أضف SSH Key أو كلمة مرور
4. فعّل **Firewall**: اسمح فقط بـ 80، 443، 22

---

## الخطوة 2 — تثبيت Coolify

```bash
# اتصل بالخادم
ssh root@YOUR_SERVER_IP

# ثبّت Coolify بأمر واحد
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

ثم افتح `http://YOUR_SERVER_IP:8000` وأكمل الإعداد.

---

## الخطوة 3 — نشر عدالة من GitHub

### في Coolify:

1. **New Resource** → **Application** → **GitHub** → اختر `adalah-ai/platform`
2. **Branch**: `main`
3. **Build Pack**: `Dockerfile` (Coolify يكتشفه تلقائياً)
4. **Port**: `8080`
5. **Environment Variables**: أضف كل ما في `.env.example`

### متغيرات Coolify تُضاف تلقائياً:
```
COOLIFY_BRANCH=main
COOLIFY_GIT_COMMIT_SHA=<SHA>
COOLIFY_ENVIRONMENT=production
```

---

## الخطوة 4 — إعداد PostgreSQL

### الخيار أ: Coolify Database (الأسهل)
1. في Coolify: **New Resource** → **Database** → **PostgreSQL 16**
2. انسخ `DATABASE_URL` وضعه في متغيرات التطبيق

### الخيار ب: Hetzner Managed Database
1. من لوحة Hetzner: **Databases** → **PostgreSQL**
2. أنشئ قاعدة بيانات وانسخ الـ connection string

---

## الخطوة 5 — تشغيل Ollama (اختياري)

للحصول على نموذج AI محلي يعمل بدون اتصال بالإنترنت:

```bash
# على الخادم
curl -fsSL https://ollama.ai/install.sh | sh

# تحميل نموذج عربي مناسب (4GB RAM → gemma3:4b)
ollama pull gemma3:4b

# أو نموذج أكبر (16GB RAM → llama3.1:8b)
ollama pull llama3.1:8b
```

أضف في متغيرات Coolify:
```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
OLLAMA_FALLBACK_ENABLED=true
```

---

## الخطوة 6 — الدومين والـ SSL

### في Coolify:
1. أضف دومينك: `app.adalah-ai.com`
2. فعّل **Let's Encrypt** → SSL تلقائي

### في DNS (Cloudflare مثلاً):
```
A  app.adalah-ai.com  →  YOUR_SERVER_IP
```

---

## الخطوة 7 — النشر التلقائي (Auto Deploy)

في Coolify → Settings → **Enable Automatic Deployment**

الآن كل `git push origin main` يُشغّل نشراً تلقائياً:
```bash
git push origin main
# ↓ Webhook
# ↓ Coolify pulls new code
# ↓ docker build (cached layers)
# ↓ Zero-downtime deploy
# ✅ Live in ~2 minutes
```

---

## تشغيل محلي (للاختبار)

```bash
# انسخ ملف البيئة
cp .env.example .env
# عدّل القيم في .env

# شغّل كل شيء
docker compose up -d

# لتشغيل pgAdmin أيضاً
docker compose --profile dev up -d

# سحب نموذج Ollama بعد التشغيل
docker compose exec ollama ollama pull gemma3:4b
```

التطبيق على: http://localhost:8080

---

## مراقبة الخادم

### من داخل عدالة:
- **Super Admin** → **مركز النشر** → مراقبة مباشرة للـ CPU/RAM
- **مراقبة SaaS** → إحصائيات المكاتب والمستخدمين

### من Coolify:
- Real-time logs
- CPU/Memory graphs
- Deployment history

---

## النسخ الاحتياطي التلقائي

### قاعدة البيانات:
```bash
# Coolify Backup (تلقائي)
# Settings → Backup → Enable → كل 24 ساعة

# أو يدوياً:
docker compose exec postgres pg_dump -U adala adala > backup_$(date +%Y%m%d).sql
```

### من داخل عدالة:
- **Super Admin** → **مركز النشر** → **النسخ الاحتياطية** → "نسخة جديدة"

---

## تكاليف شهرية تقديرية

| العنصر | التكلفة |
|---|---|
| Hetzner CX22 | ~6$ |
| Gemini API (500 مكتب) | ~20-50$ |
| Cloudflare (مجاني) | 0$ |
| **المجموع** | **~26-56$/شهر** |

مقارنة بـ AWS/GCP للخدمات المشابهة: وفر 60-80%.
