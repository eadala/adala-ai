import { useListDocuments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Upload, File, FileText, Download, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Documents() {
  const { data: documents, isLoading } = useListDocuments();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">مكتبة المستندات</h1>
          <p className="text-muted-foreground mt-1">إدارة جميع الملفات والمرفقات القانونية</p>
        </div>
        <Button className="hover-elevate">
          <Upload className="ml-2 h-4 w-4" />
          رفع مستند جديد
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="البحث في المستندات والنصوص المستخرجة..." className="pl-4 pr-10" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6 h-32"><Skeleton className="h-full w-full" /></CardContent></Card>
          ))}
        </div>
      ) : documents?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">لا توجد مستندات</h3>
          <p className="text-muted-foreground">لم تقم برفع أي مستندات حتى الآن.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents?.map((doc) => (
            <Card key={doc.id} className="hover-elevate group cursor-pointer transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-secondary/10 rounded-lg text-secondary">
                    <File className="h-6 w-6" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <h3 className="font-semibold text-base line-clamp-1" title={doc.fileName || ""}>{doc.fileName}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs font-normal">{doc.fileType}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                  {doc.caseName && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <span className="font-medium text-foreground">القضية:</span> {doc.caseName}
                    </p>
                  )}
                  {doc.aiSummary && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-md text-xs border border-border/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-1 h-full bg-accent"></div>
                      <p className="line-clamp-2">{doc.aiSummary}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}