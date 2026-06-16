import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Handshake, Plus, Loader2, Scale, Clock, CheckCircle2, XCircle,
  FileText, Gavel, MoreHorizontal, Trash2, Edit3, Sparkles, Calendar,
  User, Users, AlertTriangle, ChevronDown, ScrollText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "قيد التسجيل", color: "text-yellow-400", icon: Clock },
  active: { label: "جارية", color: "text-blue-400", icon: Scale },
  decided: { label: "صدر قرار", color: "text-emerald-400", icon: CheckCircle2 },
  settled: { label: "تسوية ودية", color: "text-teal-400", icon: Handshake },
  closed: { label: "مغلقة", color: "text-muted-foreground", icon: XCircle },
};

const TYPE_CONFIG = {
  arbitration: { label: "تحكيم", icon: Gavel, color: "#6366F1" },
  mediation: { label: "وساطة", icon: Handshake, color: "#10B981" },
};

const EMPTY_FORM = {
  title: "", type: "arbitration", claimant: "", respondent: "",
  arbitrator: "", claimAmount: "", description: "",
};

function CaseCard({ c, onClick, onDelete }: any) {
  const status = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
  const type = TYPE_CONFIG[c.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.arbitration;
  const StatusIcon = status.icon;
  const TypeIcon = type.icon;
  const sessions = Array.isArray(c.sessions) ? c.sessions : [];

  return (
    <Card className="hover:border-primary/30 transition-all group cursor-pointer" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${type.color}18` }}>
              <TypeIcon className="h-4 w-4" style={{ color: type.color }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{c.title}</h3>
              <Badge variant="outline" className="text-[10px] mt-0.5" style={{ color: type.color, borderColor: `${type.color}40` }}>{type.label}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("flex items-center gap-1 text-xs", status.color)}>
              <StatusIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{status.label}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={e => { e.stopPropagation(); onDelete(c.id); }} className="text-red-400">
                  <Trash2 className="h-4 w-4 ml-2" /> حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" /> المدّعي: <span className="text-foreground">{c.claimant}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> المدّعى عليه: <span className="text-foreground">{c.respondent}</span>
          </div>
          {c.claimAmount && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> المبلغ: <span className="font-semibold text-primary">{c.claimAmount}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/50">
          <span>{sessions.length} جلسة مسجّلة</span>
          <span>{new Date(c.createdAt).toLocaleDateString("ar-SA")}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CaseDetail({ c, onClose, onRefresh }: { c: any; onClose: () => void; onRefresh: () => void }) {
  const [newSession, setNewSession] = useState({ date: "", notes: "", outcome: "" });
  const [addingSession, setAddingSession] = useState(false);
  const [generatingDecision, setGeneratingDecision] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const status = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
  const type = TYPE_CONFIG[c.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.arbitration;
  const sessions = Array.isArray(c.sessions) ? c.sessions : [];
  const StatusIcon = status.icon;

  const addSession = async () => {
    if (!newSession.date) return;
    setAddingSession(true);
    try {
      await fetch(`${BASE}/api/arbitration/cases/${c.id}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSession),
      });
      setNewSession({ date: "", notes: "", outcome: "" });
      qc.invalidateQueries({ queryKey: ["arbitration"] });
      onRefresh();
      toast({ title: "تم إضافة الجلسة" });
    } catch { toast({ title: "خطأ", variant: "destructive" }); }
    finally { setAddingSession(false); }
  };

  const generateDecision = async () => {
    setGeneratingDecision(true);
    try {
      const r = await fetch(`${BASE}/api/arbitration/cases/${c.id}/generate-decision`, { method: "POST" });
      const d = await r.json();
      qc.invalidateQueries({ queryKey: ["arbitration"] });
      onRefresh();
      toast({ title: "تم إصدار القرار بنجاح" });
    } catch { toast({ title: "خطأ في إصدار القرار", variant: "destructive" }); }
    finally { setGeneratingDecision(false); }
  };

  const updateStatus = async (status: string) => {
    await fetch(`${BASE}/api/arbitration/cases/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    qc.invalidateQueries({ queryKey: ["arbitration"] });
    onRefresh();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge style={{ background: `${type.color}18`, color: type.color, border: `1px solid ${type.color}40` }}>{type.label}</Badge>
            <div className={cn("flex items-center gap-1 text-xs", status.color)}>
              <StatusIcon className="h-3.5 w-3.5" /> {status.label}
            </div>
          </div>
          <h2 className="text-lg font-bold">{c.title}</h2>
        </div>
      </div>

      <Tabs defaultValue="info" className="flex-1 flex flex-col">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="info" className="flex-1">المعلومات</TabsTrigger>
          <TabsTrigger value="sessions" className="flex-1">الجلسات ({sessions.length})</TabsTrigger>
          <TabsTrigger value="decision" className="flex-1">القرار</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "المدّعي", value: c.claimant },
              { label: "المدّعى عليه", value: c.respondent },
              { label: "المحكّم / الوسيط", value: c.arbitrator || "لم يُعيَّن" },
              { label: "المبلغ المطالَب", value: c.claimAmount || "غير محدد" },
            ].map(f => (
              <div key={f.label} className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">{f.label}</p>
                <p className="text-sm font-semibold">{f.value}</p>
              </div>
            ))}
          </div>
          {c.description && (
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">وصف النزاع</p>
              <p className="text-sm leading-relaxed">{c.description}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">تغيير الحالة</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => updateStatus(k)}
                  className={cn("text-xs px-3 py-1 rounded-full border transition-all",
                    c.status === k ? "bg-primary text-primary-foreground border-primary" : "border-muted hover:border-primary/50")}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="flex-1 space-y-3">
          <ScrollArea className="max-h-64">
            {sessions.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">لا توجد جلسات مسجّلة</p>
            ) : sessions.map((s: any, i: number) => (
              <div key={i} className="bg-muted/40 rounded-xl p-3 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">{s.date}</span>
                  {s.outcome && <Badge variant="outline" className="text-[10px] px-2 py-0">{s.outcome}</Badge>}
                </div>
                {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
              </div>
            ))}
          </ScrollArea>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold">إضافة جلسة جديدة</p>
            <Input type="date" value={newSession.date} onChange={e => setNewSession(p => ({ ...p, date: e.target.value }))} className="h-9" />
            <Input placeholder="نتيجة الجلسة (اختياري)" value={newSession.outcome} onChange={e => setNewSession(p => ({ ...p, outcome: e.target.value }))} className="h-9" />
            <Textarea placeholder="ملاحظات الجلسة..." value={newSession.notes} onChange={e => setNewSession(p => ({ ...p, notes: e.target.value }))} className="resize-none min-h-[60px] text-sm" />
            <Button onClick={addSession} disabled={!newSession.date || addingSession} className="w-full h-9 gap-2">
              {addingSession && <Loader2 className="h-4 w-4 animate-spin" />}
              إضافة الجلسة
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="decision" className="flex-1 space-y-3">
          {c.decision ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4" /> صدر القرار بتاريخ {c.decisionDate ? new Date(c.decisionDate).toLocaleDateString("ar-SA") : ""}
              </div>
              <ScrollArea className="max-h-80 rounded-xl border bg-muted/20 p-4">
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{c.decision}</pre>
              </ScrollArea>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <ScrollText className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">لم يُصدر قرار بعد</p>
              <Button onClick={generateDecision} disabled={generatingDecision} className="gap-2">
                {generatingDecision ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generatingDecision ? "جارٍ إصدار القرار..." : "إصدار قرار بالذكاء الاصطناعي"}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Arbitration() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cases = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["arbitration"],
    queryFn: () => fetch(`${BASE}/api/arbitration/cases`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["arbitration-stats"],
    queryFn: () => fetch(`${BASE}/api/arbitration/stats`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch(`${BASE}/api/arbitration/cases`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["arbitration"] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      toast({ title: "تم تسجيل القضية" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/api/arbitration/cases/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["arbitration"] }); if (selectedCase) setSelectedCase(null); toast({ title: "تم الحذف" }); },
  });

  const filtered = cases.filter(c => typeFilter === "all" || c.type === typeFilter);

  // If a case is selected, update it from latest data
  const currentCase = selectedCase ? cases.find(c => c.id === selectedCase.id) ?? selectedCase : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">التحكيم والوساطة</h1>
          <p className="text-muted-foreground text-sm">إدارة قضايا التحكيم والوساطة الإلكترونية</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> قضية جديدة
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "الإجمالي", value: stats.total, color: "#6366F1" },
            { label: "قيد التسجيل", value: stats.pending, color: "#F59E0B" },
            { label: "جارية", value: stats.active, color: "#3B82F6" },
            { label: "صدر قرار", value: stats.decided, color: "#10B981" },
            { label: "وساطة", value: stats.mediation, color: "#06B6D4" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {[{ value: "all", label: "الكل" }, { value: "arbitration", label: "تحكيم" }, { value: "mediation", label: "وساطة" }].map(f => (
          <button key={f.value} onClick={() => setTypeFilter(f.value)}
            className={cn("px-4 py-1.5 rounded-xl text-sm font-medium border transition-all",
              typeFilter === f.value ? "bg-primary/10 border-primary text-primary" : "border-muted text-muted-foreground hover:border-primary/30")}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div className={cn("grid gap-5", currentCase ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1")}>
        {/* Case List */}
        <div className={cn(currentCase ? "lg:col-span-2" : "col-span-1")}>
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Handshake className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>لا توجد قضايا — أضف أولى القضايا</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(c => (
                <CaseCard key={c.id} c={c}
                  onClick={() => setSelectedCase(c.id === selectedCase?.id ? null : c)}
                  onDelete={(id: string) => deleteMutation.mutate(id)} />
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        {currentCase && (
          <Card className="lg:col-span-3 border-primary/20">
            <CardContent className="p-5 h-full">
              <CaseDetail c={currentCase} onClose={() => setSelectedCase(null)} onRefresh={() => refetch()} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>تسجيل قضية جديدة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>عنوان النزاع *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: نزاع تجاري بين شركة X وشركة Y" /></div>
            <div><Label>النوع</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="arbitration">تحكيم</SelectItem>
                  <SelectItem value="mediation">وساطة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>المدّعي *</Label><Input value={form.claimant} onChange={e => setForm(p => ({ ...p, claimant: e.target.value }))} /></div>
              <div><Label>المدّعى عليه *</Label><Input value={form.respondent} onChange={e => setForm(p => ({ ...p, respondent: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>المحكّم / الوسيط</Label><Input value={form.arbitrator} onChange={e => setForm(p => ({ ...p, arbitrator: e.target.value }))} /></div>
              <div><Label>المبلغ المطالَب به</Label><Input value={form.claimAmount} onChange={e => setForm(p => ({ ...p, claimAmount: e.target.value }))} placeholder="مثال: 500,000 ريال" /></div>
            </div>
            <div><Label>وصف النزاع</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="resize-none min-h-[80px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.title || !form.claimant || !form.respondent || createMutation.isPending} className="gap-2">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              تسجيل القضية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
