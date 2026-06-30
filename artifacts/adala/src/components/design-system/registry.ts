/**
 * Design System Registry — عدالة AI
 * Single source of truth for all standard UI components.
 * Used by the /design-system governance page.
 */

export type ComponentStatus = "stable" | "experimental" | "deprecated";

export interface ComponentDef {
  name: string;
  nameAr: string;
  description: string;
  category: "adaptive" | "layout" | "data" | "feedback" | "form" | "navigation";
  status: ComponentStatus;
  importPath: string;
  useCases: string[];
  restrictions: string[];
  replaces?: string[];
  examples: { label: string; code: string }[];
}

export const COMPONENT_REGISTRY: ComponentDef[] = [
  /* ── Adaptive ──────────────────────────────────────────────────────────── */
  {
    name:        "AdaptiveDialog",
    nameAr:      "نافذة تكيفية",
    description: "Dialog على سطح المكتب، BottomSheet على الجوال. المكوّن القياسي لجميع النوافذ.",
    category:    "adaptive",
    status:      "stable",
    importPath:  "@/components/adaptive",
    useCases: [
      "نماذج إنشاء/تعديل السجلات",
      "تأكيد العمليات الحرجة",
      "عرض التفاصيل الموسّعة",
    ],
    restrictions: [
      "لا تُستخدم Dialog من @/components/ui/dialog مباشرة في الصفحات",
      "لا تُنشئ مكوّنات Modal مخصصة",
    ],
    replaces: ["Dialog", "DialogContent من @/components/ui/dialog"],
    examples: [
      {
        label: "الاستخدام الأساسي",
        code: `<AdaptiveDialog open={open} onOpenChange={setOpen}>
  <AdaptiveDialogContent className="max-w-lg">
    <DialogHeader><DialogTitle>العنوان</DialogTitle></DialogHeader>
    {/* المحتوى */}
    <DialogFooter>
      <Button onClick={() => setOpen(false)}>إلغاء</Button>
      <Button onClick={handleSave}>حفظ</Button>
    </DialogFooter>
  </AdaptiveDialogContent>
</AdaptiveDialog>`,
      },
    ],
  },

  {
    name:        "BottomSheet",
    nameAr:      "ورقة سفلية",
    description: "نافذة منزلقة من الأسفل للجوال. مُستخدمة داخلياً بواسطة AdaptiveDialog.",
    category:    "adaptive",
    status:      "stable",
    importPath:  "@/components/adaptive",
    useCases: [
      "إجراءات سريعة على الجوال",
      "قوائم اختيار موسّعة",
    ],
    restrictions: [
      "لا تُستخدم مباشرةً إلا عند الحاجة لسلوك مختلف عن AdaptiveDialog",
    ],
    examples: [
      {
        label: "مباشر",
        code: `<BottomSheet open={open} onClose={() => setOpen(false)} title="العنوان" size="lg">
  {/* المحتوى */}
</BottomSheet>`,
      },
    ],
  },

  {
    name:        "MobileDataTable",
    nameAr:      "جدول بيانات تكيفي",
    description: "جدول كامل على سطح المكتب، بطاقات عمودية على الجوال.",
    category:    "data",
    status:      "stable",
    importPath:  "@/components/adaptive",
    useCases: ["جميع قوائم البيانات التي تحتاج عرضاً على الجوال والمكتب"],
    restrictions: ["لا تُنشئ جداول مخصصة بدون نمط بطاقات للجوال"],
    examples: [
      {
        label: "مع بطاقات الجوال",
        code: `<MobileDataTable
  rows={data}
  loading={isLoading}
  empty={<EmptyState icon={FileText} title="لا توجد بيانات" />}
  renderCard={(row) => <Card><CardContent>{row.title}</CardContent></Card>}
>
  <table>...</table>
</MobileDataTable>`,
      },
    ],
  },

  {
    name:        "ResponsiveFormGrid",
    nameAr:      "شبكة نموذج متجاوبة",
    description: "شبكة عمودين على سطح المكتب، عمود واحد على الجوال.",
    category:    "form",
    status:      "stable",
    importPath:  "@/components/adaptive",
    useCases: ["جميع نماذج الإدخال ذات حقلين أو أكثر"],
    restrictions: ["لا تُستخدم grid-cols-2 مع Tailwind مباشرة بدون استثناء الجوال"],
    examples: [
      {
        label: "نموذجان في صف",
        code: `<ResponsiveFormGrid cols={2}>
  <div><Label>الاسم</Label><Input /></div>
  <div><Label>التاريخ</Label><Input type="date" /></div>
</ResponsiveFormGrid>`,
      },
    ],
  },

  {
    name:        "FilterSheet",
    nameAr:      "ورقة الفلتر",
    description: "فلتر جانبي منزلق على الجوال لاستبدال Dropdown Filters.",
    category:    "adaptive",
    status:      "stable",
    importPath:  "@/components/adaptive",
    useCases: ["صفحات القوائم التي تحتوي على فلاتر متعددة"],
    restrictions: [],
    examples: [
      {
        label: "فلتر بسيط",
        code: `<FilterSheet trigger={<Button>فلترة</Button>} title="الفلاتر" count={activeFilters}>
  {/* محتوى الفلتر */}
</FilterSheet>`,
      },
    ],
  },

  {
    name:        "EmptyState",
    nameAr:      "حالة الفراغ",
    description: "عرض موحّد لحالة عدم وجود بيانات.",
    category:    "feedback",
    status:      "stable",
    importPath:  "@/components/adaptive",
    useCases: ["جميع القوائم والجداول الفارغة", "نتائج البحث الفارغة"],
    restrictions: ["لا تُنشئ حالات فراغ مخصصة بدون استخدام هذا المكوّن"],
    examples: [
      {
        label: "مع زر إجراء",
        code: `<EmptyState
  icon={FileText}
  title="لا توجد قضايا"
  description="ابدأ بإضافة قضية جديدة"
  action={{ label: "إضافة قضية", onClick: () => setOpen(true) }}
/>`,
      },
    ],
  },

  {
    name:        "SkeletonCard",
    nameAr:      "بطاقة هيكلية",
    description: "حالة التحميل المتحركة.",
    category:    "feedback",
    status:      "stable",
    importPath:  "@/components/adaptive",
    useCases: ["حالات isLoading في useQuery", "تحميل الصفحة الأولي"],
    restrictions: ["لا تُستخدم حالات تحميل مخصصة (div مع animate-pulse)"],
    examples: [
      {
        label: "قائمة",
        code: `{isLoading ? <SkeletonCardList count={4} /> : <DataComponent />}`,
      },
    ],
  },

  /* ── Layout ─────────────────────────────────────────────────────────────── */
  {
    name:        "Layout",
    nameAr:      "التخطيط الرئيسي",
    description: "الحاوية الرئيسية للصفحات المحمية. Named export فقط — لا default export.",
    category:    "layout",
    status:      "stable",
    importPath:  "@/components/layout",
    useCases:    ["جميع صفحات لوحة التحكم"],
    restrictions: [
      "لا تُستورد كـ default export",
      "لا تُستبدل أو تُغلّف بتخطيط مخصص",
    ],
    examples: [
      {
        label: "في صفحة",
        code: `import { Layout } from "@/components/layout";
export default function MyPage() {
  return <Layout title="عنوان الصفحة">...</Layout>;
}`,
      },
    ],
  },
];

export const REGISTRY_BY_NAME = Object.fromEntries(
  COMPONENT_REGISTRY.map(c => [c.name, c]),
);

export const REGISTRY_BY_CATEGORY = COMPONENT_REGISTRY.reduce((acc, c) => {
  if (!acc[c.category]) acc[c.category] = [];
  acc[c.category].push(c);
  return acc;
}, {} as Record<string, ComponentDef[]>);
