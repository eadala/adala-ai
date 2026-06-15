import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Bell, X, AlertTriangle, Info, CheckCircle, AlertCircle,
  FileText, Scale, Calendar, Users, MessageSquare, RefreshCw,
  ChevronRight, Receipt, Briefcase, Clock, Activity,
  CreditCard, Zap, BrainCircuit, BellRing, BellOff, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: "error" | "warning" | "info" | "success";
  category: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

interface LiveEvent {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
  timestamp: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  error:   { icon: AlertCircle,   color: "#EF4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.20)" },
  warning: { icon: AlertTriangle, color: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.20)" },
  info:    { icon: Info,          color: "#6366F1", bg: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.20)" },
  success: { icon: CheckCircle,   color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.20)" },
};

const CATEGORY_ICONS: Record<string, any> = {
  "الفواتير":         Receipt,
  "العقود":           FileText,
  "المواعيد":         Calendar,
  "فريق العمل":       Users,
  "الموارد البشرية":  Briefcase,
  "الرسائل":          MessageSquare,
  "القضايا":          Scale,
};

const EVENT_ICONS: Record<string, { icon: any; color: string }> = {
  CASE_CREATED:     { icon: Scale,        color: "#6366F1" },
  CASE_UPDATED:     { icon: Scale,        color: "#94A3B8" },
  CASE_CLOSED:      { icon: Scale,        color: "#64748B" },
  CLIENT_ADDED:     { icon: Users,        color: "#10B981" },
  INVOICE_CREATED:  { icon: Receipt,      color: "#F59E0B" },
  INVOICE_PAID:     { icon: Receipt,      color: "#10B981" },
  PAYMENT_SUCCESS:  { icon: CreditCard,   color: "#2563EB" },
  PAYMENT_FAILED:   { icon: CreditCard,   color: "#EF4444" },
  DOCUMENT_GENERATED:{ icon: FileText,    color: "#8B5CF6" },
  AI_QUERY:         { icon: BrainCircuit, color: "#A855F7" },
  SUBSCRIPTION_RENEWED:{ icon: Zap,       color: "#2563EB" },
};

const GOLD = "#2563EB";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)    return `${Math.floor(diff / 1000)}ث`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}د`;
  return `${Math.floor(diff / 3_600_000)}س`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationsPanel() {
  const [open, setOpen]           = useState(false);
  const [tab, setTab]             = useState<"alerts" | "live">("live");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [newLiveCount, setNewLiveCount] = useState(0);
  const panelRef  = useRef<HTMLDivElement>(null);
  const esRef     = useRef<EventSource | null>(null);
  const [, setLocation] = useLocation();
  const push = usePushNotifications();

  // ── SSE connection ──────────────────────────────────────────────────────────
  useEffect(() => {
    function connect() {
      if (esRef.current) esRef.current.close();
      const es = new EventSource(`${BASE}/api/events/stream`);
      esRef.current = es;
      es.onopen  = () => setConnected(true);
      es.onerror = () => { setConnected(false); setTimeout(connect, 5000); };
      es.onmessage = (e) => {
        try {
          const ev: LiveEvent = JSON.parse(e.data);
          if (ev.type === "__CONNECTED__") return;
          setLiveEvents(prev => [ev, ...prev].slice(0, 50));
          if (!open) setNewLiveCount(n => n + 1);
        } catch {}
      };
    }
    connect();
    return () => esRef.current?.close();
  }, []);

  // Reset new-count when panel opens on live tab
  useEffect(() => {
    if (open && tab === "live") setNewLiveCount(0);
  }, [open, tab]);

  const { data, isLoading, refetch } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => fetch(`${BASE}/api/notifications`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const allNotifications = (data?.notifications ?? []).filter(n => !dismissed.has(n.id));

  const totalBadge = allNotifications.length + newLiveCount;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Group notifications by category
  const groups: Record<string, Notification[]> = {};
  for (const n of allNotifications) {
    if (!groups[n.category]) groups[n.category] = [];
    groups[n.category].push(n);
  }

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(prev => new Set([...prev, id]));
  };
  const dismissAll = () => {
    setDismissed(new Set(allNotifications.map(n => n.id)));
  };
  const navigate = (href: string) => {
    setOpen(false);
    setLocation(href);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => { setOpen(v => !v); if (!open) setNewLiveCount(0); }}
        aria-label="الإشعارات"
      >
        <Bell className={`h-5 w-5 transition-colors ${open ? "text-foreground" : "text-muted-foreground"}`} />
        {/* Live connected dot */}
        {connected && (
          <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
        {totalBadge > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white animate-in zoom-in-75"
            style={{ background: "#EF4444", border: "2px solid hsl(var(--card))" }}>
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {open && (
        <div
          className="absolute left-0 top-12 z-50 w-96 max-h-[82vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden animate-in slide-in-from-top-2 fade-in-0 duration-200"
          style={{
            background: "#FFFFFF",
            borderColor: "#E2E8F0",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.1)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}18` }}>
                <Bell className="h-3.5 w-3.5" style={{ color: GOLD }} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">الإشعارات</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                  <p className="text-[10px] text-muted-foreground">{connected ? "متصل — لحظي" : "غير متصل"}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white"
                onClick={() => refetch()} title="تحديث">
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white"
                onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b flex-shrink-0" style={{ borderColor: "#E2E8F0" }}>
            {[
              { id: "live" as const,   label: "نبض لحظي", badge: newLiveCount > 0 ? newLiveCount : liveEvents.length },
              { id: "alerts" as const, label: "تنبيهات",  badge: allNotifications.length },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); if (t.id === "live") setNewLiveCount(0); }}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  tab === t.id
                    ? "text-white border-b-2"
                    : "text-muted-foreground hover:text-white border-b-2 border-transparent"
                }`}
                style={tab === t.id ? { borderBottomColor: GOLD, color: GOLD } : {}}
              >
                {t.label}
                {t.badge > 0 && (
                  <span className="px-1.5 py-0 rounded-full text-[9px] font-bold text-white"
                    style={{ background: t.id === "live" && newLiveCount > 0 ? "#EF4444" : "#E2E8F0" }}>
                    {t.badge > 99 ? "99+" : t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Live Events Tab ── */}
            {tab === "live" && (
              <div className="py-1">
                {liveEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${GOLD}10` }}>
                      <Activity className="h-7 w-7" style={{ color: `${GOLD}60` }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white">في انتظار الأحداث</p>
                      <p className="text-xs text-muted-foreground mt-1">جرّب إنشاء قضية أو إضافة عميل</p>
                    </div>
                    <button
                      className="text-xs flex items-center gap-1 mt-1 hover:opacity-80 transition-opacity"
                      style={{ color: GOLD }}
                      onClick={() => navigate("/activity-stream")}
                    >
                      عرض السجل الكامل <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-[#1E2D50]">
                    {liveEvents.map((ev, idx) => {
                      const meta = EVENT_ICONS[ev.type] ?? { icon: Activity, color: "#64748B" };
                      const Icon = meta.icon;
                      const isNew = idx < 3;
                      return (
                        <div
                          key={ev.id}
                          className={`flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50 cursor-pointer ${isNew ? "bg-primary/5" : ""}`}
                          onClick={() => navigate("/activity-stream")}
                        >
                          <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}25` }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold" style={{ color: meta.color }}>{ev.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {ev.data?.title ?? ev.data?.fullName ?? ev.data?.invoiceNumber ?? ev.data?.clientName ?? ""}
                              {ev.data?.amount ? ` — ${Number(ev.data.amount).toLocaleString("ar-SA")} ر.س` : ""}
                            </p>
                          </div>
                          <span className="text-[9px] text-muted-foreground/60 flex-shrink-0 mt-0.5">{timeAgo(ev.timestamp)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Alerts Tab ── */}
            {tab === "alerts" && (
              isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
                </div>
              ) : allNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${GOLD}10` }}>
                    <Bell className="h-7 w-7" style={{ color: `${GOLD}60` }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-white">لا توجد تنبيهات</p>
                    <p className="text-xs text-muted-foreground mt-1">كل شيء على ما يرام!</p>
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  <div className="flex justify-end px-3 pb-1">
                    <button className="text-[10px] text-muted-foreground hover:text-white transition-colors" onClick={dismissAll}>
                      مسح الكل
                    </button>
                  </div>
                  {Object.entries(groups).map(([category, items]) => {
                    const CategoryIcon = CATEGORY_ICONS[category] ?? Bell;
                    return (
                      <div key={category}>
                        <div className="flex items-center gap-2 px-4 py-2 sticky top-0" style={{ background: "#FFFFFF" }}>
                          <CategoryIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{category}</span>
                          <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4" style={{ borderColor: "#E2E8F0", color: "#A0ADB8" }}>
                            {items.length}
                          </Badge>
                        </div>
                        {items.map(notif => {
                          const cfg = TYPE_CONFIG[notif.type];
                          const Icon = cfg.icon;
                          return (
                            <div key={notif.id}
                              className="mx-2 mb-1.5 rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                              onClick={() => navigate(notif.href)}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                  style={{ background: `${cfg.color}20` }}>
                                  <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-white leading-tight">{notif.title}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  <button
                                    className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                                    onClick={(e) => dismiss(notif.id, e)} title="إغلاق"
                                  >
                                    <X className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-3 py-2.5 flex items-center justify-between flex-shrink-0 gap-2"
            style={{ borderColor: "#E2E8F0", background: "rgba(26,39,68,0.95)" }}>

            {/* Push toggle */}
            {push.state !== "unsupported" && (
              <button
                disabled={push.state === "loading"}
                onClick={() => push.state === "subscribed" ? push.unsubscribe() : push.subscribe()}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: push.state === "subscribed" ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.12)",
                  border: `1px solid ${push.state === "subscribed" ? "rgba(16,185,129,0.3)" : "rgba(99,102,241,0.3)"}`,
                  color: push.state === "subscribed" ? "#10B981" : push.state === "denied" ? "#EF4444" : "#818CF8",
                }}
                title={push.state === "subscribed" ? "إيقاف إشعارات المتصفح" : "تفعيل إشعارات المتصفح"}
              >
                {push.state === "loading" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : push.state === "subscribed" ? (
                  <BellRing className="h-3 w-3" />
                ) : (
                  <BellOff className="h-3 w-3" />
                )}
                {push.state === "subscribed" ? "إشعارات المتصفح ✓" : push.state === "denied" ? "محظور" : "تفعيل الإشعارات"}
              </button>
            )}

            <button
              className="text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-opacity mr-auto"
              style={{ color: GOLD }}
              onClick={() => navigate("/activity-stream")}
            >
              نبض النظام الكامل
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
