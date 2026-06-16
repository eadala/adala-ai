import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send, Settings, Bell, HardDrive, FileText,
  CheckCircle2, XCircle, RefreshCw, Bot, Hash, Info,
  MessageCircle, Archive,
} from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.088 13.67l-2.95-.924c-.642-.204-.657-.642.136-.953l11.57-4.461c.537-.194 1.006.131.834.95z" />
    </svg>
  );
}

export default function TelegramSettings() {
  const qc = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data: settings = {} as any, isLoading } = useQuery({
    queryKey: ["telegram-settings"],
    queryFn: () => fetch(`${BASE}/api/telegram/settings`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  useEffect(() => {
    if (settings && !dirty) {
      setBotToken((settings as any).bot_token ?? "");
      setChatId((settings as any).chat_id ?? "");
    }
  }, [settings]);

  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ["telegram-logs"],
    queryFn: () => fetch(`${BASE}/api/telegram/logs`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    refetchInterval: 10_000,
  });

  const { data: botInfo } = useQuery({
    queryKey: ["telegram-bot-info"],
    queryFn: () => fetch(`${BASE}/api/telegram/bot-info`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled: !!settings?.bot_token,
    staleTime: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (body: any) =>
      fetch(`${BASE}/api/telegram/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      qc.invalidateQueries({ queryKey: ["telegram-settings"] });
      qc.invalidateQueries({ queryKey: ["telegram-bot-info"] });
      setDirty(false);
    },
    onError: () => toast.error("فشل الحفظ"),
  });

  const testMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/telegram/test`, { method: "POST" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d: any) => {
      if (d.ok) toast.success("✅ وصلت رسالة الاختبار إلى تليجرام!");
      else toast.error(`فشل: ${d.error ?? "خطأ غير معروف"}`);
      qc.invalidateQueries({ queryKey: ["telegram-logs"] });
    },
  });

  function handleToggle(field: string, value: boolean) {
    saveMut.mutate({ ...settings, botToken: settings.bot_token, chatId: settings.chat_id, [field]: value });
  }

  function handleSave() {
    saveMut.mutate({
      enabled: settings.enabled ?? false,
      botToken,
      chatId,
      notifyCases:     settings.notify_cases     ?? true,
      notifyInvoices:  settings.notify_invoices  ?? true,
      notifyReminders: settings.notify_reminders ?? true,
      useAsStorage:    settings.use_as_storage   ?? false,
    });
  }

  const statusBadge = settings?.enabled
    ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" /> مفعّل</Badge>
    : <Badge variant="outline" className="gap-1 text-muted-foreground"><XCircle className="h-3 w-3" /> غير مفعّل</Badge>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#229ED9]/15 flex items-center justify-center">
            <TelegramIcon className="h-5 w-5 text-[#229ED9]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">تكامل تليجرام</h1>
            <p className="text-sm text-muted-foreground">إشعارات مجانية + تخزين مفتوح عبر Telegram Bot</p>
          </div>
        </div>
        {!isLoading && statusBadge}
      </div>

      <Tabs defaultValue="setup" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="setup" className="gap-1.5 text-xs"><Settings className="h-3.5 w-3.5" /> الإعداد</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" /> الإشعارات</TabsTrigger>
          <TabsTrigger value="storage" className="gap-1.5 text-xs"><HardDrive className="h-3.5 w-3.5" /> التخزين</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> السجل</TabsTrigger>
        </TabsList>

        {/* ── Setup Tab ── */}
        <TabsContent value="setup" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#229ED9]" /> بيانات البوت
              </CardTitle>
              <CardDescription>احصل على Bot Token من <span className="font-mono text-xs bg-muted px-1 rounded">@BotFather</span> على تليجرام</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Bot Token</Label>
                <Input
                  dir="ltr"
                  placeholder="1234567890:AAF..."
                  value={botToken}
                  onChange={e => { setBotToken(e.target.value); setDirty(true); }}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Chat ID</Label>
                <Input
                  dir="ltr"
                  placeholder="-1001234567890"
                  value={chatId}
                  onChange={e => { setChatId(e.target.value); setDirty(true); }}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">للمجموعات: أضف البوت → أرسل رسالة → افتح <span className="font-mono">api.telegram.org/bot{"<TOKEN>"}/getUpdates</span></p>
              </div>

              {/* Bot info card */}
              {botInfo?.ok && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#229ED9]/10 border border-[#229ED9]/20">
                  <div className="h-9 w-9 rounded-full bg-[#229ED9]/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-[#229ED9]" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{botInfo.result?.first_name}</p>
                    <p className="text-xs text-muted-foreground">@{botInfo.result?.username}</p>
                  </div>
                  <Badge className="mr-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">متصل ✓</Badge>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">تفعيل تليجرام</p>
                  <p className="text-xs text-muted-foreground">تشغيل الإشعارات والتخزين</p>
                </div>
                <Switch
                  checked={settings?.enabled ?? false}
                  onCheckedChange={v => {
                    saveMut.mutate({ ...settings, botToken, chatId, enabled: v });
                  }}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saveMut.isPending || !dirty} className="flex-1">
                  {saveMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin ml-2" /> : null}
                  حفظ الإعدادات
                </Button>
                <Button
                  variant="outline"
                  onClick={() => testMut.mutate()}
                  disabled={testMut.isPending || !settings?.bot_token}
                >
                  {testMut.isPending
                    ? <RefreshCw className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                  <span className="mr-1.5">اختبار</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* How-to guide */}
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4 text-blue-400" /> كيفية الإعداد</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>افتح تليجرام وابحث عن <span className="font-mono text-xs bg-muted px-1 rounded">@BotFather</span></li>
                <li>أرسل <span className="font-mono text-xs bg-muted px-1 rounded">/newbot</span> واختر اسماً للبوت</li>
                <li>انسخ الـ <b>Bot Token</b> وضعه في الحقل أعلاه</li>
                <li>أضف البوت لمجموعتك أو قناتك كـ Admin</li>
                <li>احصل على Chat ID عبر <span className="font-mono text-xs bg-muted px-1 rounded">getUpdates</span></li>
                <li>اضغط <b>اختبار</b> للتأكد من الربط</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notifications Tab ── */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-400" /> إشعارات تلقائية
              </CardTitle>
              <CardDescription>اختر ما تريد إرساله تلقائياً لقناة تليجرام</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { field: "notify_cases",     key: "notifyCases",     label: "تحديثات القضايا",    desc: "عند تغيير حالة القضية",      icon: <MessageCircle className="h-4 w-4 text-blue-400" /> },
                { field: "notify_invoices",  key: "notifyInvoices",  label: "تذكيرات الفواتير",   desc: "عند اقتراب موعد استحقاق فاتورة", icon: <FileText className="h-4 w-4 text-emerald-400" /> },
                { field: "notify_reminders", key: "notifyReminders", label: "التذكيرات والمواعيد", desc: "تذكيرات المكتب اليومية",       icon: <Bell className="h-4 w-4 text-amber-400" /> },
              ].map(item => (
                <div key={item.field} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.[item.field] ?? true}
                    onCheckedChange={v => handleToggle(item.key, v)}
                    disabled={!settings?.enabled}
                  />
                </div>
              ))}
              {!settings?.enabled && (
                <p className="text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
                  ⚠️ فعّل تليجرام أولاً من تبويب الإعداد لتشغيل الإشعارات
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Storage Tab ── */}
        <TabsContent value="storage" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Archive className="h-4 w-4 text-violet-400" /> تليجرام كقاعدة تخزين
              </CardTitle>
              <CardDescription>استخدم قناة تليجرام الخاصة بالمكتب كتخزين سحابي مجاني وغير محدود</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "مجاني 100%", value: "بدون رسوم", icon: "💰" },
                  { label: "حد الملف",   value: "2 GB",      icon: "📁" },
                  { label: "التخزين",    value: "غير محدود", icon: "☁️" },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-muted/50 text-center space-y-1">
                    <p className="text-2xl">{s.icon}</p>
                    <p className="text-sm font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">تفعيل التخزين عبر تليجرام</p>
                  <p className="text-xs text-muted-foreground">إرسال نسخة من كل ملف مرفوع إلى القناة</p>
                </div>
                <Switch
                  checked={settings?.use_as_storage ?? false}
                  onCheckedChange={v => handleToggle("useAsStorage", v)}
                  disabled={!settings?.enabled}
                />
              </div>

              <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-sm space-y-1">
                <p className="font-medium text-violet-400">كيف يعمل؟</p>
                <p className="text-xs text-muted-foreground">عند رفع أي ملف على المنصة (وثائق، مرفقات، صور...)، يُرسَل تلقائياً نسخة إلى قناة تليجرام ويُحفظ الـ file_id في قاعدة البيانات للرجوع إليه لاحقاً.</p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    fetch(`${BASE}/api/telegram/forward-file`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ fileUrl: "https://telegram.org/img/t_logo.png", fileName: "اختبار_تخزين.png", caption: "🧪 اختبار التخزين عبر تليجرام من عدالة AI" }),
                    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }).then(d => {
                      if (d.ok) toast.success("✅ تم إرسال ملف الاختبار للقناة!");
                      else toast.error(`فشل: ${d.error}`);
                    });
                  }}
                  disabled={!settings?.use_as_storage || !settings?.enabled}
                >
                  <HardDrive className="h-4 w-4 ml-1.5" />
                  اختبار رفع ملف
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs Tab ── */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> سجل الرسائل
                <Badge variant="secondary" className="mr-auto">{logs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  لا توجد رسائل بعد — ابدأ بإرسال رسالة اختبار
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {logs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 text-sm">
                      <div className="mt-0.5 shrink-0">
                        {log.status === "sent"
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          : <XCircle className="h-4 w-4 text-red-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className="text-xs py-0 h-4">{log.type}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(log.sent_at).toLocaleString("ar-EG")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{log.message?.slice(0, 80)}</p>
                        {log.error && <p className="text-xs text-red-400 mt-0.5">{log.error}</p>}
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
