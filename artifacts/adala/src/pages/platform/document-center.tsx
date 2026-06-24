import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
  Database, ArrowUpRight, Loader2, X, TrendingUp, GitBranch,
  Lock, Shield, Clock, Bot, Sparkles, RotateCcw, Eye,
  Calendar, Users, DollarSign, FileSearch,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

const PERMISSION_TYPES = [
  { value: "OWNER",      label: "المالك فقط",     color: "bg-red-100 text-red-700" },
  { value: "TEAM",       label: "الفريق",          color: "bg-blue-100 text-blue-700" },
  { value: "MANAGEMENT", label: "الإدارة",          color: "bg-purple-100 text-purple-700" },
  { value: "HR",         label: "الموارد البشرية",  color: "bg-yellow-100 text-yellow-700" },
  { value: "FINANCE",    label: "المحاسبة",         color: "bg-green-100 text-green-700" },
  { value: "CUSTOM",     label: "مخصص",             color: "bg-gray-100 text-gray-700" },
];

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024, sizes = ["B","KB","MB","GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function mimeIcon(mime: string) {
  if (mime?.startsWith("image/")) return <Image className="h-4 w-4 text-purple-500" />;
  if (mime === "application/pdf")  return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-blue-500" />;
}

function providerBadge(provider: string) {
  if (provider === "replit_object_storage")
    return <Badge className="bg-green-100 text-green-700 text-xs gap-1"><CloudUpload className="h-3 w-3" />Object Storage</Badge>;
  return <Badge variant="outline" className="text-xs gap-1"><CloudOff className="h-3 w-3" />قاعدة البيانات</Badge>;
}

/* ══════════════════ UPLOAD DIALOG ══════════════════ */
function UploadDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen]         = useState(false);
  const [file, setFile]         = useState<File | null>(null);
  const [category, setCategory] = useState("أخرى");
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
      const reader  = new FileReader();
      const base64  = await new Promise<string>((resolve, reject) => {
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(api("document-center/upload"), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fileData: base64, fileName: file.name, fileType: file.type, legalCategory: category }),
      });
      if (!res.ok) throw new Error(((await res.json()) as any).error ?? "فشل الرفع");
      toast({ title: "✅ رُفع الملف بنجاح", description: file.name });
      setFile(null); setOpen(false); onSuccess();
    } catch (e: any) {
      toast({ title: "خطأ في الرفع", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
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
          <input ref={fileRef} type="file" className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.zip"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <div className="space-y-1">
            <label className="text-sm font-medium">الفئة القانونية</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.slice(1).map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الرفع...</> : <><CloudUpload className="h-4 w-4 ml-2" />رفع إلى Object Storage</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════ STORAGE DASHBOARD ══════════════════ */
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:"إجمالي الملفات",    value:totalFiles.toLocaleString("ar"),   icon:<FolderOpen className="h-5 w-5 text-blue-500" />,   color:"bg-blue-50" },
          { label:"المساحة المستخدمة", value:formatBytes(totalBytes),           icon:<HardDrive className="h-5 w-5 text-purple-500" />,  color:"bg-purple-50" },
          { label:"مُرحَّل للسحابة",   value:`${objectFiles.toLocaleString("ar")} ملف`, icon:<CloudUpload className="h-5 w-5 text-green-500" />, color:"bg-green-50" },
          { label:"في قاعدة البيانات", value:`${base64Files.toLocaleString("ar")} ملف`, icon:<Database className="h-5 w-5 text-orange-500" />,  color:"bg-orange-50" },
        ].map((k, i) => (
          <Card key={i}><CardContent className="pt-4">
            <div className={`inline-flex p-2 rounded-lg ${k.color} mb-3`}>{k.icon}</div>
            <div className="text-2xl font-bold">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />تقدم الترحيل إلى Object Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm mb-1">
            <span>{objectFiles} مُرحَّل</span>
            <span className="font-bold text-green-600">{migrated}%</span>
          </div>
          <Progress value={migrated} className="h-2" />
          {base64Files > 0 && <p className="text-xs text-muted-foreground mt-2">{base64Files} ملف في قاعدة البيانات — استخدم تبويب "الترحيل" لنقلها.</p>}
          {base64Files === 0 && totalFiles > 0 && <p className="text-xs text-green-600 flex items-center gap-1 mt-2"><CheckCircle2 className="h-3 w-3" />جميع الملفات في Object Storage</p>}
        </CardContent>
      </Card>

      {(data?.byCategory ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">توزيع المستندات حسب الفئة</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data?.byCategory ?? []).sort((a: any, b: any) => b.bytes - a.bytes).slice(0, 8).map((cat: any) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-xs w-24 text-right truncate">{cat.category}</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5">
                    <div className="bg-primary rounded-full h-1.5" style={{ width:`${Math.min((cat.bytes/(data?.totalBytes||1))*100,100)}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-left">{formatBytes(Number(cat.bytes))}</span>
                  <Badge variant="outline" className="text-xs">{cat.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(audit?.top10LargestFiles ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">أكبر 10 ملفات</CardTitle></CardHeader>
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

/* ══════════════════ FILE LIBRARY ══════════════════ */
function FileLibrary({ filterCategory, showArchived }: { filterCategory?: string; showArchived?: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState(filterCategory ?? "all");
  const [page, setPage]         = useState(1);
  const archived = showArchived ?? false;

  const { data, isLoading } = useQuery({
    queryKey: ["doc-center-files", category, search, page, archived],
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(page), pageSize: "30", archived: String(archived) });
      if (category !== "all") p.set("category", category);
      if (search) p.set("search", search);
      return fetch(api(`document-center/files?${p}`)).then(r => r.json());
    },
    staleTime: 30_000,
  });

  const downloadFile = async (id: string, name: string) => {
    try {
      const res = await fetch(api(`document-center/files/${id}/download`));
      if (!res.ok) throw new Error(((await res.json()) as any).error);
      const { url } = await res.json();
      const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.download = name; a.click();
    } catch (e: any) { toast({ title: "خطأ في التنزيل", description: e.message, variant: "destructive" }); }
  };

  const archiveFile = async (id: string, archive: boolean) => {
    await fetch(api(`document-center/files/${id}/archive`), {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archive }),
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

  const files = data?.files ?? [];
  const total = data?.total ?? 0;
  const pages = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث..." className="pr-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {!filterCategory && (
          <Select value={category} onValueChange={v => { setCategory(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      <div className="text-sm text-muted-foreground">{total.toLocaleString("ar")} مستند</div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>لا توجد مستندات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((f: any) => (
            <Card key={f.id} className={`hover:shadow-md transition-shadow ${f.is_archived ? "opacity-60" : ""}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg mt-0.5">{mimeIcon(f.mime_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={f.file_name}>{f.file_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(Number(f.file_size))}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {providerBadge(f.storage_provider)}
                      {f.legal_category && <Badge variant="secondary" className="text-xs gap-1"><Tag className="h-2.5 w-2.5" />{f.legal_category}</Badge>}
                      {f.version > 1 && <Badge className="bg-violet-100 text-violet-700 text-xs gap-1"><GitBranch className="h-2.5 w-2.5" />v{f.version}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(f.created_at).toLocaleDateString("ar-SA")}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreVertical className="h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {f.storage_provider === "replit_object_storage" && (
                        <DropdownMenuItem onClick={() => downloadFile(f.id, f.file_name)} className="gap-2"><Download className="h-3.5 w-3.5" />تنزيل</DropdownMenuItem>
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

/* ══════════════════ VERSION HISTORY ══════════════════ */
function VersionHistory() {
  const qc = useQueryClient();
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showUpload, setShowUpload]   = useState(false);
  const [changeSummary, setChangeSummary] = useState("");
  const [file, setFile]               = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: files } = useQuery({
    queryKey: ["doc-center-files", "all", "", 1, false],
    queryFn:  () => fetch(api("document-center/files?pageSize=100")).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ["doc-versions", selectedDoc?.id],
    queryFn:  () => selectedDoc ? fetch(api(`document-center/files/${selectedDoc.id}/versions`)).then(r => r.json()) : [],
    enabled:  !!selectedDoc,
    staleTime: 30_000,
  });

  const uploadVersion = async () => {
    if (!file || !selectedDoc) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(api(`document-center/files/${selectedDoc.id}/versions`), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fileData: base64, fileName: file.name, fileType: file.type, changeSummary }),
      });
      if (!res.ok) throw new Error(((await res.json()) as any).error ?? "فشل الرفع");
      toast({ title: "✅ إصدار جديد أُضيف بنجاح" });
      setShowUpload(false); setFile(null); setChangeSummary("");
      qc.invalidateQueries({ queryKey: ["doc-versions", selectedDoc.id] });
      qc.invalidateQueries({ queryKey: ["doc-center-files"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const restoreVersion = async (verId: string, vNum: number) => {
    if (!selectedDoc) return;
    const res = await fetch(api(`document-center/files/${selectedDoc.id}/versions/${verId}/restore`), { method: "POST" });
    if (res.ok) { toast({ title: `✅ تم استعادة الإصدار ${vNum}` }); qc.invalidateQueries({ queryKey: ["doc-versions", selectedDoc.id] }); }
  };

  const downloadVersion = async (verId: string, vNum: number) => {
    if (!selectedDoc) return;
    const res = await fetch(api(`document-center/files/${selectedDoc.id}/versions/${verId}/download`));
    if (!res.ok) { toast({ title: "خطأ في التنزيل", variant: "destructive" }); return; }
    const { url } = await res.json();
    const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.click();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* قائمة المستندات */}
      <Card className="md:col-span-1">
        <CardHeader className="pb-3"><CardTitle className="text-sm">اختر مستنداً</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto divide-y">
            {(files?.files ?? []).map((f: any) => (
              <button
                key={f.id}
                onClick={() => setSelectedDoc(f)}
                className={`w-full text-right p-3 flex items-center gap-3 hover:bg-muted transition-colors ${selectedDoc?.id === f.id ? "bg-primary/10 border-r-2 border-primary" : ""}`}
              >
                {mimeIcon(f.mime_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.file_name}</p>
                  <p className="text-xs text-muted-foreground">{f.version > 1 ? `v${f.version}` : "v1"}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* سجل الإصدارات */}
      <div className="md:col-span-2 space-y-4">
        {!selectedDoc ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <GitBranch className="h-10 w-10 mb-2 opacity-30" />
            <p>اختر مستنداً لعرض إصداراته</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{selectedDoc.file_name}</p>
                <p className="text-xs text-muted-foreground">{(versions as any[])?.length ?? 0} إصدار</p>
              </div>
              <Button size="sm" onClick={() => setShowUpload(!showUpload)} className="gap-1">
                <Upload className="h-3.5 w-3.5" />إصدار جديد
              </Button>
            </div>

            {showUpload && (
              <Card className="border-primary/30">
                <CardContent className="pt-4 space-y-3">
                  <div
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    {file ? (
                      <p className="text-sm font-medium">{file.name} — {formatBytes(file.size)}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">انقر لاختيار الملف</p>
                    )}
                  </div>
                  <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                  <Textarea
                    placeholder="ملخص التغييرات (اختياري)"
                    value={changeSummary}
                    onChange={e => setChangeSummary(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={uploadVersion} disabled={!file || uploading} className="flex-1">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : null}رفع الإصدار
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowUpload(false); setFile(null); }}>إلغاء</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {versionsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (versions as any[])?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد إصدارات مسجّلة — ارفع الإصدار الأول
              </div>
            ) : (
              <div className="space-y-2">
                {(versions as any[]).map((v: any) => (
                  <Card key={v.id} className={v.is_current ? "border-primary/50 bg-primary/5" : ""}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${v.is_current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          v{v.version_number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {v.is_current && <Badge className="bg-green-100 text-green-700 text-xs">الحالي</Badge>}
                            <span className="text-xs text-muted-foreground">{formatBytes(Number(v.file_size))}</span>
                          </div>
                          {v.change_summary && <p className="text-xs text-muted-foreground mt-0.5 truncate">{v.change_summary}</p>}
                          <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString("ar-SA")}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {v.storage_key && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadVersion(v.id, v.version_number)} title="تنزيل">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!v.is_current && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => restoreVersion(v.id, v.version_number)} title="استعادة">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ PERMISSIONS PANEL ══════════════════ */
function PermissionsPanel() {
  const qc = useQueryClient();
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [permType, setPermType]       = useState("TEAM");
  const [saving, setSaving]           = useState(false);

  const { data: files } = useQuery({
    queryKey: ["doc-center-files", "all", "", 1, false],
    queryFn:  () => fetch(api("document-center/files?pageSize=100")).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: perms, isLoading: permsLoading } = useQuery({
    queryKey: ["doc-permissions", selectedDoc?.id],
    queryFn:  () => selectedDoc ? fetch(api(`document-center/files/${selectedDoc.id}/permissions`)).then(r => r.json()) : [],
    enabled:  !!selectedDoc,
    staleTime: 30_000,
  });

  const savePermission = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    try {
      const res = await fetch(api(`document-center/files/${selectedDoc.id}/permissions`), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ permissionType: permType }),
      });
      if (!res.ok) throw new Error(((await res.json()) as any).error);
      toast({ title: "✅ الصلاحية أُضيفت" });
      qc.invalidateQueries({ queryKey: ["doc-permissions", selectedDoc.id] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const deletePermission = async (permId: string) => {
    if (!selectedDoc) return;
    await fetch(api(`document-center/files/${selectedDoc.id}/permissions/${permId}`), { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["doc-permissions", selectedDoc.id] });
    toast({ title: "حُذفت الصلاحية" });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
        <CardHeader className="pb-3"><CardTitle className="text-sm">اختر مستنداً</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto divide-y">
            {(files?.files ?? []).map((f: any) => (
              <button key={f.id} onClick={() => setSelectedDoc(f)}
                className={`w-full text-right p-3 flex items-center gap-3 hover:bg-muted transition-colors ${selectedDoc?.id === f.id ? "bg-primary/10 border-r-2 border-primary" : ""}`}>
                {mimeIcon(f.mime_type)}
                <p className="text-sm font-medium truncate flex-1">{f.file_name}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="md:col-span-2 space-y-4">
        {!selectedDoc ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Lock className="h-10 w-10 mb-2 opacity-30" />
            <p>اختر مستنداً لإدارة صلاحياته</p>
          </div>
        ) : (
          <>
            <p className="font-semibold">{selectedDoc.file_name}</p>
            <Card>
              <CardContent className="pt-4 space-y-3">
                <label className="text-sm font-medium">إضافة صلاحية جديدة</label>
                <Select value={permType} onValueChange={setPermType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERMISSION_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={savePermission} disabled={saving} className="gap-1">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                  حفظ الصلاحية
                </Button>
              </CardContent>
            </Card>

            {permsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (perms as any[])?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                لا توجد صلاحيات مضافة — الوصول مفتوح للمكتب بالكامل
              </div>
            ) : (
              <div className="space-y-2">
                {(perms as any[]).map((p: any) => {
                  const pt = PERMISSION_TYPES.find(t => t.value === p.permission_type);
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Badge className={`${pt?.color ?? "bg-gray-100 text-gray-700"} text-xs`}>{pt?.label ?? p.permission_type}</Badge>
                      <span className="text-xs text-muted-foreground flex-1">{new Date(p.created_at).toLocaleDateString("ar-SA")}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deletePermission(p.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ RETENTION POLICIES ══════════════════ */
function RetentionPolicies() {
  const qc = useQueryClient();
  const [editing, setEditing]   = useState<string | null>(null);
  const [years, setYears]       = useState(7);
  const [autoDelete, setAutoDelete] = useState(false);
  const [scanning, setScanning] = useState(false);

  const { data: policies, isLoading } = useQuery({
    queryKey: ["retention-policies"],
    queryFn:  () => fetch(api("document-center/retention-policies")).then(r => r.json()),
    staleTime: 60_000,
  });

  const savePolicy = async (category: string) => {
    const res = await fetch(api("document-center/retention-policies"), {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ category, retentionYears: years, archiveAfterDays: years * 365, autoDelete }),
    });
    if (res.ok) {
      toast({ title: "✅ تم حفظ السياسة" });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["retention-policies"] });
    }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const res  = await fetch(api("document-center/retention-policies/scan"), { method: "POST" });
      const data = await res.json();
      toast({ title: `✅ ${data.message}`, description: `فُحص ${data.scanned} مستند` });
      qc.invalidateQueries({ queryKey: ["doc-center-files"] });
      qc.invalidateQueries({ queryKey: ["doc-center-stats"] });
    } catch { toast({ title: "خطأ في الفحص", variant: "destructive" }); }
    finally { setScanning(false); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">سياسات الاحتفاظ بالمستندات</p>
          <p className="text-xs text-muted-foreground">تُطبَّق آلياً — المكتب يتغلب على الافتراضي</p>
        </div>
        <Button variant="outline" size="sm" onClick={runScan} disabled={scanning} className="gap-1">
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
          تشغيل الفحص الآن
        </Button>
      </div>

      <div className="space-y-2">
        {(policies ?? []).map((p: any) => (
          <Card key={p.category} className={p.nearExpiry > 0 ? "border-orange-200 bg-orange-50/30" : ""}>
            <CardContent className="py-3 px-4">
              {editing === p.category ? (
                <div className="space-y-3">
                  <p className="font-medium text-sm">{p.category}</p>
                  <div className="flex items-center gap-3">
                    <label className="text-sm w-28">مدة الاحتفاظ:</label>
                    <Input type="number" min={1} max={50} value={years} onChange={e => setYears(Number(e.target.value))} className="w-20 h-8" />
                    <span className="text-sm">سنة</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="auto" checked={autoDelete} onChange={e => setAutoDelete(e.target.checked)} className="rounded" />
                    <label htmlFor="auto" className="text-sm">حذف تلقائي عند انتهاء المدة</label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => savePolicy(p.category)}>حفظ</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{p.category}</span>
                      {p.is_customized && <Badge className="bg-blue-100 text-blue-700 text-xs">مخصص</Badge>}
                      {p.nearExpiry > 0 && <Badge className="bg-orange-100 text-orange-700 text-xs gap-1"><AlertTriangle className="h-2.5 w-2.5" />{p.nearExpiry} على وشك الانتهاء</Badge>}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{p.retention_years} سنة</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" />{p.docCount} مستند</span>
                      {p.auto_delete && <Badge variant="outline" className="text-xs text-red-600">حذف تلقائي</Badge>}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(p.category); setYears(p.retention_years); setAutoDelete(p.auto_delete); }}>
                    تعديل
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════ AI DOCUMENT INTELLIGENCE ══════════════════ */
function AIDocumentIntelligence() {
  const qc = useQueryClient();
  const [selectedDoc, setSelectedDoc]   = useState<any>(null);
  const [file, setFile]                 = useState<File | null>(null);
  const [analyzing, setAnalyzing]       = useState(false);
  const [result, setResult]             = useState<any>(null);
  const [searchQ, setSearchQ]           = useState("");
  const [searching, setSearching]       = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: files } = useQuery({
    queryKey: ["doc-center-files", "all", "", 1, false],
    queryFn:  () => fetch(api("document-center/files?pageSize=100")).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: savedMeta } = useQuery({
    queryKey: ["doc-ai-meta", selectedDoc?.id],
    queryFn:  () => selectedDoc ? fetch(api(`document-center/files/${selectedDoc.id}/ai-metadata`)).then(r => r.ok ? r.json() : null).catch(() => null) : null,
    enabled:  !!selectedDoc,
    staleTime: 60_000,
  });

  const analyze = async () => {
    if (!selectedDoc) return;
    setAnalyzing(true);
    try {
      let fileData: string | undefined;
      if (file) {
        const reader = new FileReader();
        fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      const res = await fetch(api(`document-center/files/${selectedDoc.id}/analyze`), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fileData }),
      });
      if (!res.ok) throw new Error(((await res.json()) as any).error);
      const data = await res.json();
      setResult(data);
      qc.invalidateQueries({ queryKey: ["doc-ai-meta", selectedDoc.id] });
      toast({ title: "✅ اكتمل التحليل الذكي" });
    } catch (e: any) {
      toast({ title: "خطأ في التحليل", description: e.message, variant: "destructive" });
    } finally { setAnalyzing(false); }
  };

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(api(`document-center/search?q=${encodeURIComponent(searchQ)}`));
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch { toast({ title: "خطأ في البحث", variant: "destructive" }); }
    finally { setSearching(false); }
  };

  const displayed = result ?? savedMeta;

  return (
    <div className="space-y-6">
      {/* بحث ذكي */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-blue-500" />البحث الذكي في المستندات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث في محتوى المستندات، الأطراف، الكلمات المفتاحية..."
                className="pr-9"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch()}
              />
            </div>
            <Button onClick={doSearch} disabled={searching || !searchQ.trim()} className="gap-1">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              بحث
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted cursor-pointer" onClick={() => setSelectedDoc(r)}>
                  {mimeIcon(r.mime_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.file_name}</p>
                    {r.summary && <p className="text-xs text-muted-foreground truncate">{r.summary}</p>}
                  </div>
                  {r.confidence_score > 0 && (
                    <Badge variant="outline" className="text-xs">{Math.round(r.confidence_score * 100)}%</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* تحليل مستند */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader className="pb-3"><CardTitle className="text-sm">اختر مستنداً</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto divide-y">
              {(files?.files ?? []).map((f: any) => (
                <button key={f.id} onClick={() => { setSelectedDoc(f); setResult(null); }}
                  className={`w-full text-right p-3 flex items-center gap-3 hover:bg-muted transition-colors ${selectedDoc?.id === f.id ? "bg-primary/10 border-r-2 border-primary" : ""}`}>
                  {mimeIcon(f.mime_type)}
                  <p className="text-sm font-medium truncate flex-1">{f.file_name}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-4">
          {!selectedDoc ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Bot className="h-10 w-10 mb-2 opacity-30" />
              <p>اختر مستنداً لتحليله بالذكاء الاصطناعي</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{selectedDoc.file_name}</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1 text-xs">
                    <Upload className="h-3.5 w-3.5" />{file ? file.name.slice(0, 12) + "…" : "رفع الملف للتحليل"}
                  </Button>
                  <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                  <Button size="sm" onClick={analyze} disabled={analyzing} className="gap-1">
                    {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {analyzing ? "جارٍ التحليل..." : "تحليل ذكي"}
                  </Button>
                </div>
              </div>

              {!displayed && !analyzing && (
                <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                  <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  ارفع الملف واضغط "تحليل ذكي" لاستخراج البيانات
                </div>
              )}

              {analyzing && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">جارٍ تحليل المستند بالذكاء الاصطناعي...</p>
                </div>
              )}

              {displayed && !analyzing && (
                <div className="space-y-3">
                  {displayed.summary && (
                    <Card><CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2 text-sm font-medium"><Bot className="h-4 w-4 text-blue-500" />الملخص</div>
                      <p className="text-sm text-muted-foreground">{displayed.summary}</p>
                    </CardContent></Card>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label:"نوع المستند",    value: displayed.document_type, icon:<FileText className="h-3.5 w-3.5 text-blue-500" /> },
                      { label:"نسبة الثقة",     value: displayed.confidence_score ? `${Math.round(Number(displayed.confidence_score)*100)}%` : null, icon:<CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> },
                    ].filter(i => i.value).map((item, i) => (
                      <Card key={i}><CardContent className="pt-3 pb-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium mb-1">{item.icon}{item.label}</div>
                        <p className="text-sm font-semibold">{item.value}</p>
                      </CardContent></Card>
                    ))}
                  </div>

                  {(displayed.parties?.length ?? 0) > 0 && (
                    <Card><CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><Users className="h-3.5 w-3.5 text-purple-500" />الأطراف</div>
                      <div className="flex flex-wrap gap-1">
                        {(displayed.parties ?? []).map((p: string, i: number) => <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>)}
                      </div>
                    </CardContent></Card>
                  )}

                  {(displayed.dates?.length ?? 0) > 0 && (
                    <Card><CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><Calendar className="h-3.5 w-3.5 text-orange-500" />التواريخ</div>
                      <div className="flex flex-wrap gap-1">
                        {(displayed.dates ?? []).map((d: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{d}</Badge>)}
                      </div>
                    </CardContent></Card>
                  )}

                  {(displayed.amounts?.length ?? 0) > 0 && (
                    <Card><CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><DollarSign className="h-3.5 w-3.5 text-green-500" />المبالغ</div>
                      <div className="flex flex-wrap gap-1">
                        {(displayed.amounts ?? []).map((a: string, i: number) => <Badge key={i} className="bg-green-100 text-green-700 text-xs">{a}</Badge>)}
                      </div>
                    </CardContent></Card>
                  )}

                  {(displayed.obligations?.length ?? 0) > 0 && (
                    <Card><CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><Eye className="h-3.5 w-3.5 text-red-500" />الالتزامات</div>
                      <ul className="space-y-1">
                        {(displayed.obligations ?? []).map((o: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                            <span className="text-primary mt-0.5">•</span>{o}
                          </li>
                        ))}
                      </ul>
                    </CardContent></Card>
                  )}

                  {(displayed.keywords?.length ?? 0) > 0 && (
                    <Card><CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><Tag className="h-3.5 w-3.5 text-blue-400" />الكلمات المفتاحية</div>
                      <div className="flex flex-wrap gap-1">
                        {(displayed.keywords ?? []).map((k: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{k}</Badge>)}
                      </div>
                    </CardContent></Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════ MIGRATION PANEL ══════════════════ */
function MigrationPanel() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<any>(null);

  const { data: status } = useQuery({
    queryKey: ["doc-migrate-status"],
    queryFn:  () => fetch(api("document-center/migrate/status")).then(r => r.json()),
    staleTime: 30_000,
  });

  const runMigration = async (batch: number) => {
    setRunning(true);
    try {
      const res  = await fetch(api("document-center/migrate"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: batch }),
      });
      const data = await res.json();
      setResult(data);
      if (data.migrated > 0) {
        toast({ title: `✅ تم ترحيل ${data.migrated} ملف` });
        qc.invalidateQueries({ queryKey: ["doc-center-stats"] });
        qc.invalidateQueries({ queryKey: ["doc-migrate-status"] });
      } else { toast({ title: data.message ?? "لا توجد ملفات لترحيلها" }); }
    } catch (e: any) { toast({ title: "خطأ في الترحيل", description: e.message, variant: "destructive" }); }
    finally { setRunning(false); }
  };

  const pending  = Number(status?.pending  ?? 0);
  const migrated = Number(status?.migrated ?? 0);
  const total    = Number(status?.total    ?? 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-blue-500" />ترحيل الملفات من قاعدة البيانات إلى Object Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label:"إجمالي الملفات", value:total,    color:"text-foreground" },
              { label:"مُرحَّلة",        value:migrated, color:"text-green-600" },
              { label:"متبقية",          value:pending,  color:"text-orange-600" },
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
                <span className="font-bold">{total > 0 ? Math.round((migrated/total)*100) : 0}%</span>
              </div>
              <Progress value={total > 0 ? (migrated/total)*100 : 0} className="h-2" />
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
                {running ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}ترحيل 10 ملفات
              </Button>
              <Button onClick={() => runMigration(50)} disabled={running} className="flex-1">
                {running ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}ترحيل 50 ملفاً
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

/* ══════════════════ MAIN PAGE ══════════════════ */
export default function DocumentCenter() {
  const qc = useQueryClient();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 rounded-xl">
            <FolderOpen className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">☁️ مركز إدارة المستندات</h1>
            <p className="text-sm text-muted-foreground">Object Storage مؤسسي · إصدارات · صلاحيات · ذكاء اصطناعي · سياسات احتفاظ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />تحديث
          </Button>
          <UploadDialog onSuccess={() => { qc.invalidateQueries({ queryKey: ["doc-center-files"] }); qc.invalidateQueries({ queryKey: ["doc-center-stats"] }); }} />
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-5">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard"   className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" />لوحة التحكم</TabsTrigger>
          <TabsTrigger value="library"     className="gap-1.5 text-xs"><FolderOpen className="h-3.5 w-3.5" />المكتبة</TabsTrigger>
          <TabsTrigger value="legal"       className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />قانونية</TabsTrigger>
          <TabsTrigger value="financial"   className="gap-1.5 text-xs"><Database className="h-3.5 w-3.5" />مالية</TabsTrigger>
          <TabsTrigger value="versions"    className="gap-1.5 text-xs"><GitBranch className="h-3.5 w-3.5" />الإصدارات</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1.5 text-xs"><Lock className="h-3.5 w-3.5" />الصلاحيات</TabsTrigger>
          <TabsTrigger value="retention"   className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" />الاحتفاظ</TabsTrigger>
          <TabsTrigger value="ai"          className="gap-1.5 text-xs"><Bot className="h-3.5 w-3.5" />الذكاء المستندي</TabsTrigger>
          <TabsTrigger value="archive"     className="gap-1.5 text-xs"><FolderArchive className="h-3.5 w-3.5" />الأرشيف</TabsTrigger>
          <TabsTrigger value="migration"   className="gap-1.5 text-xs"><ArrowUpRight className="h-3.5 w-3.5" />الترحيل</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">  <StorageDashboard />       </TabsContent>
        <TabsContent value="library">    <FileLibrary />             </TabsContent>
        <TabsContent value="legal">      <FileLibrary filterCategory={undefined} /></TabsContent>
        <TabsContent value="financial">  <FileLibrary filterCategory="مستند_مالي" /></TabsContent>
        <TabsContent value="versions">   <VersionHistory />          </TabsContent>
        <TabsContent value="permissions"><PermissionsPanel />        </TabsContent>
        <TabsContent value="retention">  <RetentionPolicies />       </TabsContent>
        <TabsContent value="ai">         <AIDocumentIntelligence /> </TabsContent>
        <TabsContent value="archive">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted/50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              الملفات المؤرشفة لا تُحذف تلقائياً. يمكنك إلغاء أرشفتها أو حذفها نهائياً.
            </div>
            <FileLibrary showArchived />
          </div>
        </TabsContent>
        <TabsContent value="migration">  <MigrationPanel />          </TabsContent>
      </Tabs>
    </div>
  );
}
