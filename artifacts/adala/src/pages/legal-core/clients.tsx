/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users, Plus, Search, Building2, User, Landmark, Mail, Phone,
  Loader2, Trash2, Edit3, MoreHorizontal, TrendingUp, Star, ChevronLeft, Upload
} from "lucide-react";
import { ImportDialog } from "@/components/import-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/use-lang";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const EMPTY_FORM = { fullName: "", type: "individual", email: "", phone: "", company: "", nationalId: "", notes: "", status: "active", source: "direct" };

function ClientCard({ client, onEdit, onDelete, tx, dir }: any) {
  const CLIENT_TYPES_LOCAL = [
    { value: "individual", label: tx("فرد", "Individual"), icon: User, color: "#6366F1" },
    { value: "company",    label: tx("شركة", "Company"),   icon: Building2, color: "#10B981" },
    { value: "government", label: tx("جهة حكومية", "Government"), icon: Landmark, color: "#F59E0B" },
  ];
  const STATUS_CONFIG_LOCAL: Record<string, { label: string; color: string }> = {
    active:    { label: tx("نشط", "Active"),      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
    inactive:  { label: tx("غير نشط", "Inactive"), color: "bg-muted text-muted-foreground border-border" },
    potential: { label: tx("محتمل", "Potential"),  color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  };
  const SOURCES_LOCAL = [
    { value: "direct",      label: tx("مباشر", "Direct") },
    { value: "referral",    label: tx("إحالة", "Referral") },
    { value: "website",     label: tx("الموقع", "Website") },
    { value: "marketplace", label: tx("السوق الإلكتروني", "Marketplace") },
    { value: "other",       label: tx("أخرى", "Other") },
  ];

  const typeConfig = CLIENT_TYPES_LOCAL.find(t => t.value === client.type) ?? CLIENT_TYPES_LOCAL[0];
  const statusConfig = STATUS_CONFIG_LOCAL[client.status] ?? STATUS_CONFIG_LOCAL.active;
  const TypeIcon = typeConfig.icon;

  return (
    <Card className="hover:border-primary/30 transition-all group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${typeConfig.color}18` }}>
              <TypeIcon className="h-5 w-5" style={{ color: typeConfig.color }} />
            </div>
            <div>
              <h3 className="font-bold leading-tight">{client.fullName}</h3>
              {client.company && <p className="text-xs text-muted-foreground">{client.company}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("text-[10px] px-2 py-0 border", statusConfig.color)}>{statusConfig.label}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onEdit(client)}><Edit3 className="h-4 w-4 ms-2" /> {tx("تعديل", "Edit")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(client.id)} className="text-red-400"><Trash2 className="h-4 w-4 ms-2" /> {tx("حذف", "Delete")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-1.5">
          {client.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
        </div>

        {client.notes && (
          <p className="text-xs text-muted-foreground mt-3 line-clamp-2 border-t border-border/50 pt-2">{client.notes}</p>
        )}

        <div className="mt-3 pt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{typeConfig.label}</span>
          <span>{tx("مصدر:", "Source:")} {SOURCES_LOCAL.find(s => s.value === client.source)?.label ?? client.source}</span>
        </div>

        <Link href={`/clients/${client.id}`} onClick={(e: any) => e.stopPropagation()}>
          <div className="mt-3 flex items-center justify-center gap-1 text-xs text-primary/70 hover:text-primary border border-primary/20 hover:border-primary/50 rounded-lg py-1.5 transition-colors">
            <span>{tx("عرض الملف الكامل", "View Full Profile")}</span>
            <ChevronLeft className="h-3 w-3" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function Clients() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { tx, dir } = useLang();

  const CLIENT_TYPES = [
    { value: "individual", label: tx("فرد", "Individual"),           icon: User,      color: "#6366F1" },
    { value: "company",    label: tx("شركة", "Company"),             icon: Building2, color: "#10B981" },
    { value: "government", label: tx("جهة حكومية", "Government"),    icon: Landmark,  color: "#F59E0B" },
  ];
  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    active:    { label: tx("نشط", "Active"),       color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
    inactive:  { label: tx("غير نشط", "Inactive"), color: "bg-muted text-muted-foreground border-border" },
    potential: { label: tx("محتمل", "Potential"),  color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  };
  const SOURCES = [
    { value: "direct",      label: tx("مباشر", "Direct") },
    { value: "referral",    label: tx("إحالة", "Referral") },
    { value: "website",     label: tx("الموقع", "Website") },
    { value: "marketplace", label: tx("السوق الإلكتروني", "Marketplace") },
    { value: "other",       label: tx("أخرى", "Other") },
  ];

  const { data: clients = [], isLoading } = useQuery<any[]>({
    queryKey: ["clients"],
    queryFn: () => authFetch(`${BASE}/api/clients`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => authFetch(`${BASE}/api/clients`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); closeForm(); toast({ title: tx("تم إضافة العميل", "Client added") }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => authFetch(`${BASE}/api/clients/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); closeForm(); toast({ title: tx("تم التحديث", "Updated") }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authFetch(`${BASE}/api/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast({ title: tx("تم حذف العميل", "Client deleted") }); },
    onError: () => toast({ title: tx("خطأ في الحذف", "Delete failed"), variant: "destructive" }),
  });

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(tx(`هل تريد حذف العميل "${name}" نهائياً؟`, `Delete client "${name}" permanently?`))) return;
    deleteMutation.mutate(id);
  };

  const openEdit = (client: any) => { setEditing(client); setForm({ ...client }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSubmit = () => {
    if (!form.fullName) return;
    if (editing) updateMutation.mutate({ ...form, id: editing.id });
    else createMutation.mutate(form);
  };

  const filtered = clients.filter(c =>
    (typeFilter === "all" || c.type === typeFilter) &&
    (statusFilter === "all" || c.status === statusFilter) &&
    (c.fullName.includes(search) || c.email?.includes(search) || c.company?.includes(search) || !search)
  );

  const stats = {
    total:     clients.length,
    active:    clients.filter(c => c.status === "active").length,
    companies: clients.filter(c => c.type === "company").length,
    potential: clients.filter(c => c.status === "potential").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">{tx("إدارة العملاء", "Client Management")}</h1>
          <p className="text-muted-foreground text-sm">{tx("قاعدة بيانات عملائك الكاملة", "Your complete client database")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5 text-sm">
            <Upload className="h-4 w-4" /> {tx("استيراد CSV", "Import CSV")}
          </Button>
          <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> {tx("عميل جديد", "New Client")}
          </Button>
        </div>
      </div>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} type="clients" queryKey={["clients"]} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: tx("إجمالي العملاء", "Total Clients"),    value: stats.total,     icon: Users,      color: "#6366F1" },
          { label: tx("عملاء نشطون", "Active Clients"),      value: stats.active,    icon: Star,       color: "#10B981" },
          { label: tx("شركات", "Companies"),                  value: stats.companies, icon: Building2,  color: "#F59E0B" },
          { label: tx("عملاء محتملون", "Potential Clients"),  value: stats.potential, icon: TrendingUp, color: "#3B82F6" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}18` }}>
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={tx("بحث بالاسم أو البريد أو الشركة...", "Search by name, email or company...")} className="pe-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder={tx("النوع", "Type")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tx("جميع الأنواع", "All Types")}</SelectItem>
            {CLIENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder={tx("الحالة", "Status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tx("جميع الحالات", "All Statuses")}</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{tx("لا يوجد عملاء — أضف عميلك الأول", "No clients — add your first client")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => <ClientCard key={c.id} client={c} onEdit={openEdit} onDelete={(id: string) => handleDelete(id, c.fullName)} tx={tx} dir={dir} />)}
        </div>
      )}

      {/* Form Dialog (AdaptiveDialog → BottomSheet on mobile) */}
      <AdaptiveDialog open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <AdaptiveDialogContent className="max-w-md" dir={dir} size="lg">
          <DialogHeader><DialogTitle>{editing ? tx("تعديل العميل", "Edit Client") : tx("إضافة عميل جديد", "Add New Client")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{tx("الاسم الكامل *", "Full Name *")}</Label><Input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} placeholder={tx("اسم العميل أو الشركة", "Client or company name")} /></div>
            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div><Label>{tx("النوع", "Type")}</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CLIENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{tx("الحالة", "Status")}</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div><Label>{tx("البريد الإلكتروني", "Email")}</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>{tx("رقم الجوال", "Phone")}</Label><Input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="05xxxxxxxx" /></div>
            </div>
            {form.type === "company" && <div><Label>{tx("اسم الشركة", "Company Name")}</Label><Input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} /></div>}
            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div><Label>{tx("رقم الهوية/السجل", "ID / Registration")}</Label><Input value={form.nationalId} onChange={e => setForm(p => ({ ...p, nationalId: e.target.value }))} /></div>
              <div><Label>{tx("مصدر العميل", "Client Source")}</Label>
                <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{tx("ملاحظات", "Notes")}</Label><Textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="resize-none min-h-[70px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>{tx("إلغاء", "Cancel")}</Button>
            <Button onClick={handleSubmit} disabled={!form.fullName || createMutation.isPending || updateMutation.isPending} className="gap-2">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? tx("حفظ التعديلات", "Save Changes") : tx("إضافة العميل", "Add Client")}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}
