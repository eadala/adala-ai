# دليل النشر على Hetzner — عدالة AI

## الخطوة 1: إعداد السيرفر (مرة واحدة)

```bash
ssh root@YOUR_SERVER_IP 'bash -s' < scripts/hetzner-setup.sh
```

## الخطوة 2: GitHub Secrets

أضف هذه الـ Secrets في:
`GitHub Repo → Settings → Secrets and Variables → Actions`

| المفتاح | القيمة |
|---------|--------|
| `HETZNER_IP` | IP السيرفر |
| `HETZNER_SSH_KEY` | المفتاح الخاص (ed25519) |
| `DB_PASSWORD` | كلمة مرور قوية للـ PostgreSQL |
| `CLERK_SECRET_KEY` | من Clerk Dashboard |
| `CLERK_PUBLISHABLE_KEY` | من Clerk Dashboard |
| `STRIPE_SECRET_KEY` | من Stripe Dashboard |
| `GEMINI_API_KEY` | من Google AI Studio |
| `ANTHROPIC_API_KEY` | (اختياري) |
| `OPENAI_API_KEY` | (اختياري) |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | من Replit إن احتجته |

## الخطوة 3: أول Deploy

```bash
git push origin main
```
GitHub Actions سيبني الـ containers وينشرها تلقائياً.

## الخطوة 4: SSL

```bash
ssh root@YOUR_SERVER_IP
bash /opt/adala/infra/ssl-init.sh yourdomain.com admin@yourdomain.com
```

## الخطوة 5: ترحيل البيانات من Replit

```bash
REPLIT_DB_URL="postgresql://..." \
HETZNER_DB_URL="postgresql://adala:PASSWORD@YOUR_IP:5432/adala" \
bash scripts/migrate-replit-to-hetzner.sh
```

## هيكل الخدمات

```
Internet
   ↓
Nginx Gateway (80/443)
   ├── /api/* → API Server (8080)
   └── /*     → React SPA (3000)
              ↓
          PostgreSQL (UUID-native)
          Redis (cache)
```

## الفرق الجوهري: Hetzner vs Replit

| الميزة | Replit | Hetzner |
|--------|--------|---------|
| ai_workflows.id | TEXT + CHECK | **UUID native** |
| Migrations | Auto (قيود) | Controlled |
| SSL | مدمج | Let's Encrypt |
| DB ownership | محدود | كامل |
| Scaling | محدود | VPS upgrade |

## أوامر مفيدة على السيرفر

```bash
# مشاهدة اللوقات
cd /opt/adala/infra && docker compose logs -f api

# إعادة تشغيل خدمة
docker compose restart api

# دخول الـ DB
docker compose exec db psql -U adala adala

# حالة الخدمات
docker compose ps
```
