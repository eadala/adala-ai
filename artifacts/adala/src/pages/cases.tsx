import { useState } from "react";
import { useListCases, useCreateCase } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Search, Plus, Filter, MoreHorizontal, Printer, Upload } from "lucide-react";
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

export default function Cases() {
  const [searchTerm, setSearchTerm] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const { data: cases, isLoading } = useListCases();
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newCase, setNewCase] = useState({ title: "", caseType: "civil", clientName: "" });
  const createCase = useCreateCase();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tx, dateLocale, dir } = useLang();

  const STATUS_MAP: Record<string, string> = {
    open: tx("مفتوحة", "Open"),
    in_progress: tx("قيد التنفيذ", "In Progress"),
    closed: tx("مغلقة", "Closed"),
  };

  const TYPE_MAP: Record<string, string> = {
    criminal:    tx("جنائية", "Criminal"),
    civil:       tx("مدنية", "Civil"),
    commercial:  tx("تجارية", "Commercial"),
    labor:       tx("عمالية", "Labor"),
    real_estate: tx("عقارية", "Real Estate"),
  };

  const handleCreate = () => {
    if (!newCase.title) return;
    createCase.mutate(
      { data: { title: newCase.title, caseType: newCase.caseType, clientName: newCase.clientName, status: "open" } },
      {
        onSuccess: () => {
          setIsNewDialogOpen(false);
          setNewCase({ title: "", caseType: "civil", clientName: "" });
          queryClient.invalidateQueries({ queryKey: getListCasesQueryKey() });
          toast({ title: tx("تم إنشاء القضية", "Case Created"), description: tx("تمت إضافة القضية الجديدة بنجاح.", "New case added successfully.") });
        }
      }
    );
  };

  const filteredCases = cases?.filter(c =>
    c.title.includes(searchTerm) ||
    (c.clientName && c.clientName.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tx("إدارة القضايا", "Case Management")}</h1>
          <p className="text-muted-foreground mt-1">{tx("عرض وإدارة جميع القضايا النشطة والمغلقة", "View and manage all active and closed cases")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
            <Upload className="h-4 w-4" /> {tx("استيراد CSV", "Import CSV")}
          </Button>
          <ImportDialog open={importOpen} onOpenChange={setImportOpen} type="cases" queryKey={[...getListCasesQueryKey()] as string[]} />
          <PrintButton label={tx("تصدير PDF", "Export PDF")}>
            <DocumentPrintTemplate
              title={tx("كشف القضايا", "Cases Report")}
              subtitle={tx(`إجمالي القضايا: ${filteredCases?.length ?? 0}`, `Total cases: ${filteredCases?.length ?? 0}`)}
              date={new Date().toLocaleDateString(dateLocale)}
              showStamp
              showSignature
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    {[
                      tx("عنوان القضية", "Case Title"),
                      tx("العميل", "Client"),
                      tx("النوع", "Type"),
                      tx("الحالة", "Status"),
                      tx("تاريخ الإضافة", "Date Added"),
                    ].map(h => (
                      <th key={h} style={{ border: "1px solid #ddd", padding: "8px", textAlign: "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases?.map((c, i) => (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ border: "1px solid #ddd", padding: "8px" }}>{c.title}</td>
                      <td style={{ border: "1px solid #ddd", padding: "8px" }}>{c.clientName || "—"}</td>
                      <td style={{ border: "1px solid #ddd", padding: "8px" }}>{TYPE_MAP[c.caseType] || c.caseType}</td>
                      <td style={{ border: "1px solid #ddd", padding: "8px" }}>{STATUS_MAP[c.status] || c.status}</td>
                      <td style={{ border: "1px solid #ddd", padding: "8px" }}>{new Date(c.createdAt).toLocaleDateString(dateLocale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DocumentPrintTemplate>
          </PrintButton>
          <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
            <DialogTrigger asChild>
              <Button className="hover-elevate">
                <Plus className="ml-2 h-4 w-4" />
                {tx("قضية جديدة", "New Case")}
              </Button>
            </DialogTrigger>
            <DialogContent dir={dir}>
              <DialogHeader>
                <DialogTitle>{tx("إضافة قضية جديدة", "Add New Case")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{tx("عنوان القضية", "Case Title")}</Label>
                  <Input id="title" value={newCase.title} onChange={e => setNewCase({...newCase, title: e.target.value})} placeholder={tx("مثال: قضية نزاع تجاري لشركة الرواد", "e.g., Commercial dispute – Al-Ruwad Co.")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">{tx("اسم العميل", "Client Name")}</Label>
                  <Input id="clientName" value={newCase.clientName} onChange={e => setNewCase({...newCase, clientName: e.target.value})} placeholder={tx("اسم العميل أو الشركة", "Client or company name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{tx("نوع القضية", "Case Type")}</Label>
                  <Select value={newCase.caseType} onValueChange={v => setNewCase({...newCase, caseType: v})}>
                    <SelectTrigger dir={dir}>
                      <SelectValue placeholder={tx("اختر نوع القضية", "Select case type")} />
                    </SelectTrigger>
                    <SelectContent dir={dir}>
                      {Object.entries(TYPE_MAP).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>{tx("إلغاء", "Cancel")}</Button>
                <Button onClick={handleCreate} disabled={createCase.isPending}>
                  {createCase.isPending ? tx("جاري الإنشاء...", "Creating...") : tx("إنشاء القضية", "Create Case")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 max-w-sm w-full">
            <div className="relative w-full">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={tx("ابحث برقم أو عنوان القضية...", "Search by number or case title...")}
                className="w-full pl-4 pr-10"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-right">{tx("عنوان القضية", "Case Title")}</TableHead>
                <TableHead className="text-right">{tx("العميل", "Client")}</TableHead>
                <TableHead className="text-right">{tx("النوع", "Type")}</TableHead>
                <TableHead className="text-right">{tx("الحالة", "Status")}</TableHead>
                <TableHead className="text-right">{tx("تاريخ الإضافة", "Date Added")}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : filteredCases?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    {tx("لم يتم العثور على قضايا", "No cases found")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCases?.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <Link href={`/cases/${c.id}`} className="hover:text-primary transition-colors hover:underline">
                        {c.title}
                      </Link>
                    </TableCell>
                    <TableCell>{c.clientName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-secondary/10 text-secondary-foreground border-secondary/20">
                        {TYPE_MAP[c.caseType] || c.caseType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'open' ? 'default' : c.status === 'in_progress' ? 'secondary' : 'outline'}
                             className={c.status === 'open' ? 'bg-primary text-primary-foreground' : ''}>
                        {STATUS_MAP[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
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
                            <Link href={`/cases/${c.id}`}>{tx("عرض التفاصيل", "View Details")}</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>{tx("تعديل القضية", "Edit Case")}</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">{tx("أرشفة", "Archive")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
