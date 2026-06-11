import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, X, Clock, CheckCircle2, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const API = "/api";
const fetchJson = (path: string) => fetch(`${API}${path}`).then(r => r.json());

const PRIORITY_LABEL: Record<string, string> = {
  low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجل",
};
const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-slate-500/15 text-slate-300",
  medium: "bg-blue-500/15 text-blue-300",
  high:   "bg-orange-500/15 text-orange-300",
  urgent: "bg-red-500/15 text-red-300",
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function formatDate(dt: string | null | undefined): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("ar-SA", { month: "short", day: "numeric", year: "numeric" });
}

function checkOverdue(dt: string | null | undefined): boolean {
  if (!dt) return false;
  return new Date(dt) < new Date();
}

export default function Reminders() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", notes: "", dueDate: "", priority: "medium" });

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["reminders"],
    queryFn: () => fetchJson("/reminders"),
  });

  const list: any[] = Array.isArray(reminders) ? reminders : [];
  const active = list.filter(r => !r.isDone && !r.isCompleted);
  const done   = list.filter(r =>  r.isDone ||  r.isCompleted);

  const addMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${API}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      setShowAdd(false);
      setForm({ title: "", notes: "", dueDate: "", priority: "medium" });
      toast.success("تم إضافة التذكير");
    },
    onError: () => toast.error("حدث خطأ أثناء الإضافة"),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`${API}/reminders/${id}/complete`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("تم إتمام التذكير");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`${API}/reminders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("تم حذف التذكير");
    },
  });

  const handleAdd = () => {
    if (!form.title.trim()) { toast.error("أدخل عنوان التذكير"); return; }
    addMutation.mutate({ ...form, officeId: "default" });
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 pt-12 pb-4 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">التذكيرات</h1>
            {active.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {active.length} تذكير نشط
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center tap-effect"
          >
            {showAdd ? <X size={18} className="text-primary-foreground" /> : <Plus size={18} className="text-primary-foreground" />}
          </button>
        </div>
      </div>

      {/* Add Form (collapsible) */}
      {showAdd && (
        <div className="px-4 py-4 border-b border-border bg-card/50">
          <div className="flex flex-col gap-3">
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="عنوان التذكير *"
              className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="ملاحظات (اختياري)"
              rows={2}
              className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl py-2 px-3 text-sm text-foreground outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">الأولوية</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl py-2 px-3 text-sm text-foreground outline-none focus:border-primary/50"
                >
                  <option value="low">منخفضة</option>
                  <option value="medium">متوسطة</option>
                  <option value="high">عالية</option>
                  <option value="urgent">عاجل</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold tap-effect disabled:opacity-60"
            >
              {addMutation.isPending ? "جاري الإضافة..." : "إضافة التذكير"}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-5">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell size={48} className="text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">لا توجد تذكيرات</p>
            <p className="text-muted-foreground/60 text-sm mt-1">اضغط + لإضافة تذكير جديد</p>
          </div>
        ) : (
          <>
            {/* Active reminders */}
            {active.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-foreground mb-2">نشطة ({active.length})</h2>
                <div className="flex flex-col gap-2">
                  {active.map((r: any) => (
                    <ReminderCard
                      key={r.id}
                      reminder={r}
                      onComplete={() => completeMutation.mutate(r.id)}
                      onDelete={() => deleteMutation.mutate(r.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Done reminders */}
            {done.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-muted-foreground mb-2">مكتملة ({done.length})</h2>
                <div className="flex flex-col gap-2 opacity-60">
                  {done.slice(0, 5).map((r: any) => (
                    <ReminderCard
                      key={r.id}
                      reminder={r}
                      onDelete={() => deleteMutation.mutate(r.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReminderCard({
  reminder: r,
  onComplete,
  onDelete,
}: {
  reminder: any;
  onComplete?: () => void;
  onDelete?: () => void;
}) {
  const done = r.isDone || r.isCompleted;
  const overdue = !done && checkOverdue(r.dueDate ?? r.due_date);

  return (
    <div className={`bg-card rounded-2xl p-4 border tap-effect ${
      overdue ? "border-red-500/30" : "border-border/50"
    }`}>
      <div className="flex items-start gap-3">
        {!done ? (
          <button
            onClick={onComplete}
            className="w-6 h-6 rounded-full border-2 border-primary/50 flex items-center justify-center shrink-0 mt-0.5 tap-effect hover:border-primary"
          >
            <div className="w-2 h-2 rounded-full bg-transparent" />
          </button>
        ) : (
          <CheckCircle2 size={22} className="text-green-400 shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-snug ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {r.title}
          </p>
          {r.notes && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.notes}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {(r.dueDate ?? r.due_date) && (
              <span className={`text-xs flex items-center gap-1 ${overdue ? "text-red-400" : "text-muted-foreground"}`}>
                {overdue ? <AlertCircle size={11} /> : <Clock size={11} />}
                {formatDate(r.dueDate ?? r.due_date)}
              </span>
            )}
            {r.priority && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[r.priority]}`}>
                {PRIORITY_LABEL[r.priority]}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-xl bg-muted flex items-center justify-center shrink-0 tap-effect"
        >
          <Trash2 size={13} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

