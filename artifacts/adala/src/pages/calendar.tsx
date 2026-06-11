import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  CalendarDays, ChevronRight, ChevronLeft, Plus, Trash2, Clock,
  MapPin, Scale, Bell, X, Loader2, CalendarCheck2, AlertCircle,
  Users, Briefcase, Star, RefreshCw
} from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/";

// ─── Types ────────────────────────────────────────────────────────────────────
type CalEvent = {
  id: string; title: string; event_type: string;
  start_at: string; end_at?: string; all_day: boolean;
  case_id?: string; client_id?: string; location?: string;
  description?: string; status: string; user_id: string;
};

// ─── Config ──────────────────────────────────────────────────────────────────
const EVENT_TYPES: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  court_session: { label: "جلسة محكمة",   color: "text-red-400",    bg: "bg-red-500/80",    icon: Scale },
  deadline:      { label: "موعد نهائي",   color: "text-orange-400", bg: "bg-orange-500/80", icon: AlertCircle },
  client_meeting:{ label: "اجتماع عميل",  color: "text-blue-400",   bg: "bg-blue-500/80",   icon: Users },
  team_meeting:  { label: "اجتماع فريق",  color: "text-green-400",  bg: "bg-green-500/80",  icon: Briefcase },
  task:          { label: "مهمة",          color: "text-purple-400", bg: "bg-purple-500/80", icon: Star },
  other:         { label: "أخرى",          color: "text-gray-400",   bg: "bg-gray-500/80",   icon: CalendarDays },
};

const REMINDER_OPTIONS = [
  { label: "30 دقيقة قبل",  value: 30 },
  { label: "ساعة واحدة قبل", value: 60 },
  { label: "3 ساعات قبل",   value: 180 },
  { label: "يوم قبل",        value: 1440 },
  { label: "يومان قبل",      value: 2880 },
];

const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"
];
const AR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_DAYS_SHORT = ["أح","اث","ثل","أر","خم","جم","سب"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatHijri(date: Date): string {
  try {
    return date.toLocaleDateString("ar-SA-u-ca-islamic", {
      day: "numeric", month: "long", year: "numeric"
    });
  } catch { return ""; }
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

// ─── New Event Dialog ─────────────────────────────────────────────────────────
function NewEventDialog({ selectedDate, onCreated }: { selectedDate: Date; onCreated: () => void }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("other");
  const [date, setDate] = useState(toLocalDateStr(selectedDate));
  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedReminders, setSelectedReminders] = useState<number[]>([60]);
  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress ?? "");

  const create = useMutation({
    mutationFn: async () => {
      const startAt = allDay ? `${date}T00:00:00` : `${date}T${time}:00`;
      const endAt   = allDay ? `${date}T23:59:00` : `${date}T${endTime}:00`;
      const r = await fetch(`${BASE}api/calendar/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id ?? "default",
          title, eventType, startAt, endAt, allDay,
          location: location || undefined,
          description: description || undefined,
          reminders: selectedReminders.map(m => ({ minutesBefore: m, email: email || undefined })),
        }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      toast.success("تم إنشاء الحدث ✅");
      setOpen(false);
      setTitle(""); setLocation(""); setDescription("");
      onCreated();
    },
    onError: () => toast.error("فشل إنشاء الحدث"),
  });

  const toggleReminder = (v: number) =>
    setSelectedReminders(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />إضافة حدث
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-primary" />إضافة حدث جديد
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>عنوان الحدث *</Label>
            <Input placeholder="مثال: جلسة استماع — قضية رقم 1234" value={title}
              onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع الحدث</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="allDay" checked={allDay} onCheckedChange={v => setAllDay(!!v)} />
            <label htmlFor="allDay" className="text-sm cursor-pointer">طوال اليوم</label>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>وقت البداية</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>وقت النهاية</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>المكان (اختياري)</Label>
            <Input placeholder="محكمة الاستئناف، غرفة 3" value={location}
              onChange={e => setLocation(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea placeholder="تفاصيل إضافية..." rows={2} value={description}
              onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Reminders */}
          <div className="space-y-2 bg-muted/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">التذكيرات بالبريد الإلكتروني</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {REMINDER_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => toggleReminder(opt.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    selectedReminders.includes(opt.value)
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/50"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {selectedReminders.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs text-muted-foreground">البريد الإلكتروني للتذكير</Label>
                <Input type="email" placeholder="example@domain.com" value={email}
                  onChange={e => setEmail(e.target.value)} className="h-8 text-sm" />
              </div>
            )}
          </div>

          <Button className="w-full" onClick={() => create.mutate()} disabled={!title || create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Plus className="h-4 w-4 ml-2" />}
            حفظ الحدث
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Event Dot ────────────────────────────────────────────────────────────────
function EventDot({ events }: { events: CalEvent[] }) {
  const shown = events.slice(0, 3);
  return (
    <div className="flex gap-0.5 justify-center mt-0.5 flex-wrap">
      {shown.map(e => {
        const cfg = EVENT_TYPES[e.event_type] ?? EVENT_TYPES.other;
        return <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${cfg.bg}`} />;
      })}
      {events.length > 3 && <span className="text-[8px] text-muted-foreground">+{events.length - 3}</span>}
    </div>
  );
}

// ─── Day Events Panel ─────────────────────────────────────────────────────────
function DayPanel({ date, events, onDelete, onRefresh }: {
  date: Date; events: CalEvent[]; onDelete: (id: string) => void; onRefresh: () => void;
}) {
  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">لا توجد أحداث في هذا اليوم</p>
      ) : (
        events.map(ev => {
          const cfg = EVENT_TYPES[ev.event_type] ?? EVENT_TYPES.other;
          const Icon = cfg.icon;
          const startTime = ev.all_day ? "طوال اليوم" : new Date(ev.start_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={ev.id} className="flex items-start gap-2 bg-muted/30 rounded-xl p-3 group">
              <div className={`p-1.5 rounded-lg ${cfg.bg} bg-opacity-20 shrink-0`}>
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight">{ev.title}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{startTime}
                  </span>
                  {ev.location && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{ev.location}
                    </span>
                  )}
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color} border-current/30`}>
                    {cfg.label}
                  </Badge>
                </div>
                {ev.description && <p className="text-xs text-muted-foreground mt-1 truncate">{ev.description}</p>}
              </div>
              <button onClick={() => onDelete(ev.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })
      )}
      <NewEventDialog selectedDate={date} onCreated={onRefresh} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Calendar() {
  const { user } = useUser();
  const qc = useQueryClient();
  const today = new Date();
  const [curMonth, setCurMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  const year  = curMonth.getFullYear();
  const month = curMonth.getMonth() + 1;

  const { data: events = [], isLoading, refetch } = useQuery<CalEvent[]>({
    queryKey: ["calendar-events", year, month],
    queryFn: () =>
      fetch(`${BASE}api/calendar/events?year=${year}&month=${month}&userId=${user?.id ?? ""}`).then(r => r.json()),
  });

  const { data: upcomingEvents = [] } = useQuery<CalEvent[]>({
    queryKey: ["calendar-upcoming"],
    queryFn: () =>
      fetch(`${BASE}api/calendar/events/upcoming?days=14&userId=${user?.id ?? ""}`).then(r => r.json()),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}api/calendar/events/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { toast.success("تم حذف الحدث"); qc.invalidateQueries({ queryKey: ["calendar-events"] }); qc.invalidateQueries({ queryKey: ["calendar-upcoming"] }); },
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["calendar-events"] }); qc.invalidateQueries({ queryKey: ["calendar-upcoming"] }); };

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = useMemo(() => {
    const grid: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      grid.push(new Date(year, month - 1, d));
    }
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [year, month, firstDay, daysInMonth]);

  const eventsOnDay = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.start_at), day));

  const selectedDayEvents = eventsOnDay(selectedDate);

  const prevMonth = () => setCurMonth(new Date(year, month - 2, 1));
  const nextMonth = () => setCurMonth(new Date(year, month, 1));
  const goToday   = () => { setCurMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); };

  const upcomingStats = {
    court:    upcomingEvents.filter(e => e.event_type === "court_session").length,
    deadline: upcomingEvents.filter(e => e.event_type === "deadline").length,
    meeting:  upcomingEvents.filter(e => ["client_meeting","team_meeting"].includes(e.event_type)).length,
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            التقويم والمواعيد
          </h1>
          <p className="text-muted-foreground mt-1">إدارة الجلسات والمواعيد والتذكيرات القانونية</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={goToday}>
            <RefreshCw className="h-3.5 w-3.5" />اليوم
          </Button>
          <NewEventDialog selectedDate={selectedDate} onCreated={refresh} />
        </div>
      </div>

      {/* Upcoming Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "جلسات قادمة", value: upcomingStats.court,    color: "text-red-400",    bg: "bg-red-500/10",    icon: Scale },
          { label: "مواعيد نهائية", value: upcomingStats.deadline, color: "text-orange-400", bg: "bg-orange-500/10", icon: AlertCircle },
          { label: "اجتماعات",     value: upcomingStats.meeting,  color: "text-blue-400",   bg: "bg-blue-500/10",   icon: Users },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${s.bg}`}>
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label} (14 يوم)</p>
                    <p className={`font-bold text-2xl ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <h2 className="font-bold text-lg">
                  {AR_MONTHS[month - 1]} {year}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {formatHijri(new Date(year, month - 1, 15))}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day Names */}
            <div className="grid grid-cols-7 mb-2">
              {AR_DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
              ))}
            </div>
            {/* Cells */}
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} />;
                  const dayEvents = eventsOnDay(day);
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, selectedDate);
                  const isFri = day.getDay() === 5;
                  const isSat = day.getDay() === 6;
                  return (
                    <button key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`relative flex flex-col items-center rounded-xl p-1.5 min-h-[52px] transition-all hover:bg-muted/50 ${
                        isSelected ? "bg-primary/20 border border-primary/40 ring-1 ring-primary/20" :
                        isToday    ? "bg-muted/70 border border-border" : ""
                      } ${(isFri || isSat) ? "opacity-70" : ""}`}>
                      <span className={`text-sm font-medium leading-tight ${
                        isToday ? "text-primary font-black" :
                        isFri || isSat ? "text-muted-foreground" : ""
                      }`}>
                        {day.getDate().toLocaleString("ar-SA")}
                      </span>
                      <EventDot events={dayEvents} />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Day Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CalendarCheck2 className="h-4 w-4 text-primary" />
              <div>
                <div>{selectedDate.toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" })}</div>
                <div className="text-xs font-normal text-muted-foreground mt-0.5">{formatHijri(selectedDate)}</div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DayPanel
              date={selectedDate}
              events={selectedDayEvents}
              onDelete={id => deleteEvent.mutate(id)}
              onRefresh={refresh}
            />
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events List */}
      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              المواعيد القادمة (14 يوم)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingEvents.map(ev => {
                const cfg = EVENT_TYPES[ev.event_type] ?? EVENT_TYPES.other;
                const Icon = cfg.icon;
                const startDate = new Date(ev.start_at);
                const diffDays = Math.ceil((startDate.getTime() - Date.now()) / 86400000);
                return (
                  <div key={ev.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 group">
                    <div className={`p-1.5 rounded-lg ${cfg.bg} bg-opacity-20 shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {startDate.toLocaleDateString("ar-SA", { weekday: "short", day: "numeric", month: "short" })}
                        {" · "}
                        {ev.all_day ? "طوال اليوم" : startDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        {ev.location ? ` · ${ev.location}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 ${
                        diffDays <= 1 ? "border-red-500/30 text-red-400" :
                        diffDays <= 3 ? "border-orange-500/30 text-orange-400" :
                        "border-border/50 text-muted-foreground"
                      }`}>
                        {diffDays <= 0 ? "اليوم" : diffDays === 1 ? "غداً" : `${diffDays} أيام`}
                      </Badge>
                      <button onClick={() => deleteEvent.mutate(ev.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
