import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  HardDrive, FileText, Trash2, Archive, BarChart3, Settings, Cpu,
  RefreshCw, AlertTriangle, CheckCircle2, Copy, FolderOpen,
  Upload, Download, Eye, MoreVertical, Zap, Shield
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function api(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
}

function fmtBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024, s = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + s[i];
}

function categoryIcon(cat: string) {
  const map: Record<string, string> = {
    document: "📄", image: "🖼️", video: "🎬", contract: "📋",
    invoice: "🧾", evidence: "🔍", other: "📁",
  };
  return map[cat] ?? "📁";
}

function categoryLabel(cat: string) {
  const map: Record<string, string> = {
    document: "وثيقة", image: "صورة", video: "فيديو", contract: "عقد",
    invoice: "فاتورة", evidence: "دليل", other: "أخرى",
  };
  return map[cat] ?? cat;
}

function timeAgo(date: string) {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.round(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.round(diff / 3600)} ساعة`;
  return `منذ ${Math.round(diff / 86400)} يوم`;
}

/* ────────────── OVERVIEW TAB ────────────── */
function OverviewTab() {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ["storage-stats"],
    queryFn: () => api("/storage/stats").then(r => r.json()),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-white/50">جارٍ التحميل...</div>;

  const catColors: Record<string, string> = {
    document: "bg-blue-500", image: "bg-green-500", video: "bg-purple-500",
    contract: "bg-amber-500", invoice: "bg-cyan-500", evidence: "bg-red-500", other: "bg-gray-500",
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الملفات",   value: stats?.totalFiles ?? 0,        icon: FileText,  color: "text-blue-400" },
          { label: "المساحة المستخدمة", value: stats?.totalFmt ?? "0 B",      icon: HardDrive, color: "text-emerald-400" },
          { label: "مؤرشفة",           value: stats?.archivedCount ?? 0,      icon: Archive,   color: "text-amber-400" },
          { label: "سلة المحذوفات",    value: stats?.trashCount ?? 0,         icon: Trash2,    color: "text-red-400" },
        ].map(c => (
          <Card key={c.label} className="bg-white/5 border-white/10">
            <CardContent className="pt-4 pb-3">
              <c.icon className={`w-5 h-5 mb-2 ${c.color}`} />
              <div className="text-xl font-bold text-white">{c.value}</div>
              <div className="text-xs text-white/50 mt-0.5">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quota Bar */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-white/70 flex items-center gap-2">
            <HardDrive className="w-4 h-4" /> الحصة التخزينية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between text-sm text-white/60 mb-2">
            <span>{stats?.quota?.usedFmt ?? "0 B"} مستخدم</span>
            <span>{stats?.quota?.maxFmt ?? "5 GB"} إجمالي</span>
          </div>
          <Progress value={stats?.quota?.pct ?? 0} className="h-3 bg-white/10" />
          <div className="text-xs text-white/40 mt-1">{stats?.quota?.pct ?? 0}% مستخدم</div>
        </CardContent>
      </Card>

      {/* By Category */}
      {(stats?.byCategory ?? []).length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/70">التوزيع حسب النوع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats.byCategory ?? []).map((cat: any) => {
              const pct = stats.totalBytes > 0 ? Math.round((Number(cat.bytes) / stats.totalBytes) * 100) : 0;
              return (
                <div key={cat.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/70">{categoryIcon(cat.category)} {categoryLabel(cat.category)}</span>
                    <span className="text-white/50">{cat.cnt} ملف • {fmtBytes(Number(cat.bytes))}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${catColors[cat.category] ?? "bg-gray-500"} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent Files */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2 flex-row justify-between items-center">
          <CardTitle className="text-sm text-white/70">آخر الملفات المرفوعة</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-white/40 hover:text-white h-7 w-7 p-0">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {(stats?.recentFiles ?? []).length === 0 ? (
            <p className="text-center text-white/30 py-6 text-sm">لا توجد ملفات</p>
          ) : (
            <div className="space-y-2">
              {(stats.recentFiles ?? []).map((f: any) => (
                <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{categoryIcon(f.category)}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate max-w-[220px]">{f.original_name}</p>
                      <p className="text-xs text-white/40">{fmtBytes(Number(f.file_size))} • {timeAgo(f.created_at)}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs border-white/10 text-white/50 shrink-0">
                    {categoryLabel(f.category)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────────── FILE MANAGER TAB ────────────── */
function FileManagerTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "archived" | "deleted">("active");
  const [cat, setCat] = useState("");

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["storage-files", search, filter, cat],
    queryFn: () => api(`/storage/files?search=${search}&archived=${filter === "archived"}&deleted=${filter === "deleted"}&category=${cat}`).then(r => r.json()),
    refetchInterval: false,
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => api(`/storage/files/${id}/archive`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage-files"] }); qc.invalidateQueries({ queryKey: ["storage-stats"] }); toast.success("تم تحديث الأرشيف"); },
  });

  const trashMut = useMutation({
    mutationFn: (id: string) => api(`/storage/files/${id}/trash`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage-files"] }); qc.invalidateQueries({ queryKey: ["storage-stats"] }); toast.success("نُقل إلى سلة المحذوفات"); },
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => api(`/storage/files/${id}/restore`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage-files"] }); toast.success("تمت الاستعادة"); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/storage/files/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage-files"] }); qc.invalidateQueries({ queryKey: ["storage-stats"] }); toast.success("حُذف نهائياً"); },
  });

  const emptyTrashMut = useMutation({
    mutationFn: () => api("/storage/trash/empty", { method: "DELETE" }).then(r => r.json()),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["storage-files"] }); qc.invalidateQueries({ queryKey: ["storage-stats"] }); toast.success(`فُرّغت سلة المحذوفات — تم توفير ${d.freedFmt ?? "0 B"}`); },
  });

  const categories = ["", "document", "image", "video", "contract", "invoice", "evidence", "other"];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="ابحث عن ملف..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 flex-1"
        />
        <div className="flex gap-2 flex-wrap">
          {(["active", "archived", "deleted"] as const).map(v => (
            <Button key={v} size="sm" variant={filter === v ? "default" : "outline"}
              onClick={() => setFilter(v)}
              className={filter === v ? "bg-amber-500 text-black border-0" : "border-white/10 text-white/60 hover:text-white bg-transparent"}>
              {v === "active" ? "نشط" : v === "archived" ? "مؤرشف" : "المحذوفات"}
            </Button>
          ))}
        </div>
        <select value={cat} onChange={e => setCat(e.target.value)}
          className="bg-white/5 border border-white/10 text-white/70 rounded-md px-3 py-1.5 text-sm">
          {categories.map(c => <option key={c} value={c} className="bg-[#0B1B2B]">{c === "" ? "كل الأنواع" : categoryLabel(c)}</option>)}
        </select>
        {filter === "deleted" && (
          <Button size="sm" variant="destructive" onClick={() => emptyTrashMut.mutate()} disabled={emptyTrashMut.isPending}>
            <Trash2 className="w-4 h-4 ml-1" /> إفراغ السلة
          </Button>
        )}
      </div>

      {/* File List */}
      {isLoading ? (
        <div className="text-center text-white/40 py-12">جارٍ التحميل...</div>
      ) : (files as any[]).length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">لا توجد ملفات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(files as any[]).map((f: any) => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-xl shrink-0">
                  {categoryIcon(f.category)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate max-w-[280px]">{f.original_name}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {fmtBytes(Number(f.file_size))} • {categoryLabel(f.category)} • {timeAgo(f.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {f.is_archived && <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">مؤرشف</Badge>}
                {f.file_url && (
                  <Button size="sm" variant="ghost" className="text-white/40 hover:text-white h-7 w-7 p-0" asChild>
                    <a href={f.file_url} target="_blank" rel="noreferrer"><Eye className="w-3.5 h-3.5" /></a>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-white/40 hover:text-white h-7 w-7 p-0">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#0B1B2B] border-white/10 text-white text-sm">
                    {!f.is_deleted && (
                      <DropdownMenuItem onClick={() => archiveMut.mutate(f.id)}>
                        <Archive className="w-4 h-4 ml-2" /> {f.is_archived ? "إلغاء الأرشفة" : "أرشفة"}
                      </DropdownMenuItem>
                    )}
                    {!f.is_deleted && (
                      <DropdownMenuItem onClick={() => trashMut.mutate(f.id)} className="text-red-400">
                        <Trash2 className="w-4 h-4 ml-2" /> نقل للمحذوفات
                      </DropdownMenuItem>
                    )}
                    {f.is_deleted && (
                      <DropdownMenuItem onClick={() => restoreMut.mutate(f.id)}>
                        <RefreshCw className="w-4 h-4 ml-2" /> استعادة
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => { if (confirm("حذف نهائي؟")) deleteMut.mutate(f.id); }} className="text-red-400">
                      <Trash2 className="w-4 h-4 ml-2" /> حذف نهائي
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────── AI ANALYSIS TAB ────────────── */
function AiAnalysisTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["storage-ai"],
    queryFn: () => api("/storage/ai-analysis").then(r => r.json()),
  });

  if (isLoading) return <div className="text-center text-white/40 py-16">جارٍ تحليل التخزين...</div>;

  return (
    <div className="space-y-6">
      {/* Suggestions */}
      <Card className="bg-gradient-to-br from-amber-900/30 to-amber-800/10 border-amber-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-amber-300 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> تحليل الذكاء الاصطناعي
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.summary?.suggestions ?? []).length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> التخزين في حالة ممتازة — لا توجد توصيات
            </div>
          ) : (
            <div className="space-y-2">
              {(data.summary.suggestions as string[]).map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-white/80 p-2 bg-amber-500/10 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  {s}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-4 mt-4 text-xs text-white/40">
            <span>يمكن توفير (مكرر): <span className="text-amber-300">{data?.summary?.wastedFmt ?? "0 B"}</span></span>
            <span>قابل للأرشفة: <span className="text-blue-300">{data?.summary?.archivableFmt ?? "0 B"}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Large Files */}
      {(data?.largeFiles ?? []).length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/70 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> الملفات الكبيرة (أكبر من 10MB)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.largeFiles as any[]).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <div className="flex items-center gap-2 min-w-0">
                  <span>{categoryIcon(f.category)}</span>
                  <span className="text-sm text-white/80 truncate max-w-[240px]">{f.original_name}</span>
                </div>
                <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs shrink-0">{fmtBytes(Number(f.file_size))}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Duplicates */}
      {(data?.duplicates ?? []).length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/70 flex items-center gap-2">
              <Copy2 className="w-4 h-4" /> ملفات مكررة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.duplicates as any[]).map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <div className="min-w-0">
                  <p className="text-sm text-white/80 truncate max-w-[240px]">{d.sample_name}</p>
                  <p className="text-xs text-white/40">{d.cnt} نسخ مكررة</p>
                </div>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">وفّر {fmtBytes(Number(d.wasted_bytes))}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Old Files */}
      {(data?.oldFiles ?? []).length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/70 flex items-center gap-2">
              <Archive className="w-4 h-4" /> ملفات قديمة (أكبر من 180 يوم)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.oldFiles as any[]).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-sm text-white/70 truncate max-w-[280px]">{f.original_name}</span>
                <span className="text-xs text-white/40 shrink-0">{timeAgo(f.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Button variant="outline" size="sm" onClick={() => refetch()} className="border-white/10 text-white/60 hover:text-white bg-transparent">
        <RefreshCw className="w-4 h-4 ml-2" /> إعادة التحليل
      </Button>
    </div>
  );
}

/* ────────────── SETTINGS TAB ────────────── */
function SettingsTab() {
  const { user } = useUser();
  const qc = useQueryClient();
  const isSA = user?.publicMetadata?.role === "super_admin" ||
    user?.primaryEmailAddress?.emailAddress === import.meta.env.VITE_SUPER_ADMIN_EMAILS;

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["storage-settings"],
    queryFn: () => api("/storage/settings").then(r => r.json()),
    enabled: isSA,
  });

  const [vals, setVals] = useState<Record<string, string>>({});

  const saveMut = useMutation({
    mutationFn: (settings: Record<string, string>) =>
      api("/storage/settings", { method: "PATCH", body: JSON.stringify({ settings }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage-settings"] }); toast.success("تم حفظ الإعدادات"); },
  });

  if (!isSA) return (
    <div className="text-center py-16">
      <Shield className="w-12 h-12 text-white/20 mx-auto mb-3" />
      <p className="text-white/40">هذا القسم للمشرف العام فقط</p>
    </div>
  );

  if (isLoading) return <div className="text-center text-white/40 py-12">جارٍ التحميل...</div>;

  const labelMap: Record<string, string> = {
    default_provider:      "مزود التخزين الافتراضي",
    max_file_size_mb:      "الحجم الأقصى للملف (MB)",
    default_quota_gb:      "الحصة الافتراضية لكل مكتب (GB)",
    auto_archive_days:     "أرشفة تلقائية بعد (أيام)",
    trash_retention_days:  "الاحتفاظ بالمحذوفات (أيام)",
    dedup_enabled:         "تفعيل منع التكرار",
    allowed_types:         "أنواع الملفات المسموحة",
    r2_endpoint:           "نقطة نهاية Cloudflare R2",
    r2_bucket:             "اسم Bucket في R2",
    telegram_chat_id:      "معرف دردشة Telegram للنسخ الاحتياطي",
  };

  const val = (key: string, def: string) => (key in vals ? vals[key] : def) ?? "";

  return (
    <div className="space-y-6">
      {/* Provider */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-white/70">مزود التخزين</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {["replit", "cloudflare-r2", "local"].map(p => {
              const currentVal = val("default_provider", "replit");
              return (
                <button key={p} onClick={() => setVals(v => ({ ...v, default_provider: p }))}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${currentVal === p ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"}`}>
                  {p === "replit" ? "🟢 Replit Storage" : p === "cloudflare-r2" ? "☁️ Cloudflare R2" : "💾 تخزين محلي"}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* All Settings */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-white/70">إعدادات متقدمة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(settings as any[]).map((s: any) => {
            const label = labelMap[s.setting_key] ?? s.setting_key;
            const v = val(s.setting_key, s.setting_value ?? "");
            if (s.setting_type === "boolean") {
              return (
                <div key={s.setting_key} className="flex items-center justify-between">
                  <Label className="text-sm text-white/70">{label}</Label>
                  <Switch checked={v === "true"} onCheckedChange={ch => setVals(x => ({ ...x, [s.setting_key]: ch ? "true" : "false" }))}
                    className="data-[state=checked]:bg-amber-500" />
                </div>
              );
            }
            return (
              <div key={s.setting_key}>
                <Label className="text-xs text-white/50 mb-1 block">{label}</Label>
                <Input value={v} onChange={e => setVals(x => ({ ...x, [s.setting_key]: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-8 text-sm" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button onClick={() => saveMut.mutate(vals)} disabled={saveMut.isPending || Object.keys(vals).length === 0}
        className="bg-amber-500 hover:bg-amber-400 text-black font-bold">
        {saveMut.isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
      </Button>
    </div>
  );
}

/* ────────────── MAIN PAGE ────────────── */
export default function StorageSettings() {
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-[#0B1B2B] via-[#0D2137] to-[#0B1B2B] p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-amber-400" />
              </div>
              إدارة التخزين الذكي
            </h1>
            <p className="text-white/40 mt-1 text-sm">رفع الملفات · الأرشفة · تحليل المساحة · الإعدادات</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" dir="rtl">
          <TabsList className="bg-white/5 border border-white/10 mb-6 flex-wrap h-auto gap-1 p-1">
            {[
              { value: "overview",  label: "نظرة عامة",  icon: BarChart3 },
              { value: "files",     label: "مستعرض الملفات", icon: FolderOpen },
              { value: "ai",        label: "تحليل ذكي",  icon: Zap },
              { value: "settings",  label: "الإعدادات",  icon: Settings },
            ].map(t => (
              <TabsTrigger key={t.value} value={t.value}
                className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-white/60 flex items-center gap-1.5 text-sm">
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="files"><FileManagerTab /></TabsContent>
          <TabsContent value="ai"><AiAnalysisTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
