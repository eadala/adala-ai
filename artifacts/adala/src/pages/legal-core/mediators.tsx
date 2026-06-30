import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase, Plus, Search, CheckCircle2, Clock, Users, Banknote,
  FileText, AlertTriangle, ChevronLeft, ScrollText, ShieldCheck, Star,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function API(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

const CATEGORIES: Record<string, string> = {
  research: "بحث قانوني",
  translation: "ترجمة قانونية",
  representation: "تمثيل قانوني",
  drafting: "صياغة وثائق",
  mediation: "وساطة",
  arbitration: "تحكيم",
  other: "أخرى",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: "متاح", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  in_progress: { label: "قيد التنفيذ", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  completed: { label: "مكتمل", color: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "ملغي", color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const APP_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-yellow-500/15 text-yellow-400" },
  accepted: { label: "مقبول", color: "bg-green-500/15 text-green-400" },
  rejected: { label: "مرفوض", color: "bg-red-500/15 text-red-400" },
};

export default function MediatorsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState("market");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showNewTask, setShowNewTask] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showApplications, setShowApplications] = useState(false);
  const [appTaskId, setAppTaskId] = useState<string | null>(null);

  const [newTask, setNewTask] = useState({
    title: "", description: "", category: "research",
    commission: "", currency: "SAR", deadline: "", required_skills: "",
  });
  const [applyForm, setApplyForm] = useState({
    applicant_name: user?.fullName ?? "", applicant_email: user?.primaryEmailAddress?.emailAddress ?? "",
    message: "", agreed_to_terms: false,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["mediator-tasks", catFilter, search],
    queryFn: () => {
      const p = new URLSearchParams({ status: "open" });
      if (catFilter !== "all") p.set("category", catFilter);
      if (search) p.set("search", search);
      return API(`/api/mediators/tasks?${p}`);
    },
  });

  const { data: myTasks = [] } = useQuery({
    queryKey: ["mediator-my-tasks"],
    queryFn: () => API("/api/mediators/my-tasks"),
    enabled: tab === "my-tasks",
  });

  const { data: myApplications = [] } = useQuery({
    queryKey: ["mediator-my-apps"],
    queryFn: () => API("/api/mediators/my-applications"),
    enabled: tab === "my-applications",
  });

  const { data: taskApplications = [] } = useQuery({
    queryKey: ["mediator-applications", appTaskId],
    queryFn: () => API(`/api/mediators/tasks/${appTaskId}/applications`),
    enabled: !!appTaskId && showApplications,
  });

  const { data: stats } = useQuery({
    queryKey: ["mediator-stats"],
    queryFn: () => API("/api/mediators/stats"),
  });

  const createTask = useMutation({
    mutationFn: (d: any) => API("/api/mediators/tasks", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mediator-my-tasks"] });
      qc.invalidateQueries({ queryKey: ["mediator-stats"] });
      setShowNewTask(false);
      setNewTask({ title: "", description: "", category: "research", commission: "", currency: "SAR", deadline: "", required_skills: "" });
      toast({ title: "✅ تم نشر المهمة بنجاح" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const applyMutation = useMutation({
    mutationFn: (d: any) => API(`/api/mediators/tasks/${selectedTask?.id}/apply`, { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mediator-tasks"] });
      qc.invalidateQueries({ queryKey: ["mediator-my-apps"] });
      setShowApplyModal(false);
      setApplyForm({ applicant_name: "", applicant_email: "", message: "", agreed_to_terms: false });
      toast({ title: "✅ تم إرسال طلبك بنجاح" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateAppStatus = useMutation({
    mutationFn: ({ id, status }: any) => API(`/api/mediators/applications/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mediator-applications"] }); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => API(`/api/mediators/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mediator-my-tasks"] }); toast({ title: "تم الحذف" }); },
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            سوق الوسطاء والمتعاونون
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            مهام قانونية متاحة للمتعاونين وفرص للوسطاء المعتمدين
          </p>
        </div>
        <Button onClick={() => setShowNewTask(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          نشر مهمة
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "المهام المتاحة", value: stats.open_tasks, icon: Briefcase, color: "text-green-400" },
            { label: "إجمالي الطلبات", value: stats.total_applications, icon: Users, color: "text-blue-400" },
            { label: "الطلبات المقبولة", value: stats.accepted_applications, icon: CheckCircle2, color: "text-primary" },
            { label: "إجمالي العمولات", value: `${Number(stats.total_commissions).toLocaleString()} ر.س`, icon: Banknote, color: "text-yellow-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <div className="text-xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="market">سوق المهام</TabsTrigger>
          <TabsTrigger value="my-tasks">مهامي المنشورة</TabsTrigger>
          <TabsTrigger value="my-applications">طلباتي</TabsTrigger>
        </TabsList>

        {/* ── Market Tab ── */}
        <TabsContent value="market" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن مهمة..."
                className="pe-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع التصنيفات</SelectItem>
                {Object.entries(CATEGORIES).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingTasks ? (
            <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>لا توجد مهام متاحة حالياً</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(tasks as any[]).map((task: any) => (
                <div key={task.id} className="rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="font-bold text-base">{task.title}</h3>
                        <Badge variant="outline" className="text-[10px]">{CATEGORIES[task.category] ?? task.category}</Badge>
                      </div>
                      {task.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>}
                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                        {task.office_name && <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{task.office_name}</span>}
                        {task.deadline && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />الموعد: {task.deadline}</span>}
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{task.application_count} متقدم</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {Number(task.commission).toLocaleString()} {task.currency}
                      </span>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => { setSelectedTask(task); setApplyForm(f => ({ ...f, applicant_name: user?.fullName ?? "", applicant_email: user?.primaryEmailAddress?.emailAddress ?? "" })); setShowApplyModal(true); }}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        تقديم طلب
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── My Tasks Tab ── */}
        <TabsContent value="my-tasks" className="space-y-3">
          {(myTasks as any[]).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>لم تنشر أي مهام بعد</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowNewTask(true)}>
                <Plus className="h-3.5 w-3.5 ms-1" /> نشر أول مهمة
              </Button>
            </div>
          ) : (myTasks as any[]).map((task: any) => (
            <div key={task.id} className="rounded-2xl border border-border/50 bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold">{task.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_MAP[task.status]?.color}`}>
                      {STATUS_MAP[task.status]?.label ?? task.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {task.application_count} طلب — {Number(task.commission).toLocaleString()} {task.currency}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => { setAppTaskId(task.id); setShowApplications(true); }}
                  >
                    <Users className="h-3.5 w-3.5 ms-1" />
                    الطلبات
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm("هل تريد حذف هذه المهمة؟")) deleteTask.mutate(task.id); }}>
                    حذف
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* ── My Applications Tab ── */}
        <TabsContent value="my-applications" className="space-y-3">
          {(myApplications as any[]).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>لم تتقدم على أي مهام بعد</p>
            </div>
          ) : (myApplications as any[]).map((app: any) => (
            <div key={app.id} className="rounded-2xl border border-border/50 bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{app.task_title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{app.office_name}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${APP_STATUS[app.status]?.color ?? ""}`}>
                    {APP_STATUS[app.status]?.label ?? app.status}
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {Number(app.commission).toLocaleString()} {app.currency}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* ── New Task Dialog ── */}
      <AdaptiveDialog open={showNewTask} onOpenChange={setShowNewTask}>
        <AdaptiveDialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> نشر مهمة جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold mb-1 block">عنوان المهمة *</Label>
              <Input value={newTask.title} onChange={e => setNewTask(f => ({ ...f, title: e.target.value }))} placeholder="مثال: بحث في سوابق قضائية عقارية" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">الوصف</Label>
              <Textarea rows={3} value={newTask.description} onChange={e => setNewTask(f => ({ ...f, description: e.target.value }))} placeholder="اشرح تفاصيل المهمة المطلوبة..." />
            </div>
            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div>
                <Label className="text-xs font-semibold mb-1 block">التصنيف</Label>
                <Select value={newTask.category} onValueChange={v => setNewTask(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">العمولة (ر.س)</Label>
                <Input type="number" min="0" value={newTask.commission} onChange={e => setNewTask(f => ({ ...f, commission: e.target.value }))} placeholder="500" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div>
                <Label className="text-xs font-semibold mb-1 block">الموعد النهائي</Label>
                <Input type="date" value={newTask.deadline} onChange={e => setNewTask(f => ({ ...f, deadline: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">المهارات المطلوبة</Label>
                <Input value={newTask.required_skills} onChange={e => setNewTask(f => ({ ...f, required_skills: e.target.value }))} placeholder="مثال: قانون عقاري، ترجمة" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNewTask(false)}>إلغاء</Button>
            <Button onClick={() => createTask.mutate({ ...newTask, commission: Number(newTask.commission) || 0 })} disabled={!newTask.title || createTask.isPending}>
              {createTask.isPending ? "جارٍ النشر..." : "نشر المهمة"}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* ── Apply / Agreement Modal ── */}
      <AdaptiveDialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <AdaptiveDialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              التقدم للمهمة — {selectedTask?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div>
                <Label className="text-xs font-semibold mb-1 block">الاسم الكامل *</Label>
                <Input value={applyForm.applicant_name} onChange={e => setApplyForm(f => ({ ...f, applicant_name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">البريد الإلكتروني</Label>
                <Input value={applyForm.applicant_email} onChange={e => setApplyForm(f => ({ ...f, applicant_email: e.target.value }))} dir="ltr" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">رسالة التقديم</Label>
              <Textarea rows={3} value={applyForm.message} onChange={e => setApplyForm(f => ({ ...f, message: e.target.value }))} placeholder="اشرح لماذا أنت مناسب لهذه المهمة..." />
            </div>

            {/* Confidentiality Agreement */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ScrollText className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">اتفاقية الالتزام والسرية</span>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed h-28 overflow-y-auto mb-3 pe-1">
                بصفتك متعاوناً، تُقر بأنك ستلتزم بالحفاظ على سرية بيانات العملاء وعدم الإفصاح عن أي وثائق
                يتم تداولها عبر منصة <strong>عدالة AI</strong>. يُعدّ خرق هذه الاتفاقية إخلالاً بالالتزامات القانونية
                وقد يُعرّضك للمسؤولية القانونية الكاملة وفق نظام حماية البيانات الشخصية في المملكة العربية السعودية.
                تشمل الالتزامات: السرية التامة لمعلومات العملاء، عدم مشاركة أي وثائق مع أطراف ثالثة، الإبلاغ عن
                أي خرق أمني فور اكتشافه، واستخدام المعلومات حصراً لغرض تنفيذ المهمة المتفق عليها.
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={applyForm.agreed_to_terms}
                  onChange={e => setApplyForm(f => ({ ...f, agreed_to_terms: e.target.checked }))}
                />
                <span className="text-sm">أوافق على جميع بنود اتفاقية السرية والالتزام</span>
              </label>
            </div>

            {selectedTask && (
              <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5">
                <span className="text-sm text-muted-foreground">العمولة المتوقعة</span>
                <span className="font-bold text-primary text-lg">
                  {Number(selectedTask.commission).toLocaleString()} {selectedTask.currency}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowApplyModal(false)}>إلغاء</Button>
            <Button
              onClick={() => applyMutation.mutate(applyForm)}
              disabled={!applyForm.applicant_name || !applyForm.agreed_to_terms || applyMutation.isPending}
              className="gap-2"
            >
              <Star className="h-3.5 w-3.5" />
              {applyMutation.isPending ? "جارٍ الإرسال..." : "تأكيد التقديم"}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* ── Applications Viewer Dialog ── */}
      <AdaptiveDialog open={showApplications} onOpenChange={v => { setShowApplications(v); if (!v) setAppTaskId(null); }}>
        <AdaptiveDialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> طلبات التقديم
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-96 overflow-y-auto">
            {(taskApplications as any[]).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد طلبات بعد</p>
            ) : (taskApplications as any[]).map((app: any) => (
              <div key={app.id} className="rounded-xl border border-border/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{app.applicant_name}</p>
                    {app.applicant_email && <p className="text-xs text-muted-foreground">{app.applicant_email}</p>}
                    {app.message && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{app.message}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${APP_STATUS[app.status]?.color ?? ""}`}>
                      {APP_STATUS[app.status]?.label ?? app.status}
                    </span>
                    {app.agreed_to_terms && (
                      <span className="flex items-center gap-1 text-[10px] text-green-400">
                        <ShieldCheck className="h-3 w-3" /> وافق على السرية
                      </span>
                    )}
                    {app.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => updateAppStatus.mutate({ id: app.id, status: "accepted" })}>قبول</Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => updateAppStatus.mutate({ id: app.id, status: "rejected" })}>رفض</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* Warning bar */}
      <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3 flex items-center gap-2 text-xs text-yellow-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        تنبيه: جميع المهام والعمولات تخضع لاتفاقية السرية المُبرمة — أي خرق يعرّض المخالف للمسؤولية القانونية.
      </div>
    </div>
  );
}
