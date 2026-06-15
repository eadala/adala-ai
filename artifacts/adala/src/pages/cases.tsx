import { useState } from "react";
import { useListCases, useCreateCase } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Search, Plus, Filter, MoreHorizontal, Upload, Scale, Clock, CheckCheck, LayoutGrid, List } from "lucide-react";
import { ImportDialog } from "@/components/import-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListCasesQueryKey } from "@workspace/api-client-react";
import { DocumentPrintTemplate, PrintButton } from "@/components/document-print-template";
import { useBranding } from "@/hooks/use-branding";
import { useLang } from "@/hooks/use-lang";
import { cn } from "@/lib/utils";

const STATUS_CFG = {
  all:         { label: "الكل",         icon: Filter,     color: "text-muted-foreground", bg: "" },
  open:        { label: "مفتوحة",       icon: Scale,      color: "text-blue-400",         bg: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  in_progress: { label: "قيد التنفيذ",  icon: Clock,      color: "text-amber-400",        bg: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  closed:      { label: "مغلقة",        icon: CheckCheck, color: "text-slate-400",         bg: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
};

const TYPE_MAP: Record<string, string> = {
  all:         "كل الأنواع",
  criminal:    "جنائية",
  civil:       "مدنية",
  commercial:  "تجارية",
  labor:       "عمالية",
  real_estate: "عقارية",
};

export default function Cases() {
  const [searchTerm, setSearchTerm]     = useState("");
  const [importOpen, setImportOpen]     = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter]     = useState<string>("all");
  const [viewMode, setViewMode]         = useState<"table" | "kanban">("table");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newCase, setNewCase] = useState({ title: "", caseType: "civil", clientName: "" });

  const { data: cases, isLoading } = useListCases();
  const createCase  = useCreateCase();
  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const { tx, dateLocale, dir } = useLang();

  const handleCreate = () => {
    if (!newCase.title) return;
    createCase.mutate(
      { data: { title: newCase.title, caseType: newCase.caseType, clientName: newCase.clientName, status: "open" } },
      {
        onSuccess: () => {
          setIsNewDialogOpen(false);
          setNewCase({ title: "", caseType: "civil", clientName: "" });
          queryClient.invalidateQueries({ queryKey: getListCasesQueryKey() });
          toast({ title: "تم إنشاء القضية", description: "تمت إضافة القضية الجديدة بنجاح." });
        }
      }
    );
  };

  const filteredCases = cases?.filter(c => {
    const matchSearch = c.title.includes(searchTerm) || (c.clientName && c.clientName.includes(searchTerm));
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchType   = typeFilter   === "all" || c.caseType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const countByStatus = (s: string) => cases?.filter(c => s === "all" ? true : c.status === s).length ?? 0;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tx("إدارة القضايا", "Case Management")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{tx("عرض وإدارة جميع القضايا النشطة والمغلقة", "View and manage all active and closed cases")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
            <Upload className="h-4 w-4" /> CSV
          </Button>
          <ImportDialog open={importOpen} onOpenChange={setImportOpen} type="cases" queryKey={[...getListCasesQueryKey()] as string[]} />
          <PrintButton label="PDF">
            <DocumentPrintTemplate
              title={tx("كشف القضايا", "Cases Report")}
              subtitle={`إجمالي: ${filteredCases?.length ?? 0}`}
              date={new Date().toLocaleDateString(dateLocale)}
              showStamp showSignature
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    {[tx("عنوان القضية","Case Title"), tx("العميل","Client"), tx("النوع","Type"), tx("الحالة","Status"), tx("التاريخ","Date")]
                      .map(h => <th key={h} style={{ border:"1px solid #ddd", padding:"8px", textAlign:"right" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases?.map((c, i) => (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ border:"1px solid #ddd", padding:"8px" }}>{c.title}</td>
                      <td style={{ border:"1px solid #ddd", padding:"8px" }}>{c.clientName || "—"}</td>
                      <td style={{ border:"1px solid #ddd", padding:"8px" }}>{TYPE_MAP[c.caseType] || c.caseType}</td>
                      <td style={{ border:"1px solid #ddd", padding:"8px" }}>{STATUS_CFG[c.status as keyof typeof STATUS_CFG]?.label || c.status}</td>
                      <td style={{ border:"1px solid #ddd", padding:"8px" }}>{new Date(c.createdAt).toLocaleDateString(dateLocale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DocumentPrintTemplate>
          </PrintButton>
          <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
            <DialogTrigger asChild>
              <Button className="hover-elevate gap-1.5">
                <Plus className="h-4 w-4" />{tx("قضية جديدة", "New Case")}
              </Button>
            </DialogTrigger>
            <DialogContent dir={dir}>
              <DialogHeader><DialogTitle>{tx("إضافة قضية جديدة","Add New Case")}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{tx("عنوان القضية","Case Title")}</Label>
                  <Input value={newCase.title} onChange={e => setNewCase({...newCase, title: e.target.value})}
                    placeholder={tx("مثال: قضية نزاع تجاري","e.g. Commercial dispute")} />
                </div>
                <div className="space-y-2">
                  <Label>{tx("اسم العميل","Client Name")}</Label>
                  <Input value={newCase.clientName} onChange={e => setNewCase({...newCase, clientName: e.target.value})}
                    placeholder={tx("اسم العميل أو الشركة","Client or company name")} />
                </div>
                <div className="space-y-2">
                  <Label>{tx("نوع القضية","Case Type")}</Label>
                  <Select value={newCase.caseType} onValueChange={v => setNewCase({...newCase, caseType: v})}>
                    <SelectTrigger dir={dir}><SelectValue /></SelectTrigger>
                    <SelectContent dir={dir}>
                      {Object.entries(TYPE_MAP).filter(([k]) => k !== "all").map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>{tx("إلغاء","Cancel")}</Button>
                <Button onClick={handleCreate} disabled={createCase.isPending}>
                  {createCase.isPending ? tx("جاري الإنشاء...","Creating...") : tx("إنشاء القضية","Create Case")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Status filter tabs ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.entries(STATUS_CFG) as [string, typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([key, cfg]) => {
          const count = countByStatus(key);
          const active = statusFilter === key;
          return (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70"
              )}>
              <cfg.icon className="h-3 w-3" />
              {cfg.label}
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full",
                active ? "bg-primary/10" : "bg-muted text-muted-foreground")}>
                {count}
              </span>
            </button>
          );
        })}
        <div className="flex-1" />
        {/* Type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 text-xs w-36" dir={dir}>
            <SelectValue placeholder="نوع القضية" />
          </SelectTrigger>
          <SelectContent dir={dir}>
            {Object.entries(TYPE_MAP).map(([key, label]) => (
              <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* View toggle */}
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode("table")}
            className={cn("px-2.5 py-1.5 text-xs transition-colors", viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            <List className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMode("kanban")}
            className={cn("px-2.5 py-1.5 text-xs transition-colors", viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={tx("ابحث بعنوان القضية أو اسم العميل...", "Search cases...")}
          className="pr-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {/* ── Kanban View ── */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["open","in_progress","closed"] as const).map(s => {
            const cfg = STATUS_CFG[s];
            const cols = filteredCases?.filter(c => c.status === s) ?? [];
            return (
              <div key={s} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <cfg.icon className={cn("h-4 w-4", cfg.color)} />
                  <span className="text-sm font-semibold">{cfg.label}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{cols.length}</Badge>
                </div>
                <div className="space-y-2 min-h-24">
                  {isLoading ? (
                    Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl" />)
                  ) : cols.length === 0 ? (
                    <div className="border-2 border-dashed border-border/40 rounded-xl h-20 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground/50">لا توجد قضايا</span>
                    </div>
                  ) : cols.map(c => (
                    <Link key={c.id} href={`/cases/${c.id}`}>
                      <div className="p-3 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                        <p className="text-sm font-medium mb-1 line-clamp-2">{c.title}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{c.clientName || "—"}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 border", cfg.bg)}>{TYPE_MAP[c.caseType] || c.caseType}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                          {new Date(c.createdAt).toLocaleDateString(dateLocale)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table View ── */
        <Card>
          <CardHeader className="p-0" />
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-right">{tx("عنوان القضية","Case Title")}</TableHead>
                  <TableHead className="text-right">{tx("العميل","Client")}</TableHead>
                  <TableHead className="text-right">{tx("النوع","Type")}</TableHead>
                  <TableHead className="text-right">{tx("الحالة","Status")}</TableHead>
                  <TableHead className="text-right">{tx("التاريخ","Date")}</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({length:5}).map((_,i) => (
                    <TableRow key={i}>
                      {[250,150,80,80,100,0].map((w,j) => (
                        <TableCell key={j}>{w > 0 && <Skeleton className={`h-4 w-[${w}px]`} />}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !filteredCases?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Scale className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      {tx("لم يتم العثور على قضايا","No cases found")}
                    </TableCell>
                  </TableRow>
                ) : filteredCases.map(c => {
                  const sCfg = STATUS_CFG[c.status as keyof typeof STATUS_CFG];
                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Link href={`/cases/${c.id}`} className="hover:text-primary hover:underline transition-colors">
                            {c.title}
                          </Link>
                          {(c as any).source === "store" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-600 bg-amber-500/10 shrink-0">
                              من المتجر
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.clientName || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_MAP[c.caseType] || c.caseType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs border", sCfg?.bg)}>
                          {sCfg?.label || c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(c.createdAt).toLocaleDateString(dateLocale)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/cases/${c.id}`}>{tx("عرض التفاصيل","View Details")}</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">{tx("أرشفة","Archive")}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
