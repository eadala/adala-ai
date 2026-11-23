/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps -- pre-existing lint debt; authFetch migration */
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Building2, Users, Package, Tag, KeyRound, Activity,
  Settings, FolderTree, BookOpen, HeadphonesIcon, Plus, Loader2,
  Trash2, Edit2, Check, X, TrendingUp, DollarSign, BarChart3,
  AlertCircle, CheckCircle2, Clock, ChevronDown, Eye, EyeOff,
  Save, RefreshCw, Globe, Star, MessageSquare, Upload, FileText,
  ToggleLeft, ToggleRight, Search, Badge as BadgeIcon, Briefcase,
  Crown, Zap, Bell, Lock, Code2, Terminal, Cpu, HardDrive,
  Server, Copy, Fingerprint, Wifi, Database, ShieldAlert,
  CircleCheck, CircleX, KeySquare, Cloud, Link2,
  Shield, CheckCircle, XCircle, Layers, PlugZap, Smartphone,
  Gift, CalendarClock, Ban, PlusCircle, Timer, TrendingDown, Percent,
  Phone, Mail, Twitter, Linkedin, Youtube,
  Bot, Radar, Command, Network, Gauge, Play, Pause, RotateCcw,
  AlertOctagon as AOctagon, TrendingUp as TUp, Boxes,
  MonitorDot, Cpu as CpuIcon, MemoryStick, ArrowUpRight,
  Workflow, ScanLine, FlaskConical,
  FileBarChart2, Gavel, FileSignature, ShieldCheck as SecurityIcon,
  Layout, AlertOctagon, Download, ChevronRight, Filter as FilterIcon,
  User, Banknote, CheckSquare, AlertCircle as ACircle,
  Globe2, Newspaper, ListOrdered, HelpCircle, PenLine, Info,
  CreditCard, Receipt, AlertTriangle,
  ArrowRight, ClipboardList, ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { API, DEV_API, useAdmin } from "../shared/api";
import { StatCard } from "../shared/components";
import { authFetch } from "@/lib/authFetch";
import {
  PLAN_SLUG_COLORS, PLAN_SLUG_LABELS, PLAN_FEATURE_FLAGS, TABS,
  arabicToSlug, PERM_LABELS
} from "../shared/constants";

const HOST_BASE = (() => {
  const b = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (path: string, opts?: RequestInit) =>
    authFetch(`${b}/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
})();

export function HostingCenterTab({ toast }: { toast: any }) {
  const [sub, setSub] = useState("infrastructure");

  /* ── Server status ── */
  const [status, setStatus] = useState<any>(null);
  const [statusLoad, setStatusLoad] = useState(false);

  /* ── Domains ── */
  const [domains, setDomains] = useState<any[]>([]);
  const [domainsLoad, setDomainsLoad] = useState(false);
  const [newDomain, setNewDomain] = useState({ domain: "", domainType: "custom", provider: "cloudflare", officeName: "" });
  const [addingDomain, setAddingDomain] = useState(false);
  const [showDomainForm, setShowDomainForm] = useState(false);

  /* ── Providers ── */
  const [providers, setProviders] = useState<any[]>([]);
  const [providersLoad, setProvidersLoad] = useState(false);
  const [newProvider, setNewProvider] = useState({ providerName: "", providerType: "dns", apiKey: "", zoneId: "", endpoint: "" });
  const [addingProvider, setAddingProvider] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);

  /* ── Offices/subdomains ── */
  const [offices, setOffices] = useState<any[]>([]);
  const [officesLoad, setOfficesLoad] = useState(false);

  /* ── DNS Guide ── */
  const [dnsGuide, setDnsGuide] = useState<any>(null);

  const loadStatus = async () => {
    setStatusLoad(true);
    try { const d = await (await HOST_BASE("/hosting/status")).json(); setStatus(d); }
    catch { toast({ title: "خطأ في تحميل حالة الخادم", variant: "destructive" }); }
    finally { setStatusLoad(false); }
  };

  const loadDomains = async () => {
    setDomainsLoad(true);
    try { const d = await (await HOST_BASE("/hosting/domains")).json(); setDomains(Array.isArray(d) ? d : []); }
    finally { setDomainsLoad(false); }
  };

  const loadProviders = async () => {
    setProvidersLoad(true);
    try { const d = await (await HOST_BASE("/hosting/providers")).json(); setProviders(Array.isArray(d) ? d : []); }
    finally { setProvidersLoad(false); }
  };

  const loadOffices = async () => {
    setOfficesLoad(true);
    try { const d = await (await HOST_BASE("/hosting/offices-subdomains")).json(); setOffices(Array.isArray(d) ? d : []); }
    finally { setOfficesLoad(false); }
  };

  const loadDnsGuide = async () => {
    try { const d = await (await HOST_BASE("/hosting/dns-guide")).json(); setDnsGuide(d); }
    catch {}
  };

  useEffect(() => {
    if (sub === "infrastructure") loadStatus();
    if (sub === "domains") { loadDomains(); loadDnsGuide(); }
    if (sub === "providers") loadProviders();
    if (sub === "subdomains") loadOffices();
  }, [sub]);

  const addDomain = async () => {
    if (!newDomain.domain.trim()) return;
    setAddingDomain(true);
    try {
      const res = await HOST_BASE("/hosting/domains", { method: "POST", body: JSON.stringify(newDomain) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "تم إضافة النطاق" });
      setNewDomain({ domain: "", domainType: "custom", provider: "cloudflare", officeName: "" });
      setShowDomainForm(false);
      loadDomains();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setAddingDomain(false); }
  };

  const toggleVerify = async (id: string) => {
    await HOST_BASE(`/hosting/domains/${id}/verify`, { method: "PATCH" });
    loadDomains();
  };

  const toggleSsl = async (id: string) => {
    await HOST_BASE(`/hosting/domains/${id}/ssl`, { method: "PATCH" });
    loadDomains();
  };

  const deleteDomain = async (id: string) => {
    if (!confirm("حذف هذا النطاق؟")) return;
    await HOST_BASE(`/hosting/domains/${id}`, { method: "DELETE" });
    loadDomains();
  };

  const addProvider = async () => {
    if (!newProvider.providerName.trim()) return;
    setAddingProvider(true);
    try {
      const res = await HOST_BASE("/hosting/providers", { method: "POST", body: JSON.stringify(newProvider) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "تم إضافة المزود" });
      setNewProvider({ providerName: "", providerType: "dns", apiKey: "", zoneId: "", endpoint: "" });
      setShowProviderForm(false);
      loadProviders();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setAddingProvider(false); }
  };

  const toggleProvider = async (id: string) => {
    await HOST_BASE(`/hosting/providers/${id}/toggle`, { method: "PATCH" });
    loadProviders();
  };

  const deleteProvider = async (id: string) => {
    if (!confirm("حذف هذا المزود؟")) return;
    await HOST_BASE(`/hosting/providers/${id}`, { method: "DELETE" });
    loadProviders();
  };

  const HOST_SUB_TABS = [
    { id: "infrastructure", label: "البنية التحتية",   icon: Server },
    { id: "domains",        label: "النطاقات",          icon: Globe },
    { id: "subdomains",     label: "مواقع المكاتب",    icon: Layers },
    { id: "providers",      label: "مزودو الخدمة",     icon: Cloud },
    { id: "devaccess",      label: "وصول المطورين",    icon: PlugZap },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/20">
          <Globe className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">مركز الاستضافة والبنية التحتية</h2>
          <p className="text-xs text-muted-foreground">إدارة النطاقات · SSL · مزودو الخدمة · الخوادم</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {HOST_SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sub === t.id
                ? "bg-blue-600 text-white shadow"
                : "bg-muted hover:bg-muted/70 text-muted-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── INFRASTRUCTURE ─── */}
      {sub === "infrastructure" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={loadStatus} disabled={statusLoad}>
              <RefreshCw className={`h-4 w-4 ml-1.5 ${statusLoad ? "animate-spin" : ""}`} />
              تحديث
            </Button>
          </div>

          {statusLoad ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-blue-400" /></div>
          ) : status ? (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "وقت التشغيل", value: status.uptime, icon: Clock, color: "text-emerald-400" },
                  { label: "معالجات CPU", value: `${status.cpuCores} أنوية`, icon: Cpu, color: "text-blue-400" },
                  { label: "Node.js", value: status.nodeVersion, icon: Terminal, color: "text-yellow-400" },
                  { label: "قاعدة البيانات", value: status.dbStatus, icon: Database, color: status.dbStatus === "متصل" ? "text-emerald-400" : "text-red-400" },
                ].map(k => (
                  <Card key={k.label} className="border-border/50 bg-card/60">
                    <CardContent className="p-4 flex items-center gap-3">
                      <k.icon className={`h-6 w-6 ${k.color} flex-shrink-0`} />
                      <div>
                        <p className="text-xs text-muted-foreground">{k.label}</p>
                        <p className="text-sm font-bold">{k.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Memory */}
              <Card className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive className="h-4 w-4 text-violet-400" />
                    <span className="text-sm font-semibold">الذاكرة والموارد</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {[
                      ["Heap مُستخدم", status.memory?.heapUsed],
                      ["Heap الكلي", status.memory?.heapTotal],
                      ["RSS", status.memory?.rss],
                      ["نظام", `${status.memory?.systemUsed} / ${status.memory?.systemTotal}`],
                    ].map(([lbl, val]) => (
                      <div key={lbl} className="bg-muted/40 rounded-lg p-2.5">
                        <p className="text-muted-foreground">{lbl}</p>
                        <p className="font-mono font-semibold mt-0.5" dir="ltr">{val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>استهلاك الذاكرة</span>
                      <span>{status.memory?.usedPercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60">
                      <div
                        className={`h-full rounded-full ${status.memory?.usedPercent > 85 ? "bg-red-500" : status.memory?.usedPercent > 60 ? "bg-yellow-500" : "bg-emerald-500"}`}
                        style={{ width: `${status.memory?.usedPercent}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Server details */}
              <Card className="border-border/50"><CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {[
                    ["المنصة", status.platform],
                    ["المعالج", status.cpuModel],
                    ["البيئة", status.env],
                    ["Hostname", status.hostname],
                    ["نطاق الإنتاج", status.productionUrl ?? "—"],
                    ["عدد المكاتب", String(status.totalOffices)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
                      <span className="text-xs text-muted-foreground">{k}</span>
                      <span className="text-xs font-mono font-medium" dir="ltr">{v}</span>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">اضغط "تحديث" لتحميل حالة الخادم</p>
            </div>
          )}
        </div>
      )}

      {/* ─── DOMAINS ─── */}
      {sub === "domains" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{domains.length} نطاق مسجّل</p>
            <Button size="sm" onClick={() => setShowDomainForm(v => !v)}>
              <Plus className="h-4 w-4 ml-1.5" />
              إضافة نطاق
            </Button>
          </div>

          {showDomainForm && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-300">نطاق جديد</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="النطاق (مثال: office1.com)" value={newDomain.domain}
                    onChange={e => setNewDomain(p => ({ ...p, domain: e.target.value }))} className="text-sm h-9" />
                  <Input placeholder="اسم المكتب (اختياري)" value={newDomain.officeName}
                    onChange={e => setNewDomain(p => ({ ...p, officeName: e.target.value }))} className="text-sm h-9" />
                  <select value={newDomain.domainType}
                    onChange={e => setNewDomain(p => ({ ...p, domainType: e.target.value }))}
                    className="bg-background border border-input rounded-md px-3 py-2 text-sm h-9">
                    <option value="custom">نطاق خاص</option>
                    <option value="subdomain">نطاق فرعي</option>
                  </select>
                  <select value={newDomain.provider}
                    onChange={e => setNewDomain(p => ({ ...p, provider: e.target.value }))}
                    className="bg-background border border-input rounded-md px-3 py-2 text-sm h-9">
                    <option value="cloudflare">Cloudflare</option>
                    <option value="godaddy">GoDaddy</option>
                    <option value="namecheap">Namecheap</option>
                    <option value="other">آخر</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowDomainForm(false)}>إلغاء</Button>
                  <Button size="sm" onClick={addDomain} disabled={addingDomain}>
                    {addingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DNS setup guide */}
          {dnsGuide && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="h-4 w-4 text-yellow-400" />
                  <p className="text-sm font-semibold text-yellow-300">دليل إعداد DNS</p>
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">CNAME يشير إلى:</span>
                  <code className="text-xs font-mono bg-muted/50 px-2 py-0.5 rounded text-yellow-200" dir="ltr">
                    {dnsGuide.cname}
                  </code>
                </div>
                <div className="space-y-1.5">
                  {dnsGuide.instructions?.map((s: any) => (
                    <div key={s.step} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">{s.step}</span>
                      <span>{s.desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {domainsLoad ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
          ) : domains.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد نطاقات مسجلة بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {domains.map((d: any) => (
                <Card key={d.id} className="border-border/50">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-mono font-semibold" dir="ltr">{d.domain}</code>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          d.status === "active" ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-yellow-500/15 text-yellow-400"}`}>
                          {d.status === "active" ? "نشط" : "معلق"}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{d.provider}</span>
                        {d.office_name && <span className="text-[10px] text-muted-foreground">| {d.office_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleVerify(d.id)}
                        title={d.dns_verified ? "إلغاء التحقق" : "تعيين كمحقق"}
                        className={`p-1.5 rounded-md transition-colors ${d.dns_verified ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleSsl(d.id)}
                        title={d.ssl_enabled ? "SSL مفعّل" : "تفعيل SSL"}
                        className={`p-1.5 rounded-md transition-colors ${d.ssl_enabled ? "text-blue-400 bg-blue-500/10" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        <Shield className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteDomain(d.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── OFFICES SUBDOMAINS ─── */}
      {sub === "subdomains" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{offices.length} مكتب مسجّل</p>
            <Button size="sm" variant="outline" onClick={loadOffices} disabled={officesLoad}>
              <RefreshCw className={`h-4 w-4 ml-1.5 ${officesLoad ? "animate-spin" : ""}`} />
              تحديث
            </Button>
          </div>

          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-3 flex gap-2.5">
              <Layers className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                كل مكتب يحصل تلقائياً على مسار خاص به <code className="bg-muted/60 px-1 rounded" dir="ltr">/firms/slug</code>.
                يمكن ربط نطاق خاص عبر تبويب "النطاقات".
              </p>
            </CardContent>
          </Card>

          {officesLoad ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
          ) : offices.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد مكاتب مسجلة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {offices.map((o: any) => (
                <Card key={o.id} className="border-border/50">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-border/50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{o.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${o.is_published ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/60 text-muted-foreground"}`}>
                          {o.is_published ? "منشور" : "غير منشور"}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400">{o.plan}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <code className="text-[11px] text-muted-foreground font-mono" dir="ltr">/firms/{o.slug}</code>
                      </div>
                    </div>
                    <a
                      href={o.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      <Link2 className="h-4 w-4" />
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── HOSTING PROVIDERS ─── */}
      {sub === "providers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{providers.length} مزود مُعدّ</p>
            <Button size="sm" onClick={() => setShowProviderForm(v => !v)}>
              <Plus className="h-4 w-4 ml-1.5" />
              إضافة مزود
            </Button>
          </div>

          {showProviderForm && (
            <Card className="border-violet-500/30 bg-violet-500/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-violet-300">مزود خدمة جديد</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="اسم المزود (Cloudflare, AWS…)" value={newProvider.providerName}
                    onChange={e => setNewProvider(p => ({ ...p, providerName: e.target.value }))} className="text-sm h-9" />
                  <select value={newProvider.providerType}
                    onChange={e => setNewProvider(p => ({ ...p, providerType: e.target.value }))}
                    className="bg-background border border-input rounded-md px-3 py-2 text-sm h-9">
                    <option value="dns">DNS</option>
                    <option value="cdn">CDN</option>
                    <option value="ssl">SSL</option>
                    <option value="hosting">Hosting</option>
                  </select>
                  <Input placeholder="API Key (اختياري)" value={newProvider.apiKey}
                    onChange={e => setNewProvider(p => ({ ...p, apiKey: e.target.value }))}
                    type="password" className="text-sm h-9" />
                  <Input placeholder="Zone ID (اختياري)" value={newProvider.zoneId}
                    onChange={e => setNewProvider(p => ({ ...p, zoneId: e.target.value }))} className="text-sm h-9" dir="ltr" />
                  <Input placeholder="Endpoint URL (اختياري)" value={newProvider.endpoint}
                    onChange={e => setNewProvider(p => ({ ...p, endpoint: e.target.value }))} className="text-sm h-9 col-span-2" dir="ltr" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowProviderForm(false)}>إلغاء</Button>
                  <Button size="sm" onClick={addProvider} disabled={addingProvider}>
                    {addingProvider ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {providersLoad ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
          ) : providers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Cloud className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا يوجد مزودو خدمة مُعدّون</p>
              <p className="text-xs mt-1">أضف Cloudflare أو غيره لإدارة DNS و SSL</p>
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((p: any) => (
                <Card key={p.id} className="border-border/50">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{p.provider_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground uppercase">{p.provider_type}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                          {p.is_active ? "نشط" : "معطّل"}
                        </span>
                      </div>
                      {p.api_key && (
                        <code className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                          API: {p.api_key}
                        </code>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleProvider(p.id)}
                        className={`p-1.5 rounded-md transition-colors ${p.is_active ? "text-emerald-400 hover:bg-red-500/10 hover:text-red-400" : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400"}`}>
                        {p.is_active ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
                      </button>
                      <button onClick={() => deleteProvider(p.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── DEV ACCESS ─── */}
      {sub === "devaccess" && (
        <div className="space-y-4">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex gap-3">
              <PlugZap className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-300 mb-1">وصول المطور / المهندس</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يمكن للمطورين الوصول إلى البنية التحتية عبر Developer Tokens المُدارة من تبويب <strong>"مركز المطور"</strong>.
                  كل token يمنح صلاحيات API محددة مع تتبع الاستخدام.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                icon: Terminal,
                title: "API المطور",
                color: "emerald",
                items: [
                  "GET /api/developer/system-info — معلومات الخادم",
                  "GET /api/developer/db-stats — إحصائيات قاعدة البيانات",
                  "GET /api/hosting/status — حالة البنية التحتية",
                  "GET /api/hosting/domains — قائمة النطاقات",
                ],
              },
              {
                icon: Shield,
                title: "الأمان والصلاحيات",
                color: "blue",
                items: [
                  "جميع نقاط النهاية محمية بـ isSuperAdmin()",
                  "Developer Tokens للوصول الخارجي المحدود",
                  "مفاتيح API للمزودين مُخفاة جزئياً في الواجهة",
                  "جميع العمليات مُسجّلة في server logs",
                ],
              },
              {
                icon: Database,
                title: "قاعدة البيانات",
                color: "violet",
                items: [
                  "hosting_domains — سجل النطاقات",
                  "hosting_providers — إعدادات المزودين",
                  "office_page — بيانات المكاتب + slugs",
                  "developer_tokens — رموز وصول المطورين",
                ],
              },
              {
                icon: Wifi,
                title: "متطلبات الربط",
                color: "yellow",
                items: [
                  "CLOUDFLARE_TOKEN — لإدارة DNS تلقائياً",
                  "PRODUCTION_URL — نطاق الإنتاج العام",
                  "GITHUB_TOKEN — GitHub API (Deployment Center)",
                  "DATABASE_URL — PostgreSQL connection",
                  "CLERK_SECRET_KEY — مصادقة المستخدمين",
                ],
              },
            ].map(card => (
              <Card key={card.title} className={`border-${card.color}-500/20 bg-${card.color}-500/5`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <card.icon className={`h-4 w-4 text-${card.color}-400`} />
                    <span className="text-sm font-semibold">{card.title}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {card.items.map(item => (
                      <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <span className={`text-${card.color}-400 mt-0.5 flex-shrink-0`}>•</span>
                        <code className="font-mono text-[10px] leading-relaxed" dir="ltr">{item}</code>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-dashed border-border/60">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">إنشاء Developer Token جديد ← انتقل لتبويب مركز المطور</p>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => {
                  const el = document.querySelector('[data-value="developer"]') as HTMLElement | null;
                  el?.click();
                }}
              >
                <Code2 className="h-4 w-4 ml-1.5" />
                الانتقال لمركز المطور
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OVERVIEW TAB (enhanced — with recharts + extended stats)
═══════════════════════════════════════════════════ */
const CHART_COLORS = ["#2563EB","#3B82F6","#10B981","#8B5CF6","#EF4444","#F59E0B","#06B6D4","#F97316"];

