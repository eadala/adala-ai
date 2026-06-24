import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark, Building2, FileText, Users, BarChart3, AlertCircle,
  Loader2, Eye, CheckSquare, Activity, RefreshCw, Search,
  TrendingDown, TrendingUp, Shield, GitBranch, FilePlus2,
  CheckCircle2, XCircle, Clock, ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API } from "../shared/api";

/* ── helpers ── */
function fmt(n: any) { return Number(n ?? 0).toLocaleString("ar-SA"); }
function fmtMoney(n: any) { return Number(n ?? 0).toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س"; }

const CASE_STATUS_AR: Record<string, string> = { open:"مفتوح", closed:"مغلق", suspended:"موقوف" };
const REQ_STATUS_AR: Record<string, string> = {
  draft:"مسودة", under_assessment:"تحت التقييم", documents_pending:"ينتظر مستندات",
  ai_analysis:"تحليل AI", ready_for_filing:"جاهز للتقديم", under_legal_review:"مراجعة قانونية",
  approved_for_submission:"معتمد", submitted_to_court:"مقدَّم", converted_to_case:"تحوّل لملف",
  closed:"مغلق", cancelled:"ملغي",
};
const PROC_AR: Record<string, string> = {
  preventive_settlement:"التسوية الوقائية", financial_reorganization:"إعادة التنظيم",
  liquidation:"التصفية", administrative_liquidation:"تصفية إدارية", not_eligible:"غير مؤهل",
};
const ACTION_AR: Record<string, string> = {
  "bankruptcy.view_office":   "عرض مكتب",
  "bankruptcy.view_case":     "عرض ملف إفلاس",
  "bankruptcy.view_request":  "عرض طلب افتتاح",
  "bankruptcy.export":        "تصدير بيانات",
  "bankruptcy.ghost_enter":   "دخول سري",
  "bankruptcy.ghost_exit":    "خروج من الجلسة",
};

export function BankruptcyAdminTab({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<"stats"|"offices"|"cases"|"requests"|"audit">("stats");
  const [caseQ,  setCaseQ]  = useState("");
  const [reqQ,   setReqQ]   = useState("");
  const [officeFilter, setOfficeFilter] = useState("");

  /* ── Queries ── */
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["sa-bk-stats"],
    queryFn: () => API("/bankruptcy/stats"),
    staleTime: 30_000,
  });

  const { data: offices = [], isLoading: officesLoading } = useQuery<any[]>({
    queryKey: ["sa-bk-offices"],
    queryFn: () => API("/bankruptcy/offices"),
    staleTime: 60_000,
  });

  const { data: cases = [], isLoading: casesLoading } = useQuery<any[]>({
    queryKey: ["sa-bk-cases", caseQ, officeFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (caseQ) qs.set("q", caseQ);
      if (officeFilter) qs.set("office_id", officeFilter);
      return API(`/bankruptcy/cases?${qs}`);
    },
    staleTime: 30_000,
    enabled: subTab === "cases",
  });

  const { data: requests = [], isLoading: reqLoading } = useQuery<any[]>({
    queryKey: ["sa-bk-reqs", reqQ, officeFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (reqQ) qs.set("q", reqQ);
      if (officeFilter) qs.set("office_id", officeFilter);
      return API(`/bankruptcy/opening-requests?${qs}`);
    },
    staleTime: 30_000,
    enabled: subTab === "requests",
  });

  const { data: auditLogs = [], isLoading: auditLoading, refetch: refetchAudit } = useQuery<any[]>({
    queryKey: ["sa-bk-audit", officeFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (officeFilter) qs.set("office_id", officeFilter);
      return API(`/bankruptcy/audit-logs?${qs}`);
    },
    staleTime: 20_000,
    enabled: subTab === "audit",
  });

  /* ── Log audit event ── */
  const logAudit = useMutation({
    mutationFn: (body: object) => API("/bankruptcy/audit-logs", { method: "POST", body: JSON.stringify(body) }),
  });

  const s: any = stats ?? {};
  const c: any = s.cases ?? {};
  const r: any = s.opening_requests ?? {};
  const cl: any = s.claims ?? {};
  const as: any = s.assets ?? {};
  const ta: any = s.tasks ?? {};
  const al: any = s.alerts ?? {};

  /* ══════════════════════════════════════════════════════
     SUB-TABS NAV
  ══════════════════════════════════════════════════════ */
  const SUB_TABS = [
    { id: "stats",    label: "الإحصائيات",      icon: BarChart3 },
    { id: "offices",  label: "المكاتب",           icon: Building2 },
    { id: "cases",    label: "ملفات الإفلاس",    icon: Landmark },
    { id: "requests", label: "طلبات الافتتاح",   icon: FilePlus2 },
    { id: "audit",    label: "سجل التدقيق",      icon: Shield },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Landmark className="h-5 w-5 text-amber-500" />
            إدارة نظام الإفلاس — Super Admin
          </h2>
          <p className="text-xs text-muted-foreground">رؤية كاملة لجميع المكاتب والملفات عبر المنصة</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs"
          onClick={() => { refetchStats(); qc.invalidateQueries({ queryKey: ["sa-bk-"] }); }}>
          <RefreshCw className="h-3.5 w-3.5" />تحديث
        </Button>
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 flex-wrap">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id as any)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all
              ${subTab === t.id ? "bg-background shadow text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════
          STATS TAB
      ═══════════════════════════════════════ */}
      {subTab === "stats" && (
        <div className="space-y-4">
          {statsLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              {/* Row 1: Cases & Requests */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "إجمالي ملفات الإفلاس", value: fmt(c.total),   sub: `${fmt(c.open)} مفتوح`,   icon: Landmark,   color: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/20" },
                  { label: "مكاتب نشطة",            value: fmt(c.offices), sub: "تستخدم نظام الإفلاس",   icon: Building2,  color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/20" },
                  { label: "طلبات الافتتاح",        value: fmt(r.total),   sub: `${fmt(r.ready)} جاهز`,   icon: FilePlus2,  color: "text-violet-500",  bg: "bg-violet-50 dark:bg-violet-950/20" },
                  { label: "تحوّلت لملف إفلاس",    value: fmt(r.converted),sub: "من طلبات الافتتاح",    icon: ArrowUpRight,color:"text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
                ].map(k => (
                  <Card key={k.label} className={`border-border/50 ${k.bg}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] text-muted-foreground">{k.label}</p>
                          <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
                        </div>
                        <k.icon className={`h-5 w-5 ${k.color} opacity-60`} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Row 2: Financial & Risk */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "إجمالي المطالبات",     value: fmt(cl.total), sub: fmtMoney(cl.total_amount), icon: FileText, color: "text-indigo-500" },
                  { label: "إجمالي الأصول المقيّمة",value: fmt(as.total), sub: fmtMoney(as.total_value),  icon: TrendingUp, color: "text-teal-500" },
                  { label: "مهام متأخرة",           value: fmt(ta.overdue),sub: `من ${fmt(ta.total)} مهمة`, icon: Clock, color: "text-orange-500" },
                  { label: "تنبيهات حرجة",         value: fmt(al.critical),sub: `من ${fmt(al.total)} نشط`, icon: AlertCircle, color: "text-red-500" },
                ].map(k => (
                  <Card key={k.label} className="border-border/50">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] text-muted-foreground">{k.label}</p>
                          <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
                        </div>
                        <k.icon className={`h-5 w-5 ${k.color} opacity-60`} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Row 3: V2 Systems */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">سير العمل (Workflows)</p>
                    <p className="text-xl font-black text-blue-500">{fmt(s.workflows?.total)}</p>
                    <p className="text-[10px] text-muted-foreground">{fmt(s.workflows?.completed)} مكتمل</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">القوالب القانونية</p>
                    <p className="text-xl font-black text-teal-500">{fmt(s.templates?.total)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">متوسط الأهلية</p>
                    <p className="text-xl font-black text-violet-500">{r.avg_eligibility ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">من 100</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          OFFICES TAB
      ═══════════════════════════════════════ */}
      {subTab === "offices" && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">{offices.length} مكتب يستخدم نظام الإفلاس</p>
          {officesLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {offices.map((o: any) => (
                <Card key={o.office_id} className="border-border/50 hover:border-amber-300 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{o.office_name ?? o.office_id}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">{o.office_id}</span>
                        </div>
                        <div className="flex gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Landmark className="h-3 w-3" />{fmt(o.cases_count)} ملف</span>
                          <span className="flex items-center gap-1"><FilePlus2 className="h-3 w-3" />{fmt(o.opening_requests_count)} طلب</span>
                          {Number(o.overdue_tasks) > 0 && <span className="text-orange-500 flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(o.overdue_tasks)} متأخر</span>}
                          {Number(o.active_alerts) > 0 && <span className="text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{fmt(o.active_alerts)} تنبيه</span>}
                          {o.last_case_at && <span className="mr-auto">{new Date(o.last_case_at).toLocaleDateString("ar-SA")}</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs gap-1.5 shrink-0"
                        onClick={() => {
                          setOfficeFilter(o.office_id);
                          setSubTab("cases");
                          logAudit.mutate({ office_id: o.office_id, action_type: "bankruptcy.view_office", resource_type: "office", resource_id: o.office_id });
                        }}>
                        <Eye className="h-3.5 w-3.5" />فتح
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          CASES TAB
      ═══════════════════════════════════════ */}
      {subTab === "cases" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pr-8 text-sm h-8" placeholder="بحث باسم المدين أو رقم القضية..." value={caseQ}
                onChange={e => setCaseQ(e.target.value)} />
            </div>
            {officeFilter && (
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setOfficeFilter("")}>
                <XCircle className="h-3.5 w-3.5" />إزالة فلتر المكتب
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{cases.length} نتيجة</p>
          {casesLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {cases.map((c: any) => (
                <Card key={c.id} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{c.debtor_name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                            ${c.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}>
                            {CASE_STATUS_AR[c.status] ?? c.status}
                          </span>
                          {c.office_name && <span className="text-[10px] text-muted-foreground border border-border/50 px-1.5 rounded">
                            <Building2 className="h-2.5 w-2.5 inline ml-0.5" />{c.office_name}
                          </span>}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>{c.case_number}</span>
                          <span>{fmt(c.creditors_count)} دائن</span>
                          <span>{fmt(c.claims_count)} مطالبة</span>
                          <span>{fmt(c.assets_count)} أصل</span>
                          {c.total_assets && <span className="text-teal-600">{fmtMoney(c.total_assets)} أصول</span>}
                          <span className="mr-auto">{new Date(c.created_at).toLocaleDateString("ar-SA")}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-xs h-7"
                        onClick={() => logAudit.mutate({ office_id: c.office_id, action_type: "bankruptcy.view_case", resource_type: "bankruptcy_case", resource_id: c.id })}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {cases.length === 0 && !casesLoading && (
                <Card className="border-border/50">
                  <CardContent className="py-10 text-center text-muted-foreground text-sm">
                    <Landmark className="h-10 w-10 mx-auto mb-2 opacity-20" />لا توجد نتائج
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          OPENING REQUESTS TAB
      ═══════════════════════════════════════ */}
      {subTab === "requests" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pr-8 text-sm h-8" placeholder="بحث باسم الشركة أو رقم الطلب..." value={reqQ}
                onChange={e => setReqQ(e.target.value)} />
            </div>
            {officeFilter && (
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setOfficeFilter("")}>
                <XCircle className="h-3.5 w-3.5" />إزالة فلتر المكتب
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{requests.length} نتيجة</p>
          {reqLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {requests.map((r: any) => (
                <Card key={r.id} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold
                        ${(r.readiness_score ?? 0) >= 80 ? 'bg-emerald-500' : (r.readiness_score ?? 0) >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}>
                        {r.readiness_score ?? "—"}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{r.company_name}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-medium">
                            {REQ_STATUS_AR[r.status] ?? r.status}
                          </span>
                          {r.procedure_recommendation && (
                            <span className="text-[10px] font-semibold text-blue-600">
                              {PROC_AR[r.procedure_recommendation] ?? r.procedure_recommendation}
                            </span>
                          )}
                          {r.office_name && <span className="text-[10px] text-muted-foreground border border-border/50 px-1.5 rounded">
                            <Building2 className="h-2.5 w-2.5 inline ml-0.5" />{r.office_name}
                          </span>}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>{r.request_number}</span>
                          {r.eligibility_score != null && <span className="text-emerald-600">أهلية: {r.eligibility_score}/100</span>}
                          {r.total_assets && <span>{fmtMoney(r.total_assets)} أصول</span>}
                          <span className="mr-auto">{new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-xs h-7"
                        onClick={() => logAudit.mutate({ office_id: r.office_id, action_type: "bankruptcy.view_request", resource_type: "bk_opening_request", resource_id: r.id })}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {requests.length === 0 && !reqLoading && (
                <Card className="border-border/50">
                  <CardContent className="py-10 text-center text-muted-foreground text-sm">
                    <FilePlus2 className="h-10 w-10 mx-auto mb-2 opacity-20" />لا توجد نتائج
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          AUDIT LOG TAB
      ═══════════════════════════════════════ */}
      {subTab === "audit" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-500" />سجل تدقيق نظام الإفلاس
              <span className="text-xs text-muted-foreground font-normal">({auditLogs.length} سجل)</span>
            </p>
            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => refetchAudit()}>
              <RefreshCw className="h-3.5 w-3.5" />تحديث
            </Button>
          </div>
          {auditLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : auditLogs.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                <Shield className="h-10 w-10 mx-auto mb-2 opacity-20" />لا يوجد سجل بعد — ستظهر هنا كل عمليات وصول السوبر أدمن
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/50 hover:bg-accent/20">
                  <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{ACTION_AR[a.action_type] ?? a.action_type}</p>
                      {a.resource_type && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{a.resource_type}</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {a.office_name && <span><Building2 className="h-3 w-3 inline ml-1" />{a.office_name}</span>}
                      {a.reason && <span>{a.reason}</span>}
                      {a.ip_address && <span className="font-mono text-[10px]">{a.ip_address}</span>}
                      <span className="mr-auto">{new Date(a.created_at).toLocaleString("ar-SA")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
