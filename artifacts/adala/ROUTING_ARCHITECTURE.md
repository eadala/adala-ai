# دليل بنية التنقل — عدالة AI Platform
# Routing Architecture — Adala AI Platform

> **الإصدار:** 2.0 | **آخر تحديث:** يونيو 2026

---

## 1. نظرة عامة

يعتمد نظام التنقل في منصة عدالة على بنية مركزية ومحكومة تتكون من ثلاثة مكوّنات رئيسية:

```
┌─────────────────────────────────────────────┐
│           Route Registry                    │  ← src/lib/routeRegistry.ts
│     (السجل المركزي — المرجع الوحيد)          │
└─────────────────┬───────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
┌────────▼────────┐  ┌─────▼────────────────┐
│   App.tsx       │  │   Navigation Files   │
│  (Route Guards) │  │  layout.tsx          │
│                 │  │  mobile-nav.tsx       │
└─────────────────┘  └──────────────────────┘
                  │
         ┌────────▼────────┐
         │ Validate Script  │  ← scripts/validate-routes.mjs
         │ (CI/CD فحص تلقائي) │
         └─────────────────┘
```

---

## 2. Route Registry — السجل المركزي

الملف: `src/lib/routeRegistry.ts`

هذا السجل هو **المرجع الوحيد** لجميع Routes في المنصة. كل Route معرَّف بالبيانات التالية:

```typescript
interface RouteDefinition {
  path: string;           // المسار: "/cases/:id"
  nameAr: string;         // الاسم العربي للمستخدم: "تفاصيل القضية"
  nameInternal: string;   // الاسم الداخلي للمطورين: "case-detail"
  guard: RouteGuard;      // نوع الحماية: "public" | "protected" | "workspace" | "admin" | "role" | "redirect"
  module: RouteModule;    // الوحدة: "legal-core" | "financial" | "hr" ...
  permission?: string;    // الصلاحية المطلوبة (RBAC): "payroll:view"
  feature?: string;       // Feature Flag: "ai" | "calendar" | "clientPortal"
  subscription?: string;  // مستوى الباقة المطلوب
  navGroup?: string;      // مجموعة التنقل: "legal" | "financial" | "hr"
  breadcrumb?: string;    // نص Breadcrumb: "تفاصيل القضية"
  redirectTo?: string;    // للـ Aliases: "/ai-hub"
  isAlias?: boolean;      // هل هو Alias؟
  isDynamic?: boolean;    // هل يحتوي على :params ؟
  tags?: string[];        // وسوم للبحث
}
```

### إحصائيات السجل الحالي

| النوع | العدد |
|-------|-------|
| إجمالي Routes | ~155 |
| Public (بدون auth) | ~25 |
| Protected (مستخدم مسجّل) | ~90 |
| Workspace (مكتب نشط) | ~10 |
| Admin (Super Admin) | ~25 |
| Role (RBAC محدد) | ~3 |
| Aliases/Redirects | ~8 |
| Dynamic (:param) | ~15 |

---

## 3. سياسة Route Guards

### أنواع الحماية

```
public      → لا يتطلب أي تسجيل دخول
             ← مثال: /pricing, /terms, /firms/:slug

protected   → يتطلب مستخدماً مسجّلاً في Clerk
             ← مثال: /documents, /invoices, /settings

workspace   → يتطلب مستخدماً مسجّلاً مع مكتب نشط
             ← مثال: /dashboard, /cases, /clients

admin       → يتطلب super_admin (Clerk metadata)
             ← مثال: /super-admin, /engineering-center

role        → يتطلب صلاحية RBAC محددة
             ← مثال: /payroll (payroll:view), /users (users:view)

redirect    → Alias يحوّل تلقائياً لمسار آخر
             ← مثال: /hr → /hr-center, /settings → /office-settings
```

### التسلسل الهرمي للحماية

```
public < protected < workspace < role < admin
```

---

## 4. سياسة Redirect والـ Aliases

### القاعدة
أي Route قديم أو اختصار يُحوَّل دائماً عبر Redirect دائم، مع توثيق السبب في السجل.

### الـ Aliases الحالية

| المسار القديم | يحوَّل إلى | السبب |
|---------------|-----------|-------|
| `/hr` | `/hr-center` | توحيد مسار الموارد البشرية |
| `/settings` | `/office-settings` | تسمية أوضح |
| `/profile` | `/my-sessions` | لا يوجد صفحة profile مستقلة |
| `/help` | `/firm-admin` | الدعم داخل لوحة المدير |
| `/ai-copilot` | `/ai-hub` | دمج في مركز الذكاء |
| `/adoul` | `/ai-hub` | دمج في مركز الذكاء |
| `/ai-chat` | `/ai-hub` | دمج في مركز الذكاء |
| `/ai-agents` | `/ai-hub` | دمج في مركز الذكاء |
| `/ai-assistant` | `/ai-hub` | دمج في مركز الذكاء |

---

## 5. الوحدات والمجموعات

### خريطة الوحدات

```
landing          → /, /pricing, /demo, /terms, /privacy, /security
auth             → /sign-in, /sign-up, /onboarding, /2fa-*
portal           → /portal/*, بوابة العملاء
firms            → /firms/:slug/*, الصفحات العامة للمكاتب
legal-core       → /cases, /clients, /hearings-calendar, /tasks, ...
documents        → /documents, /contracts, /letters, /document-center
ai               → /ai-hub, /ai-coo, /legal-ai, /opponent-simulator
jlwm             → /jlwm/*, مركز القيادة القانونية
financial        → /invoices, /revenues, /expenses, /payment-center, ...
hr               → /employees, /attendance, /leaves, /payroll, /hr-center
communications   → /messages, /reminders, /whatsapp-settings, /telegram-settings
settings         → /office-settings, /billing, /users, /team, ...
analytics        → /analytics, /activity-stream
compliance       → /risk-management, /compliance
bankruptcy       → /bankruptcy, /bankruptcy/:section
platform-admin   → /super-admin, /engineering-center, /soc, /monitoring
```

---

## 6. إضافة Route جديد

### الخطوات الإلزامية

**الخطوة 1:** أضف Route في `src/lib/routeRegistry.ts`:
```typescript
{
  path: "/new-page",
  nameAr: "الصفحة الجديدة",
  nameInternal: "new-page",
  guard: "protected",
  module: "legal-core",
  navGroup: "legal",
  breadcrumb: "الصفحة الجديدة",
}
```

**الخطوة 2:** أضف Route في `src/App.tsx`:
```tsx
// 1. أضف import في أعلى الملف
const NewPage = lazy(() => import("@/pages/new-page"));

// 2. أضف Route في القسم المناسب
<Route path="/new-page"><ProtectedRoute><NewPage /></ProtectedRoute></Route>
```

**الخطوة 3:** أضف رابطاً في `src/components/layout.tsx` (إذا لزم):
```typescript
{ href: "/new-page", label: "الصفحة الجديدة", icon: SomeIcon }
```

**الخطوة 4:** شغّل فاحص الحوكمة:
```bash
node artifacts/adala/scripts/validate-routes.mjs
```

**الخطوة 5:** تأكد من خروج الأمر بكود 0.

---

## 7. سياسة التسمية

### المسارات (Paths)
- **kebab-case** دائماً: `/office-settings` لا `/officeSettings`
- **عربي في الاسم، إنجليزي في المسار**
- **التسلسل الهرمي واضح**: `/jlwm/command` تحت `/jlwm`
- **لا مسافات، لا أحرف خاصة، لا uppercase**

### الوحدات الديناميكية
- `:id` → معرّف رقمي أو UUID
- `:slug` → نص مُنظَّف للـ URL
- `:token` → رمز مشفر
- `:section` → قسم داخل صفحة متعددة الأقسام

---

## 8. فاحص الحوكمة الآلي

### التشغيل
```bash
# تشغيل مباشر
node artifacts/adala/scripts/validate-routes.mjs

# ضمن package.json
pnpm --filter @workspace/adala run validate:routes
```

### ما يفحصه
| الفحص | الوصف |
|-------|-------|
| Broken Links | روابط في التنقل تشير لـ Routes غير موجودة |
| Duplicate Routes | نفس المسار معرَّف أكثر من مرة |
| Redirect Policy | Redirects تشير لأهداف غير موجودة |
| Route Guards | مسارات بدون حماية صريحة |
| Deep Links | روابط `/cases/:id`, `/clients/:id` إلخ موجودة |
| Registry Sync | تزامن routeRegistry.ts مع App.tsx |

### معايير النجاح في CI/CD
```
Broken Links:      0
Duplicate Routes:  0
Bad Redirects:     0
Missing DeepLinks: 0
Nav Coverage:      100%
```

---

## 9. Route Analytics

الملف: `src/hooks/use-route-analytics.ts`

### الاستخدام
```tsx
// في App.tsx أو في layout wrapper
import { useRouteAnalytics } from "@/hooks/use-route-analytics";

function App() {
  useRouteAnalytics();
  // ...
}
```

### ما يقيسه
- عدد مرات زيارة كل Route
- وحدة كل Route (module)
- زمن التحميل (loadMs)
- يُخزَّن في localStorage ويُرسَل دفعياً كل 5 دقائق

---

## 10. الصلاحيات والـ RBAC

### ربط Route بصلاحية

```typescript
// في routeRegistry.ts
{
  path: "/payroll",
  guard: "role",
  permission: "payroll:view",
}

// في App.tsx
<Route path="/payroll">
  <RoleRoute permission="payroll:view">
    <Payroll />
  </RoleRoute>
</Route>
```

### الصلاحيات الموجودة

| الصلاحية | الوصف |
|----------|-------|
| `payroll:view` | مشاهدة الرواتب |
| `payroll:manage` | إدارة الرواتب |
| `financial:view` | مشاهدة المالية |
| `accounting:delete` | حذف قيود محاسبية |
| `users:view` | مشاهدة المستخدمين |
| `settings:view` | مشاهدة الإعدادات |
| `hr:manage` | إدارة الموارد البشرية |

---

## 11. سجل التغييرات

| التاريخ | التغيير |
|---------|---------|
| يونيو 2026 | إنشاء Route Registry المركزي |
| يونيو 2026 | إصلاح 9 روابط مكسورة في التنقل |
| يونيو 2026 | إضافة `/bankruptcy/:section` Dynamic Route |
| يونيو 2026 | توحيد 5 Aliases لـ AI Hub |
| يونيو 2026 | إضافة Validate Script للـ CI/CD |
| يونيو 2026 | إضافة Route Analytics Hook |

---

> **تذكير:** أي تعديل على Routes يجب أن يمر بالخطوات الست أعلاه،
> وأن يجتاز `validate-routes.mjs` قبل الـ merge.
