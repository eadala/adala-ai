import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListDocuments } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Upload, File, FileText, Download, MoreVertical,
  Share2, Users, Globe, Loader2, CheckCircle2, Link2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/hooks/use-lang";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docId }),
        }).then(r => r.json());
      } else {
        return fetch(`${BASE}/api/portal/tokens/${tokenId}/share-doc/${docId}`, {
          method: "DELETE",
        }).then(r => r.json());
      }
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
            {tx("اختر بوابات العملاء التي تريد مشاركة", "Choose client portals to share")} <strong className="text-foreground">{doc?.fileName}</strong> {tx("معها", "with")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          {!doc?.caseId ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {tx("هذا المستند غير مرتبط بقضية — لا يمكن مشاركته عبر البوابة", "This document is not linked to a case — cannot share via portal")}
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{tx("لا توجد بوابات عميل مفعَّلة لهذه القضية", "No active client portals for this case")}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{tx("أنشئ بوابة من صفحة القضية أولاً", "Create a portal from the case page first")}</p>
            </div>
          ) : (
            tokens.map((token: any) => {
              const sharedDocs: string[] = Array.isArray(token.shared_documents)
                ? token.shared_documents
                : (typeof token.shared_documents === "string"
                  ? JSON.parse(token.shared_documents || "[]")
                  : []);
              const isShared = sharedDocs.includes(docId);
              const isPending = toggleMut.isPending && toggleMut.variables?.tokenId === token.id;

              return (
                <div key={token.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isShared ? "border-[#C9A84C]/40 bg-[#C9A84C]/5" : "border-border/60 bg-muted/20"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isShared ? "bg-[#C9A84C]/15" : "bg-muted"}`}>
                      <Users className={`h-4 w-4 ${isShared ? "text-[#C9A84C]" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{token.client_name ?? tx("عميل", "Client")}</p>
                      <p className="text-xs text-muted-foreground truncate">{token.client_email ?? "—"}</p>
                      {isShared && (
                        <span className="text-[10px] text-[#C9A84C] flex items-center gap-0.5 mt-0.5">
                          <CheckCircle2 className="h-3 w-3" />{tx("مُشارَك", "Shared")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mr-2">
                    {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={isShared}
                      disabled={isPending}
                      onCheckedChange={checked =>
                        toggleMut.mutate({ tokenId: token.id, docId, shared: checked })
                      }
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Documents() {
  const { data: documents, isLoading } = useListDocuments();
  const [search, setSearch] = useState("");
  const [shareDoc, setShareDoc] = useState<any>(null);
  const { tx, dateLocale, dir } = useLang();

  const filtered = (documents ?? []).filter((d: any) =>
    !search ||
    d.fileName?.toLowerCase().includes(search.toLowerCase()) ||
    d.caseName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tx("مكتبة المستندات", "Document Library")}</h1>
          <p className="text-muted-foreground mt-1">{tx("إدارة جميع الملفات والمرفقات القانونية", "Manage all legal files and attachments")}</p>
        </div>
        <Button className="hover-elevate">
          <Upload className="ml-2 h-4 w-4" />
          {tx("رفع مستند جديد", "Upload Document")}
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tx("البحث في المستندات...", "Search documents...")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-4 pr-10"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6 h-32"><Skeleton className="h-full w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">{tx("لا توجد مستندات", "No Documents")}</h3>
          <p className="text-muted-foreground">
            {search ? tx("لا توجد نتائج مطابقة للبحث", "No matching results") : tx("لم تقم برفع أي مستندات حتى الآن.", "You haven't uploaded any documents yet.")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc: any) => (
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
                    <DropdownMenuContent align="end" dir={dir} className="w-44">
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
                  <h3 className="font-semibold text-base line-clamp-1" title={doc.fileName || ""}>{doc.fileName}</h3>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-normal">{doc.fileType}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString(dateLocale)}
                    </span>
                    {doc.fileSize && (
                      <span className="text-xs text-muted-foreground">{fmtSize(doc.fileSize)}</span>
                    )}
                  </div>

                  {doc.caseName && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <span className="font-medium text-foreground">{tx("القضية:", "Case:")}</span> {doc.caseName}
                    </p>
                  )}

                  {doc.caseId && (
                    <button
                      onClick={() => setShareDoc(doc)}
                      className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#C9A84C] transition-colors"
                    >
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
