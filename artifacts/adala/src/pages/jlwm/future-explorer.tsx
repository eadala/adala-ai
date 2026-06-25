import { useState }                              from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Telescope, TrendingUp, TrendingDown, Minus,
  RefreshCw, Sparkles, ChevronRight, Clock, DollarSign,
  Scale, User, Building2, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge }    from "@/components/ui/badge";
import { Button }   from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

/* ── Path types ──────────────────────────────────────────────── */
interface Path {
  label:       string;
  probability: number;
  outcome?:    string;
  timeline_days?: number;
  financial_impact?: number;
  key_events?: string[];
  risks?:      string[];
  recommendations?: string[];
  key_factors?: string[];
  key_actions?: string[];
  milestones?:  { month: number; event: string }[];
  ltv_12m?:    number;
  cases_expected?: number;
  churn_risk?: string;
  revenue_12m?: number;
  cases_12m?:  number;
  win_rate?:   number;
}

interface FuturePaths {
  optimistic:  Path;
  realistic:   Path;
  pessimistic: Path;
  cached?:     boolean;
  createdAt?:  string;
}

/* ── Path card ───────────────────────────────────────────────── */
const PATH_CFG = {
  optimistic:  { label:"المسار المتفائل",  color:"text-emerald-700", bg:"bg-emerald-50 border-emerald-200", barColor:"#10B981", Icon:TrendingUp },
  realistic:   { label:"المسار الواقعي",   color:"text-blue-700",    bg:"bg-blue-50 border-blue-200",       barColor:"#3B82F6", Icon:Minus },
  pessimistic: { label:"المسار المتشائم", color:"text-red-700",     bg:"bg-red-50 border-red-200",         barColor:"#EF4444", Icon:TrendingDown },
} as const;

function PathCard({ pathKey, path }: { pathKey: keyof typeof PATH_CFG; path: Path }) {
  const cfg = PATH_CFG[pathKey];
  const { Icon } = cfg;

  return (
    <Card className={`border ${cfg.bg}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm flex items-center justify-between ${cfg.color}`}>
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" /> {path.label || cfg.label}
          </span>
          <span className="text-lg font-bold">{Math.round((path.probability ?? 0) * 100)}%</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Core metrics */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {path.outcome           && <span><span className="text-muted-foreground">النتيجة: </span><strong>{path.outcome}</strong></span>}
          {path.timeline_days     && <span><span className="text-muted-foreground">المدة: </span><strong>{path.timeline_days} يوم</strong></span>}
          {path.ltv_12m           && <span><span className="text-muted-foreground">LTV 12م: </span><strong>{path.ltv_12m.toLocaleString("ar-SA")} ر</strong></span>}
          {path.revenue_12m       && <span><span className="text-muted-foreground">إيرادات 12م: </span><strong>{path.revenue_12m.toLocaleString("ar-SA")} ر</strong></span>}
          {path.win_rate          && <span><span className="text-muted-foreground">معدل فوز: </span><strong>{Math.round(path.win_rate * 100)}%</strong></span>}
          {path.cases_expected !== undefined && <span><span className="text-muted-foreground">قضايا: </span><strong>{path.cases_expected}</strong></span>}
          {path.churn_risk        && <span><span className="text-muted-foreground">خطر التراجع: </span><strong>{path.churn_risk}</strong></span>}
          {path.financial_impact !== undefined && (
            <span className={path.financial_impact >= 0 ? "text-emerald-700" : "text-red-700"}>
              <span className="text-muted-foreground">التأثير المالي: </span>
              <strong>{path.financial_impact >= 0 ? "+" : ""}{path.financial_impact.toLocaleString("ar-SA")} ر</strong>
            </span>
          )}
        </div>

        {/* Key events / actions / milestones */}
        {(path.key_events?.length ?? 0) > 0 && (
          <div>
            <p className={`text-xs font-medium mb-1 ${cfg.color}`}>الأحداث الرئيسية</p>
            <ul className="space-y-0.5">
              {path.key_events!.map((e, i) => (
                <li key={i} className="text-xs flex items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 shrink-0" style={{ color: cfg.barColor }} />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(path.milestones?.length ?? 0) > 0 && (
          <div>
            <p className={`text-xs font-medium mb-1 ${cfg.color}`}>معالم رئيسية</p>
            <ul className="space-y-0.5">
              {path.milestones!.map((m, i) => (
                <li key={i} className="text-xs flex items-center gap-2">
                  <Badge variant="outline" className="text-xs h-4 px-1">{m.month}م</Badge>
                  {m.event}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks */}
        {(path.risks?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-medium text-red-600 mb-1">المخاطر</p>
            <ul className="space-y-0.5">
              {path.risks!.map((r, i) => (
                <li key={i} className="text-xs text-red-700 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-red-500 shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {(path.recommendations?.length ?? 0) > 0 && (
          <div>
            <p className={`text-xs font-medium mb-1 ${cfg.color}`}>التوصيات</p>
            <ul className="space-y-0.5">
              {path.recommendations!.map((r, i) => (
                <li key={i} className="text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" /> {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Reusable explorer panel ────────────────────────────────── */
function ExplorerPanel({
  endpoint, queryKey, buttonLabel, noDataLabel,
}: { endpoint: string; queryKey: string[]; buttonLabel: string; noDataLabel: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<FuturePaths>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 600_000,
  });

  const forceMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast({ title: "تم تحديث المسارات" }); },
    onError: () => toast({ title: "فشل التحديث", variant: "destructive" }),
  });

  if (isLoading) return <div className="py-6 text-center text-muted-foreground text-sm">جارٍ التحليل…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {data?.createdAt && <p className="text-xs text-muted-foreground">تم التحليل: {new Date(data.createdAt).toLocaleString("ar-SA")}</p>}
        <div className="flex gap-2 ms-auto">
          <Button variant="outline" size="sm" onClick={() => forceMut.mutate()} disabled={forceMut.isPending}>
            <Sparkles className="h-3 w-3 me-1" /> {forceMut.isPending ? "جارٍ…" : "إعادة التحليل بـ AI"}
          </Button>
        </div>
      </div>

      {!data?.optimistic ? (
        <div className="py-8 text-center text-muted-foreground">
          <Telescope className="h-10 w-10 mx-auto mb-3 opacity-30" /> {noDataLabel}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PathCard pathKey="optimistic"  path={data.optimistic} />
          <PathCard pathKey="realistic"   path={data.realistic} />
          <PathCard pathKey="pessimistic" path={data.pessimistic} />
        </div>
      )}
    </div>
  );
}

/* ── Case selector panel ────────────────────────────────────── */
function CaseFuturePanel() {
  const [caseId, setCaseId] = useState<string | null>(null);

  const { data: cases = [] } = useQuery<any[]>({
    queryKey: ["cases-list-fe"],
    queryFn: async () => {
      const r = await fetch("/api/cases?limit=50");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.cases ?? d.data ?? []);
    },
    staleTime: 120_000,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium mb-3">اختر قضية</p>
          <div className="flex flex-wrap gap-2">
            {(cases as any[]).slice(0, 20).map(c => (
              <button key={c.id} onClick={() => setCaseId(c.id)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  caseId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 hover:bg-muted border-border"
                }`}>
                {c.title}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      {caseId
        ? <ExplorerPanel endpoint={`jlwm/future/case/${caseId}`} queryKey={["jlwm","future","case",caseId]} buttonLabel="تحليل المسارات" noDataLabel="اضغط إعادة التحليل لاستكشاف مسارات القضية" />
        : <div className="py-8 text-center text-muted-foreground"><Scale className="h-10 w-10 mx-auto mb-3 opacity-20" />اختر قضية أعلاه</div>
      }
    </div>
  );
}

/* ── Client selector panel ──────────────────────────────────── */
function ClientFuturePanel() {
  const [clientId, setClientId] = useState<string | null>(null);

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["clients-list-fe"],
    queryFn: async () => {
      const r = await fetch("/api/clients?limit=50");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.clients ?? d.data ?? []);
    },
    staleTime: 120_000,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium mb-3">اختر عميل</p>
          <div className="flex flex-wrap gap-2">
            {(clients as any[]).slice(0, 20).map(c => (
              <button key={c.id} onClick={() => setClientId(c.id)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  clientId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 hover:bg-muted border-border"
                }`}>
                {c.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      {clientId
        ? <ExplorerPanel endpoint={`jlwm/future/client/${clientId}`} queryKey={["jlwm","future","client",clientId]} buttonLabel="تحليل مسارات العميل" noDataLabel="اضغط إعادة التحليل لاستكشاف مسارات العميل" />
        : <div className="py-8 text-center text-muted-foreground"><User className="h-10 w-10 mx-auto mb-3 opacity-20" />اختر عميلاً أعلاه</div>
      }
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function FutureExplorerPage() {
  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Telescope className="h-6 w-6 text-primary" /> مستكشف المستقبل
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          ثلاثة مسارات مستقبلية — متفائل، واقعي، متشائم — للقضايا والعملاء وأداء المكتب
        </p>
      </div>

      <Tabs defaultValue="cases" dir="rtl">
        <TabsList>
          <TabsTrigger value="cases"><Scale className="h-4 w-4 me-1" />القضايا</TabsTrigger>
          <TabsTrigger value="clients"><User className="h-4 w-4 me-1" />العملاء</TabsTrigger>
          <TabsTrigger value="office"><Building2 className="h-4 w-4 me-1" />المكتب</TabsTrigger>
        </TabsList>
        <TabsContent value="cases"   className="mt-4"><CaseFuturePanel /></TabsContent>
        <TabsContent value="clients" className="mt-4"><ClientFuturePanel /></TabsContent>
        <TabsContent value="office"  className="mt-4">
          <ExplorerPanel
            endpoint="jlwm/future/office"
            queryKey={["jlwm","future","office"]}
            buttonLabel="تحليل مسارات المكتب"
            noDataLabel="اضغط إعادة التحليل لاستكشاف مسارات أداء المكتب"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
