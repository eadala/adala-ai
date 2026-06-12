import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield, Activity, Trash2, Users, RefreshCw, Search,
  ChevronLeft, ChevronRight, AlertTriangle, Download,
  Plus, Edit3, LogIn, Eye, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── action config ── */
const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Plus }> = {
  create:  { label: "إنشاء",  color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: Plus },
  update:  { label: "تعديل", color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",   icon: Edit3 },
  delete:  { label: "حذف",   color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",       icon: Trash2 },
  login:   { label: "دخول",  color: "text-blue-400",    bg: "bg-blue-500/15 border-blue-500/30",     icon: LogIn },
  view:    { label: "عرض",   color: "text-white/50",    bg: "bg-white/5 border-white/10",            icon: Eye },
  export:  { label: "تصدير", color: "text-purple-400",  bg: "bg-purple-500/15 border-purple-500/30", icon: Download },
  generate:{ label: "توليد", color: "text-gold",        bg: "bg-gold/15 border-gold/30",             icon: FileText },
};
const defaultAction = { label: "أخرى", color: "text-white/40", bg: "bg-white/5 border-white/10", icon: Activity };

const RESOURCE_LABELS: Record<string, string> = {
  cases: "القضايا", clients: "العملاء", invoices: "الفواتير",
  contracts: "العقود", documents: "المستندات", users: "المستخدمون",
  legal_documents: "وثائق AI", revenues: "الإيرادات", expenses: "المصروفات",
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AuditLogsPage() {
  const [page, setPage]     = useState(1);
  const [action, setAction] = useState("all");
  const [resource, setResource] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom]     = useState("");
  const [to, setTo]         = useState("");

  const params = new URLSearchParams({
    page: String(page), limit: "50",
    ...(action !== "all"   && { action }),
    ...(resource !== "all" && { resource }),
    ...(search && { search }),
    ...(from && { from }),
    ...(to && { to }),
  });

  const { data: logs, isLoading, refetch } = useQuery<{ rows: any[]; total: number; pages: number }>({
    queryKey: ["audit-logs", page, action, resource, search, from, to],
    queryFn: () => fetch(`${BASE}/api/audit-logs?${params}`).then(r => r.json()),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["audit-logs-stats"],
    queryFn: () => fetch(`${BASE}/api/audit-logs/stats`).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const totalPages = logs?.pages ?? 1;

  const filterChanged = () => { setPage(1); };

  return (
    <div className="flex flex-col h-full gap-0">
      {/* header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">سجل المراقبة والأمان</h1>
            <p className="text-xs text-white/50">تتبع كل الأنشطة والعمليات في النظام</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-white/60 hover:text-white"
          onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5" />تحديث
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "أحداث اليوم",     value: stats?.todayTotal ?? 0,     icon: Activity,       color: "text-blue-400",    bg: "bg-blue-500/10" },
            { label: "مستخدمون نشطون",  value: stats?.todayUsers ?? 0,     icon: Users,          color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "عمليات حذف",      value: stats?.todayDeletions ?? 0, icon: Trash2,          color: "text-red-400",     bg: "bg-red-500/10" },
            { label: "تنبيهات مشبوهة",  value: stats?.suspicious?.length ?? 0, icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
          ].map(s => (
            <div key={s.label} className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.bg)}>
                <s.icon className={cn("w-4 h-4", s.color)} />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/50">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* suspicious alerts */}
        {(stats?.suspicious?.length ?? 0) > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">تنبيه: نشاط غير معتاد</span>
            </div>
            <div className="space-y-1">
              {stats.suspicious.map((s: any, i: number) => (
                <p key={i} className="text-xs text-white/70">
                  المستخدم <span className="text-white font-medium">{s.user_full_name || s.user_id || "مجهول"}</span> قام
                  بـ <span className="text-red-400 font-medium">{s.count} عملية حذف</span> في آخر ساعة
                </p>
              ))}
            </div>
          </div>
        )}

        {/* hourly chart */}
        {(stats?.hourly?.length ?? 0) > 0 && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-sm font-semibold text-white/80 mb-3">النشاط خلال 24 ساعة</p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stats.hourly} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                <Tooltip
                  contentStyle={{ background: "#1A2744", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Bar dataKey="count" fill="#6366F1" radius={[3, 3, 0, 0]} name="أحداث" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input placeholder="بحث بالمستخدم أو المعرف..." value={search}
              onChange={e => { setSearch(e.target.value); filterChanged(); }}
              className="h-8 pr-9 w-48 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>
          <Select value={action} onValueChange={v => { setAction(v); filterChanged(); }}>
            <SelectTrigger className="h-8 w-32 text-xs bg-white/5 border-white/10">
              <SelectValue placeholder="الفعل" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأفعال</SelectItem>
              {Object.entries(ACTION_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={resource} onValueChange={v => { setResource(v); filterChanged(); }}>
            <SelectTrigger className="h-8 w-36 text-xs bg-white/5 border-white/10">
              <SelectValue placeholder="المورد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الموارد</SelectItem>
              {Object.entries(RESOURCE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={e => { setFrom(e.target.value); filterChanged(); }}
            className="h-8 w-36 text-xs bg-white/5 border-white/10 text-white" />
          <Input type="date" value={to} onChange={e => { setTo(e.target.value); filterChanged(); }}
            className="h-8 w-36 text-xs bg-white/5 border-white/10 text-white" />
          {(action !== "all" || resource !== "all" || search || from || to) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-white/50"
              onClick={() => { setAction("all"); setResource("all"); setSearch(""); setFrom(""); setTo(""); setPage(1); }}>
              مسح الفلاتر ✕
            </Button>
          )}
          <span className="text-xs text-white/30 mr-auto">
            {logs?.total ?? 0} سجل
          </span>
        </div>

        {/* table */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {["التاريخ والوقت", "المستخدم", "الفعل", "المورد", "المعرف", "التفاصيل"].map(h => (
                    <th key={h} className="text-right px-4 py-3 text-xs font-medium text-white/40">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-white/5 rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (logs?.rows?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-white/30 text-sm">
                      لا توجد سجلات
                    </td>
                  </tr>
                ) : logs?.rows.map((row: any) => {
                  const cfg = ACTION_CONFIG[row.action] ?? defaultAction;
                  const ActionIcon = cfg.icon;
                  return (
                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-xs text-white/50 whitespace-nowrap">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80 max-w-[120px] truncate">
                        {row.user_full_name || row.user_id || <span className="text-white/30 italic">نظام</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", cfg.bg, cfg.color)}>
                          <ActionIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/60">
                        {RESOURCE_LABELS[row.resource] ?? row.resource}
                      </td>
                      <td className="px-4 py-3 text-xs text-white/40 font-mono max-w-[120px] truncate">
                        {row.resource_id || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-white/40 max-w-[180px] truncate">
                        {row.details || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-white/50"
                disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronRight className="w-3.5 h-3.5" />السابق
              </Button>
              <span className="text-xs text-white/40">صفحة {page} من {totalPages}</span>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-white/50"
                disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                التالي<ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* action + resource breakdown */}
        {((stats?.byAction?.length ?? 0) > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "الأفعال (آخر 7 أيام)", data: stats?.byAction, key: "action", labelFn: (v: string) => ACTION_CONFIG[v]?.label ?? v, color: "#6366F1" },
              { title: "الموارد (آخر 7 أيام)", data: stats?.byResource, key: "resource", labelFn: (v: string) => RESOURCE_LABELS[v] ?? v, color: "#C9A84C" },
            ].map(chart => (
              <div key={chart.title} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-sm font-semibold text-white/80 mb-3">{chart.title}</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={chart.data?.map((d: any) => ({ name: chart.labelFn(d[chart.key]), value: d.count }))}
                    layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} width={60} />
                    <Tooltip
                      contentStyle={{ background: "#1A2744", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Bar dataKey="value" fill={chart.color} radius={[0, 4, 4, 0]} name="عدد" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
