import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Search, Building2, User, Landmark, Mail, Phone,
  Loader2, Trash2, Edit3, MoreHorizontal, TrendingUp, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CLIENT_TYPES = [
  { value: "individual", label: "فرد", icon: User, color: "#6366F1" },
  { value: "company", label: "شركة", icon: Building2, color: "#10B981" },
  { value: "government", label: "جهة حكومية", icon: Landmark, color: "#F59E0B" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "نشط", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  inactive: { label: "غير نشط", color: "bg-muted text-muted-foreground border-border" },
  potential: { label: "محتمل", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
};

const SOURCES = [
  { value: "direct", label: "مباشر" },
  { value: "referral", label: "إحالة" },
  { value: "website", label: "الموقع" },
  { value: "marketplace", label: "السوق الإلكتروني" },
  { value: "other", label: "أخرى" },
];

const EMPTY_FORM = { fullName: "", type: "individual", email: "", phone: "", company: "", nationalId: "", notes: "", status: "active", source: "direct" };

function ClientCard({ client, onEdit, onDelete }: any) {
  const typeConfig = CLIENT_TYPES.find(t => t.value === client.type) ?? CLIENT_TYPES[0];
  const statusConfig = STATUS_CONFIG[client.status] ?? STATUS_CONFIG.active;
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
                <DropdownMenuItem onClick={() => onEdit(client)}><Edit3 className="h-4 w-4 ml-2" /> تعديل</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(client.id)} className="text-red-400"><Trash2 className="h-4 w-4 ml-2" /> حذف</DropdownMenuItem>
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
          <span>مصدر: {SOURCES.find(s => s.value === client.source)?.label ?? client.source}</span>
        </div>
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
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery<any[]>({
    queryKey: ["clients"],
    queryFn: () => fetch("/api/clients").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); closeForm(); toast({ title: "تم إضافة العميل" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => fetch(`/api/clients/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); closeForm(); toast({ title: "تم التحديث" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast({ title: "تم الحذف" }); },
  });

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
    total: clients.length,
    active: clients.filter(c => c.status === "active").length,
    companies: clients.filter(c => c.type === "company").length,
    potential: clients.filter(c => c.status === "potential").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">إدارة العملاء</h1>
          <p className="text-muted-foreground text-sm">قاعدة بيانات عملائك الكاملة</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> عميل جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "إجمالي العملاء", value: stats.total, icon: Users, color: "#6366F1" },
          { label: "عملاء نشطون", value: stats.active, icon: Star, color: "#10B981" },
          { label: "شركات", value: stats.companies, icon: Building2, color: "#F59E0B" },
          { label: "عملاء محتملون", value: stats.potential, icon: TrendingUp, color: "#3B82F6" },
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
          <Input placeholder="بحث بالاسم أو البريد أو الشركة..." className="pr-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأنواع</SelectItem>
            {CLIENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
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
          <p>لا يوجد عملاء — أضف عميلك الأول</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => <ClientCard key={c.id} client={c} onEdit={openEdit} onDelete={(id: string) => deleteMutation.mutate(id)} />)}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "تعديل العميل" : "إضافة عميل جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>الاسم الكامل *</Label><Input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} placeholder="اسم العميل أو الشركة" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>النوع</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CLIENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>الحالة</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>رقم الجوال</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="05xxxxxxxx" /></div>
            </div>
            {form.type === "company" && <div><Label>اسم الشركة</Label><Input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} /></div>}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>رقم الهوية/السجل</Label><Input value={form.nationalId} onChange={e => setForm(p => ({ ...p, nationalId: e.target.value }))} /></div>
              <div><Label>مصدر العميل</Label>
                <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="resize-none min-h-[70px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={!form.fullName || createMutation.isPending || updateMutation.isPending} className="gap-2">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "حفظ التعديلات" : "إضافة العميل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
