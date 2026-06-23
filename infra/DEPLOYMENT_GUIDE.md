# دليل النشر على Hetzner — عدالة AI

## الخطوة 1: إعداد السيرفر (مرة واحدة)

```bash
ssh root@YOUR_SERVER_IP 'bash -s' < scripts/hetzner-setup.sh
```

يُعدّ تلقائياً: Docker، UFW، Fail2ban، Swap، Cron للـ backup.

---

## الخطوة 2: GitHub Secrets

`GitHub Repo → Settings → Secrets and Variables → Actions`

### أساسية (مطلوبة)
| المفتاح | القيمة |
|---------|--------|
| `HETZNER_IP` | IP السيرفر |
| `HETZNER_SSH_KEY` | المفتاح الخاص (ed25519) |
| `DB_PASSWORD` | كلمة مرور قوية للـ PostgreSQL |
| `CLERK_SECRET_KEY` | من Clerk Dashboard |
| `CLERK_PUBLISHABLE_KEY` | من Clerk Dashboard |
| `STRIPE_SECRET_KEY` | من Stripe Dashboard |
| `GEMINI_API_KEY` | من Google AI Studio |
| `GRAFANA_PASSWORD` | كلمة مرور Grafana |

### Observability (اختيارية — موصى بها)
| المفتاح | القيمة |
|---------|--------|
| `SENTRY_DSN` | من sentry.io → Project → Settings → DSN |
| `ALERT_EMAIL` | البريد الإلكتروني لاستقبال التنبيهات |
| `SMTP_HOST` | عنوان SMTP (مثال: smtp.gmail.com) |
| `SMTP_USER` | اسم مستخدم SMTP |
| `SMTP_PASSWORD` | كلمة مرور SMTP (App Password لـ Gmail) |
| `SLACK_WEBHOOK_URL` | من Slack → Apps → Incoming Webhooks |

### اختيارية أخرى
| المفتاح | القيمة |
|---------|--------|
| `ANTHROPIC_API_KEY` | من Anthropic |
| `OPENAI_API_KEY` | من OpenAI |
| `ALLOWED_ORIGINS` | https://yourdomain.com |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | من Replit |

---

## الخطوة 3: أول Deploy

```bash
git push origin main
```

---

## الخطوة 4: SSL

```bash
ssh root@YOUR_SERVER_IP
bash /opt/adala/infra/ssl-init.sh yourdomain.com admin@yourdomain.com
```

---

## الخطوة 5: ترحيل البيانات

```bash
REPLIT_DB_URL="postgresql://..." \
HETZNER_DB_URL="postgresql://adala:PASSWORD@IP:5432/adala" \
bash scripts/migrate-replit-to-hetzner.sh
```

---

## هيكل الخدمات الكامل

```
Internet
   ↓
Nginx Gateway (80/443)  ← Security headers + /metrics blocked
   ├── /api/events/stream → API (SSE, no buffering)
   ├── /api/*            → API Server (8080)
   └── /*                → React SPA (3000)

═══════════════════════════════════════════
OBSERVABILITY (SSH tunnel فقط)
═══════════════════════════════════════════

Prometheus (9090)  ──────────────────────────────────
   ├── API /metrics       (adala_http_*, adala_ai_*)
   ├── postgres-exporter  (pg connections, queries)
   ├── redis-exporter     (memory, hit rate)
   └── node-exporter      (CPU, RAM, disk)
         ↓ alerts
Alertmanager (9093) → Email + Slack

Grafana (3001)
   ├── Prometheus  (metrics)
   ├── Loki        (logs)    ← Promtail يُرسل لوقات Docker
   └── Tempo       (traces)  ← API → OTel Collector → Tempo

Loki (3100) ← Promtail يجمع لوقات كل containers
Tempo (3200) ← OTel Collector يستقبل traces من API
OTel Collector ← API يُرسل traces (OTLP/HTTP)
```

---

## الوصول للـ Observability

```bash
# SSH tunnel
ssh -L 9090:localhost:9090 \
    -L 3001:localhost:3001 \
    -L 9093:localhost:9093 \
    root@YOUR_SERVER_IP

# المتصفح:
http://localhost:3001  → Grafana  (admin / GRAFANA_PASSWORD)
http://localhost:9090  → Prometheus
http://localhost:9093  → Alertmanager
```

---

## Grafana — ما ستراه فور الدخول

### Dashboard "عدالة AI Overview" (auto-provisioned)
| المؤشر | الوصف |
|--------|-------|
| معدل الطلبات | req/s لآخر دقيقة |
| p50 / p95 / p99 | زمن الاستجابة |
| معدل الأخطاء | 4xx + 5xx |
| صحة قاعدة البيانات | ✅/⛔ |
| AI Requests | حسب النوع والموديل |
| Node.js Memory | RSS + Heap |
| PG Connections | اتصالات نشطة |
| Redis Memory | استهلاك الذاكرة |

### Explore → Loki
- ابحث في لوقات API: `{service="api"}`
- فلتر بالمستوى: `{service="api", level="error"}`
- ربط تلقائي بـ Traces (TraceID)

### Explore → Tempo
- Trace view كامل لكل طلب
- ربط تلقائي بـ Logs (TraceID → Loki)
- Service graph تلقائي

---

## تنبيهات مُعدَّة مسبقاً

| التنبيه | الشرط | الخطورة |
|---------|-------|---------|
| HighAPIErrorRate | أخطاء API > 5% لـ 2 دقيقة | 🔴 Critical |
| HighP95Latency | p95 > 1000ms لـ 3 دقائق | 🟡 Warning |
| APIDown | API لا يستجيب لـ 1 دقيقة | 🔴 Critical |
| DatabaseDown | DB_health = 0 | 🔴 Critical |
| HighDBConnectionCount | > 80 اتصال | 🟡 Warning |
| RedisDown | Redis لا يستجيب | 🔴 Critical |
| HighCPUUsage | CPU > 85% لـ 5 دقائق | 🟡 Warning |
| HighMemoryUsage | RAM > 90% | 🔴 Critical |
| DiskSpaceLow | قرص < 10% | 🔴 Critical |
| HighAIRequestRate | AI > 10 req/s لـ 5 دقائق | 🟡 Warning |

---

## النسخ الاحتياطي

```bash
# استعراض
ls /opt/adala/backups/

# تشغيل فوري
bash /opt/adala/infra/backup/backup.sh

# استعادة
bash /opt/adala/infra/backup/restore.sh /opt/adala/backups/adala_YYYYMMDD.sql.gz
```

---

## أوامر مفيدة على السيرفر

```bash
cd /opt/adala/infra

# حالة الخدمات
docker compose ps

# لوقات API
docker compose logs -f api

# لوقات Alertmanager
docker compose logs alertmanager

# إعادة تشغيل
docker compose restart api

# دخول DB
docker compose exec db psql -U adala adala

# تحديث config Prometheus بدون restart
curl -X POST http://localhost:9090/-/reload
```
