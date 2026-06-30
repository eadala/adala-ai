# عدالة AI — Frontend Architecture Guide

> **Release Candidate v1.0** — Frontend Feature Freeze  
> تاريخ الإصدار: 30 يونيو 2026

---

## 1. هيكل الواجهة (Structure)

```
artifacts/adala/src/
├── components/
│   ├── adaptive/          # ← المكونات القياسية الجديدة
│   │   ├── adaptive-dialog.tsx
│   │   ├── bottom-sheet.tsx
│   │   ├── filter-sheet.tsx
│   │   ├── empty-state.tsx
│   │   ├── skeleton-card.tsx
│   │   ├── mobile-data-table.tsx
│   │   ├── responsive-form-grid.tsx
│   │   └── index.ts        # barrel export
│   └── ui/                 # shadcn/ui المكونات الأساسية
├── hooks/
│   ├── use-breakpoint.ts   # ← hook المحاور للاستجابة
│   └── use-mobile.tsx      # (قديم، use-breakpoint أفضل)
├── pages/                  # 151 صفحة في 15+ مجلد
└── features/               # مكونات مُركّبة مستقلة
```

---

## 2. Adaptive UI System

### نقاط الانكسار (Breakpoints)

```typescript
// src/hooks/use-breakpoint.ts
const { isMobile, isTablet, isDesktop } = useBreakpoint();
// mobile:  < 768px
// tablet:  768px – 1023px  
// desktop: ≥ 1024px
```

### قواعد الاستخدام

| الحالة | Desktop | Mobile |
|--------|---------|--------|
| حوار (Dialog) | `Dialog` بمركز الشاشة | `BottomSheet` من الأسفل |
| جدول (Table) | `<table>` كامل | بطاقات عمودية |
| نموذج (Form) | `grid-cols-2` | عمود واحد |
| Filter | Dropdown | `FilterSheet` من الجانب |

---

## 3. المكونات القياسية المعتمدة

### 3.1 AdaptiveDialog

```tsx
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// الاستخدام:
<AdaptiveDialog open={open} onOpenChange={setOpen}>
  <AdaptiveDialogContent className="max-w-lg" title="عنوان الجوال" size="lg">
    <DialogHeader>
      <DialogTitle>عنوان النافذة</DialogTitle>
    </DialogHeader>
    {/* ... محتوى النافذة ... */}
    <DialogFooter>
      <Button onClick={() => setOpen(false)}>إلغاء</Button>
      <Button onClick={handleSave}>حفظ</Button>
    </DialogFooter>
  </AdaptiveDialogContent>
</AdaptiveDialog>
```

**الخصائص:**
- `size`: `"sm"` | `"md"` | `"lg"` | `"full"` (ارتفاع BottomSheet على الجوال)
- `title`: عنوان يظهر في BottomSheet header فقط
- `style`: CSSProperties (لبتخصيص البساطة البصرية)

### 3.2 BottomSheet

```tsx
import { BottomSheet } from "@/components/adaptive";

<BottomSheet open={open} onClose={() => setOpen(false)} title="العنوان" size="lg" showHandle>
  {/* المحتوى */}
</BottomSheet>
```

**الأحجام:** `sm` (30vh) | `md` (50vh) | `lg` (75vh) | `full` (90vh)

### 3.3 MobileDataTable

```tsx
import { MobileDataTable } from "@/components/adaptive";

<MobileDataTable
  rows={data}
  loading={isLoading}
  empty={<EmptyState icon={FileText} title="لا توجد بيانات" />}
  renderCard={(row, i) => (
    <Card key={i}>
      <CardContent className="p-4">
        <p className="font-bold">{row.title}</p>
        <p className="text-sm text-muted-foreground">{row.date}</p>
      </CardContent>
    </Card>
  )}
>
  {/* جدول سطح المكتب */}
  <div className="overflow-x-auto">
    <table>...</table>
  </div>
</MobileDataTable>
```

### 3.4 ResponsiveFormGrid

```tsx
import { ResponsiveFormGrid } from "@/components/adaptive";

// عمودان على سطح المكتب، عمود واحد على الجوال:
<ResponsiveFormGrid cols={2} className="gap-4">
  <div><Label>الاسم</Label><Input /></div>
  <div><Label>التاريخ</Label><Input type="date" /></div>
</ResponsiveFormGrid>
```

### 3.5 EmptyState

```tsx
import { EmptyState } from "@/components/adaptive";
import { FileText } from "lucide-react";

<EmptyState
  icon={FileText}
  title="لا توجد ملفات"
  description="ابدأ بإضافة ملف جديد"
  action={{ label: "إضافة ملف", onClick: () => setOpen(true) }}
/>
```

### 3.6 SkeletonCard

```tsx
import { SkeletonCard, SkeletonCardList, SkeletonStats } from "@/components/adaptive";

// بطاقة واحدة:
<SkeletonCard lines={3} showAvatar />

// قائمة من 4 بطاقات:
<SkeletonCardList count={4} />

// إحصائيات (KPI):
<SkeletonStats count={3} />
```

---

## 4. نظام التصميم (Design System)

### الألوان الأساسية (CSS Variables)

```css
--primary:           /* أزرق المنصة */
--primary-foreground:
--background:
--foreground:
--muted:
--muted-foreground:
--card:
--border:
--destructive:
```

### قواعد الالتزام

- ❌ لا تستخدم ألواناً مخصصة (`text-blue-500`) داخل المكونات
- ✅ استخدم `text-primary`, `text-muted-foreground`, `text-destructive`
- ❌ لا تستخدم `px-3 py-2` مباشرة في الأزرار — استخدم `Button` variant
- ✅ استخدم `<Badge>`, `<Alert>`, `<Card>` من shadcn/ui

---

## 5. قواعد منع التكرار (Anti-Duplication Rules)

يُمنع منعاً باتاً إنشاء:
- Dialog مخصص بديل لـ `AdaptiveDialog`
- BottomSheet مخصص
- Empty State مخصص
- Skeleton مخصص
- Spinner مخصص (استخدم `<Loader2 className="animate-spin">`)

---

## 6. التنقل التكيفي (Navigation System)

- `src/components/layout.tsx` — Layout الرئيسي (named export فقط)
- `src/components/mobile-nav.tsx` — Drawer الجوال
- `src/App.tsx` — التوجيه + Route Guards

### Guards المتاحة

```tsx
<ProtectedRoute>    // مستخدم مُسجَّل فقط
<AdminRoute>        // دور platform_admin فقط
<WorkspaceRoute>    // مستخدم مكتب
<RoleRoute permission="payroll:view">  // صلاحية محددة
```

---

## 7. أداء وتحسين (Performance)

### QueryClient Config
```typescript
staleTime: 5 * 60 * 1000,   // 5 دقائق
gcTime:    10 * 60 * 1000,  // 10 دقائق
refetchOnWindowFocus: false,
```

### Bundle Splitting
- Vite manualChunks كـ function (لا object)
- لا تُضيف @radix-ui لـ manual chunks (TDZ errors)

---

## 8. Accessibility (WCAG 2.2 AA)

- Touch targets: min 44×44px (CSS مُطبَّق globally)
- Font size inputs: 16px minimum (منع iOS zoom)
- RTL: `dir="rtl"` في root + Tailwind `rtl:` variants
- Reduce motion: `@media (prefers-reduced-motion)` في index.css
- High contrast: `@media (forced-colors: active)` في index.css
