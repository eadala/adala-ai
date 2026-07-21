/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Megaphone, FileText, CalendarDays, Printer, Plus, Trash2,
  CheckCircle2, XCircle, Clock, AlertCircle, Bell, BellRing,
  Users, MoreHorizontal, Building2, ChevronRight, Star,
  Send, MessageSquare, Settings2, Download, Briefcase,
  Coffee, Stethoscope, AlertOctagon, Baby, DollarSign, Package,
  Stamp, ExternalLink, RefreshCw, BarChart3, UserCheck,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ══════════════════════════════════════════════ CONSTANTS */
const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  urgent:  { label: "عاجل",  color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",    icon: AlertOctagon },
  high:    { label: "مهم",   color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", icon: BellRing },
  normal:  { label: "عادي",  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30",  icon: Bell },
  low:     { label: "عام",   color: "text-muted-foreground", bg: "border-border/50",            icon: MessageSquare },
};

const REQUEST_TYPES = [
  { value: "salary_cert",   label: "شهادة راتب",       icon: Stamp },
  { value: "work_cert",     label: "شهادة عمل",        icon: FileText },
  { value: "advance",       label: "سلفة راتب",        icon: DollarSign },
  { value: "equipment",     label: "طلب معدات",        icon: Package },
  { value: "exit_permit",   label: "إذن خروج",         icon: ExternalLink },
  { value: "overtime",      label: "طلب إضافي",        icon: Clock },
  { value: "other",         label: "طلب آخر",          icon: Briefcase },
];

const LEAVE_TYPES: Record<string, { label: string; color: string; icon: any }> = {
  annual:    { label: "سنوية",      color: "#6366F1", icon: CalendarDays },
  sick:      { label: "مرضية",     color: "#EF4444", icon: Stethoscope },
  emergency: { label: "طارئة",     color: "#F97316", icon: AlertCircle },
};

const REQUEST_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "قيد المراجعة", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  approved: { label: "موافق عليه",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  rejected: { label: "مرفوض",      color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
  done:     { label: "منجز",       color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30" },
};

function fmt(n: number) { return n.toLocaleString("ar-SA", { maximumFractionDigits: 0 }); }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString("ar-SA") : "—"; }

/* ══════════════════════════════════════════════ PAYSLIP PRINT */
function PayslipModal({ payroll, onClose }: { payroll: any; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"/><title>كشف راتب</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; color: #111; direction: rtl; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563EB; padding-bottom: 12px; margin-bottom: 20px; }
        .logo { font-size: 22px; font-weight: 900; color: #2563EB; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { padding: 8px 12px; text-align: right; font-size: 13px; }
        thead th { background: #f5f5f5; font-weight: 700; }
        tbody tr:nth-child(even) { background: #fafafa; }
        .total-row { background: #1a2744 !important; color: #2563EB; font-weight: 900; }
        .section-title { font-weight: 700; font-size: 13px; color: #1a2744; margin: 16px 0 6px; border-right: 3px solid #2563EB; padding-right: 8px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .info-item { font-size: 12px; } .info-label { color: #666; font-size: 11px; }
        .seal { border: 2px solid #2563EB; border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 10px; color: #2563EB; font-weight: 700; }
        @media print { body { padding: 12px; } }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const base = parseFloat(payroll?.base_salary ?? payroll?.baseSalary ?? "0");
  const allowances = parseFloat(payroll?.allowances ?? "0");
  const bonus = parseFloat(payroll?.bonus ?? payroll?.performanceBonus ?? "0");
  const deductions = parseFloat(payroll?.deductions ?? "0");
  const gosi = parseFloat(payroll?.gosi ?? "0");
  const net = parseFloat(payroll?.net_salary ?? payroll?.netSalary ?? "0");

  return (
    <AdaptiveDialog open onOpenChange={onClose}>
      <AdaptiveDialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            كشف الراتب
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef}>
          {/* Header */}
          <div className="header flex justify-between items-center border-b-2 border-primary pb-3 mb-4">
            <div>
              <div className="logo text-xl font-black text-primary">عدالة AI</div>
              <div className="text-xs text-muted-foreground">منصة إدارة المكاتب القانونية</div>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">كشف راتب شهري</div>
              <div className="text-xs text-muted-foreground">{payroll?.month} {payroll?.year}</div>
            </div>
          </div>

          {/* Employee Info */}
          <div className="section-title text-xs font-bold text-primary mb-2 border-r-2 border-primary pe-2">بيانات الموظف</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {[
              { label: "الاسم الكامل",  value: payroll?.full_name ?? payroll?.employeeName },
              { label: "المسمى الوظيفي", value: payroll?.job_title ?? payroll?.jobTitle },
              { label: "القسم",         value: payroll?.department ?? "—" },
              { label: "الرقم الوطني",  value: payroll?.national_id ?? "—" },
              { label: "رقم IBAN",      value: payroll?.bank_iban ?? "—" },
              { label: "تاريخ الالتحاق",value: payroll?.hire_date ? fmtDate(payroll.hire_date) : "—" },
            ].map(f => (
              <div key={f.label} className="rounded-lg border border-border/50 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">{f.label}</div>
                <div className="text-xs font-semibold mt-0.5">{f.value ?? "—"}</div>
              </div>
            ))}
          </div>

          {/* Salary breakdown */}
          <div className="section-title text-xs font-bold text-primary mb-2 border-r-2 border-primary pe-2">تفاصيل الراتب</div>
          <div className="rounded-xl border overflow-hidden overflow-x-auto mb-4">
            <table className="w-full text-xs min-w-[280px]">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-right px-4 py-2 font-semibold">البند</th>
                  <th className="text-right px-4 py-2 font-semibold">المبلغ (ر.س)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <tr className="hover:bg-muted/10">
                  <td className="px-4 py-2">الراتب الأساسي</td>
                  <td className="px-4 py-2 font-semibold">{fmt(base)}</td>
                </tr>
                {allowances > 0 && (
                  <tr className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-emerald-600">+ البدلات</td>
                    <td className="px-4 py-2 text-emerald-600 font-semibold">+{fmt(allowances)}</td>
                  </tr>
                )}
                {bonus > 0 && (
                  <tr className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-emerald-600">+ مكافأة الأداء</td>
                    <td className="px-4 py-2 text-emerald-600 font-semibold">+{fmt(bonus)}</td>
                  </tr>
                )}
                {deductions > 0 && (
                  <tr className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-red-500">− الخصومات</td>
                    <td className="px-4 py-2 text-red-500 font-semibold">−{fmt(deductions)}</td>
                  </tr>
                )}
                {gosi > 0 && (
                  <tr className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-orange-500">− التأمينات (GOSI)</td>
                    <td className="px-4 py-2 text-orange-500 font-semibold">−{fmt(gosi)}</td>
                  </tr>
                )}
                <tr className="bg-primary/10 font-bold">
                  <td className="px-4 py-2.5 text-primary font-black">صافي الراتب</td>
                  <td className="px-4 py-2.5 text-primary font-black text-base">{fmt(net || base)} ر.س</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end mt-4 pt-3 border-t border-border/50">
            <div className="text-[10px] text-muted-foreground">
              <div>تاريخ الإصدار: {new Date().toLocaleDateString("ar-SA")}</div>
              <div className="mt-1">هذا المستند صادر إلكترونياً من منصة عدالة AI</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center">
                <div className="text-[8px] text-primary font-bold text-center">توقيع<br/>المدير</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />طباعة / PDF
          </Button>
        </DialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ══════════════════════════════════════════════ ANNOUNCEMENT DIALOG */
function AnnouncementDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", content: "", priority: "normal", targetDept: "", expiresAt: "" });
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`${BASE}/api/hr-internal/announcements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, content: form.content, priority: form.priority, targetDept: form.targetDept || null, expiresAt: form.expiresAt || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => { toast({ title: "✅ تم نشر الإعلان" }); qc.invalidateQueries({ queryKey: ["announcements"] }); qc.invalidateQueries({ queryKey: ["hr-internal-dash"] }); onClose(); setForm({ title: "", content: "", priority: "normal", targetDept: "", expiresAt: "" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <AdaptiveDialog open={open} onOpenChange={onClose}>
      <AdaptiveDialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />إضافة إعلان داخلي
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3 mobile-single-col">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">العنوان *</Label>
              <Input value={form.title} onChange={e => upd("title", e.target.value)} placeholder="عنوان الإعلان..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الأولوية</Label>
              <Select value={form.priority} onValueChange={v => upd("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}><span className={v.color}>{v.label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">محتوى الإعلان *</Label>
            <Textarea value={form.content} onChange={e => upd("content", e.target.value)} placeholder="نص الإعلان..." rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-3 mobile-single-col">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">القسم المستهدف (اختياري)</Label>
              <Input value={form.targetDept} onChange={e => upd("targetDept", e.target.value)} placeholder="الكل" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">تاريخ الانتهاء (اختياري)</Label>
              <Input type="date" value={form.expiresAt} onChange={e => upd("expiresAt", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.title || !form.content || mut.isPending}>
            {mut.isPending ? "جارٍ النشر..." : "نشر الإعلان"}
          </Button>
        </DialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ══════════════════════════════════════════════ REQUEST DIALOG */
function RequestDialog({ open, onClose, employees }: { open: boolean; onClose: () => void; employees: any[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ employeeId: "", type: "salary_cert", subject: "", body: "" });
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const typeConfig = REQUEST_TYPES.find(t => t.value === form.type) ?? REQUEST_TYPES[0];
  const TypeIcon = typeConfig.icon;

  const mut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`${BASE}/api/hr-internal/requests`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: form.employeeId, type: form.type, subject: form.subject, body: form.body }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => { toast({ title: "✅ تم تسجيل الطلب" }); qc.invalidateQueries({ queryKey: ["emp-requests"] }); qc.invalidateQueries({ queryKey: ["hr-internal-dash"] }); onClose(); setForm({ employeeId: "", type: "salary_cert", subject: "", body: "" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <AdaptiveDialog open={open} onOpenChange={onClose}>
      <AdaptiveDialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />طلب موظف جديد
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3 mobile-single-col">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الموظف *</Label>
              <Select value={form.employeeId} onValueChange={v => upd("employeeId", v)}>
                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نوع الطلب</Label>
              <Select value={form.type} onValueChange={v => upd("type", v)}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-3.5 w-3.5" />
                      {typeConfig.label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map(t => {
                    const Icon = t.icon;
                    return <SelectItem key={t.value} value={t.value}><div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{t.label}</div></SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">الموضوع *</Label>
            <Input value={form.subject} onChange={e => upd("subject", e.target.value)} placeholder="موضوع الطلب..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">التفاصيل</Label>
            <Textarea value={form.body} onChange={e => upd("body", e.target.value)} placeholder="تفاصيل إضافية..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.employeeId || !form.subject || mut.isPending}>
            {mut.isPending ? "جارٍ الإرسال..." : "إرسال الطلب"}
          </Button>
        </DialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ══════════════════════════════════════════════ RESPOND DIALOG */
function RespondDialog({ open, onClose, request }: { open: boolean; onClose: () => void; request: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState("approved");
  const [response, setResponse] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`${BASE}/api/hr-internal/requests/${request.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, response }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => { toast({ title: "✅ تم تحديث الطلب" }); qc.invalidateQueries({ queryKey: ["emp-requests"] }); qc.invalidateQueries({ queryKey: ["hr-internal-dash"] }); onClose(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <AdaptiveDialog open={open} onOpenChange={onClose}>
      <AdaptiveDialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>الرد على الطلب</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <p className="font-semibold">{request?.subject}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{request?.employee_name}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">الإجراء</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved"><span className="text-emerald-400">موافقة ✓</span></SelectItem>
                <SelectItem value="rejected"><span className="text-red-400">رفض ✗</span></SelectItem>
                <SelectItem value="done"><span className="text-blue-400">منجز ✓✓</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">ملاحظة (اختياري)</Label>
            <Textarea value={response} onChange={e => setResponse(e.target.value)} placeholder="ملاحظة الرد..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ══════════════════════════════════════════════ MAIN */
export default function HRSystems() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("announcements");
  const [annDialog, setAnnDialog] = useState(false);
  const [reqDialog, setReqDialog] = useState(false);
  const [respondTarget, setRespondTarget] = useState<any>(null);
  const [payslipTarget, setPayslipTarget] = useState<any>(null);
  const [balYear, setBalYear] = useState(String(new Date().getFullYear()));

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["hr-employees-list"],
    queryFn: () => authFetch(`${BASE}/api/hr/employees`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });
  const activeEmps = employees.filter((e: any) => e.status === "active");

  const { data: dash } = useQuery<any>({
    queryKey: ["hr-internal-dash"],
    queryFn: () => authFetch(`${BASE}/api/hr-internal/dashboard`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: announcements = [], isLoading: annLoading } = useQuery<any[]>({
    queryKey: ["announcements"],
    queryFn: () => authFetch(`${BASE}/api/hr-internal/announcements/all`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: requests = [], isLoading: reqLoading } = useQuery<any[]>({
    queryKey: ["emp-requests"],
    queryFn: () => authFetch(`${BASE}/api/hr-internal/requests`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: balances = [], isLoading: balLoading } = useQuery<any[]>({
    queryKey: ["leave-balances", balYear],
    queryFn: () => authFetch(`${BASE}/api/hr-internal/leave-balances?year=${balYear}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: payrollList = [] } = useQuery<any[]>({
    queryKey: ["payroll"],
    queryFn: () => authFetch(`${BASE}/api/hr/payroll`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const delAnn = useMutation({
    mutationFn: (id: number) => authFetch(`${BASE}/api/hr-internal/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast({ title: "تم الحذف" }); },
  });

  const delReq = useMutation({
    mutationFn: (id: number) => authFetch(`${BASE}/api/hr-internal/requests/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["emp-requests"] }); toast({ title: "تم الحذف" }); },
  });

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            الأنظمة الداخلية للموظفين
          </h1>
          <p className="text-muted-foreground text-sm mt-1">الإعلانات · الطلبات · أرصدة الإجازات · كشوف الرواتب</p>
        </div>
        <div className="flex gap-2">
          {tab === "requests" && (
            <Button size="sm" onClick={() => setReqDialog(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />طلب جديد
            </Button>
          )}
          {tab === "announcements" && (
            <Button size="sm" onClick={() => setAnnDialog(true)} className="gap-1.5">
              <Megaphone className="h-3.5 w-3.5" />إعلان جديد
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إعلانات نشطة",    value: dash?.announcements ?? 0,    icon: Megaphone,     color: "#6366F1" },
          { label: "طلبات معلّقة",    value: dash?.pendingRequests ?? 0,  icon: Clock,          color: "#F59E0B" },
          { label: "إجازات معلّقة",   value: dash?.pendingLeaves ?? 0,    icon: CalendarDays,   color: "#EF4444" },
          { label: "موظفون نشطون",    value: dash?.totalEmployees ?? activeEmps.length, icon: Users, color: "#10B981" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-border/50 bg-card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c.color}15` }}>
              <c.icon className="h-4.5 w-4.5" style={{ color: c.color }} />
            </div>
            <div>
              <div className="text-xl font-bold">{c.value}</div>
              <div className="text-[10px] text-muted-foreground">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto p-1 bg-muted/50 rounded-xl gap-0.5">
          <TabsTrigger value="announcements" className="text-xs gap-1.5"><Megaphone className="h-3.5 w-3.5" />الإعلانات</TabsTrigger>
          <TabsTrigger value="requests" className="text-xs gap-1.5">
            <Send className="h-3.5 w-3.5" />الطلبات
            {(dash?.pendingRequests ?? 0) > 0 && <span className="w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">{dash.pendingRequests}</span>}
          </TabsTrigger>
          <TabsTrigger value="balances" className="text-xs gap-1.5"><CalendarDays className="h-3.5 w-3.5" />أرصدة الإجازات</TabsTrigger>
          <TabsTrigger value="payslips" className="text-xs gap-1.5"><Printer className="h-3.5 w-3.5" />كشوف الرواتب</TabsTrigger>
        </TabsList>

        {/* ══ ANNOUNCEMENTS ══ */}
        <TabsContent value="announcements" className="mt-4 space-y-3">
          {annLoading ? Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl" />) :
           announcements.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/50 py-20 text-center">
              <Megaphone className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">لا توجد إعلانات بعد</p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => setAnnDialog(true)}><Plus className="h-3.5 w-3.5" />أضف أول إعلان</Button>
            </div>
          ) : announcements.map(ann => {
            const pc = PRIORITY_CONFIG[ann.priority] ?? PRIORITY_CONFIG.normal;
            const Icon = pc.icon;
            const expired = ann.expires_at && new Date(ann.expires_at) < new Date();
            return (
              <div key={ann.id} className={`rounded-xl border p-4 ${expired ? "opacity-50" : ""} ${pc.bg}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <Icon className={`h-4.5 w-4.5 ${pc.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{ann.title}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${pc.color} border-current/30`}>{pc.label}</Badge>
                        {ann.target_dept && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{ann.target_dept}</Badge>}
                        {expired && <Badge variant="outline" className="text-[10px] text-muted-foreground">منتهي</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{ann.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {ann.author_name && <span className="ms-3">بواسطة: {ann.author_name}</span>}
                        {fmtDate(ann.created_at)}
                        {ann.expires_at && <span className="me-3"> • ينتهي: {fmtDate(ann.expires_at)}</span>}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => delAnn.mutate(ann.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* ══ REQUESTS ══ */}
        <TabsContent value="requests" className="mt-4 space-y-3">
          {reqLoading ? Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-16 rounded-xl" />) :
           requests.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/50 py-16 text-center">
              <Send className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">لا توجد طلبات</p>
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm w-full">
                  <thead className="bg-muted/30 border-b border-border/50">
                    <tr>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold">الموظف</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold hidden sm:table-cell">النوع</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold">الموضوع</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold">الحالة</th>
                      <th className="w-[44px]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {requests.map((req: any) => {
                      const sc = REQUEST_STATUS[req.status] ?? REQUEST_STATUS.pending;
                      const tc = REQUEST_TYPES.find(t => t.value === req.type) ?? REQUEST_TYPES[6];
                      const Icon = tc.icon;
                      return (
                        <tr key={req.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-xs">{req.employee_name}</p>
                            <p className="text-[10px] text-muted-foreground">{fmtDate(req.created_at)}</p>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Icon className="h-3.5 w-3.5" />{tc.label}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs max-w-[180px]">
                            <p className="truncate">{req.subject}</p>
                            {req.response && <p className="text-[10px] text-muted-foreground truncate mt-0.5">↳ {req.response}</p>}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className={`text-[10px] ${sc.bg} ${sc.color}`}>{sc.label}</Badge>
                          </td>
                          <td className="px-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {req.status === "pending" && (
                                  <DropdownMenuItem onClick={() => setRespondTarget(req)}>
                                    <CheckCircle2 className="h-4 w-4 ms-2" />الرد على الطلب
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => delReq.mutate(req.id)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="h-4 w-4 ms-2" />حذف
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ LEAVE BALANCES ══ */}
        <TabsContent value="balances" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-xs font-semibold shrink-0">سنة الرصيد:</Label>
            <Input
              type="number" value={balYear}
              onChange={e => setBalYear(e.target.value)}
              className="w-24 h-8 text-xs"
            />
            <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["leave-balances", balYear] })} className="h-8 gap-1">
              <RefreshCw className="h-3.5 w-3.5" />حساب
            </Button>
          </div>

          {balLoading ? Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-20 rounded-xl" />) :
           balances.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">لا يوجد موظفون نشطون</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {balances.map((emp: any) => (
                <div key={emp.employeeId} className="rounded-xl border border-border/50 bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-black text-primary">
                      {emp.employeeName?.split(" ").map((w: string) => w[0]).slice(0,2).join("")}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{emp.employeeName}</p>
                      <p className="text-[10px] text-muted-foreground">{emp.jobTitle}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(emp.balances ?? []).map((b: any) => {
                      const lt = LEAVE_TYPES[b.type] ?? LEAVE_TYPES.annual;
                      const pct = b.quota > 0 ? (b.used / b.quota) * 100 : 0;
                      const Icon = lt.icon;
                      return (
                        <div key={b.type}>
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Icon className="h-3.5 w-3.5" style={{ color: lt.color }} />
                              <span>{lt.label}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              <span className="text-red-400 font-semibold">{b.used}</span>
                              <span> / {b.quota} يوم —  </span>
                              <span className="text-emerald-400 font-semibold">متبقٍّ: {b.remaining}</span>
                            </div>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══ PAYSLIPS ══ */}
        <TabsContent value="payslips" className="mt-4 space-y-4">
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-2">
            <Printer className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">اضغط على أي كشف راتب لمعاينته وطباعته كـ PDF</p>
          </div>

          {payrollList.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/50 py-16 text-center">
              <Printer className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">لا توجد قسائم رواتب — اذهب إلى صفحة الرواتب لتوليدها</p>
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm w-full">
                  <thead className="bg-muted/30 border-b border-border/50">
                    <tr>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold">الموظف</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold">الشهر / السنة</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold">الصافي</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold">الحالة</th>
                      <th className="w-[80px]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {payrollList.map((p: any) => (
                      <tr key={p.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setPayslipTarget(p)}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-xs">{p.employeeName}</p>
                          <p className="text-[10px] text-muted-foreground">{p.jobTitle}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.month} {p.year}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-bold text-primary">{parseFloat(String(p.netSalary || "0")).toLocaleString("ar-SA", { maximumFractionDigits: 0 })}</span>
                          <span className="text-[10px] text-muted-foreground me-1">ر.س</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {p.status === "paid"
                            ? <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">مدفوع</Badge>
                            : <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-500/30">مسودة</Badge>}
                        </td>
                        <td className="px-3">
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={e => { e.stopPropagation(); setPayslipTarget(p); }}>
                            <Printer className="h-3.5 w-3.5" />طباعة
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AnnouncementDialog open={annDialog} onClose={() => setAnnDialog(false)} />
      <RequestDialog open={reqDialog} onClose={() => setReqDialog(false)} employees={activeEmps} />
      {respondTarget && <RespondDialog open onClose={() => setRespondTarget(null)} request={respondTarget} />}
      {payslipTarget && <PayslipModal payroll={payslipTarget} onClose={() => setPayslipTarget(null)} />}
    </div>
  );
}
