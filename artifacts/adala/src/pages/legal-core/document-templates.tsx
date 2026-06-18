import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  FileText, Plus, Eye, Download, BookOpen, Scale, Handshake,
  FileSignature, Search, Loader2, CheckCircle, Printer, Clock,
  ArrowRight, Star
} from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"])[^'"]*\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "");
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  contracts:  { label: "عقود",        color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  litigation: { label: "تقاضي",       color: "bg-red-500/15 text-red-400 border-red-500/30" },
  corporate:  { label: "شركات",       color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  other:      { label: "أخرى",        color: "bg-muted/30 15 text-muted-foreground border-slate-500/30" },
};

const TYPE_MAP: Record<string, { label: string; icon: any }> = {
  power_of_attorney: { label: "عقد توكيل",              icon: FileSignature },
  lease_agreement:   { label: "عقد إيجار",              icon: BookOpen },
  nda:               { label: "اتفاقية سرية",           icon: FileText },
  partnership:       { label: "عقد شراكة",              icon: Handshake },
  lawsuit:           { label: "صحيفة دعوى",             icon: Scale },
  other:             { label: "قالب مخصص",              icon: FileText },
};

function FieldInput({ field, value, onChange }: { field: any; value: string; onChange: (v: string) => void }) {
  if (field.type === "textarea") {
    return (
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder={field.label}
        className="text-sm resize-none"
      />
    );
  }
  return (
    <Input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={field.label}
      className="text-sm"
      dir={field.type === "date" ? "ltr" : undefined}
    />
  );
}

function TemplateCard({ template, onUse }: { template: any; onUse: (t: any) => void }) {
  const TypeIcon = TYPE_MAP[template.type]?.icon ?? FileText;
  const cat = CATEGORY_MAP[template.category] ?? CATEGORY_MAP.other;

  return (
    <Card className="hover:border-primary/40 transition-all cursor-pointer group" onClick={() => onUse(template)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 bg-primary/10 rounded-lg">
            <TypeIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-1.5">
            {template.is_default && (
              <span className="text-[10px] bg-primary/15 text-primary border border-primary/30 rounded px-1.5 py-0.5 flex items-center gap-1">
                <Star className="h-2.5 w-2.5" />افتراضي
              </span>
            )}
            <Badge className={`text-[10px] px-1.5 border ${cat.color}`}>{cat.label}</Badge>
          </div>
        </div>
        <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {Array.isArray(template.fields) ? template.fields.length : 0} حقل
          </span>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary">
            <FileText className="h-3 w-3" />إنشاء وثيقة
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GeneratedDocRow({ doc, onView }: { doc: any; onView: (d: any) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium">{doc.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{doc.template_name}</span>
            {doc.case_id && <span className="text-blue-400">• مرتبط بقضية</span>}
            {doc.client_id && <span className="text-violet-400">• مرتبط بعميل</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(doc.created_at).toLocaleDateString("ar-EG")}
        </span>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onView(doc)}>
          <Eye className="h-3 w-3" />عرض
        </Button>
      </div>
    </div>
  );
}

export default function DocumentTemplates() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [filledData, setFilledData] = useState<Record<string, string>>({});
  const [linkedCaseId, setLinkedCaseId] = useState("");
  const [linkedClientId, setLinkedClientId] = useState("");
  const [docName, setDocName] = useState("");
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", type: "other", category: "contracts", description: "", body: "", fields: "[]" });

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["document-templates"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/document-templates`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const { data: generatedDocs = [], isLoading: genLoading } = useQuery<any[]>({
    queryKey: ["generated-documents"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/generated-documents`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: cases = [] } = useQuery<any[]>({
    queryKey: ["cases-list"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/cases`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/clients`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) return;
      const r = await fetch(`${BASE}/api/document-templates/${selectedTemplate.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filledData,
          caseId: linkedCaseId === "none" || !linkedCaseId ? null : linkedCaseId,
          clientId: linkedClientId === "none" || !linkedClientId ? null : linkedClientId,
          documentName: docName || null,
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "فشل الإنشاء");
      }
      return r.json();
    },
    onSuccess: (data) => {
      toast.success("تم إنشاء الوثيقة وحفظها ✅");
      qc.invalidateQueries({ queryKey: ["generated-documents"] });
      setEditorOpen(false);
      setPreviewDoc(data.document);
      setPreviewOpen(true);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addTemplateMutation = useMutation({
    mutationFn: async () => {
      let parsedFields: any[] = [];
      try { parsedFields = JSON.parse(newTemplate.fields); } catch { parsedFields = []; }
      if (!Array.isArray(parsedFields)) parsedFields = [];
      const r = await fetch(`${BASE}/api/document-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newTemplate, fields: parsedFields }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "فشل الحفظ");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("تم إضافة القالب ✅");
      qc.invalidateQueries({ queryKey: ["document-templates"] });
      setAddTemplateOpen(false);
      setNewTemplate({ name: "", type: "other", category: "contracts", description: "", body: "", fields: "[]" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEditor = async (template: any) => {
    const r = await fetch(`${BASE}/api/document-templates/${template.id}`);
    if (!r.ok) { toast.error("فشل تحميل القالب"); return; }
    const full = await r.json();
    setSelectedTemplate(full);
    const initial: Record<string, string> = {};
    (full.fields ?? []).forEach((f: any) => { initial[f.key] = ""; });
    setFilledData(initial);
    setDocName(`${full.name} - ${new Date().toLocaleDateString("ar-EG")}`);
    setLinkedCaseId("");
    setLinkedClientId("");
    setEditorOpen(true);
  };

  const previewHtml = () => {
    if (!selectedTemplate?.body) return "";
    let html = selectedTemplate.body as string;
    for (const [key, value] of Object.entries(filledData)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), sanitizeHtml(value) || `<span style="color:#2563EB">[${key}]</span>`);
    }
    return sanitizeHtml(html);
  };

  const previewPdfBeforeSave = () => {
    const html = previewHtml();
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><title>${selectedTemplate?.name ?? "معاينة"}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"/><style>body{margin:0;padding:0;font-family:'Cairo',Arial,sans-serif;}@media print{body{margin:0;}}</style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  };

  const viewGeneratedDoc = async (doc: any) => {
    const r = await fetch(`${BASE}/api/generated-documents/${doc.id}`);
    if (!r.ok) { toast.error("فشل تحميل الوثيقة"); return; }
    const full = await r.json();
    setPreviewDoc(full);
    setPreviewOpen(true);
  };

  const printDoc = () => {
    const w = window.open("", "_blank");
    if (!w || !previewDoc) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><title>${previewDoc.name}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"/><style>body{margin:0;padding:0;font-family:'Cairo',Arial,sans-serif;}@media print{body{margin:0;}}</style></head><body>${previewDoc.generated_html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  };

  const filtered = templates.filter(t => {
    const matchCat = categoryFilter === "all" || t.category === categoryFilter;
    const matchSearch = !search || t.name.includes(search) || t.description?.includes(search);
    return matchCat && matchSearch;
  });

  const fields: any[] = selectedTemplate?.fields ?? [];
  const requiredFields = fields.filter((f: any) => f.required);
  const allRequiredFilled = requiredFields.every((f: any) => filledData[f.key]?.trim());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">مكتبة القوالب القانونية</h1>
          <p className="text-muted-foreground mt-1">قوالب جاهزة بالعربية وفق النظام السعودي</p>
        </div>
        <Button onClick={() => setAddTemplateOpen(true)} className="hover-elevate gap-2">
          <Plus className="h-4 w-4" />قالب مخصص
        </Button>
      </div>

      <Tabs defaultValue="library" dir="rtl">
        <TabsList className="h-9">
          <TabsTrigger value="library" className="text-xs">
            <BookOpen className="h-3.5 w-3.5 ms-1" />مكتبة القوالب
          </TabsTrigger>
          <TabsTrigger value="generated" className="text-xs">
            <CheckCircle className="h-3.5 w-3.5 ms-1" />وثائقي المنشأة
            {generatedDocs.length > 0 && <span className="me-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1">{generatedDocs.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* LIBRARY TAB */}
        <TabsContent value="library" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في القوالب..." className="pe-9 text-sm" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[["all","الكل"], ["contracts","عقود"], ["litigation","تقاضي"], ["corporate","شركات"]].map(([v, l]) => (
                <Button key={v} variant={categoryFilter === v ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setCategoryFilter(v)}>
                  {l}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1,2,3,4,5].map(i => <Card key={i}><CardContent className="p-5 h-36"><Skeleton className="h-full w-full" /></CardContent></Card>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-dashed">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">لا توجد قوالب تطابق البحث</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map(t => <TemplateCard key={t.id} template={t} onUse={openEditor} />)}
            </div>
          )}
        </TabsContent>

        {/* GENERATED DOCS TAB */}
        <TabsContent value="generated" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />الوثائق المنشأة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {genLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-8" /> :
               generatedDocs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <CheckCircle className="h-10 w-10 opacity-20" />
                  <p className="text-sm">لم تُنشئ أي وثائق حتى الآن</p>
                  <p className="text-xs">اختر قالباً من المكتبة وأنشئ أول وثيقة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {generatedDocs.map(doc => <GeneratedDocRow key={doc.id} doc={doc} onView={viewGeneratedDoc} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── EDITOR SHEET ── */}
      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent className="w-full sm:max-w-6xl overflow-y-auto" dir="rtl">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              إنشاء وثيقة: {selectedTemplate?.name}
            </SheetTitle>
          </SheetHeader>

          {selectedTemplate && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Form */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">اسم الوثيقة</Label>
                  <Input value={docName} onChange={e => setDocName(e.target.value)} className="text-sm" placeholder="اسم الوثيقة المُنشأة" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">ربط بقضية (اختياري)</Label>
                    <Select value={linkedCaseId || "none"} onValueChange={v => setLinkedCaseId(v === "none" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="اختر قضية" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون ربط</SelectItem>
                        {(cases as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">ربط بعميل (اختياري)</Label>
                    <Select value={linkedClientId || "none"} onValueChange={v => setLinkedClientId(v === "none" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="اختر عميل" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون ربط</SelectItem>
                        {(clients as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.fullName || c.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs font-medium mb-3 text-muted-foreground">حقول القالب</p>
                  <div className="space-y-3">
                    {fields.map((field: any) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          {field.label}
                          {field.required && <span className="text-red-400">*</span>}
                        </Label>
                        <FieldInput
                          field={field}
                          value={filledData[field.key] ?? ""}
                          onChange={v => setFilledData(prev => ({ ...prev, [field.key]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <Button
                    variant="outline"
                    onClick={previewPdfBeforeSave}
                    disabled={!allRequiredFilled}
                    className="w-full gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    معاينة PDF قبل الحفظ
                  </Button>
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={!allRequiredFilled || generateMutation.isPending}
                    className="w-full bg-primary hover:bg-primary/90 gap-2"
                  >
                    {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    إنشاء الوثيقة وحفظها
                  </Button>
                </div>
                {!allRequiredFilled && (
                  <p className="text-xs text-muted-foreground text-center">يرجى تعبئة الحقول الإلزامية (*) أولاً</p>
                )}
              </div>

              {/* Right: Live Preview */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">معاينة فورية</p>
                </div>
                <div className="border rounded-lg bg-white text-black overflow-y-auto max-h-[calc(100vh-220px)] min-h-80">
                  <div
                    className="text-sm"
                    style={{ fontSize: "12px" }}
                    dangerouslySetInnerHTML={{ __html: previewHtml() }}
                  />
                  {/* previewHtml() already applies sanitizeHtml() internally */}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── PREVIEW DIALOG ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                {previewDoc?.name}
              </span>
              <Button size="sm" variant="outline" onClick={printDoc} className="gap-1.5 h-8 text-xs me-8">
                <Printer className="h-3.5 w-3.5" />طباعة / PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg bg-white text-black overflow-y-auto">
            {previewDoc && (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewDoc.generated_html) }} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── ADD CUSTOM TEMPLATE DIALOG ── */}
      <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />إضافة قالب مخصص
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم القالب *</Label>
                <Input value={newTemplate.name} onChange={e => setNewTemplate(p => ({...p, name: e.target.value}))} placeholder="مثال: عقد استشارة" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">التصنيف</Label>
                <Select value={newTemplate.category} onValueChange={v => setNewTemplate(p => ({...p, category: v}))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contracts">عقود</SelectItem>
                    <SelectItem value="litigation">تقاضي</SelectItem>
                    <SelectItem value="corporate">شركات</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الوصف</Label>
              <Input value={newTemplate.description} onChange={e => setNewTemplate(p => ({...p, description: e.target.value}))} placeholder="وصف مختصر للقالب" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">نص القالب * (استخدم {"{{"}<span>{"حقل"}</span>{"}}"}  لوضع الحقول المتغيرة)</Label>
              <Textarea
                value={newTemplate.body}
                onChange={e => setNewTemplate(p => ({...p, body: e.target.value}))}
                rows={10}
                placeholder='<p>بسم الله الرحمن الرحيم</p><p>هذا العقد بين {{party_a}} و {{party_b}}</p>'
                className="font-mono text-xs"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">تعريف الحقول (JSON)</Label>
              <Textarea
                value={newTemplate.fields}
                onChange={e => setNewTemplate(p => ({...p, fields: e.target.value}))}
                rows={4}
                placeholder='[{"key":"party_a","label":"الطرف الأول","type":"text","required":true}]'
                className="font-mono text-xs"
                dir="ltr"
              />
            </div>
            <Button
              onClick={() => addTemplateMutation.mutate()}
              disabled={!newTemplate.name || !newTemplate.body || addTemplateMutation.isPending}
              className="w-full"
            >
              {addTemplateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ms-2" /> : <Plus className="h-4 w-4 ms-2" />}
              حفظ القالب
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
