import { useListAiTasks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Search, RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";

const TASK_TYPE_MAP: Record<string, string> = {
  summarize: "تلخيص مستند",
  risk_analysis: "تحليل مخاطر",
  extract: "استخراج بيانات"
};

const STATUS_MAP: Record<string, { label: string, icon: any, color: string }> = {
  pending: { label: "في الانتظار", icon: Clock, color: "bg-muted text-muted-foreground" },
  running: { label: "قيد المعالجة", icon: RefreshCw, color: "bg-secondary text-secondary-foreground" },
  done: { label: "مكتمل", icon: CheckCircle2, color: "bg-primary text-primary-foreground" },
  failed: { label: "فشل", icon: AlertCircle, color: "bg-destructive text-destructive-foreground" },
};

export default function AiTasks() {
  const { data: tasks, isLoading } = useListAiTasks();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">مهام الذكاء الاصطناعي</h1>
          <p className="text-muted-foreground mt-1">متابعة تحليلات وملخصات الذكاء الاصطناعي</p>
        </div>
        <Button className="hover-elevate">
          <Bot className="ml-2 h-4 w-4" />
          مهمة تحليل جديدة
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="البحث في المهام..." className="pl-4 pr-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-right">نوع المهمة</TableHead>
                <TableHead className="text-right">القضية المرتبطة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الأولوية</TableHead>
                <TableHead className="text-right">تاريخ الطلب</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[100px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : tasks?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    لا توجد مهام ذكاء اصطناعي حالية
                  </TableCell>
                </TableRow>
              ) : (
                tasks?.map((task) => {
                  const statusInfo = STATUS_MAP[task.status] || STATUS_MAP.pending;
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <TableRow key={task.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          {TASK_TYPE_MAP[task.type] || task.type}
                        </div>
                      </TableCell>
                      <TableCell>{task.caseName || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`flex w-fit items-center gap-1 border-0 ${statusInfo.color}`}>
                          <StatusIcon className={`h-3 w-3 ${task.status === 'running' ? 'animate-spin' : ''}`} />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{task.priority || "عادي"}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(task.createdAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="w-full">التفاصيل</Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}