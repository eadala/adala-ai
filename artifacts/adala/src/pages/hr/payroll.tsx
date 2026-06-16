import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign, Plus, Loader2, CheckCircle2, Clock, Sparkles,
  TrendingUp, Users, CreditCard, Download, Filter, FileText, Printer
} from "lucide-react";
import { DocumentPrintTemplate, PrintButton } from "@/components/document-print-template";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const MONTHS_EN = ["01","02","03","04","05","06","07","08","09","10","11","12"];

const currentDate = new Date();
const currentMonth = MONTHS_AR[currentDate.getMonth()];
const currentYear = currentDate.getFullYear();

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft: { label: "مسودة", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: Clock },
  paid: { label: "مدفوع", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
};

function fmt(n: any) {
  return parseFloat(String(n || "0")).toLocaleString("ar-SA", { maximumFractionDigits: 0 });
}

export default function Payroll() {
  const [showGenerate, setShowGenerate] = useState(false);
  const [genMonth, setGenMonth] = useState(currentMonth);
  const [genYear, setGenYear] = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: payroll = [], isLoading } = useQuery<any[]>({
    queryKey: ["payroll"],
    queryFn: () => fetch("/api/hr/payroll").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: payStats } = useQuery<any>({
    queryKey: ["payroll-stats"],
    queryFn: () => fetch("/api/hr/payroll/stats").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const generateMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/hr/payroll/generate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["payroll"] }); qc.invalidateQueries({ queryKey: ["payroll-stats"] }); setShowGenerate(false); toast({ title: `تم توليد ${d.generated} قسيمة راتب` }); },
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/api/hr/payroll/${id}/pay`, { method: "PATCH" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll"] }); qc.invalidateQueries({ queryKey: ["payroll-stats"] }); toast({ title: "تم صرف الراتب" }); },
  });

  const payAllMutation = useMutation({
    mutationFn: ({ month, year }: any) => fetch("/api/hr/payroll/pay-all", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, year: parseInt(year) }),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll"] }); qc.invalidateQueries({ queryKey: ["payroll-stats"] }); toast({ title: "تم صرف جميع الرواتب" }); },
  });

  const months = [...new Set(payroll.map(p => p.month))];
  const filtered = payroll.filter(p => monthFilter === "all" || p.month === monthFilter);
  const draftCount = filtered.filter(p => p.status === "draft").length;
  const totalNet = filtered.reduce((s, p) => s + parseFloat(String(p.netSalary || "0")), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">الرواتب</h1>
          <p className="text-muted-foreground text-sm">إدارة وصرف رواتب الموظفين</p>
        </div>
        <div className="flex gap-2">
          <PrintButton label="طباعة الكشف">
            <DocumentPrintTemplate
              title="كشف الرواتب"
              subtitle={`${monthFilter !== "all" ? monthFilter : "جميع الشهور"} — ${filtered.length} موظف`}
              date={new Date().toLocaleDateString("ar-EG")}
              showStamp
              showSignature
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    {["الموظف", "الشهر", "الراتب الأساسي", "البدلات", "التأمينات", "الاستقطاعات", "الصافي", "الحالة"].map(h => (
                      <th key={h} style={{ border: "1px solid #ddd", padding: "6px 8px", textAlign: "right", fontSize: "11px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p: any, i: number) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ border: "1px solid #ddd", padding: "6px 8px" }}><div style={{ fontWeight: 600 }}>{p.employeeName}</div><div style={{ fontSize: "10px", color: "#888" }}>{p.jobTitle}</div></td>
                      <td style={{ border: "1px solid #ddd", padding: "6px 8px" }}>{p.month} {p.year}</td>
                      <td style={{ border: "1px solid #ddd", padding: "6px 8px" }}>{fmt(p.baseSalary)}</td>
                      <td style={{ border: "1px solid #ddd", padding: "6px 8px", color: "#059669" }}>+{fmt(p.allowances)}</td>
                      <td style={{ border: "1px solid #ddd", padding: "6px 8px", color: "#ea580c" }}>-{fmt(p.gosi)}</td>
                      <td style={{ border: "1px solid #ddd", padding: "6px 8px", color: "#dc2626" }}>-{fmt(p.deductions)}</td>
                      <td style={{ border: "1px solid #ddd", padding: "6px 8px", fontWeight: 700 }}>{fmt(p.netSalary)} ر.س</td>
                      <td style={{ border: "1px solid #ddd", padding: "6px 8px" }}>{p.status === "paid" ? "✅ مدفوع" : "⏳ معلق"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f0f0f0", fontWeight: 700 }}>
                    <td colSpan={6} style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>الإجمالي</td>
                    <td style={{ border: "1px solid #ddd", padding: "8px" }}>{fmt(totalNet)} ر.س</td>
                    <td style={{ border: "1px solid #ddd", padding: "8px" }}></td>
                  </tr>
                </tfoot>
              </table>
            </DocumentPrintTemplate>
          </PrintButton>
          <Button onClick={() => setShowGenerate(true)} className="gap-2">
            <Sparkles className="h-4 w-4" /> توليد كشف الرواتب
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي المدفوع", value: `${fmt(payStats?.totalPaid)} ر`, color: "#10B981", icon: DollarSign },
          { label: "قسائم مدفوعة", value: payStats?.paidCount ?? 0, color: "#6366F1", icon: CheckCircle2 },
          { label: "قسائم معلقة", value: payStats?.totalDraft ?? 0, color: "#F59E0B", icon: Clock },
          { label: "المعروض حالياً", value: `${fmt(totalNet)} ر`, color: "#2563EB", icon: TrendingUp },
        ].map(s => (
          <Card key={s.label} className="border-0 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-lg font-black leading-tight" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + Pay All */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="الشهر" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الشهور</SelectItem>
            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        {draftCount > 0 && (
          <Button variant="outline" className="gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => payAllMutation.mutate({ month: monthFilter !== "all" ? monthFilter : currentMonth, year: String(currentYear) })}
            disabled={payAllMutation.isPending}>
            {payAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            صرف الكل ({draftCount})
          </Button>
        )}
      </div>

      {/* Payroll Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  {["الموظف", "الشهر", "الراتب الأساسي", "البدلات", "التأمينات", "الاستقطاعات", "الصافي", "الحالة", ""].map(h => (
                    <th key={h} className="text-right text-xs text-muted-foreground font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    لا توجد بيانات — قم بتوليد كشف الرواتب
                  </td></tr>
                ) : filtered.map((p: any) => {
                  const s = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
                  const StatusIcon = s.icon;
                  return (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-sm whitespace-nowrap">{p.employeeName}</div>
                        <div className="text-[10px] text-muted-foreground">{p.jobTitle}</div>
                      </td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap">{p.month} {p.year}</td>
                      <td className="py-3 px-3 text-xs font-mono">{fmt(p.baseSalary)}</td>
                      <td className="py-3 px-3 text-xs font-mono text-emerald-400">+{fmt(p.allowances)}</td>
                      <td className="py-3 px-3 text-xs font-mono text-orange-400">-{fmt(p.gosi)}</td>
                      <td className="py-3 px-3 text-xs font-mono text-red-400">-{fmt(p.deductions)}</td>
                      <td className="py-3 px-3 text-sm font-black text-primary whitespace-nowrap">{fmt(p.netSalary)} ر</td>
                      <td className="py-3 px-3">
                        <div className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap", s.bg, s.color)}>
                          <StatusIcon className="h-3 w-3" />{s.label}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {p.status === "draft" && (
                          <Button size="sm" className="h-7 text-xs gap-1 whitespace-nowrap"
                            onClick={() => payMutation.mutate(p.id)} disabled={payMutation.isPending}>
                            <CreditCard className="h-3.5 w-3.5" /> صرف
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown (if filtered month) */}
      {filtered.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> ملخص كشف الرواتب</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "إجمالي الرواتب الأساسية", value: filtered.reduce((s, p) => s + parseFloat(String(p.baseSalary || "0")), 0), color: "#6366F1" },
                { label: "إجمالي البدلات", value: filtered.reduce((s, p) => s + parseFloat(String(p.allowances || "0")), 0), color: "#10B981" },
                { label: "إجمالي التأمينات", value: filtered.reduce((s, p) => s + parseFloat(String(p.gosi || "0")), 0), color: "#F97316" },
                { label: "إجمالي الصافي", value: totalNet, color: "#2563EB" },
              ].map(s => (
                <div key={s.label} className="text-center p-3 bg-muted/30 rounded-xl">
                  <div className="text-lg font-black" style={{ color: s.color }}>{fmt(s.value)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>نسبة الصرف</span>
                <span className="font-bold text-primary">{filtered.length > 0 ? Math.round((filtered.filter(p => p.status === "paid").length / filtered.length) * 100) : 0}%</span>
              </div>
              <Progress value={filtered.length > 0 ? (filtered.filter(p => p.status === "paid").length / filtered.length) * 100 : 0} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>توليد كشف الرواتب</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">سيتم توليد قسائم رواتب لجميع الموظفين النشطين مع حساب البدلات والتأمينات تلقائياً.</p>
            <div><Label>الشهر</Label>
              <Select value={genMonth} onValueChange={setGenMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS_AR.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>السنة</Label><Input value={genYear} onChange={e => setGenYear(e.target.value)} type="number" min="2020" max="2030" /></div>
            <div className="bg-muted/30 rounded-xl p-3 text-xs space-y-1">
              <p className="font-semibold">سيتم احتساب:</p>
              <p>• البدلات: 15% من الراتب الأساسي</p>
              <p>• التأمينات (GOSI): 10% من الراتب الأساسي</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>إلغاء</Button>
            <Button onClick={() => generateMutation.mutate({ month: genMonth, year: genYear })} disabled={generateMutation.isPending} className="gap-2">
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              توليد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
