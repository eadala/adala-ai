import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import CharacterCount from "@tiptap/extension-character-count";
import {
  FileText, Plus, Search, Loader2, Sparkles, Eye, Trash2, AlertTriangle,
  CheckCircle, Clock, PenLine, XCircle, Shield, Scale, Building2, Home,
  Users, Cpu, ShoppingBag, Landmark, ChevronRight, History, Send, Copy,
  Download, Printer, Wand2, Bot, BookOpen, LayoutDashboard, ListFilter,
  Bold, Italic, UnderlineIcon, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Heading2, Highlighter, Undo2, Redo2, FileSignature,
  PenSquare, Zap, X, ChevronDown, BadgeCheck, RefreshCw, Link2, Hash,
  Star, TrendingUp, Layers
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/use-lang";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const api = (path: string) => `${BASE}/api${path}`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Contract {
  id: string; title: string; type: string; status: string;
  parties: string[]; content: string | null; ai_generated: boolean;
  risk_score: string | null; notes: string | null; expires_at: string | null;
  signed_at: string | null; client_id: string | null; case_id: string | null;
  office_id: string; version_number: number; value_amount: string | null;
  payment_method: string | null; is_locked: boolean;
  client_name?: string; case_title?: string; created_at: string;
}
interface Category { id: string; name: string; name_en: string; icon: string; color: string; template_count: number; }
interface Template { id: string; name: string; category_name: string; category_icon: string; category_color: string; content: string; usage_count: number; }
interface Stats { total: number; draft: number; review: number; signed: number; expired: number; expiringSoon: number; pendingSignature: number; aiGenerated: number; totalValue: number; }
interface Version { id: string; version_number: number; note: string; created_at: string; }

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft:      { label: "مسودة",         color: "text-slate-400",   bg: "bg-slate-400/10",   icon: PenLine },
  review:     { label: "قيد المراجعة",  color: "text-blue-400",    bg: "bg-blue-400/10",    icon: Eye },
  signed:     { label: "موقّع",          color: "text-emerald-400", bg: "bg-emerald-400/10", icon: CheckCircle },
  expired:    { label: "منتهي",          color: "text-red-400",     bg: "bg-red-400/10",     icon: XCircle },
  terminated: { label: "مُنهى",          color: "text-orange-400",  bg: "bg-orange-400/10",  icon: XCircle },
};

const CONTRACT_TYPES = [
  { value: "employment",   label: "عقد عمل" },
  { value: "partnership",  label: "عقد شراكة" },
  { value: "investment",   label: "عقد استثمار" },
  { value: "franchise",    label: "عقد امتياز تجاري" },
  { value: "construction", label: "عقد مقاولات" },
  { value: "lease",        label: "عقد إيجار" },
  { value: "service",      label: "عقد خدمات" },
  { value: "nda",          label: "اتفاقية سرية (NDA)" },
  { value: "general",      label: "عقد عام" },
];

const ICON_MAP: Record<string, any> = {
  Scale, Building2, Home, Users, Cpu, ShoppingBag, Landmark, FileText
};

const AI_ACTIONS = [
  { id: "improve",            label: "تحسين الصياغة",          icon: Wand2,      color: "#7C3AED" },
  { id: "risk_analysis",      label: "تحليل المخاطر",           icon: Shield,     color: "#DC2626" },
  { id: "summarize",          label: "تلخيص العقد",             icon: Layers,     color: "#0891B2" },
  { id: "missing_clauses",    label: "البنود الناقصة",           icon: AlertTriangle, color: "#D97706" },
  { id: "add_arbitration",    label: "إضافة بند تحكيم",          icon: Scale,      color: "#059669" },
  { id: "add_confidentiality",label: "إضافة بند سرية",           icon: Shield,     color: "#2563EB" },
  { id: "add_jurisdiction",   label: "إضافة بند الاختصاص",       icon: Landmark,   color: "#7C3AED" },
  { id: "add_non_compete",    label: "إضافة بند عدم منافسة",     icon: XCircle,    color: "#EA580C" },
];

function riskColor(score: string | null) {
  if (!score) return "text-muted-foreground";
  const n = parseInt(score);
  if (n >= 7) return "text-red-400";
  if (n >= 4) return "text-yellow-400";
  return "text-emerald-400";
}

// ── Tiptap Toolbar ─────────────────────────────────────────────────────────────
function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;
  const btn = (fn: () => void, active: boolean, icon: any, title: string) => {
    const Icon = icon;
    return (
      <button type="button" onMouseDown={e => { e.preventDefault(); fn(); }}
        title={title}
        className={cn("p-1.5 rounded transition-colors", active ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
        <Icon className="h-3.5 w-3.5" />
      </button>
    );
  };
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/50 bg-muted/30 flex-wrap">
      {btn(() => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), Bold, "عريض")}
      {btn(() => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), Italic, "مائل")}
      {btn(() => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"), UnderlineIcon, "تسطير")}
      {btn(() => editor.chain().focus().toggleHighlight().run(), editor.isActive("highlight"), Highlighter, "تمييز")}
      <div className="w-px h-4 bg-border/50 mx-1" />
      {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }), Heading2, "عنوان")}
      {btn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"), List, "قائمة نقطية")}
      {btn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"), ListOrdered, "قائمة مرقمة")}
      <div className="w-px h-4 bg-border/50 mx-1" />
      {btn(() => editor.chain().focus().setTextAlign("right").run(), editor.isActive({ textAlign: "right" }), AlignRight, "يمين")}
      {btn(() => editor.chain().focus().setTextAlign("center").run(), editor.isActive({ textAlign: "center" }), AlignCenter, "وسط")}
      {btn(() => editor.chain().focus().setTextAlign("left").run(), editor.isActive({ textAlign: "left" }), AlignLeft, "يسار")}
      <div className="w-px h-4 bg-border/50 mx-1" />
      {btn(() => editor.chain().focus().undo().run(), false, Undo2, "تراجع")}
      {btn(() => editor.chain().focus().redo().run(), false, Redo2, "إعادة")}
    </div>
  );
}

// ── Contract Editor Dialog ─────────────────────────────────────────────────────
function ContractEditorDialog({ contract, onClose, onSaved }: { contract: Contract | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activePanel, setActivePanel] = useState<"ai" | "versions" | null>("ai");
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [showSigDialog, setShowSigDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CharacterCount,
    ],
    content: contract?.content ?? "",
    editorProps: {
      attributes: {
        class: "min-h-[400px] prose prose-sm max-w-none focus:outline-none p-4 text-foreground",
        dir: "rtl",
      },
    },
  });

  useEffect(() => {
    if (editor && contract?.content !== undefined) {
      editor.commands.setContent(contract.content ?? "");
    }
  }, [contract?.id]);

  const { data: versions = [] } = useQuery<Version[]>({
    queryKey: ["contract-versions", contract?.id],
    queryFn: () => fetch(api(`/contracts/${contract?.id}/versions`)).then(r => r.json()),
    enabled: !!contract?.id && activePanel === "versions",
  });

  const handleSave = async () => {
    if (!contract || !editor) return;
    setSaving(true);
    try {
      const content = editor.getText() ? editor.getHTML() : "";
      const r = await fetch(api(`/contracts/${contract.id}`), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "تم الحفظ بنجاح" });
      onSaved();
    } catch { toast({ title: "خطأ في الحفظ", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleAiAction = async (actionId: string) => {
    if (!contract) return;
    setAiAction(actionId);
    setAiLoading(true);
    setAiResult("");
    try {
      const selectedText = editor?.state?.selection ? editor.state.doc.textBetween(
        editor.state.selection.from, editor.state.selection.to
      ) : "";
      const r = await fetch(api(`/contracts/${contract.id}/ai-action`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionId, selection: selectedText }),
      });
      const data = await r.json();
      setAiResult(data.result ?? data.error ?? "لا نتيجة");
    } catch { setAiResult("خطأ في الاتصال بالذكاء الاصطناعي"); }
    finally { setAiLoading(false); }
  };

  const insertAiResult = () => {
    if (!editor || !aiResult) return;
    editor.chain().focus().insertContent(`\n${aiResult}\n`).run();
    toast({ title: "تم إدراج النص في المحرر" });
  };

  const copyAiResult = () => {
    navigator.clipboard.writeText(aiResult).then(() => toast({ title: "تم النسخ" }));
  };

  const sendSignatureRequest = async () => {
    if (!contract || !signerName) return;
    const r = await fetch(api(`/contracts/${contract.id}/signature-request`), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signerName, signerEmail }),
    });
    if (r.ok) {
      toast({ title: "تم إرسال طلب التوقيع بنجاح" });
      setShowSigDialog(false);
      qc.invalidateQueries({ queryKey: ["contracts"] });
    }
  };

  const updateStatus = async (status: string) => {
    if (!contract) return;
    await fetch(api(`/contracts/${contract.id}`), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    qc.invalidateQueries({ queryKey: ["contracts"] });
    toast({ title: `تم تغيير الحالة إلى: ${STATUS_CONFIG[status]?.label}` });
  };

  const restoreVersion = async (v: Version) => {
    if (!editor) return;
    const r = await fetch(api(`/contracts/${contract?.id}/versions/${v.id}`));
    const data = await r.json();
    if (data.content) { editor.commands.setContent(data.content); toast({ title: `تم استعادة الإصدار ${v.version_number}` }); }
  };

  if (!contract) return null;
  const status = STATUS_CONFIG[contract.status] ?? STATUS_CONFIG.draft;

  return (
    <Dialog open={!!contract} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-7xl h-[92vh] flex flex-col p-0 gap-0" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-muted/20 flex-shrink-0">
          <div className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium", status.color, status.bg)}>
            <status.icon className="h-3 w-3" />
            {status.label}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm truncate">{contract.title}</h2>
            <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
              {contract.client_name && <span>العميل: {contract.client_name}</span>}
              {contract.case_title && <span>القضية: {contract.case_title}</span>}
              {contract.version_number > 1 && <span className="text-primary">الإصدار {contract.version_number}</span>}
              <span>{editor?.storage.characterCount?.characters() ?? 0} حرف</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Select onValueChange={updateStatus} defaultValue={contract.status}>
              <SelectTrigger className="h-7 text-xs w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <span className={cn("flex items-center gap-1.5", v.color)}>
                      <v.icon className="h-3 w-3" />{v.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              حفظ
            </Button>
            <PrintButton label="طباعة">
              <DocumentPrintTemplate title={contract.title} subtitle={CONTRACT_TYPES.find(t => t.value === contract.type)?.label} showStamp showSignature>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, fontFamily: "Cairo, sans-serif", lineHeight: 1.8 }}>
                  {editor?.getText() ?? contract.content ?? ""}
                </pre>
              </DocumentPrintTemplate>
            </PrintButton>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={() => setShowSigDialog(true)}>
              <FileSignature className="h-3.5 w-3.5" /> طلب توقيع
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Editor */}
          <div className="flex-1 flex flex-col min-w-0 border-l border-border/50" dir="rtl">
            <EditorToolbar editor={editor} />
            <ScrollArea className="flex-1">
              <EditorContent editor={editor} />
            </ScrollArea>
          </div>

          {/* Right Panel */}
          <div className="w-80 flex flex-col flex-shrink-0 bg-muted/10">
            {/* Panel Toggle */}
            <div className="flex border-b border-border/50">
              {[
                { id: "ai",       label: "الذكاء الاصطناعي", icon: Bot },
                { id: "versions", label: "الإصدارات",         icon: History },
              ].map(p => (
                <button key={p.id}
                  onClick={() => setActivePanel(activePanel === p.id ? null : p.id as any)}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                    activePanel === p.id ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
                  <p.icon className="h-3.5 w-3.5" />{p.label}
                </button>
              ))}
            </div>

            {/* AI Panel */}
            {activePanel === "ai" && (
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-1.5">
                  {AI_ACTIONS.map(action => (
                    <button key={action.id} onClick={() => handleAiAction(action.id)}
                      disabled={aiLoading}
                      className={cn("w-full flex items-center gap-2.5 p-2.5 rounded-lg text-xs text-right transition-all border",
                        aiAction === action.id ? "border-primary/50 bg-primary/5" : "border-border/40 hover:border-primary/30 hover:bg-muted/40",
                        aiLoading && aiAction !== action.id ? "opacity-50" : ""
                      )}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${action.color}18` }}>
                        {aiLoading && aiAction === action.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: action.color }} />
                          : <action.icon className="h-3.5 w-3.5" style={{ color: action.color }} />
                        }
                      </div>
                      <span className="font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>

                {aiResult && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary">نتيجة الذكاء الاصطناعي</span>
                      <div className="flex gap-1">
                        <button onClick={copyAiResult} title="نسخ" className="p-1 rounded hover:bg-muted">
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button onClick={insertAiResult} title="إدراج في المحرر" className="p-1 rounded hover:bg-muted">
                          <PenSquare className="h-3 w-3 text-primary" />
                        </button>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background p-3 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {aiResult}
                    </div>
                    <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1.5" onClick={insertAiResult}>
                      <PenSquare className="h-3 w-3" /> إدراج في المحرر
                    </Button>
                  </div>
                )}
              </ScrollArea>
            )}

            {/* Versions Panel */}
            {activePanel === "versions" && (
              <ScrollArea className="flex-1 p-3">
                {versions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    لا توجد إصدارات محفوظة
                  </div>
                ) : (
                  <div className="space-y-2">
                    {versions.map(v => (
                      <div key={v.id} className="p-2.5 rounded-lg border border-border/40 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-primary">الإصدار {v.version_number}</span>
                          <button onClick={() => restoreVersion(v)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <RefreshCw className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-muted-foreground">{v.note}</div>
                        <div className="text-muted-foreground mt-0.5">{new Date(v.created_at).toLocaleDateString("ar-SA")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Signature Request Dialog */}
      <Dialog open={showSigDialog} onOpenChange={setShowSigDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" />طلب توقيع رقمي</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>اسم الموقِّع *</Label><Input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="الاسم الكامل" /></div>
            <div><Label>البريد الإلكتروني</Label><Input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)} placeholder="example@email.com" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSigDialog(false)}>إلغاء</Button>
            <Button onClick={sendSignatureRequest} disabled={!signerName} className="gap-2"><Send className="h-4 w-4" />إرسال الطلب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ── AI Prompt Generator ────────────────────────────────────────────────────────
function AiPromptDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (d: any) => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(api("/contracts/generate-from-prompt"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await r.json();
      onCreated(data);
      onClose();
      setPrompt("");
    } catch { toast({ title: "خطأ في التوليد", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            توليد عقد من الوصف
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">صِف العقد الذي تريده بكلماتك الخاصة، وسيقوم الذكاء الاصطناعي بإنشاؤه كاملاً.</p>
          <Textarea
            value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="مثال: أريد عقد إيجار لمستودع تجاري في الرياض بين شركتين، الإيجار السنوي 80,000 ريال لمدة سنتين..."
            className="min-h-[120px] resize-none text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={generate} disabled={!prompt.trim() || loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            توليد بالذكاء الاصطناعي
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Contract Dialog ─────────────────────────────────────────────────────
function CreateContractDialog({ open, onClose, initialData, defaultTemplateId }: {
  open: boolean; onClose: () => void;
  initialData?: { title?: string; type?: string; parties?: string[]; content?: string };
  defaultTemplateId?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", type: "general", parties: "", details: "",
    aiGenerate: false, notes: "", expiresAt: "", valueAmount: "", paymentMethod: "",
  });
  const [templateId, setTemplateId] = useState<string | undefined>(defaultTemplateId);

  useEffect(() => {
    if (initialData) {
      setForm(p => ({
        ...p,
        title: initialData.title ?? "",
        type: initialData.type ?? "general",
        parties: (initialData.parties ?? []).join("، "),
      }));
    }
  }, [initialData]);

  useEffect(() => { setTemplateId(defaultTemplateId); }, [defaultTemplateId]);

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch(api("/contracts"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contracts-stats"] });
      onClose();
      toast({ title: "تم إنشاء العقد بنجاح ✓" });
      setForm({ title: "", type: "general", parties: "", details: "", aiGenerate: false, notes: "", expiresAt: "", valueAmount: "", paymentMethod: "" });
    },
    onError: () => toast({ title: "خطأ في إنشاء العقد", variant: "destructive" }),
  });

  const submit = () => createMutation.mutate({
    ...form,
    parties: form.parties.split(/[،,]/).map((s: string) => s.trim()).filter(Boolean),
    content: initialData?.content ?? undefined,
    templateId,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" />إنشاء عقد جديد</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>عنوان العقد *</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="مثال: عقد إيجار مكتب الرياض" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>نوع العقد</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTRACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>تاريخ الانتهاء</Label>
              <Input type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
            </div>
          </div>
          <div><Label>أطراف العقد</Label>
            <Input value={form.parties} onChange={e => setForm(p => ({ ...p, parties: e.target.value }))}
              placeholder="مثال: شركة الأمل، محمد العمري" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>القيمة المالية</Label>
              <Input value={form.valueAmount} onChange={e => setForm(p => ({ ...p, valueAmount: e.target.value }))}
                placeholder="مثال: 50,000 ريال" />
            </div>
            <div><Label>طريقة الدفع</Label>
              <Input value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}
                placeholder="مثال: تحويل بنكي" />
            </div>
          </div>
          <div><Label>تفاصيل إضافية</Label>
            <Textarea value={form.details} onChange={e => setForm(p => ({ ...p, details: e.target.value }))}
              placeholder="الموضوع والشروط الجوهرية..." className="min-h-[70px] resize-none" />
          </div>
          <div><Label>ملاحظات</Label>
            <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات داخلية" />
          </div>
          {!initialData?.content && (
            <div className="flex items-center justify-between rounded-xl border border-primary/20 p-3.5 bg-primary/5">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />توليد بالذكاء الاصطناعي</div>
                <div className="text-xs text-muted-foreground mt-0.5">يصيغ نص العقد كاملاً ويملأ البنود تلقائياً</div>
              </div>
              <Switch checked={form.aiGenerate} onCheckedChange={v => setForm(p => ({ ...p, aiGenerate: v }))} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={!form.title || createMutation.isPending} className="gap-2">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (form.aiGenerate ? <Sparkles className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
            {form.aiGenerate ? "توليد بالذكاء الاصطناعي" : "إنشاء العقد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Contracts() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { tx, dateLocale } = useLang();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [createInitialData, setCreateInitialData] = useState<any>(null);
  const [createTemplateId, setCreateTemplateId] = useState<string | undefined>();

  // Queries
  const { data: stats } = useQuery<Stats>({
    queryKey: ["contracts-stats"],
    queryFn: () => fetch(api("/contracts/stats")).then(r => r.json()),
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["contract-categories"],
    queryFn: () => fetch(api("/contract-categories")).then(r => r.json()),
  });
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["contract-templates", selectedCategory],
    queryFn: () => fetch(api(`/contract-templates${selectedCategory ? `?category_id=${selectedCategory}` : ""}`)).then(r => r.json()),
    enabled: activeTab === "library",
  });
  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ["contracts", search, statusFilter, typeFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (typeFilter !== "all") p.set("type", typeFilter);
      return fetch(api(`/contracts?${p}`)).then(r => r.json());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(api(`/contracts/${id}`), { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); qc.invalidateQueries({ queryKey: ["contracts-stats"] }); toast({ title: "تم الحذف" }); },
  });

  const useTemplate = (template: Template) => {
    setCreateInitialData({ title: template.name, type: "general", content: template.content });
    setCreateTemplateId(template.id);
    setShowCreate(true);
    setActiveTab("list");
  };

  const handleAiCreated = (data: any) => {
    setCreateInitialData(data);
    setShowCreate(true);
  };

  // ── STAT CARDS ──────────────────────────────────────────────────────────────
  const statCards = [
    { label: "إجمالي العقود",     value: stats?.total ?? 0,           icon: FileText,      color: "#6366F1" },
    { label: "موقّعة",             value: stats?.signed ?? 0,          icon: BadgeCheck,    color: "#10B981" },
    { label: "قيد المراجعة",      value: stats?.review ?? 0,          icon: Eye,           color: "#3B82F6" },
    { label: "تنتهي قريباً",       value: stats?.expiringSoon ?? 0,    icon: AlertTriangle, color: "#F59E0B" },
    { label: "بانتظار التوقيع",   value: stats?.pendingSignature ?? 0,icon: FileSignature, color: "#8B5CF6" },
    { label: "مُولَّدة بالذكاء",  value: stats?.aiGenerated ?? 0,     icon: Sparkles,      color: "#0891B2" },
    { label: "مسودات",            value: stats?.draft ?? 0,           icon: PenLine,       color: "#64748B" },
    { label: "القيمة الإجمالية",  value: stats?.totalValue ?? 0,      icon: TrendingUp,    color: "#059669", currency: true },
  ];

  // ── RECENT CONTRACTS ────────────────────────────────────────────────────────
  const recent = [...contracts].slice(0, 6);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            {tx("وحدة العقود الذكية", "Smart Contracts")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{tx("إنشاء ومراجعة وتتبع جميع عقودك القانونية بمساعدة الذكاء الاصطناعي", "AI-powered contract creation, review and tracking")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowAiPrompt(true)} className="gap-2 text-sm">
            <Bot className="h-4 w-4" /> {tx("توليد من الوصف", "Generate from prompt")}
          </Button>
          <Button onClick={() => { setCreateInitialData(null); setCreateTemplateId(undefined); setShowCreate(true); }} className="gap-2 text-sm">
            <Plus className="h-4 w-4" /> {tx("عقد جديد", "New Contract")}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9">
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs"><LayoutDashboard className="h-3.5 w-3.5" />لوحة المتابعة</TabsTrigger>
          <TabsTrigger value="library" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" />مكتبة القوالب</TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5 text-xs"><ListFilter className="h-3.5 w-3.5" />عقودي {contracts.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{contracts.length}</Badge>}</TabsTrigger>
        </TabsList>

        {/* ── Dashboard Tab ── */}
        <TabsContent value="dashboard" className="space-y-5 mt-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map(s => (
              <Card key={s.label} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}18` }}>
                    <s.icon className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-black" style={{ color: s.color }}>
                      {s.currency ? `${(s.value as number).toLocaleString("ar-SA", { maximumFractionDigits: 0 })}` : s.value}
                      {s.currency && <span className="text-xs font-normal mr-1 text-muted-foreground">ر.س</span>}
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Contracts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                أحدث العقود
                <Button size="sm" variant="ghost" className="mr-auto h-7 text-xs" onClick={() => setActiveTab("list")}>
                  عرض الكل <ChevronRight className="h-3 w-3 mr-0.5" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : recent.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">لا توجد عقود بعد — أنشئ عقدك الأول</p>
                  <Button size="sm" className="mt-3 gap-2" onClick={() => setShowCreate(true)}><Plus className="h-3.5 w-3.5" />إنشاء عقد</Button>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recent.map(c => {
                    const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
                    const typeName = CONTRACT_TYPES.find(t => t.value === c.type)?.label ?? c.type;
                    return (
                      <div key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => setEditingContract(c)}>
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", sc.color.replace("text-", "bg-"))} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{c.title}</div>
                          <div className="flex gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                            <span>{typeName}</span>
                            {c.client_name && <span>• {c.client_name}</span>}
                            {c.expires_at && <span>• ينتهي {new Date(c.expires_at).toLocaleDateString("ar-SA")}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.risk_score && (
                            <span className={cn("text-xs font-bold", riskColor(c.risk_score))}>{c.risk_score}/10</span>
                          )}
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc.color, sc.bg)}>{sc.label}</span>
                          <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-400/10 text-red-400 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "عقد من قالب",     icon: BookOpen,   color: "#7C3AED", action: () => setActiveTab("library") },
              { label: "توليد بالذكاء",   icon: Bot,        color: "#2563EB", action: () => setShowAiPrompt(true) },
              { label: "عقد فارغ",        icon: PenSquare,  color: "#059669", action: () => setShowCreate(true) },
              { label: "تحليل مخاطر",     icon: Shield,     color: "#DC2626", action: () => setActiveTab("list") },
            ].map(qa => (
              <button key={qa.label} onClick={qa.action}
                className="flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/40 transition-all text-right">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${qa.color}18` }}>
                  <qa.icon className="h-4.5 w-4.5" style={{ color: qa.color }} />
                </div>
                <span className="text-sm font-medium">{qa.label}</span>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* ── Library Tab ── */}
        <TabsContent value="library" className="mt-4">
          <div className="flex gap-5">
            {/* Categories Sidebar */}
            <div className="w-48 flex-shrink-0 space-y-1">
              <button onClick={() => setSelectedCategory(null)}
                className={cn("w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  !selectedCategory ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
                <Hash className="h-3.5 w-3.5" />
                جميع القوالب
                <Badge variant="secondary" className="mr-auto h-4 px-1 text-[10px]">{templates.length}</Badge>
              </button>
              {categories.map(cat => {
                const Icon = ICON_MAP[cat.icon] ?? FileText;
                return (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                    className={cn("w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                      selectedCategory === cat.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
                    <Icon className="h-3.5 w-3.5" style={{ color: selectedCategory === cat.id ? undefined : cat.color }} />
                    <span className="truncate">{cat.name}</span>
                    <Badge variant="secondary" className="mr-auto h-4 px-1 text-[10px]">{cat.template_count}</Badge>
                  </button>
                );
              })}
            </div>

            {/* Templates Grid */}
            <div className="flex-1">
              {templates.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>لا توجد قوالب في هذا القسم</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map(t => {
                    const Icon = ICON_MAP[t.category_icon] ?? FileText;
                    return (
                      <Card key={t.id} className="group hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer" onClick={() => useTemplate(t)}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: `${t.category_color}18` }}>
                              <Icon className="h-5 w-5" style={{ color: t.category_color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm truncate">{t.name}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">{t.category_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3" />
                              استُخدم {t.usage_count} مرة
                            </div>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                              <Plus className="h-3 w-3" /> استخدم
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── List Tab ── */}
        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder={tx("بحث في العقود...", "Search contracts...")} className="pr-9 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                {CONTRACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <FileText className="h-14 w-14 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-semibold mb-1">لا توجد عقود</p>
              <p className="text-sm mb-4">أنشئ عقدك الأول أو اختر من مكتبة القوالب</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />عقد جديد</Button>
                <Button variant="outline" onClick={() => setActiveTab("library")} className="gap-2"><BookOpen className="h-4 w-4" />مكتبة القوالب</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contracts.map(c => {
                const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
                const typeName = CONTRACT_TYPES.find(t => t.value === c.type)?.label ?? c.type;
                return (
                  <Card key={c.id} className="group hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer" onClick={() => setEditingContract(c)}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{c.title}</h3>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{typeName}</Badge>
                            {c.ai_generated && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5 text-primary border-primary/30">
                                <Sparkles className="h-2.5 w-2.5" /> AI
                              </Badge>
                            )}
                            {c.version_number > 1 && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">v{c.version_number}</Badge>
                            )}
                          </div>
                        </div>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 flex-shrink-0", sc.color, sc.bg)}>
                          <sc.icon className="h-3 w-3" />{sc.label}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        {c.client_name && (
                          <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />{c.client_name}</div>
                        )}
                        {c.value_amount && (
                          <div className="flex items-center gap-1.5"><TrendingUp className="h-3 w-3" />{c.value_amount}</div>
                        )}
                        {c.risk_score && (
                          <div className="flex items-center gap-1.5">
                            <Shield className="h-3 w-3" />
                            <span>المخاطرة: <span className={cn("font-bold", riskColor(c.risk_score))}>{c.risk_score}/10</span></span>
                          </div>
                        )}
                        {c.expires_at && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            ينتهي: {new Date(c.expires_at).toLocaleDateString("ar-SA")}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1.5 mt-3 pt-3 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 flex-1" onClick={e => { e.stopPropagation(); setEditingContract(c); }}>
                          <PenSquare className="h-3 w-3" /> فتح المحرر
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                          onClick={e => { e.stopPropagation(); deleteMutation.mutate(c.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ContractEditorDialog
        contract={editingContract}
        onClose={() => setEditingContract(null)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["contracts"] }); }}
      />

      <AiPromptDialog
        open={showAiPrompt}
        onClose={() => setShowAiPrompt(false)}
        onCreated={handleAiCreated}
      />

      <CreateContractDialog
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateInitialData(null); setCreateTemplateId(undefined); }}
        initialData={createInitialData}
        defaultTemplateId={createTemplateId}
      />
    </div>
  );
}
