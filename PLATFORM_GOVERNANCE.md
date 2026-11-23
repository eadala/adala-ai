# دليل حوكمة منصة عدالة AI
# Platform Governance Guide — Adala AI

> **الإصدار:** 1.0 | **آخر تحديث:** يونيو 2026

---

## 1. الفلسفة

حوكمة منصة عدالة تعني أن **كل طبقة في النظام** تخضع لـ:
- **مرجع مركزي واحد (Single Source of Truth)** — Registry TypeScript موثّق
- **فاحص آلي ضمن CI/CD** — يخرج بكود 1 عند وجود مشاكل حرجة
- **توثيق رسمي** — هذا الملف
- **معايير إلزامية** — أي إضافة لأي طبقة تمر بالـ Registry أولاً

---

## 2. خريطة السجلات (Registries Map)

```
artifacts/adala/src/lib/
├── routeRegistry.ts          ← Routes + Navigation
├── permissionsRegistry.ts    ← RBAC Permissions
└── featureFlagsRegistry.ts   ← Feature Flags + Plans

artifacts/api-server/src/lib/
├── eventsRegistry.ts         ← Domain Events
├── aiRegistry.ts             ← AI Models + Agents + Tools
├── integrationsRegistry.ts   ← External Integrations
├── backgroundJobsRegistry.ts ← Cron Jobs
└── dbRegistry.ts             ← Database Tables + Policies

scripts/governance/
├── platform-check.mjs        ← الفاحص الشامل (8 طبقات)
└── quality-gate.sh            ← البوابة الكاملة
```

---

## 3. تفاصيل كل سجل

### 3.1 Route Registry — `routeRegistry.ts`
```
الطبقة: Frontend Navigation
الحجم: 155+ route
الفاحص: validate-routes.mjs
المعيار: Broken=0, Duplicates=0, Coverage=100%
```
**ما يحتويه:** كل route مع guard, module, permission, feature, navGroup, breadcrumb

**إضافة Route جديد:**
1. أضف في `routeRegistry.ts` أولاً
2. أضف في `App.tsx` مع guard مناسب
3. أضف رابطاً في `layout.tsx` إذا لزم
4. شغّل `pnpm --filter @workspace/adala validate:routes`

---

### 3.2 Permissions Registry — `permissionsRegistry.ts`
```
الطبقة: RBAC Authorization
الحجم: 17 صلاحية
الفاحص: platform-check.mjs (طبقة 1)
المعيار: جميع requirePermission() مسجّلة
```
**ما يحتويه:** key, action, scope, routes, apiPaths, defaultForRoles

**إضافة صلاحية جديدة:**
1. أضف في `permissionsRegistry.ts`
2. استخدم `requirePermission("new:perm")` في الـ API
3. استخدم `<RoleRoute permission="new:perm">` في الـ Frontend

---

### 3.3 Feature Flags Registry — `featureFlagsRegistry.ts`
```
الطبقة: Plan-based Feature Gating
الحجم: 23 flag
الفاحص: platform-check.mjs (طبقة 2)
المعيار: Feature references في routeRegistry.ts صحيحة
```
**ما يحتويه:** key, plans, limits per plan, routes, apiPaths

**خريطة الباقات:**
```
trial       → الميزات الأساسية فقط (5 قضايا, 10 عملاء)
starter     → AI محدود (100 credit/شهر), HR (10 موظفين)
professional → AI كامل, JLWM, Client Portal, Telegram/WhatsApp
enterprise  → API Access, Custom Domain, SLA, AI Training مخصص
bankruptcy  → وحدة الإفلاس الكاملة
```

---

### 3.4 Events Registry — `eventsRegistry.ts`
```
الطبقة: Domain Events (EDA)
الحجم: 24 event type
الفاحص: platform-check.mjs (طبقة 3)
المعيار: جميع EventBus types مسجّلة
```
**ما يحتويه:** type, category, emittedBy, listeners, automations, persistence

**إضافة Event جديد:**
1. أضف النوع في `eventBus.ts` (EventType union)
2. أضف التعريف في `eventsRegistry.ts`
3. أضف `eventBus.emit(type, payload)` في المكان المناسب
4. أضف listener في `eventBus.ts` (إذا لزم أتمتة)

**الأحداث التي تُطلق إشعارات:**

| الحدث | بريد | تيليجرام | إشعار |
|-------|------|----------|-------|
| INVOICE_PAID | ✅ | ✅ | ✅ |
| CASE_CLOSED | — | ✅ | ✅ |
| CONTRACT_SIGNED | ✅ | — | ✅ |
| SUBSCRIPTION_RENEWED | ✅ | — | — |

---

### 3.5 AI Registry — `aiRegistry.ts`
```
الطبقة: AI Models + Agents + Tools
الحجم: 5 نماذج, 10 وكلاء, 3 أدوات
الفاحص: platform-check.mjs (طبقة 4)
المعيار: Gemini مسجّل, Fallback موجود
```
**ما يحتويه:** model specs, credit cost, agents with routes/plans, tool schemas

**تكلفة الـ Credits:**
```
gemini-2.0-flash  → 1 credit/call  (النموذج الافتراضي)
gemini-1.5-pro    → 2 credits/call (المهام المعقدة)
claude/gpt-4o     → 3 credits/call (بديل)
arabic-template   → 0 credits      (fallback بدون اتصال)
```

**إضافة وكيل جديد:**
1. أضف في `AI_AGENTS` في `aiRegistry.ts`
2. أنشئ route في API
3. استخدم `callAI()` من `aiChat.ts`
4. أضف `aiCreditsDeduct()` إذا لزم

---

### 3.6 Integrations Registry — `integrationsRegistry.ts`
```
الطبقة: External Integrations
الحجم: 14 تكامل (6 active, 5 configurable, 3 planned)
الفاحص: platform-check.mjs (طبقة 5)
المعيار: جميع webhook paths موجودة في routes
```
**ما يحتويه:** status, requiredEnvVars, webhookPath, webhookSecurity

**إضافة تكامل جديد:**
1. أضف في `integrationsRegistry.ts`
2. وثّق env vars المطلوبة في `requiredEnvVars`
3. وثّق آلية أمان الـ webhook في `webhookSecurity`
4. أنشئ route مع التحقق من الـ signature

**التكاملات النشطة:**
```
stripe      → Payments + Subscriptions + Connect
clerk       → Auth + Sessions + OAuth
gemini-ai   → Primary AI model
email-smtp  → Notifications + Invoices
github      → Code backup
object-storage → Files + Documents
```

---

### 3.7 Background Jobs Registry — `backgroundJobsRegistry.ts`
```
الطبقة: Cron Jobs + Scheduled Tasks
الحجم: 7 مهام (7 active)
الفاحص: platform-check.mjs (طبقة 6)
المعيار: Critical jobs لها alertOnFailure: true
```
**ما يحتويه:** schedule (cron), maxDurationMs, retryPolicy, affectedTables

**الجدول الزمني:**
```
*/10 * * * *  → monitoring heartbeat (كل 10 دقائق)
0 * * * *     → email cron (كل ساعة)
0 */6 * * *   → tenant backup (كل 6 ساعات)
0 2 * * *     → AI agents cron (يومياً 02:00)
30 2 * * *    → full backup (يومياً 02:30)
0 3 * * *     → log rotation (يومياً 03:00)
@boot+5s      → AI warmup (مرة عند البدء)
```

**إضافة مهمة جديدة:**
1. أضف في `backgroundJobsRegistry.ts`
2. أنشئ ملف في `src/cron/` أو أضف لـ `agentCron.ts`
3. استخدم `cron.schedule()` مع error handling
4. أضف `maxDurationMs` لمنع التوقف المطوّل

---

### 3.8 DB Registry — `dbRegistry.ts`
```
الطبقة: Database Schema + Isolation Policies
الحجم: 21 جدول موثّق (من أصل ~70+)
الفاحص: platform-check.mjs (طبقة 7)
المعيار: جميع جداول office_id لها index
```
**ما يحتويه:** tableName, isolation policy, requiredIndexes, relations, retentionPolicy

**سياسة العزل الإلزامية:**
```
office_id   → المعيار الافتراضي لجميع بيانات المكاتب
user_id     → بيانات المستخدم الشخصية فقط
platform-wide → بيانات المنصة (office_registry, system_events)
public      → بيانات عامة بدون عزل
```

**إضافة جدول جديد:**
1. أضف في `dbRegistry.ts` أولاً
2. أضف في `schema.ts` مع `office_id TEXT NOT NULL`
3. أضف migration في `001_tenant_isolation.sql`
4. أضف index على `office_id`
5. تأكد أن جميع queries تفلتر بـ `office_id`

---

## 4. الفاحص الشامل

### التشغيل
```bash
# الفاحص الشامل (8 طبقات)
node scripts/governance/platform-check.mjs

# فاحص Routes فقط
pnpm --filter @workspace/adala run validate:routes

# بوابة الجودة الكاملة (تشمل ESLint + TypeScript + governance)
pnpm --filter @workspace/adala run governance:gate
```

### معايير القبول في CI/CD

| الفحص | المعيار |
|-------|---------|
| Broken Links | 0 |
| Duplicate Routes | 0 |
| Bad Redirects | 0 |
| Nav Coverage | 100% |
| RBAC Violations | 0 (حرجة) |
| Webhook Security | جميع webhooks لها signature |
| DB Isolation | جميع جداول office_id لها index |
| AI Fallback | fallback model موجود |
| Critical Jobs Alert | alertOnFailure على جميع الحرجة |

---

## 5. قواعد التطوير الإلزامية

### Rule 1: Registry First
> **أي إضافة — Route، Permission، Flag، Event، AI Agent، Integration، Job، Table — تُضاف في Registry أولاً**

### Rule 2: No Direct DB Without office_id
> **أي استعلام DB يجب أن يحتوي `WHERE office_id = $tenantId`**

### Rule 3: No AI Without Credits
> **أي استدعاء لـ AI يجب أن يمر بـ `callAI()` مع خصم Credits**

### Rule 4: No Webhook Without Security
> **أي Webhook يجب أن يتحقق من الـ signature قبل معالجة الطلب**

### Rule 5: No Cron Without Error Handling
> **أي Cron Job يجب أن يلتزم الصمت عند الفشل (لا يُوقف العملية)**

---

## 6. مسار الإضافة الإلزامي

```
نية الإضافة
    ↓
تحديد الطبقة (Route? Permission? Event? ...)
    ↓
تسجيل في Registry المناسب
    ↓
التطبيق الفعلي (App.tsx / schema.ts / cron / ...)
    ↓
node scripts/governance/platform-check.mjs → PASS
    ↓
Build → 0 TypeScript errors
    ↓
Merge ✅
```

---

## 7. سجل التغييرات

| التاريخ | التغيير |
|---------|---------|
| يونيو 2026 | إنشاء نظام Platform Governance كامل |
| يونيو 2026 | 8 سجلات: Routes+Permissions+Flags+Events+AI+Integrations+Jobs+DB |
| يونيو 2026 | platform-check.mjs — فاحص CI/CD شامل |
| يونيو 2026 | PLATFORM_GOVERNANCE.md — هذا الدليل |

---

> **تذكير:** الحوكمة ليست قيوداً بل **ضمانات جودة** —
> تجعل التوسع أسرع والأخطاء أقل والصيانة أسهل.
