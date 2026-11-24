/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; authFetch migration */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { authFetch } from "@/lib/authFetch";
import {
  FileText, Gavel, Mail, Scroll, Sparkles, Wand2,
  Copy, Download, Trash2, Clock, ChevronRight,
  Loader2, RefreshCw, FileSignature, BookOpen,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── category metadata ── */
const CATEGORIES: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  "عقود":             { icon: FileText,      color: "text-blue-400",   bg: "bg-blue-500/10" },
  "مذكرات قانونية":   { icon: Gavel,         color: "text-amber-400",  bg: "bg-amber-500/10" },
  "ردود قانونية":     { icon: RefreshCw,     color: "text-green-400",  bg: "bg-green-500/10" },
  "خطابات قانونية":   { icon: Mail,          color: "text-purple-400", bg: "bg-purple-500/10" },
  "وثائق رسمية":      { icon: Scroll,        color: "text-rose-400",   bg: "bg-rose-500/10" },
  "صياغة مخصصة":     { icon: Sparkles,      color: "text-primary",       bg: "bg-amber-500/10" },
};

type FieldDef = {
  key: string; label: string; placeholder?: string;
  textarea?: boolean; required?: boolean;
};
type TemplateInfo = {
  category: string; label: string; fields: FieldDef[];
};

/* ── helpers ── */
function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── main component ── */
export default function LegalAIPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [formVars, setFormVars] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [refineMode, setRefineMode] = useState(false);
  const [refineText, setRefineText] = useState("");
  const [model, setModel] = useState("auto");
  const [viewMode, setViewMode] = useState<"generate" | "history">("generate");
  const [linkedCaseId, setLinkedCaseId] = useState("");
  const [linkedClientId, setLinkedClientId] = useState("");
  const [signDialog, setSignDialog] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signUrl, setSignUrl] = useState("");
  const [signLoading, setSignLoading] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const { data: casesList = [] } = useQuery<any[]>({
    queryKey: ["cases-list"],
    queryFn: () => authFetch(`${BASE}/api/cases`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 60_000,
  });
  const { data: clientsList = [] } = useQuery<any[]>({
    queryKey: ["clients-list"],
    queryFn: () => authFetch(`${BASE}/api/clients`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 60_000,
  });

  const { data: templates = {} } = useQuery<Record<string, TemplateInfo>>({
    queryKey: ["legal-ai-templates"],
    queryFn: () => authFetch(`${BASE}/api/legal-ai/templates`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: Infinity,
  });

  const { data: history = [], refetch: refetchHistory } = useQuery<any[]>({
    queryKey: ["legal-ai-history"],
    queryFn: () => authFetch(`${BASE}/api/legal-ai/history`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled: viewMode === "history",
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/legal-ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: selectedType, variables: formVars, model,
          caseId: linkedCaseId || undefined,
          clientId: linkedClientId || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      setGeneratedId(data.id ?? null);
      qc.invalidateQueries({ queryKey: ["legal-ai-history"] });
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (e: any) => toast({ title: "خطأ في التوليد", description: e.message, variant: "destructive" }),
  });

  const refineMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`${BASE}/api/legal-ai/${id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: refineText, model }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      setRefineMode(false);
      setRefineText("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      authFetch(`${BASE}/api/legal-ai/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      refetchHistory();
      toast({ title: "تم الحذف" });
    },
  });

  const loadHistoryItem = async (id: string) => {
    const res = await authFetch(`${BASE}/api/legal-ai/${id}`);
    const data = await res.json();
    setGeneratedContent(data.content);
    setGeneratedId(id);
    setSelectedType(data.doc_type);
    setViewMode("generate");
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const currentTemplate = selectedType ? templates[selectedType] : null;

  const grouped = groupBy(
    Object.entries(templates).map(([id, t]) => ({ id, ...t })),
    (item) => item.category
  );

  const selectType = (typeId: string) => {
    setSelectedType(typeId);
    setFormVars({});
    setGeneratedContent("");
    setGeneratedId(null);
  };

  const copyContent = () => {
    navigator.clipboard.writeText(generatedContent);
    toast({ title: "تم النسخ" });
  };

  const canGenerate = selectedType && !generateMutation.isPending && (
    !currentTemplate?.fields.some(f => f.required && !formVars[f.key])
  );

  return (
    <>
    <div className="h-full flex flex-col gap-0">
      {/* header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <FileSignature className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">محرك الوثائق القانونية</h1>
            <p className="text-xs text-white/50">توليد عقود ومذكرات وردود بالذكاء الاصطناعي</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-36 h-8 text-xs bg-muted border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">تلقائي</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="claude">Claude</SelectItem>
              <SelectItem value="openai">GPT-4o</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={viewMode === "history" ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setViewMode(v => v === "history" ? "generate" : "history")}
          >
            <Clock className="w-3.5 h-3.5" />
            السجل
          </Button>
        </div>
      </div>

      {viewMode === "history" ? (
        /* ── history view ── */
        <ScrollArea className="flex-1 p-6">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-3">
              <BookOpen className="w-12 h-12" />
              <p>لا توجد وثائق سابقة</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto">
              {history.map((doc: any) => (
                <div
                  key={doc.id}
                  className="bg-card rounded-xl p-4 border border-border hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-muted text-muted-foreground text-xs border-0">
                          {doc.doc_category}
                        </Badge>
                        <span className="text-xs text-white/40">
                          {new Date(doc.created_at).toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                      <p className="font-medium text-white text-sm truncate">{doc.title}</p>
                      <p className="text-xs text-white/40 mt-1 line-clamp-2">{doc.preview}...</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                        onClick={() => loadHistoryItem(doc.id)}
                      >
                        عرض
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-white/40 hover:text-red-400 hover:bg-red-400/10"
                        onClick={() => { if (window.confirm("هل تريد حذف هذا المستند نهائياً؟")) deleteMutation.mutate(doc.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      ) : (
        /* ── generate view ── */
        <div className="flex-1 flex overflow-hidden">
          {/* left: type selector */}
          <div className="w-64 shrink-0 border-l border-border flex flex-col">
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-4">
                {Object.entries(grouped).map(([category, items]) => {
                  const meta = CATEGORIES[category] ?? { icon: FileText, color: "text-muted-foreground", bg: "bg-muted/50" };
                  const CatIcon = meta.icon;
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 px-2 mb-1.5">
                        <CatIcon className={cn("w-3.5 h-3.5", meta.color)} />
                        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                          {category}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => selectType(item.id)}
                            className={cn(
                              "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all text-right",
                              selectedType === item.id
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            <span>{item.label}</span>
                            {selectedType === item.id && (
                              <ChevronRight className="w-3 h-3 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* right: form + output */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedType ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/30 p-8">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Wand2 className="w-10 h-10 text-primary/50" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-white/40">اختر نوع الوثيقة</p>
                  <p className="text-sm mt-1">اختر من القائمة على اليسار</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6 max-w-2xl mx-auto">
                  {/* form header */}
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
                      CATEGORIES[currentTemplate?.category ?? ""]?.bg ?? "bg-muted/30")}>
                      {(() => {
                        const Icon = CATEGORIES[currentTemplate?.category ?? ""]?.icon ?? FileText;
                        return <Icon className={cn("w-5 h-5", CATEGORIES[currentTemplate?.category ?? ""]?.color ?? "text-primary")} />;
                      })()}
                    </div>
                    <div>
                      <h2 className="font-bold text-foreground">{currentTemplate?.label}</h2>
                      <p className="text-xs text-white/40">{currentTemplate?.category}</p>
                    </div>
                  </div>

                  {/* link to case/client */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-white/50">ربط بقضية (اختياري)</Label>
                      <Select value={linkedCaseId || "__none__"} onValueChange={v => setLinkedCaseId(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="bg-muted border-border text-white text-xs h-8">
                          <SelectValue placeholder="اختر قضية..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— بدون ربط —</SelectItem>
                          {(casesList as any[]).map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-white/50">ربط بعميل (اختياري)</Label>
                      <Select value={linkedClientId || "__none__"} onValueChange={v => setLinkedClientId(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="bg-muted border-border text-white text-xs h-8">
                          <SelectValue placeholder="اختر عميل..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— بدون ربط —</SelectItem>
                          {(clientsList as any[]).map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* fields */}
                  <div className="grid grid-cols-1 gap-4">
                    {currentTemplate?.fields.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <Label className="text-xs text-white/60">
                          {field.label}
                          {field.required && <span className="text-red-400 me-1">*</span>}
                        </Label>
                        {field.textarea ? (
                          <Textarea
                            dir="rtl"
                            rows={3}
                            placeholder={field.placeholder}
                            value={formVars[field.key] ?? ""}
                            onChange={(e) => setFormVars(v => ({ ...v, [field.key]: e.target.value }))}
                            className="bg-muted border-border text-white placeholder:text-white/30 resize-none text-sm"
                          />
                        ) : (
                          <Input
                            dir="rtl"
                            placeholder={field.placeholder}
                            value={formVars[field.key] ?? ""}
                            onChange={(e) => setFormVars(v => ({ ...v, [field.key]: e.target.value }))}
                            className="bg-muted border-border text-white placeholder:text-white/30 text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-full gap-2 bg-primary hover:bg-primary/90 text-white font-bold"
                    disabled={!canGenerate}
                    onClick={() => generateMutation.mutate()}
                  >
                    {generateMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />جاري التوليد...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" />توليد الوثيقة بالذكاء الاصطناعي</>
                    )}
                  </Button>

                  {/* generated output */}
                  {generatedContent && (
                    <div ref={outputRef} className="space-y-3">
                      <Separator className="bg-border" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">الوثيقة المولّدة</span>
                        <div className="flex gap-1">
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 px-2 text-xs text-white/60 hover:text-white gap-1"
                            onClick={copyContent}
                          >
                            <Copy className="w-3 h-3" />نسخ
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 px-2 text-xs text-white/60 hover:text-white gap-1"
                            onClick={() => downloadText(generatedContent, `${currentTemplate?.label ?? "وثيقة"}.txt`)}
                          >
                            <Download className="w-3 h-3" />تنزيل
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 px-2 text-xs text-primary hover:bg-primary/10 gap-1"
                            onClick={() => setRefineMode(r => !r)}
                          >
                            <Wand2 className="w-3 h-3" />تحسين
                          </Button>
                          {generatedId && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 px-2 text-xs text-emerald-400 hover:bg-emerald-500/10 gap-1"
                              onClick={() => { setSignerName(""); setSignerEmail(""); setSignUrl(""); setSignDialog(true); }}
                            >
                              <FileSignature className="w-3 h-3" />توقيع
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="bg-card rounded-xl border border-border p-5">
                        <pre
                          dir="rtl"
                          className="whitespace-pre-wrap text-sm text-white/85 font-sans leading-relaxed"
                        >
                          {generatedContent}
                        </pre>
                      </div>

                      {refineMode && (
                        <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 space-y-3">
                          <p className="text-xs text-primary font-medium">تعليمات التحسين</p>
                          <Textarea
                            dir="rtl"
                            rows={2}
                            placeholder="مثال: أضف بنداً للسرية، اجعل الأسلوب أكثر رسمية، قصّر العقد..."
                            value={refineText}
                            onChange={(e) => setRefineText(e.target.value)}
                            className="bg-muted border-border text-white placeholder:text-white/30 resize-none text-sm"
                          />
                          <Button
                            size="sm"
                            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold gap-1"
                            disabled={!refineText.trim() || refineMutation.isPending}
                            onClick={() => {
                              if (generatedId) refineMutation.mutate(generatedId);
                              else {
                                toast({ title: "احفظ الوثيقة أولاً", description: "أعد التوليد لتتمكن من التحسين" });
                              }
                            }}
                          >
                            {refineMutation.isPending
                              ? <><Loader2 className="w-3 h-3 animate-spin" />جاري التحسين...</>
                              : <><Wand2 className="w-3 h-3" />تطبيق التحسينات</>
                            }
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}
    </div>

    {/* Signature Request Dialog */}
    {signDialog && (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !signLoading && setSignDialog(false)}>
        <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()} dir="rtl">
          <div className="flex items-center gap-3">
            <FileSignature className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">طلب توقيع إلكتروني</h3>
          </div>
          {signUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-400">✓ تم إنشاء رابط التوقيع بنجاح</p>
              <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground break-all border border-border">
                {signUrl}
              </div>
              <button
                className="w-full bg-emerald-500/20 text-emerald-400 rounded-xl py-2.5 text-sm font-semibold hover:bg-emerald-500/30 transition"
                onClick={() => { navigator.clipboard.writeText(signUrl); }}
              >
                نسخ الرابط
              </button>
              <button className="w-full text-white/40 text-xs" onClick={() => setSignDialog(false)}>إغلاق</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-white/60">اسم الموقّع *</label>
                <input
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="الاسم الكامل..."
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/60">البريد الإلكتروني (اختياري)</label>
                <input
                  value={signerEmail}
                  onChange={e => setSignerEmail(e.target.value)}
                  placeholder="example@domain.com"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-emerald-500/50"
                  dir="ltr"
                />
              </div>
              <button
                disabled={!signerName.trim() || signLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-bold transition"
                onClick={async () => {
                  if (!generatedId || !signerName.trim()) return;
                  setSignLoading(true);
                  try {
                    const r = await authFetch(`${BASE}/api/signatures/request`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ documentId: generatedId, signerName, signerEmail }),
                    });
                    const data = await r.json();
                    if (data.signUrl) setSignUrl(data.signUrl);
                    else toast({ title: "خطأ", description: data.error, variant: "destructive" });
                  } catch {
                    toast({ title: "خطأ في الاتصال", variant: "destructive" });
                  } finally {
                    setSignLoading(false);
                  }
                }}
              >
                {signLoading ? "جاري الإنشاء..." : "إنشاء رابط التوقيع"}
              </button>
              <button className="w-full text-white/40 text-xs" onClick={() => setSignDialog(false)}>إلغاء</button>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
