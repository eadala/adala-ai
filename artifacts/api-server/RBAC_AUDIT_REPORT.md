# تقرير مراجعة RBAC الشامل — عدالة AI
**التاريخ:** 23 يونيو 2026  
**النطاق:** 6 أدوار × 3 طبقات (التعريف / API / واجهة المستخدم)  
**الحالة:** مراجعة فقط — لا تعديلات على الكود

---

## ملخص تنفيذي

| الطبقة | الحالة | الدرجة |
|--------|--------|--------|
| تعريف الأدوار والصلاحيات | ✅ مكتمل — 9 أدوار، 44 صلاحية | 95/100 |
| حماية مسارات API | ❌ حماية المصادقة فقط — لا تحقق من الدور | 12/100 |
| حماية الصفحات (Frontend) | ❌ مستوى واحد للجميع — لا تمييز بين الأدوار | 15/100 |
| مكوّن `<Can>` في الواجهة | ⚠️ 3 صفحات فقط من 130 | 8/100 |
| عزل بوابة العميل | ✅ نظام مصادقة منفصل بالرمز | 85/100 |
| صلاحيات التواصل | ✅ جزئي — portal/messages/timeline | 70/100 |

**الخلاصة:** نظام RBAC **معرَّف بشكل ممتاز** في قاعدة البيانات، لكنه **غير مُطبَّق** فعلياً. أي عضو مكتب مصادق عليه يمكنه تنفيذ أي عملية بصرف النظر عن دوره.

---

## 1. الأدوار والصلاحيات المعرَّفة

### 1.1 تعيين الأدوار المطلوبة على منصة عدالة

| الدور المطلوب | الدور الداخلي | العرض العربي |
|---------------|---------------|--------------|
| Owner | `firm_owner` | مالك المكتب |
| Admin | `office_manager` | مدير المكتب |
| Lawyer | `lawyer` | محامي |
| Assistant | `trainee_lawyer` | محامي متدرب |
| Accountant | `accountant` | محاسب |
| Client | `client` | عميل (نظام بوابة منفصل) |

> **ملاحظة:** توجد أيضاً أدوار إضافية: `secretary` (سكرتير)، `broker` (وسيط)، `collaborator` (متعاون)

### 1.2 مصفوفة الصلاحيات الكاملة

| الصلاحية | Owner | Admin | Lawyer | Assistant | Accountant | Client |
|----------|:-----:|:-----:|:------:|:---------:|:----------:|:------:|
| `cases:view` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `cases:create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `cases:edit` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `cases:delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `cases:assign` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `cases:close` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `clients:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `clients:create` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `clients:edit` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `clients:delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `contracts:view` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `contracts:create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `contracts:edit` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `contracts:delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `documents:view` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `documents:upload` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `documents:edit` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `documents:delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `invoices:view` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `invoices:create` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `invoices:edit` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `invoices:delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `payments:view` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `payments:create` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `reports:view` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `financial:view` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `users:view` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users:create` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `users:edit` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `users:delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `roles:view` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `roles:create` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `roles:edit` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `settings:view` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `settings:edit` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ai:access` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `messages:view` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `messages:send` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `audit:view` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `dashboard:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `support:view` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `support:reply` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `referral:create` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `referral:view` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**الملف:** `artifacts/api-server/src/modules/platform/rbac.ts`

---

## 2. مراجعة مسارات API

### 2.1 توزيع الحماية على 975 مسار API

| نوع الحماية | العدد | النسبة | الوصف |
|-------------|-------|--------|-------|
| `requireAuthWithTenant` | 511 | 52.4% | مصادقة + عزل المكتب — **لا تحقق من الدور** |
| `requireAuth` فقط | 180 | 18.5% | مصادقة بدون سياق مكتب |
| `adminOnly` (super_admin) | 141 | 14.5% | منصة فقط — لا يتعلق بأدوار المكتب |
| عام (بدون مصادقة) | 143 | 14.7% | مسارات عامة مشروعة |

> **المشكلة الجوهرية:** الـ 511 مسار بـ `requireAuthWithTenant` تتحقق فقط من:  
> ✅ أن المستخدم مصادق عليه (Clerk JWT صحيح)  
> ✅ أن له مكتب مرتبط  
> ❌ **لا تتحقق من الدور أو الصلاحية أبداً**

### 2.2 المسارات الحساسة المكشوفة لجميع الأعضاء

#### القضايا (`legal-core/cases.ts`)
| المسار | الطريقة | الصلاحية المطلوبة | الوضع الفعلي |
|--------|---------|-------------------|--------------|
| `DELETE /cases/:id` | حذف قضية | `cases:delete` (Owner فقط) | أي عضو |
| `POST /cases` | إنشاء قضية | `cases:create` | أي عضو |
| `PATCH /cases/:id` | تعديل قضية | `cases:edit` | أي عضو |
| `PATCH /cases/:id/court` | تعديل بيانات المحكمة | `cases:edit` | أي عضو |

#### العملاء (`legal-core/clients.ts`)
| المسار | الطريقة | الصلاحية المطلوبة | الوضع الفعلي |
|--------|---------|-------------------|--------------|
| `DELETE /clients/:id` | حذف عميل | `clients:delete` (Owner فقط) | أي عضو |
| `POST /clients` | إنشاء عميل | `clients:create` | أي عضو |
| `PATCH /clients/:id` | تعديل عميل | `clients:edit` | أي عضو |

#### المالية — الأخطر (`financial/invoices.ts`, `accounting.ts`)
| المسار | الطريقة | الصلاحية المطلوبة | الوضع الفعلي |
|--------|---------|-------------------|--------------|
| `DELETE /invoices/:id` | حذف فاتورة | `invoices:delete` (Owner فقط) | أي عضو |
| `POST /invoices` | إنشاء فاتورة | `invoices:create` (Accountant+Owner) | أي عضو |
| `DELETE /accounting/revenues/:id` | حذف إيراد | `financial:view`+ | أي عضو |
| `DELETE /accounting/expenses/:id` | حذف مصروف | `financial:view`+ | أي عضو |
| `POST /hr/payroll/generate` | توليد الرواتب | Owner/Admin فقط منطقياً | أي عضو |
| `PATCH /hr/payroll/:id/pay` | صرف راتب | Owner/Admin فقط | أي عضو |
| `PATCH /hr-internal/leave-balances/:id` | تعديل رصيد الإجازات | Owner/Admin فقط | أي عضو |

#### الموارد البشرية (`operations/hr.ts`)
| المسار | الطريقة | الصلاحية المطلوبة | الوضع الفعلي |
|--------|---------|-------------------|--------------|
| `DELETE /hr/employees/:id` | حذف موظف | Owner/Admin فقط | أي عضو |
| `POST /hr/employees` | إضافة موظف | Owner/Admin فقط | أي عضو |
| `GET /hr-internal/payslip/:id` | كشف راتب | المالك أو صاحب الراتب | أي عضو |

### 2.3 ثغرة حرجة: مسارات إدارة RBAC بلا حماية دور

هذه المسارات في `rbac.ts` تستخدم `requireAuthWithTenant` فقط — أي **أي عضو في المكتب** يمكنه تنفيذها:

| المسار | الخطورة | المشكلة |
|--------|---------|---------|
| `POST /rbac/roles` | 🔴 حرج | أي محامي يستطيع إنشاء دور بصلاحية `["*"]` |
| `PATCH /rbac/members/:id/role` | 🔴 حرج | أي عضو يستطيع ترقية نفسه أو زميله لـ firm_owner |
| `DELETE /rbac/members/:id` | 🔴 حرج | أي عضو يستطيع إزالة المالك من المكتب |
| `PATCH /rbac/users/:id/role` | 🔴 حرج | أي عضو يستطيع تغيير دور أي مستخدم |
| `PATCH /rbac/users/:id/status` | 🔴 عالي | أي عضو يستطيع تعطيل حساب المالك |
| `POST /rbac/invitations` | 🟠 عالي | أي عضو يستطيع دعوة مستخدمين بأي دور |
| `DELETE /rbac/invitations/:id` | 🟡 متوسط | أي عضو يستطيع إلغاء دعوات المالك |
| `GET /rbac/audit-logs` | 🟡 متوسط | جميع الأعضاء يرون سجل العمليات الحساسة |

### 2.4 المسارات ذات حماية جزئية للدور (✅ جيد)

هذه الملفات تحقق فعلياً من الدور:

**`operations/messages.ts`**
- `checkCommPerm(u, "reply")` — يتحقق من `reply_roles` في `client_comm_settings`
- الإعداد الافتراضي: `["firm_owner", "office_manager", "lawyer"]` يمكنهم الرد

**`marketplace/client-portal.ts`**
- `checkCommPerm(u, "portal")` — لإنشاء رموز البوابة
- `checkCommPerm(u, "timeline")` — للجدول الزمني
- `checkCommPerm(u, "intake")` — لاستقبال القضايا
- `PATCH /comm-settings` — يتطلب `isAdmin` صراحةً

**`operations/storage.ts`**
- يتحقق من `isAdmin` لعمليات الحذف والوصول للمجلدات المحمية

**`marketplace/client-auth.ts`**
- بوابة العميل: نظام مصادقة منفصل تماماً (scrypt + session token)
- عزل جيد عبر رمز الحالة (case token)

---

## 3. مراجعة الواجهة الأمامية (Frontend)

### 3.1 حراس المسارات في App.tsx

| الحارس | التعريف | المسارات المحمية | المشكلة |
|--------|---------|-----------------|---------|
| `AdminRoute` | `platform_admin` فقط (super_admin) | super-admin, studio, audit-logs, engineering, monitoring... | ✅ صحيح |
| `WorkspaceRoute` | أي مستخدم مصادق عليه | dashboard, cases, clients, hearings-calendar | ❌ لا تمييز دور |
| `ProtectedRoute` | أي مستخدم مصادق عليه | **كل شيء آخر** (مالية, HR, إعدادات...) | ❌ لا تمييز دور |

**النتيجة:** `trainee_lawyer` و`accountant` والـ`lawyer` يصلون لنفس الصفحات تماماً.

### 3.2 الصفحات الحساسة بدون حماية دور

هذه الصفحات متاحة لـ ProtectedRoute (أي مستخدم) رغم أنها يجب أن تكون محدودة:

| الصفحة | الدور المناسب | الوضع الفعلي |
|--------|--------------|--------------|
| `/payroll` | Owner/Admin فقط | أي عضو |
| `/revenues` | Accountant/Owner/Admin | أي عضو |
| `/expenses` | Accountant/Owner/Admin | أي عضو |
| `/financial-reports` | Accountant/Owner/Admin | أي عضو |
| `/financial-statements` | Accountant/Owner/Admin | أي عضو |
| `/bank-accounts` | Accountant/Owner/Admin | أي عضو |
| `/advances` | Admin/Owner فقط | أي عضو |
| `/employees` | Admin/Owner/HR | أي عضو |
| `/attendance` | Admin/Owner/HR | أي عضو |
| `/leaves` | Admin/Owner/HR | أي عضو |
| `/hr-center` | Admin/Owner | أي عضو |
| `/hr-enterprise` | Admin/Owner | أي عضو |
| `/office-settings` | Owner/Admin فقط | أي عضو |
| `/users` | Owner/Admin فقط | أي عضو |
| `/backup` | Owner فقط | أي عضو |
| `/payment-center` | Owner فقط | أي عضو |
| `/analytics` | Owner/Admin/Accountant | أي عضو |
| `/contracts` | Lawyer+ (لا Accountant) | أي عضو |

### 3.3 استخدام مكوّن `<Can>`

**الإجمالي: 3 صفحات من 130 (2.3%)**

| الصفحة | ما تحميه | الجودة |
|--------|----------|--------|
| `team.tsx` | زر "دعوة مستخدم" (`users:create`) + تعديل الدور (`users:edit \| roles:edit`) | ✅ صحيح |
| `support.tsx` | بعض إجراءات الدعم | ⚠️ جزئي |
| `client-portal.tsx` | إنشاء بوابة العميل | ✅ صحيح |

**127 صفحة لا تستخدم أي حماية دور في الواجهة.**

### 3.4 ثغرة: `hasPermission()` ترجع `true` أثناء التحميل

**الملف:** `artifacts/adala/src/hooks/use-permissions.ts` — السطر 24

```typescript
const hasPermission = (key: string): boolean => {
    if (!data) return true;  // ← بينما البيانات تُحمَّل، كل الصلاحيات ممنوحة!
    ...
```

**الأثر:** عند فتح الصفحة، `<Can>` يعرض **كل المحتوى الحساس** لجزء من الثانية قبل تحميل الصلاحيات. يظهر هذا للمستخدم على الشاشة (flash of unauthorized content).

### 3.5 تصفية قائمة التنقل (Layout)

| العنصر | الفلتر | الدور المناسب |
|--------|--------|--------------|
| "بناء سير العمل الذكي" | `superAdminOnly: true` | ✅ صحيح |
| باقي بنود القائمة | `feature` (خطة الاشتراك) | ❌ لا فلتر دور |

**قائمة التنقل متطابقة تماماً** للمحامي المتدرب والمحاسب ومالك المكتب.

---

## 4. تفاصيل كل دور — ما هو مكشوف

### 4.1 Owner (firm_owner)
- **التعريف:** صلاحيات كاملة `["*"]` ✅
- **API:** يصل لكل شيء ✅
- **Frontend:** ProtectedRoute + AdminRoute (للمنصة) ✅
- **المشكلة:** لا يمكن التمييز بينه وبين المالك الفعلي على مستوى API — أي `firm_owner` يملك كل الصلاحيات بما فيها حذف المالك الآخر

### 4.2 Admin (office_manager)
- **التعريف:** 14 صلاحية، بدون delete أو settings:edit ✅
- **API:** يصل لـ DELETE /cases/:id, DELETE /invoices/:id رغم عدم امتلاكه الصلاحية ❌
- **Frontend:** يرى نفس الواجهة الكاملة كالمالك ❌
- **الفجوة:** يستطيع حذف بيانات المالك عبر API المباشر

### 4.3 Lawyer (محامي)
- **التعريف:** 10 صلاحيات، بدون أي صلاحية مالية إلا `invoices:view` ✅
- **API:** يصل لـ POST /invoices, DELETE /accounting/revenues, GET /hr/payroll ❌
- **Frontend:** يرى صفحات الرواتب والمحاسبة والتقارير المالية ❌
- **الفجوة الكبرى:** يستطيع الوصول لكل البيانات المالية الحساسة

### 4.4 Assistant / trainee_lawyer (محامي متدرب)
- **التعريف:** 5 صلاحيات فقط — cases:view, clients:view, documents, ai, messages:view ✅
- **API:** يصل لـ POST /cases, PATCH /cases/:id, DELETE /documents, إنشاء عقود ❌
- **Frontend:** يرى نفس الواجهة الكاملة كالمحامي تماماً ❌
- **الفجوة الكبرى:** يستطيع إنشاء قضايا وتعديلها رغم أن دوره قراءة فقط

### 4.5 Accountant (محاسب)
- **التعريف:** 7 صلاحيات مالية — لا صلاحية على القضايا والعقود ✅
- **API:** يصل لـ POST /cases, PATCH /contracts/:id, DELETE /clients/:id ❌
- **Frontend:** يرى صفحات القضايا والعقود والوثائق القانونية ❌
- **الفجوة:** وصول كامل لبيانات قانونية حساسة لا علاقة لها بدوره

### 4.6 Client (عميل)
- **التعريف:** 3 صلاحيات — cases:view, documents:view, invoices:view ✅
- **نظام المصادقة:** منفصل تماماً (client-auth.ts) — scrypt + session token ✅
- **العزل:** يصل فقط للبيانات المرتبطة برمز حالته ✅
- **المشكلة المحدودة:** 
  - `GET /client-auth/admin-clients` يستخدم `requireAuth` بدون تحقق من الدور (أي موظف يرى قائمة حسابات العملاء)
  - `POST /client-auth/admin-create` يستخدم `requireAuth` بدون تحقق دور (أي موظف ينشئ حسابات عملاء)

---

## 5. قائمة المشاكل مرتبة بالأولوية

### 🔴 حرج — يجب إصلاحه فوراً

| # | المشكلة | الملف | التأثير |
|---|---------|-------|---------|
| C1 | `PATCH /rbac/members/:id/role` بدون حماية owner | `rbac.ts:433` | أي عضو يرقي نفسه لـ firm_owner |
| C2 | `DELETE /rbac/members/:id` بدون حماية owner | `rbac.ts:458` | أي عضو يزيل المالك |
| C3 | `PATCH /rbac/users/:id/role` بدون حماية owner | `rbac.ts:331` | أي عضو يغير دور أي مستخدم |
| C4 | `POST /rbac/roles` بدون حماية owner | `rbac.ts:203` | أي عضو ينشئ دوراً بـ `["*"]` |
| C5 | `POST /hr/payroll/generate` بلا حماية دور | `hr.ts:347` | أي موظف يولد رواتب |
| C6 | `PATCH /hr/payroll/:id/pay` بلا حماية دور | `hr.ts:370` | أي موظف يصرف رواتب |
| C7 | `DELETE /accounting/revenues/:id` بلا حماية | `accounting.ts:110` | أي عضو يحذف إيرادات المكتب |

### 🔴 عالي — يجب إصلاحه قريباً

| # | المشكلة | الملف | التأثير |
|---|---------|-------|---------|
| H1 | `DELETE /cases/:id` لا يتحقق من `cases:delete` | `cases.ts:205` | أي عضو يحذف قضايا |
| H2 | `DELETE /invoices/:id` لا يتحقق من `invoices:delete` | `invoices.ts:340` | أي عضو يحذف فواتير |
| H3 | `DELETE /clients/:id` لا يتحقق من `clients:delete` | `clients.ts:116` | أي عضو يحذف عملاء |
| H4 | `GET /hr/payroll` مكشوف لكل الأعضاء | `hr.ts:319` | Lawyer يرى رواتب الجميع |
| H5 | `GET /analytics/*` مكشوف للمحامي المتدرب | `analytics.ts` | تسرب بيانات مالية استراتيجية |
| H6 | `hasPermission()` ترجع `true` أثناء التحميل | `use-permissions.ts:24` | flash of unauthorized content |
| H7 | `/office-settings` (ProtectedRoute) بدلاً من Owner | `App.tsx:859` | أي موظف يرى/يعدل الإعدادات |
| H8 | `GET /client-auth/admin-clients` — requireAuth فقط | `client-auth.ts:389` | أي موظف يرى حسابات العملاء |

### 🟠 متوسط — خطة إصلاح مرحلية

| # | المشكلة | الوصف |
|---|---------|-------|
| M1 | 127 صفحة بدون `<Can>` | لا حماية UI لأي دور |
| M2 | قائمة التنقل لا تتغير حسب الدور | trainee_lawyer يرى كل القائمة |
| M3 | `POST /contracts` لا يتحقق من `contracts:create` | Accountant ينشئ عقوداً |
| M4 | `/payroll` متاح للمحامي (ProtectedRoute) | بيانات HR حساسة مكشوفة |
| M5 | `POST /rbac/invitations` بلا حماية دور | أي عضو يدعو firm_owner |
| M6 | `GET /rbac/audit-logs` مكشوف لكل الأعضاء | المحامي يرى سجل تغيير الأدوار |

### 🟡 منخفض — تحسينات مستقبلية

| # | المشكلة |
|---|---------|
| L1 | `useRole()` لا يعيد دور المكتب (lawyer/accountant)، فقط platform_admin/law_firm_user |
| L2 | `isAdmin` في `use-permissions.ts` لا يشمل `firm_owner` بشكل صريح |
| L3 | عدم وجود middleware مشترك `requirePermission()` قابل للاستخدام في كل مسار |
| L4 | صلاحيات `support:view/reply` و`audit:view` معرَّفة لكن غير مستخدمة في أي مسار |

---

## 6. الإصلاحات الموصى بها

### الإصلاح الفوري 1: Middleware للصلاحيات في API

إنشاء `requirePermission(permission: string)` middleware في `requireAuth.ts`:

```typescript
// artifacts/api-server/src/middlewares/requireAuth.ts (مقترح)
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuth(req);
    if (!auth?.userId) return res.status(401).json({ error: "غير مصرح" });

    const officeId = (req as any).tenantId;
    if (!officeId) return res.status(403).json({ error: "مكتب غير محدد" });

    // اجلب الدور من office_members
    const [member] = await db.execute(sql`
      SELECT role FROM office_members 
      WHERE user_id = ${auth.userId} AND office_id = ${officeId} AND status = 'active'
      LIMIT 1
    `);
    const roleName = member?.role ?? "trainee_lawyer";

    // جلب صلاحيات الدور
    const [roleData] = await db.select().from(rolesTable).where(eq(rolesTable.name, roleName)).limit(1);
    const permissions: string[] = roleData ? JSON.parse(roleData.permissions) : [];

    if (permissions.includes("*") || permissions.includes(permission)) {
      return next();
    }
    res.status(403).json({ error: `تحتاج صلاحية: ${permission}` });
  };
}

// الاستخدام على المسارات:
// router.delete("/cases/:id", requireAuthWithTenant, requirePermission("cases:delete"), ...)
// router.post("/rbac/roles", requireAuthWithTenant, requirePermission("roles:create"), ...)
```

### الإصلاح الفوري 2: حماية مسارات RBAC

```typescript
// rbac.ts — أضف هذا لكل مسارات الإدارة
router.patch("/rbac/members/:id/role", requireAuthWithTenant, requirePermission("users:edit"), ...)
router.delete("/rbac/members/:id",     requireAuthWithTenant, requirePermission("users:delete"), ...)
router.post("/rbac/roles",             requireAuthWithTenant, requirePermission("roles:create"), ...)
router.patch("/rbac/users/:id/role",   requireAuthWithTenant, requirePermission("roles:edit"), ...)
```

### الإصلاح الفوري 3: إصلاح `hasPermission()` أثناء التحميل

```typescript
// use-permissions.ts السطر 24
const hasPermission = (key: string): boolean => {
    if (!data) return false;  // ← بدلاً من true: لا تعرض شيئاً حتى تتحمل الصلاحيات
    if (permissions.includes("*")) return true;
    return permissions.includes(key);
};
```

### الإصلاح التدريجي 4: حماية الصفحات الحساسة

```typescript
// App.tsx — استبدل ProtectedRoute بـ RoleRoute للصفحات الحساسة
// مثال:
function RoleRoute({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission, isLoaded } = usePermissions();
  if (!isLoaded) return <PageLoader />;
  if (!hasPermission(permission)) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

// ثم:
<Route path="/payroll"><RoleRoute permission="financial:view"><Payroll /></RoleRoute></Route>
<Route path="/revenues"><RoleRoute permission="financial:view"><Revenues /></RoleRoute></Route>
```

### الإصلاح التدريجي 5: تصفية القائمة حسب الدور

```typescript
// layout.tsx — أضف permissionRequired لكل بند في OPERATING_CENTERS
{ href: "/payroll", label: "الرواتب", icon: Banknote, permissionRequired: "financial:view" },
{ href: "/revenues", label: "الإيرادات", icon: TrendingUp, permissionRequired: "financial:view" },
// ثم اربطها بـ hasPermission() في NavItem
```

---

## 7. ملخص إحصائي

| المقياس | القيمة |
|---------|--------|
| إجمالي الأدوار المعرَّفة | 9 أدوار |
| إجمالي الصلاحيات المعرَّفة | 44 صلاحية |
| مسارات API الكلية | ~975 |
| مسارات تتحقق من الدور فعلياً | ~25 (2.6%) |
| صفحات Frontend الكلية | 130 |
| صفحات تستخدم `<Can>` | 3 (2.3%) |
| ثغرات حرجة (CVSS 8+) | 7 |
| ثغرات عالية (CVSS 6-7.9) | 8 |
| ثغرات متوسطة | 6 |
| الجهد المقدر للإصلاح الكامل | 3-4 أيام تطوير |
| الجهد المقدر للإصلاحات الحرجة فقط | 4-6 ساعات |

---

## 8. خارطة طريق الإصلاح المقترحة

```
المرحلة 1 (يوم 1) — الحرج:
  ├── إنشاء requirePermission() middleware
  ├── حماية جميع مسارات RBAC (roles/members/users)
  ├── إصلاح hasPermission() loading state
  └── حماية POST/DELETE على payroll وaccounting

المرحلة 2 (يوم 2) — العالي:
  ├── requirePermission() على DELETE /cases, /invoices, /clients
  ├── requirePermission() على POST /invoices (invoices:create)
  ├── تحديث ProtectedRoute للصفحات الحساسة
  └── إصلاح client-auth admin routes إلى requireAuthWithTenant

المرحلة 3 (يوم 3) — المتوسط:
  ├── إضافة <Can> للصفحات المالية والـ HR
  ├── تصفية قائمة التنقل حسب الصلاحية
  └── requirePermission() على contracts وdocuments:delete

المرحلة 4 (يوم 4) — التحسين:
  ├── useRole() يعيد دور المكتب بالإضافة لـ platform role
  ├── RoleRoute component في App.tsx
  └── اختبارات RBAC آلية لكل دور
```

---

*تقرير المراجعة الأمنية للعزل متعدد المستأجرين: `SECURITY_AUDIT_REPORT.md` (درجة: 94/100)*  
*هذا التقرير يغطي RBAC فقط ولا يعدّل أي كود*
