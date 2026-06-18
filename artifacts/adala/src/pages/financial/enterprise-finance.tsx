/**
 * Enterprise Finance Dashboard — لوحة المالية الاحترافية ERP
 * ─────────────────────────────────────────────────────────────
 * 6 تبويبات:
 *   1. الأستاذ العام (ERP Ledger)
 *   2. التسوية المالية (Reconciliation)
 *   3. قائمة الدخل (Income Statement)
 *   4. الميزان (Balance Check)
 *   5. الشذوذات المالية (Anomalies)
 *   6. الملخص الذكي (AI Summary)
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BookOpen, RefreshCw, BarChart3, Scale, AlertTriangle,
  Bot, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  ShieldCheck, Loader2, ArrowUpDown,
} from "lucide-react";

const API = "/api";
const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 2 }).format(n ?? 0);
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString("ar-SA") : "—";

/* ── Fetch helpers ───────────────────────────────────────────────────────── */
function useLedger(page = 0) {
  return useQuery({
    queryKey: ["erp-ledger", page],
    queryFn: async () => {
      const r = await fetch(`${API}/erp/ledger?page=${page}&limit=50`);
      return r.json();
    },
    staleTime: 30_000,
  });
}

function useBalance() {
  return useQuery({
    queryKey: ["erp-balance"],
    queryFn: async () => (await fetch(`${API}/erp/balance`)).json(),
    staleTime: 30_000,
  });
}

function useReconcile() {
  return useQuery({
    queryKey: ["erp-reconcile"],
    queryFn: async () => (await fetch(`${API}/erp/reconcile`)).json(),
    staleTime: 60_000,
    retry: false,
  });
}

function useIncomeStatement() {
  const year = new Date().getFullYear();
  return useQuery({
    queryKey: ["erp-income", year],
    queryFn: async () => (await fetch(`${API}/erp/income-statement?year=${year}`)).json(),
    staleTime: 60_000,
  });
}

function useAnomalies() {
  return useQuery({
    queryKey: ["erp-anomalies"],
    queryFn: async () => (await fetch(`${API}/erp/anomalies`)).json(),
    staleTime: 60_000,
  });
}

function useAISummary() {
  return useQuery({
    queryKey: ["erp-ai-summary"],
    queryFn: async () => (await fetch(`${API}/erp/ai-summary`)).json(),
    staleTime: 120_000,
  });
}

/* ── Score ring ────────────────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const r = 38, circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" className="rotate-[-90deg]">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round" />
      </svg>
      <span className="text-xl font-bold -mt-16" style={{ color }}>{score}</span>
      <span className="text-xs text-muted-foreground mt-8">درجة التطابق</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function EnterpriseFinance() {
  const [page, setPage] = useState(0);

  const ledger       = useLedger(page);
  const balance      = useBalance();
  const income       = useIncomeStatement();
  const anomalies    = useAnomalies();
  const aiSummary    = useAISummary();

  /* lazy-load reconcile only when tab is clicked */
  const [reconcileEnabled, setReconcileEnabled] = useState(false);
  const reconcile = useReconcile();

  const isBalanced = balance.data?.isBalanced ?? false;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-blue-600" />
            المالية الاحترافية ERP
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            نظام القيد المزدوج · التسوية التلقائية · الأستاذ العام المُعزول
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={isBalanced ? "default" : "destructive"} className="text-sm px-3 py-1">
            {isBalanced ? <CheckCircle2 className="h-4 w-4 ms-1" /> : <XCircle className="h-4 w-4 ms-1" />}
            {isBalanced ? "الميزان متوازن" : "يوجد فارق في الميزان"}
          </Badge>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">إجمالي الإيرادات (الدفتر)</p>
            {balance.isLoading ? <Loader2 className="h-4 w-4 animate-spin mt-1" /> : (
              <p className="text-xl font-bold text-green-600">{fmt(balance.data?.totalCredits ?? 0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">إجمالي المصروفات (الدفتر)</p>
            {balance.isLoading ? <Loader2 className="h-4 w-4 animate-spin mt-1" /> : (
              <p className="text-xl font-bold text-red-500">{fmt(balance.data?.totalDebits ?? 0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">صافي الربح (الدفتر)</p>
            {balance.isLoading ? <Loader2 className="h-4 w-4 animate-spin mt-1" /> : (
              <p className={`text-xl font-bold ${(balance.data?.netBalance ?? 0) >= 0 ? "text-blue-600" : "text-red-500"}`}>
                {fmt(balance.data?.netBalance ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">شذوذات مالية نشطة</p>
            {anomalies.isLoading ? <Loader2 className="h-4 w-4 animate-spin mt-1" /> : (
              <p className={`text-xl font-bold ${(anomalies.data?.length ?? 0) > 0 ? "text-amber-500" : "text-green-600"}`}>
                {anomalies.data?.length ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="ledger" onValueChange={(v) => { if (v === "reconcile") setReconcileEnabled(true); }}>
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
          <TabsTrigger value="ledger" className="text-xs">الأستاذ العام</TabsTrigger>
          <TabsTrigger value="reconcile" className="text-xs">التسوية</TabsTrigger>
          <TabsTrigger value="income" className="text-xs">قائمة الدخل</TabsTrigger>
          <TabsTrigger value="balance" className="text-xs">الميزان</TabsTrigger>
          <TabsTrigger value="anomalies" className="text-xs">الشذوذات</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">الملخص الذكي</TabsTrigger>
        </TabsList>

        {/* ── 1. ERP Ledger ── */}
        <TabsContent value="ledger" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> الأستاذ العام — القيود المحاسبية
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>السابق</Button>
                <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)}>التالي</Button>
              </div>
            </CardHeader>
            <CardContent>
              {ledger.isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !ledger.data?.entries?.length ? (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد قيود بعد — ستُسجَّل القيود تلقائياً عند إنشاء الفواتير والمصروفات
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="pb-2 text-right">التاريخ</th>
                        <th className="pb-2 text-right">النوع</th>
                        <th className="pb-2 text-right">الحساب</th>
                        <th className="pb-2 text-right">المرجع</th>
                        <th className="pb-2 text-left">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ledger.data.entries.map((e: any) => (
                        <tr key={e.id} className="hover:bg-muted/30">
                          <td className="py-2">{fmtDate(e.entry_date)}</td>
                          <td className="py-2">
                            <Badge variant={e.entry_type === "CREDIT" ? "default" : "secondary"} className="text-xs">
                              {e.entry_type === "CREDIT" ? "دائن" : "مدين"}
                            </Badge>
                          </td>
                          <td className="py-2">
                            <span className="font-mono text-xs text-muted-foreground ms-1">{e.account_code}</span>
                            {e.account_name}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{e.reference_type ?? "—"}</td>
                          <td className={`py-2 text-left font-medium ${e.entry_type === "CREDIT" ? "text-green-600" : "text-red-500"}`}>
                            {e.entry_type === "CREDIT" ? "+" : "-"}{fmt(e.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground mt-2">
                    الصفحة {page + 1} · إجمالي القيود: {ledger.data.total}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 2. Reconciliation ── */}
        <TabsContent value="reconcile" className="mt-4">
          {reconcile.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="me-3 text-muted-foreground">جاري تشغيل محرك التسوية…</span>
            </div>
          ) : reconcile.data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <ScoreRing score={reconcile.data.score ?? 0} />
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <Card className="border-green-200">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">الدائن الإجمالي</p>
                      <p className="font-bold text-green-600">{fmt(reconcile.data.ledgerBalance?.credits ?? 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-200">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">المدين الإجمالي</p>
                      <p className="font-bold text-red-500">{fmt(reconcile.data.ledgerBalance?.debits ?? 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className={reconcile.data.ledgerBalance?.isBalanced ? "border-green-200" : "border-amber-200"}>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">الرصيد الصافي</p>
                      <p className={`font-bold ${reconcile.data.ledgerBalance?.isBalanced ? "text-green-600" : "text-amber-500"}`}>
                        {fmt(reconcile.data.ledgerBalance?.net ?? 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {reconcile.data.anomalies?.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {reconcile.data.anomalies.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {reconcile.data.unmatchedInvoices?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-600">⚠️ فواتير بدون قيد محاسبي ({reconcile.data.unmatchedInvoices.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      {reconcile.data.unmatchedInvoices.map((inv: any) => (
                        <div key={inv.id} className="flex justify-between border-b py-1">
                          <span>{inv.client || "—"} · {fmtDate(inv.date)}</span>
                          <span className="font-medium text-amber-600">{fmt(inv.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {reconcile.data.unmatchedExpenses?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-red-500">⚠️ مصروفات بدون قيد مدين ({reconcile.data.unmatchedExpenses.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      {reconcile.data.unmatchedExpenses.map((e: any) => (
                        <div key={e.id} className="flex justify-between border-b py-1">
                          <span>{e.title} · {fmtDate(e.date)}</span>
                          <span className="font-medium text-red-500">{fmt(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {reconcile.data.score >= 90 && reconcile.data.anomalies?.length === 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 font-medium">النظام المالي في حالة مثالية — لا توجد شذوذات</AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2" />
              <p>اضغط على تبويب "التسوية" لتشغيل المحرك</p>
            </div>
          )}
        </TabsContent>

        {/* ── 3. Income Statement ── */}
        <TabsContent value="income" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                قائمة الدخل — {income.data?.year ?? new Date().getFullYear()} (من الأستاذ العام)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {income.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : (
                <div className="space-y-4">
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-xs text-blue-700">
                      ⚠️ هذه التقارير مبنية على <strong>الأستاذ العام ERP</strong> فقط — لا على الفواتير أو جداول المصروفات مباشرة
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                      <span className="flex items-center gap-2 font-medium">
                        <TrendingUp className="h-4 w-4 text-green-600" /> إجمالي الإيرادات
                      </span>
                      <span className="font-bold text-green-600 text-lg">{fmt(income.data?.revenue ?? 0)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-red-50 rounded-lg">
                      <span className="flex items-center gap-2 font-medium">
                        <TrendingDown className="h-4 w-4 text-red-500" /> إجمالي المصروفات
                      </span>
                      <span className="font-bold text-red-500 text-lg">{fmt(income.data?.expenses ?? 0)}</span>
                    </div>
                    <div className={`flex justify-between p-4 rounded-lg font-bold text-lg ${(income.data?.netProfit ?? 0) >= 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-600"}`}>
                      <span>صافي الربح</span>
                      <span>{fmt(income.data?.netProfit ?? 0)}</span>
                    </div>
                    {income.data?.margin !== undefined && (
                      <p className="text-sm text-muted-foreground text-center">
                        هامش الربح: <strong>{income.data.margin}%</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 4. Balance Check ── */}
        <TabsContent value="balance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-4 w-4" /> ميزان المراجعة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {balance.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border-green-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">إجمالي الدائن (Credit)</p>
                        <p className="text-2xl font-bold text-green-600">{fmt(balance.data?.totalCredits ?? 0)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-red-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">إجمالي المدين (Debit)</p>
                        <p className="text-2xl font-bold text-red-500">{fmt(balance.data?.totalDebits ?? 0)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className={`p-4 rounded-xl text-center ${balance.data?.isBalanced ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    {balance.data?.isBalanced ? (
                      <div className="flex items-center justify-center gap-2 text-green-700">
                        <CheckCircle2 className="h-6 w-6" />
                        <span className="font-bold text-lg">الميزان متوازن تماماً ✓</span>
                      </div>
                    ) : (
                      <div className="text-red-600">
                        <XCircle className="h-6 w-6 mx-auto mb-1" />
                        <p className="font-bold">يوجد فارق: {fmt(Math.abs(balance.data?.netBalance ?? 0))}</p>
                        <p className="text-sm mt-1">يُنصح بتشغيل التسوية لتحديد سبب الفارق</p>
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <ArrowUpDown className="h-3 w-3" />
                      <span className="font-medium">القاعدة المحاسبية:</span>
                    </div>
                    <p>كل قيد مدين يجب أن يقابله قيد دائن بنفس المبلغ تحقيقاً لمبدأ القيد المزدوج.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 5. Anomalies ── */}
        <TabsContent value="anomalies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" /> الشذوذات المالية النشطة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {anomalies.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : !anomalies.data?.length ? (
                <div className="text-center py-10">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
                  <p className="text-green-600 font-medium">لا توجد شذوذات مالية نشطة</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalies.data.map((a: any) => (
                    <Alert key={a.id} variant={a.severity === "critical" || a.severity === "high" ? "destructive" : "default"}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge className="text-xs mb-1" variant={a.severity === "high" || a.severity === "critical" ? "destructive" : "secondary"}>
                              {a.anomaly_type}
                            </Badge>
                            <p className="text-sm">{a.description}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</span>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 6. AI Summary ── */}
        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-600" />
                الملخص الذكي — بيانات آمنة للذكاء الاصطناعي
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiSummary.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : aiSummary.error || aiSummary.data?.error ? (
                <Alert variant="destructive">
                  <AlertDescription>خطأ في تحميل الملخص الذكي</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <Alert className="bg-blue-50 border-blue-200">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700 text-xs">
                      بيانات مُرشَّحة بواسطة <strong>AI Financial Guard</strong> — المعلومات الحساسة (IBAN، أرقام حسابات) محجوبة
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: "إيرادات الشهر", val: fmt(aiSummary.data?.monthRevenue ?? 0), color: "text-green-600" },
                      { label: "مصروفات الشهر", val: fmt(aiSummary.data?.monthExpenses ?? 0), color: "text-red-500" },
                      { label: "صافي الربح", val: fmt(aiSummary.data?.netProfit ?? 0), color: (aiSummary.data?.netProfit ?? 0) >= 0 ? "text-blue-600" : "text-red-500" },
                      { label: "فواتير غير مدفوعة", val: `${aiSummary.data?.unpaidInvoices ?? 0} فاتورة`, color: "text-amber-500" },
                      { label: "مبلغ غير مُحصَّل", val: fmt(aiSummary.data?.unpaidAmount ?? 0), color: "text-amber-600" },
                      { label: "حالة الدفتر", val: aiSummary.data?.ledgerBalanced ? "متوازن ✓" : "يوجد فارق ⚠️", color: aiSummary.data?.ledgerBalanced ? "text-green-600" : "text-red-500" },
                    ].map(item => (
                      <div key={item.label} className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className={`font-bold ${item.color}`}>{item.val}</p>
                      </div>
                    ))}
                  </div>

                  {aiSummary.data?.topRevenueCategories?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">أعلى فئات الإيرادات:</p>
                      <div className="space-y-1">
                        {aiSummary.data.topRevenueCategories.map((c: any) => (
                          <div key={c.name} className="flex justify-between text-sm border-b pb-1">
                            <span>{c.name}</span>
                            <span className="text-green-600 font-medium">{fmt(c.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiSummary.data?.topExpenseCategories?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">أعلى فئات المصروفات:</p>
                      <div className="space-y-1">
                        {aiSummary.data.topExpenseCategories.map((c: any) => (
                          <div key={c.name} className="flex justify-between text-sm border-b pb-1">
                            <span>{c.name}</span>
                            <span className="text-red-500 font-medium">{fmt(c.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
