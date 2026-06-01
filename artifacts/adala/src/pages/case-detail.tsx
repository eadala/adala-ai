import { useGetCase, useUpdateCase, getGetCaseQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, FileText, MessageSquare, Bot, User, Clock, Settings } from "lucide-react";
import { Link } from "wouter";

const STATUS_MAP: Record<string, string> = {
  open: "مفتوحة",
  in_progress: "قيد التنفيذ",
  closed: "مغلقة"
};

const TYPE_MAP: Record<string, string> = {
  criminal: "جنائية",
  civil: "مدنية",
  commercial: "تجارية",
  labor: "عمالية",
  real_estate: "عقارية",
};

export default function CaseDetail({ id }: { id: string }) {
  const { data: caseData, isLoading } = useGetCase(id, { query: { enabled: !!id, queryKey: getGetCaseQueryKey(id) } });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Card><CardContent className="h-40 p-6"><Skeleton className="h-full w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!caseData) return <div>Case not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/cases" className="text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{caseData.title}</h1>
            <p className="text-muted-foreground mt-1">رقم المرجع: {caseData.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Settings className="ml-2 h-4 w-4" />
            إعدادات القضية
          </Button>
          <Button>تحديث الحالة</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل القضية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p>{caseData.description || "لا يوجد وصف متاح."}</p>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="documents" dir="rtl" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="documents"><FileText className="ml-2 h-4 w-4" /> المستندات</TabsTrigger>
              <TabsTrigger value="messages"><MessageSquare className="ml-2 h-4 w-4" /> المراسلات</TabsTrigger>
              <TabsTrigger value="ai"><Bot className="ml-2 h-4 w-4" /> تحليل الذكاء الاصطناعي</TabsTrigger>
            </TabsList>
            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد مستندات مرفقة حتى الآن.</p>
                  <Button variant="outline" className="mt-4">رفع مستند</Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="messages" className="mt-4">
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد مراسلات حديثة.</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="ai" className="mt-4">
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>يمكنك استخدام الذكاء الاصطناعي لتلخيص القضية أو استخراج البيانات.</p>
                  <Button variant="outline" className="mt-4">بدء تحليل جديد</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>معلومات أساسية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col space-y-1">
                <span className="text-xs text-muted-foreground">الحالة</span>
                <Badge className="w-fit">
                  {STATUS_MAP[caseData.status] || caseData.status}
                </Badge>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-xs text-muted-foreground">النوع</span>
                <span className="font-medium text-sm">{TYPE_MAP[caseData.caseType] || caseData.caseType}</span>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-xs text-muted-foreground">الموكل</span>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{caseData.clientName || "غير محدد"}</span>
                </div>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-xs text-muted-foreground">تاريخ الإنشاء</span>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {new Date(caseData.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}