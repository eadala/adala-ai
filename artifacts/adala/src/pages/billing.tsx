import { useGetSubscription, useListInvoices, useGetUsage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Download, Zap, Shield, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Billing() {
  const { data: sub, isLoading: subLoading } = useGetSubscription();
  const { data: invoices, isLoading: invoicesLoading } = useListInvoices();
  const { data: usage, isLoading: usageLoading } = useGetUsage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">الاشتراك والفوترة</h1>
        <p className="text-muted-foreground mt-1">إدارة باقة الاشتراك، الاستهلاك، والفواتير</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary"></div>
          <CardHeader>
            <CardTitle>الباقة الحالية</CardTitle>
            <CardDescription>أنت حالياً على باقة عدالة المميزة</CardDescription>
          </CardHeader>
          <CardContent>
            {subLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    {sub?.planName || "الخطة الاحترافية"}
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">{sub?.status === 'active' ? 'نشط' : 'غير نشط'}</Badge>
                  </h2>
                  <p className="text-muted-foreground mt-2">تاريخ التجديد القادم: {new Date(sub?.endDate || "").toLocaleDateString('ar-EG')}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">${sub?.planPrice || 0} <span className="text-base font-normal text-muted-foreground">/ شهرياً</span></div>
                  <Button className="mt-4" variant="outline">ترقية الباقة</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>طريقة الدفع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
              <div className="h-10 w-16 bg-white rounded flex items-center justify-center border shadow-sm">
                <CreditCard className="h-6 w-6 text-slate-800" />
              </div>
              <div>
                <p className="font-medium text-sm">•••• •••• •••• 4242</p>
                <p className="text-xs text-muted-foreground">ينتهي في 12/2025</p>
              </div>
            </div>
            <Button variant="link" className="w-full mt-4 text-primary">تحديث بيانات الدفع</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>استهلاك الذكاء الاصطناعي</CardTitle>
            <CardDescription>رصيد الاستهلاك للشهر الحالي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {usageLoading ? (
              <div className="space-y-4"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div>
            ) : usage?.map((u) => (
              <div key={u.id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium flex items-center gap-2">
                    {u.feature === 'ai_tokens' ? <Zap className="h-4 w-4 text-accent" /> : <FileText className="h-4 w-4" />}
                    {u.feature === 'ai_tokens' ? 'وحدات التحليل (Tokens)' : 'مساحة التخزين'}
                  </span>
                  <span className="text-muted-foreground">{u.units} / 100,000</span>
                </div>
                <Progress value={(u.units / 100000) * 100} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>سجل الفواتير</CardTitle>
            <CardDescription>فواتير الاشتراك السابقة</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoicesLoading ? (
                  <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ) : invoices?.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{new Date(invoice.createdAt).toLocaleDateString('ar-EG')}</TableCell>
                    <TableCell className="font-medium">${invoice.amount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : ''}>
                        {invoice.status === 'paid' ? 'مدفوعة' : 'مستحقة'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}