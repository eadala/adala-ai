import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight, User, Building2, Landmark, Mail, Phone,
  Scale, Receipt, Handshake, CalendarDays, Loader2,
  TrendingUp, DollarSign, AlertCircle, ExternalLink,
  MessageSquare, Activity, CheckCircle2, Clock, FileText,
  UserPlus, SmartphoneIcon, CheckCircle, XCircle
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  individual: { label: "فرد",            icon: User,      color: "#6366F1" },
  company:    { label: "شركة",           icon: Building2, color: "#10B981" },
  government: { label: "جهة حكومية",    icon: Landmark,  color: "#F59E0B" },
};

const CASE_STATUS: Record<string, { label: string; color: string }> = {
  open:        { label: "مفتوحة",      color: "bg-blue-500/15 text-blue-400" },
  in_progress: { label: "قيد التنفيذ", color: "bg-amber-500/15 text-amber-400" },
  closed:      { label: "مغلقة",       color: "bg-slate-500/15 text-slate-400" },
};

const INV_STATUS: Record<string, { label: string; color: string }> = {
  draft:   { label: "مسودة",  color: "bg-slate-500/15 text-slate-400" },
  sent:    { label: "مُرسَلة", color: "bg-blue-500/15 text-blue-400" },
  paid:    { label: "مدفوعة", color: "bg-emerald-500/15 text-emerald-400" },
  overdue: { label: "متأخرة", color: "bg-red-500/15 text-red-400" },
};

const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: "مسودة",  color: "bg-slate-500/15 text-slate-400" },
  active:    { label: "نشط",    color: "bg-emerald-500/15 text-emerald-400" },
  expired:   { label: "منتهي", color: "bg-red-500/15 text-red-400" },
  cancelled: { label: "ملغى",   color: "bg-orange-500/15 text-orange-400" },
};

const ACTIVITY_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  client_created:   { icon: UserPlus,      color: "text-violet-400",  bg: "bg-violet-500/15" },
  case_created:     { icon: Scale,         color: "text-blue-400",    bg: "bg-blue-500/15" },
  invoice_created:  { icon: Receipt,       color: "text-amber-400",   bg: "bg-amber-500/15" },
  contract_created: { icon: Handshake,     color: "text-emerald-400", bg: "bg-emerald-500/15" },
  event_scheduled:  { icon: CalendarDays,  color: "text-pink-400",    bg: "bg-pink-500/15" },
};

function useClientOverview(id: string) {
  return useQuery<{
    client: any;
    cases: any[];
    invoices: any[];
    contracts: any[];
    events: any[];
    messages: any[];
    activities: any[];
    stats: {
      casesCount: number;
      invoicesCount: number;
      paidTotal: number;
      outstandingTotal: number;
      contractsCount: number;
    };
  }>({
    queryKey: ["client-overview", id],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/clients/${id}/overview`);
      if (!r.ok) throw new Error("not found");
      return r.json();
    },
    enabled: !!id,
  });
}

export default function ClientDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const { data, isLoading, error } = useClientOverview(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
        <p>تعذّر تحميل بيانات العميل.</p>
        <Link href="/clients"><Button variant="outline" className="mt-4">عودة للعملاء</Button></Link>
      </div>
    );
  }

  const { client, cases, invoices, contracts, events, messages = [], activities = [], stats } = data;

  const { data: waLogs = [] } = useQuery<any[]>({
    queryKey: ["whatsapp-logs-client", client.phone],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/whatsapp/logs`);
      if (!r.ok) return [];
      const all = await r.json();
      if (!client.phone) return [];
      const normalized = client.phone.replace(/\D/g, "");
      return all.filter((l: any) => l.to_number?.replace(/\D/g, "")?.includes(normalized));
    },
    enabled: !!client.phone,
  });
  const typeInfo = TYPE_LABELS[client.type] ?? TYPE_LABELS.individual;
  const TypeIcon = typeInfo.icon;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Link href="/clients">
          <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${typeInfo.color}18` }}
            >
              <TypeIcon className="h-5 w-5" style={{ color: typeInfo.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold leading-tight">{client.fullName}</h1>
                <Badge variant="outline" className="text-xs">{typeInfo.label}</Badge>
                {client.status && (
                  <Badge className={`text-xs px-2 ${client.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                    {client.status === "active" ? "نشط" : client.status === "potential" ? "محتمل" : "غير نشط"}
                  </Badge>
                )}
              </div>
              {client.company && <p className="text-xs text-muted-foreground mt-0.5">{client.company}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
            {client.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />{client.email}
              </span>
            )}
            {client.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />{client.phone}
              </span>
            )}
            {client.nationalId && (
              <span className="flex items-center gap-1.5 text-xs">
                <User className="h-3.5 w-3.5" />هوية: {client.nationalId}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="القضايا"
          value={stats.casesCount}
          icon={<Scale className="h-5 w-5 text-blue-400" />}
          sub={`${cases.filter(c => c.status === "open").length} مفتوحة`}
        />
        <KpiCard
          label="الإيرادات المحصّلة"
          value={`${stats.paidTotal.toLocaleString()} ر.س`}
          icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
          sub={`${stats.invoicesCount} فاتورة`}
        />
        <KpiCard
          label="المستحق"
          value={`${stats.outstandingTotal.toLocaleString()} ر.س`}
          icon={<DollarSign className="h-5 w-5 text-amber-400" />}
          sub="فواتير مرسلة/متأخرة"
        />
        <KpiCard
          label="العقود"
          value={stats.contractsCount}
          icon={<Handshake className="h-5 w-5 text-violet-400" />}
          sub={`${contracts.filter(c => c.status === "active").length} نشط`}
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="cases" dir="rtl">
        <TabsList className="grid w-full grid-cols-7 h-9">
          <TabsTrigger value="cases" className="text-xs px-2">
            <Scale className="h-3.5 w-3.5 ml-1 hidden sm:block" />القضايا
            {cases.length > 0 && <span className="mr-1 text-[10px] bg-blue-500/20 text-blue-400 rounded px-1">{cases.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs px-2">
            <Receipt className="h-3.5 w-3.5 ml-1 hidden sm:block" />الفواتير
            {invoices.length > 0 && <span className="mr-1 text-[10px] bg-amber-500/20 text-amber-400 rounded px-1">{invoices.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="contracts" className="text-xs px-2">
            <Handshake className="h-3.5 w-3.5 ml-1 hidden sm:block" />العقود
            {contracts.length > 0 && <span className="mr-1 text-[10px] bg-violet-500/20 text-violet-400 rounded px-1">{contracts.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs px-2">
            <CalendarDays className="h-3.5 w-3.5 ml-1 hidden sm:block" />المواعيد
            {events.length > 0 && <span className="mr-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1">{events.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="messages" className="text-xs px-2">
            <MessageSquare className="h-3.5 w-3.5 ml-1 hidden sm:block" />المراسلات
            {messages.length > 0 && <span className="mr-1 text-[10px] bg-blue-500/20 text-blue-400 rounded px-1">{messages.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="activities" className="text-xs px-2">
            <Activity className="h-3.5 w-3.5 ml-1 hidden sm:block" />النشاطات
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs px-2">
            <SmartphoneIcon className="h-3.5 w-3.5 ml-1 hidden sm:block" />واتساب
            {waLogs.length > 0 && <span className="mr-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1">{waLogs.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* CASES TAB */}
        <TabsContent value="cases" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">القضايا</CardTitle>
              <Link href="/cases">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />كل القضايا
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {cases.length === 0 ? (
                <EmptyTab icon={<Scale />} label="لا توجد قضايا لهذا العميل" />
              ) : (
                <div className="space-y-2">
                  {cases.map((c: any) => {
                    const st = CASE_STATUS[c.status] ?? CASE_STATUS.open;
                    return (
                      <Link key={c.id} href={`/cases/${c.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Scale className="h-4 w-4 text-blue-400" />
                            <div>
                              <p className="text-sm font-medium">{c.title}</p>
                              <p className="text-xs text-muted-foreground">{c.case_type || c.caseType}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] px-2 ${st.color}`}>{st.label}</Badge>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVOICES TAB */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">الفواتير</CardTitle>
              <Link href="/invoices">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />كل الفواتير
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <EmptyTab icon={<Receipt />} label="لا توجد فواتير لهذا العميل" />
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv: any) => {
                    const st = INV_STATUS[inv.status] ?? INV_STATUS.draft;
                    return (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Receipt className="h-4 w-4 text-amber-400" />
                          <div>
                            <p className="text-sm font-medium">{inv.title}</p>
                            <p className="text-xs text-muted-foreground">{inv.invoice_number}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={`text-[10px] px-2 ${st.color}`}>{st.label}</Badge>
                          <span className="text-sm font-bold">{Number(inv.total).toLocaleString()} ر.س</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTRACTS TAB */}
        <TabsContent value="contracts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">العقود</CardTitle>
              <Link href="/contracts">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />كل العقود
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <EmptyTab icon={<Handshake />} label="لا توجد عقود لهذا العميل" />
              ) : (
                <div className="space-y-2">
                  {contracts.map((c: any) => {
                    const st = CONTRACT_STATUS[c.status] ?? CONTRACT_STATUS.draft;
                    return (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Handshake className="h-4 w-4 text-violet-400" />
                          <div>
                            <p className="text-sm font-medium">{c.title}</p>
                            <p className="text-xs text-muted-foreground">{c.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] px-2 ${st.color}`}>{st.label}</Badge>
                          {c.expires_at && <p className="text-xs text-muted-foreground">{new Date(c.expires_at).toLocaleDateString("ar-EG")}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SESSIONS TAB */}
        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">المواعيد والجلسات</CardTitle>
              <Link href="/calendar">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />فتح التقويم
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <EmptyTab icon={<CalendarDays />} label="لا توجد مواعيد لهذا العميل" />
              ) : (
                <div className="space-y-2">
                  {events.map((ev: any) => {
                    const isPast = new Date(ev.start_at) < new Date();
                    return (
                      <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPast ? "bg-slate-500/15" : "bg-emerald-500/15"}`}>
                            <CalendarDays className={`h-4 w-4 ${isPast ? "text-slate-400" : "text-emerald-400"}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{ev.title}</p>
                            <p className="text-xs text-muted-foreground">{ev.event_type}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(ev.start_at).toLocaleDateString("ar-EG")}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MESSAGES TAB */}
        <TabsContent value="messages" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">المراسلات المرتبطة</CardTitle>
              <Link href="/messages">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />كل المراسلات
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <EmptyTab icon={<MessageSquare />} label="لا توجد مراسلات مرتبطة بهذا العميل" />
              ) : (
                <div className="space-y-2">
                  {messages.map((msg: any) => (
                    <div key={msg.id} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-blue-400 flex-shrink-0" />
                          <p className="text-sm font-medium">{msg.subject}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex-shrink-0">
                          {new Date(msg.created_at).toLocaleDateString("ar-EG")}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mr-6">{msg.body}</p>
                      {msg.sender_name && (
                        <p className="text-[11px] text-muted-foreground mt-1 mr-6">
                          من: {msg.sender_name}
                          {msg.sender_ip && <span className="mr-2 opacity-60">IP: {msg.sender_ip}</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WHATSAPP LOGS TAB */}
        <TabsContent value="whatsapp" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <SmartphoneIcon className="h-4 w-4 text-emerald-400" />
                سجل رسائل واتساب
              </CardTitle>
              {!client.phone && (
                <span className="text-xs text-muted-foreground">لا يوجد رقم هاتف مسجّل لهذا العميل</span>
              )}
            </CardHeader>
            <CardContent>
              {waLogs.length === 0 ? (
                <EmptyTab icon={<SmartphoneIcon />} label={client.phone ? "لا توجد رسائل واتساب مرسلة لهذا العميل" : "أضف رقم هاتف للعميل لتتبع رسائل واتساب"} />
              ) : (
                <div className="space-y-2">
                  {waLogs.map((log: any) => (
                    <div key={log.id} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {log.status === "sent"
                            ? <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                            : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
                          <span className="text-xs font-medium">{log.to_number}</span>
                          {log.template && <span className="text-[10px] bg-emerald-500/15 text-emerald-400 rounded px-1.5 py-0.5">{log.template}</span>}
                        </div>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">
                          {new Date(log.sent_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mr-6">{log.message}</p>
                      {log.error && <p className="text-[11px] text-red-400 mt-1 mr-6">{log.error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITIES TIMELINE TAB */}
        <TabsContent value="activities" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-gold" />
                سجل النشاطات
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <EmptyTab icon={<Activity />} label="لا توجد نشاطات مسجّلة" />
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute right-4 top-4 bottom-4 w-px bg-border" />
                  <div className="space-y-1">
                    {activities.map((act: any, idx: number) => {
                      const meta = ACTIVITY_ICONS[act.type] ?? ACTIVITY_ICONS.case_created;
                      const Icon = meta.icon;
                      return (
                        <div key={idx} className="flex items-start gap-4 pr-8 relative">
                          {/* Dot */}
                          <div className={`absolute right-2 top-3 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${meta.bg}`}>
                            <Icon className={`h-3 w-3 ${meta.color}`} />
                          </div>
                          {/* Content */}
                          <div className="flex-1 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm">{act.label}</p>
                              <span className="text-[11px] text-muted-foreground flex-shrink-0 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(act.date).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            {act.status && (
                              <Badge className={`text-[10px] px-1.5 mt-1 ${INV_STATUS[act.status]?.color ?? "bg-slate-500/15 text-slate-400"}`}>
                                {INV_STATUS[act.status]?.label ?? act.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {client.notes && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">ملاحظات</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{client.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, sub }: { label: string; value: string | number; icon: React.ReactNode; sub: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        {icon}
        <span className="text-xl font-bold">{value}</span>
      </div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}

function EmptyTab({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
      <div className="opacity-20 [&>*]:h-10 [&>*]:w-10">{icon}</div>
      <p className="text-sm">{label}</p>
    </div>
  );
}
