import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Bell, X, AlertTriangle, Info, CheckCircle, AlertCircle,
  FileText, Scale, Calendar, Users, MessageSquare, RefreshCw,
  ChevronRight, Receipt, Briefcase, Clock, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

const GOLD = "#C9A84C";

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => fetch("/api/notifications").then(r => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const allNotifications = (data?.notifications ?? []).filter(n => !dismissed.has(n.id));
  const unread = allNotifications.length;

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
    setOpen(false);
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
        onClick={() => setOpen(v => !v)}
        aria-label="الإشعارات"
      >
        <Bell className={`h-5 w-5 transition-colors ${open ? "text-foreground" : "text-muted-foreground"}`} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white animate-in zoom-in-75"
            style={{ background: "#EF4444", border: "2px solid hsl(var(--card))" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {open && (
        <div
          className="absolute left-0 top-12 z-50 w-96 max-h-[80vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden animate-in slide-in-from-top-2 fade-in-0 duration-200"
          style={{
            background: "#1A2744",
            borderColor: "#2D3D6B",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.1)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b"
            style={{ borderColor: "#2D3D6B" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${GOLD}18` }}>
                <Bell className="h-3.5 w-3.5" style={{ color: GOLD }} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">الإشعارات والتنبيهات</h3>
                {unread > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{unread} تنبيه يحتاج اهتمامك</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white"
                onClick={() => { refetch(); }} title="تحديث">
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              {unread > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-white px-2"
                  onClick={dismissAll}>
                  مسح الكل
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white"
                onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">جارٍ تحميل الإشعارات...</p>
              </div>
            ) : allNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: `${GOLD}10` }}>
                  <Bell className="h-7 w-7" style={{ color: `${GOLD}60` }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">لا توجد إشعارات</p>
                  <p className="text-xs text-muted-foreground mt-1">كل شيء على ما يرام!</p>
                </div>
              </div>
            ) : (
              <div className="py-2">
                {Object.entries(groups).map(([category, items]) => {
                  const CategoryIcon = CATEGORY_ICONS[category] ?? Bell;
                  return (
                    <div key={category}>
                      {/* Category Header */}
                      <div className="flex items-center gap-2 px-4 py-2 sticky top-0"
                        style={{ background: "#1A2744" }}>
                        <CategoryIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{category}</span>
                        <div className="flex-1 h-px" style={{ background: "#2D3D6B" }} />
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4"
                          style={{ borderColor: "#2D3D6B", color: "#A0ADB8" }}>
                          {items.length}
                        </Badge>
                      </div>

                      {/* Items */}
                      {items.map(notif => {
                        const cfg = TYPE_CONFIG[notif.type];
                        const Icon = cfg.icon;
                        return (
                          <div
                            key={notif.id}
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
                                  onClick={(e) => dismiss(notif.id, e)}
                                  title="إغلاق"
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
            )}
          </div>

          {/* Footer */}
          {allNotifications.length > 0 && (
            <div className="border-t px-4 py-3 flex items-center justify-between"
              style={{ borderColor: "#2D3D6B", background: "rgba(26,39,68,0.95)" }}>
              <span className="text-xs text-muted-foreground">
                يتجدد كل دقيقة
              </span>
              <button
                className="text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ color: GOLD }}
                onClick={() => navigate("/firm-admin")}
              >
                عرض لوحة المدير
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
