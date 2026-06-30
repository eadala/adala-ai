import { useListAiTasks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bot, Search, RefreshCw, AlertCircle, CheckCircle2, Clock, Plus, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const TASK_TYPE_MAP: Record<string, string> = {
  summarize: "تلخيص مستند",
  risk_analysis: "تحليل مخاطر",
  extract: "استخراج بيانات"
};

const STATUS_MAP: Record<string, { label: string, icon: any, color: string }> = {
  pending: { label: "في الانتظار", icon: Clock, color: "bg-muted text-muted-foreground" },
  running: { label: "قيد المعالجة", icon: RefreshCw, color: "bg-secondary text-secondary-foreground" },
  done: { label: "مكتمل", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400" },
  failed: { label: "فشل", icon: AlertCircle, color: "bg-destructive/15 text-destructive" },
};

const PRIORITY_MAP: Record<number, string> = { 1: "عاجل جداً", 2: "عالي", 3: "متوسط", 4: "منخفض", 5: "عادي" };

export default function AiTasks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: tasks = [], isLoading, refetch } = useListAiTasks();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<any>(null);
  const [form, setForm] = useState({ type: "summarize", caseId: "", priority: "3", inputText: "" });

  const { data: cases = [] } = useQuery<any[]>({
    queryKey: ["cases-mini"],
    queryFn: () => fetch(`${BASE}/api/cases?limit=100`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listAiTasks"] });
      toast({ title: "✅ تم إنشاء المهمة — ستبدأ المعالجة خلال ثوانٍ" });
      setCreateOpen(false);
      setForm({ type: "summarize", caseId: "", priority: "3", inputText: "" });
    },
    onError: () => toast({ title: "خطأ في إنشاء المهمة", variant: "destructive" }),
  });

  const filtered = (tasks as any[]).filter(t => {
    const matchSearch = !search ||
      (TASK_TYPE_MAP[t.type] ?? t.type).includes(search) ||
      (t.caseName ?? "").includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">مهام الذكاء الاصطناعي</h1>
          <p className="text-muted-foreground mt-1">متابعة تحليلات وملخصات الذكاء الاصطناعي</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> مهمة تحليل جديدة
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4 px-6 border-b flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="البحث بنوع المهمة أو اسم القضية..."
              className="ps-4 pe-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="جميع الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="pending">في الانتظار</SelectItem>
              <SelectItem value="running">قيد المعالجة</SelectItem>
              <SelectItem value="done">مكتمل</SelectItem>
              <SelectItem value="failed">فشل</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-right">نوع المهمة</TableHead>
                <TableHead className="text-right">القضية المرتبطة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الأولوية</TableHead>
                <TableHead className="text-right">تاريخ الطلب</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[100px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    {search || statusFilter !== "all" ? "لا توجد نتائج مطابقة" : "لا توجد مهام ذكاء اصطناعي حالية — اضغط «مهمة تحليل جديدة» للبدء"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((task: any) => {
                  const statusInfo = STATUS_MAP[task.status] || STATUS_MAP.pending;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <TableRow key={task.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          {TASK_TYPE_MAP[task.type] || task.type}
                        </div>
                      </TableCell>
                      <TableCell>{task.caseName || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`flex w-fit items-center gap-1 border-0 ${statusInfo.color}`}>
                          <StatusIcon className={`h-3 w-3 ${task.status === "running" ? "animate-spin" : ""}`} />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{PRIORITY_MAP[task.priority] || "متوسط"}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(task.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => setDetailTask(task)}>
                          <Eye className="h-3 w-3" /> التفاصيل
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Create Task Dialog ── */}
      <AdaptiveDialog open={createOpen} onOpenChange={setCreateOpen}>
        <AdaptiveDialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> مهمة تحليل جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>نوع المهمة *</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summarize">📄 تلخيص مستند</SelectItem>
                  <SelectItem value="risk_analysis">⚠️ تحليل مخاطر</SelectItem>
                  <SelectItem value="extract">🔍 استخراج بيانات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>القضية المرتبطة (اختياري)</Label>
              <Select value={form.caseId || "__none__"} onValueChange={v => setForm(p => ({ ...p, caseId: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="اختر قضية..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون ربط —</SelectItem>
                  {(cases as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الأولوية</Label>
              <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">🔴 عاجل جداً</SelectItem>
                  <SelectItem value="2">🟠 عالي</SelectItem>
                  <SelectItem value="3">🟡 متوسط</SelectItem>
                  <SelectItem value="4">🟢 منخفض</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>النص المراد تحليله</Label>
              <Textarea
                className="mt-1.5 resize-none"
                rows={4}
                placeholder="أدخل النص أو المعلومات التي تريد تحليلها..."
                value={form.inputText}
                onChange={e => setForm(p => ({ ...p, inputText: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => createMut.mutate({
                type: form.type,
                caseId: form.caseId || undefined,
                priority: parseInt(form.priority),
                inputText: form.inputText || undefined,
              })}
              disabled={createMut.isPending}
              className="gap-1.5"
            >
              <Bot className="h-4 w-4" />
              {createMut.isPending ? "جارٍ الإنشاء..." : "إنشاء المهمة"}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* ── Task Detail Dialog ── */}
      <AdaptiveDialog open={!!detailTask} onOpenChange={() => setDetailTask(null)}>
        <AdaptiveDialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {TASK_TYPE_MAP[detailTask?.type] || detailTask?.type}
            </DialogTitle>
          </DialogHeader>
          {detailTask && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                {(() => {
                  const s = STATUS_MAP[detailTask.status] || STATUS_MAP.pending;
                  const Icon = s.icon;
                  return (
                    <Badge variant="outline" className={`flex items-center gap-1 border-0 ${s.color}`}>
                      <Icon className="h-3 w-3" /> {s.label}
                    </Badge>
                  );
                })()}
                <span className="text-muted-foreground">{PRIORITY_MAP[detailTask.priority] || "متوسط"}</span>
              </div>
              {detailTask.caseName && (
                <div><span className="font-medium">القضية: </span>{detailTask.caseName}</div>
              )}
              {detailTask.inputText && (
                <div>
                  <p className="font-medium mb-1">النص المُدخَل:</p>
                  <div className="bg-muted/50 rounded p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">{detailTask.inputText}</div>
                </div>
              )}
              {detailTask.outputText && (
                <div>
                  <p className="font-medium mb-1 text-emerald-400">نتيجة التحليل:</p>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{detailTask.outputText}</div>
                </div>
              )}
              {!detailTask.outputText && detailTask.status === "pending" && (
                <p className="text-muted-foreground text-center py-4">⏳ المهمة في الانتظار — ستبدأ المعالجة قريباً</p>
              )}
              <p className="text-xs text-muted-foreground">
                تاريخ الطلب: {new Date(detailTask.createdAt).toLocaleString("ar-EG")}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailTask(null)}>إغلاق</Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}
