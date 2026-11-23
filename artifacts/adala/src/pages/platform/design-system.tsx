import { Layout } from "@/components/layout";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AdaptiveDialog,
  AdaptiveDialogContent,
  EmptyState,
  SkeletonCard,
  SkeletonCardList,
} from "@/components/adaptive";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  COMPONENT_REGISTRY,
  REGISTRY_BY_CATEGORY,
  type ComponentDef,
  type ComponentStatus,
} from "@/components/design-system/registry";
import {
  Layers, CheckCircle2, FlaskConical, AlertTriangle,
  Code2, BookOpen, Shield, Zap,
} from "lucide-react";

/* ── Status badge ─────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: ComponentStatus }) {
  const map: Record<ComponentStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    stable:       { label: "مستقر",      variant: "default" },
    experimental: { label: "تجريبي",     variant: "secondary" },
    deprecated:   { label: "مُهمَل",    variant: "destructive" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

/* ── Category label ───────────────────────────────────────────────────────── */
const CAT_LABELS: Record<string, string> = {
  adaptive:   "تكيفية",
  layout:     "تخطيط",
  data:       "بيانات",
  feedback:   "تغذية راجعة",
  form:       "نماذج",
  navigation: "تنقل",
};

/* ── Component card ───────────────────────────────────────────────────────── */
function ComponentCard({ comp, onSelect }: { comp: ComponentDef; onSelect: () => void }) {
  return (
    <Card
      className="bg-card border-border hover:border-primary/50 cursor-pointer transition-colors"
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">{comp.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{comp.nameAr}</p>
          </div>
          <StatusBadge status={comp.status} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">{comp.description}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {comp.useCases.slice(0, 2).map((u, i) => (
            <Badge key={i} variant="outline" className="text-xs">{u}</Badge>
          ))}
          {comp.useCases.length > 2 && (
            <Badge variant="outline" className="text-xs">+{comp.useCases.length - 2}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground/60 mt-2 font-mono">{comp.importPath}</p>
      </CardContent>
    </Card>
  );
}

/* ── Detail dialog ────────────────────────────────────────────────────────── */
function ComponentDetailDialog({ comp, open, onClose }: {
  comp: ComponentDef | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!comp) return null;
  return (
    <AdaptiveDialog open={open} onOpenChange={onClose}>
      <AdaptiveDialogContent className="max-w-2xl" size="lg" title={comp.name}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{comp.name}</span>
            <StatusBadge status={comp.status} />
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-5 p-1">
            {/* Description */}
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">{comp.description}</p>
              <p className="text-xs text-primary font-mono mt-1">{comp.importPath}</p>
            </div>

            {/* Use Cases */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />حالات الاستخدام
              </h4>
              <ul className="space-y-1">
                {comp.useCases.map((u, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5">•</span>{u}
                  </li>
                ))}
              </ul>
            </div>

            {/* Restrictions */}
            {comp.restrictions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />القيود
                </h4>
                <ul className="space-y-1">
                  {comp.restrictions.map((r, i) => (
                    <li key={i} className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                      <span className="mt-0.5">⛔</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Replaces */}
            {comp.replaces && comp.replaces.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">يستبدل</h4>
                <div className="flex flex-wrap gap-1">
                  {comp.replaces.map((r, i) => (
                    <Badge key={i} variant="destructive" className="text-xs line-through opacity-70">{r}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Examples */}
            {comp.examples.map((ex, i) => (
              <div key={i}>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-primary" />{ex.label}
                </h4>
                <pre className="bg-muted/50 border border-border rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed" dir="ltr">
                  {ex.code}
                </pre>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </div>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ── Stats bar ────────────────────────────────────────────────────────────── */
function StatsBar() {
  const stable = COMPONENT_REGISTRY.filter(c => c.status === "stable").length;
  const exp    = COMPONENT_REGISTRY.filter(c => c.status === "experimental").length;
  const dep    = COMPONENT_REGISTRY.filter(c => c.status === "deprecated").length;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { icon: Layers,       label: "إجمالي المكوّنات",    value: COMPONENT_REGISTRY.length, color: "text-primary" },
        { icon: CheckCircle2, label: "مستقر (Stable)",       value: stable,                    color: "text-green-500" },
        { icon: FlaskConical, label: "تجريبي (Experimental)", value: exp,                      color: "text-amber-500" },
        { icon: AlertTriangle,label: "مُهمَل (Deprecated)",  value: dep,                      color: "text-destructive" },
      ].map(({ icon: Icon, label, value, color }) => (
        <Card key={label} className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Icon className={`h-5 w-5 ${color}`} />
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function DesignSystemPage() {
  const [selected, setSelected]       = useState<ComponentDef | null>(null);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [loading]                     = useState(false);

  const categories = ["all", ...Object.keys(REGISTRY_BY_CATEGORY)];

  const filtered = activeCategory === "all"
    ? COMPONENT_REGISTRY
    : (REGISTRY_BY_CATEGORY[activeCategory] ?? []);

  function handleSelect(comp: ComponentDef) {
    setSelected(comp);
    setDialogOpen(true);
  }

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">سجل نظام التصميم</h1>
            <p className="text-muted-foreground text-sm mt-1">
              المرجع الرسمي للمكوّنات القياسية — عدالة AI Design System v1.0
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Shield className="h-3 w-3 text-green-500" />Architecture Lock Active
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Zap className="h-3 w-3 text-primary" />CI/CD Enforced
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <StatsBar />

        {/* Governance info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              icon: Shield,
              title: "Architecture Lock",
              desc: "ESLint يمنع استخدام Dialog/DialogContent خارج نظام التصميم في الصفحات والـ features.",
              color: "text-green-500",
            },
            {
              icon: Zap,
              title: "CI/CD Quality Gates",
              desc: "8 بوابات تلقائية تُشغَّل عند كل push: TypeScript + ESLint + Architecture + Bundle Budget.",
              color: "text-primary",
            },
            {
              icon: BookOpen,
              title: "Coding Standards",
              desc: "دليل معايير التطوير الإلزامي في CODING_STANDARDS.md — naming، hooks، styling، a11y.",
              color: "text-amber-500",
            },
          ].map(({ icon: Icon, title, desc, color }) => (
            <Card key={title} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 mt-0.5 ${color}`} />
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Component registry */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">مكتبة المكوّنات القياسية</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="flex-wrap h-auto gap-1 mb-4">
                <TabsTrigger value="all">الكل ({COMPONENT_REGISTRY.length})</TabsTrigger>
                {Object.entries(REGISTRY_BY_CATEGORY).map(([cat, comps]) => (
                  <TabsTrigger key={cat} value={cat}>
                    {CAT_LABELS[cat] ?? cat} ({comps.length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {categories.map(cat => (
                <TabsContent key={cat} value={cat}>
                  {loading ? (
                    <SkeletonCardList count={4} />
                  ) : filtered.length === 0 ? (
                    <EmptyState icon={<Layers className="h-8 w-8" />} title="لا توجد مكوّنات في هذه الفئة" />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filtered.map(comp => (
                        <ComponentCard key={comp.name} comp={comp} onSelect={() => handleSelect(comp)} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <ComponentDetailDialog
        comp={selected}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </Layout>
  );
}
