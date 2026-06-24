import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen, Upload, Download, Trash2, Archive, Search, RefreshCw,
  FileText, File, Image, BarChart3, HardDrive, CloudUpload, CloudOff,
  CheckCircle2, AlertTriangle, MoreVertical, FolderArchive, Tag,
  Database, ArrowUpRight, Loader2, X, TrendingUp,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL;
const api  = (p: string) => `${BASE}api/${p}`.replace(/\/\//g, "/");

const CATEGORIES = [
  { value: "all",           label: "جميع الفئات" },
  { value: "وكالة",         label: "وكالة" },
  { value: "عقد",           label: "عقد" },
  { value: "حكم",           label: "حكم" },
  { value: "مذكرة",         label: "مذكرة" },
  { value: "لائحة_دعوى",    label: "لائحة دعوى" },
  { value: "محضر_جلسة",     label: "محضر جلسة" },
  { value: "تقرير_خبير",    label: "تقرير خبير" },
  { value: "مستند_إفلاس",   label: "مستند إفلاس" },
  { value: "فاتورة",         label: "فاتورة" },
  { value: "مستند_مالي",    label: "مستند مالي" },
  { value: "هوية",           label: "هوية" },
  { value: "سجل_تجاري",     label: "سجل تجاري" },
  { value: "أخرى",          label: "أخرى" },
];

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B","KB","MB","GB","TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function mimeIcon(mime: string) {
  if (mime?.startsWith("image/")) return <Image className="h-4 w-4 text-purple-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-blue-500" />;
}

function providerBadge(provider: string) {
  if (provider === "replit_object_storage")
    return <Badge className="bg-green-100 text-green-700 text-xs gap-1"><CloudUpload className="h-3 w-3" />Object Storage</Badge>;
  return <Badge variant="outline" className="text-xs gap-1"><CloudOff className="h-3 w-3" />قاعدة البيانات</Badge>;
}

/* ═══════════════ UPLOAD DIALOG ════════════════ */
function UploadDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen]           = useState(false);
  const [file, setFile]           = useState<File | null>(null);
  const [category, setCategory]   = useState("أخرى");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (f.size > 15 * 1024 * 1024) {
      toast({ title: "الملف كبير جداً", description: "الحد الأقصى 15 MB", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(api("document-center/upload"), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          fileData:      base64,
          fileName:      file.name,
          fileType:      file.type,
          legalCategory: category,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "فشل الرفع");
      }
      toast({ title: "✅ رُفع الملف بنجاح", description: file.name });
      setFile(null);
      setOpen(false);
      onSuccess();
    } catch (e: any) {
      toast({ title: "خطأ في الرفع", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Upload className="h-4 w-4" />رفع ملف</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>رفع مستند جديد</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            {file ? (
              <div className="space-y-2">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setFile(null); }}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <div className="space-y-2">
                <CloudUpload className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">اسحب الملف هنا أو انقر للاختيار</p>
                <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, JPG, PNG — الحد الأقصى 15 MB</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.zip" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          <div className="space-y-1">
            <label className="text-sm font-medium">الفئة القانونية</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.slice(1).map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الرفع...</> : <><Upload className="h-4 w-4 ml-2" />رفع إلى Object Storage</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════ STATS DASHBOARD ════════════════ */
function StorageDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["doc-center-stats"],
    queryFn:  () => fetch(api("document-center/stats")).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: audit } = useQuery({
    queryKey: ["doc-center-audit"],
    queryFn:  () => fetch(api("document-center/audit-report")).then(r => r.json()),
    staleTime: 120_000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const totalFiles  = Number(data?.totalFiles  ?? 0);
  const totalBytes  = Number(data?.totalBytes  ?? 0);
  const objectFiles = Number(data?.objectFiles ?? 0);
  const base64Files = Number(data?.base64Files ?? 0);
  const migrated    = totalFiles > 0 ? Math.round((objectFiles / totalFiles) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الملفات",    value: totalFiles.toLocaleString("ar"),    icon: <FolderOpen className="h-5 w-5 text-blue-500" />,   color: "bg-blue-50" },
          { label: "المساحة المستخدمة",  value: formatBytes(totalBytes),           icon: <HardDrive className="h-5 w-5 text-purple-500" />,  color: "bg-purple-50" },
          { label: "مُرحَّل للسحابة",    value: `${objectFiles.toLocaleString("ar")} ملف`, icon: <CloudUpload className="h-5 w-5 text-green-500" />, color: "bg-green-50" },
          { label: "في قاعدة البيانات", value: `${base64Files.toLocaleString("ar")} ملف`, icon: <Database className="h-5 w-5 text-orange-500" />, color: "bg-orange-50" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className={`inline-flex p-2 rounded-lg ${kpi.color} mb-3`}>{kpi.icon}</div>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Migration Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            تقدم الترحيل إلى Object Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm mb-1">
            <span>{objectFiles} مُرحَّل</span>
            <span className="font-bold text-green-600">{migrated}%</span>
          </div>
          <Progress value={migrated} className="h-2" />
          {base64Files > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {base64Files} ملف لا يزال مخزّناً في قاعدة البيانات — استخدم تبويب "الترحيل" لنقلها.
            </p>
          )}
          {base64Files === 0 && totalFiles > 0 && (
            <p className="text-xs text-green-600 flex items-center gap-1 mt-2">
              <CheckCircle2 className="h-3 w-3" /> جميع الملفات في Object Storage
            </p>
          )}
        </CardContent>
      </Card>

      {/* By Category */}
      {(data?.byCategory ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">توزيع المستندات حسب الفئة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data?.byCategory ?? []).sort((a: any, b: any) => b.bytes - a.bytes).slice(0, 8).map((cat: any) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-xs w-24 text-right truncate">{cat.category}</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary rounded-full h-1.5"
                      style={{ width: `${Math.min((cat.bytes / (data?.totalBytes || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-left">{formatBytes(Number(cat.bytes))}</span>
                  <Badge variant="outline" className="text-xs">{cat.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 10 Largest */}
      {(audit?.top10LargestFiles ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">أكبر 10 ملفات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(audit?.top10LargestFiles ?? []).map((f: any) => (
                <div key={f.id} className="flex items-center gap-3 text-sm">
                  {mimeIcon(f.mime_type)}
                  <span className="flex-1 truncate">{f.file_name}</span>
                  {providerBadge(f.storage_provider)}
                  <span className="text-xs text-muted-foreground">{formatBytes(Number(f.file_size))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════ MIGRATION PANEL ════════════════ */
function MigrationPanel() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<any>(null);

  const { data: status } = useQuery({
    queryKey: ["doc-migrate-status"],
    queryFn:  () => fetch(api("document-center/migrate/status")).then(r => r.json()),
    staleTime: 30_000,
  });

  const runMigration = async (batch = 20) => {
    setRunning(true);
    try {
      const res = await fetch(api("document-center/migrate"), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ batchSize: batch }),
      });
      const data = await res.json();
      setResult(data);
      if (data.migrated > 0) {
        toast({ title: `✅ تم ترحيل ${data.migrated} ملف بنجاح` });
        qc.invalidateQueries({ queryKey: ["doc-center-stats"] });
        qc.invalidateQueries({ queryKey: ["doc-migrate-status"] });
      } else {
        toast({ title: data.message ?? "لا توجد ملفات لترحيلها" });
      }
    } catch (e: any) {
      toast({ title: "خطأ في الترحيل", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const pending  = Number(status?.pending ?? 0);
  const migrated = Number(status?.migrated ?? 0);
  const total    = Number(status?.total ?? 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-blue-500" />
            ترحيل الملفات من قاعدة البيانات إلى Object Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: "إجمالي الملفات", value: total, color: "text-foreground" },
              { label: "مُرحَّلة",        value: migrated, color: "text-green-600" },
              { label: "متبقية",          value: pending,  color: "text-orange-600" },
            ].map((s, i) => (
              <div key={i} className="p-3 border rounded-lg">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>تقدم الترحيل</span>
                <span className="font-bold">{total > 0 ? Math.round((migrated / total) * 100) : 0}%</span>
              </div>
              <Progress value={total > 0 ? (migrated / total) * 100 : 0} className="h-2" />
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-medium">كيف يعمل الترحيل؟</p>
            <ul className="text-xs space-y-1 list-disc list-inside text-blue-700">
              <li>يقرأ الملفات القديمة المُخزَّنة كـ Base64 في قاعدة البيانات</li>
              <li>يرفعها إلى Replit Object Storage</li>
              <li>يتحقق من سلامة الملف عبر SHA-256 checksum</li>
              <li>يُحدّث السجل بمفتاح التخزين الجديد</li>
              <li>الملفات القديمة تبقى محفوظة حتى تتحقق بنفسك</li>
            </ul>
          </div>

          {pending > 0 ? (
            <div className="flex gap-3">
              <Button onClick={() => runMigration(10)} disabled={running} variant="outline" className="flex-1">
                {running ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                ترحيل 10 ملفات
              </Button>
              <Button onClick={() => runMigration(50)} disabled={running} className="flex-1">
                {running ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                ترحيل 50 ملفاً
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" />
              {total > 0 ? "تم ترحيل جميع الملفات بنجاح!" : "لا توجد ملفات تحتاج ترحيلاً"}
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-lg text-sm border ${result.migrated > 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-muted"}`}>
              آخر تشغيل: نُقل {result.migrated} ملف، فشل {result.failed}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════ FILE LIBRARY ════════════════ */
function FileLibrary({ filterCategory }: { filterCategory?: string }) {
  const qc = useQueryClient();
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState(filterCategory ?? "all");
  const [page, setPage]         = useState(1);
  const [archived, setArchived] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["doc-center-files", category, search, page, archived],
    queryFn:  () => {
      const params = new URLSearchParams({
        page:     String(page),
        pageSize: "30",
        archived: String(archived),
      });
      if (category !== "all") params.set("category", category);
      if (search)             params.set("search", search);
      return fetch(api(`document-center/files?${params}`)).then(r => r.json());
    },
    staleTime: 30_000,
  });

  const downloadFile = async (id: string, name: string) => {
    try {
      const res = await fetch(api(`document-center/files/${id}/download`));
      if (!res.ok) throw new Error((await res.json()).error);
      const { url } = await res.json();
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.download = name;
      a.click();
    } catch (e: any) {
      toast({ title: "خطأ في التنزيل", description: e.message, variant: "destructive" });
    }
  };

  const archiveFile = async (id: string, archive: boolean) => {
    await fetch(api(`document-center/files/${id}/archive`), {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ archive }),
    });
    qc.invalidateQueries({ queryKey: ["doc-center-files"] });
    toast({ title: archive ? "تمت الأرشفة" : "أُلغيت الأرشفة" });
  };

  const deleteFile = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف النهائي؟")) return;
    await fetch(api(`document-center/files/${id}`), { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["doc-center-files"] });
    toast({ title: "حُذف الملف" });
  };

  const files  = data?.files  ?? [];
  const total  = data?.total  ?? 0;
  const pages  = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث في المستندات..."
            className="pr-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={category} onValueChange={v => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={archived ? "default" : "outline"}
          size="sm"
          onClick={() => { setArchived(!archived); setPage(1); }}
          className="gap-1"
        >
          <FolderArchive className="h-4 w-4" />
          الأرشيف
        </Button>
      </div>

      {/* File Count */}
      <div className="text-sm text-muted-foreground">
        {total.toLocaleString("ar")} مستند
      </div>

      {/* Files Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد مستندات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((f: any) => (
            <Card key={f.id} className={`hover:shadow-md transition-shadow ${f.is_archived ? "opacity-60" : ""}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg mt-0.5">
                    {mimeIcon(f.mime_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={f.file_name}>{f.file_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(Number(f.file_size))}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {providerBadge(f.storage_provider)}
                      {f.legal_category && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Tag className="h-2.5 w-2.5" />{f.legal_category}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(f.created_at).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {f.storage_provider === "replit_object_storage" && (
                        <DropdownMenuItem onClick={() => downloadFile(f.id, f.file_name)} className="gap-2">
                          <Download className="h-3.5 w-3.5" />تنزيل
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => archiveFile(f.id, !f.is_archived)} className="gap-2">
                        <Archive className="h-3.5 w-3.5" />{f.is_archived ? "إلغاء الأرشفة" : "أرشفة"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteFile(f.id)} className="gap-2 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</Button>
          <span className="text-sm text-muted-foreground">{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>التالي</Button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ MAIN PAGE ════════════════ */
export default function DocumentCenter() {
  const qc  = useQueryClient();
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 rounded-xl">
            <FolderOpen className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">☁️ مركز إدارة المستندات</h1>
            <p className="text-sm text-muted-foreground">Object Storage مؤسسي · ترحيل تدريجي · تصنيف قانوني ذكي</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ["doc-center-stats"] }); qc.invalidateQueries({ queryKey: ["doc-center-files"] }); }} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />تحديث
          </Button>
          <UploadDialog onSuccess={() => { qc.invalidateQueries({ queryKey: ["doc-center-files"] }); qc.invalidateQueries({ queryKey: ["doc-center-stats"] }); }} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-5">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard"  className="gap-1.5"><BarChart3 className="h-4 w-4" />لوحة التحكم</TabsTrigger>
          <TabsTrigger value="library"    className="gap-1.5"><FolderOpen className="h-4 w-4" />المكتبة الكاملة</TabsTrigger>
          <TabsTrigger value="legal"      className="gap-1.5"><FileText className="h-4 w-4" />مستندات قانونية</TabsTrigger>
          <TabsTrigger value="financial"  className="gap-1.5"><Database className="h-4 w-4" />مستندات مالية</TabsTrigger>
          <TabsTrigger value="archive"    className="gap-1.5"><FolderArchive className="h-4 w-4" />الأرشيف</TabsTrigger>
          <TabsTrigger value="migration"  className="gap-1.5"><ArrowUpRight className="h-4 w-4" />الترحيل</TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard">
          <StorageDashboard />
        </TabsContent>

        {/* Full Library */}
        <TabsContent value="library">
          <FileLibrary />
        </TabsContent>

        {/* Legal Documents */}
        <TabsContent value="legal">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["وكالة","عقد","حكم","مذكرة","لائحة_دعوى","محضر_جلسة","تقرير_خبير","مستند_إفلاس"].map(cat => (
                <Card key={cat} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 text-center">
                    <FileText className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-sm font-medium">{cat.replace(/_/g, " ")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <FileLibrary filterCategory={undefined} />
          </div>
        </TabsContent>

        {/* Financial Documents */}
        <TabsContent value="financial">
          <FileLibrary filterCategory="مستند_مالي" />
        </TabsContent>

        {/* Archive */}
        <TabsContent value="archive">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted/50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              الملفات المؤرشفة لا تُحذف تلقائياً. يمكنك إلغاء أرشفتها أو حذفها نهائياً.
            </div>
            <FileLibrary />
          </div>
        </TabsContent>

        {/* Migration */}
        <TabsContent value="migration">
          <MigrationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
