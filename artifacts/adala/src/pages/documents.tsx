import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListDocuments } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Upload, File, FileText, Download, MoreVertical,
  Share2, Globe, Loader2, CheckCircle2, Link2, Sparkles,
  FileImage, Archive, Sheet, Trash2, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/hooks/use-lang";
import { SmartUploader } from "@/components/smart-uploader";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function MimeIcon({ mime }: { mime?: string }) {
  const m = mime ?? "";
  if (m === "application/pdf")             return <FileText className="h-5 w-5 text-red-400" />;
  if (m.startsWith("image/"))              return <FileImage className="h-5 w-5 text-blue-400" />;
  if (m.includes("sheet")||m.includes("excel")) return <Sheet className="h-5 w-5 text-green-400" />;
  if (m.includes("zip"))                   return <Archive className="h-5 w-5 text-amber-400" />;
  return <File className="h-5 w-5 text-purple-400" />;
}

/* ── Portal Share Dialog ─────────────────────────────────────────────────── */
function usePortalTokens(caseId: string | null | undefined, enabled: boolean) {
  return useQuery<any[]>({
    queryKey: ["portal-tokens", caseId],
    queryFn: () => fetch(`${BASE}/api/portal/tokens/${caseId}`).then(r => r.json()),
    enabled: !!caseId && enabled,
    staleTime: 30_000,
  });
}

function ShareDialog({ doc, open, onClose, tx, dir }: { doc: any; open: boolean; onClose: () => void; tx: any; dir: "rtl" | "ltr" }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: tokens = [], isLoading } = usePortalTokens(doc?.caseId, open);

  const toggleMut = useMutation({
    mutationFn: async ({ tokenId, docId, shared }: { tokenId: string; docId: string; shared: boolean }) => {
      if (shared) {
        return fetch(`${BASE}/api/portal/tokens/${tokenId}/share-doc`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docId }),
        }).then(r => r.json());
      }
      return fetch(`${BASE}/api/portal/tokens/${tokenId}/share-doc/${docId}`, { method: "DELETE" }).then(r => r.json());
    },
    onSuccess: (d, vars) => {
      if (d?.error) { toast({ title: tx("خطأ", "Error"), description: d.error, variant: "destructive" }); return; }
      toast({ title: vars.shared ? tx("✅ تمت المشاركة", "✅ Shared") : tx("تم إلغاء المشاركة", "Unshared") });
      qc.invalidateQueries({ queryKey: ["portal-tokens", doc?.caseId] });
    },
    onError: () => toast({ title: tx("خطأ في المشاركة", "Sharing error"), variant: "destructive" }),
  });

  const docId = doc?.id ?? "";
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-[#C9A84C]" />
            {tx("مشاركة مع بوابة العميل", "Share with Client Portal")}
          </DialogTitle>
          <DialogDescription>
            {tx("اختر بوابات العملاء", "Choose client portals to share")} <strong className="text-foreground">{doc?.fileName ?? doc?.original_name}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-64 overflow-y-auto py-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> :
           tokens.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">{tx("لا توجد بوابات عملاء لهذه القضية", "No client portals for this case")}</p> :
           tokens.map((token: any) => {
             const shared = token.shared_docs?.includes(docId);
             return (
               <div key={token.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                 <div className="flex items-center gap-2">
                   <Globe className="h-4 w-4 text-[#C9A84C]" />
                   <span className="text-sm">{token.client_name ?? token.id.slice(0,8)}</span>
                 </div>
                 <Switch
                   checked={!!shared}
                   onCheckedChange={checked => toggleMut.mutate({ tokenId: token.id, docId, shared: checked })}
                   disabled={toggleMut.isPending}
                 />
               </div>
             );
           })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Smart Files list (storage_files) ───────────────────────────────────── */
function useStorageFiles(search: string) {
  return useQuery<any[]>({
    queryKey: ["storage-files", search],
    queryFn: () => fetch(`${BASE}/api/storage/files?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`)
      .then(r => r.json()),
    staleTime: 30_000,
  });
}

function StorageFileCard({ file, onShare, tx, dir }: { file: any; onShare: (f:any)=>void; tx: any; dir: "rtl"|"ltr" }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: () => fetch(`${BASE}/api/storage/files/${file.id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: tx("تم النقل إلى المهملات", "Moved to trash") });
      qc.invalidateQueries({ queryKey: ["storage-files"] });
    },
  });

  const fileUrl = file.file_url
    ? (file.file_url.startsWith("/") ? `${BASE}${file.file_url}` : file.file_url)
    : null;

  const isImage = file.mime_type?.startsWith("image/");
  const preview = isImage && fileUrl ? fileUrl : null;

  return (
    <Card className="hover-elevate group transition-all overflow-hidden">
      <CardContent className="p-0">
        {/* Image preview strip */}
        {preview && (
          <div className="h-28 overflow-hidden bg-muted/40">
            <img src={preview} className="w-full h-full object-cover" alt="" loading="lazy" />
          </div>
        )}
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 rounded-lg bg-muted/50">
              <MimeIcon mime={file.mime_type} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {fileUrl && (
                  <DropdownMenuItem className="gap-2 cursor-pointer" asChild>
                    <a href={fileUrl} download={file.original_name} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                      {tx("تحميل", "Download")}
                    </a>
                  </DropdownMenuItem>
                )}
                {file.case_id && (
                  <DropdownMenuItem className="gap-2 cursor-pointer text-[#C9A84C] focus:text-[#C9A84C]"
                    onClick={() => onShare(file)}>
                    <Share2 className="h-4 w-4" />
                    {tx("مشاركة مع العميل", "Share with Client")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer text-red-400 focus:text-red-400"
                  onClick={() => deleteMut.mutate()}>
                  <Trash2 className="h-4 w-4" />
                  {tx("حذف", "Delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <h3 className="font-semibold text-sm line-clamp-1 mb-1.5" title={file.original_name}>
            {file.original_name}
          </h3>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal capitalize">
              {file.category ?? "document"}
            </Badge>
            <span className="text-xs text-muted-foreground">{fmtSize(file.file_size)}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(file.created_at).toLocaleDateString("ar-SA")}
            </span>
          </div>

          {file.case_id && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              {tx("مرتبط بقضية", "Linked to case")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function Documents() {
  const { data: documents, isLoading: loadingOld } = useListDocuments();
  const [search, setSearch]           = useState("");
  const [shareDoc, setShareDoc]       = useState<any>(null);
  const [uploadOpen, setUploadOpen]   = useState(false);
  const qc = useQueryClient();
  const { tx, dateLocale, dir }       = useLang();

  const { data: storageFiles = [], isLoading: loadingNew, refetch: refetchFiles } =
    useStorageFiles(search);

  const filteredOld = (documents ?? []).filter((d: any) =>
    !search ||
    d.fileName?.toLowerCase().includes(search.toLowerCase()) ||
    d.caseName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleUploadSuccess = (files: any[]) => {
    qc.invalidateQueries({ queryKey: ["storage-files"] });
    refetchFiles();
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {tx("مكتبة المستندات", "Document Library")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tx("إدارة جميع الملفات والمرفقات القانونية", "Manage all legal files and attachments")}
          </p>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="hover-elevate gap-2"
          style={{ background: "linear-gradient(135deg,#C9A84C,#D4A843)", color: "#0D1626" }}
        >
          <Upload className="h-4 w-4" />
          {tx("رفع مستند جديد", "Upload Document")}
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tx("البحث في المستندات...", "Search documents...")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-4 pr-10"
          />
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9"
          onClick={() => { qc.invalidateQueries({ queryKey: ["storage-files"] }); refetchFiles(); }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="smart" dir={dir}>
        <TabsList className="mb-4">
          <TabsTrigger value="smart" className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            {tx("الملفات الذكية", "Smart Files")}
            {storageFiles.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] font-bold">
                {storageFiles.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="legacy" className="gap-2">
            <FileText className="h-3.5 w-3.5" />
            {tx("مستندات القضايا", "Case Documents")}
          </TabsTrigger>
        </TabsList>

        {/* Smart Files tab */}
        <TabsContent value="smart">
          {loadingNew ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_,i) => (
                <Card key={i}><CardContent className="p-6 h-36"><Skeleton className="h-full w-full" /></CardContent></Card>
              ))}
            </div>
          ) : storageFiles.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-2xl border border-dashed">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.2)" }}>
                <Upload className="h-7 w-7" style={{ color:"#C9A84C" }} />
              </div>
              <h3 className="text-lg font-semibold mb-1">{tx("لا توجد ملفات مرفوعة", "No files uploaded yet")}</h3>
              <p className="text-muted-foreground text-sm mb-5">
                {search
                  ? tx("لا توجد نتائج للبحث", "No matching results")
                  : tx("ارفع مستنداتك وسيقوم الذكاء الاصطناعي بتحليلها تلقائياً", "Upload documents and AI will analyze them automatically")}
              </p>
              {!search && (
                <Button onClick={() => setUploadOpen(true)} className="gap-2"
                  style={{ background:"linear-gradient(135deg,#C9A84C,#D4A843)", color:"#0D1626" }}>
                  <Upload className="h-4 w-4" />
                  {tx("ارفع أول ملف", "Upload first file")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {storageFiles.map((f: any) => (
                <StorageFileCard
                  key={f.id} file={f}
                  onShare={setShareDoc}
                  tx={tx} dir={dir}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Legacy case documents tab */}
        <TabsContent value="legacy">
          {loadingOld ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_,i) => (
                <Card key={i}><CardContent className="p-6 h-32"><Skeleton className="h-full w-full" /></CardContent></Card>
              ))}
            </div>
          ) : filteredOld.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-dashed">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-medium">{tx("لا توجد مستندات", "No Documents")}</h3>
              <p className="text-muted-foreground text-sm">
                {search ? tx("لا توجد نتائج", "No matching results") : tx("لم يتم رفع أي مستندات بعد", "No documents yet")}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredOld.map((doc: any) => (
                <Card key={doc.id} className="hover-elevate group cursor-pointer transition-all">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-secondary/10 rounded-lg text-secondary">
                        <File className="h-6 w-6" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Download className="h-4 w-4" />
                            {tx("تحميل", "Download")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-[#C9A84C] focus:text-[#C9A84C]"
                            onClick={() => setShareDoc(doc)}
                            disabled={!doc.caseId}
                          >
                            <Share2 className="h-4 w-4" />
                            {tx("مشاركة مع العميل", "Share with Client")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div>
                      <h3 className="font-semibold text-base line-clamp-1">{doc.fileName}</h3>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs font-normal">{doc.fileType}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString(dateLocale)}
                        </span>
                        {doc.fileSize && <span className="text-xs text-muted-foreground">{fmtSize(doc.fileSize)}</span>}
                      </div>
                      {doc.caseName && (
                        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                          <span className="font-medium text-foreground">{tx("القضية:", "Case:")}</span> {doc.caseName}
                        </p>
                      )}
                      {doc.caseId && (
                        <button onClick={() => setShareDoc(doc)}
                          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#C9A84C] transition-colors">
                          <Link2 className="h-3.5 w-3.5" />
                          {tx("مشاركة مع بوابة العميل", "Share with Client Portal")}
                        </button>
                      )}
                      {doc.aiSummary && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-md text-xs border border-border/50 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-1 h-full bg-accent" />
                          <p className="line-clamp-2">{doc.aiSummary}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Smart Upload Dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background:"rgba(201,168,76,0.15)", border:"1px solid rgba(201,168,76,0.25)" }}>
                <Upload className="h-4 w-4" style={{ color:"#C9A84C" }} />
              </div>
              {tx("رافع الملفات الذكي", "Smart File Uploader")}
            </DialogTitle>
            <DialogDescription className="text-right">
              {tx("ارفع مستنداتك — سيقوم الذكاء الاصطناعي بتحليلها واستخراج المعلومات تلقائياً", "Upload your documents — AI will analyze and extract information automatically")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <SmartUploader
              onSuccess={(files) => {
                handleUploadSuccess(files);
                setTimeout(() => setUploadOpen(false), 1800);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Share Dialog ── */}
      <ShareDialog
        doc={shareDoc}
        open={!!shareDoc}
        onClose={() => setShareDoc(null)}
        tx={tx}
        dir={dir}
      />
    </div>
  );
}
