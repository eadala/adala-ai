import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import CharacterCount from "@tiptap/extension-character-count";
import {
  FileText, Plus, Search, Loader2, Sparkles, Eye, Trash2, AlertTriangle, FolderOpen,
  CheckCircle, Clock, PenLine, XCircle, Shield, Scale, Building2, Home,
  Users, Cpu, Landmark, ChevronRight, History, Send, Copy, Wand2,
  Bot, BookOpen, LayoutDashboard, ListFilter, Bold, Italic, UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Heading2,
  Highlighter, Undo2, Redo2, FileSignature, PenSquare, Zap, BadgeCheck,
  RefreshCw, Hash, Star, TrendingUp, Layers, ChevronDown, ChevronUp, X,
  ShoppingBag, Check, SlidersHorizontal
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
const api = (p: string) => `${BASE}/api${p}`;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Contract {
  id: string; title: string; type: string; status: string;
  parties: string[]; content: string | null; ai_generated: boolean;
  risk_score: string | null; notes: string | null; expires_at: string | null;
  client_id: string | null; case_id: string | null; office_id: string;
  version_number: number; value_amount: string | null; payment_method: string | null;
  is_locked: boolean; compliance_score: string | null;
  client_name?: string; case_title?: string; created_at: string;
}
interface Category   { id: string; name: string; icon: string; color: string; template_count: number; }
interface Template   { id: string; name: string; category_name: string; category_icon: string; category_color: string; content: string; usage_count: number; }
interface Stats      { total: number; draft: number; review: number; signed: number; expiringSoon: number; pendingSignature: number; aiGenerated: number; totalValue: number; }
interface Version    { id: string; version_number: number; note: string; created_at: string; }

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft:      { label: "مسودة",        color: "text-muted-foreground",   bg: "bg-slate-400/10",   icon: PenLine    },
  review:     { label: "قيد المراجعة", color: "text-blue-400",    bg: "bg-blue-400/10",    icon: Eye        },
  signed:     { label: "موقّع",         color: "text-emerald-400", bg: "bg-emerald-400/10", icon: CheckCircle},
  expired:    { label: "منتهي",         color: "text-red-400",     bg: "bg-red-400/10",     icon: XCircle   },
  terminated: { label: "مُنهى",         color: "text-orange-400",  bg: "bg-orange-400/10",  icon: XCircle   },
};
const CONTRACT_TYPES = [
  { value: "employment",   label: "عقد عمل" },
  { value: "partnership",  label: "عقد شراكة" },
  { value: "investment",   label: "عقد استثمار" },
  { value: "franchise",    label: "عقد امتياز تجاري" },
  { value: "construction", label: "عقد مقاولات" },
  { value: "lease",        label: "عقد إيجار" },
  { value: "service",      label: "عقد خدمات" },
  { value: "nda",          label: "اتفاقية سرية" },
  { value: "general",      label: "عقد عام" },
];
const ICON_MAP: Record<string, any> = { Scale, Building2, Home, Users, Cpu, ShoppingBag, Landmark, FileText };

const SMART_CLAUSES = [
  { id: "arbitration",     label: "شرط التحكيم",        desc: "تسوية النزاعات عبر هيئة تحكيم سعودية",  icon: Scale        },
  { id: "confidentiality", label: "شرط السرية",          desc: "حماية المعلومات والأسرار التجارية",     icon: Shield       },
  { id: "force_majeure",   label: "القوة القاهرة",       desc: "إعفاء عند الكوارث والظروف القسرية",    icon: AlertTriangle},
  { id: "late_payment",    label: "غرامة التأخير",        desc: "0.5٪ أسبوعياً على المبالغ المتأخرة",   icon: Clock        },
  { id: "ip_ownership",    label: "الملكية الفكرية",      desc: "ملكية حصرية للأعمال المنتجة",          icon: FileText     },
  { id: "jurisdiction",    label: "الاختصاص القضائي",     desc: "محاكم المملكة العربية السعودية",        icon: Landmark     },
];

const AI_ACTIONS = [
  { id: "improve",             label: "تحسين الصياغة",        icon: Wand2,         color: "#7C3AED" },
  { id: "compliance_check",    label: "فحص توافق الأنظمة",    icon: BadgeCheck,    color: "#059669" },
  { id: "risk_analysis",       label: "تحليل المخاطر",         icon: Shield,        color: "#DC2626" },
  { id: "summarize",           label: "تلخيص العقد",           icon: Layers,        color: "#0891B2" },
  { id: "missing_clauses",     label: "البنود الناقصة",         icon: AlertTriangle, color: "#D97706" },
  { id: "add_arbitration",     label: "إضافة بند تحكيم",        icon: Scale,         color: "#2563EB" },
  { id: "add_confidentiality", label: "إضافة بند سرية",         icon: Shield,        color: "#6366F1" },
  { id: "add_force_majeure",   label: "إضافة قوة قاهرة",        icon: Zap,           color: "#EA580C" },
  { id: "add_jurisdiction",    label: "إضافة بند اختصاص",       icon: Landmark,      color: "#7C3AED" },
];

function riskColor(s: string | null) {
  if (!s) return "text-muted-foreground";
  const n = parseInt(s);
  return n >= 7 ? "text-red-400" : n >= 4 ? "text-yellow-400" : "text-emerald-400";
}

// ── Tiptap Toolbar ─────────────────────────────────────────────────────────────
function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;
  const B = ({ fn, active, icon: Icon, title }: any) => (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); fn(); }}
      className={cn("p-1 sm:p-1.5 rounded transition-colors flex-shrink-0",
        active ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-1 border-b border-border/50 bg-muted/30 overflow-x-auto flex-shrink-0">
      <B fn={() => editor.chain().focus().toggleBold().run()}      active={editor.isActive("bold")}      icon={Bold}          title="عريض" />
      <B fn={() => editor.chain().focus().toggleItalic().run()}    active={editor.isActive("italic")}    icon={Italic}        title="مائل" />
      <B fn={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} icon={UnderlineIcon} title="تسطير" />
      <B fn={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} icon={Highlighter}   title="تمييز" />
      <div className="w-px h-3.5 bg-border/50 mx-0.5 flex-shrink-0" />
      <B fn={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} icon={Heading2}     title="عنوان" />
      <B fn={() => editor.chain().focus().toggleBulletList().run()}          active={editor.isActive("bulletList")}              icon={List}         title="قائمة" />
      <B fn={() => editor.chain().focus().toggleOrderedList().run()}         active={editor.isActive("orderedList")}             icon={ListOrdered}  title="مرقمة" />
      <div className="w-px h-3.5 bg-border/50 mx-0.5 flex-shrink-0" />
      <B fn={() => editor.chain().focus().setTextAlign("right").run()}  active={editor.isActive({ textAlign: "right" })}  icon={AlignRight}  title="يمين" />
      <B fn={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} icon={AlignCenter} title="وسط" />
      <B fn={() => editor.chain().focus().setTextAlign("left").run()}   active={editor.isActive({ textAlign: "left" })}   icon={AlignLeft}   title="يسار" />
      <div className="w-px h-3.5 bg-border/50 mx-0.5 flex-shrink-0" />
      <B fn={() => editor.chain().focus().undo().run()} active={false} icon={Undo2} title="تراجع" />
      <B fn={() => editor.chain().focus().redo().run()} active={false} icon={Redo2} title="إعادة" />
      <div className="mr-auto text-[10px] text-muted-foreground px-1 flex-shrink-0">
        {editor?.storage.characterCount?.characters() ?? 0} حرف
      </div>
    </div>
  );
}

// ── Smart Clauses Selector ─────────────────────────────────────────────────────
function SmartClausesPanel({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">البنود الاختيارية السعودية</span>
        {selected.length > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{selected.length} محدد</Badge>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SMART_CLAUSES.map(c => {
          const isSelected = selected.includes(c.id);
          return (
            <button key={c.id} type="button" onClick={() => toggle(c.id)}
              className={cn("flex items-start gap-2.5 p-2.5 rounded-lg border text-right transition-all text-xs",
                isSelected ? "border-primary/60 bg-primary/8 text-foreground" : "border-border/50 hover:border-primary/30 hover:bg-muted/30 text-muted-foreground")}>
              <div className={cn("w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {isSelected ? <Check className="h-3 w-3" /> : <c.icon className="h-3 w-3" />}
              </div>
              <div className="min-w-0">
                <div className={cn("font-medium leading-tight", isSelected && "text-foreground")}>{c.label}</div>
                <div className="text-[10px] mt-0.5 opacity-70 leading-tight">{c.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Contract Editor Dialog ─────────────────────────────────────────────────────
function ContractEditorDialog({ contract, onClose, onSaved }: { contract: Contract | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [panel, setPanel] = useState<"ai" | "versions" | null>("ai");
  const [panelOpen, setPanelOpen] = useState(false); // for mobile bottom panel
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [showSigDlg, setShowSigDlg] = useState(false);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Highlight, TextAlign.configure({ types: ["heading", "paragraph"] }), CharacterCount],
    content: contract?.content ?? "",
    editorProps: { attributes: { class: "min-h-[300px] sm:min-h-[400px] prose prose-sm max-w-none focus:outline-none p-3 sm:p-4 text-foreground", dir: "rtl" } },
  });

  useEffect(() => {
    if (editor && contract?.content !== undefined) editor.commands.setContent(contract.content ?? "");
  }, [contract?.id]);

  const { data: versions = [] } = useQuery<Version[]>({
    queryKey: ["contract-versions", contract?.id],
    queryFn: () => fetch(api(`/contracts/${contract?.id}/versions`)).then(r => r.json()),
    enabled: !!contract?.id && panel === "versions",
  });

  const handleSave = async () => {
    if (!contract || !editor) return;
    setSaving(true);
    try {
      const content = editor.getHTML();
      const r = await fetch(api(`/contracts/${contract.id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      if (!r.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "تم الحفظ ✓" });
      onSaved();
    } catch { toast({ title: "خطأ في الحفظ", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleAiAction = async (actionId: string) => {
    if (!contract) return;
    setAiAction(actionId); setAiLoading(true); setAiResult("");
    setPanelOpen(true);
    try {
      const sel = editor?.state.selection ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to) : "";
      const r = await fetch(api(`/contracts/${contract.id}/ai-action`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionId, selection: sel }) });
      const d = await r.json();
      setAiResult(d.result ?? d.error ?? "لا نتيجة");
    } catch { setAiResult("خطأ في الاتصال بالذكاء الاصطناعي"); }
    finally { setAiLoading(false); }
  };

  const insertAiResult = () => {
    if (!editor || !aiResult) return;
    editor.chain().focus().insertContent(`\n${aiResult}\n`).run();
    toast({ title: "تم إدراج النص في المحرر" });
  };

  const updateStatus = async (status: string) => {
    if (!contract) return;
    await fetch(api(`/contracts/${contract.id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    qc.invalidateQueries({ queryKey: ["contracts"] });
    toast({ title: `الحالة: ${STATUS_CFG[status]?.label}` });
  };

  const restoreVersion = async (v: Version) => {
    const r = await fetch(api(`/contracts/${contract?.id}/versions/${v.id}`));
    const d = await r.json();
    if (d.content) { editor?.commands.setContent(d.content); toast({ title: `استُعيد الإصدار ${v.version_number}` }); }
  };

  const sendSig = async () => {
    if (!contract || !signerName) return;
    const r = await fetch(api(`/contracts/${contract.id}/signature-request`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signerName, signerEmail }) });
    if (r.ok) { toast({ title: "تم إرسال طلب التوقيع ✓" }); setShowSigDlg(false); qc.invalidateQueries({ queryKey: ["contracts"] }); }
  };

  if (!contract) return null;
  const sc = STATUS_CFG[contract.status] ?? STATUS_CFG.draft;

  return (
    <Dialog open={!!contract} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-none sm:max-w-7xl h-[100dvh] sm:h-[92vh] flex flex-col p-0 gap-0 rounded-none sm:rounded-lg" dir="rtl">
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 border-b border-border/50 bg-muted/20 flex-shrink-0 flex-wrap">
          <span className={cn("flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0", sc.color, sc.bg)}>
            <sc.icon className="h-3 w-3" />{sc.label}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-xs sm:text-sm truncate">{contract.title}</div>
            <div className="flex gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5 flex-wrap">
              {contract.client_name && <span>العميل: {contract.client_name}</span>}
              {contract.version_number > 1 && <span className="text-primary">v{contract.version_number}</span>}
              {contract.compliance_score && <span className="text-emerald-400">توافق: {contract.compliance_score}٪</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            <Select onValueChange={updateStatus} defaultValue={contract.status}>
              <SelectTrigger className="h-6 sm:h-7 text-[11px] w-28 sm:w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CFG).map(([k, v]) => (
                  <SelectItem key={k} value={k}><span className={cn("flex items-center gap-1.5", v.color)}><v.icon className="h-3 w-3" />{v.label}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-6 sm:h-7 text-[11px] gap-1 px-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null} حفظ
            </Button>
            <Button size="sm" variant="ghost" className="h-6 sm:h-7 text-[11px] gap-1 px-2 hidden sm:flex" onClick={() => setShowSigDlg(true)}>
              <FileSignature className="h-3 w-3" /> توقيع
            </Button>
            <PrintButton label="">
              <DocumentPrintTemplate title={contract.title} showStamp showSignature>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, fontFamily: "Cairo, sans-serif", lineHeight: 1.8 }}>{editor?.getText() ?? ""}</pre>
              </DocumentPrintTemplate>
            </PrintButton>
          </div>
        </div>

        {/* ── Body: editor + panel ── */}
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          {/* Editor */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0 border-b lg:border-b-0 lg:border-l border-border/50">
            <EditorToolbar editor={editor} />
            <ScrollArea className="flex-1">
              <EditorContent editor={editor} />
            </ScrollArea>
          </div>

          {/* Panel — desktop: fixed sidebar; mobile: toggle drawer */}
          <div className={cn(
            "flex flex-col bg-muted/10 transition-all",
            "lg:w-72 xl:w-80",
            panelOpen ? "h-64 sm:h-72 flex-shrink-0" : "h-auto flex-shrink-0",
            "lg:h-auto"
          )}>
            {/* Panel toggle buttons */}
            <div className="flex border-b border-border/50 flex-shrink-0">
              {[{ id: "ai", label: "الذكاء الاصطناعي", icon: Bot }, { id: "versions", label: "الإصدارات", icon: History }].map(p => (
                <button key={p.id}
                  onClick={() => { setPanel(panel === p.id ? null : p.id as any); setPanelOpen(true); }}
                  className={cn("flex-1 flex items-center justify-center gap-1 py-2 text-[11px] sm:text-xs font-medium transition-colors",
                    panel === p.id ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
                  <p.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              ))}
              {/* Mobile close panel */}
              <button onClick={() => setPanelOpen(!panelOpen)}
                className="lg:hidden px-2 text-muted-foreground hover:text-foreground">
                {panelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>

            {/* Panel content */}
            {(panelOpen || window.innerWidth >= 1024) && (
              <ScrollArea className="flex-1">
                {panel === "ai" && (
                  <div className="p-2 sm:p-3 space-y-1.5">
                    {AI_ACTIONS.map(action => (
                      <button key={action.id} onClick={() => handleAiAction(action.id)} disabled={aiLoading}
                        className={cn("w-full flex items-center gap-2 p-2 sm:p-2.5 rounded-lg text-xs text-right transition-all border",
                          aiAction === action.id ? "border-primary/50 bg-primary/5" : "border-border/40 hover:border-primary/30 hover:bg-muted/40",
                          aiLoading && aiAction !== action.id && "opacity-50")}>
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${action.color}18` }}>
                          {aiLoading && aiAction === action.id
                            ? <Loader2 className="h-3 w-3 animate-spin" style={{ color: action.color }} />
                            : <action.icon className="h-3 w-3" style={{ color: action.color }} />
                          }
                        </div>
                        <span className="font-medium">{action.label}</span>
                      </button>
                    ))}
                    {aiResult && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-primary">نتيجة الذكاء الاصطناعي</span>
                          <div className="flex gap-1">
                            <button onClick={() => navigator.clipboard.writeText(aiResult).then(() => toast({ title: "تم النسخ" }))} className="p-1 rounded hover:bg-muted"><Copy className="h-3 w-3 text-muted-foreground" /></button>
                            <button onClick={insertAiResult} className="p-1 rounded hover:bg-muted"><PenSquare className="h-3 w-3 text-primary" /></button>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-background p-2.5 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{aiResult}</div>
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1.5" onClick={insertAiResult}><PenSquare className="h-3 w-3" /> إدراج في المحرر</Button>
                      </div>
                    )}
                  </div>
                )}
                {panel === "versions" && (
                  <div className="p-2 sm:p-3">
                    {versions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-xs"><History className="h-8 w-8 mx-auto mb-2 opacity-30" />لا توجد إصدارات</div>
                    ) : (
                      <div className="space-y-2">
                        {versions.map(v => (
                          <div key={v.id} className="p-2.5 rounded-lg border border-border/40 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-primary">v{v.version_number}</span>
                              <button onClick={() => restoreVersion(v)} className="text-muted-foreground hover:text-foreground"><RefreshCw className="h-3 w-3" /></button>
                            </div>
                            <div className="text-muted-foreground">{v.note}</div>
                            <div className="text-muted-foreground mt-0.5">{new Date(v.created_at).toLocaleDateString("ar-SA")}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Signature Dialog */}
      <Dialog open={showSigDlg} onOpenChange={setShowSigDlg}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" />طلب توقيع رقمي</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>اسم الموقِّع *</Label><Input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="الاسم الكامل" /></div>
            <div><Label>البريد الإلكتروني</Label><Input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)} placeholder="example@email.com" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSigDlg(false)}>إلغاء</Button>
            <Button onClick={sendSig} disabled={!signerName} className="gap-2"><Send className="h-4 w-4" />إرسال</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ── AI Prompt Dialog ───────────────────────────────────────────────────────────
function AiPromptDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (d: any) => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedClauses, setSelectedClauses] = useState<string[]>([]);
  const { toast } = useToast();

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(api("/contracts/generate-from-prompt"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, selectedClauses }),
      });
      const d = await r.json();
      onCreated(d); onClose(); setPrompt(""); setSelectedClauses([]);
    } catch { toast({ title: "خطأ في التوليد", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />توليد عقد سعودي من الوصف</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">صِف العقد بكلماتك وسيصيغه الذكاء الاصطناعي بالصياغة القانونية السعودية الصحيحة.</p>
          <Textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="مثال: أريد عقد إيجار لمكتب في الرياض بين شركتين، الإيجار 60 ألف ريال سنوياً لمدة سنتين..."
            className="min-h-[100px] resize-none text-sm" />
          <SmartClausesPanel selected={selectedClauses} onChange={setSelectedClauses} />
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
  const [step, setStep] = useState(1); // 1=basic, 2=clauses
  const [form, setForm] = useState({ title: "", type: "general", parties: "", details: "", aiGenerate: false, notes: "", expiresAt: "", valueAmount: "", paymentMethod: "" });
  const [selectedClauses, setSelectedClauses] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<string | undefined>(defaultTemplateId);

  useEffect(() => {
    if (initialData) setForm(p => ({ ...p, title: initialData.title ?? "", type: initialData.type ?? "general", parties: (initialData.parties ?? []).join("، ") }));
  }, [initialData]);
  useEffect(() => { setTemplateId(defaultTemplateId); }, [defaultTemplateId]);
  useEffect(() => { if (!open) { setStep(1); setSelectedClauses([]); } }, [open]);

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch(api("/contracts"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] }); qc.invalidateQueries({ queryKey: ["contracts-stats"] });
      onClose(); toast({ title: form.aiGenerate ? "جاري توليد العقد بالذكاء الاصطناعي..." : "تم إنشاء العقد ✓" });
      setForm({ title: "", type: "general", parties: "", details: "", aiGenerate: false, notes: "", expiresAt: "", valueAmount: "", paymentMethod: "" });
    },
    onError: () => toast({ title: "خطأ في إنشاء العقد", variant: "destructive" }),
  });

  const submit = () => createMutation.mutate({
    ...form,
    parties: form.parties.split(/[،,]/).map((s: string) => s.trim()).filter(Boolean),
    content: initialData?.content ?? undefined,
    templateId, selectedClauses,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            إنشاء عقد جديد
            <div className="mr-auto flex items-center gap-1 text-xs text-muted-foreground">
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold", step === 1 ? "bg-primary text-primary-foreground" : "bg-muted")}>1</span>
              <div className="w-8 h-0.5 bg-border" />
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold", step === 2 ? "bg-primary text-primary-foreground" : "bg-muted")}>2</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div><Label>عنوان العقد *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: عقد إيجار مكتب الرياض" />
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
              <Input value={form.parties} onChange={e => setForm(p => ({ ...p, parties: e.target.value }))} placeholder="مثال: شركة الأمل، محمد العمري" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>القيمة المالية</Label>
                <Input value={form.valueAmount} onChange={e => setForm(p => ({ ...p, valueAmount: e.target.value }))} placeholder="50,000 ريال" />
              </div>
              <div><Label>طريقة الدفع</Label>
                <Input value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))} placeholder="تحويل بنكي" />
              </div>
            </div>
            <div><Label>تفاصيل إضافية</Label>
              <Textarea rows={3} value={form.details} onChange={e => setForm(p => ({ ...p, details: e.target.value }))} placeholder="الموضوع والشروط الجوهرية..." className="min-h-[60px] resize-none" />
            </div>
            {!initialData?.content && (
              <div className="flex items-center justify-between rounded-xl border border-primary/20 p-3 bg-primary/5">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />توليد بالذكاء الاصطناعي</div>
                  <div className="text-xs text-muted-foreground mt-0.5">يصيغ نص العقد بالأسلوب القانوني السعودي</div>
                </div>
                <Switch checked={form.aiGenerate} onCheckedChange={v => setForm(p => ({ ...p, aiGenerate: v }))} />
              </div>
            )}
          </div>
        ) : (
          <SmartClausesPanel selected={selectedClauses} onChange={setSelectedClauses} />
        )}

        <DialogFooter>
          {step === 2 && <Button variant="ghost" onClick={() => setStep(1)}>السابق</Button>}
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!form.title} className="gap-2">
              التالي: البنود الاختيارية <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (form.aiGenerate ? <Sparkles className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {form.aiGenerate ? "توليد العقد" : "إنشاء العقد"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
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
  const { data: stats } = useQuery<Stats>({ queryKey: ["contracts-stats"], queryFn: () => fetch(api("/contracts/stats")).then(r => r.json()) });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["contract-categories"], queryFn: () => fetch(api("/contract-categories")).then(r => r.json()) });
  const { data: templates = [], isLoading: templatesLoading } = useQuery<Template[]>({
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

  const applyTemplate = (t: Template) => {
    setCreateInitialData({ title: t.name, type: "general", content: t.content });
    setCreateTemplateId(t.id);
    setShowCreate(true);
    setActiveTab("list");
  };

  const statCards = [
    { label: "إجمالي العقود",   value: stats?.total ?? 0,           icon: FileText,      color: "#6366F1" },
    { label: "موقّعة",           value: stats?.signed ?? 0,          icon: BadgeCheck,    color: "#10B981" },
    { label: "قيد المراجعة",    value: stats?.review ?? 0,          icon: Eye,           color: "#3B82F6" },
    { label: "تنتهي قريباً",     value: stats?.expiringSoon ?? 0,    icon: AlertTriangle, color: "#F59E0B" },
    { label: "بانتظار التوقيع", value: stats?.pendingSignature ?? 0,icon: FileSignature, color: "#8B5CF6" },
    { label: "مُولَّدة AI",     value: stats?.aiGenerated ?? 0,     icon: Sparkles,      color: "#0891B2" },
    { label: "مسودات",          value: stats?.draft ?? 0,           icon: PenLine,       color: "#64748B" },
    { label: "القيمة الإجمالية",value: stats?.totalValue ?? 0,      icon: TrendingUp,    color: "#059669", currency: true },
  ];

  return (
    <div className="space-y-4 sm:space-y-5" dir="rtl">
      {/* ── Page Header ── */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            وحدة العقود الذكية
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 hidden sm:block">
            25 قالب سعودي احترافي · فحص الأنظمة · توقيع رقمي · إصدارات تلقائية
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowAiPrompt(true)} className="gap-1.5 text-xs sm:text-sm h-8 sm:h-9">
            <Bot className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">توليد من الوصف</span>
            <span className="sm:hidden">AI</span>
          </Button>
          <Button size="sm" onClick={() => { setCreateInitialData(null); setCreateTemplateId(undefined); setShowCreate(true); }} className="gap-1.5 text-xs sm:text-sm h-8 sm:h-9">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">عقد جديد</span>
            <span className="sm:hidden">جديد</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8 sm:h-9 overflow-x-auto">
          <TabsTrigger value="dashboard" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3">
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">لوحة</span>
            <span className="xs:hidden">الرئيسية</span>
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3">
            <BookOpen className="h-3.5 w-3.5" />
            <span>القوالب</span>
            <Badge variant="secondary" className="h-4 px-1 text-[9px] hidden sm:flex">25</Badge>
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3">
            <ListFilter className="h-3.5 w-3.5" />
            <span>عقودي</span>
            {contracts.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[9px]">{contracts.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Dashboard Tab ── */}
        <TabsContent value="dashboard" className="space-y-4 mt-3 sm:mt-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {statCards.map(s => (
              <Card key={s.label} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}18` }}>
                    <s.icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: s.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base sm:text-xl font-black leading-tight" style={{ color: s.color }}>
                      {s.currency ? (s.value as number).toLocaleString("ar-SA", { maximumFractionDigits: 0 }) : s.value}
                      {s.currency && <span className="text-[10px] font-normal me-0.5 text-muted-foreground">ر.س</span>}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Contracts */}
          <Card>
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />أحدث العقود
                <Button size="sm" variant="ghost" className="mr-auto h-6 sm:h-7 text-xs" onClick={() => setActiveTab("list")}>
                  عرض الكل <ChevronRight className="h-3 w-3 me-0.5" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : contracts.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm mb-3">لا توجد عقود — ابدأ بقالب سعودي</p>
                  <div className="flex gap-2 justify-center flex-wrap px-4">
                    <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setShowCreate(true)}><Plus className="h-3.5 w-3.5" />إنشاء عقد</Button>
                    <Button size="sm" variant="outline" className="gap-2 h-8 text-xs" onClick={() => setActiveTab("library")}><BookOpen className="h-3.5 w-3.5" />مكتبة القوالب</Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {contracts.slice(0, 6).map(c => {
                    const sc = STATUS_CFG[c.status] ?? STATUS_CFG.draft;
                    const typeName = CONTRACT_TYPES.find(t => t.value === c.type)?.label ?? c.type;
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => setEditingContract(c)}>
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", sc.color.replace("text-", "bg-"))} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs sm:text-sm truncate">{c.title}</div>
                          <div className="flex gap-1.5 mt-0.5 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                            <span>{typeName}</span>
                            {c.client_name && <span>• {c.client_name}</span>}
                            {c.value_amount && <span className="hidden sm:inline">• {c.value_amount}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {c.risk_score && <span className={cn("text-[11px] font-bold hidden sm:inline", riskColor(c.risk_score))}>{c.risk_score}/10</span>}
                          {c.compliance_score && <span className="text-[11px] font-bold text-emerald-400 hidden sm:inline">{c.compliance_score}٪</span>}
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", sc.color, sc.bg)}>{sc.label}</span>
                          <button onClick={e => { e.stopPropagation(); if (window.confirm("هل تريد حذف هذا العقد نهائياً؟")) deleteMutation.mutate(c.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-400/10 text-red-400 transition-all hidden sm:block">
                            <Trash2 className="h-3 w-3" />
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: "من قالب سعودي", icon: BookOpen,  color: "#7C3AED", action: () => setActiveTab("library") },
              { label: "توليد AI",       icon: Bot,       color: "#2563EB", action: () => setShowAiPrompt(true)  },
              { label: "عقد فارغ",       icon: PenSquare, color: "#059669", action: () => setShowCreate(true)   },
              { label: "فحص الأنظمة",   icon: BadgeCheck, color: "#DC2626", action: () => setActiveTab("list") },
            ].map(qa => (
              <button key={qa.label} onClick={qa.action}
                className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/40 transition-all text-right">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${qa.color}18` }}>
                  <qa.icon className="h-4 w-4" style={{ color: qa.color }} />
                </div>
                <span className="text-xs sm:text-sm font-medium">{qa.label}</span>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* ── Library Tab ── */}
        <TabsContent value="library" className="mt-3 sm:mt-4">
          {/* Mobile: horizontal category pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 lg:hidden scrollbar-hide">
            <button onClick={() => setSelectedCategory(null)}
              className={cn("flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                !selectedCategory ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40")}>
              <Hash className="h-3 w-3" />الكل
              <span className="opacity-70">({templates.length})</span>
            </button>
            {categories.map(cat => {
              const Icon = ICON_MAP[cat.icon] ?? FileText;
              return (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={cn("flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    selectedCategory === cat.id ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40")}>
                  <Icon className="h-3 w-3" style={{ color: selectedCategory === cat.id ? undefined : cat.color }} />
                  {cat.name}
                  <span className="opacity-70">({cat.template_count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-4 sm:gap-5">
            {/* Desktop: category sidebar */}
            <div className="hidden lg:block w-48 xl:w-52 flex-shrink-0 space-y-1">
              <button onClick={() => setSelectedCategory(null)}
                className={cn("w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  !selectedCategory ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
                <Hash className="h-3.5 w-3.5" />جميع القوالب
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

            {/* Templates grid */}
            <div className="flex-1 min-w-0">
              {templatesLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : templates.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">لا توجد قوالب في هذا القسم</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {templates.map(t => {
                    const Icon = ICON_MAP[t.category_icon] ?? FileText;
                    return (
                      <Card key={t.id} className="group hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer" onClick={() => applyTemplate(t)}>
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-start gap-2.5 sm:gap-3 mb-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: `${t.category_color}18` }}>
                              <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: t.category_color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-xs sm:text-sm truncate">{t.name}</h3>
                              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{t.category_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                              <Star className="h-3 w-3" />{t.usage_count} مرة
                            </div>
                            <Button size="sm" variant="outline" className="h-6 sm:h-7 text-[11px] sm:text-xs gap-1 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
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
        <TabsContent value="list" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="بحث في العقود..." className="pe-9 h-8 text-xs sm:text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 sm:w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(STATUS_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 sm:w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {CONTRACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-14 w-14 mx-auto mb-4 opacity-20" />
              <p className="text-base font-semibold mb-1">لا توجد عقود</p>
              <p className="text-sm mb-4">أنشئ عقدك الأول أو اختر من مكتبة القوالب السعودية</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={() => setShowCreate(true)} className="gap-2 text-sm"><Plus className="h-4 w-4" />عقد جديد</Button>
                <Button variant="outline" onClick={() => setActiveTab("library")} className="gap-2 text-sm"><BookOpen className="h-4 w-4" />القوالب السعودية</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {contracts.map(c => {
                const sc = STATUS_CFG[c.status] ?? STATUS_CFG.draft;
                const typeName = CONTRACT_TYPES.find(t => t.value === c.type)?.label ?? c.type;
                return (
                  <Card key={c.id} className="group hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer" onClick={() => setEditingContract(c)}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-xs sm:text-sm truncate">{c.title}</h3>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px] h-4 px-1">{typeName}</Badge>
                            {c.ai_generated && <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5 text-primary border-primary/30"><Sparkles className="h-2.5 w-2.5" /> AI</Badge>}
                            {c.version_number > 1 && <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">v{c.version_number}</Badge>}
                          </div>
                        </div>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 flex-shrink-0", sc.color, sc.bg)}>
                          <sc.icon className="h-2.5 w-2.5" />{sc.label}
                        </span>
                      </div>
                      <div className="space-y-1 text-[10px] sm:text-xs text-muted-foreground">
                        {c.client_name && <div className="flex items-center gap-1"><Users className="h-2.5 w-2.5" />{c.client_name}</div>}
                        {c.value_amount && <div className="flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" />{c.value_amount}</div>}
                        <div className="flex items-center gap-3">
                          {c.risk_score && <span>خطر: <span className={cn("font-bold", riskColor(c.risk_score))}>{c.risk_score}/10</span></span>}
                          {c.compliance_score && <span>توافق: <span className="text-emerald-400 font-bold">{c.compliance_score}٪</span></span>}
                        </div>
                        {c.expires_at && <div className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />ينتهي: {new Date(c.expires_at).toLocaleDateString("ar-SA")}</div>}
                      </div>
                      <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 flex-1" onClick={e => { e.stopPropagation(); setEditingContract(c); }}>
                          <PenSquare className="h-3 w-3" /> فتح المحرر
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2"
                          onClick={e => { e.stopPropagation(); if (window.confirm("هل تريد حذف هذا العقد نهائياً؟")) deleteMutation.mutate(c.id); }}>
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
      <ContractEditorDialog contract={editingContract} onClose={() => setEditingContract(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["contracts"] })} />
      <AiPromptDialog open={showAiPrompt} onClose={() => setShowAiPrompt(false)} onCreated={d => { setCreateInitialData(d); setShowCreate(true); }} />
      <CreateContractDialog open={showCreate} onClose={() => { setShowCreate(false); setCreateInitialData(null); setCreateTemplateId(undefined); }} initialData={createInitialData} defaultTemplateId={createTemplateId} />
    </div>
  );
}
