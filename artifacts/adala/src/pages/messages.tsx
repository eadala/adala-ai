import { useListMessages } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MessageCircle, Mail, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Messages() {
  const { data: messages, isLoading } = useListMessages();

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">المراسلات</h1>
        <p className="text-muted-foreground mt-1">إدارة رسائل البريد الإلكتروني وواتساب للعملاء</p>
      </div>

      <Card className="flex-1 flex overflow-hidden border-border/60 shadow-sm">
        {/* Sidebar */}
        <div className="w-80 border-l border-border/60 bg-muted/10 flex flex-col">
          <div className="p-4 border-b border-border/60">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="البحث في الرسائل..." className="pl-4 pr-10 bg-background" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 border-b border-border/40"><Skeleton className="h-12 w-full" /></div>
              ))
            ) : (
              messages?.map((msg) => (
                <div key={msg.id} className="p-4 border-b border-border/40 hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm">{msg.caseName || "رسالة"}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {msg.channel === 'whatsapp' ? 
                      <MessageCircle className="h-3 w-3 text-emerald-500" /> : 
                      <Mail className="h-3 w-3 text-blue-500" />
                    }
                    <p className="text-xs text-muted-foreground line-clamp-1 flex-1">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-background">
          <div className="p-4 border-b border-border/60 bg-muted/5 shadow-sm z-10 flex justify-between items-center">
            <div>
              <h3 className="font-semibold">اختر رسالة لعرضها</h3>
              <p className="text-xs text-muted-foreground mt-0.5">يمكنك الرد عبر واتساب أو البريد الإلكتروني مباشرة</p>
            </div>
          </div>
          
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
            <MessageCircle className="h-16 w-16 opacity-20 mb-4" />
            <p>قم باختيار محادثة من القائمة لعرض الرسائل</p>
          </div>

          <div className="p-4 border-t border-border/60 bg-card">
            <div className="flex items-end gap-2">
              <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 text-muted-foreground rounded-full">
                <Mail className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 text-muted-foreground rounded-full">
                <MessageCircle className="h-4 w-4" />
              </Button>
              <div className="relative flex-1">
                <Input 
                  placeholder="اكتب رسالتك هنا..." 
                  className="w-full pr-4 pl-12 h-10 rounded-full bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:bg-background transition-all" 
                  disabled
                />
                <Button size="icon" className="absolute left-1 top-1 h-8 w-8 rounded-full" disabled>
                  <Send className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}