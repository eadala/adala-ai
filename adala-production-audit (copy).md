# تقرير التدقيق الاحترافي — منصة عدالة AI
**التاريخ:** 14 يونيو 2026 | **الإصدار:** 1.0  
**النطاق:** Adala Production Stability Audit  
**المُدقِّق:** Adala Agent System

---

## الملخص التنفيذي

منصة عدالة هي نظام إدارة مكاتب محاماة (SaaS متعدد العملاء) مبني على:
- **Frontend:** React 19 + Vite 7 + Tailwind CSS 4 + Wouter + Clerk v6
- **Backend:** Node.js + Express + PostgreSQL + Drizzle ORM
- **Auth:** Clerk JWT + Custom Client Portal Auth
- **Billing:** Stripe Connect + Moyasar + Checkout.com

المنصة **قابلة للاستخدام في بيئة تجريبية محدودة** (مكتب واحد)، لكنها تحتاج إصلاحات جوهرية قبل قبول مكاتب متعددة في الإنتاج الفعلي.

---

## تقييم المعمارية

### نقاط القوة ✅

| المجال | التفاصيل |
|---|---|
| Frontend Bundle | Vite + lazy loading لـ 50+ صفحة + manual chunks محسّنة |
| Clerk Auth | JWT + proxy + cache invalidation عند تغيير الجلسة |
| Stripe Billing | تكامل كامل — 6 أحداث webhook مع signature verification |
| AI Integration | Gemini + Claude + OpenAI مع نظام credits لكل مكتب |
| HR / Payroll | كشف رواتب + حضور + إجازات مكتمل |
| Client Portal | OTP + scrypt password hashing (ممارسة آمنة) |
| Rate Limiting | 300 req/min عام، 30 req/min للـ AI |
| Error Boundaries | App-level + window error listeners في Production |

### نقاط الضعف الجوهرية ❌

| الأولوية | المشكلة |
|---|---|
| 🔴 CRITICAL | تسريب البيانات بين المكاتب (Multi-tenant isolation) |
| 🔴 CRITICAL | مسارات API بدون requireAuth (contracts GET مثالاً) |
| 🟠 HIGH | غياب شبه كامل للـ database indexes |
| 🟠 HIGH | CORS مفتوح على جميع الـ origins |
| 🟠 HIGH | تضارب أنواع البيانات (UUID vs TEXT في case_id) |
| 🟡 MEDIUM | ensureTable() anti-pattern في بعض المسارات |
| 🟡 MEDIUM | WhatsApp webhook بدون X-Hub-Signature verification |
| 🟡 MEDIUM | Audit logging غير منتظم عبر المسارات |

---

## تقييم الأمان — Security Score: 45/100

### 1. المصادقة والجلسات

**Clerk (المستخدمون الرئيسيون):**
- ✅ JWT verification صحيح
- ✅ Clerk Proxy للدومينات المخصصة
- ✅ `VITE_CLERK_PUBLISHABLE_KEY` مباشر (لا `publishableKeyFromHost`)

**Client Portal (العملاء القانونيون):**
- ✅ scrypt + timingSafeEqual (ممارسة آمنة)
- ⚠️ توكن الجلسة يُمرَّر أحياناً كـ query parameter (`?ct=...`) — يتسرب في logs

### 2. التفويض (Authorization)

```
requireAuth              → يتحقق من Clerk userId فقط
requireAuthWithTenant    → يُحدد officeId أيضاً
adminOnly                → PLATFORM_OWNER_EMAIL أو super_admin role
```

**المشكلة:** غالبية المسارات تستخدم `requireAuth` فقط دون `requireAuthWithTenant`، مما يعني أن البيانات لا تُفلتَر حسب المكتب.

### 3. Rate Limiting

| النوع | الحد |
|---|---|
| Global | 300 req/min/IP |
| AI endpoints | 30 req/min/IP |
| Client portal token | 30 req/min/IP |

`app.set("trust proxy", 1)` مضبوط بشكل صحيح لبيئة Replit.

### 4. Security Headers & CORS

| الإعداد | الحالة |
|---|---|
| Helmet | ✅ مفعّل |
| Content Security Policy | ⚠️ معطّل (handled by frontend) |
| CORS origin | ❌ `true` (يقبل أي موقع) |
| CORS credentials | `true` |

### 5. Webhooks

| المزود | التحقق |
|---|---|
| Stripe | ✅ Signature verification صحيح |
| WhatsApp/Meta | ❌ handshake فقط، بدون X-Hub-Signature على POST |
| Moyasar | ⚠️ اختياري (optional) |

### 6. مخاطر OWASP

| الخطر | المستوى | التفاصيل |
|---|---|---|
| A01 Broken Access Control | 🔴 عالٍ | routes بدون auth + بيانات بدون tenant filter |
| A02 Cryptographic Failures | 🟡 متوسط | مفاتيح AI مخزنة كـ base64 في DB |
| A05 Security Misconfiguration | 🟠 متوسط-عالٍ | CORS مفتوح + CSP معطّل |
| A09 Improper Assets Management | 🟡 متوسط | Developer Impersonation feature هدف عالي القيمة |

---

## تقييم الأداء — Performance Score: 55/100

### 1. قاعدة البيانات

**⚠️ مشكلة حرجة: غياب شبه كامل للـ indexes**

الجداول الرئيسية تفتقر لهذه الفهارس:

```sql
-- فهارس مفقودة على أكثر الأعمدة بحثاً:
cases.office_id      → full table scan على كل طلب
cases.status         → full table scan عند الفلترة
clients.office_id    → full table scan
documents.case_id    → full table scan
invoices.office_id   → full table scan
```

تأثير الغياب: عند وصول البيانات لـ 10,000+ سجل، كل طلب يصبح عملية O(n).

### 2. Frontend Bundle

| الـ Chunk | الحجم المتوقع | الحالة |
|---|---|---|
| vendor-react | ~150KB | ✅ |
| vendor-clerk | ~200KB | ✅ |
| vendor-tanstack | ~100KB | ✅ |
| vendor-charts | ~400KB | ✅ |
| vendor-icons | ~300KB | ✅ |
| @radix-ui/* | Auto-chunked | ✅ (بعد إصلاح TDZ) |

**إيجابيات:**
- 50+ صفحة lazy-loaded
- Landing page eager (تظهر فوراً)
- React Query: staleTime=5min, gcTime=30min
- `refetchOnWindowFocus: false` لتقليل الطلبات

### 3. Shadow Schema (مشكلة أداء وصحة)

```typescript
// cases.ts — أعمدة غير موجودة في Drizzle ORM:
cases.source         → raw SQL فقط
cases.store_order_id → raw SQL فقط
cases.created_by     → raw SQL فقط
```

هذا يعني bypass للـ type-safety ويصعّب الاستعلامات المركبة.

---

## تقييم الموثوقية — Reliability Score: 58/100

### 1. Cascading Deletes (مفقودة)

```
حذف case  → تبقى سجلات يتيمة في: documents, ai_tasks, invoices, messages
حذف client → تبقى سجلات يتيمة في: cases, documents, contracts
```

### 2. Anti-patterns

```typescript
// reminders.ts, signatures.ts — DDL داخل Route handler:
await db.execute(sql`CREATE TABLE IF NOT EXISTS reminders (...)`);
// يجب أن يكون في lib/db/src/schema/ مع Drizzle migration
```

### 3. تضارب أنواع البيانات

```typescript
casesTable.id          → text  ← التعريف الرئيسي
contractsTable.caseId  → uuid  ← مختلف!
// يُسبب خطأ في runtime عند JOIN:
WHERE case_id = ${caseId}::uuid  ← casting يدوي مؤقت
```

### 4. Notifications بدون Persistence

```typescript
// notifications.ts — تُولَّد on-the-fly بدون جدول مستقل:
const notifications = [
  ...overdueInvoices.map(...),
  ...pendingContracts.map(...),
];
// لا يوجد تاريخ الإشعارات، لا mark-as-read حقيقي
```

### 5. Error Handling (إيجابي)

- ✅ AppErrorBoundary في المستوى الأعلى
- ✅ window error listeners تعرض أخطاء JS في الإنتاج
- ✅ PageLoader fallback لكل الصفحات
- ✅ retry: 1 في React Query

---

## تقييم قابلية التوسع — Scalability Score: 50/100

### معمارية Multi-tenancy

النموذج المستخدم: **Shared Database, Shared Schema** مع discriminator column

```
المزايا:   أبسط في الإدارة، لا حاجة لـ DB per tenant
العيوب:    يتطلب فلترة دقيقة في كل استعلام (غير مطبّق حالياً)
```

### التوسع الرأسي (Vertical Scaling)
- بيئة Replit: محدودة بموارد الـ container
- PostgreSQL: قابل للتوسع بإضافة read replicas

### التوسع الأفقي (Horizontal Scaling)
- ❌ In-memory cache في tenantMiddleware (لا يتشارك بين instances)
- ❌ لا يوجد job queue (email cron يعمل داخل نفس الـ process)
- ✅ Stateless API (يمكن تشغيل نسخ متعددة مع shared DB)

---

## تقييم سير العمل الأساسي

### إدارة القضايا (Cases)
| الوظيفة | الحالة |
|---|---|
| إنشاء قضية | ✅ |
| تعيين محامٍ | ✅ |
| مراحل القضية | ✅ |
| الجلسات | ✅ |
| المهام | ✅ |
| المستندات | ✅ |
| التصفية بالمكتب | ❌ مفقودة |

### إدارة العملاء (Clients)
| الوظيفة | الحالة |
|---|---|
| ملف العميل | ✅ |
| التقارير المالية | ✅ |
| بوابة العميل | ✅ |
| فلتر المكتب | ❌ مفقود |

### الفواتير والمالية
| الوظيفة | الحالة |
|---|---|
| فواتير العملاء | ✅ |
| Stripe integration | ✅ |
| خطط الاشتراك | ✅ |
| تقارير مالية | ✅ |
| فوترة متكررة للعملاء | ❌ مفقودة |

### العقود والتوقيع الإلكتروني
| الوظيفة | الحالة |
|---|---|
| إنشاء العقود بالـ AI | ✅ |
| تحليل المخاطر | ✅ |
| توقيع إلكتروني | ⚠️ نص فقط، بدون PDF hash |
| تخزين العقود | ✅ |

### الإشعارات
| الوظيفة | الحالة |
|---|---|
| إشعارات داخل التطبيق | ⚠️ مولّدة on-the-fly |
| بريد إلكتروني | ✅ cron job |
| Telegram | ✅ |
| WhatsApp | ⚠️ حالة القضية فقط |

---

## البنية التحتية للإنتاج

### Deployment Configuration
- **Platform:** Replit (static frontend + Node.js backend)
- **Build:** pnpm workspaces — `vite build` + `esbuild`
- **SPA Routing:** `cp dist/public/index.html dist/public/404.html` ✅
- **PORT:** من environment variable ✅
- **Database:** PostgreSQL managed (DATABASE_URL env) ✅

### Environment Variables
| المتغير | الحالة |
|---|---|
| VITE_CLERK_PUBLISHABLE_KEY | ✅ |
| VITE_CLERK_PROXY_URL | ✅ (absolute URL at runtime) |
| DATABASE_URL | ✅ |
| CLERK_SECRET_KEY | ✅ |
| STRIPE_SECRET_KEY | ✅ |
| GEMINI_API_KEY | ✅ |

### Backup Strategy
- ⚠️ backup_settings + backup_jobs موجودة في DB
- ❌ لا يوجد automated backup مجدوَل فعلياً للـ DB
- ❌ لا disaster recovery plan موثّق

---

## المشكلات الحرجة (ملخص)

### 🔴 Critical Issues

**#1 — Multi-tenant Data Leakage**
```
الجداول المتأثرة: cases, clients, documents, contracts, client_invoices
الخطورة: مكتب A يمكنه قراءة بيانات مكتب B
الحل: إضافة office_id + WHERE office_id = req.tenantId في كل route
```

**#2 — Unauthenticated Routes**
```
المسارات المتأثرة: GET /contracts وغيرها
الخطورة: أي شخص يمكنه قراءة العقود بدون تسجيل دخول
الحل: إضافة requireAuth middleware
```

### 🟠 High Priority Issues

**#3 — Missing Database Indexes**
```
التأثير: degraded performance عند 10K+ records
الحل: إضافة indexes على office_id, case_id, client_id, status
```

**#4 — Open CORS**
```
الخطر: CSRF / XS-Search attacks
الحل: تحديد allowed origins
```

**#5 — UUID/TEXT Type Mismatch**
```
التأثير: أخطاء runtime عند JOIN بين contracts و cases
الحل: توحيد نوع البيانات
```

---

## خطة الإصلاح الموصى بها

### المرحلة 1 — أسبوع (إصلاحات حرجة)

```sql
-- 1. إضافة office_id للجداول الرئيسية
ALTER TABLE cases ADD COLUMN office_id TEXT;
ALTER TABLE clients ADD COLUMN office_id TEXT;
ALTER TABLE documents ADD COLUMN office_id TEXT;
ALTER TABLE contracts ADD COLUMN office_id TEXT;
ALTER TABLE client_invoices ADD COLUMN office_id TEXT;

-- 2. إضافة فهارس الأداء
CREATE INDEX idx_cases_office_id ON cases(office_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_clients_office_id ON clients(office_id);
CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_invoices_office_id ON client_invoices(office_id);
```

```typescript
// 3. تطبيق requireAuthWithTenant + tenant filter على كل route
router.get("/cases", requireAuthWithTenant, async (req, res) => {
  const cases = await db.select().from(casesTable)
    .where(eq(casesTable.officeId, req.tenantId));
});
```

### المرحلة 2 — أسبوعان (تحسينات الأمان)

- [ ] تضييق CORS للـ origins المعروفة
- [ ] WhatsApp webhook signature verification
- [ ] إزالة client session token من query params
- [ ] تفعيل CSP headers

### المرحلة 3 — شهر (تنظيف المعمارية)

- [ ] توحيد `tenant_id` vs `office_id` في كل الجداول
- [ ] توحيد `uuid` vs `text` للـ IDs
- [ ] نقل كل DDL من route handlers إلى Drizzle schema
- [ ] Persistent notifications table
- [ ] Audit logging على كل المسارات
- [ ] إضافة cascading deletes للعلاقات الرئيسية

---

## الحكم النهائي

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   الأمان (Security)      ████████░░░░░░░░░  45 / 100       │
│   الأداء (Performance)   ████████████░░░░░  55 / 100       │
│   الموثوقية (Reliability) █████████████░░░  58 / 100       │
│   التوسع (Scalability)   ████████████░░░░░  50 / 100       │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  ✅  READY WITH CONDITIONS                          │  │
│   │                                                     │  │
│   │  مناسب لمكتب واحد أو بيئة تجريبية.                │  │
│   │  يتطلب إصلاح المرحلة 1 قبل قبول مكاتب متعددة.    │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

*تم إعداد هذا التقرير تلقائياً بواسطة Adala Agent System*  
*يُنصح بمراجعة دورية كل 3 أشهر أو عند أي تغيير معماري كبير*
