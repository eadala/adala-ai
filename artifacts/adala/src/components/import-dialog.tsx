import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle2, AlertTriangle, Loader2, FileText, X } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: "clients" | "cases";
  queryKey: string[];
}

const TEMPLATES = {
  clients: {
    headers: ["name", "email", "phone", "type", "city"],
    samples: [
      ["محمد العمري", "m.omari@email.com", "0501234567", "individual", "الرياض"],
      ["شركة الأفق", "info@ufuq.com", "0112345678", "company", "جدة"],
    ],
    label: "العملاء",
  },
  cases: {
    headers: ["title", "case_number", "type", "status", "court"],
    samples: [
      ["قضية عقد إيجار", "2024/1234", "civil", "open", "المحكمة العامة بالرياض"],
      ["نزاع تجاري", "2024/5678", "commercial", "in_progress", "المحكمة التجارية"],
    ],
    label: "القضايا",
  },
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  }).filter(r => Object.values(r).some(v => v.trim()));
}

export function ImportDialog({ open, onOpenChange, type, queryKey }: ImportDialogProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const tpl = TEMPLATES[type];

  const importMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/import/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast.error(d.error); return; }
      qc.invalidateQueries({ queryKey });
      toast.success(`تم استيراد ${d.inserted} سجل بنجاح${d.errors?.length ? ` (${d.errors.length} خطأ)` : ""}`);
      onOpenChange(false);
      setRows([]);
      setFileName("");
    },
    onError: () => toast.error("حدث خطأ في الاستيراد"),
  });

  function downloadTemplate() {
    const csv = [tpl.headers.join(","), ...tpl.samples.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `template_${type}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  function close() { onOpenChange(false); setRows([]); setFileName(""); }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="bg-card border-border max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            استيراد {tpl.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template download */}
          <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">حمّل النموذج أولاً، أضف بياناتك، ثم ارفع الملف</p>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> تحميل نموذج CSV
            </Button>
          </div>

          {/* File upload */}
          <div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            {!rows.length ? (
              <Button
                variant="outline"
                className="w-full h-20 flex-col gap-1 border-dashed"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm">اضغط لرفع ملف CSV</span>
              </Button>
            ) : (
              <div className="rounded-xl bg-muted/30 border border-border p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium">{fileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{rows.length} سجل</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setRows([]); setFileName(""); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {/* Preview */}
                <div className="overflow-x-auto max-h-40 rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {Object.keys(rows[0] ?? {}).slice(0, 5).map(h => (
                          <th key={h} className="px-2 py-1.5 text-right text-muted-foreground font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-border/50">
                          {Object.values(row).slice(0, 5).map((v: any, j) => (
                            <td key={j} className="px-2 py-1.5 text-foreground">{v || "-"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 5 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
                    و {rows.length - 5} سجل آخر...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Columns hint */}
          <div className="text-[11px] text-muted-foreground">
            <span className="font-medium">الأعمدة المطلوبة: </span>
            {tpl.headers.join(" • ")}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>إلغاء</Button>
          <Button
            onClick={() => importMut.mutate()}
            disabled={rows.length === 0 || importMut.isPending}
            className="bg-primary hover:bg-primary/90 text-black font-bold gap-1.5"
          >
            {importMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            استيراد {rows.length > 0 ? `(${rows.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
