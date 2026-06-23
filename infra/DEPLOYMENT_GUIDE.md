# دليل النشر على Hetzner — عدالة AI

## الخطوة 1: إعداد السيرفر (مرة واحدة)

```bash
ssh root@YOUR_SERVER_IP 'bash -s' < scripts/hetzner-setup.sh
```

يُعدّ تلقائياً: Docker، UFW، Fail2ban، Swap، Cron للـ backup.

---

## الخطوة 2: GitHub Secrets

`GitHub Repo → Settings → Secrets and Variables → Actions`

| المفتاح | القيمة | مطلوب؟ |
|---------|--------|---------|
| `HETZNER_IP` | IP السيرفر | ✅ |
| `HETZNER_SSH_KEY` | المفتاح الخاص (ed25519) | ✅ |
| `DB_PASSWORD` | كلمة مرور قوية | ✅ |
| `CLERK_SECRET_KEY` | من Clerk Dashboard | ✅ |
| `CLERK_PUBLISHABLE_KEY` | من Clerk Dashboard | ✅ |
| `STRIPE_SECRET_KEY` | من Stripe Dashboard | ✅ |
| `GEMINI_API_KEY` | من Google AI Studio | ✅ |
| `GRAFANA_PASSWORD` | كلمة مرور لـ Grafana | ✅ |
| `ANTHROPIC_API_KEY` | من Anthropic | اختياري |
| `OPENAI_API_KEY` | من OpenAI | اختياري |
| `SENTRY_DSN` | من sentry.io | اختياري |
| `ALLOWED_ORIGINS` | https://yourdomain.com | اختياري |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | من Replit | اختياري |

---

## الخطوة 3: أول Deploy

```bash
git push origin main
```

GitHub Actions يُزامن الكود ويبني الـ containers تلقائياً.

---

## الخطوة 4: SSL

```bash
ssh root@YOUR_SERVER_IP
bash /opt/adala/infra/ssl-init.sh yourdomain.com admin@yourdomain.com
```

---

## الخطوة 5: ترحيل البيانات من Replit

```bash
REPLIT_DB_URL="postgresql://..." \
HETZNER_DB_URL="postgresql://adala:PASSWORD@YOUR_IP:5432/adala" \
bash scripts/migrate-replit-to-hetzner.sh
```

---

## هيكل الخدمات الكامل

```
Internet
   ↓
Nginx Gateway (80/443)  ← Security headers + rate limiting
   ├── /api/events/stream → API (SSE, بدون buffering)
   ├── /api/*            → API Server (8080)
   ├── /metrics          → 403 (مغلق خارجياً)
   └── /*                → React SPA (3000)

OBSERVABILITY (داخلي فقط — SSH tunnel)
   Prometheus (9090)  ← يجمع من:
      ├── API /metrics    (adala_http_*, adala_ai_*, etc.)
      ├── postgres-exporter (9187)
      ├── redis-exporter   (9121)
      └── node-exporter    (9100)
   Grafana (3001)     ← Dashboard مرئي
      └── auto-provision: datasource + dashboard "عدالة AI Overview"

RELIABILITY
   Backup cron: يومياً 2:00 ص → /opt/adala/backups/
   Retention: 7 أيام
   Sentry: تتبع الأخطاء (SENTRY_DSN اختياري)
```

---

## الوصول للـ Observability

الـ monitoring ports مربوطة على `127.0.0.1` فقط (لا تُعرَّض للإنترنت).  
الوصول عبر SSH tunnel:

```bash
ssh -L 9090:localhost:9090 -L 3001:localhost:3001 root@YOUR_SERVER_IP

# ثم من متصفحك:
# http://localhost:3001  → Grafana (admin / كلمة المرور من GRAFANA_PASSWORD)
# http://localhost:9090  → Prometheus
```

---

## Grafana — Dashboard "عدالة AI Overview"

يتضمن مؤشرات جاهزة:

| المؤشر | الوصف |
|--------|-------|
| **معدل الطلبات** | req/s لآخر دقيقة |
| **زمن الاستجابة** | p50 / p95 / p99 |
| **معدل الأخطاء** | 4xx + 5xx |
| **صحة قاعدة البيانات** | ✅ Healthy / ⛔ Down |
| **AI Requests** | حسب النوع والموديل |
| **Node.js Memory** | RSS + Heap |
| **PostgreSQL Connections** | اتصالات نشطة |
| **Redis Memory** | استهلاك الذاكرة |

---

## النسخ الاحتياطي

```bash
# استعراض النسخ
ls /opt/adala/backups/

# استعادة نسخة
bash /opt/adala/infra/backup/restore.sh /opt/adala/backups/adala_20240101_020000.sql.gz

# تشغيل فوري
bash /opt/adala/infra/backup/backup.sh
```

---

## أوامر مفيدة على السيرفر

```bash
cd /opt/adala/infra

# حالة الخدمات
docker compose ps

# لوقات API
docker compose logs -f api

# لوقات Prometheus
docker compose logs prometheus

# دخول DB
docker compose exec db psql -U adala adala

# إعادة تشغيل خدمة
docker compose restart api

# تحديث بدون إعادة build كاملة
docker compose up -d --no-build api
```

---

## الفرق الجوهري: Hetzner vs Replit

| الميزة | Replit | Hetzner |
|--------|--------|---------|
| `ai_workflows.id` | TEXT + CHECK | UUID native |
| Prometheus metrics | ✅ في الـ API | ✅ + Grafana |
| Grafana dashboards | ❌ | ✅ auto-provisioned |
| Backup يومي | ❌ | ✅ cron + retention |
| Security headers | Helmet (API) | Helmet + Nginx |
| Sentry | اختياري | اختياري (SENTRY_DSN) |
| DB access | محدود | كامل |
