import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Globe, Link2, Copy, CheckCircle2, Plus, Trash2, Clock,
  Eye, Users, Scale, RefreshCw, Loader2, Shield, ExternalLink
} from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/";

type PortalToken = {
  id: string; case_id: string; token: string; client_email: string;
  client_name: string; expires_at: string; last_accessed: string; access_count: number; created_at: string;
};

type Case = { id: string; title: string; status: string; caseType: string; clientName: string };

// ─── Copy helper ─────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── New Token Dialog ─────────────────────────────────────────────────────────
function NewTokenDialog({ cases, onCreated }: { cases: Case[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [caseId, setCaseId] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [expiryDays, setExpiryDays] = useState(30);
  const [result, setResult] = useState<{ url: string; token: string; expiresAt: string } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      fetch(`${BASE}api/portal/create-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, clientEmail, clientName, expiryDays }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      setResult(data);
      onCreated();
    },
    onError: () => toast.error("فشل إنشاء الرابط"),
  });

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setResult(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />رابط بوابة جديد</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />إنشاء بوابة عميل
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 pt-2">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
              <p className="font-semibold text-green-400">تم إنشاء الرابط بنجاح!</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">رابط البوابة</Label>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
                <span className="text-xs font-mono flex-1 truncate text-primary">{result.url}</span>
                <CopyButton text={result.url} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              صالح حتى: {new Date(result.expiresAt).toLocaleDateString("ar-SA")}
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" variant="outline" asChild>
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 ml-2" />معاينة
                </a>
              </Button>
              <Button className="flex-1" onClick={() => setOpen(false)}>إغلاق</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>القضية *</Label>
              <select value={caseId} onChange={e => setCaseId(e.target.value)}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm">
                <option value="">اختر القضية</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>اسم العميل</Label>
                <Input placeholder="أحمد المطيري" value={clientName} onChange={e => setClientName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" placeholder="client@mail.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>مدة الصلاحية (يوم)</Label>
              <Input type="number" min={1} max={365} value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value))} />
            </div>
            <Button className="w-full" onClick={() => create.mutate()} disabled={!caseId || create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Link2 className="h-4 w-4 ml-2" />}
              إنشاء الرابط
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientPortal() {
  const { user } = useUser();
  const qc = useQueryClient();

  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["cases-list"],
    queryFn: () => fetch(`${BASE}api/cases`).then(r => r.json()).then(d => Array.isArray(d) ? d : d.cases ?? []),
  });

  // Collect all tokens for all cases
  const { data: allTokens = [], isLoading, refetch } = useQuery<PortalToken[]>({
    queryKey: ["portal-all-tokens"],
    queryFn: async () => {
      const promises = cases.slice(0, 20).map(c =>
        fetch(`${BASE}api/portal/tokens/${c.id}`).then(r => r.json())
      );
      const results = await Promise.all(promises);
      return results.flat().filter(Boolean);
    },
    enabled: cases.length > 0,
  });

  const deleteToken = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}api/portal/tokens/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { toast.success("تم حذف الرابط"); qc.invalidateQueries({ queryKey: ["portal-all-tokens"] }); },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["portal-all-tokens"] });

  const getCaseName = (caseId: string) => cases.find(c => c.id === caseId)?.title ?? caseId;

  const stats = {
    total: allTokens.length,
    active: allTokens.filter(t => !t.expires_at || new Date(t.expires_at) > new Date()).length,
    accessed: allTokens.filter(t => t.access_count > 0).length,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-7 w-7 text-primary" />بوابة العملاء
          </h1>
          <p className="text-muted-foreground mt-1">
            أنشئ روابط آمنة لعملائك لمتابعة قضاياهم ورفع المستندات ودفع الفواتير
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <NewTokenDialog cases={cases} onCreated={refresh} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "إجمالي الروابط", value: stats.total,    icon: Link2,        color: "text-primary",  bg: "bg-primary/10" },
          { label: "روابط نشطة",    value: stats.active,   icon: Shield,       color: "text-green-400", bg: "bg-green-500/10" },
          { label: "تم الوصول",     value: stats.accessed, icon: Eye,          color: "text-blue-400",  bg: "bg-blue-500/10" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${s.bg}`}>
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* How It Works */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />كيف تعمل بوابة العميل؟
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { step: "1", text: "أنشئ رابطاً لأي قضية" },
              { step: "2", text: "أرسله للعميل بالبريد" },
              { step: "3", text: "يتابع قضيته مباشرة" },
              { step: "4", text: "يرفع مستندات ويدفع" },
            ].map(s => (
              <div key={s.step} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold shrink-0">
                  {s.step}
                </span>
                {s.text}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tokens List */}
      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}</div>
      ) : allTokens.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Globe className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">لا توجد روابط بعد</p>
            <p className="text-xs text-muted-foreground">أنشئ أول رابط لمشاركته مع عميلك</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allTokens.map(token => {
            const isExpired = token.expires_at && new Date(token.expires_at) < new Date();
            const portalUrl = `${window.location.origin}/portal/${token.token}`;
            return (
              <Card key={token.id} className={isExpired ? "opacity-60 border-border/30" : "hover:border-primary/30 transition-all"}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm truncate">{getCaseName(token.case_id)}</span>
                        {token.client_name && (
                          <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                            {token.client_name}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-xs ${isExpired ? "border-red-500/30 text-red-400" : "border-green-500/30 text-green-400"}`}>
                          {isExpired ? "منتهي" : "نشط"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 mt-2">
                        <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-xs font-mono flex-1 truncate text-muted-foreground">{portalUrl}</span>
                        <CopyButton text={portalUrl} />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground flex-wrap">
                        {token.client_email && <span>{token.client_email}</span>}
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />{token.access_count} مشاهدة
                        </span>
                        {token.last_accessed && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />آخر دخول: {new Date(token.last_accessed).toLocaleDateString("ar-SA")}
                          </span>
                        )}
                        {token.expires_at && (
                          <span>ينتهي: {new Date(token.expires_at).toLocaleDateString("ar-SA")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 px-3" asChild>
                        <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />معاينة
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                        onClick={() => deleteToken.mutate(token.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
