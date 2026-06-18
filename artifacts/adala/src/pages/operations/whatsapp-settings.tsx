import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare, Settings, Send, CheckCircle2, XCircle,
  Loader2, Phone, Key, Copy, Clock,
} from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const TEMPLATES = [
  { key: "invoice",      label: "إشعار فاتورة",       vars: ["{name}", "{invoice_number}", "{amount}", "{due_date}", "{link}"] },
  { key: "case_update",  label: "تحديث القضية",        vars: ["{name}", "{case_number}", "{status}"] },
  { key: "appointment",  label: "تذكير موعد",           vars: ["{name}", "{date}", "{time}", "{office_name}"] },
  { key: "welcome",      label: "ترحيب بعميل جديد",    vars: ["{name}", "{office_name}"] },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") return <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />مُرسَلة</Badge>;
  return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs gap-1"><XCircle className="h-3 w-3" />فشل</Badge>;
}

export default function WhatsAppSettingsPage() {
  const qc = useQueryClient();
  const [testPhone, setTestPhone] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [form, setForm] = useState({
    enabled: false,
    provider: "twilio",
    accountSid: "",
    authToken: "",
    fromNumber: "",
    metaToken: "",
    metaPhoneId: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["whatsapp-settings"],
    queryFn: () => fetch(`${BASE}/api/whatsapp/settings`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ["whatsapp-logs"],
    queryFn: () => fetch(`${BASE}/api/whatsapp/logs`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    refetchInterval: 10000,
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["whatsapp-templates"],
    queryFn: () => fetch(`${BASE}/api/whatsapp/templates`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: settings.enabled ?? false,
        provider: settings.provider ?? "twilio",
        accountSid: settings.account_sid ?? "",
        authToken: settings.auth_token ?? "",
        fromNumber: settings.from_number ?? "",
        metaToken: settings.meta_token ?? "",
        metaPhoneId: settings.meta_phone_id ?? "",
      });
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/whatsapp/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      if (d.error) { toast.error(d.error); return; }
      qc.invalidateQueries({ queryKey: ["whatsapp-settings"] });
      toast.success("تم حفظ إعدادات واتساب ✅");
    },
    onError: () => toast.error("حدث خطأ في الحفظ"),
  });

  const testMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/whatsapp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testPhone }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-logs"] });
      if (d.ok) toast.success("تم إرسال رسالة الاختبار بنجاح ✅");
      else toast.error(d.error ?? "فشل الإرسال");
    },
    onError: () => toast.error("فشل الإرسال"),
  });

  const sendCustomMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: customTo, message: customMsg, template: "custom" }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-logs"] });
      if (d.ok) { toast.success("تم الإرسال بنجاح ✅"); setCustomMsg(""); setCustomTo(""); }
      else toast.error(d.error ?? "فشل الإرسال");
    },
    onError: () => toast.error("فشل الإرسال"),
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">تكامل واتساب</h1>
          <p className="text-muted-foreground text-sm">تواصل مع عملائك عبر واتساب مباشرةً من المنصة</p>
        </div>
        <div className="mr-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{form.enabled ? "مفعّل" : "معطّل"}</span>
          <Switch
            checked={form.enabled}
            onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))}
          />
        </div>
      </div>

      <Tabs defaultValue="settings" dir="rtl">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="settings"><Settings className="h-4 w-4 ms-1.5" />الإعدادات</TabsTrigger>
          <TabsTrigger value="send"><Send className="h-4 w-4 ms-1.5" />إرسال رسالة</TabsTrigger>
          <TabsTrigger value="logs"><Clock className="h-4 w-4 ms-1.5" />السجل</TabsTrigger>
        </TabsList>

        {/* ── Settings Tab ── */}
        <TabsContent value="settings" className="space-y-5 mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />اختيار المزوّد وبيانات الاعتماد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Provider selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setForm(f => ({ ...f, provider: "twilio" }))}
                  className={`p-4 rounded-xl border-2 text-right transition-all ${form.provider === "twilio" ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}
                >
                  <div className="font-semibold text-sm">Twilio</div>
                  <div className="text-xs text-muted-foreground mt-0.5">واجهة برمجية موثوقة</div>
                </button>
                <button
                  onClick={() => setForm(f => ({ ...f, provider: "meta" }))}
                  className={`p-4 rounded-xl border-2 text-right transition-all ${form.provider === "meta" ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}
                >
                  <div className="font-semibold text-sm">Meta Cloud API</div>
                  <div className="text-xs text-muted-foreground mt-0.5">واجهة Meta الرسمية</div>
                </button>
              </div>

              {form.provider === "twilio" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Account SID</Label>
                    <Input dir="ltr" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={form.accountSid} onChange={e => setForm(f => ({ ...f, accountSid: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Auth Token</Label>
                    <Input dir="ltr" type="password" placeholder="••••••••"
                      value={form.authToken} onChange={e => setForm(f => ({ ...f, authToken: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>رقم واتساب (من Twilio)</Label>
                    <Input dir="ltr" placeholder="+14155552671"
                      value={form.fromNumber} onChange={e => setForm(f => ({ ...f, fromNumber: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Meta Access Token</Label>
                    <Input dir="ltr" type="password" placeholder="EAAxxxxxxxxxx..."
                      value={form.metaToken} onChange={e => setForm(f => ({ ...f, metaToken: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number ID</Label>
                    <Input dir="ltr" placeholder="1234567890"
                      value={form.metaPhoneId} onChange={e => setForm(f => ({ ...f, metaPhoneId: e.target.value }))} />
                  </div>
                </div>
              )}

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || isLoading}
              >
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin ms-2" /> : <Settings className="h-4 w-4 ms-2" />}
                حفظ الإعدادات
              </Button>
            </CardContent>
          </Card>

          {/* Test send */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-400" />إرسال رسالة اختبار
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input type="tel" dir="ltr" placeholder="+966501234567 أو 0501234567"
                  value={testPhone} onChange={e => setTestPhone(e.target.value)} />
              </div>
              <Button
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => testMut.mutate()}
                disabled={!testPhone || testMut.isPending}
              >
                {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                إرسال رسالة اختبار
              </Button>
            </CardContent>
          </Card>

          {/* Templates display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Copy className="h-4 w-4 text-primary" />قوالب الرسائل الجاهزة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.map((t: any) => (
                <div key={t.key} className="border border-border/40 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{t.label}</span>
                    <Badge variant="outline" className="text-xs font-mono">{t.key}</Badge>
                  </div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-2 font-sans leading-relaxed">{t.body}</pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Send Tab ── */}
        <TabsContent value="send" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-green-400" />إرسال رسالة مخصصة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input type="tel" dir="ltr" placeholder="+966501234567 أو 0501234567"
                  value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>نص الرسالة</Label>
                <Textarea
                  placeholder="اكتب الرسالة هنا..."
                  rows={5}
                  value={customMsg}
                  onChange={e => setCustomMsg(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{customMsg.length} / 4096 حرف</p>
              </div>
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => sendCustomMut.mutate()}
                disabled={!customTo || !customMsg || sendCustomMut.isPending || !form.enabled}
              >
                {sendCustomMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                إرسال الرسالة
              </Button>
              {!form.enabled && (
                <p className="text-xs text-amber-400 text-center">⚠️ يجب تفعيل الخدمة من تبويب الإعدادات أولاً</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs Tab ── */}
        <TabsContent value="logs" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                سجل الرسائل المُرسَلة
                <Badge variant="outline" className="mr-auto text-xs">{logs.length} رسالة</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  لا توجد رسائل مُرسَلة بعد
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {logs.map((log: any) => (
                    <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-mono text-primary">{log.to_number}</span>
                          {log.template && (
                            <Badge variant="outline" className="text-xs">{log.template}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{log.message}</p>
                        {log.error && <p className="text-xs text-red-400 mt-0.5">{log.error}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={log.status} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.sent_at).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
