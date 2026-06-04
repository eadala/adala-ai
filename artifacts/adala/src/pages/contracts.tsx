import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Plus, Search, Filter, Loader2, Sparkles, Eye, Trash2,
  AlertTriangle, CheckCircle, Clock, PenLine, XCircle, ChevronDown,
  Download, Shield, Printer
} from "lucide-react";
import { DocumentPrintTemplate, PrintButton } from "@/components/document-print-template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "مسودة", color: "text-muted-foreground", icon: PenLine },
  review: { label: "قيد المراجعة", color: "text-blue-400", icon: Eye },
  signed: { label: "موقّع", color: "text-emerald-400", icon: CheckCircle },
  expired: { label: "منتهي", color: "text-red-400", icon: XCircle },
  terminated: { label: "مُنهى", color: "text-orange-400", icon: XCircle },
};

const CONTRACT_TYPES = [
  { value: "employment", label: "عقد عمل" },
  { value: "partnership", label: "عقد شراكة" },
  { value: "investment", label: "عقد استثمار" },
  { value: "franchise", label: "عقد امتياز تجاري" },
  { value: "construction", label: "عقد مقاولات" },
  { value: "lease", label: "عقد إيجار" },
  { value: "service", label: "عقد خدمات" },
  { value: "nda", label: "اتفاقية سرية (NDA)" },
  { value: "general", label: "عقد عام" },
];

function riskColor(score: string | null) {
  if (!score) return "text-muted-foreground";
  const n = parseInt(score);
  if (n >= 7) return "text-red-400";
  if (n >= 4) return "text-yellow-400";
  return "text-emerald-400";
}

function ContractCard({ contract, onView, onDelete, onAnalyze }: any) {
  const statusCfg = STATUS_CONFIG[contract.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;
  const typeName = CONTRACT_TYPES.find(t => t.value === contract.type)?.label ?? contract.type;

  return (
    <Card className="group hover:border-primary/30 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{contract.title}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">{typeName}</Badge>
              {contract.aiGenerated && (
                <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/30">
                  <Sparkles className="h-2.5 w-2.5" /> AI
                </Badge>
              )}
            </div>
          </div>
          <div className={cn("flex items-center gap-1 text-xs font-medium", statusCfg.color)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {statusCfg.label}
          </div>
        </div>

        {contract.riskScore && (
          <div className="flex items-center gap-2 mb-3 text-xs">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">درجة المخاطرة:</span>
            <span className={cn("font-bold", riskColor(contract.riskScore))}>{contract.riskScore}/10</span>
          </div>
        )}

        {contract.expiresAt && (
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            ينتهي: {new Date(contract.expiresAt).toLocaleDateString("ar-SA")}
          </div>
        )}

        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onView(contract)}>
            <Eye className="h-3 w-3 ml-1" /> عرض
          </Button>
          {!contract.riskScore && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAnalyze(contract)}>
              <Shield className="h-3 w-3 ml-1" /> تحليل
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 mr-auto" onClick={() => onDelete(contract.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Contracts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [viewContract, setViewContract] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [form, setForm] = useState({ title: "", type: "general", parties: "", details: "", aiGenerate: true, notes: "", expiresAt: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery<any[]>({
    queryKey: ["contracts"],
    queryFn: () => fetch("/api/contracts").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/contracts", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); setShowCreate(false); toast({ title: "تم إنشاء العقد بنجاح" }); setForm({ title: "", type: "general", parties: "", details: "", aiGenerate: true, notes: "", expiresAt: "" }); },
    onError: () => toast({ title: "خطأ في إنشاء العقد", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/contracts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast({ title: "تم الحذف" }); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => fetch(`/api/contracts/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });

  const handleAnalyze = async (contract: any) => {
    setViewContract(contract);
    setAnalyzing(true);
    setAnalysisResult("");
    try {
      const res = await fetch(`/api/contracts/${contract.id}/analyze`, { method: "POST" });
      const data = await res.json();
      setAnalysisResult(data.analysis);
      qc.invalidateQueries({ queryKey: ["contracts"] });
    } catch {
      toast({ title: "خطأ في التحليل", variant: "destructive" });
    } finally { setAnalyzing(false); }
  };

  const filtered = contracts.filter(c =>
    (statusFilter === "all" || c.status === statusFilter) &&
    (c.title.includes(search) || !search)
  );

  const stats = {
    total: contracts.length,
    signed: contracts.filter(c => c.status === "signed").length,
    review: contracts.filter(c => c.status === "review").length,
    expiringSoon: contracts.filter(c => c.expiresAt && new Date(c.expiresAt) < new Date(Date.now() + 30 * 86400000)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">إدارة العقود</h1>
          <p className="text-muted-foreground text-sm">إنشاء ومراجعة وتتبع جميع عقودك القانونية</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> عقد جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "إجمالي العقود", value: stats.total, icon: FileText, color: "#6366F1" },
          { label: "موقّعة", value: stats.signed, icon: CheckCircle, color: "#10B981" },
          { label: "قيد المراجعة", value: stats.review, icon: Eye, color: "#3B82F6" },
          { label: "تنتهي قريباً", value: stats.expiringSoon, icon: AlertTriangle, color: "#F59E0B" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}18` }}>
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث في العقود..." className="pr-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 ml-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>لا توجد عقود — أنشئ عقدك الأول</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ContractCard key={c.id} contract={c} onView={setViewContract} onDelete={(id: string) => deleteMutation.mutate(id)} onAnalyze={handleAnalyze} />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>إنشاء عقد جديد</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>عنوان العقد *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: عقد إيجار مكتب الرياض" /></div>
            <div><Label>نوع العقد</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTRACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>أطراف العقد</Label><Input value={form.parties} onChange={e => setForm(p => ({ ...p, parties: e.target.value }))} placeholder="مثال: شركة الأمل للتطوير، محمد العمري" /></div>
            <div><Label>تفاصيل إضافية</Label><Textarea value={form.details} onChange={e => setForm(p => ({ ...p, details: e.target.value }))} placeholder="الموضوع والقيمة والشروط الجوهرية..." className="min-h-[80px] resize-none" /></div>
            <div><Label>تاريخ انتهاء العقد</Label><Input type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> توليد بالذكاء الاصطناعي</div>
                <div className="text-xs text-muted-foreground">يصيغ نص العقد كاملاً تلقائياً</div>
              </div>
              <Switch checked={form.aiGenerate} onCheckedChange={v => setForm(p => ({ ...p, aiGenerate: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={() => createMutation.mutate({ ...form, parties: form.parties.split("،").map(s => s.trim()) })} disabled={!form.title || createMutation.isPending} className="gap-2">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.aiGenerate ? "توليد بالذكاء الاصطناعي" : "إنشاء العقد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewContract} onOpenChange={() => { setViewContract(null); setAnalysisResult(""); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {viewContract?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <button key={k} onClick={() => updateStatusMutation.mutate({ id: viewContract.id, status: k })}
                className={cn("text-xs px-3 py-1 rounded-full border transition-all", viewContract?.status === k ? "bg-primary text-primary-foreground border-primary" : "border-muted hover:border-primary/50")}>
                {v.label}
              </button>
            ))}
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            {analysisResult ? (
              <div className="p-1">
                <h3 className="font-semibold text-sm mb-3 text-primary flex items-center gap-2"><Shield className="h-4 w-4" /> تقرير التحليل</h3>
                <pre className="whitespace-pre-wrap text-sm text-foreground/80 font-sans leading-relaxed">{analysisResult}</pre>
                <Separator className="my-4" />
              </div>
            ) : null}
            {analyzing ? (
              <div className="flex items-center gap-2 p-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> جاري تحليل العقد...
              </div>
            ) : null}
            <pre className="whitespace-pre-wrap text-sm text-foreground/80 font-sans leading-relaxed p-1">
              {viewContract?.content ?? "لا يوجد محتوى"}
            </pre>
          </ScrollArea>
          <DialogFooter>
            {!analysisResult && !analyzing && (
              <Button variant="outline" onClick={() => handleAnalyze(viewContract)} className="gap-2">
                <Shield className="h-4 w-4" /> تحليل المخاطر
              </Button>
            )}
            {viewContract && (
              <PrintButton label="طباعة العقد">
                <DocumentPrintTemplate
                  title={viewContract.title}
                  subtitle={CONTRACT_TYPES.find(t => t.value === viewContract.type)?.label}
                  docNumber={viewContract.id?.slice(0, 8).toUpperCase()}
                  date={new Date().toLocaleDateString("ar-EG")}
                  showStamp
                  showSignature
                >
                  {analysisResult && (
                    <div style={{ marginBottom: "16px", padding: "12px", background: "#f0f7ff", borderRadius: "8px", borderRight: "4px solid #1e3a5f" }}>
                      <div style={{ fontWeight: 700, marginBottom: "8px" }}>تقرير تحليل المخاطر</div>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", fontFamily: "Cairo, sans-serif" }}>{analysisResult}</pre>
                    </div>
                  )}
                  <div style={{ marginBottom: "12px", display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "13px" }}>
                    <span><strong>الحالة:</strong> {STATUS_CONFIG[viewContract.status]?.label}</span>
                    {viewContract.expiresAt && <span><strong>انتهاء:</strong> {new Date(viewContract.expiresAt).toLocaleDateString("ar-SA")}</span>}
                    {viewContract.riskScore && <span><strong>درجة المخاطرة:</strong> {viewContract.riskScore}/10</span>}
                  </div>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: "13px", fontFamily: "Cairo, sans-serif", lineHeight: 1.8 }}>
                    {viewContract.content ?? "لا يوجد محتوى"}
                  </pre>
                </DocumentPrintTemplate>
              </PrintButton>
            )}
            <Button onClick={() => { setViewContract(null); setAnalysisResult(""); }}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
