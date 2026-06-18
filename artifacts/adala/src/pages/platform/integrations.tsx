/**
 * مركز التكاملات — Integration Hub (client view)
 * ─────────────────────────────────────────────
 * العميل يرى كل التكاملات المتاحة في المنصة مع حالتها.
 * المفاتيح مخفية تماماً — يطلب التفعيل عبر الدعم.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, XCircle, Lock, Clock, Loader2, Send,
  ExternalLink, Sparkles, RefreshCw, ChevronDown, Search,
  AlertCircle, Info, MessageCircle, ArrowRight, Zap,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn }       from "@/lib/utils";
import { useAuth }  from "@clerk/react";
import { Link }     from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── helpers ──────────────────────────────────────────────── */
async function authedFetch(url: string, getToken: any, opts?: RequestInit) {
  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...opts, headers: { ...headers, ...(opts?.headers ?? {}) } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${res.status}`); }
  return res.json();
}

/* ── Status config ─────────────────────────────────────────── */
const STATUS_CONFIG = {
  active:   { label: "مفعّل",      color: "#10B981", bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle2, border: "border-emerald-500/20" },
  inactive: { label: "غير مفعّل", color: "#6B7280", bg: "bg-muted/40",        text: "text-muted-foreground", icon: XCircle,      border: "border-border/50" },
  locked:   { label: "يتطلب ترقية", color: "#F59E0B", bg: "bg-amber-500/10",  text: "text-amber-400",  icon: Lock,         border: "border-amber-500/20" },
  pending:  { label: "قيد المراجعة", color: "#3B82F6", bg: "bg-blue-500/10",  text: "text-blue-400",   icon: Clock,        border: "border-blue-500/20" },
  disabled: { label: "غير متاح",  color: "#6B7280", bg: "bg-muted/20",       text: "text-muted-foreground/50", icon: XCircle, border: "border-border/30" },
};

const PLAN_LABELS: Record<string, string> = {
  free: "مجاني", basic: "مبتدئ", starter: "مبتدئ", pro: "احترافي",
  growth: "نمو", advanced: "متقدم", enterprise: "مؤسسي", elite: "النخبة",
};

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  intelligence:  { label: "الذكاء الاصطناعي", icon: "🧠" },
  communication: { label: "التواصل",          icon: "💬" },
  payments:      { label: "المدفوعات",         icon: "💳" },
  storage:       { label: "التخزين",           icon: "☁️" },
  automation:    { label: "الأتمتة",           icon: "⚡" },
  legal:         { label: "قانوني",            icon: "⚖️" },
  identity:      { label: "الهوية",            icon: "🪪" },
  other:         { label: "أخرى",              icon: "🔌" },
};

/* ══════════════════════════════════════════════════════════════
   INTEGRATION CARD
══════════════════════════════════════════════════════════════ */
function IntegrationCard({ itg, onRequest }: { itg: any; onRequest: (itg: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_CONFIG[itg.ui_status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.inactive;
  const Icon = st.icon;
  const features: string[] = Array.isArray(itg.features) ? itg.features : [];

  return (
    <div className={cn(
      "rounded-2xl border bg-card transition-all duration-200 overflow-hidden group",
      st.border,
      itg.ui_status === "disabled" && "opacity-50",
    )}>
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-sm"
              style={{ background: `${itg.color}18`, border: `1px solid ${itg.color}30` }}
            >
              {itg.icon}
            </div>
            <div>
              <h3 className="font-bold text-sm">{itg.name_ar}</h3>
              <p className="text-[10px] text-muted-foreground font-medium">{itg.name_en}</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold shrink-0", st.bg, st.text)}>
            <Icon className="h-3 w-3" />
            {st.label}
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{itg.description}</p>

        {/* Plan requirement */}
        {itg.plan_required !== "free" && (
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] text-amber-400 font-semibold">
              يتطلب خطة {PLAN_LABELS[itg.plan_required] ?? itg.plan_required} أو أعلى
            </span>
          </div>
        )}

        {/* Features toggle */}
        {features.length > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            {expanded ? "إخفاء المميزات" : `${features.length} مميزة — عرض التفاصيل`}
          </button>
        )}

        {expanded && (
          <div className="mt-2 grid grid-cols-2 gap-1">
            {features.map((f: string, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-4 pb-4">
        {itg.ui_status === "active" && (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              متصل ويعمل
              {itg.activated_at && <span className="text-muted-foreground me-1">· منذ {new Date(itg.activated_at).toLocaleDateString("ar-SA")}</span>}
            </div>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={() => onRequest({ ...itg, request_type: "modify" })}>
              <MessageCircle className="h-3 w-3" /> دعم
            </Button>
          </div>
        )}

        {itg.ui_status === "inactive" && (
          <Button size="sm" className="w-full text-xs h-8 gap-1.5" style={{ background: itg.color, color: "white" }}
            onClick={() => onRequest({ ...itg, request_type: "activate" })}>
            <Send className="h-3.5 w-3.5" /> طلب تفعيل
          </Button>
        )}

        {itg.ui_status === "locked" && (
          <Link href="/upgrade">
            <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
              <Zap className="h-3.5 w-3.5" /> ترقية الخطة للتفعيل
            </Button>
          </Link>
        )}

        {itg.ui_status === "pending" && (
          <div className="flex items-center gap-1.5 text-[10px] text-blue-400 bg-blue-500/8 border border-blue-500/20 rounded-lg px-2.5 py-2">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            طلبك قيد المراجعة — سيتواصل معك فريق الدعم قريباً
          </div>
        )}

        {itg.ui_status === "disabled" && (
          <div className="text-[10px] text-muted-foreground/50 text-center py-1">غير متاح حالياً</div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function IntegrationsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const qc           = useQueryClient();

  const [search,    setSearch]    = useState("");
  const [category,  setCategory]  = useState("all");
  const [reqDialog, setReqDialog] = useState<any>(null);
  const [reqMsg,    setReqMsg]    = useState("");

  /* Fetch integrations */
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["integrations"],
    queryFn:  () => authedFetch(`${BASE}/api/integrations`, getToken),
    retry: false,
    staleTime: 60_000,
  });

  /* Fetch my requests */
  const { data: myReqs } = useQuery<any>({
    queryKey: ["my-integration-requests"],
    queryFn:  () => authedFetch(`${BASE}/api/integrations/my-requests`, getToken),
    staleTime: 30_000,
  });

  const submitMut = useMutation({
    mutationFn: (body: any) => authedFetch(`${BASE}/api/integrations/request`, getToken, {
      method: "POST", body: JSON.stringify(body),
    }),
    onSuccess: (r) => {
      toast({ title: "✅ تم إرسال طلبك", description: r.message });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["my-integration-requests"] });
      setReqDialog(null); setReqMsg("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const integrations: any[] = data?.integrations ?? [];
  const planSlug: string    = data?.office_plan   ?? "free";

  /* Filter */
  const filtered = integrations.filter(itg => {
    const matchSearch   = !search || itg.name_ar.includes(search) || itg.description.includes(search);
    const matchCategory = category === "all" || itg.category === category;
    return matchSearch && matchCategory;
  });

  /* Group by category */
  const categories = [...new Set(integrations.map(i => i.category))];

  /* Stats */
  const activeCount  = integrations.filter(i => i.ui_status === "active").length;
  const pendingCount = integrations.filter(i => i.ui_status === "pending").length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">مركز التكاملات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ربط منصتك بالخدمات الخارجية — يُدار مركزياً من قِبل فريق عدالة AI
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> {activeCount} تكامل مفعّل
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400 font-semibold">
              <Clock className="h-3.5 w-3.5" /> {pendingCount} طلب قيد المراجعة
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 ms-1.5" /> تحديث
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-blue-400 mb-0.5">كيف تعمل التكاملات؟</p>
          <p className="text-xs text-muted-foreground">
            تُدار جميع مفاتيح API والإعدادات التقنية من فريق عدالة AI. أنت فقط تطلب التفعيل — نحن نربط الخدمة لك.
            لأي تعديل أو استفسار، استخدم زر "طلب تفعيل" أو تواصل مع الدعم الفني.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث عن تكامل..."
            className="pe-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCategory("all")}
            className={cn("px-3 py-1.5 rounded-full text-xs font-semibold transition-all", category === "all" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted")}
          >الكل</button>
          {categories.map(cat => {
            const meta = CATEGORY_LABELS[cat] ?? { label: cat, icon: "🔌" };
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1", category === cat ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted")}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <AlertCircle className="h-8 w-8 opacity-30" />
          <p className="text-sm">لا توجد نتائج</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(itg => (
            <IntegrationCard key={itg.key} itg={itg} onRequest={setReqDialog} />
          ))}
        </div>
      )}

      {/* My Recent Requests */}
      {(myReqs?.requests?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground">طلباتي الأخيرة</h2>
          <div className="space-y-2">
            {(myReqs?.requests ?? []).slice(0, 5).map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <span className="text-xl">{r.icon ?? "🔌"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{r.name_ar ?? r.integration_key}</p>
                  <p className="text-[10px] text-muted-foreground">{r.message ?? "طلب تفعيل"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.admin_notes && (
                    <p className="text-[10px] text-blue-400 max-w-[150px] truncate">{r.admin_notes}</p>
                  )}
                  <Badge variant="outline" className={cn("text-[10px] px-1.5",
                    r.status === "resolved" ? "text-emerald-400 border-emerald-500/20" :
                    r.status === "in_progress" ? "text-blue-400 border-blue-500/20" :
                    "text-amber-400 border-amber-500/20"
                  )}>
                    {r.status === "resolved" ? "مُنجز" : r.status === "in_progress" ? "قيد التنفيذ" : "قيد المراجعة"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Dialog */}
      <Dialog open={!!reqDialog} onOpenChange={v => { if (!v) { setReqDialog(null); setReqMsg(""); } }}>
        {reqDialog && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-xl">{reqDialog.icon}</span>
                {reqDialog.request_type === "modify" ? "طلب دعم فني" : "طلب تفعيل"} — {reqDialog.name_ar}
              </DialogTitle>
              <DialogDescription>
                {reqDialog.request_type === "modify"
                  ? "أخبرنا بما تحتاج تعديله وسيتواصل معك فريق الدعم خلال 24 ساعة."
                  : "اكتب أي تفاصيل أو متطلبات خاصة وسيتواصل معك فريق الدعم لإتمام الربط."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(reqDialog.features) ? reqDialog.features : []).map((f: string, i: number) => (
                  <span key={i} className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> {f}
                  </span>
                ))}
              </div>
              <Textarea
                value={reqMsg}
                onChange={e => setReqMsg(e.target.value)}
                placeholder="تفاصيل إضافية (اختياري) — مثال: نحتاج إرسال إشعارات عند دفع الفواتير..."
                rows={3}
                className="text-sm resize-none"
              />
              <div className="flex items-start gap-2 p-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl text-[11px] text-amber-400">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                المفاتيح التقنية يُعدّها فريق عدالة AI فقط. أنت تطلب، ونحن نربط.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setReqDialog(null); setReqMsg(""); }}>إلغاء</Button>
              <Button
                disabled={submitMut.isPending}
                onClick={() => submitMut.mutate({ integration_key: reqDialog.key, request_type: reqDialog.request_type ?? "activate", message: reqMsg || null })}
                style={{ background: reqDialog.color }}
                className="text-white gap-1.5"
              >
                {submitMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                إرسال الطلب
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
