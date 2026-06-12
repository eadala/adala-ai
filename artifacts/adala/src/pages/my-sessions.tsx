import { useQuery } from "@tanstack/react-query";
import { useUser, useClerk } from "@clerk/react";
import {
  Shield, Monitor, Smartphone, Tablet, Globe,
  Clock, MapPin, LogOut, RefreshCw, Key, AlertCircle,
  CheckCircle2, Laptop
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  const hr  = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1)  return "الآن";
  if (min < 60) return `منذ ${min} دقيقة`;
  if (hr  < 24) return `منذ ${hr} ساعة`;
  if (day < 30) return `منذ ${day} يوم`;
  return new Date(dateStr).toLocaleDateString("ar-SA");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function DeviceIcon({ type, size = "md" }: { type: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  if (type === "mobile") return <Smartphone className={`${cls} text-blue-400`} />;
  if (type === "tablet") return <Tablet className={`${cls} text-purple-400`} />;
  return <Monitor className={`${cls} text-emerald-400`} />;
}

function deviceLabel(type: string) {
  if (type === "mobile") return "جوال";
  if (type === "tablet") return "جهاز لوحي";
  return "حاسوب";
}

function maskIp(ip: string): string {
  if (!ip || ip === "غير محدد") return ip;
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  return ip.slice(0, Math.max(4, ip.length - 6)) + "****";
}

export default function MySessionsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["my-sessions"],
    queryFn: () => fetch(`${BASE}/api/security/my-sessions`).then(r => r.json()),
    staleTime: 30_000,
  });

  const sessions: any[]  = data?.sessions ?? [];
  const current          = sessions[0];
  const uniqueIps: number = data?.uniqueIps ?? 0;
  const breakdown: any   = data?.deviceBreakdown ?? {};

  const handleSignOut = () => {
    toast({ title: "جاري تسجيل الخروج..." });
    signOut({ redirectUrl: `${BASE}/` });
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">جلساتي وأجهزتي</h1>
              <p className="text-sm text-muted-foreground">سجل جميع عمليات الدخول لحسابك</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الجلسات",      value: sessions.length,      icon: Clock,       color: "#6366F1" },
            { label: "عناوين IP مختلفة",     value: uniqueIps,            icon: Globe,       color: "#10B981" },
            { label: "دخول من جوال",         value: breakdown.mobile ?? 0, icon: Smartphone, color: "#3B82F6" },
            { label: "دخول من حاسوب",        value: breakdown.desktop ?? 0,icon: Monitor,    color: "#8B5CF6" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
                  <p className="text-2xl font-black leading-tight">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Current Session Card ── */}
        {current && (
          <Card className="border-emerald-500/30" style={{ background: "rgba(16,185,129,0.04)" }}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                    <DeviceIcon type={current.device_type} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-semibold text-sm">{current.browser}</span>
                      <span className="text-muted-foreground text-sm">على {current.os}</span>
                      <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 border gap-1 px-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        الجلسة الحالية
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500/60" />
                        IP: <span className="font-mono text-foreground/70">{maskIp(current.ip_address)}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(current.created_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <DeviceIcon type={current.device_type} size="sm" />
                        {deviceLabel(current.device_type)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="destructive" size="sm"
                  onClick={handleSignOut}
                  className="gap-2 shrink-0 text-xs font-semibold"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  تسجيل الخروج الآن
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── All Sessions List ── */}
        <Card className="border-border/50">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Key className="h-4 w-4" />
              سجل عمليات الدخول الكاملة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                لا توجد سجلات دخول بعد
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {sessions.map((s: any, i: number) => (
                  <div key={s.id || i}
                    className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/20 ${i === 0 ? "bg-emerald-500/4" : ""}`}>

                    {/* Device icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      i === 0 ? "bg-emerald-500/12 border border-emerald-500/20" : "bg-muted/40"
                    }`}>
                      <DeviceIcon type={s.device_type} size="sm" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{s.browser} — {s.os}</span>
                        {i === 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                            ● حالية
                          </span>
                        )}
                      </div>
                      <div className="flex items-center flex-wrap gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="font-mono">{maskIp(s.ip_address)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Laptop className="h-3 w-3" />
                          {deviceLabel(s.device_type)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(s.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Date + status */}
                    <div className="text-right shrink-0 space-y-1">
                      <div className="text-[11px] text-muted-foreground">{formatDate(s.created_at)}</div>
                      {s.status === "success" && (
                        <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> ناجح
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Security Tip ── */}
        <Card className="border-amber-500/20" style={{ background: "rgba(245,158,11,0.04)" }}>
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              إذا لاحظت أي دخول غير معروف أو من جهاز لا تعرفه، غيّر كلمة المرور فوراً
              وتواصل مع الدعم الفني. تُسجَّل جميع عمليات الدخول تلقائياً لحماية حسابك.
            </p>
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}
