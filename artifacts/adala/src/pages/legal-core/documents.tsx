import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListDocuments } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Upload, File, FileText, Download, MoreVertical,
  Share2, Globe, Loader2, CheckCircle2, Link2, Sparkles,
  FileImage, Archive, Sheet, Trash2, RefreshCw,
  Folder, FolderOpen, FolderPlus, ChevronLeft,
  Pencil, Home, FolderInput, ShieldCheck, LockKeyhole,
  Users, Eye, EyeOff, Settings2, UserPlus, X, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/hooks/use-lang";
import { SmartUploader } from "@/components/smart-uploader";
import { cn } from "@/lib/utils";
import { useImageViewer } from "@/components/ui/image-viewer";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function MimeIcon({ mime, cls }: { mime?: string; cls?: string }) {
  const m = mime ?? "";
  const c = cls ?? "h-5 w-5";
  if (m === "application/pdf")              return <FileText className={`${c} text-red-400`} />;
  if (m.startsWith("image/"))               return <FileImage className={`${c} text-blue-400`} />;
  if (m.includes("sheet")||m.includes("excel")) return <Sheet className={`${c} text-green-400`} />;
  if (m.includes("zip"))                    return <Archive className={`${c} text-amber-400`} />;
  return <File className={`${c} text-purple-400`} />;
}

/* ── Data hooks ──────────────────────────────────────────────────────────── */
function useFolders() {
  return useQuery<any[]>({
    queryKey: ["storage-folders"],
    queryFn: () => fetch(`${BASE}/api/storage/folders`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 30_000,
  });
}

function useStorageFiles(search: string, folderId: string | null, enabled = true) {
  const folderParam = folderId === null ? "root" : folderId;
  return useQuery<any[]>({
    queryKey: ["storage-files", search, folderParam],
    queryFn: () => fetch(
      `${BASE}/api/storage/files?limit=200${search ? `&search=${encodeURIComponent(search)}` : ""}&folderId=${folderParam}`
    ).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 30_000,
    enabled,
  });
}

/* ── Portal share dialog ─────────────────────────────────────────────────── */
function usePortalTokens(caseId: string | null | undefined, enabled: boolean) {
  return useQuery<any[]>({
    queryKey: ["portal-tokens", caseId],
    queryFn: () => fetch(`${BASE}/api/portal/tokens/${caseId}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled: !!caseId && enabled,
    staleTime: 30_000,
  });
}

function ShareDialog({ doc, open, onClose, tx, dir }: { doc: any; open: boolean; onClose: () => void; tx: any; dir: "rtl"|"ltr" }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: tokens = [], isLoading } = usePortalTokens(doc?.caseId ?? doc?.case_id, open);
  const toggleMut = useMutation({
    mutationFn: async ({ tokenId, docId, shared }: { tokenId: string; docId: string; shared: boolean }) => {
      if (shared) return fetch(`${BASE}/api/portal/tokens/${tokenId}/share-doc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docId }) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); });
      return fetch(`${BASE}/api/portal/tokens/${tokenId}/share-doc/${docId}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); });
    },
    onSuccess: (d, vars) => {
      if (d?.error) { toast({ title: tx("خطأ","Error"), description: d.error, variant: "destructive" }); return; }
      toast({ title: vars.shared ? tx("✅ تمت المشاركة","✅ Shared") : tx("تم إلغاء المشاركة","Unshared") });
      qc.invalidateQueries({ queryKey: ["portal-tokens", doc?.caseId ?? doc?.case_id] });
    },
  });
  const docId = doc?.id ?? "";
  return (
    <AdaptiveDialog open={open} onOpenChange={v => !v && onClose()}>
      <AdaptiveDialogContent className="sm:max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5 text-primary" />{tx("مشاركة مع بوابة العميل","Share with Client Portal")}</DialogTitle>
          <DialogDescription>{tx("اختر بوابات العملاء","Choose client portals to share")} <strong className="text-foreground">{doc?.fileName ?? doc?.original_name}</strong></DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-64 overflow-y-auto py-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> :
           tokens.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">{tx("لا توجد بوابات عملاء لهذه القضية","No client portals for this case")}</p> :
           tokens.map((token: any) => {
             const shared = token.shared_docs?.includes(docId);
             return (
               <div key={token.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                 <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /><span className="text-sm">{token.client_name ?? token.id.slice(0,8)}</span></div>
                 <Switch checked={!!shared} onCheckedChange={c => toggleMut.mutate({ tokenId:token.id, docId, shared:c })} disabled={toggleMut.isPending} />
               </div>
             );
           })}
        </div>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ── Move to folder dialog ───────────────────────────────────────────────── */
function MoveDialog({ file, folders, open, onClose }: { file: any; folders: any[]; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(file?.folder_id ?? null);
  const moveMut = useMutation({
    mutationFn: (folderId: string | null) =>
      fetch(`${BASE}/api/storage/files/${file.id}/folder`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      toast({ title: "✅ تم نقل الملف" });
      qc.invalidateQueries({ queryKey: ["storage-files"] });
      onClose();
    },
    onError: () => toast({ title: "❌ فشل النقل", variant: "destructive" }),
  });

  const tree = buildTree(folders);

  return (
    <AdaptiveDialog open={open} onOpenChange={v => !v && onClose()}>
      <AdaptiveDialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <FolderInput className="h-4 w-4 text-primary" />
            نقل إلى مجلد
          </DialogTitle>
          <DialogDescription className="text-right truncate">
            {file?.original_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 max-h-64 overflow-y-auto py-1">
          {/* Root option */}
          <button
            onClick={() => setSelected(null)}
            className={cn(
              "w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
              selected === null ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted/40"
            )}>
            <Home className="h-4 w-4 shrink-0" />
            الجذر (بدون مجلد)
            {selected === null && <CheckCircle2 className="h-3.5 w-3.5 mr-auto" />}
          </button>
          {/* Folder tree */}
          {renderTreeForMove(tree, selected, setSelected, 0)}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>إلغاء</Button>
          <Button size="sm" className="flex-1 font-bold"
            style={{ background:"linear-gradient(135deg,#2563EB,#2563EB)", color:"#0D1626" }}
            disabled={moveMut.isPending || selected === (file?.folder_id ?? null)}
            onClick={() => moveMut.mutate(selected)}>
            {moveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "نقل هنا"}
          </Button>
        </div>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

function renderTreeForMove(nodes: any[], selected: string | null, setSelected: (v: string|null) => void, depth: number): React.ReactElement[] {
  return nodes.flatMap(n => [
    <button key={n.id}
      onClick={() => setSelected(n.id)}
      className={cn(
        "w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
        selected === n.id ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted/40"
      )}
      style={{ paddingRight: `${12 + depth * 16}px` }}>
      <Folder className="h-4 w-4 shrink-0 text-primary/70" />
      <span className="truncate flex-1">{n.name}</span>
      {n.file_count > 0 && <span className="text-[10px] text-muted-foreground">{n.file_count}</span>}
      {selected === n.id && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
    </button>,
    ...(n.children?.length ? renderTreeForMove(n.children, selected, setSelected, depth + 1) : []),
  ]);
}

/* ── Visibility helpers ──────────────────────────────────────────────────── */
const VISIBILITY_OPTIONS = [
  { value: "everyone",    label: "الكل",             desc: "جميع أعضاء المكتب",          icon: <Users className="h-4 w-4 text-green-400" /> },
  { value: "admins_only", label: "المديرون فقط",      desc: "مالك المكتب والمديرون",        icon: <ShieldCheck className="h-4 w-4 text-blue-400" /> },
  { value: "owner_only",  label: "أنا فقط",           desc: "منشئ المجلد والمديرون",        icon: <LockKeyhole className="h-4 w-4 text-amber-400" /> },
  { value: "custom",      label: "مخصص",              desc: "أشخاص محددون بصلاحيات دقيقة", icon: <Settings2 className="h-4 w-4 text-purple-400" /> },
];
function VisibilityBadge({ v }: { v?: string }) {
  if (!v || v === "everyone") return null;
  const opt = VISIBILITY_OPTIONS.find(o => o.value === v);
  if (!opt) return null;
  return (
    <span className="shrink-0 opacity-60" title={opt.label}>{opt.icon}</span>
  );
}

/* ── Folder Permissions Dialog ───────────────────────────────────────────── */
function FolderPermissionsDialog({ folder, open, onClose }: { folder: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [vis, setVis] = React.useState(folder?.visibility ?? "everyone");
  const [savingVis, setSavingVis] = React.useState(false);
  const [addUserId, setAddUserId] = React.useState("");
  const [addCanWrite, setAddCanWrite] = React.useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["folder-permissions", folder?.id],
    queryFn: () => fetch(`${BASE}/api/storage/folders/${folder.id}/permissions`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled: open && !!folder?.id,
    staleTime: 10_000,
  });

  // Sync vis when data loads
  React.useEffect(() => { if (data?.folder?.visibility) setVis(data.folder.visibility); }, [data]);

  const saveVis = async () => {
    setSavingVis(true);
    try {
      const r = await fetch(`${BASE}/api/storage/folders/${folder.id}/permissions`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: vis }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "خطأ");
      toast({ title: "✅ تم حفظ إعدادات الرؤية" });
      qc.invalidateQueries({ queryKey: ["storage-folders"] });
      refetch();
    } catch (e: any) {
      toast({ title: `❌ ${e.message}`, variant: "destructive" });
    } finally { setSavingVis(false); }
  };

  const grantMut = useMutation({
    mutationFn: ({ userId, userName, canWrite }: { userId: string; userName: string; canWrite: boolean }) =>
      fetch(`${BASE}/api/storage/folders/${folder.id}/permissions/users`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName, canRead: true, canWrite, canDelete: false }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { toast({ title: "✅ تم منح الصلاحية" }); refetch(); setAddUserId(""); setAddCanWrite(false); },
    onError: () => toast({ title: "❌ فشل منح الصلاحية", variant: "destructive" }),
  });

  const revokeMut = useMutation({
    mutationFn: (userId: string) =>
      fetch(`${BASE}/api/storage/folders/${folder.id}/permissions/users/${userId}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { toast({ title: "تم سحب الصلاحية" }); refetch(); },
  });

  const members: any[] = data?.members ?? [];
  const grants: any[] = data?.grants ?? [];
  const grantedIds = new Set(grants.map((g: any) => g.user_id));
  const availableMembers = members.filter((m: any) => !grantedIds.has(m.user_id));

  return (
    <AdaptiveDialog open={open} onOpenChange={v => !v && onClose()}>
      <AdaptiveDialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <ShieldCheck className="h-5 w-5 text-primary" />
            صلاحيات المجلد
          </DialogTitle>
          <DialogDescription className="text-right font-medium text-foreground/80">
            📁 {folder?.name}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            {/* ── Visibility selector ── */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">مستوى الرؤية</p>
              <div className="space-y-1.5">
                {VISIBILITY_OPTIONS.map(opt => (
                  <button key={opt.value}
                    onClick={() => setVis(opt.value)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-right transition-all",
                      vis === opt.value
                        ? "border-primary/50 bg-primary/8"
                        : "border-border/40 hover:border-border hover:bg-muted/30"
                    )}>
                    {opt.icon}
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                    </div>
                    {vis === opt.value && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
              <Button size="sm" className="w-full h-8 text-xs font-bold mt-1"
                style={{ background:"linear-gradient(135deg,#2563EB,#2563EB)", color:"#0D1626" }}
                disabled={savingVis || vis === (data?.folder?.visibility ?? "everyone")}
                onClick={saveVis}>
                {savingVis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ مستوى الرؤية"}
              </Button>
            </div>

            {/* ── Custom user grants (only shown in custom mode) ── */}
            {vis === "custom" && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">الأشخاص المصرح لهم</p>

                {grants.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">لا يوجد أشخاص مضافون بعد</p>
                )}

                {grants.map((g: any) => (
                  <div key={g.user_id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g.user_name ?? g.user_id}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {g.can_write ? "قراءة + كتابة" : "قراءة فقط"}
                      </p>
                    </div>
                    <button onClick={() => { if (confirm(`سحب صلاحية "${g.full_name ?? g.user_id}"؟`)) revokeMut.mutate(g.user_id); }}
                      className="p-1 rounded hover:bg-red-500/15 text-red-400 transition-colors" title="سحب الصلاحية">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add user */}
                {availableMembers.length > 0 && (
                  <div className="pt-1 space-y-2">
                    <p className="text-[11px] text-muted-foreground">إضافة شخص:</p>
                    <select value={addUserId} onChange={e => setAddUserId(e.target.value)}
                      className="w-full h-8 rounded-lg border border-border/50 bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
                      <option value="">— اختر عضوًا —</option>
                      {availableMembers.map((m: any) => (
                        <option key={m.user_id} value={m.user_id}>{m.name} ({m.role})</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer flex-1">
                        <Switch checked={addCanWrite} onCheckedChange={setAddCanWrite} />
                        {addCanWrite ? "قراءة + كتابة" : "قراءة فقط"}
                      </label>
                      <Button size="sm" className="h-8 px-3 text-xs gap-1 font-bold"
                        style={{ background:"linear-gradient(135deg,#2563EB,#2563EB)", color:"#0D1626" }}
                        disabled={!addUserId || grantMut.isPending}
                        onClick={() => {
                          const m = members.find((x:any) => x.user_id === addUserId);
                          grantMut.mutate({ userId: addUserId, userName: m?.name ?? addUserId, canWrite: addCanWrite });
                        }}>
                        <UserPlus className="h-3 w-3" />
                        إضافة
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ── Folder tree helpers ─────────────────────────────────────────────────── */
function buildTree(folders: any[]): any[] {
  const map: Record<string, any> = {};
  folders.forEach(f => { map[f.id] = { ...f, children: [] }; });
  const roots: any[] = [];
  folders.forEach(f => {
    if (f.parent_id && map[f.parent_id]) map[f.parent_id].children.push(map[f.id]);
    else roots.push(map[f.id]);
  });
  return roots;
}

function FolderTree({
  tree, currentId, onNavigate, onCreateSub, onRename, onDelete, onPermissions,
}: {
  tree: any[];
  currentId: string | null;
  onNavigate: (id: string | null) => void;
  onCreateSub: (parentId: string | null) => void;
  onRename: (folder: any) => void;
  onDelete: (folder: any) => void;
  onPermissions: (folder: any) => void;
}) {
  return (
    <div className="space-y-0.5">
      {tree.map(n => (
        <FolderNode
          key={n.id} node={n} currentId={currentId}
          onNavigate={onNavigate} onCreateSub={onCreateSub}
          onRename={onRename} onDelete={onDelete} onPermissions={onPermissions} depth={0}
        />
      ))}
    </div>
  );
}

function FolderNode({ node, currentId, onNavigate, onCreateSub, onRename, onDelete, onPermissions, depth }: any) {
  const isActive = currentId === node.id;
  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors select-none",
          isActive ? "bg-primary/15 text-primary" : "hover:bg-muted/40 text-foreground/80"
        )}
        style={{ paddingRight: `${8 + depth * 14}px` }}
        onClick={() => onNavigate(node.id)}
      >
        {isActive
          ? <FolderOpen className="h-4 w-4 shrink-0" />
          : <Folder className="h-4 w-4 shrink-0 opacity-70" />}
        <span className="flex-1 text-sm truncate font-medium">{node.name}</span>
        {/* Visibility badge */}
        <VisibilityBadge v={node.visibility} />
        {node.file_count > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">{node.file_count}</span>
        )}
        {/* Actions — visible on hover, only if canManage */}
        {node.canManage !== false && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
            <button className="p-0.5 rounded hover:bg-muted" title="مجلد فرعي"
              onClick={e => { e.stopPropagation(); onCreateSub(node.id); }}>
              <FolderPlus className="h-3 w-3" />
            </button>
            <button className="p-0.5 rounded hover:bg-muted" title="إعادة تسمية"
              onClick={e => { e.stopPropagation(); onRename(node); }}>
              <Pencil className="h-3 w-3" />
            </button>
            <button className="p-0.5 rounded hover:bg-blue-500/15 text-blue-400" title="الصلاحيات"
              onClick={e => { e.stopPropagation(); onPermissions(node); }}>
              <ShieldCheck className="h-3 w-3" />
            </button>
            <button className="p-0.5 rounded hover:bg-red-500/20 text-red-400" title="حذف"
              onClick={e => { e.stopPropagation(); onDelete(node); }}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      {node.children?.length > 0 && (
        <div>
          {node.children.map((child: any) => (
            <FolderNode key={child.id} node={child} currentId={currentId}
              onNavigate={onNavigate} onCreateSub={onCreateSub}
              onRename={onRename} onDelete={onDelete} onPermissions={onPermissions} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

/* ── Storage file card ───────────────────────────────────────────────────── */
function StorageFileCard({ file, folders, onShare, onMove, tx }: { file: any; folders: any[]; onShare:(f:any)=>void; onMove:(f:any)=>void; tx:any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { open: openImage, viewer: imageViewer } = useImageViewer();

  const trashMut = useMutation({
    mutationFn: () => fetch(`${BASE}/api/storage/files/${file.id}/trash`, { method: "PATCH" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { toast({ title: tx("تم النقل إلى المهملات","Moved to trash") }); qc.invalidateQueries({ queryKey: ["storage-files"] }); },
    onError: () => toast({ title: tx("❌ فشل الحذف","❌ Delete failed"), variant: "destructive" }),
  });

  const handleDelete = () => {
    if (!window.confirm(tx(`حذف الملف "${file.original_name}"؟ سيُنقل إلى المهملات ويمكن استعادته لاحقاً.`, `Delete "${file.original_name}"? It will be moved to trash.`))) return;
    trashMut.mutate();
  };

  const fileUrl = file.file_url
    ? (file.file_url.startsWith("/") ? `${BASE}${file.file_url}` : file.file_url)
    : null;
  const isImage = file.mime_type?.startsWith("image/");
  const preview = isImage && fileUrl ? fileUrl : null;

  return (
    <Card className="hover-elevate group transition-all overflow-hidden">
      {imageViewer}
      <CardContent className="p-0">
        {preview && (
          <div
            className="h-28 overflow-hidden bg-muted/40 cursor-zoom-in relative"
            onClick={() => openImage(preview)}
            title={tx("انقر للتكبير", "Click to enlarge")}
          >
            <img src={preview} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="" loading="lazy" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
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
              <DropdownMenuContent align="end" className="w-48">
                {fileUrl && (
                  <>
                    <DropdownMenuItem className="gap-2 cursor-pointer" asChild>
                      <a href={fileUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />{tx("فتح","Open")}
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 cursor-pointer" asChild>
                      <a href={fileUrl} download={file.original_name}>
                        <Download className="h-4 w-4" />{tx("تحميل","Download")}
                      </a>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onMove(file)}>
                  <FolderInput className="h-4 w-4" />
                  {tx("نقل إلى مجلد","Move to folder")}
                </DropdownMenuItem>
                {file.case_id && (
                  <DropdownMenuItem className="gap-2 cursor-pointer text-primary focus:text-primary" onClick={() => onShare(file)}>
                    <Share2 className="h-4 w-4" />{tx("مشاركة مع العميل","Share with Client")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer text-red-400 focus:text-red-400"
                  disabled={trashMut.isPending}
                  onClick={handleDelete}>
                  {trashMut.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                  {tx("حذف","Delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <h3 className="font-semibold text-sm line-clamp-1 mb-1.5" title={file.original_name}>{file.original_name}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal capitalize">{file.category ?? "document"}</Badge>
            <span className="text-xs text-muted-foreground">{fmtSize(file.file_size)}</span>
            <span className="text-xs text-muted-foreground">{new Date(file.created_at).toLocaleDateString("ar-SA")}</span>
          </div>
          {file.case_id && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Link2 className="h-3 w-3" />{tx("مرتبط بقضية","Linked to case")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Legacy documents tab ────────────────────────────────────────────────── */
function LegacyDocTab({ filteredOld, loadingOld, search, setSearch, setShareDoc, tx, dateLocale, qc }: any) {
  const { toast } = useToast();

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/api/documents/${id}`, { method: "DELETE" }).then(r => { if (!r.ok && r.status !== 204) throw new Error("خطأ في الخادم"); }),
    onSuccess: () => { toast({ title: tx("تم حذف المستند","Document deleted") }); qc.invalidateQueries({ queryKey: ["documents"] }); },
    onError: () => toast({ title: tx("❌ فشل الحذف","❌ Delete failed"), variant: "destructive" }),
  });

  const handleDelete = (doc: any) => {
    if (!window.confirm(tx(`حذف المستند "${doc.fileName}"؟ لا يمكن التراجع عن هذا الإجراء.`, `Delete "${doc.fileName}"? This cannot be undone.`))) return;
    deleteMut.mutate(String(doc.id));
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={tx("البحث في المستندات...","Search documents...")}
            value={search} onChange={e => setSearch(e.target.value)} className="ps-4 pe-10" />
        </div>
      </div>
      {loadingOld ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_,i) => <Card key={i}><CardContent className="p-6 h-32"><Skeleton className="h-full w-full" /></CardContent></Card>)}
        </div>
      ) : filteredOld.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="text-lg font-medium">{tx("لا توجد مستندات","No Documents")}</h3>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOld.map((doc: any) => (
            <Card key={doc.id} className="hover-elevate group cursor-pointer transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-secondary/10 rounded-lg text-secondary"><File className="h-6 w-6" /></div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {doc.fileUrl && (
                        <>
                          <DropdownMenuItem className="gap-2 cursor-pointer" asChild>
                            <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />{tx("فتح","Open")}
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" asChild>
                            <a href={doc.fileUrl} download={doc.fileName}>
                              <Download className="h-4 w-4" />{tx("تحميل","Download")}
                            </a>
                          </DropdownMenuItem>
                        </>
                      )}
                      {!doc.fileUrl && (
                        <DropdownMenuItem className="gap-2 cursor-pointer" disabled>
                          <Download className="h-4 w-4" />{tx("تحميل","Download")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 cursor-pointer text-primary focus:text-primary" onClick={() => setShareDoc(doc)} disabled={!doc.caseId}>
                        <Share2 className="h-4 w-4" />{tx("مشاركة مع العميل","Share with Client")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 cursor-pointer text-red-400 focus:text-red-400"
                        disabled={deleteMut.isPending}
                        onClick={() => handleDelete(doc)}>
                        {deleteMut.isPending && deleteMut.variables === String(doc.id)
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                        {tx("حذف","Delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h3 className="font-semibold text-base line-clamp-1">{doc.fileName}</h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs font-normal">{doc.fileType}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString(dateLocale)}</span>
                  {doc.fileSize && <span className="text-xs text-muted-foreground">{fmtSize(doc.fileSize)}</span>}
                </div>
                {doc.caseName && (
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    <span className="font-medium text-foreground">{tx("القضية:","Case:")}</span> {doc.caseName}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ── Inline folder name input ────────────────────────────────────────────── */
function FolderNameInput({ label, defaultValue = "", onSubmit, onCancel }: { label:string; defaultValue?:string; onSubmit:(n:string)=>void; onCancel:()=>void }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="flex gap-2 items-center">
      <Input
        value={val} autoFocus
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && val.trim()) onSubmit(val.trim()); if (e.key === "Escape") onCancel(); }}
        placeholder={label}
        className="h-8 text-sm flex-1"
      />
      <Button size="sm" className="h-8 px-3 text-xs font-bold shrink-0"
        style={{ background:"linear-gradient(135deg,#2563EB,#2563EB)", color:"#0D1626" }}
        disabled={!val.trim()} onClick={() => onSubmit(val.trim())}>
        حفظ
      </Button>
      <Button size="sm" variant="ghost" className="h-8 px-2 shrink-0" onClick={onCancel}>إلغاء</Button>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function Documents() {
  const [location] = useLocation();
  const { data: documents, isLoading: loadingOld } = useListDocuments();
  const [search, setSearch]             = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath]     = useState<Array<{id:string;name:string}>>([]);
  const [shareDoc, setShareDoc]         = useState<any>(null);
  const [moveFile, setMoveFile]         = useState<any>(null);
  const [uploadOpen, setUploadOpen]     = useState(false);

  useEffect(() => {
    if (location === "/documents/new" || location.endsWith("/documents/new")) {
      setUploadOpen(true);
    }
  }, [location]);
  const [newFolderParent, setNewFolderParent] = useState<string | null | "NONE">("NONE"); // "NONE"=hidden
  const [renameFolder, setRenameFolder] = useState<any>(null);
  const [permFolder, setPermFolder]     = useState<any>(null);
  const qc = useQueryClient();
  const { tx, dateLocale, dir } = useLang();

  const { data: allFolders = [], isLoading: loadingFolders } = useFolders();
  const folderTree = useMemo(() => buildTree(allFolders), [allFolders]);

  const { data: storageFiles = [], isLoading: loadingFiles, refetch: refetchFiles } =
    useStorageFiles(search, currentFolderId);

  const filteredOld = (documents ?? []).filter((d: any) =>
    !search || d.fileName?.toLowerCase().includes(search.toLowerCase()) || d.caseName?.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Folder mutations ── */
  const createFolderMut = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string | null }) =>
      fetch(`${BASE}/api/storage/folders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentId }) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      if (d?.error) { toast({ title: `❌ ${d.error}`, variant: "destructive" }); return; }
      qc.invalidateQueries({ queryKey: ["storage-folders"] });
      setNewFolderParent("NONE");
    },
  });

  const renameFolderMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      fetch(`${BASE}/api/storage/folders/${id}/rename`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      if (d?.error) { toast({ title: `❌ ${d.error}`, variant: "destructive" }); return; }
      qc.invalidateQueries({ queryKey: ["storage-folders"] }); setRenameFolder(null);
    },
  });

  const deleteFolderMut = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/api/storage/folders/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["storage-folders"] });
      qc.invalidateQueries({ queryKey: ["storage-files"] });
      if (currentFolderId === id) { setCurrentFolderId(null); setFolderPath([]); }
    },
  });

  /* Navigate to a folder with path tracking */
  const navigate = (id: string | null) => {
    setCurrentFolderId(id);
    setSearch("");
    if (id === null) { setFolderPath([]); return; }
    const folder = allFolders.find(f => f.id === id);
    if (!folder) return;
    // Build path by walking up
    const path: Array<{id:string;name:string}> = [];
    let cur: any = folder;
    while (cur) {
      path.unshift({ id: cur.id, name: cur.name });
      cur = cur.parent_id ? allFolders.find(f => f.id === cur.parent_id) : null;
    }
    setFolderPath(path);
  };

  const { toast } = useToast();

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tx("مكتبة المستندات","Document Library")}</h1>
          <p className="text-muted-foreground mt-1">{tx("إدارة جميع الملفات والمرفقات القانونية","Manage all legal files and attachments")}</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="hover-elevate gap-2"
          style={{ background:"linear-gradient(135deg,#2563EB,#2563EB)", color:"#0D1626" }}>
          <Upload className="h-4 w-4" />
          {tx("رفع مستند","Upload Document")}
        </Button>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="smart" dir={dir}>
        <TabsList className="mb-4">
          <TabsTrigger value="smart" className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            {tx("الملفات الذكية","Smart Files")}
          </TabsTrigger>
          <TabsTrigger value="legacy" className="gap-2">
            <FileText className="h-3.5 w-3.5" />
            {tx("مستندات القضايا","Case Documents")}
          </TabsTrigger>
        </TabsList>

        {/* ══ Smart Files Tab ══ */}
        <TabsContent value="smart">
          <div className="flex gap-4" dir="rtl">

            {/* ── Sidebar: Folder Tree ── */}
            <div className="w-52 shrink-0 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">المجلدات</span>
                <Button variant="ghost" size="icon" className="h-6 w-6"
                  title="مجلد جديد" onClick={() => setNewFolderParent(null)}>
                  <FolderPlus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* All files (root) */}
              <button
                onClick={() => navigate(null)}
                className={cn(
                  "w-full text-right flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                  currentFolderId === null ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted/40 text-foreground/80"
                )}>
                <Home className="h-4 w-4 shrink-0" />
                <span className="flex-1">كل الملفات</span>
                <span className="text-[10px] text-muted-foreground">{allFolders.reduce((s,f) => s+(f.file_count??0),0)}</span>
              </button>

              {/* New root folder input */}
              {newFolderParent === null && (
                <FolderNameInput label="اسم المجلد الجديد"
                  onSubmit={name => createFolderMut.mutate({ name, parentId: null })}
                  onCancel={() => setNewFolderParent("NONE")} />
              )}

              {/* Folder tree */}
              {loadingFolders ? (
                <div className="space-y-1.5">{[1,2,3].map(i => <Skeleton key={i} className="h-7 w-full rounded-lg" />)}</div>
              ) : (
                <FolderTree
                  tree={folderTree}
                  currentId={currentFolderId}
                  onNavigate={navigate}
                  onCreateSub={parentId => setNewFolderParent(parentId)}
                  onRename={setRenameFolder}
                  onPermissions={setPermFolder}
                  onDelete={f => {
                    if (confirm(`حذف المجلد "${f.name}"؟ سيتم نقل محتوياته للمجلد الأعلى.`))
                      deleteFolderMut.mutate(f.id);
                  }}
                />
              )}

              {/* Sub-folder new input (inside a folder) */}
              {newFolderParent !== "NONE" && newFolderParent !== null && (
                <FolderNameInput label="اسم المجلد الفرعي"
                  onSubmit={name => createFolderMut.mutate({ name, parentId: newFolderParent })}
                  onCancel={() => setNewFolderParent("NONE")} />
              )}

              {/* Rename input */}
              {renameFolder && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">إعادة تسمية:</p>
                  <FolderNameInput label="الاسم الجديد" defaultValue={renameFolder.name}
                    onSubmit={name => renameFolderMut.mutate({ id: renameFolder.id, name })}
                    onCancel={() => setRenameFolder(null)} />
                </div>
              )}
            </div>

            {/* ── Main Area ── */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Search + Breadcrumb row */}
              <div className="flex flex-col gap-2">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-sm flex-wrap" dir="rtl">
                  <button onClick={() => navigate(null)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <Home className="h-3.5 w-3.5" />
                    <span>الرئيسي</span>
                  </button>
                  {folderPath.map((seg, i) => (
                    <span key={seg.id} className="flex items-center gap-1">
                      <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <button
                        onClick={() => navigate(seg.id)}
                        className={cn(
                          "transition-colors",
                          i === folderPath.length - 1
                            ? "text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}>
                        {seg.name}
                      </button>
                    </span>
                  ))}
                </div>

                {/* Search + refresh */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder={tx("البحث في المستندات...","Search documents...")}
                      value={search} onChange={e => setSearch(e.target.value)}
                      className="ps-4 pe-10" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                    onClick={() => { qc.invalidateQueries({ queryKey: ["storage-files"] }); refetchFiles(); }}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 shrink-0"
                    onClick={() => { setNewFolderParent(currentFolderId); }}>
                    <FolderPlus className="h-3.5 w-3.5" />
                    مجلد جديد
                  </Button>
                </div>
              </div>

              {/* Sub-folders chips in current folder */}
              {!search && (() => {
                const subs = allFolders.filter(f => (f.parent_id ?? null) === currentFolderId);
                if (!subs.length) return null;
                return (
                  <div className="flex flex-wrap gap-2">
                    {subs.map(f => (
                      <button key={f.id}
                        onClick={() => navigate(f.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium">
                        <Folder className="h-4 w-4 text-primary/70" />
                        {f.name}
                        {f.file_count > 0 && (
                          <span className="text-[10px] px-1.5 rounded-full bg-muted text-muted-foreground">{f.file_count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Files grid */}
              {loadingFiles ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_,i) => (
                    <Card key={i}><CardContent className="p-6 h-36"><Skeleton className="h-full w-full" /></CardContent></Card>
                  ))}
                </div>
              ) : storageFiles.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-2xl border border-dashed">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.2)" }}>
                    {currentFolderId ? <Folder className="h-7 w-7" style={{ color:"#2563EB" }} /> : <Upload className="h-7 w-7" style={{ color:"#2563EB" }} />}
                  </div>
                  <h3 className="text-lg font-semibold mb-1">
                    {search ? tx("لا توجد نتائج","No matching results") : tx("هذا المجلد فارغ","This folder is empty")}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-5">
                    {!search && tx("ارفع ملفاً أو انقل ملفات موجودة إلى هذا المجلد","Upload a file or move existing files here")}
                  </p>
                  {!search && (
                    <Button onClick={() => setUploadOpen(true)} className="gap-2"
                      style={{ background:"linear-gradient(135deg,#2563EB,#2563EB)", color:"#0D1626" }}>
                      <Upload className="h-4 w-4" />
                      {tx("ارفع ملف","Upload file")}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {storageFiles.map((f: any) => (
                    <StorageFileCard key={f.id} file={f} folders={allFolders}
                      onShare={setShareDoc} onMove={setMoveFile} tx={tx} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══ Legacy Case Documents Tab ══ */}
        <TabsContent value="legacy">
          <LegacyDocTab filteredOld={filteredOld} loadingOld={loadingOld} search={search} setSearch={setSearch} setShareDoc={setShareDoc} tx={tx} dateLocale={dateLocale} qc={qc} />
        </TabsContent>
      </Tabs>

      {/* ── Smart Upload Dialog ── */}
      <AdaptiveDialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <AdaptiveDialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background:"rgba(201,168,76,0.15)", border:"1px solid rgba(201,168,76,0.25)" }}>
                <Upload className="h-4 w-4" style={{ color:"#2563EB" }} />
              </div>
              {tx("رافع الملفات الذكي","Smart File Uploader")}
            </DialogTitle>
            <DialogDescription className="text-right">
              {tx("ارفع مستنداتك — سيقوم الذكاء الاصطناعي بتحليلها","Upload your documents — AI will analyze them automatically")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <SmartUploader
              onSuccess={(files) => {
                qc.invalidateQueries({ queryKey: ["storage-files"] });
                refetchFiles();
                setTimeout(() => setUploadOpen(false), 1800);
              }}
            />
          </div>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* ── Share Dialog ── */}
      <ShareDialog doc={shareDoc} open={!!shareDoc} onClose={() => setShareDoc(null)} tx={tx} dir={dir} />

      {/* ── Move to Folder Dialog ── */}
      {moveFile && (
        <MoveDialog file={moveFile} folders={allFolders} open={!!moveFile} onClose={() => setMoveFile(null)} />
      )}

      {/* ── Folder Permissions Dialog ── */}
      {permFolder && (
        <FolderPermissionsDialog
          folder={permFolder}
          open={!!permFolder}
          onClose={() => setPermFolder(null)}
        />
      )}
    </div>
  );
}
