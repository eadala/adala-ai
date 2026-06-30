/**
 * لوحة البنية التحتية — Infrastructure Management
 * ─────────────────────────────────────────────────────────────────
 * Super Admin only.
 * Tabs:
 *   1. نظرة عامة  — Architecture diagram + platform KPIs
 *   2. مصفوفة المكاتب — per-office isolation tier + storage + encryption
 *   3. قاعدة البيانات — table sizes, row counts, connections
 *   4. مصفوفة التخزين — storage breakdown per office
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Database, HardDrive, Shield, Server,
  Building2, Key, RefreshCw, TrendingUp, Layers,
  ArrowUpRight, CheckCircle2, Lock, Unlock, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/features/super-admin/shared/api";

/* ── helpers ────────────────────────────────────────────────── */
function fmtBytes(b: number): string {
  if (!b) return "0 B";
  const u = ["B","KB","MB","GB","TB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

const ISOLATION_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  shared:       { label: "مشترك",     color: "text-gray-400",  bg: "bg-gray-500/10",  icon: Unlock },
  professional: { label: "احترافي",  color: "text-blue-400",  bg: "bg-blue-500/10",  icon: Database },
  enterprise:   { label: "مؤسسي",    color: "text-emerald-400", bg: "bg-emerald-500/10", icon: Lock },
};

/* ══════════════════════════════════════════════════════════════
   1) ARCHITECTURE OVERVIEW
══════════════════════════════════════════════════════════════ */
function ArchitectureView({ data }: { data: any }) {
  const layers = [
    {
      label: "طبقة المنصة المشتركة",
      color: "border-blue-500/40 bg-blue-500/5",
      badge: "bg-blue-500/20 text-blue-300",
      items: ["Frontend", "Backend APIs", "AI Services", "Billing", "SOC", "Notifications"],
      note: "مشترك بين جميع المكاتب — مُدار مركزياً",
    },
    {
      label: "طبقة البيانات",
      color: "border-primary/40 bg-primary/5",
      badge: "bg-primary/20 text-primary",
      items: ["PostgreSQL Cluster", "RLS + office_id", "JWT Auth", "Drizzle ORM"],
      note: `${data?.offices?.total_offices ?? 0} مكتب — عزل منطقي كامل`,
    },
    {
      label: "طبقة التخزين",
      color: "border-emerald-500/40 bg-emerald-500/5",
      badge: "bg-emerald-500/20 text-emerald-300",
      items: ["Object Storage", "office-{id}/ prefix", "Signed URLs", "ACL per file"],
      note: "مجلد خاص لكل مكتب — عزل تخزيني",
    },
    {
      label: "طبقة المؤسسات (اختياري)",
      color: "border-yellow-500/40 bg-yellow-500/5",
      badge: "bg-yellow-500/20 text-yellow-300",
      items: ["Dedicated DB (Enterprise)", "Dedicated Bucket", "Encryption Keys", "Isolated Backups"],
      note: "متاح للعملاء المؤسسيين فقط",
    },
  ];

  return (
    <div className="space-y-3">
      {layers.map((layer, i) => (
        <div key={i} className={cn("rounded-xl border p-4", layer.color)}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-sm">{layer.label}</span>
            </div>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", layer.badge)}>
              {layer.note}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {layer.items.map(item => (
              <span key={item} className="text-xs bg-background/60 border border-border/40 px-2 py-1 rounded-lg">
                {item}
              </span>
            ))}
          </div>
          {i < layers.length - 1 && (
            <div className="flex justify-center mt-3">
              <ArrowUpRight className="h-4 w-4 text-muted-foreground rotate-90 opacity-40" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   2) OFFICES MATRIX
══════════════════════════════════════════════════════════════ */
function OfficesMatrix({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const [editOffice, setEditOffice] = useState<any>(null);
  const [form, setForm] = useState({ isolation_mode: "shared", dedicated_bucket: "", notes: "" });

  const { data: offices = [], isLoading } = useQuery<any[]>({
    queryKey: ["infra", "offices"],
    queryFn: () => API("/infrastructure/offices"),
  });

  const upgradeMut = useMutation({
    mutationFn: ({ id, ...body }: any) => API(`/infrastructure/offices/${id}/isolation`, {
      method: "POST", body: JSON.stringify(body),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["infra"] });
      setEditOffice(null);
      toast({ title: "✅ تم تحديث مستوى العزل" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const genKeyMut = useMutation({
    mutationFn: (id: string) => API(`/infrastructure/offices/${id}/generate-key`, { method: "POST" }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["infra"] });
      toast({ title: `🔑 تم إنشاء مفتاح: ${d.keyHint}` });
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <>
      <div className="space-y-3">
        {(offices as any[]).map((o: any) => {
          const meta = ISOLATION_META[o.isolation_mode] ?? ISOLATION_META.shared;
          const ModeIcon = meta.icon;
          const usedPct = o.storage_quota > 0 ? Math.round((o.storage_used / o.storage_quota) * 100) : 0;
          return (
            <Card key={o.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  {/* Office */}
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{o.name}</p>
                        <p className="text-[10px] text-muted-foreground">{o.subscription_plan ?? "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Isolation Mode */}
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">مستوى العزل</p>
                    <Badge className={cn("text-xs gap-1", meta.color, meta.bg)}>
                      <ModeIcon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>

                  {/* Storage */}
                  <div className="md:col-span-1">
                    <p className="text-[10px] text-muted-foreground mb-1">
                      التخزين {fmtBytes(o.storage_used)} / {fmtBytes(o.storage_quota)}
                    </p>
                    <Progress value={usedPct} className={cn("h-1.5",
                      usedPct > 90 ? "[&>div]:bg-red-500" : usedPct > 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500"
                    )} />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{o.files_count} ملف</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end">
                    {o.encryption_key_hint ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <Key className="h-3 w-3" /> {o.encryption_key_hint}
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                        onClick={() => genKeyMut.mutate(o.id)} disabled={genKeyMut.isPending}>
                        <Key className="h-3 w-3" /> مفتاح
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => { setEditOffice(o); setForm({ isolation_mode: o.isolation_mode, dedicated_bucket: o.dedicated_bucket ?? "", notes: "" }); }}>
                      <ArrowUpRight className="h-3 w-3" /> ترقية
                    </Button>
                  </div>
                </div>

                {/* Dedicated bucket indicator */}
                {o.dedicated_bucket && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400">
                    <FolderOpen className="h-3 w-3" />
                    Bucket: {o.dedicated_bucket}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit */}
      <AdaptiveDialog open={!!editOffice} onOpenChange={() => setEditOffice(null)}>
        <AdaptiveDialogContent className="sm:max-w-[440px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              ترقية عزل: {editOffice?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Tier cards */}
            <div className="grid grid-cols-3 gap-2">
              {(["shared", "professional", "enterprise"] as const).map(tier => {
                const m = ISOLATION_META[tier];
                const Icon = m.icon;
                return (
                  <button key={tier} onClick={() => setForm(f => ({ ...f, isolation_mode: tier }))}
                    className={cn("p-3 rounded-xl border text-center transition-all",
                      form.isolation_mode === tier
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/50 hover:border-border")}>
                    <Icon className={cn("h-5 w-5 mx-auto mb-1", m.color)} />
                    <p className="text-xs font-bold">{m.label}</p>
                  </button>
                );
              })}
            </div>

            {/* Tier descriptions */}
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 leading-relaxed">
              {form.isolation_mode === "shared"       && "قاعدة بيانات مشتركة + تخزين مشترك مع عزل بـ office_id و RLS. مثالي للباقات الأساسية."}
              {form.isolation_mode === "professional" && "قاعدة بيانات مشتركة + مجلد تخزين مخصص (Dedicated Bucket) + مفتاح تشفير خاص."}
              {form.isolation_mode === "enterprise"   && "قاعدة بيانات مخصصة + Bucket مخصص + مفاتيح تشفير خاصة + نسخ احتياطي مستقل."}
            </div>

            {form.isolation_mode !== "shared" && (
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">اسم الـ Bucket المخصص</Label>
                <Input placeholder="office-a-bucket" value={form.dedicated_bucket}
                  onChange={e => setForm(f => ({ ...f, dedicated_bucket: e.target.value }))} className="text-sm ltr" />
              </div>
            )}
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={() => upgradeMut.mutate({ id: editOffice.id, ...form })}
              disabled={upgradeMut.isPending} className="gap-2 bg-primary hover:bg-primary/90 text-white font-bold">
              {upgradeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              تطبيق
            </Button>
            <Button variant="outline" onClick={() => setEditOffice(null)}>إلغاء</Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   3) DB STATS
══════════════════════════════════════════════════════════════ */
function DbStatsView() {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["infra", "db-stats"],
    queryFn: () => API("/infrastructure/db-stats"),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const tables: any[] = data?.tables ?? [];
  const conn = data?.connections ?? {};
  const maxBytes = Math.max(...tables.map((t: any) => Number(t.bytes) || 0), 1);

  return (
    <div className="space-y-4">
      {/* Connections */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي الاتصالات", value: conn.total_connections ?? 0, color: "text-primary" },
          { label: "نشطة",             value: conn.active_connections ?? 0, color: "text-emerald-500" },
          { label: "خاملة",            value: conn.idle_connections ?? 0,   color: "text-amber-500" },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-3 text-center">
              <div className={cn("text-2xl font-black", c.color)}>{c.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tables */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><Database className="h-4 w-4" /> الجداول</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-y-auto">
          {tables.map((t: any) => (
            <div key={t.table_name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-mono text-muted-foreground">{t.table_name}</span>
                <div className="flex gap-3">
                  <span className="text-muted-foreground">{Number(t.row_count).toLocaleString()} صف</span>
                  <span className="font-medium">{t.size}</span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full transition-all"
                  style={{ width: `${Math.round((Number(t.bytes) / maxBytes) * 100)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   4) STORAGE MATRIX
══════════════════════════════════════════════════════════════ */
function StorageMatrix() {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["infra", "storage-matrix"],
    queryFn: () => API("/infrastructure/storage-matrix"),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const totalUsed  = (data as any[]).reduce((s: number, o: any) => s + Number(o.used_bytes), 0);
  const totalQuota = (data as any[]).reduce((s: number, o: any) => s + Number(o.max_bytes), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي المستخدم", value: fmtBytes(totalUsed), color: "text-primary" },
          { label: "إجمالي الحصص",   value: fmtBytes(totalQuota), color: "text-blue-400" },
          { label: "نسبة الاستخدام",  value: `${totalQuota > 0 ? Math.round((totalUsed/totalQuota)*100) : 0}%`, color: "text-emerald-400" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={cn("text-xl font-black", s.color)}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-office bars */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><HardDrive className="h-4 w-4" /> تخزين المكاتب</CardTitle></CardHeader>
        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
          {(data as any[]).map((o: any) => {
            const pct = o.max_bytes > 0 ? Math.round((o.used_bytes / o.max_bytes) * 100) : 0;
            const meta = ISOLATION_META[o.isolation_mode] ?? ISOLATION_META.shared;
            return (
              <div key={o.office_id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium flex items-center gap-2">
                    {o.office_name}
                    <Badge className={cn("text-[9px] px-1.5", meta.color, meta.bg)}>{meta.label}</Badge>
                  </span>
                  <span className="text-muted-foreground">{fmtBytes(o.used_bytes)} / {fmtBytes(o.max_bytes)}</span>
                </div>
                <Progress value={pct} className={cn("h-2",
                  pct > 90 ? "[&>div]:bg-red-500" : pct > 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500"
                )} />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{o.files_count} ملف</span>
                  {o.dedicated_bucket && <span className="text-emerald-400 flex items-center gap-1"><FolderOpen className="h-3 w-3" />{o.dedicated_bucket}</span>}
                  <span>{pct}%</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN TAB COMPONENT
══════════════════════════════════════════════════════════════ */
export function InfrastructureTab({ toast }: { toast: any }) {
  const { data: overview, isLoading } = useQuery<any>({
    queryKey: ["infra", "overview"],
    queryFn: () => API("/infrastructure/overview"),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Server className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-black text-lg">البنية التحتية</h2>
          <p className="text-xs text-muted-foreground">إدارة طبقات العزل وقاعدة البيانات والتخزين لكل مكتب</p>
        </div>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "حجم قاعدة البيانات",   value: overview?.database?.size ?? "—",             icon: Database,    color: "text-blue-500" },
            { label: "إجمالي المكاتب",       value: overview?.offices?.total_offices ?? 0,        icon: Building2,   color: "text-primary" },
            { label: "مكاتب مؤسسية",         value: overview?.offices?.enterprise_offices ?? 0,   icon: Shield,      color: "text-emerald-500" },
            { label: "إجمالي التخزين",       value: fmtBytes(overview?.storage?.total_used ?? 0), icon: HardDrive,   color: "text-amber-500" },
          ].map(k => {
            const Icon = k.icon;
            return (
              <Card key={k.label}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn("h-4 w-4", k.color)} />
                    <span className="text-xs text-muted-foreground">{k.label}</span>
                  </div>
                  <div className={cn("text-xl font-black", k.color)}>{String(k.value)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Isolation distribution */}
      {overview?.isolation && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "shared",       label: "مشترك",   color: "text-gray-400",    bg: "bg-gray-500/10" },
            { key: "professional", label: "احترافي", color: "text-blue-400",   bg: "bg-blue-500/10" },
            { key: "enterprise",   label: "مؤسسي",   color: "text-emerald-400", bg: "bg-emerald-500/10" },
          ].map(t => (
            <div key={t.key} className={cn("rounded-xl p-3 text-center border", t.bg)}>
              <div className={cn("text-2xl font-black", t.color)}>{overview.isolation[t.key] ?? 0}</div>
              <div className="text-xs text-muted-foreground">{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <Tabs defaultValue="architecture">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="architecture" className="text-xs"><Layers className="h-3.5 w-3.5 ml-1" /> المعمارية</TabsTrigger>
          <TabsTrigger value="offices"      className="text-xs"><Building2 className="h-3.5 w-3.5 ml-1" /> المكاتب</TabsTrigger>
          <TabsTrigger value="database"     className="text-xs"><Database className="h-3.5 w-3.5 ml-1" /> قاعدة البيانات</TabsTrigger>
          <TabsTrigger value="storage"      className="text-xs"><HardDrive className="h-3.5 w-3.5 ml-1" /> التخزين</TabsTrigger>
        </TabsList>

        <TabsContent value="architecture" className="mt-4">
          {overview ? <ArchitectureView data={overview} /> : <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        </TabsContent>

        <TabsContent value="offices" className="mt-4">
          <OfficesMatrix toast={toast} />
        </TabsContent>

        <TabsContent value="database" className="mt-4">
          <DbStatsView />
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <StorageMatrix />
        </TabsContent>
      </Tabs>
    </div>
  );
}
