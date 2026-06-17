import { useState } from "react";
import { useListCases, useCreateCase } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button }          from "@/components/ui/button";
import { Input }           from "@/components/ui/input";
import { Badge }           from "@/components/ui/badge";
import { Skeleton }        from "@/components/ui/skeleton";
import { Link }            from "wouter";
import {
  Search, Plus, Scale, Clock, CheckCheck, Filter,
  LayoutGrid, List, MoreHorizontal, Upload,
  ChevronRight, Users, Briefcase, TrendingUp,
  Trash2,
} from "lucide-react";
import { ImportDialog }    from "@/components/import-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label }           from "@/components/ui/label";
import { Textarea }        from "@/components/ui/textarea";
import { useToast }        from "@/hooks/use-toast";
import { getListCasesQueryKey } from "@workspace/api-client-react";
import { useLang }         from "@/hooks/use-lang";
import { cn }              from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ─── Config ─── */
const STATUS_CFG = {
  open:        { label: "مفتوحة",       icon: Scale,      color: "text-blue-600",    bg: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "قيد التنفيذ",  icon: Clock,      color: "text-amber-600",   bg: "bg-amber-50 text-amber-700 border-amber-200" },
  closed:      { label: "مغلقة",        icon: CheckCheck, color: "text-muted-foreground",   bg: "bg-muted/30 text-muted-foreground border-border" },
} as const;

const TYPE_MAP: Record<string, string> = {
  criminal:    "جنائية",
  civil:       "مدنية",
  commercial:  "تجارية",
  labor:       "عمالية",
  real_estate: "عقارية",
};

const TYPE_COLOR: Record<string, string> = {
  criminal:    "bg-red-50 text-red-700 border-red-200",
  civil:       "bg-violet-50 text-violet-700 border-violet-200",
  commercial:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  labor:       "bg-orange-50 text-orange-700 border-orange-200",
  real_estate: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

/* ─── Stat card ─── */
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("p-3 rounded-xl", color.replace("text-", "bg-").replace("-600", "-100").replace("-500", "-100"))}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Kanban card ─── */
function KanbanCard({ c }: { c: any }) {
  const typeCfg = TYPE_COLOR[c.caseType] ?? "bg-muted/30 text-foreground/70 border-border";
  return (
    <Link href={`/cases/${c.id}`}>
      <div className="group bg-card border rounded-xl p-4 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors">{c.title}</h3>
          <Badge variant="outline" className={cn("text-xs shrink-0", typeCfg)}>{TYPE_MAP[c.caseType] ?? c.caseType}</Badge>
        </div>
        {c.clientName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{c.clientName}</span>
          </div>
        )}
        {c.assignedTo && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Briefcase className="h-3 w-3" />
            <span>{c.assignedTo}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{new Date(c.createdAt).toLocaleDateString("ar-SA")}</span>
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

/* ─── Main ─── */
export default function Cases() {
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatus]     = useState<string>("all");
  const [typeFilter, setType]         = useState<string>("all");
  const [view, setView]               = useState<"table" | "kanban">("table");
  const [importOpen, setImportOpen]   = useState(false);
  const [newOpen, setNewOpen]         = useState(false);
  const [clientInput, setClientInput] = useState<"select" | "text">("select");
  const [form, setForm]               = useState({ title: "", caseType: "civil", clientName: "", description: "" });

  const { data: cases, isLoading }    = useListCases();
  const { data: stats }               = useQuery<any>({
    queryKey: ["cases-stats"],
    queryFn:  () => fetch(`${BASE}/api/cases/stats`).then(r => r.json()),
    staleTime: 30_000,
  });
  const { data: clientsList = [] }    = useQuery<{ id: string; fullName: string }[]>({
    queryKey: ["clients-for-cases"],
    queryFn:  () => fetch(`${BASE}/api/clients`).then(r => r.ok ? r.json() : []),
    staleTime: 60_000,
  });
  const createCase  = useCreateCase();
  const { toast }   = useToast();
  const qc          = useQueryClient();
  const { dir }     = useLang();

  const invalidateCases = () => {
    qc.invalidateQueries({ queryKey: getListCasesQueryKey() });
    qc.invalidateQueries({ queryKey: ["cases-stats"] });
  };

  const updateCaseMut = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      fetch(`${BASE}/api/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { invalidateCases(); toast({ title: "✅ تم تحديث القضية" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteCaseMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/api/cases/${id}`, { method: "DELETE" })
        .then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { invalidateCases(); toast({ title: "🗑️ تم حذف القضية" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = cases?.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.title.toLowerCase().includes(q) || (c.clientName ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchType   = typeFilter   === "all" || c.caseType === typeFilter;
    return matchSearch && matchStatus && matchType;
  }) ?? [];

  const kanbanCols: Array<{ key: string; label: string; color: string }> = [
    { key: "open",        label: "مفتوحة",       color: "border-t-blue-500"  },
    { key: "in_progress", label: "قيد التنفيذ",  color: "border-t-amber-500" },
    { key: "closed",      label: "مغلقة",         color: "border-t-slate-400" },
  ];

  const handleCreate = () => {
    if (!form.title.trim()) return;
    createCase.mutate(
      { data: { title: form.title, caseType: form.caseType, clientName: form.clientName, description: form.description, status: "open" } as any },
      {
        onSuccess: () => {
          setNewOpen(false);
          setForm({ title: "", caseType: "civil", clientName: "", description: "" });
          setClientInput("select");
          invalidateCases();
          toast({ title: "✅ تم إنشاء القضية بنجاح" });
        },
        onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleDeleteCase = (id: string, title: string) => {
    if (!window.confirm(`هل تريد حذف القضية "${title}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    deleteCaseMut.mutate(id);
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">القضايا</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة قضايا المكتب القانوني</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 me-2" />استيراد CSV
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 me-2" />قضية جديدة
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي القضايا" value={stats?.total ?? cases?.length ?? 0}           icon={Briefcase}  color="text-primary" />
        <StatCard label="مفتوحة"          value={stats?.open ?? 0}                             icon={Scale}       color="text-blue-600" />
        <StatCard label="قيد التنفيذ"     value={stats?.inProgress ?? 0}                       icon={Clock}       color="text-amber-600" />
        <StatCard label="مغلقة"           value={stats?.closed ?? 0}                           icon={CheckCheck}  color="text-muted-foreground" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Status pills */}
        <div className="flex gap-1 flex-wrap">
          {[{ key: "all", label: "الكل" }, ...Object.entries(STATUS_CFG).map(([k, v]) => ({ key: k, label: v.label }))].map(s => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                statusFilter === s.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              )}
            >{s.label}</button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Type select */}
        <Select value={typeFilter} onValueChange={setType}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="نوع القضية" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {Object.entries(TYPE_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9 h-8 w-52 text-sm"
            placeholder="بحث..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* View toggle */}
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setView("table")} className={cn("p-1.5 transition-colors", view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setView("kanban")} className={cn("p-1.5 transition-colors", view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20 space-y-3">
          <Scale className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">لا توجد قضايا مطابقة</p>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 me-2" />إضافة أول قضية
          </Button>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {!isLoading && filtered.length > 0 && view === "table" && (
        <>
          {/* ─── Desktop Table (md+) ─── */}
          <Card className="border shadow-sm overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">القضية</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">الموكل</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">النوع</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">المحامي</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">تاريخ الإنشاء</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const s = STATUS_CFG[c.status as keyof typeof STATUS_CFG];
                    return (
                      <tr key={c.id} className={cn("border-b transition-colors hover:bg-muted/20 group", i % 2 === 0 ? "" : "bg-muted/5")}>
                        <td className="px-4 py-3.5">
                          <Link href={`/cases/${c.id}`}>
                            <span className="font-medium text-foreground group-hover:text-primary transition-colors cursor-pointer line-clamp-1 max-w-xs block">
                              {c.title}
                            </span>
                          </Link>
                          {c.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">{c.description}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{c.clientName ?? "—"}</td>
                        <td className="px-4 py-3.5">
                          <Badge variant="outline" className={cn("text-xs", TYPE_COLOR[c.caseType] ?? "")}>
                            {TYPE_MAP[c.caseType] ?? c.caseType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{c.assignedTo ?? "—"}</td>
                        <td className="px-4 py-3.5">
                          {s && (
                            <Badge variant="outline" className={cn("text-xs gap-1.5", s.bg)}>
                              <s.icon className="h-3 w-3" />
                              {s.label}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("ar-SA") : "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/cases/${c.id}`}>عرض التفاصيل</Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {c.status !== "open" && (
                                <DropdownMenuItem onClick={() => updateCaseMut.mutate({ id: c.id, status: "open" })}>
                                  <Scale className="h-3.5 w-3.5 me-2 text-blue-500" />تحويل إلى مفتوحة
                                </DropdownMenuItem>
                              )}
                              {c.status !== "in_progress" && (
                                <DropdownMenuItem onClick={() => updateCaseMut.mutate({ id: c.id, status: "in_progress" })}>
                                  <Clock className="h-3.5 w-3.5 me-2 text-amber-500" />قيد التنفيذ
                                </DropdownMenuItem>
                              )}
                              {c.status !== "closed" && (
                                <DropdownMenuItem onClick={() => updateCaseMut.mutate({ id: c.id, status: "closed" })}>
                                  <CheckCheck className="h-3.5 w-3.5 me-2 text-muted-foreground" />إغلاق القضية
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-500"
                                onClick={() => handleDeleteCase(c.id, c.title)}
                              >
                                <Trash2 className="h-3.5 w-3.5 me-2" />حذف القضية
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-muted/10 border-t text-xs text-muted-foreground">
              {filtered.length} قضية
            </div>
          </Card>

          {/* ─── Mobile Cards (< md) ─── */}
          <div className="md:hidden space-y-2.5">
            {filtered.map(c => {
              const s = STATUS_CFG[c.status as keyof typeof STATUS_CFG];
              return (
                <Link key={c.id} href={`/cases/${c.id}`}>
                  <div className="data-card flex items-start gap-3">
                    {/* Status color strip */}
                    <div className={cn(
                      "mt-1 w-1 self-stretch rounded-full shrink-0",
                      c.status === "open"        ? "bg-blue-500" :
                      c.status === "in_progress" ? "bg-amber-500" : "bg-slate-300"
                    )} />

                    <div className="flex-1 min-w-0">
                      {/* Title + type */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-foreground line-clamp-2 leading-tight flex-1">
                          {c.title}
                        </p>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", TYPE_COLOR[c.caseType] ?? "")}>
                          {TYPE_MAP[c.caseType] ?? c.caseType}
                        </Badge>
                      </div>

                      {/* Client + lawyer */}
                      <div className="flex items-center gap-3 mt-1.5">
                        {c.clientName && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />{c.clientName}
                          </span>
                        )}
                        {c.assignedTo && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />{c.assignedTo}
                          </span>
                        )}
                      </div>

                      {/* Status + date */}
                      <div className="flex items-center justify-between mt-2">
                        {s && (
                          <Badge variant="outline" className={cn("text-[10px] gap-1", s.bg)}>
                            <s.icon className="h-2.5 w-2.5" />{s.label}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("ar-SA") : ""}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1" />
                  </div>
                </Link>
              );
            })}
            <p className="text-center text-xs text-muted-foreground py-2">{filtered.length} قضية</p>
          </div>
        </>
      )}

      {/* ── KANBAN VIEW ── */}
      {!isLoading && filtered.length > 0 && view === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {kanbanCols.map(col => {
            const colItems = filtered.filter(c => c.status === col.key);
            return (
              <div key={col.key} className={cn("border-t-4 rounded-xl bg-muted/20 p-4 space-y-3 min-h-64", col.color)}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{col.label}</span>
                  <Badge variant="secondary" className="text-xs">{colItems.length}</Badge>
                </div>
                {colItems.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">لا توجد قضايا</div>
                )}
                {colItems.map(c => <KanbanCard key={c.id} c={c} />)}
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Case Dialog ── */}
      <Dialog open={newOpen} onOpenChange={v => { setNewOpen(v); if (!v) { setForm({ title: "", caseType: "civil", clientName: "", description: "" }); setClientInput("select"); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>قضية جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>عنوان القضية <span className="text-red-500">*</span></Label>
              <Input placeholder="مثال: نزاع تجاري على عقد توريد" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>

            {/* ── Client picker: Select from list OR type manually ── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>الموكل</Label>
                {clientsList.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      setClientInput(p => p === "select" ? "text" : "select");
                      setForm(p => ({ ...p, clientName: "" }));
                    }}
                  >
                    {clientInput === "select" ? "أدخل اسماً جديداً ＋" : "← اختر من القائمة"}
                  </button>
                )}
              </div>
              {clientsList.length > 0 && clientInput === "select" ? (
                <Select
                  value={form.clientName}
                  onValueChange={v => setForm(p => ({ ...p, clientName: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر موكلاً من القائمة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsList.map(c => (
                      <SelectItem key={c.id} value={c.fullName}>{c.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="اسم الموكل أو الشركة"
                  value={form.clientName}
                  onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>نوع القضية</Label>
              <Select value={form.caseType} onValueChange={v => setForm(p => ({ ...p, caseType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>وصف مختصر</Label>
              <Textarea
                placeholder="ملاحظات أو وصف القضية..."
                rows={3}
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={!form.title.trim() || createCase.isPending}>
              {createCase.isPending ? "جارٍ الإنشاء..." : "إنشاء القضية"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} type="cases" queryKey={[...getListCasesQueryKey()] as string[]} />
    </div>
  );
}
