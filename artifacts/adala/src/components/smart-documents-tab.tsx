import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Upload, FileText, Trash2, Sparkles, Loader2, Brain,
  Calendar, DollarSign, Users, Hash, Tag, AlertTriangle,
  Cloud, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  FolderOpen, Link2, RefreshCw, FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Props {
  entityType: "case" | "client" | "contract";
  entityId: string;
}

interface SmartDoc {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  cloud_provider: string;
  ai_analyzed: boolean;
  ai_summary?: string;
  ai_parties: string[];
  ai_dates: string[];
  ai_amounts: string[];
  ai_document_type?: string;
  ai_keywords: string[];
  ai_deed_numbers: string[];
  ai_risk_notes?: string;
  uploaded_by?: string;
  notes?: string;
  created_at: string;
}

interface CloudConn {
  id: string;
  provider: string;
  display_name?: string;
  account_email?: string;
  account_name?: string;
  is_active: boolean;
}

/* ── icon helpers ── */
function FileIcon({ type }: { type: string }) {
  const cls = "h-8 w-8";
  if (type === "application/pdf")
    return <div className={cn(cls, "text-red-500 flex items-center justify-center font-bold text-[10px] bg-red-50 rounded-lg border border-red-200")}>PDF</div>;
  if (type.includes("word") || type.includes("document"))
    return <div className={cn(cls, "text-blue-500 flex items-center justify-center font-bold text-[10px] bg-blue-50 rounded-lg border border-blue-200")}>DOC</div>;
  if (type.includes("sheet") || type.includes("excel"))
    return <div className={cn(cls, "text-emerald-500 flex items-center justify-center font-bold text-[10px] bg-emerald-50 rounded-lg border border-emerald-200")}>XLS</div>;
  if (type.startsWith("image/"))
    return <div className={cn(cls, "text-violet-500 flex items-center justify-center font-bold text-[10px] bg-violet-50 rounded-lg border border-violet-200")}>IMG</div>;
  return <FileText className={cn(cls, "text-muted-foreground")} />;
}

function fmtSize(b: number) {
  if (!b) return "—";
  return b < 1024 ? `${b} B`
    : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB`
    : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

/* ════════════════════════════════════════════
   CLOUD PROVIDER BAR
   ════════════════════════════════════════════ */
const PROVIDERS = [
  { key: "google_drive", label: "Google Drive",  color: "#4285F4", emoji: "🟦" },
  { key: "onedrive",     label: "OneDrive",       color: "#0078D4", emoji: "🟦" },
  { key: "sharepoint",   label: "SharePoint",     color: "#038387", emoji: "🟩" },
  { key: "dropbox",      label: "Dropbox",        color: "#0061FF", emoji: "🟦" },
];

function CloudBar({ connections, onConnect, onDisconnect }: {
  connections: CloudConn[];
  onConnect: (provider: string) => void;
  onDisconnect: (id: string) => void;
}) {
  const active = (p: string) => connections.find(c => c.provider === p && c.is_active);
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-xl border border-border/40">
      <span className="text-xs text-muted-foreground flex items-center gap-1 w-full sm:w-auto">
        <Cloud className="h-3.5 w-3.5" />التخزين السحابي:
      </span>
      {PROVIDERS.map(p => {
        const conn = active(p.key);
        return (
          <div key={p.key} className="flex items-center gap-1.5">
            {conn ? (
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors text-[11px]"
                onClick={() => onDisconnect(conn.id)}
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {p.label}
                {conn.account_email && <span className="opacity-60 text-[10px]">({conn.account_email})</span>}
                <XCircle className="h-3 w-3 opacity-50" />
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] gap-1 px-2 opacity-60 hover:opacity-100"
                onClick={() => onConnect(p.key)}
              >
                <Link2 className="h-3 w-3" />ربط {p.label}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════
   AI ANALYSIS PANEL (per document)
   ════════════════════════════════════════════ */
function AiPanel({ doc, onReanalyze, loading }: {
  doc: SmartDoc;
  onReanalyze: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!doc.ai_analyzed) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
        onClick={onReanalyze}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
        تحليل ذكي
      </Button>
    );
  }

  return (
    <div className="mt-2 border border-violet-200/60 rounded-xl bg-violet-50/40 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50/60 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          نتائج التحليل الذكي
          {doc.ai_document_type && (
            <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px] px-1.5 py-0">
              {doc.ai_document_type}
            </Badge>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className="opacity-50 hover:opacity-100 p-0.5"
            onClick={e => { e.stopPropagation(); onReanalyze(); }}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </button>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5 text-xs">
          {doc.ai_summary && (
            <div>
              <p className="font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <FileSearch className="h-3 w-3" />الملخص
              </p>
              <p className="text-foreground leading-relaxed bg-white/60 rounded-lg p-2 border border-border/30">
                {doc.ai_summary}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {doc.ai_parties?.length > 0 && (
              <AIRow icon={<Users className="h-3 w-3 text-blue-500" />} label="الأطراف" items={doc.ai_parties} />
            )}
            {doc.ai_dates?.length > 0 && (
              <AIRow icon={<Calendar className="h-3 w-3 text-amber-500" />} label="التواريخ" items={doc.ai_dates} />
            )}
            {doc.ai_amounts?.length > 0 && (
              <AIRow icon={<DollarSign className="h-3 w-3 text-emerald-500" />} label="المبالغ" items={doc.ai_amounts} />
            )}
            {doc.ai_deed_numbers?.length > 0 && (
              <AIRow icon={<Hash className="h-3 w-3 text-violet-500" />} label="أرقام الصكوك" items={doc.ai_deed_numbers} />
            )}
            {doc.ai_keywords?.length > 0 && (
              <AIRow icon={<Tag className="h-3 w-3 text-slate-500" />} label="الكلمات المفتاحية" items={doc.ai_keywords} tags />
            )}
          </div>

          {doc.ai_risk_notes && doc.ai_risk_notes !== "null" && (
            <div className="flex items-start gap-1.5 bg-amber-50 rounded-lg p-2 border border-amber-200/60">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-amber-800 text-[11px] leading-relaxed">{doc.ai_risk_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AIRow({ icon, label, items, tags }: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  tags?: boolean;
}) {
  return (
    <div>
      <p className="font-semibold text-muted-foreground mb-1 flex items-center gap-1">{icon}{label}</p>
      {tags ? (
        <div className="flex flex-wrap gap-1">
          {items.map((item, i) => (
            <span key={i} className="bg-white/70 border border-border/40 rounded-md px-1.5 py-0.5 text-[10px]">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-muted-foreground/50 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   DOCUMENT ROW
   ════════════════════════════════════════════ */
function DocRow({ doc, onDelete, onAnalyze, analyzing }: {
  doc: SmartDoc;
  onDelete: (id: string) => void;
  onAnalyze: (id: string, fileData?: string, fileType?: string) => void;
  analyzing: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const triggerReanalyze = () => {
    if (!doc.ai_analyzed) {
      inputRef.current?.click();
    } else {
      onAnalyze(doc.id);
    }
  };

  const handleReanalyzeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      onAnalyze(doc.id, reader.result as string, f.type);
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="border rounded-xl p-3 bg-background hover:border-primary/20 transition-colors space-y-2">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <FileIcon type={doc.file_type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium truncate leading-snug">{doc.file_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtSize(doc.file_size)} · {fmtDate(doc.created_at)}
                {doc.uploaded_by && ` · ${doc.uploaded_by}`}
              </p>
            </div>
            <button
              onClick={() => onDelete(doc.id)}
              className="shrink-0 p-1 text-muted-foreground/50 hover:text-destructive transition-colors rounded"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* AI badge or analyze button */}
          <div className="mt-1.5">
            <AiPanel doc={doc} onReanalyze={triggerReanalyze} loading={analyzing} />
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleReanalyzeFile}
      />
    </div>
  );
}

/* ════════════════════════════════════════════
   UPLOAD DIALOG
   ════════════════════════════════════════════ */
function UploadDialog({ open, entityType, entityId, onClose, onSaved }: {
  open: boolean;
  entityType: string;
  entityId: string;
  onClose: () => void;
  onSaved: (doc: SmartDoc) => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile]               = useState<File | null>(null);
  const [dragOver, setDragOver]       = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [notes, setNotes]             = useState("");
  const [uploading, setUploading]     = useState(false);
  const [progress, setProgress]       = useState(0);

  useEffect(() => { if (open) { setFile(null); setProgress(0); setNotes(""); } }, [open]);

  const pick = (f: File) => {
    if (f.size > 25 * 1024 * 1024) {
      toast({ variant: "destructive", title: "حجم الملف يتجاوز 25 MB" });
      return;
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(20);
    try {
      const reader = new FileReader();
      const fileData: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      setProgress(50);
      if (autoAnalyze) setProgress(60);

      const uploaderName = [user?.firstName, user?.lastName].filter(Boolean).join(" ")
        || user?.username || "";

      const r = await fetch(`${BASE}/api/smart-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName:    file.name,
          fileType:    file.type || "application/octet-stream",
          fileData:    autoAnalyze ? fileData : undefined,
          fileSize:    file.size,
          caseId:      entityType === "case"     ? entityId : undefined,
          clientId:    entityType === "client"   ? entityId : undefined,
          contractId:  entityType === "contract" ? entityId : undefined,
          uploadedBy:  uploaderName,
          notes:       notes || undefined,
          autoAnalyze,
        }),
      });
      setProgress(95);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "خطأ في الرفع");
      }
      const doc = await r.json();
      setProgress(100);
      const msg = doc.ai_analyzed
        ? "✅ رُفع الملف وتم تحليله بالذكاء الاصطناعي"
        : "✅ تم رفع الملف بنجاح";
      toast({ title: msg });
      onSaved(doc);
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message });
    }
    setUploading(false);
  };

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  return (
    <Dialog open={open} onOpenChange={v => !v && !uploading && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-violet-500" />رفع مستند ذكي
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Drop zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
              dragOver
                ? "border-violet-400 bg-violet-50"
                : file
                ? "border-emerald-400 bg-emerald-50/50"
                : "border-border hover:border-violet-300 hover:bg-muted/30",
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]); }}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
              onChange={e => e.target.files?.[0] && pick(e.target.files[0])}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileIcon type={file.type} />
                <p className="text-sm font-semibold">{file.name}</p>
                <p className="text-xs text-muted-foreground">{fmtSize(file.size)}</p>
                <button
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                >تغيير الملف</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8 opacity-25" />
                <p className="text-sm font-medium">اسحب الملف هنا أو انقر للاختيار</p>
                <p className="text-xs opacity-60">PDF · Word · Excel · صور — حتى 25 MB</p>
              </div>
            )}
          </div>

          {/* Auto-analyze toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-violet-50/60 border border-violet-200/50">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-500" />
              <div>
                <Label className="text-sm font-medium text-violet-800">تحليل ذكي تلقائي</Label>
                <p className="text-[11px] text-violet-600/70">استخراج الأطراف والتواريخ والمبالغ</p>
              </div>
            </div>
            <Switch
              checked={autoAnalyze}
              onCheckedChange={setAutoAnalyze}
              className="data-[state=checked]:bg-violet-600"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ملاحظات (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="أضف ملاحظة على هذا المستند…"
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Progress */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress < 60 ? "جاري الرفع…" : autoAnalyze ? "جاري التحليل الذكي…" : "اكتمل"}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>إلغاء</Button>
          <Button
            onClick={upload}
            disabled={!file || uploading}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {uploading
              ? <><Loader2 className="h-4 w-4 animate-spin" />جاري…</>
              : <><Upload className="h-4 w-4" />رفع{autoAnalyze ? " وتحليل" : ""}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════
   CONNECT CLOUD DIALOG
   ════════════════════════════════════════════ */
function ConnectCloudDialog({ open, provider, onClose, onSaved }: {
  open: boolean;
  provider: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail]   = useState("");
  const [saving, setSaving] = useState(false);
  const provLabel = PROVIDERS.find(p => p.key === provider)?.label ?? provider;

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/smart-documents/cloud-connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, accountEmail: email, displayName: provLabel }),
      });
      if (!r.ok) throw new Error("خطأ في الحفظ");
      toast({ title: `✅ تم ربط ${provLabel}` });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-500" />ربط {provLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            ⚡ المرحلة الأولى: يتم حفظ بيانات الاتصال. تكامل OAuth الكامل قيد التطوير.
          </div>
          <div className="space-y-1.5">
            <Label>البريد الإلكتروني للحساب</Label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder={`email@example.com`}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={save} disabled={!email || saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            ربط
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════ */
export default function SmartDocumentsTab({ entityType, entityId }: Props) {
  const { toast }  = useToast();
  const qc         = useQueryClient();
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [connectProvider, setConnectProvider] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const QK_DOCS  = ["smart-docs", entityType, entityId];
  const QK_CLOUD = ["cloud-conns"];

  const { data: docs = [], isLoading } = useQuery<SmartDoc[]>({
    queryKey: QK_DOCS,
    queryFn: async () => {
      const r = await fetch(
        `${BASE}/api/smart-documents?entityType=${entityType}&entityId=${entityId}`,
      );
      if (!r.ok) throw new Error("خطأ في تحميل المستندات");
      return r.json();
    },
    staleTime: 30_000,
  });

  const { data: connections = [] } = useQuery<CloudConn[]>({
    queryKey: QK_CLOUD,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/smart-documents/cloud-connections`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });

  const deleteDoc = async (id: string) => {
    try {
      await fetch(`${BASE}/api/smart-documents/${id}`, { method: "DELETE" });
      qc.setQueryData<SmartDoc[]>(QK_DOCS, prev => (prev ?? []).filter(d => d.id !== id));
      toast({ title: "تم حذف المستند" });
    } catch {
      toast({ variant: "destructive", title: "خطأ في الحذف" });
    }
  };

  const analyzeDoc = async (id: string, fileData?: string, fileType?: string) => {
    setAnalyzingId(id);
    try {
      const r = await fetch(`${BASE}/api/smart-documents/${id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData, fileType }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "خطأ في التحليل");
      }
      const { analysis } = await r.json();
      qc.setQueryData<SmartDoc[]>(QK_DOCS, prev =>
        (prev ?? []).map(d =>
          d.id === id
            ? {
                ...d,
                ai_analyzed:     true,
                ai_summary:      analysis.summary,
                ai_parties:      analysis.parties      ?? [],
                ai_dates:        analysis.dates        ?? [],
                ai_amounts:      analysis.amounts      ?? [],
                ai_document_type: analysis.document_type,
                ai_keywords:     analysis.keywords     ?? [],
                ai_deed_numbers: analysis.deed_numbers ?? [],
                ai_risk_notes:   analysis.risk_notes,
              }
            : d,
        ),
      );
      toast({ title: "✅ اكتمل التحليل الذكي" });
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message });
    }
    setAnalyzingId(null);
  };

  const disconnectCloud = async (id: string) => {
    try {
      await fetch(`${BASE}/api/smart-documents/cloud-connections/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: QK_CLOUD });
      toast({ title: "تم إلغاء الربط" });
    } catch {
      toast({ variant: "destructive", title: "خطأ في إلغاء الربط" });
    }
  };

  const analyzedCount = docs.filter(d => d.ai_analyzed).length;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-violet-500" />
              المستندات الذكية
              <Badge variant="secondary" className="text-[11px]">{docs.length}</Badge>
              {analyzedCount > 0 && (
                <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[11px]">
                  <Sparkles className="h-3 w-3 me-0.5" />{analyzedCount} محلَّل
                </Badge>
              )}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-3 w-3" />رفع مستند
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {/* Cloud bar */}
          <CloudBar
            connections={connections}
            onConnect={p => setConnectProvider(p)}
            onDisconnect={disconnectCloud}
          />

          {/* Document list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-15" />
              <p className="text-sm">لا توجد مستندات مرفوعة بعد</p>
              <p className="text-xs mt-1 opacity-60">
                ارفع ملفات PDF أو Word لتحليلها ذكياً
              </p>
              <Button
                size="sm"
                className="mt-3 gap-1 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => setUploadOpen(true)}
              >
                <Upload className="h-3.5 w-3.5" />رفع أول مستند
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  onDelete={deleteDoc}
                  onAnalyze={analyzeDoc}
                  analyzing={analyzingId === doc.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <UploadDialog
        open={uploadOpen}
        entityType={entityType}
        entityId={entityId}
        onClose={() => setUploadOpen(false)}
        onSaved={doc => {
          qc.setQueryData<SmartDoc[]>(QK_DOCS, prev => [doc, ...(prev ?? [])]);
          setUploadOpen(false);
        }}
      />

      <ConnectCloudDialog
        open={!!connectProvider}
        provider={connectProvider ?? ""}
        onClose={() => setConnectProvider(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: QK_CLOUD })}
      />
    </div>
  );
}
