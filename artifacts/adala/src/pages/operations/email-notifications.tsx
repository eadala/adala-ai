import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Mail, Settings, Send, CheckCircle2, XCircle, Loader2,
  Bell, AlertTriangle, Clock, FileText, CreditCard, PlayCircle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const TRIGGER_ITEMS = [
  { key: "invoice_due",      icon: CreditCard, label: "فاتورة تقترب موعد سدادها",    desc: "إشعار قبل 3 أيام من تاريخ الاستحقاق" },
  { key: "case_session",     icon: FileText,   label: "جلسة قضائية قادمة",            desc: "إشعار قبل يوم من موعد الجلسة" },
  { key: "reminder_due",     icon: Bell,       label: "تذكير يحين موعده",             desc: "إشعار عند حلول موعد التذكير" },
  { key: "overdue_invoice",  icon: AlertTriangle, label: "فاتورة متأخرة",            desc: "إشعار عند تجاوز تاريخ الاستحقاق" },
  { key: "contract_expiry",  icon: Clock,      label: "عقد يقترب من انتهائه",         desc: "إشعار قبل 7 أيام من انتهاء العقد" },
];

export default function EmailNotificationsPage() {
  const qc = useQueryClient();
  const [testEmail, setTestEmail] = useState("");
  const [form, setForm] = useState<any>({
    enabled: false, smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "",
    fromName: "عدالة AI", fromEmail: "", triggers: {},
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["email-notif-settings"],
    queryFn: () => fetch(`${BASE}/api/email-notifications/settings`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ["email-notif-logs"],
    queryFn: () => fetch(`${BASE}/api/email-notifications/logs`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: settings.enabled ?? false,
        smtpHost: settings.smtp_host ?? "",
        smtpPort: String(settings.smtp_port ?? "587"),
        smtpUser: settings.smtp_user ?? "",
        smtpPass: settings.smtp_pass ?? "",
        fromName: settings.from_name ?? "عدالة AI",
        fromEmail: settings.from_email ?? "",
        triggers: settings.triggers ?? {},
      });
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/email-notifications/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, smtpPort: parseInt(form.smtpPort) || 587 }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-notif-settings"] }); toast.success("تم حفظ الإعدادات"); },
    onError: () => toast.error("حدث خطأ في الحفظ"),
  });

  const testMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/email-notifications/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      if (d.error) toast.error(d.error);
      else { qc.invalidateQueries({ queryKey: ["email-notif-logs"] }); toast.success(d.message ?? "تم الإرسال"); }
    },
    onError: () => toast.error("فشل الإرسال"),
  });

  const runNowMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/email-notifications/run-now`, { method: "POST" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      if (d.error) toast.error(d.error);
      else {
        qc.invalidateQueries({ queryKey: ["email-notif-logs"] });
        toast.success(`تم التشغيل — فواتير: ${d.invoices ?? 0} · جلسات: ${d.sessions ?? 0} · تذكيرات: ${d.reminders ?? 0}`);
      }
    },
    onError: () => toast.error("فشل التشغيل"),
  });

  function setF(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
  function toggleTrigger(key: string) {
    setForm((f: any) => ({ ...f, triggers: { ...f.triggers, [key]: !f.triggers[key] } }));
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin ml-2" /> جارٍ التحميل...
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Mail className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">إشعارات البريد الإلكتروني</h1>
          <p className="text-xs text-muted-foreground">إعداد وإدارة الإشعارات التلقائية عبر البريد</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* SMTP Settings */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> إعدادات SMTP</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{form.enabled ? "مُفعَّل" : "معطَّل"}</span>
                <Switch checked={form.enabled} onCheckedChange={v => setF("enabled", v)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">خادم SMTP</Label>
                <Input value={form.smtpHost} onChange={e => setF("smtpHost", e.target.value)} placeholder="smtp.gmail.com" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">المنفذ</Label>
                <Input value={form.smtpPort} onChange={e => setF("smtpPort", e.target.value)} placeholder="587" className="mt-1 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">اسم المستخدم</Label>
              <Input value={form.smtpUser} onChange={e => setF("smtpUser", e.target.value)} placeholder="user@gmail.com" className="mt-1 text-sm" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">كلمة المرور / App Password</Label>
              <Input type="password" value={form.smtpPass} onChange={e => setF("smtpPass", e.target.value)} placeholder="••••••••" className="mt-1 text-sm" dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">اسم المُرسِل</Label>
                <Input value={form.fromName} onChange={e => setF("fromName", e.target.value)} placeholder="عدالة AI" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">بريد المُرسِل</Label>
                <Input value={form.fromEmail} onChange={e => setF("fromEmail", e.target.value)} placeholder="no-reply@..." className="mt-1 text-sm" dir="ltr" />
              </div>
            </div>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full bg-primary hover:bg-[#b8943f] text-black font-bold mt-1">
              {saveMut.isPending && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
              حفظ الإعدادات
            </Button>
          </CardContent>
        </Card>

        {/* Triggers */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> الإشعارات التلقائية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {TRIGGER_ITEMS.map(t => (
              <div key={t.key} className="flex items-start justify-between gap-3 py-1">
                <div className="flex items-start gap-2">
                  <t.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
                <Switch checked={!!form.triggers[t.key]} onCheckedChange={() => toggleTrigger(t.key)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Test + Run Now */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> اختبار الإرسال</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="أدخل بريد الاختبار..."
                className="flex-1"
                dir="ltr"
              />
              <Button onClick={() => testMut.mutate()} disabled={testMut.isPending || !testEmail} variant="outline">
                {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                إرسال
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><PlayCircle className="h-4 w-4 text-primary" /> تشغيل الإشعارات الآن</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              يفحص الفواتير المستحقة خلال 3 أيام، وجلسات الغد، والتذكيرات المستحقة اليوم — ويُرسل الإشعارات الإلكترونية فوراً.
            </p>
            <Button
              onClick={() => runNowMut.mutate()}
              disabled={runNowMut.isPending || !form.enabled}
              className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
              variant="outline"
            >
              {runNowMut.isPending
                ? <><Loader2 className="h-4 w-4 ml-1 animate-spin" /> جارٍ الفحص والإرسال...</>
                : <><RefreshCw className="h-4 w-4 ml-1" /> تشغيل الآن</>}
            </Button>
            {!form.enabled && (
              <p className="text-[11px] text-muted-foreground mt-2 text-center">فعّل الإشعارات أولاً لتتمكن من التشغيل</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">سجل الإرسال</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.slice(0, 20).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    {log.status === "sent"
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                      : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span className="text-muted-foreground text-xs" dir="ltr">{log.recipient}</span>
                    <span className="text-foreground">{log.subject}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={log.status === "sent" ? "border-green-500/30 text-green-400 text-[10px]" : "border-red-500/30 text-red-400 text-[10px]"}>
                      {log.status === "sent" ? "مُرسَل" : "فشل"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(log.sent_at).toLocaleDateString("ar-SA")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
