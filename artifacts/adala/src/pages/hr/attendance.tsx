import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock, CheckCircle2, XCircle, UserCheck, LogIn, LogOut,
  Calendar, Users, Loader2, AlertTriangle, Search, Plus,
  MapPin, Navigation, Shield, ShieldCheck, ShieldX, Settings, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  present: { label: "حاضر", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
  absent: { label: "غائب", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: XCircle },
  late: { label: "متأخر", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: AlertTriangle },
  leave: { label: "إجازة", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", icon: Calendar },
};

function formatTime(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

function calcDuration(checkIn: string | null, checkOut: string | null) {
  if (!checkIn || !checkOut) return "—";
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3600000;
  const h = Math.floor(diff);
  const m = Math.floor((diff - h) * 60);
  return `${h}س ${m}د`;
}

function getMapLink(lat: string | null, lng: string | null) {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("المتصفح لا يدعم تحديد الموقع"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

export default function Attendance() {
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [showOfficeSetup, setShowOfficeSetup] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualStatus, setManualStatus] = useState("present");
  const [manualCheckIn, setManualCheckIn] = useState("08:00");
  const [manualCheckOut, setManualCheckOut] = useState("16:00");
  const [officeName, setOfficeName] = useState("المكتب الرئيسي");
  const [officeLat, setOfficeLat] = useState("");
  const [officeLng, setOfficeLng] = useState("");
  const [officeRadius, setOfficeRadius] = useState("200");
  const [gpsLoading, setGpsLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: records = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["attendance", dateFilter],
    queryFn: () => fetch(`${BASE}/api/hr/attendance${dateFilter ? `?date=${dateFilter}` : ""}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["attendance-stats"],
    queryFn: () => fetch("/api/hr/attendance/stats").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["employees"],
    queryFn: () => fetch("/api/hr/employees").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: officeLocation, refetch: refetchOffice } = useQuery<any>({
    queryKey: ["office-location"],
    queryFn: () => fetch("/api/hr/office-location").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const checkInMutation = useMutation({
    mutationFn: (body: any) => fetch("/api/hr/attendance/check-in", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance-stats"] });
      const loc = data.locationVerified === true
        ? "✅ تم التحقق من الموقع — داخل نطاق المكتب"
        : data.distanceMeters != null
        ? `⚠️ خارج نطاق المكتب (${data.distanceMeters} متر)`
        : "تم تسجيل الحضور بدون موقع";
      toast({ title: "تم تسجيل الحضور ✓", description: loc });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const checkOutMutation = useMutation({
    mutationFn: (body: any) => fetch("/api/hr/attendance/check-out", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast({ title: "تم تسجيل الانصراف ✓" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const manualMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/hr/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); setShowManual(false); toast({ title: "تم تسجيل الحضور اليدوي" }); },
  });

  const officeSetupMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/hr/office-location", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      refetchOffice();
      setShowOfficeSetup(false);
      toast({ title: "تم حفظ موقع المكتب ✓" });
    },
  });

  async function handleGpsCheckIn(empId: string) {
    setGpsLoading(empId);
    try {
      const pos = await getCurrentPosition();
      await checkInMutation.mutateAsync({
        employeeId: empId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (err: any) {
      toast({ title: "تعذّر تحديد الموقع", description: err.message || "تأكد من تفعيل GPS وإذن الموقع", variant: "destructive" });
    } finally {
      setGpsLoading(null);
    }
  }

  async function handleGpsCheckOut(empId: string) {
    setGpsLoading(`out-${empId}`);
    try {
      const pos = await getCurrentPosition();
      await checkOutMutation.mutateAsync({
        employeeId: empId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (err: any) {
      toast({ title: "تعذّر تحديد الموقع", description: err.message || "تأكد من تفعيل GPS وإذن الموقع", variant: "destructive" });
    } finally {
      setGpsLoading(null);
    }
  }

  async function captureCurrentAsOffice() {
    try {
      const pos = await getCurrentPosition();
      setOfficeLat(String(pos.coords.latitude));
      setOfficeLng(String(pos.coords.longitude));
      toast({ title: "تم تحديد موقعك الحالي كموقع المكتب" });
    } catch {
      toast({ title: "تعذّر تحديد الموقع", variant: "destructive" });
    }
  }

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.employeeName?.toLowerCase().includes(q) || r.jobTitle?.toLowerCase().includes(q);
  });

  const presentIds = new Set(records.filter(r => r.status === "present").map(r => r.employeeId));
  const checkedOutIds = new Set(records.filter(r => r.checkOut).map(r => r.employeeId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">الحضور والانصراف</h1>
          <p className="text-muted-foreground text-sm">تسجيل ومتابعة حضور الموظفين بتحديد الموقع</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => {
            if (officeLocation) {
              setOfficeName(officeLocation.name);
              setOfficeLat(String(officeLocation.latitude));
              setOfficeLng(String(officeLocation.longitude));
              setOfficeRadius(String(officeLocation.radius));
            }
            setShowOfficeSetup(true);
          }} className="gap-2">
            <MapPin className="h-4 w-4" /> إعداد موقع المكتب
          </Button>
          <Button variant="outline" onClick={() => setShowManual(true)} className="gap-2">
            <Plus className="h-4 w-4" /> تسجيل يدوي
          </Button>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-1">
            <Clock className="h-4 w-4" /> تحديث
          </Button>
        </div>
      </div>

      {/* Office location status */}
      {officeLocation ? (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-300 font-medium">{officeLocation.name}</span>
          <span className="text-muted-foreground">— نطاق الحضور: {officeLocation.radius} متر</span>
          <a href={getMapLink(officeLocation.latitude, officeLocation.longitude) ?? "#"} target="_blank" rel="noreferrer"
            className="mr-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            عرض على الخريطة <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm">
          <ShieldX className="h-4 w-4 text-yellow-400 shrink-0" />
          <span className="text-yellow-300">لم يتم تحديد موقع المكتب بعد</span>
          <Button size="sm" variant="outline" className="mr-auto h-7 text-xs border-yellow-500/30 text-yellow-400"
            onClick={() => setShowOfficeSetup(true)}>
            إعداد الموقع
          </Button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "حاضر اليوم", value: stats.todayPresent, color: "#10B981", icon: UserCheck },
            { label: "سجّل الانصراف", value: stats.checkedOut, color: "#6366F1", icon: LogOut },
            { label: "غائب", value: stats.todayAbsent, color: "#EF4444", icon: XCircle },
            { label: "إجمالي السجلات", value: stats.totalRecords, color: "#2563EB", icon: Clock },
          ].map(s => (
            <Card key={s.label} className="border-0 bg-card/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                  <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick GPS Check-in/out */}
      {employees.filter(e => e.status === "active").length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              تسجيل الحضور بالموقع الجغرافي
              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary mr-1">GPS</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {employees.filter(e => e.status === "active").slice(0, 8).map((emp: any) => {
                const isPresent = presentIds.has(emp.id);
                const isOut = checkedOutIds.has(emp.id);
                const isLoadingIn = gpsLoading === emp.id;
                const isLoadingOut = gpsLoading === `out-${emp.id}`;
                return (
                  <div key={emp.id} className={cn(
                    "p-3 rounded-xl border text-center transition-all",
                    isOut ? "bg-emerald-500/5 border-emerald-500/20"
                      : isPresent ? "bg-blue-500/5 border-blue-500/20"
                      : "bg-muted/30 border-muted"
                  )}>
                    <div className="text-xs font-bold mb-0.5 truncate">{emp.fullName}</div>
                    <div className="text-[10px] text-muted-foreground mb-2 truncate">{emp.jobTitle}</div>
                    {isOut ? (
                      <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">✓ انصرف</Badge>
                    ) : isPresent ? (
                      <Button size="sm" variant="outline"
                        className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 w-full gap-1"
                        onClick={() => handleGpsCheckOut(emp.id)}
                        disabled={isLoadingOut}>
                        {isLoadingOut ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                        انصراف
                      </Button>
                    ) : (
                      <Button size="sm"
                        className="h-6 text-[10px] px-2 w-full gap-1"
                        onClick={() => handleGpsCheckIn(emp.id)}
                        disabled={isLoadingIn}>
                        {isLoadingIn ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
                        حضور
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-[160px]" />
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم..." className="pr-9" />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  {["الموظف", "الحضور", "الانصراف", "المدة", "الموقع", "الحالة"].map(h => (
                    <th key={h} className="text-right text-xs text-muted-foreground font-medium py-3 px-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    لا توجد سجلات لهذا اليوم
                  </td></tr>
                ) : filtered.map((r: any) => {
                  const s = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.present;
                  const StatusIcon = s.icon;
                  const mapLink = getMapLink(r.checkInLat, r.checkInLng);
                  return (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-sm">{r.employeeName}</div>
                        <div className="text-[10px] text-muted-foreground">{r.jobTitle}</div>
                      </td>
                      <td className="py-3 px-4 text-sm font-mono">{formatTime(r.checkIn)}</td>
                      <td className="py-3 px-4 text-sm font-mono">{formatTime(r.checkOut)}</td>
                      <td className="py-3 px-4 text-sm">{calcDuration(r.checkIn, r.checkOut)}</td>
                      <td className="py-3 px-4">
                        {r.checkInLat ? (
                          <div className="flex items-center gap-1">
                            {r.locationVerified ? (
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <ShieldX className="h-3.5 w-3.5 text-yellow-400" />
                            )}
                            {mapLink && (
                              <a href={mapLink} target="_blank" rel="noreferrer"
                                className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                                عرض <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border", s.bg, s.color)}>
                          <StatusIcon className="h-3 w-3" />{s.label}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Manual Dialog */}
      <Dialog open={showManual} onOpenChange={setShowManual}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>تسجيل حضور يدوي</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الموظف *</Label>
              <Select value={selectedEmp} onValueChange={setSelectedEmp}>
                <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>التاريخ</Label><Input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>وقت الحضور</Label><Input type="time" value={manualCheckIn} onChange={e => setManualCheckIn(e.target.value)} /></div>
              <div><Label>وقت الانصراف</Label><Input type="time" value={manualCheckOut} onChange={e => setManualCheckOut(e.target.value)} /></div>
            </div>
            <div><Label>الحالة</Label>
              <Select value={manualStatus} onValueChange={setManualStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">حاضر</SelectItem>
                  <SelectItem value="absent">غائب</SelectItem>
                  <SelectItem value="late">متأخر</SelectItem>
                  <SelectItem value="leave">إجازة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManual(false)}>إلغاء</Button>
            <Button disabled={!selectedEmp || manualMutation.isPending} onClick={() => manualMutation.mutate({
              employeeId: selectedEmp, workDate: manualDate, status: manualStatus,
              checkIn: manualStatus !== "absent" ? new Date(`${manualDate}T${manualCheckIn}`) : null,
              checkOut: manualStatus !== "absent" ? new Date(`${manualDate}T${manualCheckOut}`) : null,
            })} className="gap-2">
              {manualMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} تسجيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Office Location Setup Dialog */}
      <Dialog open={showOfficeSetup} onOpenChange={setShowOfficeSetup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> إعداد موقع المكتب
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              حدّد إحداثيات المكتب والنطاق الجغرافي المسموح به للحضور. سيتم رفض الحضور خارج هذا النطاق.
            </p>
            <div><Label>اسم الموقع</Label>
              <Input value={officeName} onChange={e => setOfficeName(e.target.value)} placeholder="المكتب الرئيسي" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>خط العرض (Lat)</Label>
                <Input value={officeLat} onChange={e => setOfficeLat(e.target.value)} placeholder="24.7136" />
              </div>
              <div><Label>خط الطول (Lng)</Label>
                <Input value={officeLng} onChange={e => setOfficeLng(e.target.value)} placeholder="46.6753" />
              </div>
            </div>
            <div><Label>نطاق الحضور (بالمتر)</Label>
              <Select value={officeRadius} onValueChange={setOfficeRadius}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 متر — دقيق جداً</SelectItem>
                  <SelectItem value="100">100 متر</SelectItem>
                  <SelectItem value="200">200 متر — موصى به</SelectItem>
                  <SelectItem value="500">500 متر</SelectItem>
                  <SelectItem value="1000">1 كيلومتر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={captureCurrentAsOffice} className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10">
              <Navigation className="h-4 w-4" /> استخدم موقعي الحالي كموقع المكتب
            </Button>
            {officeLat && officeLng && (
              <a href={`https://www.google.com/maps?q=${officeLat},${officeLng}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                <ExternalLink className="h-3 w-3" /> تحقق من الموقع على خرائط جوجل
              </a>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfficeSetup(false)}>إلغاء</Button>
            <Button
              disabled={!officeLat || !officeLng || officeSetupMutation.isPending}
              onClick={() => officeSetupMutation.mutate({
                name: officeName,
                latitude: parseFloat(officeLat),
                longitude: parseFloat(officeLng),
                radius: parseInt(officeRadius),
              })}
              className="gap-2">
              {officeSetupMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ موقع المكتب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
