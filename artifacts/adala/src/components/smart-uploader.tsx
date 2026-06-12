/**
 * SmartUploader — رافع الملفات الذكي
 * Mobile-First | Drag & Drop | Camera | AI Analysis | Image Compression
 */
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Camera, X, FileText, FileImage, File,
  CheckCircle2, AlertCircle, Loader2, Sparkles,
  Archive, Sheet, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── Constants ─────────────────────────────────────────────────────────── */
const ALLOWED: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-excel": "XLS",
  "image/jpeg": "JPG", "image/jpg": "JPG",
  "image/png": "PNG", "image/webp": "WEBP",
  "image/heic": "HEIC", "image/heif": "HEIF",
  "application/zip": "ZIP",
};
const MAX_BYTES      = 10 * 1024 * 1024;  // 10 MB hard limit
const IMG_TARGET     = 350 * 1024;        // 350 KB target after compression
const IMG_MAX_DIM    = 1400;              // max width/height in pixels
const IMG_QUALITY_0  = 0.78;             // starting JPEG quality
const IMG_QUALITY_MIN = 0.28;            // floor — never go below this
const IMG_QUALITY_STEP = 0.08;           // step down per iteration

/* ── Types ──────────────────────────────────────────────────────────────── */
type UpStatus = "queued"|"compressing"|"uploading"|"registering"|"analyzing"|"done"|"error";
interface FItem {
  id: string;
  original: File;
  processed?: File;
  previewUrl?: string;
  status: UpStatus;
  progress: number;
  savedBytes?: number;   // bytes saved by compression
  error?: string;
  record?: any;
  analysis?: any;
}
export interface SmartUploaderProps {
  caseId?: string | null;
  clientId?: string | null;
  onSuccess?: (files: any[]) => void;
  compact?: boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(0)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}
function getCategory(m: string) {
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.includes("word")) return "word";
  if (m.includes("sheet")||m.includes("excel")) return "excel";
  if (m.includes("zip")) return "archive";
  return "document";
}
function FileIcon({ mime }: { mime: string }) {
  if (mime === "application/pdf")    return <FileText className="h-4 w-4 text-red-400" />;
  if (mime.startsWith("image/"))     return <FileImage className="h-4 w-4 text-blue-400" />;
  if (mime.includes("sheet")||mime.includes("excel")) return <Sheet className="h-4 w-4 text-green-400" />;
  if (mime.includes("zip"))          return <Archive className="h-4 w-4 text-amber-400" />;
  return <File className="h-4 w-4 text-purple-400" />;
}

/**
 * Aggressive image compression with iterative quality loop.
 * Always converts to JPEG (best compression ratio).
 * Tries to reach IMG_TARGET bytes; stops at IMG_QUALITY_MIN floor.
 * Returns { file, savedBytes }.
 */
async function compressImage(file: File): Promise<{ file: File; savedBytes: number }> {
  if (!file.type.startsWith("image/")) return { file, savedBytes: 0 };

  return new Promise(resolve => {
    const img = document.createElement("img") as HTMLImageElement;
    const url = URL.createObjectURL(file);

    img.onerror = () => { URL.revokeObjectURL(url); resolve({ file, savedBytes: 0 }); };

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");

      /* Resize to max dimension */
      let { width, height } = img;
      if (width > IMG_MAX_DIM || height > IMG_MAX_DIM) {
        const r = Math.min(IMG_MAX_DIM / width, IMG_MAX_DIM / height);
        width  = Math.round(width  * r);
        height = Math.round(height * r);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);

      const baseName = file.name.replace(/\.[^.]+$/, ".jpg");

      /* Iterative quality reduction until target reached */
      let quality = IMG_QUALITY_0;

      const tryQuality = () => {
        canvas.toBlob(blob => {
          if (!blob) { resolve({ file, savedBytes: 0 }); return; }

          if (blob.size <= IMG_TARGET || quality <= IMG_QUALITY_MIN) {
            /* Accept this blob */
            const out = Object.assign(
              new Blob([blob], { type: "image/jpeg" }),
              { name: baseName, lastModified: Date.now() }
            ) as File;
            const savedBytes = Math.max(0, file.size - blob.size);
            resolve({ file: out, savedBytes });
          } else {
            /* Try lower quality */
            quality = Math.max(IMG_QUALITY_MIN, quality - IMG_QUALITY_STEP);
            tryQuality();
          }
        }, "image/jpeg", quality);
      };

      tryQuality();
    };

    img.src = url;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function xhrUpload(url: string, file: File, onPct: (n:number)=>void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = e => { if (e.lengthComputable) onPct(Math.round(e.loaded/e.total*88)); };
    xhr.onload  = () => xhr.status < 300 ? (onPct(90), resolve()) : reject(new Error(`HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error("فشل الاتصال بالخادم"));
    xhr.send(file);
  });
}

const STATUS_LABEL: Record<UpStatus, string> = {
  queued: "في الانتظار", compressing: "ضغط الصورة...",
  uploading: "جاري الرفع...", registering: "جاري الحفظ...",
  analyzing: "تحليل ذكي...", done: "تم", error: "خطأ",
};

/* ── Component ──────────────────────────────────────────────────────────── */
export function SmartUploader({ caseId, clientId, onSuccess, compact }: SmartUploaderProps) {
  const { toast } = useToast();
  const [items, setItems]       = useState<FItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy]         = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const camRef    = useRef<HTMLInputElement>(null);

  const upd = useCallback((id: string, p: Partial<FItem>) =>
    setItems(prev => prev.map(i => i.id === id ? {...i,...p} : i)), []);

  const addFiles = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list);
    const valid: FItem[] = [];
    for (const f of arr) {
      if (!ALLOWED[f.type]) {
        toast({ title: `❌ نوع الملف غير مدعوم`, description: f.name, variant: "destructive" }); continue;
      }
      if (f.size > MAX_BYTES) {
        toast({ title: `❌ الملف أكبر من ١٠ MB`, description: f.name, variant: "destructive" }); continue;
      }
      valid.push({
        id: crypto.randomUUID(), original: f,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        status: "queued", progress: 0,
      });
    }
    if (valid.length) setItems(prev => [...prev, ...valid]);
  }, [toast]);

  const remove = (id: string) => setItems(prev => {
    const it = prev.find(i => i.id === id);
    if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
    return prev.filter(i => i.id !== id);
  });

  useEffect(() => () => items.forEach(i => i.previewUrl && URL.revokeObjectURL(i.previewUrl)), []);

  const uploadAll = async () => {
    if (busy) return;
    const pending = items.filter(i => i.status === "queued");
    if (!pending.length) return;
    setBusy(true);
    const done: any[] = [];

    for (const item of pending) {
      try {
        /* 1 ── Compress ALL images automatically */
        let f = item.original;
        if (f.type.startsWith("image/")) {
          upd(item.id, { status: "compressing", progress: 5 });
          const { file: compressed, savedBytes } = await compressImage(f);
          f = compressed;
          upd(item.id, { processed: f, savedBytes });
        }
        upd(item.id, { status: "uploading", progress: 10 });

        /* 2 ── Presigned URL */
        const urlR = await fetch(`${BASE}/api/storage/uploads/request-url`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: f.name, size: f.size, contentType: f.type }),
        });
        if (!urlR.ok) throw new Error("فشل الحصول على رابط الرفع");
        const { uploadURL, objectPath } = await urlR.json();

        /* 3 ── Upload */
        await xhrUpload(uploadURL, f, pct => upd(item.id, { progress: 10 + Math.round(pct * 0.72) }));
        upd(item.id, { status: "registering", progress: 82 });

        /* 4 ── Register in DB */
        const regR = await fetch(`${BASE}/api/storage/files`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalName: item.original.name,
            mimeType: f.type, fileSize: f.size,
            storageKey: objectPath,
            fileUrl: `/api/storage/objects${objectPath}`,
            category: getCategory(f.type),
            caseId: caseId ?? null,
            clientId: clientId ?? null,
          }),
        });
        if (!regR.ok) {
          const e = await regR.json();
          if (e.duplicate) { upd(item.id, { status: "done", progress: 100, record: e.existing, error: "مرفوع مسبقاً" }); continue; }
          throw new Error(e.error ?? "فشل الحفظ");
        }
        const record = await regR.json();
        upd(item.id, { record, progress: 88 });

        /* 5 ── AI Analyze (images + PDF) */
        const canAnalyze = f.type.startsWith("image/") || f.type === "application/pdf";
        if (canAnalyze) {
          upd(item.id, { status: "analyzing", progress: 90 });
          try {
            const b64 = await fileToBase64(f);
            const aR  = await fetch(`${BASE}/api/storage/analyze`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ base64: b64, mimeType: f.type }),
            });
            const ai = await aR.json();
            upd(item.id, { analysis: ai.ok ? ai : null, status: "done", progress: 100 });
          } catch { upd(item.id, { status: "done", progress: 100 }); }
        } else {
          upd(item.id, { status: "done", progress: 100 });
        }
        done.push(record);
      } catch (err: any) {
        upd(item.id, { status: "error", error: err.message });
      }
    }

    setBusy(false);
    if (done.length) {
      toast({ title: `✅ تم رفع ${done.length} ${done.length === 1 ? "ملف" : "ملفات"} بنجاح` });
      onSuccess?.(done);
    }
  };

  const queuedCount  = items.filter(i => i.status === "queued").length;
  const allDone      = items.length > 0 && items.every(i => i.status === "done" || i.status === "error");
  const totalSaved   = items.reduce((s, i) => s + (i.savedBytes ?? 0), 0);

  return (
    <div className="space-y-3" dir="rtl">

      {/* ── Drop Zone ── */}
      {items.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer select-none",
            dragging ? "border-[#C9A84C]/70 bg-[#C9A84C]/5 scale-[1.01]"
                     : "border-border/50 hover:border-[#C9A84C]/40 hover:bg-muted/20"
          )}
        >
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)" }}>
              <Upload className="h-6 w-6" style={{ color: "#C9A84C" }} />
            </div>
            <div>
              <p className="font-semibold">اسحب ملفاتك هنا</p>
              <p className="text-sm text-muted-foreground mt-0.5">أو اضغط لاختيار من الجهاز</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {["PDF","DOCX","XLSX","JPG","PNG","ZIP"].map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">{t}</span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/50">الحد الأقصى: ١٠ ميغابايت للملف</p>
          </div>
        </div>
      )}

      {/* ── File Items ── */}
      {items.length > 0 && (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {items.map(item => (
            <div key={item.id} className={cn(
              "rounded-xl border p-3 transition-all",
              item.status === "done"  ? "border-emerald-500/25 bg-emerald-500/4" :
              item.status === "error" ? "border-red-500/25 bg-red-500/5" :
              "border-border/40 bg-muted/15"
            )}>
              <div className="flex items-center gap-3">
                {/* Thumb / icon */}
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted/60 flex items-center justify-center shrink-0 border border-border/30">
                  {item.previewUrl
                    ? <img src={item.previewUrl} className="w-full h-full object-cover" alt="" />
                    : <FileIcon mime={item.original.type} />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{item.original.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Size: show original → compressed */}
                      {item.savedBytes && item.savedBytes > 0 ? (
                        <span className="text-[10px] flex items-center gap-0.5">
                          <span className="line-through text-muted-foreground/50">{fmtBytes(item.original.size)}</span>
                          <span className="text-emerald-400 font-semibold">
                            {fmtBytes(item.original.size - item.savedBytes)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">{fmtBytes(item.original.size)}</span>
                      )}
                      {item.status === "queued" && (
                        <button onClick={() => remove(item.id)}
                          className="p-0.5 text-muted-foreground hover:text-red-400 transition-colors rounded">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Compression savings badge */}
                  {item.savedBytes && item.savedBytes > 5000 && (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background:"rgba(16,185,129,0.12)", color:"#34d399", border:"1px solid rgba(16,185,129,0.25)" }}>
                        ✂️ وفّرنا {fmtBytes(item.savedBytes)} ({Math.round(item.savedBytes/item.original.size*100)}%)
                      </span>
                    </div>
                  )}

                  {item.status !== "queued" && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={cn("flex items-center gap-1 font-medium",
                          item.status === "done"  ? "text-emerald-400" :
                          item.status === "error" ? "text-red-400" : "text-amber-400"
                        )}>
                          {item.status === "done"  ? <CheckCircle2 className="h-3 w-3" /> :
                           item.status === "error" ? <AlertCircle  className="h-3 w-3" /> :
                           <Loader2 className="h-3 w-3 animate-spin" />}
                          {item.error && item.status === "done" ? item.error : STATUS_LABEL[item.status]}
                        </span>
                        {item.status !== "done" && item.status !== "error" && (
                          <span className="text-muted-foreground tabular-nums">{item.progress}%</span>
                        )}
                      </div>
                      {item.status !== "done" && item.status !== "error" && (
                        <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                          <div className="h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%`, background: "linear-gradient(90deg,#C9A84C,#E0C060)" }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── AI Analysis Card ── */}
              {item.status === "done" && item.analysis?.ok && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">نتائج التحليل الذكي</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {item.analysis.docType && (
                      <Chip label="نوع المستند" value={item.analysis.docType} />
                    )}
                    {item.analysis.caseType && item.analysis.caseType !== "غير محدد" && (
                      <Chip label="نوع القضية" value={item.analysis.caseType} />
                    )}
                    {item.analysis.parties?.filter(Boolean).length > 0 && (
                      <Chip label="الأطراف" value={item.analysis.parties.slice(0,3).join(" ، ")} wide />
                    )}
                    {item.analysis.dates?.filter(Boolean).length > 0 && (
                      <Chip label="التاريخ" value={item.analysis.dates[0]} />
                    )}
                    {item.analysis.court && item.analysis.court !== "غير محدد" && (
                      <Chip label="الجهة" value={item.analysis.court} />
                    )}
                    {item.analysis.summary && (
                      <Chip label="الملخص" value={item.analysis.summary} wide />
                    )}
                    {item.analysis.tags?.filter(Boolean).length > 0 && (
                      <div className="col-span-2 flex flex-wrap gap-1 mt-0.5">
                        {item.analysis.tags.slice(0,6).map((t: string) => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                            style={{ borderColor:"rgba(201,168,76,0.3)", background:"rgba(201,168,76,0.08)", color:"#C9A84C" }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" size="sm" disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="gap-2 flex-1 text-xs h-9">
          {items.length === 0
            ? <><Upload className="h-3.5 w-3.5" /> اختر ملفات</>
            : <><Plus  className="h-3.5 w-3.5" /> إضافة المزيد</>}
        </Button>

        <Button variant="outline" size="sm" disabled={busy}
          onClick={() => camRef.current?.click()}
          className="gap-2 flex-1 sm:flex-none text-xs h-9">
          <Camera className="h-3.5 w-3.5" />
          تصوير مستند
        </Button>

        {queuedCount > 0 && (
          <Button size="sm" onClick={uploadAll} disabled={busy}
            className="gap-2 font-bold h-9 px-5 sm:px-6"
            style={{ background:"linear-gradient(135deg,#C9A84C,#D4A843)", color:"#0D1626" }}>
            {busy
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري الرفع...</>
              : <><Upload className="h-3.5 w-3.5" /> ارفع الآن ({queuedCount})</>}
          </Button>
        )}
      </div>

      {allDone && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-center space-y-1">
          <p className="text-sm text-emerald-400 font-semibold">
            ✅ تم بنجاح — {items.filter(i => i.status === "done").length} ملف مرفوع
          </p>
          {totalSaved > 10000 && (
            <p className="text-xs text-emerald-400/80">
              ✂️ وفّرنا <strong>{fmtBytes(totalSaved)}</strong> من مساحة التخزين تلقائياً
            </p>
          )}
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={fileRef} type="file" multiple className="hidden"
        accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png,.heic,.heif,.webp,.zip"
        onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value=""; } }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value=""; } }} />
    </div>
  );
}

/* ── Mini helper ── */
function Chip({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("bg-muted/40 rounded-lg px-2.5 py-1.5 leading-snug", wide && "col-span-2")}>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
