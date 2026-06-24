import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight, User, Building2, Landmark, Mail, Phone,
  Scale, Receipt, Handshake, CalendarDays, Loader2,
  TrendingUp, DollarSign, AlertCircle, ExternalLink,
  MessageSquare, Activity, CheckCircle2, Clock, FileText,
  UserPlus, SmartphoneIcon, CheckCircle, XCircle,
  TrendingDown, BarChart3, Printer, ArrowUpRight, ArrowDownRight,
  Sparkles, Bot, Brain, RefreshCw, Copy,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  individual: { label: "فرد",            icon: User,      color: "#6366F1" },
  company:    { label: "شركة",           icon: Building2, color: "#10B981" },
  government: { label: "جهة حكومية",    icon: Landmark,  color: "#F59E0B" },
};

const CASE_STATUS: Record<string, { label: string; color: string }> = {
  open:        { label: "مفتوحة",      color: "bg-blue-500/15 text-blue-400" },
  in_progress: { label: "قيد التنفيذ", color: "bg-amber-500/15 text-amber-400" },
  closed:      { label: "مغلقة",       color: "bg-muted/30 15 text-muted-foreground" },
};

const INV_STATUS: Record<string, { label: string; color: string }> = {
  draft:   { label: "مسودة",  color: "bg-muted/30 15 text-muted-foreground" },
  sent:    { label: "مُرسَلة", color: "bg-blue-500/15 text-blue-400" },
  paid:    { label: "مدفوعة", color: "bg-emerald-500/15 text-emerald-400" },
  overdue: { label: "متأخرة", color: "bg-red-500/15 text-red-400" },
};

const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: "مسودة",  color: "bg-muted/30 15 text-muted-foreground" },
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

  /* waLogs must be declared before any early returns to satisfy rules-of-hooks */
  const clientPhone = (data as any)?.client?.phone as string | undefined;
  const { data: waLogs = [] } = useQuery<any[]>({
    queryKey: ["whatsapp-logs-client", clientPhone],
    queryFn: async () => {
      if (!clientPhone) return [];
      const r = await fetch(`${BASE}/api/whatsapp/logs`);
      if (!r.ok) return [];
      const all = await r.json();
      const normalized = clientPhone.replace(/\D/g, "");
      return all.filter((l: any) => l.to_number?.replace(/\D/g, "")?.includes(normalized));
    },
    enabled: !!clientPhone,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                  <Badge className={`text-xs px-2 ${client.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/30 15 text-muted-foreground"}`}>
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
        <TabsList className="flex w-full overflow-x-auto h-9 justify-start">
          <TabsTrigger value="cases" className="text-xs px-1.5">
            <Scale className="h-3.5 w-3.5 ms-1 hidden sm:block" />القضايا
            {cases.length > 0 && <span className="me-1 text-[10px] bg-blue-500/20 text-blue-400 rounded px-1">{cases.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs px-1.5">
            <Receipt className="h-3.5 w-3.5 ms-1 hidden sm:block" />الفواتير
            {invoices.length > 0 && <span className="me-1 text-[10px] bg-amber-500/20 text-amber-400 rounded px-1">{invoices.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="accounting" className="text-xs px-1.5">
            <BarChart3 className="h-3.5 w-3.5 ms-1 hidden sm:block" />
            <span className="text-primary">المالية</span>
          </TabsTrigger>
          <TabsTrigger value="contracts" className="text-xs px-1.5">
            <Handshake className="h-3.5 w-3.5 ms-1 hidden sm:block" />العقود
            {contracts.length > 0 && <span className="me-1 text-[10px] bg-violet-500/20 text-violet-400 rounded px-1">{contracts.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs px-1.5">
            <CalendarDays className="h-3.5 w-3.5 ms-1 hidden sm:block" />المواعيد
            {events.length > 0 && <span className="me-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1">{events.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="messages" className="text-xs px-1.5">
            <MessageSquare className="h-3.5 w-3.5 ms-1 hidden sm:block" />المراسلات
            {messages.length > 0 && <span className="me-1 text-[10px] bg-blue-500/20 text-blue-400 rounded px-1">{messages.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="activities" className="text-xs px-1.5">
            <Activity className="h-3.5 w-3.5 ms-1 hidden sm:block" />النشاطات
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs px-1.5">
            <SmartphoneIcon className="h-3.5 w-3.5 ms-1 hidden sm:block" />واتساب
            {waLogs.length > 0 && <span className="me-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1">{waLogs.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs px-1.5">
            <Sparkles className="h-3.5 w-3.5 ms-1" style={{ color: "#2563EB" }} />
            <span style={{ color: "#2563EB" }}>AI</span>
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

        {/* ACCOUNTING TAB */}
        <TabsContent value="accounting" className="mt-4">
          <ClientAccountingTab clientId={id} />
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
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPast ? "bg-muted/30 15" : "bg-emerald-500/15"}`}>
                            <CalendarDays className={`h-4 w-4 ${isPast ? "text-muted-foreground" : "text-emerald-400"}`} />
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
                      <p className="text-xs text-muted-foreground line-clamp-2 me-6">{msg.body}</p>
                      {msg.sender_name && (
                        <p className="text-[11px] text-muted-foreground mt-1 me-6">
                          من: {msg.sender_name}
                          {msg.sender_ip && <span className="me-2 opacity-60">IP: {msg.sender_ip}</span>}
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
                      <p className="text-xs text-muted-foreground line-clamp-2 me-6">{log.message}</p>
                      {log.error && <p className="text-[11px] text-red-400 mt-1 me-6">{log.error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI INSIGHTS TAB ── */}
        <TabsContent value="ai" className="mt-4">
          <ClientAIInsights client={client} cases={cases} invoices={invoices} contracts={contracts} />
        </TabsContent>

        {/* ACTIVITIES TIMELINE TAB */}
        <TabsContent value="activities" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
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
                        <div key={idx} className="flex items-start gap-4 pe-8 relative">
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
                              <Badge className={`text-[10px] px-1.5 mt-1 ${INV_STATUS[act.status]?.color ?? "bg-muted/30 15 text-muted-foreground"}`}>
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

/* ─── Client Accounting Tab ──────────────────────────────────────────────── */
const PERIOD_TYPES = [
  { value: "annual",    label: "سنوي" },
  { value: "semi",      label: "نصف سنوي" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "monthly",   label: "شهري" },
];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

function fmtSAR(n: number) {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 2 }) + " ر.س";
}

function StatRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${color ?? "text-foreground"}`}>{fmtSAR(value)}</span>
    </div>
  );
}

function ClientAccountingTab({ clientId }: { clientId: string }) {
  const [period, setPeriod] = useState("annual");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));

  const { data, isLoading } = useQuery<any>({
    queryKey: ["client-accounting", clientId, period, year, month],
    queryFn: () => {
      const params = new URLSearchParams({ period, year, month });
      return fetch(`${BASE}/api/clients/${clientId}/accounting?${params}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); });
    },
    enabled: !!clientId,
  });

  const acc = data?.accounting ?? {};
  const fs = data?.financialStatements ?? {};
  const monthly = data?.monthly ?? [];
  const lbl = data?.period?.label ?? "";

  const hasData = (acc.revenue ?? 0) > 0 || (acc.receivables ?? 0) > 0;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">التقارير المالية للعميل</span>
              {lbl && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{lbl}</Badge>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-8 text-xs w-[80px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              {(period === "monthly" || period === "quarterly" || period === "semi") && (
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS_AR.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 print:hidden" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> طباعة
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "الإيرادات المحصّلة", value: acc.revenue ?? 0, icon: TrendingUp, color: "#10B981", trend: true },
              { label: "المستحقات",           value: acc.receivables ?? 0, icon: AlertCircle, color: "#F59E0B", trend: null },
              { label: "المصاريف",           value: acc.expenses ?? 0, icon: TrendingDown, color: "#EF4444", trend: false },
              { label: "صافي الربح",         value: acc.netProfit ?? 0, icon: DollarSign, color: (acc.netProfit ?? 0) >= 0 ? "#2563EB" : "#EF4444", trend: null },
            ].map(k => (
              <Card key={k.label} className="border-0 bg-card/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: k.color + "18" }}>
                      <k.icon className="h-4 w-4" style={{ color: k.color }} />
                    </div>
                    {k.trend !== null && (
                      k.trend
                        ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                        : <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                    )}
                  </div>
                  <div className="text-lg font-black tabular-nums leading-tight" style={{ color: k.color }}>
                    {fmtSAR(k.value)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{k.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart */}
          {monthly.some((m: any) => m.revenue > 0 || m.receivables > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">الإيرادات الشهرية — {year}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthly} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} width={55} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "ك" : v} />
                    <Tooltip
                      contentStyle={{ background: "#1a2744", border: "1px solid #2d3d6b", borderRadius: "8px", fontSize: "11px", direction: "rtl" }}
                      formatter={(v: any) => [fmtSAR(Number(v)), ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="revenue"     name="محصّلة"    fill="#10B981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="receivables" name="مستحقة"    fill="#F59E0B" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Financial Statements */}
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Income Statement */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-emerald-500/15 flex items-center justify-center">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                  </div>
                  قائمة الدخل
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <StatRow label="الإيرادات" value={fs.incomeStatement?.revenue ?? 0} color="text-emerald-400" />
                <StatRow label="المصاريف" value={fs.incomeStatement?.expenses ?? 0} color="text-red-400" />
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs font-bold">صافي الربح</span>
                  <span className={`text-sm font-black tabular-nums ${(fs.incomeStatement?.netProfit ?? 0) >= 0 ? "text-primary" : "text-red-400"}`}>
                    {fmtSAR(fs.incomeStatement?.netProfit ?? 0)}
                  </span>
                </div>
                {(fs.incomeStatement?.margin ?? 0) > 0 && (
                  <div className="mt-1 text-[11px] text-muted-foreground text-center">
                    هامش الربح: {(fs.incomeStatement.margin).toFixed(1)}%
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Balance Sheet */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-blue-500/15 flex items-center justify-center">
                    <FileText className="h-3 w-3 text-blue-400" />
                  </div>
                  الميزانية العمومية
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-[10px] text-muted-foreground mb-2 font-semibold">الأصول</p>
                <StatRow label="النقد المحصّل" value={fs.balanceSheet?.assets?.cash ?? 0} />
                <StatRow label="المستحقات" value={fs.balanceSheet?.assets?.receivables ?? 0} />
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs font-bold">حقوق الملكية</span>
                  <span className={`text-sm font-black tabular-nums ${(fs.balanceSheet?.equity ?? 0) >= 0 ? "text-blue-400" : "text-red-400"}`}>
                    {fmtSAR(fs.balanceSheet?.equity ?? 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Cash Flow */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-violet-500/15 flex items-center justify-center">
                    <DollarSign className="h-3 w-3 text-violet-400" />
                  </div>
                  التدفقات النقدية
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <StatRow label="تدفقات داخلة" value={fs.cashFlow?.cashIn ?? 0} color="text-emerald-400" />
                <StatRow label="تدفقات خارجة" value={fs.cashFlow?.cashOut ?? 0} color="text-red-400" />
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs font-bold">صافي التدفق</span>
                  <span className={`text-sm font-black tabular-nums ${(fs.cashFlow?.netCashFlow ?? 0) >= 0 ? "text-violet-400" : "text-red-400"}`}>
                    {fmtSAR(fs.cashFlow?.netCashFlow ?? 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invoice Status Breakdown */}
          {data?.byStatus && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">توزيع الفواتير</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {[
                    { key: "paid",    label: "مدفوعة",  color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { key: "sent",    label: "مُرسَلة",  color: "text-blue-400",    bg: "bg-blue-500/10" },
                    { key: "overdue", label: "متأخرة",  color: "text-red-400",     bg: "bg-red-500/10" },
                    { key: "draft",   label: "مسودة",   color: "text-muted-foreground",   bg: "bg-muted/30 10" },
                  ].map(s => (
                    <div key={s.key} className={`rounded-xl p-3 ${s.bg}`}>
                      <div className={`text-2xl font-black ${s.color}`}>{data.byStatus[s.key] ?? 0}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!hasData && (
            <EmptyTab icon={<BarChart3 />} label="لا توجد فواتير لهذا العميل في الفترة المحددة" />
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   مكوّن تحليل العميل بالذكاء الاصطناعي
══════════════════════════════════════════════════════ */
const AI_ANALYSIS_TYPES = [
  { key: "relationship",   label: "تحليل العلاقة",        icon: "🤝", color: "#6366F1", prompt: "حلّل طبيعة العلاقة مع هذا العميل، مدتها، جودتها، ومستوى التفاعل." },
  { key: "profitability",  label: "تحليل الربحية",         icon: "💰", color: "#10B981", prompt: "حلّل ربحية هذا العميل من حيث الإيرادات المحصّلة مقابل الوقت المستثمر." },
  { key: "risk",           label: "تقييم المخاطر",         icon: "⚠️", color: "#F59E0B", prompt: "قيّم مخاطر الاستمرار مع هذا العميل من الجانب المالي والقانوني." },
  { key: "opportunities",  label: "فرص النمو",             icon: "🚀", color: "#8B5CF6", prompt: "اقترح فرص لتوسيع نطاق الخدمات المقدّمة لهذا العميل." },
  { key: "next_actions",   label: "الإجراءات الموصى بها",  icon: "📋", color: "#2563EB", prompt: "اقترح أهم 5 إجراءات يجب اتخاذها تجاه هذا العميل الآن." },
] as const;

function ClientAIInsights({ client, cases, invoices, contracts }: {
  client: any; cases: any[]; invoices: any[]; contracts: any[];
}) {
  const [activeType, setActiveType] = useState<string>("relationship");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const runAnalysis = async (type: string) => {
    setActiveType(type);
    setResult("");
    setLoading(true);

    const at = AI_ANALYSIS_TYPES.find(t => t.key === type)!;

    const context = `
بيانات العميل:
- الاسم: ${client.fullName}
- النوع: ${client.clientType === "individual" ? "فرد" : client.clientType === "company" ? "شركة" : "جهة حكومية"}
- البريد: ${client.email || "غير محدد"}
- الهاتف: ${client.phone || "غير محدد"}
- العنوان: ${client.address || "غير محدد"}
- تاريخ الانضمام: ${new Date(client.createdAt).toLocaleDateString("ar-SA")}

القضايا: ${cases.length} قضية (${cases.filter(c => c.status === "open").length} مفتوحة، ${cases.filter(c => c.status === "closed").length} مغلقة)
الفواتير: ${invoices.length} فاتورة (${invoices.filter(i => i.status === "paid").length} مدفوعة، ${invoices.filter(i => i.status === "overdue").length} متأخرة)
إجمالي الإيرادات: ${invoices.filter(i => i.status === "paid").reduce((s: number, i: any) => s + ((i.total ?? i.amount ?? 0) / 100), 0).toLocaleString("ar-SA")} ر.س
العقود النشطة: ${contracts.filter(c => c.status === "active").length}

الطلب: ${at.prompt}
    `.trim();

    try {
      const res = await fetch(`${BASE}/api/ai/analyze-case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: context, type: "client_analysis" }),
      });
      const data = await res.json();
      setResult(data.result || data.analysis || data.content || "لا توجد نتيجة");
    } catch {
      setResult("حدث خطأ أثناء التحليل. تأكد من إعداد مفتاح API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runAnalysis("relationship"); }, []);

  const renderBold = (text: string) =>
    text.split(/\*\*(.*?)\*\*/g).map((p, i) =>
      i % 2 === 1 ? <strong key={i} className="font-bold text-foreground">{p}</strong> : p
    );

  const activeAt = AI_ANALYSIS_TYPES.find(t => t.key === activeType)!;

  return (
    <div className="space-y-4">
      {/* Analysis Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {AI_ANALYSIS_TYPES.map(at => (
          <button
            key={at.key}
            onClick={() => runAnalysis(at.key)}
            disabled={loading}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all text-xs font-medium disabled:opacity-50 ${
              activeType === at.key
                ? "text-white shadow-lg"
                : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"
            }`}
            style={activeType === at.key ? { backgroundColor: `${at.color}20`, borderColor: `${at.color}50`, color: at.color } : {}}
          >
            <span className="text-xl">{at.icon}</span>
            <span className="leading-tight">{at.label}</span>
          </button>
        ))}
      </div>

      {/* Result Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-base">{activeAt.icon}</span>
              <span style={{ color: activeAt.color }}>{activeAt.label}</span>
              <span className="text-xs font-normal text-muted-foreground">— {client.fullName}</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {result && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => {
                  navigator.clipboard.writeText(result);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}>
                  <Copy className="h-3 w-3" />{copied ? "تم النسخ" : "نسخ"}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => runAnalysis(activeType)} disabled={loading}>
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />إعادة التحليل
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="relative">
                <Sparkles className="h-8 w-8 animate-pulse" style={{ color: activeAt.color }} />
              </div>
              <p className="text-sm text-muted-foreground">يحلّل الذكاء الاصطناعي بيانات العميل...</p>
            </div>
          ) : result ? (
            <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap space-y-1">
              {result.split("\n").map((line, i) => (
                <p key={i}>{renderBold(line)}</p>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Bot className="h-8 w-8 opacity-20" />
              <p className="text-sm">اختر نوع التحليل للبدء</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats for Context */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي القضايا", value: cases.length, color: "#6366F1", icon: "⚖️" },
          { label: "الإيرادات المحصّلة", value: `${invoices.filter(i => i.status === "paid").reduce((s: number, i: any) => s + ((i.total ?? i.amount ?? 0)/100), 0).toLocaleString("ar-SA")} ر.س`, color: "#10B981", icon: "💰" },
          { label: "الفواتير المتأخرة", value: invoices.filter(i => i.status === "overdue").length, color: "#EF4444", icon: "⚠️" },
          { label: "العقود النشطة", value: contracts.filter(c => c.status === "active").length, color: "#8B5CF6", icon: "📝" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-3 border border-border/40 bg-muted/20 text-center">
            <div className="text-xl mb-1">{stat.icon}</div>
            <div className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
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
