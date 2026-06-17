import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, BellRing, BellOff, Mail, Smartphone, Layers,
  Scale, Users, Receipt, FileText, CheckCircle, AlertTriangle,
  Calendar, Zap, RotateCcw, Save, Send, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/* ── Event Catalogue ─────────────────────────────────────────────── */
const EVENT_GROUPS = [
  {
    id: "cases",
    label: "القضايا",
    icon: Scale,
    color: "#6366F1",
    bg: "#EEF2FF",
    events: [
      { type: "CASE_CREATED",  label: "قضية جديدة",      desc: "عند إنشاء قضية جديدة في النظام" },
      { type: "CASE_UPDATED",  label: "تحديث قضية",      desc: "عند تعديل بيانات أو حالة قضية" },
      { type: "CASE_CLOSED",   label: "إغلاق قضية",      desc: "عند إغلاق أو إنهاء قضية" },
      { type: "SESSION_REMINDER", label: "تذكير بجلسة",  desc: "قبل موعد الجلسة بوقت محدد" },
      { type: "TASK_DUE",      label: "مهمة مستحقة",     desc: "عند اقتراب موعد تسليم مهمة" },
    ],
  },
  {
    id: "clients",
    label: "العملاء",
    icon: Users,
    color: "#10B981",
    bg: "#D1FAE5",
    events: [
      { type: "CLIENT_ADDED", label: "عميل جديد", desc: "عند تسجيل عميل جديد في المكتب" },
    ],
  },
  {
    id: "finance",
    label: "المالية",
    icon: Receipt,
    color: "#F59E0B",
    bg: "#FEF3C7",
    events: [
      { type: "INVOICE_CREATED",  label: "فاتورة جديدة",  desc: "عند إنشاء فاتورة للعميل" },
      { type: "INVOICE_PAID",     label: "دفعة مستلمة",   desc: "عند تسجيل دفع فاتورة" },
      { type: "INVOICE_OVERDUE",  label: "فاتورة متأخرة", desc: "عند تجاوز فاتورة تاريخ الاستحقاق" },
      { type: "PAYMENT_SUCCESS",  label: "دفعة ناجحة",    desc: "عند نجاح معاملة دفع إلكتروني" },
      { type: "PAYMENT_FAILED",   label: "دفعة فاشلة",    desc: "عند فشل معاملة دفع إلكتروني" },
    ],
  },
  {
    id: "system",
    label: "النظام",
    icon: FileText,
    color: "#8B5CF6",
    bg: "#EDE9FE",
    events: [
      { type: "DOCUMENT_GENERATED", label: "وثيقة جاهزة",   desc: "عند إنشاء وثيقة أو عقد بواسطة AI" },
    ],
  },
];

type SettingRow = {
  event_type: string;
  push_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
};

type LocalSettings = Record<string, SettingRow>;

const ALL_TYPES = EVENT_GROUPS.flatMap(g => g.events.map(e => e.type));

function defaultSettings(): LocalSettings {
  const s: LocalSettings = {};
  for (const t of ALL_TYPES) {
    s[t] = { event_type: t, push_enabled: true, in_app_enabled: true, email_enabled: false };
  }
  return s;
}

/* ── Toggle Switch ───────────────────────────────────────────────── */
function Toggle({ on, onChange, color = "#2563EB", disabled = false }: {
  on: boolean; onChange: (v: boolean) => void; color?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40"
      style={{ background: on ? color : "#D1D5DB" }}
      aria-pressed={on}
    >
      <span className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200"
        style={{ transform: on ? "translateX(-20px)" : "translateX(0)" }} />
    </button>
  );
}

/* ── Channel Header ──────────────────────────────────────────────── */
function ChannelHead({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon className="w-4 h-4" style={{ color }} />
      <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════ */
export default function NotificationSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const push = usePushNotifications();
  const [local, setLocal] = useState<LocalSettings>(defaultSettings());
  const [dirty, setDirty] = useState(false);

  /* ── Load from server ── */
  const { data, isLoading } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: () => fetch(`${BASE}/api/notifications/settings`).then(r => r.json()),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!data?.settings) return;
    setLocal(prev => {
      const next = { ...defaultSettings() };
      for (const row of data.settings as SettingRow[]) {
        next[row.event_type] = { ...row };
      }
      return next;
    });
    setDirty(false);
  }, [data]);

  /* ── Save ── */
  const saveMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/notifications/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: Object.values(local) }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-settings"] });
      setDirty(false);
      toast({ title: "✅ تم الحفظ", description: "تم تحديث إعدادات الإشعارات بنجاح" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل حفظ الإعدادات", variant: "destructive" }),
  });

  function set(eventType: string, channel: keyof Omit<SettingRow, "event_type">, val: boolean) {
    setLocal(prev => ({ ...prev, [eventType]: { ...prev[eventType], [channel]: val } }));
    setDirty(true);
  }

  function enableAll() {
    const next = defaultSettings();
    for (const k of Object.keys(next)) {
      next[k] = { event_type: k, push_enabled: true, in_app_enabled: true, email_enabled: true };
    }
    setLocal(next); setDirty(true);
  }
  function disableAll() {
    const next = defaultSettings();
    for (const k of Object.keys(next)) {
      next[k] = { event_type: k, push_enabled: false, in_app_enabled: false, email_enabled: false };
    }
    setLocal(next); setDirty(true);
  }
  function resetDefaults() { setLocal(defaultSettings()); setDirty(true); }

  const CHANNELS: { key: keyof Omit<SettingRow,"event_type">; icon: any; label: string; color: string }[] = [
    { key: "push_enabled",   icon: Smartphone, label: "متصفح",    color: "#6366F1" },
    { key: "in_app_enabled", icon: Bell,       label: "داخلي",    color: "#2563EB" },
    { key: "email_enabled",  icon: Mail,       label: "بريد",     color: "#10B981" },
  ];

  return (
    <div dir="rtl" className="min-h-screen p-6" style={{ background: "#F8FAFC" }}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#2563EB" }}>
                <BellRing className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-foreground">إعدادات الإشعارات</h1>
                <p className="text-sm text-muted-foreground">خصّص الإشعارات التي تصلك لكل حدث وقناة</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={resetDefaults} className="gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> إعادة الضبط
            </Button>
            <Button variant="outline" size="sm" onClick={disableAll} className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50">
              <BellOff className="w-3.5 h-3.5" /> تعطيل الكل
            </Button>
            <Button variant="outline" size="sm" onClick={enableAll} className="gap-1.5 text-xs text-green-600 border-green-200 hover:bg-green-50">
              <Bell className="w-3.5 h-3.5" /> تفعيل الكل
            </Button>
            <Button
              size="sm"
              disabled={!dirty || saveMut.isPending}
              onClick={() => saveMut.mutate()}
              className="gap-1.5 text-xs"
              style={{ background: dirty ? "#2563EB" : undefined }}
            >
              <Save className="w-3.5 h-3.5" />
              {saveMut.isPending ? "جارٍ الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </div>

        {/* ── Push permission card ── */}
        <div className="rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: push.state === "subscribed" ? "#D1FAE5" : "#EFF6FF",
                   border: `1px solid ${push.state === "subscribed" ? "#A7F3D0" : "#BFDBFE"}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: push.state === "subscribed" ? "#10B981" : "#2563EB" }}>
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: push.state === "subscribed" ? "#065F46" : "#1E3A8A" }}>
                {push.state === "subscribed" ? "إشعارات المتصفح مفعّلة" :
                 push.state === "denied"     ? "إشعارات المتصفح محظورة" :
                 "تفعيل إشعارات المتصفح"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: push.state === "subscribed" ? "#047857" : "#1D4ED8" }}>
                {push.state === "subscribed"
                  ? "ستصلك الإشعارات حتى لو كان المتصفح مغلقاً"
                  : push.state === "denied"
                  ? "غيّر إعدادات المتصفح لإعادة التفعيل"
                  : "اضغط لتلقي الإشعارات على المتصفح حتى لو كان مغلقاً"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {push.state === "subscribed" && (
              <Button variant="outline" size="sm" className="text-xs gap-1.5"
                onClick={() => push.sendTest()}>
                <Send className="w-3.5 h-3.5" /> إرسال تجريبي
              </Button>
            )}
            {push.state !== "denied" && (
              <Button size="sm" className="text-xs gap-1.5"
                disabled={push.state === "loading"}
                style={{ background: push.state === "subscribed" ? "#EF4444" : "#2563EB" }}
                onClick={() => push.state === "subscribed" ? push.unsubscribe() : push.subscribe()}>
                {push.state === "subscribed" ? <><BellOff className="w-3.5 h-3.5" /> إيقاف</> :
                 push.state === "loading"    ? "جارٍ..." :
                                               <><BellRing className="w-3.5 h-3.5" /> تفعيل</>}
              </Button>
            )}
          </div>
        </div>

        {/* ── Info banner ── */}
        <div className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#2563EB" }} />
          <p className="text-xs leading-relaxed text-blue-800">
            الإعدادات هنا تنطبق على مكتبك فقط. كل مكتب له إعداداته المستقلة.
            عمود <strong>متصفح</strong> يرسل إشعار حتى لو المتصفح مغلق.
            عمود <strong>داخلي</strong> يظهر في لوحة الجرس داخل التطبيق.
            عمود <strong>بريد</strong> يرسل إيميل (يستلزم تفعيل خدمة البريد).
          </p>
        </div>

        {/* ── Event groups ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {EVENT_GROUPS.map(group => {
              const GroupIcon = group.icon;
              return (
                <div key={group.id} className="rounded-2xl overflow-hidden"
                  style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  {/* Group header */}
                  <div className="flex items-center justify-between px-5 py-3"
                    style={{ background: group.bg, borderBottom: "1px solid #E5E7EB" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: group.color }}>
                        <GroupIcon className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-bold text-sm" style={{ color: group.color }}>{group.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: group.color + "20", color: group.color }}>
                        {group.events.length} أحداث
                      </span>
                    </div>
                    {/* Group column headers */}
                    <div className="hidden sm:flex items-center gap-8 pl-2">
                      {CHANNELS.map(ch => (
                        <ChannelHead key={ch.key} icon={ch.icon} label={ch.label} color={ch.color} />
                      ))}
                    </div>
                  </div>

                  {/* Events */}
                  <div className="divide-y divide-gray-50">
                    {group.events.map(ev => {
                      const row = local[ev.type];
                      return (
                        <div key={ev.type}
                          className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                          <div className="flex-1 min-w-0 ml-4">
                            <p className="text-sm font-semibold text-foreground">{ev.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{ev.desc}</p>
                          </div>
                          <div className="flex items-center gap-8 shrink-0">
                            {CHANNELS.map(ch => (
                              <Toggle
                                key={ch.key}
                                on={row?.[ch.key] ?? true}
                                onChange={v => set(ev.type, ch.key, v)}
                                color={ch.color}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky save bar */}
        {dirty && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{ background: "#0B1F3B", border: "1px solid rgba(255,255,255,0.08)" }}>
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-sm text-white font-medium">لديك تغييرات غير محفوظة</span>
            <Button size="sm" className="text-xs gap-1.5 mr-2"
              style={{ background: "#2563EB" }}
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}>
              <Save className="w-3.5 h-3.5" />
              {saveMut.isPending ? "جارٍ الحفظ..." : "حفظ الآن"}
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
