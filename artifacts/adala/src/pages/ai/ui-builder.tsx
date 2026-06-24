import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wand2, RefreshCw, Copy, Download, Sparkles, ChevronRight,
  Scale, Users, FileText, DollarSign, Clock, CheckCircle2,
  AlertTriangle, Info, TrendingUp, TrendingDown, BarChart3,
  Plus, Minus, Send, Loader2, Lightbulb, LayoutDashboard,
  FileCheck2, ClipboardList, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/react";

const BASE = import.meta.env.BASE_URL;

function apiUrl(path: string) {
  return `${BASE}api${path}`;
}

/* ─── Icon Map ─── */
const ICON_MAP: Record<string, any> = {
  scale: Scale, users: Users, file: FileText, money: DollarSign,
  clock: Clock, check: CheckCircle2, alert: AlertTriangle,
  info: Info, chart: BarChart3, book: BookOpen,
};

function DynIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = ICON_MAP[name ?? ""] ?? Scale;
  return <Icon className={cn("h-5 w-5", className)} />;
}

/* ─── Component Renderers ─── */
function HeroBlock({ data }: { data: any }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-8 space-y-3">
      {data.badge && (
        <Badge variant="secondary" className="text-xs font-medium">{data.badge}</Badge>
      )}
      <h1 className="text-3xl font-bold text-foreground">{data.title}</h1>
      {data.subtitle && <p className="text-muted-foreground text-base">{data.subtitle}</p>}
      {data.action && (
        <Button size="sm" className="mt-2">{data.action}</Button>
      )}
    </div>
  );
}

function StatsBlock({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {(data.items ?? []).map((item: any, i: number) => (
        <Card key={i} className="border-border/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <DynIcon name={item.icon} className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold">{item.value}</div>
            {item.trend && (
              <div className={cn("flex items-center gap-1 text-xs",
                item.trendUp !== false ? "text-emerald-500" : "text-red-500")}>
                {item.trendUp !== false ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {item.trend}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableBlock({ data }: { data: any }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{data.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-border/50 bg-muted/30">
                {(data.columns ?? []).map((col: string, i: number) => (
                  <th key={i} className="px-4 py-2 text-right font-medium text-muted-foreground">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.rows ?? []).map((row: string[], ri: number) => (
                <tr key={ri} className="border-t border-border/30 hover:bg-muted/20 transition-colors">
                  {row.map((cell: string, ci: number) => (
                    <td key={ci} className="px-4 py-3 text-right">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CardBlock({ data }: { data: any }) {
  const variantStyles: Record<string, string> = {
    info:    "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30",
    success: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30",
    warning: "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30",
    danger:  "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30",
  };
  const iconStyles: Record<string, string> = {
    info: "text-blue-500", success: "text-emerald-500",
    warning: "text-amber-500", danger: "text-red-500",
  };
  return (
    <Card className={cn("border", variantStyles[data.variant] ?? variantStyles.info)}>
      <CardContent className="p-5 flex gap-4">
        <div className={cn("mt-1", iconStyles[data.variant] ?? iconStyles.info)}>
          <DynIcon name={data.icon} />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-sm">{data.title}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">{data.content}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineBlock({ data }: { data: any }) {
  const statusColor: Record<string, string> = {
    done:    "bg-emerald-500 border-emerald-500",
    current: "bg-primary border-primary",
    pending: "bg-muted border-muted-foreground/30",
  };
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{data.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(data.items ?? []).map((item: any, i: number) => (
            <div key={i} className="flex gap-4 items-start">
              <div className={cn("mt-1.5 h-3 w-3 rounded-full border-2 flex-shrink-0", statusColor[item.status] ?? statusColor.pending)} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", item.status === "done" ? "text-muted-foreground line-through" : "text-foreground")}>
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">{item.date}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FormBlock({ data }: { data: any }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{data.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(data.fields ?? []).map((field: any, i: number) => (
            <div key={i} className={cn("space-y-1.5", field.type === "textarea" ? "sm:col-span-2" : "")}>
              <label className="text-sm font-medium text-foreground">
                {field.label}
                {field.required && <span className="text-red-500 me-1">*</span>}
              </label>
              {field.type === "textarea" ? (
                <div className="h-20 rounded-md border border-border bg-muted/30" />
              ) : field.type === "select" ? (
                <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3">
                  <span className="text-xs text-muted-foreground">{field.placeholder ?? "اختر..."}</span>
                </div>
              ) : (
                <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3">
                  <span className="text-xs text-muted-foreground">{field.placeholder ?? "أدخل " + field.label}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <Button size="sm" className="w-full sm:w-auto">{data.submitLabel ?? "حفظ"}</Button>
      </CardContent>
    </Card>
  );
}

function AlertBlock({ data }: { data: any }) {
  const s: Record<string, string> = {
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
    warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
    danger: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300",
  };
  return (
    <div className={cn("rounded-lg border p-4 flex gap-3 items-start", s[data.variant] ?? s.info)}>
      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-sm">{data.title}</p>
        {data.message && <p className="text-sm mt-0.5 opacity-90">{data.message}</p>}
      </div>
    </div>
  );
}

function SectionBlock({ data, depth = 0 }: { data: any; depth?: number }) {
  const cols = data.columns === 2 ? "sm:grid-cols-2" : data.columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";
  return (
    <div className="space-y-3">
      {data.title && <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{data.title}</h3>}
      <div className={cn("grid grid-cols-1 gap-4", cols)}>
        {(data.children ?? []).map((child: any, i: number) => (
          <UIBlock key={i} component={child} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}

function UIBlock({ component, depth = 0 }: { component: any; depth?: number }) {
  if (!component?.type) return null;
  switch (component.type) {
    case "hero":     return <HeroBlock data={component} />;
    case "stats":    return <StatsBlock data={component} />;
    case "table":    return <TableBlock data={component} />;
    case "card":     return <CardBlock data={component} />;
    case "timeline": return <TimelineBlock data={component} />;
    case "form":     return <FormBlock data={component} />;
    case "alert":    return <AlertBlock data={component} />;
    case "section":  return depth < 2 ? <SectionBlock data={component} depth={depth} /> : null;
    default: return null;
  }
}

/* ─── Preview Panel ─── */
function PreviewPanel({ schema }: { schema: any }) {
  return (
    <div className="space-y-5 p-6 bg-background min-h-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold text-foreground">{schema.page}</h2>
          {schema.description && (
            <p className="text-sm text-muted-foreground">{schema.description}</p>
          )}
        </div>
        <Badge variant="outline" className="text-xs">{schema.layout}</Badge>
      </div>
      <Separator />
      {/* Components */}
      <div className="space-y-5">
        {(schema.components ?? []).map((comp: any, i: number) => (
          <UIBlock key={i} component={comp} />
        ))}
      </div>
    </div>
  );
}

/* ─── Skeleton ─── */
function PreviewSkeleton() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="h-8 bg-muted rounded-lg w-1/2" />
      <div className="h-32 bg-muted rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}
      </div>
      <div className="h-48 bg-muted rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-32 bg-muted rounded-xl" />
      </div>
    </div>
  );
}

/* ─── Template Card ─── */
function TemplateCard({ tpl, onSelect }: { tpl: any; onSelect: () => void }) {
  const iconMap: Record<string, any> = {
    scale: Scale, users: Users, file: FileText, money: DollarSign,
    clock: Clock, check: FileCheck2,
  };
  const Icon = iconMap[tpl.icon] ?? LayoutDashboard;
  return (
    <button
      onClick={onSelect}
      className="w-full text-right flex gap-3 items-start p-3 rounded-xl hover:bg-muted/60 transition-colors border border-transparent hover:border-border/50 group"
    >
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{tpl.title}</p>
        <p className="text-xs text-muted-foreground">{tpl.description}</p>
      </div>
      <ChevronRight className="h-3 w-3 text-muted-foreground mt-1.5 group-hover:text-foreground transition-colors flex-shrink-0 rotate-180" />
    </button>
  );
}

/* ─── Main Page ─── */
export default function UIBuilderPage() {
  const { getToken } = useAuth();
  const [prompt, setPrompt]     = useState("");
  const [schema, setSchema]     = useState<any>(null);
  const [showJson, setShowJson] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: templatesData } = useQuery({
    queryKey: ["ui-builder-templates"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(apiUrl("/ui-builder/templates"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
    staleTime: Infinity,
  });

  const generateMutation = useMutation({
    mutationFn: async (p: string) => {
      const token = await getToken();
      const r = await fetch(apiUrl("/ui-builder/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: p }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "خطأ");
      return data;
    },
    onSuccess: (data) => {
      setSchema(data.schema);
      setShowJson(false);
    },
    onError: (err: any) => {
      toast({ title: "خطأ في التوليد", description: err.message, variant: "destructive" });
    },
  });

  function handleGenerate() {
    if (!prompt.trim()) return;
    generateMutation.mutate(prompt.trim());
  }

  function handleTemplate(tpl: any) {
    setPrompt(tpl.prompt);
    generateMutation.mutate(tpl.prompt);
  }

  function copyJson() {
    if (!schema) return;
    navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
    toast({ title: "تم نسخ الكود ✓" });
  }

  const isLoading = generateMutation.isPending;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wand2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none">AI UI Builder</h1>
            <p className="text-xs text-muted-foreground mt-0.5">صف ما تريد — الذكاء الاصطناعي يبني الواجهة</p>
          </div>
        </div>
        {schema && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={() => setShowJson(!showJson)}
              className="text-xs h-7 gap-1"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {showJson ? "عرض الواجهة" : "JSON Schema"}
            </Button>
            <Button variant="ghost" size="sm" onClick={copyJson} className="h-7 gap-1 text-xs">
              <Copy className="h-3.5 w-3.5" />
              نسخ
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => generateMutation.mutate(prompt)}
              disabled={isLoading}
              className="h-7 gap-1 text-xs"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              إعادة توليد
            </Button>
          </div>
        )}
      </div>

      {/* Main split */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Prompt Panel */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-border/50 bg-muted/20 overflow-y-auto">
          {/* Prompt input */}
          <div className="p-4 space-y-3 border-b border-border/30">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              صف الواجهة التي تريدها
            </div>
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="مثال: صفحة قضايا فيها إحصائيات وجدول بأحدث القضايا وتنبيه بالقضايا العاجلة..."
              className="resize-none text-sm min-h-[120px] bg-background/80 border-border/50"
              onKeyDown={e => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate();
              }}
            />
            <Button
              className="w-full gap-2 h-9"
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جاري التوليد...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> توليد الواجهة</>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">Ctrl+Enter للتوليد السريع</p>
          </div>

          {/* Templates */}
          <div className="p-3 space-y-1 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-2">
              <ClipboardList className="h-3.5 w-3.5" />
              قوالب جاهزة
            </div>
            {(templatesData?.templates ?? []).map((tpl: any) => (
              <TemplateCard key={tpl.id} tpl={tpl} onSelect={() => handleTemplate(tpl)} />
            ))}
          </div>

          {/* Tips */}
          <div className="p-4 border-t border-border/30 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">نصائح للحصول على نتائج أفضل</p>
            {[
              "اذكر نوع الصفحة (لوحة، نموذج، تقرير)",
              "حدد المكونات: جدول، إحصائيات، نموذج",
              "اذكر مصدر البيانات: قضايا، عملاء، فواتير",
            ].map((tip, i) => (
              <div key={i} className="flex gap-2 text-[11px] text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Preview Panel */}
        <div className="flex-1 overflow-y-auto bg-background/50">
          {isLoading ? (
            <PreviewSkeleton />
          ) : schema ? (
            showJson ? (
              <div className="p-6">
                <pre className="text-xs bg-muted/50 rounded-xl p-4 overflow-auto border border-border/50 text-foreground font-mono leading-relaxed" dir="ltr">
                  {JSON.stringify(schema, null, 2)}
                </pre>
              </div>
            ) : (
              <PreviewPanel schema={schema} />
            )
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-6">
              <div className="relative">
                <div className="h-24 w-24 rounded-3xl bg-primary/10 flex items-center justify-center">
                  <Wand2 className="h-12 w-12 text-primary/60" />
                </div>
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              </div>
              <div className="space-y-2 max-w-xs">
                <h3 className="text-lg font-bold">ابدأ بوصف واجهتك</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  اكتب وصفاً بالعربية لأي صفحة تريدها، أو اختر من القوالب الجاهزة على اليسار.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                {[
                  "لوحة القضايا",
                  "ملف العميل",
                  "تقرير مالي",
                  "نموذج عقد",
                ].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => setPrompt(`صفحة ${hint} مع إحصائيات وجدول`)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/60 hover:border-primary/50 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
