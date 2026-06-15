import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, BellOff, CheckCheck, AlertTriangle, CheckCircle2,
  TrendingUp, Send, Wifi, WifiOff, RefreshCw, Clock,
  Activity, MessageCircle, Mail, Smartphone, Volume2, VolumeX
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}${path}`;
async function fetchJ(url: string, opts?: RequestInit) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const SEV_STYLES: Record<string, string> = {
  critical: "border-r-4 border-red-500 bg-red-50",
  high:     "border-r-4 border-orange-400 bg-orange-50",
  medium:   "border-r-4 border-amber-400 bg-amber-50",
  low:      "border-r-4 border-blue-400 bg-blue-50",
};
const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-blue-100 text-blue-700",
};
const SEV_ICON: Record<string, string> = {
  critical: "🔴", high: "🟠", medium: "🟡", low: "🟢",
};

const TAB_ITEMS = [
  { id: "feed",     label: "التنبيهات الحية",    icon: Bell },
  { id: "stats",    label: "الإحصائيات",          icon: Activity },
  { id: "channels", label: "قنوات الإرسال",        icon: Send },
  { id: "history",  label: "السجل التاريخي",      icon: Clock },
];

export default function AlertsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("feed");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [showAcked, setShowAcked] = useState(false);

  const feedQ = useQuery({
    queryKey: ["alerts-feed"],
    queryFn: () => fetchJ(api("/api/smart-alerts/feed?limit=100")),
    refetchInterval: 8000,
  });
  const statsQ = useQuery({
    queryKey: ["alerts-stats"],
    queryFn: () => fetchJ(api("/api/smart-alerts/stats")),
    refetchInterval: 10000,
  });
  const channelsQ = useQuery({
    queryKey: ["alerts-channels"],
    queryFn: () => fetchJ(api("/api/smart-alerts/channels")),
    enabled: tab === "channels",
  });
  const historyQ = useQuery({
    queryKey: ["alerts-history", severityFilter],
    queryFn: () => fetchJ(api(`/api/smart-alerts/history?limit=60${severityFilter !== "all" ? `&severity=${severityFilter}` : ""}`)),
    enabled: tab === "history",
    refetchInterval: 20000,
  });

  const ackMut = useMutation({
    mutationFn: (id: string) => fetchJ(api(`/api/smart-alerts/acknowledge/${id}`), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-feed"] }),
  });
  const ackAllMut = useMutation({
    mutationFn: () => fetchJ(api("/api/smart-alerts/acknowledge-all"), { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts-feed"] });
      qc.invalidateQueries({ queryKey: ["alerts-stats"] });
    },
  });
  const suppressMut = useMutation({
    mutationFn: (minutes: number) => fetchJ(api("/api/smart-alerts/suppress"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-stats"] }),
  });
  const unsuppressMut = useMutation({
    mutationFn: () => fetchJ(api("/api/smart-alerts/unsuppress"), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-stats"] }),
  });
  const testMut = useMutation({
    mutationFn: (sev: string) => fetchJ(api("/api/smart-alerts/test"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ severity: sev }),
    }),
  });
  const trendMut = useMutation({
    mutationFn: () => fetchJ(api("/api/smart-alerts/check-trends"), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-feed"] }),
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["alerts-feed"] });
    qc.invalidateQueries({ queryKey: ["alerts-stats"] });
  }, [qc]);

  const stats = statsQ.data ?? {};
  const alerts: any[] = feedQ.data?.alerts ?? [];
  const visibleAlerts = alerts.filter(a => {
    if (!showAcked && a.acknowledged) return false;
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    return true;
  });
  const unacked = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6 rtl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <Bell className="h-5 w-5 text-white" />
            </div>
            {unacked > 0 && (
              <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{unacked > 9 ? "9+" : unacked}</span>
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">التنبيهات الذكية</h1>
            <p className="text-sm text-gray-500">Smart Alerts — Dedup + Trend + Multi-Channel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats.suppressed ? (
            <button onClick={() => unsuppressMut.mutate()} disabled={unsuppressMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 transition">
              <Volume2 className="h-3 w-3" /> إلغاء الصمت
            </button>
          ) : (
            <button onClick={() => suppressMut.mutate(30)} disabled={suppressMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              <VolumeX className="h-3 w-3" /> صامت 30 دقيقة
            </button>
          )}
          {unacked > 0 && (
            <button onClick={() => ackAllMut.mutate()} disabled={ackAllMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              <CheckCheck className="h-3 w-3" /> اعتراف بالكل
            </button>
          )}
          <button onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 transition">
            <RefreshCw className="h-3 w-3" /> تحديث
          </button>
        </div>
      </div>

      {/* Suppression Banner */}
      {stats.suppressed && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-2 text-sm text-amber-800">
          <VolumeX className="h-4 w-4 shrink-0" />
          وضع صامت نشط — التنبيهات مكتومة حتى: {stats.suppressedUntil ? new Date(stats.suppressedUntil).toLocaleTimeString("ar-SA") : "..."}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TAB_ITEMS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === t.id ? "bg-violet-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}>
            <t.icon className="h-4 w-4" />{t.label}
            {t.id === "feed" && unacked > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 font-bold">{unacked}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Feed Tab ── */}
      {tab === "feed" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
              {["all", "critical", "high", "medium", "low"].map(s => (
                <button key={s} onClick={() => setSeverityFilter(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition
                    ${severityFilter === s ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                  {s === "all" ? "الكل" : `${SEV_ICON[s]} ${s}`}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAcked(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition
                ${showAcked ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
              <CheckCircle2 className="h-3 w-3" />
              {showAcked ? "إخفاء المعترَف بها" : "عرض المعترَف بها"}
            </button>
            <button onClick={() => trendMut.mutate()} disabled={trendMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              <TrendingUp className="h-3 w-3" />
              {trendMut.isPending ? "جارٍ الفحص…" : "فحص الاتجاهات"}
            </button>
          </div>

          {/* Alert list */}
          {feedQ.isLoading && <div className="p-8 text-center text-gray-400 text-sm">جارٍ التحميل…</div>}
          {visibleAlerts.length === 0 && !feedQ.isLoading && (
            <div className="bg-white border border-gray-200 rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
              <Bell className="h-10 w-10 text-gray-300" />
              <div className="font-semibold text-gray-500">لا توجد تنبيهات</div>
              <div className="text-xs text-gray-400">النظام يعمل بهدوء — ستظهر التنبيهات هنا فور حدوثها</div>
            </div>
          )}
          <div className="space-y-2">
            {visibleAlerts.map((al: any) => (
              <div key={al.id} className={`rounded-xl p-4 flex items-start gap-3 transition ${SEV_STYLES[al.severity] ?? "bg-white border"} ${al.acknowledged ? "opacity-50" : ""}`}>
                <span className="text-xl mt-0.5 shrink-0">{SEV_ICON[al.severity]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SEV_BADGE[al.severity]}`}>
                      {al.severity.toUpperCase()}
                    </span>
                    {al.count > 1 && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        ×{al.count} مرة
                      </span>
                    )}
                    {al.acknowledged && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> تم الاعتراف
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-800 mt-1">{al.message}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span><Clock className="h-3 w-3 inline ml-1" />{new Date(al.lastSeen).toLocaleString("ar-SA")}</span>
                    <span>القناة: {al.channel}</span>
                  </div>
                </div>
                {!al.acknowledged && (
                  <button onClick={() => ackMut.mutate(al.id)} disabled={ackMut.isPending}
                    className="shrink-0 px-2 py-1 rounded-lg text-xs bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                    اعتراف
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats Tab ── */}
      {tab === "stats" && stats && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "إجمالي التنبيهات", value: stats.total ?? 0, color: "gray" },
              { label: "غير معترَف بها",   value: stats.unacknowledged ?? 0, color: "red",    warn: (stats.unacknowledged ?? 0) > 0 },
              { label: "مفاتيح إزالة التكرار", value: stats.dedupeKeys ?? 0, color: "indigo" },
              { label: "وضع صامت",         value: stats.suppressed ? "نشط" : "معطل", color: stats.suppressed ? "amber" : "emerald" },
            ].map((m, i) => (
              <div key={i} className={`bg-white border rounded-2xl p-5 ${m.warn ? "border-red-300" : "border-gray-200"}`}>
                <div className="text-xs text-gray-500 mb-2">{m.label}</div>
                <div className={`text-2xl font-bold ${m.warn ? "text-red-600" : "text-gray-900"}`}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Last Hour */}
          {stats.lastHour && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="text-sm font-semibold text-gray-700 mb-4">آخر ساعة</div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "حرجة", value: stats.lastHour.critical, color: "red" },
                  { label: "عالية", value: stats.lastHour.high, color: "orange" },
                  { label: "متوسطة", value: stats.lastHour.medium, color: "amber" },
                  { label: "منخفضة", value: stats.lastHour.low, color: "blue" },
                ].map((m, i) => (
                  <div key={i} className="text-center p-3 rounded-xl bg-gray-50">
                    <div className={`text-2xl font-bold text-${m.color}-600`}>{m.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test alert */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-sm font-semibold text-gray-700 mb-4">اختبار التسليم</div>
            <div className="flex gap-2 flex-wrap">
              {["low", "medium", "high", "critical"].map(sev => (
                <button key={sev} onClick={() => testMut.mutate(sev)} disabled={testMut.isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-50 ${SEV_BADGE[sev]}`}>
                  {SEV_ICON[sev]} اختبار {sev}
                </button>
              ))}
            </div>
            {testMut.isSuccess && (
              <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                أُرسل التنبيه الاختباري — تحقق من التبويب الحي والـ Telegram
              </div>
            )}
          </div>

          {/* Suppress controls */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-sm font-semibold text-gray-700 mb-4">وضع الصمت (Maintenance Window)</div>
            <div className="flex gap-2 flex-wrap">
              {[15, 30, 60, 120].map(min => (
                <button key={min} onClick={() => suppressMut.mutate(min)} disabled={suppressMut.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white border border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-300 transition">
                  {min < 60 ? `${min} دقيقة` : `${min / 60} ساعة`}
                </button>
              ))}
              {stats.suppressed && (
                <button onClick={() => unsuppressMut.mutate()} disabled={unsuppressMut.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100 transition">
                  <Volume2 className="h-3 w-3 inline ml-1" />إلغاء الصمت الآن
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Channels Tab ── */}
      {tab === "channels" && (
        <div className="space-y-4">
          {channelsQ.isLoading && <div className="p-8 text-center text-gray-400 text-sm">جارٍ التحميل…</div>}
          {channelsQ.data && (() => {
            const ch = channelsQ.data.channels ?? {};
            return (
              <>
                {[
                  {
                    key: "telegram",
                    label: "Telegram",
                    icon: MessageCircle,
                    color: "blue",
                    data: ch.telegram,
                    configLink: "/telegram-settings",
                  },
                  {
                    key: "email",
                    label: "البريد الإلكتروني",
                    icon: Mail,
                    color: "purple",
                    data: ch.email,
                    configLink: null,
                  },
                  {
                    key: "inApp",
                    label: "داخل التطبيق",
                    icon: Smartphone,
                    color: "emerald",
                    data: ch.inApp,
                    configLink: null,
                  },
                ].map(channel => {
                  const d = channel.data ?? {};
                  const active = d.configured && (d.activeCount > 0 || d.configured === true);
                  return (
                    <div key={channel.key} className={`bg-white border rounded-2xl p-5 flex items-center justify-between
                      ${active ? "border-gray-200" : "border-dashed border-gray-300"}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                          ${active ? `bg-${channel.color}-50` : "bg-gray-100"}`}>
                          <channel.icon className={`h-5 w-5 ${active ? `text-${channel.color}-600` : "text-gray-400"}`} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">{channel.label}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{d.note ?? ""}</div>
                          {channel.key === "telegram" && d.configured && (
                            <div className="text-xs text-gray-500 mt-1">
                              {d.activeCount} مكتب مُفعَّل ·
                              تنبيهات النظام: {d.systemAlertsEnabled ? "✅ نشطة" : "❌ معطلة"}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          {active
                            ? <><Wifi className="h-4 w-4 text-emerald-500" /><span className="text-xs text-emerald-600 font-medium">متصل</span></>
                            : <><WifiOff className="h-4 w-4 text-gray-400" /><span className="text-xs text-gray-400">{d.configured ? "غير مُفعَّل" : "غير مُكوَّن"}</span></>}
                        </div>
                        {channel.configLink && (
                          <a href={channel.configLink}
                            className="px-3 py-1 rounded-lg text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                            إعداد
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 flex items-start gap-2">
                  <Bell className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  لتلقي تنبيهات النظام على Telegram: اذهب إلى إعدادات Telegram وفعّل "تنبيهات النظام". التنبيهات الحرجة تُرسَل دائماً بغض النظر عن الإعداد.
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── History Tab ── */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
            {["all", "critical", "high", "medium", "low"].map(s => (
              <button key={s} onClick={() => setSeverityFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition
                  ${severityFilter === s ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                {s === "all" ? "الكل" : `${SEV_ICON[s]} ${s}`}
              </button>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="divide-y divide-gray-50 max-h-[540px] overflow-y-auto">
              {historyQ.isLoading && <div className="p-8 text-center text-gray-400 text-sm">جارٍ التحميل…</div>}
              {(historyQ.data?.history ?? []).length === 0 && !historyQ.isLoading && (
                <div className="p-8 text-center text-gray-400 text-sm">لا توجد سجلات</div>
              )}
              {(historyQ.data?.history ?? []).map((ev: any) => (
                <div key={ev.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                  <span className="text-base">{SEV_ICON[ev.severity] ?? "⚪"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800">{ev.message}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(ev.created_at).toLocaleString("ar-SA")}
                    </div>
                  </div>
                  {ev.resolved && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
