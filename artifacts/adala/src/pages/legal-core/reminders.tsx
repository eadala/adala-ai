import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bell, Plus, Trash2, Edit3, CheckCircle2, Clock, AlertTriangle,
  Calendar, Tag, Loader2, Filter
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/use-lang";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const empty = () => ({ title: "", body: "", dueDate: "", dueTime: "", priority: "medium", category: "general", caseId: "" });

export default function RemindersPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(empty());
  const { tx, dateLocale, dir } = useLang();

  const PRIORITIES = [
    { value: "low",    label: tx("منخفضة", "Low"),    color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
    { value: "medium", label: tx("متوسطة", "Medium"), color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
    { value: "high",   label: tx("عالية", "High"),   color: "bg-red-500/15 text-red-400 border-red-500/20" },
  ];

  const CATEGORIES = [
    { value: "general",  label: tx("عام", "General") },
    { value: "case",     label: tx("قضية", "Case") },
    { value: "client",   label: tx("عميل", "Client") },
    { value: "invoice",  label: tx("فاتورة", "Invoice") },
    { value: "session",  label: tx("جلسة", "Session") },
    { value: "deadline", label: tx("موعد نهائي", "Deadline") },
    { value: "meeting",  label: tx("اجتماع", "Meeting") },
  ];

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["reminders", filter],
    queryFn: () => {
      const q = filter === "pending" ? "?done=false" : filter === "done" ? "?done=true" : "";
      return fetch(`${BASE}/api/reminders${q}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); });
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (data: any) => {
      const url = editing ? `${BASE}/api/reminders/${editing.id}` : `${BASE}/api/reminders`;
      const method = editing ? "PATCH" : "POST";
      return fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: ["reminders-count"] });
      setOpen(false);
      toast.success(editing ? tx("تم تعديل التذكير", "Reminder updated") : tx("تم إضافة التذكير", "Reminder added"));
    },
    onError: () => toast.error(tx("حدث خطأ", "An error occurred")),
  });

  const doneMut = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      fetch(`${BASE}/api/reminders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done }) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: ["reminders-count"] });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/reminders/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: ["reminders-count"] });
      toast.success(tx("تم الحذف", "Deleted"));
    },
  });

  function openCreate() { setEditing(null); setForm(empty()); setOpen(true); }
  function openEdit(r: any) {
    setEditing(r);
    setForm({ title: r.title ?? "", body: r.body ?? "", dueDate: r.due_date?.slice(0,10) ?? "", dueTime: r.due_time ?? "", priority: r.priority ?? "medium", category: r.category ?? "general", caseId: r.case_id ?? "" });
    setOpen(true);
  }
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function submit() {
    if (!form.title.trim()) { toast.error(tx("العنوان مطلوب", "Title is required")); return; }
    saveMut.mutate({ ...form, caseId: form.caseId ? parseInt(form.caseId) : undefined, dueDate: form.dueDate || undefined, dueTime: form.dueTime || undefined });
  }

  const isOverdue = (r: any) => r.due_date && !r.done && new Date(r.due_date) < new Date(new Date().toDateString());
  const isDueToday = (r: any) => r.due_date && !r.done && r.due_date?.slice(0,10) === new Date().toISOString().slice(0,10);

  const pending = rows.filter(r => !r.done).length;

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Bell className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{tx("التذكيرات", "Reminders")}</h1>
            <p className="text-xs text-muted-foreground">{pending} {tx("تذكير معلق", "pending reminder(s)")}</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-[#b8943f] text-black font-bold gap-1.5">
          <Plus className="h-4 w-4" /> {tx("تذكير جديد", "New Reminder")}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-border pb-1">
        {[
          { key: "pending", label: tx("معلقة", "Pending") },
          { key: "done",    label: tx("مكتملة", "Completed") },
          { key: "all",     label: tx("الكل", "All") },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-t transition-colors",
              filter === tab.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >{tab.label}</button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin ml-2" /> {tx("جارٍ التحميل...", "Loading...")}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
          <Bell className="h-10 w-10 opacity-20" />
          <p>{tx("لا توجد تذكيرات", "No reminders")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const overdue = isOverdue(r);
            const today = isDueToday(r);
            const pConf = PRIORITIES.find(p => p.value === r.priority);
            const catConf = CATEGORIES.find(c => c.value === r.category);
            return (
              <Card key={r.id} className={cn(
                "bg-card border-border transition-all",
                r.done && "opacity-50",
                overdue && !r.done && "border-red-500/30 bg-red-500/5"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={r.done}
                      onCheckedChange={(v) => doneMut.mutate({ id: r.id, done: !!v })}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("font-medium text-sm", r.done && "line-through text-muted-foreground")}>{r.title}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => delMut.mutate(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {r.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.body}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {pConf && (
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", pConf.color)}>
                            {pConf.label}
                          </Badge>
                        )}
                        {catConf && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            <Tag className="h-2.5 w-2.5 ml-1" />{catConf.label}
                          </Badge>
                        )}
                        {r.due_date && (
                          <span className={cn(
                            "flex items-center gap-1 text-[10px]",
                            overdue ? "text-red-400" : today ? "text-amber-400" : "text-muted-foreground"
                          )}>
                            {overdue ? <AlertTriangle className="h-2.5 w-2.5" /> : <Calendar className="h-2.5 w-2.5" />}
                            {new Date(r.due_date).toLocaleDateString(dateLocale)}
                            {r.due_time && ` · ${r.due_time}`}
                            {overdue && ` (${tx("متأخر", "Overdue")})`}
                            {today && !overdue && ` (${tx("اليوم", "Today")})`}
                          </span>
                        )}
                        {r.case_title && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />{r.case_title}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md" dir={dir}>
          <DialogHeader><DialogTitle>{editing ? tx("تعديل التذكير", "Edit Reminder") : tx("تذكير جديد", "New Reminder")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{tx("العنوان *", "Title *")}</Label>
              <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder={tx("عنوان التذكير", "Reminder title")} className="mt-1" />
            </div>
            <div>
              <Label>{tx("التفاصيل", "Details")}</Label>
              <Textarea value={form.body} onChange={e => set("body", e.target.value)} placeholder={tx("وصف اختياري...", "Optional description...")} rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{tx("التاريخ", "Date")}</Label>
                <Input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>{tx("الوقت", "Time")}</Label>
                <Input type="time" value={form.dueTime} onChange={e => set("dueTime", e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{tx("الأولوية", "Priority")}</Label>
                <Select value={form.priority} onValueChange={v => set("priority", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tx("الفئة", "Category")}</Label>
                <Select value={form.category} onValueChange={v => set("category", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tx("إلغاء", "Cancel")}</Button>
            <Button onClick={submit} disabled={saveMut.isPending} className="bg-primary hover:bg-[#b8943f] text-black font-bold">
              {saveMut.isPending && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
              {editing ? tx("حفظ التعديلات", "Save Changes") : tx("إضافة", "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
