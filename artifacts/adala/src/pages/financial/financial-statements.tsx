/**
 * عدالة AI — القوائم المالية
 * قائمة الدخل · الميزانية العمومية · ميزان المراجعة · دليل الحسابات · دفتر اليومية
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Scale, TrendingUp, TrendingDown, BookOpen,
  LayoutList, Printer, RefreshCw, CheckCircle2, XCircle,
  ChevronRight, Landmark, Wallet, PiggyBank, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const PRINT_CSS = `
@media print {
  body { background:#fff !important; color:#111 !important; font-family:'Cairo',sans-serif; direction:rtl; }
  .print\\:hidden { display:none !important; }
  nav,aside,header,.print-hide { display:none !important; }
  * { box-shadow:none !important; }
}`;

function fmtNum(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م";
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(0) + "ك";
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 0 });
}

function today() { return new Date().toISOString().split("T")[0]; }
function yearStart() { return `${new Date().getFullYear()}-01-01`; }

const TYPE_AR: Record<string, string> = {
  Asset: "أصول", Liability: "خصوم", Equity: "حقوق ملكية",
  Revenue: "إيرادات", Expense: "مصاريف",
};
const TYPE_COLOR: Record<string, string> = {
  Asset: "bg-blue-500/15 text-blue-400", Liability: "bg-red-500/15 text-red-400",
  Equity: "bg-violet-500/15 text-violet-400", Revenue: "bg-emerald-500/15 text-emerald-400",
  Expense: "bg-orange-500/15 text-orange-400",
};

/* ── Statement Row ── */
function StmtRow({ label = "", amount, bold, indent, sub, separator }: {
  label?: string; amount?: number; bold?: boolean; indent?: number;
  sub?: string; separator?: boolean;
}) {
  if (separator) return <tr><td colSpan={2}><Separator className="my-1 opacity-30" /></td></tr>;
  const cls = bold ? "font-bold text-white" : "text-muted-foreground";
  const ind = indent ? `pl-${indent * 4}` : "";
  return (
    <tr className="border-b border-border/20 last:border-0">
      <td className={`py-2 px-4 text-sm ${cls} ${ind}`}>
        {label}
        {sub && <span className="text-[10px] text-muted-foreground/60 mr-1">({sub})</span>}
      </td>
      {amount !== undefined && (
        <td className={`py-2 px-4 text-sm text-left tabular-nums ${bold ? "font-bold " + (amount >= 0 ? "text-white" : "text-red-400") : "text-foreground"}`}>
          {amount < 0 && amount !== 0 ? `(${fmtNum(Math.abs(amount))})` : fmtNum(amount)} ر.س
        </td>
      )}
    </tr>
  );
}

/* ══════════════════ قائمة الدخل ══════════════════ */
function IncomeStatement() {
  const [from, setFrom] = useState(yearStart());
  const [to,   setTo]   = useState(today());

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["income-statement", from, to],
    queryFn:  () => fetch(`${BASE}/api/accounting/statements/income?from=${from}&to=${to}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const d = data ?? {};
  const isProfit = (d.netIncome ?? 0) >= 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="print:hidden">
        <CardContent className="py-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">من</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-36" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">إلى</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-36" />
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            تحديث
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 ml-1.5" /> طباعة
          </Button>
        </CardContent>
      </Card>

      {/* KPI Row */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "إجمالي الإيرادات", val: d.totalRevenue ?? 0, color: "#10b981", icon: TrendingUp },
            { label: "إجمالي المصروفات", val: d.totalExpenses ?? 0, color: "#ef4444", icon: TrendingDown },
            { label: "صافي الدخل",       val: d.netIncome ?? 0,    color: isProfit ? "#2563EB" : "#ef4444", icon: isProfit ? ArrowUpRight : ArrowDownRight },
          ].map(k => (
            <Card key={k.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <k.icon className="h-4 w-4" style={{ color: k.color }} />
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                </div>
                <p className="text-xl font-bold" style={{ color: k.color }}>{fmtShort(k.val)} ر.س</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Statement Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="text-center">
            <h2 className="text-base font-bold text-white">قائمة الدخل</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              للفترة من {from} إلى {to}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <table className="w-full" dir="rtl">
              <tbody>
                <StmtRow label="الإيرادات" bold />
                {(d.revenues ?? []).map((r: any, i: number) => (
                  <StmtRow key={i} label={r.name} sub={r.code} amount={r.amount} indent={1} />
                ))}
                {!(d.revenues?.length) && (
                  <StmtRow label="لا توجد إيرادات مُقيَّدة في الفترة" indent={1} />
                )}
                <StmtRow label="إجمالي الإيرادات" amount={d.totalRevenue ?? 0} bold />
                <StmtRow separator />
                <StmtRow label="المصروفات" bold />
                {(d.expenses ?? []).map((e: any, i: number) => (
                  <StmtRow key={i} label={e.name} sub={e.code} amount={e.amount} indent={1} />
                ))}
                {!(d.expenses?.length) && (
                  <StmtRow label="لا توجد مصروفات مُقيَّدة في الفترة" indent={1} />
                )}
                <StmtRow label="إجمالي المصروفات" amount={d.totalExpenses ?? 0} bold />
                <StmtRow separator />
                <StmtRow label={isProfit ? "صافي الربح" : "صافي الخسارة"} amount={d.netIncome ?? 0} bold />
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-xs text-muted-foreground text-center">
                    هامش الربح: <span className={`font-semibold ${isProfit ? "text-emerald-400" : "text-red-400"}`}>{(d.profitMargin ?? 0).toFixed(1)}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════ الميزانية العمومية ══════════════════ */
function BalanceSheet() {
  const [asOf, setAsOf] = useState(today());
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["balance-sheet", asOf],
    queryFn:  () => fetch(`${BASE}/api/accounting/statements/balance-sheet?asOf=${asOf}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });
  const d = data ?? {};

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <CardContent className="py-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">كما في تاريخ</Label>
            <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-8 w-36" />
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ml-1.5 ${isLoading ? "animate-spin" : ""}`} /> تحديث
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 ml-1.5" /> طباعة
          </Button>
          {!isLoading && (
            <div className="flex items-center gap-1.5 text-xs">
              {d.isBalanced
                ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">الميزانية متوازنة</span></>
                : <><XCircle className="h-4 w-4 text-amber-400" /><span className="text-amber-400">لا توجد بيانات كافية</span></>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* الأصول */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 border-b border-border/40">
            <CardTitle className="text-sm flex items-center gap-2 text-white">
              <Landmark className="h-4 w-4 text-blue-400" /> الأصول
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div> : (
              <table className="w-full" dir="rtl">
                <tbody>
                  {(d.assets ?? []).length === 0
                    ? <tr><td className="p-4 text-sm text-muted-foreground text-center">لا توجد بيانات — سجّل قيوداً أولاً</td></tr>
                    : (d.assets ?? []).map((a: any, i: number) => (
                        <StmtRow key={i} label={a.name} sub={a.code} amount={a.amount} indent={1} />
                      ))}
                  {(d.assets ?? []).length > 0 && (
                    <StmtRow label="إجمالي الأصول" amount={d.totalAssets ?? 0} bold />
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* الخصوم وحقوق الملكية */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 border-b border-border/40">
            <CardTitle className="text-sm flex items-center gap-2 text-white">
              <Wallet className="h-4 w-4 text-violet-400" /> الخصوم وحقوق الملكية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div> : (
              <table className="w-full" dir="rtl">
                <tbody>
                  {(d.liabilities ?? []).length > 0 && <StmtRow label="الخصوم" bold />}
                  {(d.liabilities ?? []).map((l: any, i: number) => (
                    <StmtRow key={i} label={l.name} sub={l.code} amount={l.amount} indent={1} />
                  ))}
                  {(d.liabilities ?? []).length > 0 && (
                    <StmtRow label="إجمالي الخصوم" amount={d.totalLiabilities ?? 0} bold />
                  )}
                  {(d.equity ?? []).length > 0 && <><StmtRow separator /><StmtRow label="حقوق الملكية" bold /></>}
                  {(d.equity ?? []).map((e: any, i: number) => (
                    <StmtRow key={i} label={e.name} sub={e.code} amount={e.amount} indent={1} />
                  ))}
                  {(d.equity ?? []).length > 0 && (
                    <StmtRow label="إجمالي حقوق الملكية" amount={d.totalEquity ?? 0} bold />
                  )}
                  {!(d.liabilities?.length) && !(d.equity?.length) && (
                    <tr><td className="p-4 text-sm text-muted-foreground text-center">لا توجد بيانات — سجّل قيوداً أولاً</td></tr>
                  )}
                  {(d.totalLiabilities !== undefined && d.totalEquity !== undefined) && (
                    <><StmtRow separator /><StmtRow label="الخصوم + حقوق الملكية" amount={(d.totalLiabilities ?? 0) + (d.totalEquity ?? 0)} bold /></>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════ ميزان المراجعة ══════════════════ */
function TrialBalance() {
  const [asOf, setAsOf] = useState(today());
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["trial-balance", asOf],
    queryFn:  () => fetch(`${BASE}/api/accounting/statements/trial-balance?asOf=${asOf}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });
  const d = data ?? {};

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <CardContent className="py-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">كما في تاريخ</Label>
            <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-8 w-36" />
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ml-1.5 ${isLoading ? "animate-spin" : ""}`} /> تحديث
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 ml-1.5" /> طباعة
          </Button>
          {!isLoading && d.accounts?.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              {d.isBalanced
                ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">الميزان متوازن ✓</span></>
                : <><XCircle className="h-4 w-4 text-red-400" /><span className="text-red-400">غير متوازن!</span></>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2 border-b border-border/40">
          <div className="text-center">
            <h2 className="text-base font-bold text-white">ميزان المراجعة</h2>
            <p className="text-xs text-muted-foreground">كما في {asOf}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : (d.accounts ?? []).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <PiggyBank className="h-10 w-10 mx-auto mb-3 opacity-20" />
              لا توجد قيود مسجَّلة — ابدأ بتسجيل الإيرادات والمصاريف
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-b border-border bg-muted/10 text-muted-foreground text-right">
                    <th className="px-4 py-2.5 font-medium">الحساب</th>
                    <th className="px-4 py-2.5 font-medium">النوع</th>
                    <th className="px-4 py-2.5 font-medium text-left tabular-nums">مدين</th>
                    <th className="px-4 py-2.5 font-medium text-left tabular-nums">دائن</th>
                    <th className="px-4 py-2.5 font-medium text-left tabular-nums">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.accounts ?? []).map((a: any, i: number) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-muted/10">
                      <td className="px-4 py-2">
                        <span className="text-xs text-muted-foreground ml-2">{a.code}</span>
                        {a.name}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={`text-[10px] ${TYPE_COLOR[a.type]}`}>{TYPE_AR[a.type]}</Badge>
                      </td>
                      <td className="px-4 py-2 text-left tabular-nums text-blue-400">{fmtNum(a.totalDebit)}</td>
                      <td className="px-4 py-2 text-left tabular-nums text-red-400">{fmtNum(a.totalCredit)}</td>
                      <td className={`px-4 py-2 text-left tabular-nums font-medium ${a.netBalance >= 0 ? "text-white" : "text-red-400"}`}>
                        {fmtNum(Math.abs(a.netBalance))} {a.netBalance < 0 ? "د" : "م"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/10 font-bold text-white">
                  <tr>
                    <td className="px-4 py-2.5" colSpan={2}>الإجمالي</td>
                    <td className="px-4 py-2.5 text-left tabular-nums text-blue-400">{fmtNum(d.totalDebit ?? 0)}</td>
                    <td className="px-4 py-2.5 text-left tabular-nums text-red-400">{fmtNum(d.totalCredit ?? 0)}</td>
                    <td className="px-4 py-2.5 text-left tabular-nums">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════ دليل الحسابات ══════════════════ */
function ChartOfAccounts() {
  const [newCode, setNewCode]   = useState("");
  const [newName, setNewName]   = useState("");
  const [newType, setNewType]   = useState("Revenue");
  const [newParent, setNewParent] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["chart-of-accounts"],
    queryFn:  () => fetch(`${BASE}/api/accounting/journal/accounts`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const addAccount = useMutation({
    mutationFn: () => fetch(`${BASE}/api/accounting/journal/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountCode: newCode, accountName: newName, accountType: newType, parentCode: newParent || null }),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      setNewCode(""); setNewName(""); setNewParent("");
      toast({ title: "✅ تم إضافة الحساب" });
    },
    onError: () => toast({ title: "خطأ", variant: "destructive" }),
  });

  const byType: Record<string, any[]> = {};
  for (const a of data) { (byType[a.account_type] = byType[a.account_type] ?? []).push(a); }

  return (
    <div className="space-y-4">
      {/* Add account */}
      <Card className="print:hidden">
        <CardHeader className="pb-2"><CardTitle className="text-sm">إضافة حساب جديد</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">رمز الحساب</Label>
              <Input placeholder="مثال: 4600" value={newCode} onChange={e => setNewCode(e.target.value)} className="h-8 w-28" />
            </div>
            <div className="space-y-1 flex-1 min-w-40">
              <Label className="text-xs">اسم الحساب</Label>
              <Input placeholder="اسم الحساب بالعربي" value={newName} onChange={e => setNewName(e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">نوع الحساب</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_AR).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">حساب رئيسي (اختياري)</Label>
              <Input placeholder="مثال: 4000" value={newParent} onChange={e => setNewParent(e.target.value)} className="h-8 w-28" />
            </div>
            <Button size="sm" onClick={() => addAccount.mutate()} disabled={!newCode || !newName || addAccount.isPending}>
              إضافة
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accounts by type */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {["Asset", "Liability", "Equity", "Revenue", "Expense"].map(type => {
            const accounts = byType[type] ?? [];
            if (accounts.length === 0) return null;
            return (
              <Card key={type} className="bg-card border-border">
                <CardHeader className="py-2 px-4 border-b border-border/40">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Badge variant="outline" className={`${TYPE_COLOR[type]} text-xs`}>{TYPE_AR[type]}</Badge>
                    <span className="text-muted-foreground">{accounts.length} حساب</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/20">
                    {accounts.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                        <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">{a.account_code}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        <span className="flex-1 text-foreground">{a.account_name}</span>
                        {a.parent_code && (
                          <span className="text-[10px] text-muted-foreground/60">↳ {a.parent_code}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════ دفتر اليومية ══════════════════ */
function JournalBook() {
  const [from, setFrom] = useState(yearStart());
  const [to, setTo]     = useState(today());
  const { data = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["journal-entries", from, to],
    queryFn:  () => fetch(`${BASE}/api/accounting/journal/entries?from=${from}&to=${to}&limit=100`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <CardContent className="py-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">من</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-36" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">إلى</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-36" />
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ml-1.5 ${isLoading ? "animate-spin" : ""}`} /> تحديث
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 ml-1.5" /> طباعة
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : data.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">لا توجد قيود في هذه الفترة</p>
            <p className="text-xs text-muted-foreground/60 mt-1">تُنشأ القيود تلقائياً عند تسجيل الإيرادات والمصاريف</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((entry: any) => {
            const items: any[] = Array.isArray(entry.items) ? entry.items : [];
            return (
              <Card key={entry.id} className="bg-card border-border">
                <CardHeader className="py-2.5 px-4 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">{entry.entry_date}</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="text-sm text-white">{entry.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.reference_type && (
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                          {entry.reference_type === "revenue" ? "إيراد" : entry.reference_type === "expense" ? "مصروف" : entry.reference_type}
                        </Badge>
                      )}
                      {entry.posted_by === "system" && (
                        <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400">تلقائي</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs" dir="rtl">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/20">
                        <th className="px-4 py-1.5 text-right font-medium">الحساب</th>
                        <th className="px-4 py-1.5 text-left font-medium tabular-nums">مدين</th>
                        <th className="px-4 py-1.5 text-left font-medium tabular-nums">دائن</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.filter(Boolean).map((item: any, i: number) => (
                        <tr key={i} className="border-b border-border/10 last:border-0">
                          <td className="px-4 py-1.5 text-foreground">
                            {item.account_code && <span className="text-muted-foreground/60 ml-1.5">{item.account_code}</span>}
                            {item.account_name}
                          </td>
                          <td className="px-4 py-1.5 text-left tabular-nums text-blue-400">
                            {parseFloat(item.debit ?? "0") > 0 ? fmtNum(parseFloat(item.debit)) : "—"}
                          </td>
                          <td className="px-4 py-1.5 text-left tabular-nums text-red-400">
                            {parseFloat(item.credit ?? "0") > 0 ? fmtNum(parseFloat(item.credit)) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════ الصفحة الرئيسية ══════════════════ */
export default function FinancialStatements() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5" dir="rtl">
      <style>{PRINT_CSS}</style>

      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <Scale className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">القوائم المالية</h1>
          <p className="text-xs text-muted-foreground">نظام القيد المزدوج المتوافق مع المعايير المحاسبية</p>
        </div>
      </div>

      <Tabs defaultValue="income" dir="rtl">
        <TabsList className="grid w-full grid-cols-4 h-auto print:hidden">
          <TabsTrigger value="income" className="text-xs py-2.5 gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> قائمة الدخل
          </TabsTrigger>
          <TabsTrigger value="balance" className="text-xs py-2.5 gap-1.5">
            <Landmark className="h-3.5 w-3.5" /> الميزانية العمومية
          </TabsTrigger>
          <TabsTrigger value="trial" className="text-xs py-2.5 gap-1.5">
            <FileText className="h-3.5 w-3.5" /> ميزان المراجعة
          </TabsTrigger>
          <TabsTrigger value="journal" className="text-xs py-2.5 gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> دفتر اليومية
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="income"><IncomeStatement /></TabsContent>
          <TabsContent value="balance"><BalanceSheet /></TabsContent>
          <TabsContent value="trial"><TrialBalance /></TabsContent>
          <TabsContent value="journal"><JournalBook /></TabsContent>
        </div>
      </Tabs>

      {/* Chart of Accounts */}
      <div className="border-t border-border/40 pt-5">
        <div className="flex items-center gap-2 mb-4 print:hidden">
          <LayoutList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-white">دليل الحسابات</h2>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">مُهيَّأ لمكاتب المحاماة</Badge>
        </div>
        <ChartOfAccounts />
      </div>
    </div>
  );
}
