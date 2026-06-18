import { useQuery } from "@tanstack/react-query";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Server, Database, Brain, Mail, MessageSquare, CreditCard, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const STATUS_CONFIG = {
  operational: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-800", label: "يعمل بشكل طبيعي" },
  degraded:    { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-800", label: "أداء متأثر" },
  outage:      { icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-800", label: "عطل" },
};

const SERVICE_ICONS: Record<string, any> = {
  database: Database, ai: Brain, storage: Server, email: Mail,
  whatsapp: MessageSquare, payments: CreditCard,
};

interface Service {
  name: string; label: string;
  status: "operational" | "degraded" | "outage";
  latencyMs?: number; detail?: string;
}
interface StatusData {
  overall: "operational" | "degraded" | "outage";
  overallLabel: string;
  checkedAt: string;
  services: Service[];
}

export default function SystemStatusPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<StatusData>({
    queryKey: ["system-status"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/status`);
      if (!r.ok) throw new Error("فشل الاتصال");
      return r.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const overall = data?.overall ?? "operational";
  const cfg = STATUS_CONFIG[overall];
  const OverallIcon = overall === "operational" ? Wifi : cfg.icon;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className={`border-b-4 py-12 text-center ${
        overall === "operational" ? "bg-gradient-to-b from-green-50 to-white border-green-400" :
        overall === "degraded" ? "bg-gradient-to-b from-amber-50 to-white border-amber-400" :
        "bg-gradient-to-b from-red-50 to-white border-red-400"
      }`}>
        <div className="flex items-center justify-center gap-3 mb-4">
          <OverallIcon className={`w-10 h-10 ${cfg.color}`} />
          <h1 className="text-3xl font-bold text-gray-900">حالة منصة عدالة AI</h1>
        </div>
        {isLoading ? (
          <p className="text-gray-500 text-lg">جارٍ الفحص...</p>
        ) : (
          <p className={`text-xl font-semibold ${cfg.color}`}>{data?.overallLabel}</p>
        )}
        {data?.checkedAt && (
          <p className="text-sm text-gray-400 mt-2">
            آخر فحص: {new Date(data.checkedAt).toLocaleString("ar-SA")}
          </p>
        )}
        <Button
          variant="outline" size="sm"
          className="mt-4 gap-2"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      <div className="max-w-3xl mx-auto py-10 px-4 space-y-4">

        {/* Overall indicator */}
        <div className={`rounded-xl border-2 p-5 flex items-center gap-4 ${cfg.bg}`}>
          <cfg.icon className={`w-8 h-8 ${cfg.color} shrink-0`} />
          <div>
            <p className="font-bold text-gray-900 text-lg">{data?.overallLabel ?? "جارٍ الفحص..."}</p>
            <p className="text-sm text-gray-500">
              {overall === "operational"
                ? "جميع الأنظمة تعمل بكفاءة كاملة"
                : overall === "degraded"
                ? "بعض الخدمات تعمل بأداء منخفض"
                : "يوجد عطل في إحدى الخدمات الرئيسية"}
            </p>
          </div>
        </div>

        {/* Per-service cards */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-700">حالة الخدمات</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="py-4 flex items-center justify-between animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-6 bg-gray-200 rounded w-24" />
                  </div>
                ))
              : data?.services.map((svc) => {
                  const scfg = STATUS_CONFIG[svc.status];
                  const Icon = SERVICE_ICONS[svc.name] ?? Server;
                  return (
                    <div key={svc.name} className="py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-gray-500 shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">{svc.label}</p>
                          {svc.detail && <p className="text-xs text-gray-400">{svc.detail}</p>}
                          {svc.latencyMs !== undefined && (
                            <p className="text-xs text-gray-400">استجابة: {svc.latencyMs}ms</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${scfg.badge}`}>
                        {scfg.label}
                      </span>
                    </div>
                  );
                })
            }
          </CardContent>
        </Card>

        {/* Uptime legend */}
        <div className="text-center text-sm text-gray-400 pt-4 space-y-1">
          <p>يتم تحديث هذه الصفحة كل 60 ثانية تلقائياً</p>
          <p>للإبلاغ عن مشكلة: <a href="mailto:support@adala.ai" className="text-primary underline">support@adala.ai</a></p>
        </div>
      </div>
    </div>
  );
}
