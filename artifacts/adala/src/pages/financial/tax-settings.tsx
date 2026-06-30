import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Shield, FileText, CheckCircle, AlertCircle,
  Loader2, Save, Building2, Receipt,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function TaxSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["office-tax-settings"],
    queryFn: () => fetch(`${BASE}/api/accounting/tax-settings`).then(r => r.json()),
    staleTime: 10 * 60_000,
  });

  const [form, setForm] = useState<any>(null);

  /* بمجرد تحميل البيانات، نهيئ النموذج */
  const d = data ?? {};
  const current = form ?? {
    taxEnabled:   d.taxEnabled  ?? true,
    taxRate:      d.taxRate     ?? 15,
    taxType:      d.taxType     ?? "VAT",
    taxNumber:    d.taxNumber   ?? "",
    taxExempt:    d.taxExempt   ?? false,
    zatcaEnabled: d.zatcaEnabled ?? false,
    notes:        d.notes        ?? "",
  };

  function set(k: string, v: any) {
    setForm((prev: any) => ({ ...(prev ?? d), [k]: v }));
  }

  const save = useMutation({
    mutationFn: (body: any) =>
      fetch(`${BASE}/api/accounting/tax-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => { if (!r.ok) throw new Error("فشل الحفظ"); return r.json(); }),
    onSuccess: () => {
      toast({ title: "تم الحفظ", description: "تم حفظ إعدادات الضريبة بنجاح" });
      qc.invalidateQueries({ queryKey: ["office-tax-settings"] });
      setForm(null);
    },
    onError: () => toast({ title: "خطأ", description: "فشل حفظ الإعدادات", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin me-2" /> جارٍ التحميل...
      </div>
    );
  }

  const isDirty = form !== null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">إعدادات الضريبة</h1>
          <p className="text-xs text-muted-foreground">إعدادات ضريبة القيمة المضافة على مستوى المكتب</p>
        </div>
      </div>

      {/* Status banner */}
      <Card className={`border ${current.taxEnabled && !current.taxExempt ? "bg-green-500/5 border-green-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
        <CardContent className="p-4 flex items-center gap-3">
          {current.taxEnabled && !current.taxExempt ? (
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium text-foreground">
              {current.taxExempt
                ? "المكتب معفى من الضريبة"
                : current.taxEnabled
                ? `ضريبة ${current.taxType} مُفعّلة — النسبة: ${current.taxRate}%`
                : "الضريبة معطّلة على جميع الفواتير"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {current.taxEnabled && !current.taxExempt
                ? "تُحتسب الضريبة تلقائياً على الفواتير الجديدة"
                : "لن تُضاف ضريبة على الفواتير الجديدة"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Main settings */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> إعدادات الضريبة الأساسية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">تفعيل الضريبة</p>
              <p className="text-xs text-muted-foreground">إضافة الضريبة تلقائياً على الفواتير الجديدة</p>
            </div>
            <Switch
              checked={current.taxEnabled}
              onCheckedChange={v => set("taxEnabled", v)}
              disabled={current.taxExempt}
            />
          </div>

          <Separator />

          {/* Tax type */}
          <div className="space-y-2">
            <Label className="text-sm">نوع الضريبة</Label>
            <div className="flex gap-2 flex-wrap">
              {["VAT", "GST", "لا يوجد"].map(t => (
                <button key={t}
                  onClick={() => set("taxType", t)}
                  className={`px-4 py-1.5 rounded-lg text-sm border transition-colors ${
                    current.taxType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Tax rate */}
          <div className="space-y-2">
            <Label className="text-sm" htmlFor="taxRate">نسبة الضريبة (%)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="taxRate"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={current.taxRate}
                onChange={e => set("taxRate", parseFloat(e.target.value) || 0)}
                className="w-32"
                disabled={!current.taxEnabled || current.taxExempt}
              />
              <div className="flex gap-1.5">
                {[5, 10, 15, 20].map(r => (
                  <button key={r}
                    onClick={() => set("taxRate", r)}
                    className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                      current.taxRate === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                    disabled={!current.taxEnabled || current.taxExempt}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">النسبة القياسية في المملكة العربية السعودية: 15%</p>
          </div>

          <Separator />

          {/* Tax exemption */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">إعفاء ضريبي</p>
              <p className="text-xs text-muted-foreground">تفعيل هذا الخيار إذا كان المكتب يمتلك إعفاءً ضريبياً رسمياً</p>
            </div>
            <Switch
              checked={current.taxExempt}
              onCheckedChange={v => {
                set("taxExempt", v);
                if (v) set("taxEnabled", false);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ZATCA & Tax Number */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> الرقم الضريبي وFATCA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Tax number */}
          <div className="space-y-2">
            <Label className="text-sm" htmlFor="taxNumber">الرقم الضريبي (VAT Number)</Label>
            <Input
              id="taxNumber"
              placeholder="300000000000003"
              value={current.taxNumber ?? ""}
              onChange={e => set("taxNumber", e.target.value)}
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">يظهر على الفواتير الإلكترونية ورمز QR</p>
          </div>

          <Separator />

          {/* ZATCA */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">الفوترة الإلكترونية ZATCA</p>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">تجريبي</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                تفعيل بيانات ZATCA (QR Code، UUID، التوقيع الرقمي) على الفواتير
              </p>
            </div>
            <Switch
              checked={current.zatcaEnabled}
              onCheckedChange={v => set("zatcaEnabled", v)}
            />
          </div>

          {current.zatcaEnabled && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-amber-400">ملاحظة حول ZATCA</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>يُنشئ النظام QR Code وفق معايير TLV السعودية</li>
                <li>يُعيّن UUID فريد لكل فاتورة</li>
                <li>التكامل الكامل مع بوابة ZATCA يحتاج شهادة رقمية</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> ملاحظات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={current.notes ?? ""}
            onChange={e => set("notes", e.target.value)}
            placeholder="ملاحظات داخلية حول الإعدادات الضريبية..."
            className="w-full min-h-[80px] bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end gap-3 pb-4">
        {isDirty && (
          <Button variant="outline" onClick={() => setForm(null)}>إلغاء</Button>
        )}
        <Button
          onClick={() => save.mutate(current)}
          disabled={save.isPending || !isDirty}
          className="gap-2"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
}
