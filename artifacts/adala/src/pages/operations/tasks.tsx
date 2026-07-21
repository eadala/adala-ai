/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList, Plus, Loader2, CheckCircle2, Circle, Clock,
  AlertCircle, Flag, User, Calendar, Trash2, Edit2, X, Search,
  ChevronDown, Link2, LayoutGrid, List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  todo:        { label: "قيد الانتظار",  color: "text-muted-foreground",   bg: "bg-muted/30 10 border-slate-500/30",   icon: Circle },
  in_progress: { label: "جارٍ التنفيذ",  color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30",     icon: Clock },
  done:        { label: "مكتملة",        color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low:    { label: "منخفضة", color: "text-muted-foreground",   dot: "bg-slate-400" },
  medium: { label: "متوسطة", color: "text-blue-400",    dot: "bg-blue-400" },
  high:   { label: "عالية",  color: "text-orange-400",  dot: "bg-orange-400" },
  urgent: { label: "عاجلة",  color: "text-red-400",     dot: "bg-red-500" },
};

const EMPTY_FORM = {
  title: "", description: "", status: "todo", priority: "medium",
  assigneeName: "", dueDate: "", caseTitle: "",
};

function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === "done") return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

export default function Tasks() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["tasks"],
    queryFn: () => authFetch("/api/office-tasks").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["tasks-stats"],
    queryFn: () => authFetch("/api/office-tasks/stats").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["employees"],
    queryFn: () => authFetch("/api/hr/employees").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const cleanPayload = (data: any) => ({
    ...data,
    dueDate: data.dueDate || null,
    assigneeName: data.assigneeName || null,
    caseTitle: data.caseTitle || null,
    description: data.description || null,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await authFetch("/api/office-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanPayload(data)),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "فشل إنشاء المهمة");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks-stats"] });
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      toast({ title: "تم إنشاء المهمة ✓" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "فشل إنشاء المهمة", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const r = await authFetch(`${BASE}/api/office-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanPayload(data)),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "فشل تحديث المهمة");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks-stats"] });
      setEditTask(null);
      toast({ title: "تم تحديث المهمة ✓" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "فشل تحديث المهمة", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authFetch(`${BASE}/api/office-tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks-stats"] });
      toast({ title: "تم حذف المهمة" });
    },
  });

  const quickStatusChange = (task: any, newStatus: string) => {
    updateMutation.mutate({ id: task.id, status: newStatus });
  };

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.assignee_name?.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  const openEdit = (task: any) => {
    setForm({
      title: task.title ?? "",
      description: task.description ?? "",
      status: task.status ?? "todo",
      priority: task.priority ?? "medium",
      assigneeName: task.assignee_name ?? "",
      dueDate: task.due_date ? task.due_date.split("T")[0] : "",
      caseTitle: task.case_title ?? "",
    });
    setEditTask(task);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast({ title: "العنوان مطلوب", variant: "destructive" }); return; }
    if (editTask) {
      updateMutation.mutate({ id: editTask.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const KanbanColumn = ({ statusKey }: { statusKey: string }) => {
    const cfg = STATUS_CONFIG[statusKey];
    const StatusIcon = cfg.icon;
    const colTasks = filtered.filter(t => t.status === statusKey);

    return (
      <div className="flex-1 min-w-[260px]">
        <div className="flex items-center gap-2 mb-3">
          <div className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border", cfg.bg, cfg.color)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {cfg.label}
          </div>
          <span className="text-xs text-muted-foreground font-semibold bg-muted/50 px-2 py-0.5 rounded-full">
            {colTasks.length}
          </span>
        </div>

        <div className="space-y-2.5">
          {colTasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
          {colTasks.length === 0 && (
            <div className="border-2 border-dashed border-muted/30 rounded-xl p-6 text-center text-muted-foreground text-xs">
              لا توجد مهام
            </div>
          )}
        </div>
      </div>
    );
  };

  const TaskCard = ({ task }: { task: any }) => {
    const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
    const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo;
    const overdue = isOverdue(task.due_date, task.status);
    const StatusIcon = sCfg.icon;

    return (
      <Card className="group hover:border-primary/30 transition-all cursor-pointer" onClick={() => openEdit(task)}>
        <CardContent className="p-3.5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", pCfg.dot)} />
              <span className={cn("text-[10px] font-semibold", pCfg.color)}>{pCfg.label}</span>
              {overdue && (
                <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 rounded-full">
                  متأخرة!
                </span>
              )}
            </div>
            <button
              onClick={e => { e.stopPropagation(); if (window.confirm("هل تريد حذف هذه المهمة؟")) deleteMutation.mutate(task.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-sm font-semibold leading-snug mb-2 line-clamp-2">{task.title}</p>

          {task.description && (
            <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap mt-2">
            <div className="flex items-center gap-2">
              {task.assignee_name && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <User className="h-3 w-3" />{task.assignee_name}
                </div>
              )}
              {task.due_date && (
                <div className={cn("flex items-center gap-1 text-[10px]", overdue ? "text-red-400" : "text-muted-foreground")}>
                  <Calendar className="h-3 w-3" />
                  {new Date(task.due_date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                </div>
              )}
            </div>
            {task.case_title && (
              <div className="flex items-center gap-0.5 text-[10px] text-primary/70">
                <Link2 className="h-3 w-3" />{task.case_title}
              </div>
            )}
          </div>

          {view === "kanban" && (
            <div className="flex gap-1 mt-2.5 pt-2 border-t border-border/30" onClick={e => e.stopPropagation()}>
              {Object.entries(STATUS_CONFIG).filter(([k]) => k !== task.status).map(([k, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={k}
                    onClick={() => quickStatusChange(task, k)}
                    className={cn("flex-1 text-[10px] py-1 rounded-lg border transition-all hover:opacity-100 opacity-60 flex items-center justify-center gap-1", cfg.bg, cfg.color)}
                  >
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">المهام</h1>
          <p className="text-muted-foreground text-sm">إدارة مهام الفريق ومتابعة تنفيذها</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 bg-muted/30 border rounded-xl p-1">
            <button onClick={() => setView("kanban")}
              className={cn("p-1.5 rounded-lg transition-all", view === "kanban" ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView("list")}
              className={cn("p-1.5 rounded-lg transition-all", view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => { setEditTask(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> مهمة جديدة
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "إجمالي المهام",   value: stats.total,       color: "#6366F1", icon: ClipboardList },
            { label: "قيد التنفيذ",     value: stats.in_progress, color: "#3B82F6", icon: Clock },
            { label: "مكتملة",          value: stats.done,        color: "#10B981", icon: CheckCircle2 },
            { label: "متأخرة",          value: stats.overdue,     color: "#EF4444", icon: AlertCircle },
          ].map(s => (
            <Card key={s.label} className="border-0 bg-card/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                  <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-xl font-black" style={{ color: s.color }}>{s.value ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في المهام..." className="pe-9" />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="الأولوية" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأولويات</SelectItem>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Object.keys(STATUS_CONFIG).map(s => <KanbanColumn key={s} statusKey={s} />)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    {["المهمة", "الأولوية", "الحالة", "المسؤول", "تاريخ الانتهاء", "القضية", ""].map(h => (
                      <th key={h} className="text-right text-xs text-muted-foreground font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                      <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      لا توجد مهام
                    </td></tr>
                  ) : filtered.map(task => {
                    const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
                    const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo;
                    const overdue = isOverdue(task.due_date, task.status);
                    const StatusIcon = sCfg.icon;
                    return (
                      <tr key={task.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors group">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-sm">{task.title}</div>
                          {task.description && <div className="text-[10px] text-muted-foreground line-clamp-1">{task.description}</div>}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("w-2 h-2 rounded-full", pCfg.dot)} />
                            <span className={cn("text-xs font-semibold", pCfg.color)}>{pCfg.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap", sCfg.bg, sCfg.color)}>
                            <StatusIcon className="h-3 w-3" />{sCfg.label}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {task.assignee_name || "—"}
                        </td>
                        <td className={cn("py-3 px-3 text-xs whitespace-nowrap", overdue ? "text-red-400 font-bold" : "text-muted-foreground")}>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString("ar-EG") : "—"}
                          {overdue && " ⚠️"}
                        </td>
                        <td className="py-3 px-3 text-xs text-primary/70 whitespace-nowrap">
                          {task.case_title || "—"}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(task)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (window.confirm("هل تريد حذف هذه المهمة؟")) deleteMutation.mutate(task.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <AdaptiveDialog open={showForm || !!editTask} onOpenChange={open => { if (!open) { setShowForm(false); setEditTask(null); } }}>
        <AdaptiveDialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTask ? "تعديل المهمة" : "مهمة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>عنوان المهمة *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="عنوان المهمة..." />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="resize-none min-h-[70px] text-sm" placeholder="تفاصيل المهمة..." />
            </div>
            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div>
                <Label>الأولوية</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div>
                <Label>المسؤول</Label>
                <Select
                  value={form.assigneeName || "__none__"}
                  onValueChange={v => setForm(p => ({ ...p, assigneeName: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="اختر موظفاً" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">بدون تعيين</SelectItem>
                    {(employees ?? []).map((e: any) => e?.fullName ? (
                      <SelectItem key={e.id} value={e.fullName}>{e.fullName}</SelectItem>
                    ) : null)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>تاريخ الانتهاء</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>القضية المرتبطة</Label>
              <Input value={form.caseTitle} onChange={e => setForm(p => ({ ...p, caseTitle: e.target.value }))}
                placeholder="اسم أو رقم القضية..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditTask(null); }}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="gap-2">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editTask ? "حفظ التغييرات" : "إنشاء المهمة"}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}
