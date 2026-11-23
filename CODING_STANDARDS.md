# عدالة AI — Coding Standards

> **إلزامي** على جميع المساهمات. أي تغيير لا يلتزم بهذه المعايير لا يُقبل.

---

## 1. Naming Conventions

### الملفات والمجلدات
```
pages/           kebab-case.tsx        my-page.tsx
features/        kebab-case/           billing/
components/      kebab-case.tsx        adaptive-dialog.tsx
hooks/           use-kebab-case.ts     use-breakpoint.ts
lib/             kebab-case.ts         web-vitals.ts
```

### المكوّنات والأنواع
```typescript
// مكوّن React → PascalCase
export function ClientList() { ... }
export const ClientList = () => { ... }

// Hook مخصص → camelCase يبدأ بـ use
export function useClientData() { ... }

// نوع/واجهة → PascalCase
interface ClientFormValues { ... }
type PaymentStatus = "paid" | "pending";

// ثوابت → SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE_MB = 15;
const API_TIMEOUT_MS   = 10_000;

// متغيرات/دوال → camelCase
const clientName = "...";
function formatCurrency(amount: number) { ... }
```

---

## 2. File Structure

### صفحة نموذجية
```typescript
// 1. Imports (مرتّبة: مكتبات → داخلية → أنواع)
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Layout } from "@/components/layout";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { Client } from "@/types";

// 2. Constants (ثوابت ثابتة خارج المكوّن)
const PAGE_SIZE = 20;

// 3. Sub-components (مكوّنات مساعدة صغيرة)
function ClientCard({ client }: { client: Client }) { ... }

// 4. Main component
export default function ClientsPage() {
  // 4a. ALL hooks FIRST (بدون أي early return قبلها)
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ ... });

  // 4b. Early returns AFTER hooks
  if (isLoading) return <SkeletonCardList />;

  // 4c. Derived state
  const clients = data ?? [];

  // 4d. Event handlers
  function handleCreate() { ... }

  // 4e. JSX return
  return <Layout title="العملاء">...</Layout>;
}
```

---

## 3. Component Structure

### ✅ مسموح
```tsx
// خارجي مع props محددة
interface Props { title: string; onSave: () => void; }
function MyComponent({ title, onSave }: Props) { ... }

// مع default props
function MyComponent({ title = "بدون عنوان", count = 0 }: Props) { ... }
```

### ❌ محظور
```tsx
// props any
function MyComponent(props: any) { ... }

// استخدام index كـ key في قوائم ديناميكية
items.map((item, i) => <div key={i}>)  // ❌
items.map(item => <div key={item.id}>)  // ✅
```

---

## 4. State Management

### قواعد
1. **Server state** → `useQuery` / `useMutation` من TanStack Query دائماً
2. **Local UI state** → `useState` (open/close, form values)
3. **Global UI state** → Context (theme, auth) — لا Redux
4. **Form state** → `react-hook-form` + Zod validation

```typescript
// ✅ Server state
const { data: clients, isLoading } = useQuery({
  queryKey: ["clients", officeId],
  queryFn:  () => fetch(`${BASE}/api/clients`).then(r => r.json()),
  staleTime: 5 * 60_000,
});

// ✅ Mutation
const { mutateAsync, isPending } = useMutation({
  mutationFn: (data: ClientForm) => fetch(`${BASE}/api/clients`, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  }).then(r => r.json()),
  onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); },
});
```

---

## 5. Hooks Usage

### قواعد **إلزامية** (ESLint يُطبّقها تلقائياً)

```typescript
// ❌ hook بعد early return — FORBIDDEN
function MyComponent({ data }: Props) {
  if (!data) return null;           // ← early return
  const [x, setX] = useState(0);   // ← VIOLATION: hook بعد early return
}

// ✅ hooks أولاً دائماً
function MyComponent({ data }: Props) {
  const [x, setX] = useState(0);   // ← hook أولاً
  if (!data) return null;           // ← early return بعد كل hooks
}
```

### QueryClient config إلزامي
```typescript
staleTime: 5 * 60 * 1000,   // 5 دقائق minimum
gcTime:    10 * 60 * 1000,  // 10 دقائق
refetchOnWindowFocus: false,
```

---

## 6. Styling Rules

### ✅ مسموح
```tsx
// Tailwind utility classes
<div className="flex items-center gap-4 p-4">

// CSS variables للألوان
<div className="text-primary bg-card border-border">

// RTL-aware classes
<div className="me-4 ps-2">  // margin-end, padding-start
```

### ❌ محظور
```tsx
// ألوان hardcoded
<div className="text-blue-500 bg-gray-900">  // ❌ (استخدم text-primary)

// Inline styles مع قيم hardcoded للألوان
<div style={{ color: "#2563EB" }}>  // ❌ (استخدم CSS variables)

// style prop للتخطيط (التباعد والأحجام)
<div style={{ padding: "16px" }}>  // ❌ (استخدم p-4)
```

### RTL (إلزامي)
```tsx
// ✅ RTL-safe
<div className="me-2">   // margin-inline-end
<div className="ps-4">   // padding-inline-start
<div className="start-0"> // inset-inline-start

// ❌ RTL-unsafe (يقلب على العربية)
<div className="mr-2">   // margin-right (ثابت)
<div className="pl-4">   // padding-left (ثابت)
```

---

## 7. Accessibility Rules

### إلزامي لكل مكوّن
```tsx
// 1. أحجام اللمس ≥ 44×44px
<button className="min-h-[44px] min-w-[44px]">

// 2. alt لجميع الصور
<img src={logo} alt="شعار عدالة AI" />
<img src={decorative} alt="" role="presentation" />

// 3. أزرار ذات تسمية
<button aria-label="حذف القضية">{/* أيقونة */}</button>

// 4. aria-expanded للمنسدلات
<button aria-expanded={isOpen} aria-controls="menu-id">

// 5. focus-visible للوحة المفاتيح
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
```

---

## 8. Responsive Rules

### نقاط الانكسار
| الاسم | القيمة | الاستخدام |
|-------|--------|-----------|
| mobile | < 768px | `md:hidden` |
| tablet | 768–1023px | `md:block lg:hidden` |
| desktop | ≥ 1024px | `lg:block` |

### قواعد
```tsx
// ✅ تخطيط متجاوب
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// ✅ نص متجاوب
<h1 className="text-2xl md:text-3xl lg:text-4xl">

// ❌ تخطيط ثابت بدون استجابة
<div className="grid grid-cols-3">  // يكسر على الجوال
```

---

## 9. Adaptive UI Rules

### قواعد إلزامية

| الحالة | Desktop | Mobile |
|--------|---------|--------|
| حوار | `AdaptiveDialog` | `BottomSheet` تلقائي |
| جدول | `<table>` | `MobileDataTable` |
| نموذج | `grid-cols-2` | `ResponsiveFormGrid` |
| فلتر | Dropdown | `FilterSheet` |
| فراغ | `EmptyState` | `EmptyState` |
| تحميل | `SkeletonCard` | `SkeletonCard` |

### مثال على الصفحة الكاملة
```tsx
export default function InvoicesPage() {
  // hooks (always first)
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data = [], isLoading } = useQuery({ ... });

  return (
    <Layout title="الفواتير">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">الفواتير</h1>
        <Button onClick={() => setDialogOpen(true)}>فاتورة جديدة</Button>
      </div>

      {isLoading ? (
        <SkeletonCardList count={5} />
      ) : data.length === 0 ? (
        <EmptyState icon={Receipt} title="لا توجد فواتير" />
      ) : (
        <MobileDataTable
          rows={data}
          renderCard={(inv) => <InvoiceCard invoice={inv} />}
        >
          <InvoicesTable invoices={data} />
        </MobileDataTable>
      )}

      <AdaptiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AdaptiveDialogContent>
          <DialogHeader><DialogTitle>فاتورة جديدة</DialogTitle></DialogHeader>
          <InvoiceForm onSuccess={() => setDialogOpen(false)} />
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </Layout>
  );
}
```

---

## 10. API Calls

```typescript
// ✅ دائماً مع basePath
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
fetch(`${BASE}/api/clients`);

// ✅ مع معالجة الأخطاء
const { data } = useQuery({
  queryKey: ["clients"],
  queryFn: async () => {
    const res = await fetch(`${BASE}/api/clients`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
});

// ❌ URL مطلق أو بدون basePath
fetch("/api/clients");       // ❌ يكسر في sub-path deployment
fetch("http://localhost/api"); // ❌ hardcoded host
```

---

## 11. Pre-commit Checklist

قبل كل commit:

- [ ] `pnpm typecheck` — 0 أخطاء
- [ ] `pnpm lint` — 0 أخطاء
- [ ] لا `console.log` في pages/features
- [ ] الـ hooks قبل early returns
- [ ] استخدام AdaptiveDialog بدلاً من Dialog في الصفحات
- [ ] استخدام BASE_URL في جميع fetch calls
- [ ] RTL-safe classes (me-/ps- بدلاً من mr-/pl-)
- [ ] alt لجميع الصور

---

## 12. Release Readiness Gate

قبل أي إصدار إنتاجي يجب تمرير:

```bash
bash scripts/governance/quality-gate.sh
```

جميع الـ 8 gates يجب أن تكون **PASS**.
