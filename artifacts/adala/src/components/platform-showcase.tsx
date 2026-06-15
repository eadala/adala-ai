import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  X, ChevronLeft, Play, Pause,
  Scale, ArrowLeft, Check, CreditCard, Globe, Zap,
  TrendingUp, Bell, BarChart3, FileText, Users, Calendar,
  Receipt, Briefcase, Building2, Clock, Brain, DollarSign,
  Shield, Activity, Search, Home,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const G = "#1A56DB"; /* blue accent throughout */

/* ── palette ──────────────────────────────────────────────────── */
const WHITE  = "#FFFFFF";
const BG     = "#F8FAFC";
const BG2    = "#F1F5F9";
const DARK   = "#0F172A";
const BODY   = "#334155";
const MUTED  = "#64748B";
const LIGHT  = "#94A3B8";
const BORDER = "#E2E8F0";
const BLUE_L = "#EFF6FF";
const BLUE_M = "#DBEAFE";
const BLUE_T = "#93C5FD";

/* ══════════════════════════════════════════════════════════════════
   SHARED DESKTOP SHELL — light theme
═══════════════════════════════════════════════════════════════════ */
const NAV_ITEMS = [
  { icon: Home,      label: "الرئيسية" },
  { icon: Briefcase, label: "القضايا" },
  { icon: Users,     label: "العملاء" },
  { icon: FileText,  label: "المستندات" },
  { icon: Brain,     label: "الذكاء الاصطناعي" },
  { icon: Calendar,  label: "الجلسات" },
  { icon: Receipt,   label: "الفواتير" },
  { icon: CreditCard,label: "الدفع" },
  { icon: DollarSign,label: "المالية" },
  { icon: Users,     label: "الموارد البشرية" },
  { icon: Shield,    label: "الأمان" },
];

function AppShell({ activeNav, children }: { activeNav: number; children: React.ReactNode }) {
  return (
    <div className="flex w-full h-full overflow-hidden" style={{ background: WHITE, fontFamily: "Cairo, sans-serif" }}>
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col" style={{ width: 52, background: BG, borderLeft: `1px solid ${BORDER}` }}>
        {/* Logo */}
        <div className="flex items-center justify-center py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: G }}>
            <Scale className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
        {/* Nav icons */}
        <div className="flex-1 py-2 space-y-0.5 overflow-hidden">
          {NAV_ITEMS.slice(0, 10).map((item, i) => {
            const Icon = item.icon;
            const isActive = i === activeNav;
            return (
              <div key={i}
                className="flex items-center justify-center w-full py-2 cursor-pointer relative"
                style={{ background: isActive ? BLUE_M : "transparent" }}>
                {isActive && <div className="absolute right-0 top-0 bottom-0 w-0.5 rounded-l-full" style={{ background: G }} />}
                <Icon className="w-4 h-4" style={{ color: isActive ? G : LIGHT }} />
              </div>
            );
          })}
        </div>
        {/* Avatar */}
        <div className="flex items-center justify-center py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: G }}>م</div>
        </div>
      </div>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
          style={{ background: WHITE, borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-1.5 flex-1 px-3 py-1.5 rounded-lg"
            style={{ background: BG, border: `1px solid ${BORDER}` }}>
            <Search className="w-3 h-3 shrink-0" style={{ color: LIGHT }} />
            <span className="text-[10px]" style={{ color: LIGHT }}>بحث سريع...</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-4 h-4" style={{ color: LIGHT }} />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: "#EF4444" }} />
            </div>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: G }}>م</div>
          </div>
        </div>
        {/* Page content */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   15 SCREEN MOCKS
═══════════════════════════════════════════════════════════════════ */

function ScreenDashboard() {
  return (
    <AppShell activeNav={0}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black" style={{ color: DARK }}>مرحباً، محمد الأحمدي ✦</div>
            <div className="text-[10px]" style={{ color: MUTED }}>الأحد، 15 مارس 2025</div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: G }}>
            + إضافة قضية
          </div>
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: "القضايا النشطة",   v: "152",  c: "#6366F1", icon: Briefcase },
            { l: "الإيرادات الشهرية",v: "1.8M", c: G,         icon: TrendingUp },
            { l: "الموظفون",         v: "38",   c: "#10B981", icon: Users },
            { l: "معدل التحصيل",     v: "96%",  c: "#EC4899", icon: Activity },
          ].map(({ l, v, c, icon: Icon }) => (
            <div key={l} className="rounded-xl p-3 flex flex-col gap-1"
              style={{ background: WHITE, border: `1px solid ${c}25`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] leading-tight" style={{ color: MUTED }}>{l}</span>
                <Icon className="w-3 h-3" style={{ color: c }} />
              </div>
              <span className="text-xl font-black leading-none" style={{ color: c }}>{v}</span>
              <span className="text-[8px] text-green-600">↑ +12% هذا الشهر</span>
            </div>
          ))}
        </div>
        {/* Chart + list */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 rounded-xl p-3"
            style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="text-[10px] font-bold mb-2" style={{ color: MUTED }}>الإيرادات الشهرية (ريال سعودي)</div>
            <div className="flex items-end gap-1.5" style={{ height: 72 }}>
              {[42, 58, 38, 75, 55, 90, 68, 88, 50, 78, 65, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm"
                  style={{ height: `${h}%`, background: i === 11 ? G : `${G}${Math.round(25 + i * 8).toString(16)}` }} />
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              {["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"].map(m => (
                <span key={m} className="text-[7px]" style={{ color: LIGHT }}>{m.slice(0,3)}</span>
              ))}
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
            <div className="text-[10px] font-bold mb-2" style={{ color: MUTED }}>القضايا الأخيرة</div>
            <div className="space-y-1.5">
              {[
                ["قضية العقار #091",  "مفتوحة",     "#10B981"],
                ["نزاع تجاري #085",  "جلسة قريبة", "#6366F1"],
                ["استشارة #080",     "مكتملة",     G],
                ["قضية عمالية #079", "قيد التنفيذ","#F59E0B"],
              ].map(([n, s, c]) => (
                <div key={n as string} className="flex items-center justify-between">
                  <span className="text-[9px] truncate ml-1" style={{ color: BODY }}>{(n as string).split(" ").slice(0,2).join(" ")}</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ background: `${c}18`, color: c as string }}>{s as string}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Bottom row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "جلسات هذا الأسبوع", val: "3", color: "#6366F1" },
            { label: "فواتير معلقة",       val: "8", color: "#F59E0B" },
            { label: "مهام متأخرة",        val: "2", color: "#EF4444" },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: `${color}08`, border: `1px solid ${color}25` }}>
              <div className="text-2xl font-black" style={{ color }}>{val}</div>
              <div className="text-[10px] leading-tight" style={{ color: BODY }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ScreenCases() {
  return (
    <AppShell activeNav={1}>
      <div className="p-4 h-full overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-black" style={{ color: DARK }}>إدارة القضايا</div>
            <div className="text-[10px]" style={{ color: MUTED }}>152 قضية نشطة</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {["الكل","مفتوحة","جلسة قريبة","مغلقة"].map((f, i) => (
                <div key={f} className="text-[9px] px-2.5 py-1 rounded-lg cursor-pointer font-medium"
                  style={{ background: i === 0 ? G : BG2, color: i === 0 ? WHITE : MUTED, border: i === 0 ? "none" : `1px solid ${BORDER}` }}>{f}</div>
              ))}
            </div>
            <div className="text-[9px] px-3 py-1 rounded-lg font-bold text-white" style={{ background: G }}>+ قضية جديدة</div>
          </div>
        </div>
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 mb-1 text-[9px] font-bold"
          style={{ borderBottom: `1px solid ${BORDER}`, color: MUTED }}>
          <span>القضية</span><span>النوع</span><span>العميل</span><span>الجلسة القادمة</span><span>الحالة</span>
        </div>
        <div className="space-y-1 overflow-hidden">
          {[
            { n: "قضية العقار #2024-091",    t: "عقاري", c: "شركة الأمل",   d: "15 مارس", s: "مفتوحة",      sc: "#10B981" },
            { n: "نزاع تجاري #2024-085",    t: "تجاري", c: "حمدان المطيري", d: "18 مارس", s: "جلسة قريبة",  sc: "#6366F1" },
            { n: "قضية عمالية #2024-079",   t: "عمالي", c: "مصنع الخليج",  d: "20 مارس", s: "تحت التنفيذ", sc: "#F59E0B" },
            { n: "أحوال شخصية #2024-078",   t: "أسري",  c: "سارة الشمري",  d: "22 مارس", s: "مفتوحة",      sc: "#10B981" },
            { n: "استئناف حكم #2024-071",   t: "جنائي", c: "فهد القحطاني", d: "—",        s: "مكتملة",      sc: "#6B7280" },
          ].map(({ n, t, c, d, s, sc }) => (
            <div key={n} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-2 rounded-xl cursor-pointer"
              style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
              <span className="text-xs font-medium truncate" style={{ color: DARK }}>{n}</span>
              <span className="text-[10px]" style={{ color: MUTED }}>{t}</span>
              <span className="text-[10px] truncate" style={{ color: BODY }}>{c}</span>
              <span className="text-[10px]" style={{ color: MUTED }}>{d}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full inline-block text-center"
                style={{ background: `${sc}18`, color: sc }}>{s}</span>
            </div>
          ))}
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between mt-2 text-[9px]" style={{ color: LIGHT }}>
          <span>عرض 5 من 152</span>
          <div className="flex gap-1">
            {[1,2,3,"...","30"].map((p, i) => (
              <div key={i} className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: p === 1 ? G : BG2, color: p === 1 ? WHITE : MUTED }}>{p}</div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ScreenCaseDetail() {
  return (
    <AppShell activeNav={1}>
      <div className="p-4 h-full overflow-hidden space-y-2">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: LIGHT }}>
          <span>القضايا</span><ChevronLeft className="w-3 h-3" />
          <span className="font-bold" style={{ color: DARK }}>قضية العقار #2024-091</span>
          <div className="mr-auto flex gap-1">
            <div className="px-2.5 py-1 rounded-lg text-[9px]"
              style={{ background: BG2, color: MUTED, border: `1px solid ${BORDER}` }}>تعديل</div>
            <div className="px-2.5 py-1 rounded-lg text-[9px] font-bold text-white" style={{ background: G }}>إصدار فاتورة</div>
          </div>
        </div>
        {/* Info strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: "رقم القضية",     v: "#2024-091" },
            { l: "المحكمة",        v: "المحكمة العامة — الرياض" },
            { l: "الجلسة القادمة", v: "السبت 15 مارس" },
            { l: "المحامي المسؤول",v: "أحمد المنصوري" },
          ].map(({ l, v }) => (
            <div key={l} className="rounded-xl p-2.5" style={{ background: BG, border: `1px solid ${BORDER}` }}>
              <div className="text-[9px] mb-0.5" style={{ color: LIGHT }}>{l}</div>
              <div className="text-xs font-bold" style={{ color: DARK }}>{v}</div>
            </div>
          ))}
        </div>
        {/* Main 2-col */}
        <div className="grid grid-cols-3 gap-2 flex-1">
          {/* Timeline */}
          <div className="rounded-xl p-3" style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
            <div className="text-[10px] font-bold mb-2" style={{ color: MUTED }}>مراحل القضية</div>
            <div className="space-y-2">
              {[
                ["تقديم الدعوى",  "مكتملة",     "#10B981", "5 يناير"],
                ["الجلسة الأولى", "مكتملة",     "#10B981", "20 يناير"],
                ["رفع المذكرة",   "مكتملة",     G,         "8 فبراير"],
                ["جلسة الحكم",    "قادمة",      "#6366F1", "15 مارس"],
                ["إغلاق الملف",   "قيد الانتظار","#94A3B8", "—"],
              ].map(([step, status, color, date]) => (
                <div key={step as string} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: color as string }} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold" style={{ color: DARK }}>{step as string}</div>
                    <div className="text-[9px]" style={{ color: LIGHT }}>{date as string}</div>
                  </div>
                  <div className="mr-auto text-[8px] px-1.5 py-0.5 rounded-full"
                    style={{ background: `${color}15`, color: color as string }}>{status as string}</div>
                </div>
              ))}
            </div>
          </div>
          {/* AI analysis */}
          <div className="col-span-2 space-y-2">
            <div className="rounded-xl p-3" style={{ background: "#EEF2FF", border: "1px solid #A5B4FC" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#E0E7FF" }}>
                  <Brain className="w-3 h-3 text-indigo-600" />
                </div>
                <span className="text-xs font-bold text-indigo-700">تحليل الذكاء الاصطناعي</span>
                <div className="mr-auto flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "#D1FAE5" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[9px] text-green-700 font-bold">85% فرصة نجاح</span>
                </div>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: BODY }}>
                بناءً على تحليل 12 مستنداً والسوابق القضائية المشابهة، الموقف القانوني قوي. يُنصح بتقديم شهادة خبير عقاري إضافية لتعزيز الموقف.
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
              <div className="text-[10px] font-bold mb-2" style={{ color: MUTED }}>المستندات المرفقة (7)</div>
              <div className="grid grid-cols-2 gap-1.5">
                {["عقد بيع العقار.pdf","صورة الهوية.pdf","سجل الملكية.pdf","تقرير الخبير.docx"].map(f => (
                  <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
                    style={{ background: BG }}>
                    <div className="w-4 h-5 rounded text-[7px] font-black text-white flex items-center justify-center shrink-0"
                      style={{ background: f.includes(".pdf") ? "#EF4444" : "#3B82F6" }}>
                      {f.includes(".pdf") ? "PDF" : "DOC"}
                    </div>
                    <span className="text-[9px] truncate" style={{ color: BODY }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ScreenClients() {
  return (
    <AppShell activeNav={2}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black" style={{ color: DARK }}>إدارة العملاء</div>
            <div className="text-[10px]" style={{ color: MUTED }}>183 موكل إجمالاً</div>
          </div>
          <div className="text-[9px] px-3 py-1 rounded-lg font-bold text-white" style={{ background: G }}>+ موكل جديد</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{ l: "موكلون نشطون", v: "147", c: "#10B981" }, { l: "موكلون محتملون", v: "23", c: "#6366F1" }, { l: "شركات وجهات", v: "41", c: G }].map(({ l, v, c }) => (
            <div key={l} className="rounded-xl p-3 text-center" style={{ background: `${c}08`, border: `1px solid ${c}25` }}>
              <div className="text-2xl font-black mb-0.5" style={{ color: c }}>{v}</div>
              <div className="text-[10px]" style={{ color: MUTED }}>{l}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { n: "شركة الأمل التجارية",      t: "شركة",              c: "#10B981", v: "42,500 ر", cases: 4 },
            { n: "حمدان المطيري",            t: "فرد — رجل أعمال",  c: "#6366F1", v: "8,500 ر",  cases: 2 },
            { n: "مجموعة النور العقارية",    t: "شركة عقارية",      c: "#10B981", v: "125,000 ر", cases: 6 },
            { n: "سارة الشمري",              t: "فرد — موظفة",      c: "#F59E0B", v: "3,200 ر",  cases: 1 },
          ].map(({ n, t, c, v, cases }) => (
            <div key={n} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                style={{ background: c }}>{n[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate" style={{ color: DARK }}>{n}</div>
                <div className="text-[10px]" style={{ color: MUTED }}>{t}</div>
                <div className="text-[10px] mt-0.5" style={{ color: LIGHT }}>{cases} قضايا نشطة</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black" style={{ color: G }}>{v}</div>
                <div className="text-[9px]" style={{ color: LIGHT }}>إيرادات</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ScreenDocuments() {
  return (
    <AppShell activeNav={3}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black" style={{ color: DARK }}>المستندات والملفات</div>
            <div className="text-[10px]" style={{ color: MUTED }}>784 مستند</div>
          </div>
          <div className="text-[9px] px-3 py-1 rounded-lg font-bold text-white" style={{ background: G }}>رفع ملف جديد</div>
        </div>
        {/* AI search */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background: "#EEF2FF", border: "1px solid #A5B4FC" }}>
          <Brain className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-[10px] flex-1" style={{ color: MUTED }}>ابحث بالذكاء الاصطناعي... مثال: "عقود الإيجار التي انتهت صلاحيتها في 2024"</span>
          <div className="px-3 py-1 rounded-lg text-[9px] font-bold text-white" style={{ background: "#6366F1" }}>بحث ذكي</div>
        </div>
        {/* Grid view */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { n: "عقد بيع عقار — شركة الأمل.pdf",       s: "2.4 MB", d: "15 مارس", c: "#EF4444", type: "PDF" },
            { n: "مذكرة قانونية #091 — نزاع تجاري.docx", s: "380 KB", d: "12 مارس", c: "#3B82F6", type: "DOC" },
            { n: "صور ووثائق الملكية.zip",               s: "8.1 MB", d: "10 مارس", c: "#F59E0B", type: "ZIP" },
            { n: "حكم المحكمة الابتدائية.pdf",           s: "1.2 MB", d: "5 مارس",  c: "#EF4444", type: "PDF" },
          ].map(({ n, s, d, c, type }) => (
            <div key={n} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
              <div className="w-10 h-12 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
                style={{ background: c }}>{type}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium leading-tight mb-1" style={{ color: DARK }}>{n}</div>
                <div className="text-[9px]" style={{ color: LIGHT }}>{s} • رُفع {d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ScreenLegalAI() {
  return (
    <AppShell activeNav={4}>
      <div className="flex h-full overflow-hidden">
        {/* Sidebar chat history */}
        <div className="w-40 flex-shrink-0 p-3 space-y-1 overflow-hidden"
          style={{ borderLeft: `1px solid ${BORDER}`, background: BG }}>
          <div className="text-[9px] font-bold mb-2 px-1" style={{ color: MUTED }}>المحادثات الأخيرة</div>
          {["قضية العقار #091","تحليل عقد الخليج","تلخيص حكم الاستئناف","مذكرة رد على الدعوى"].map((c, i) => (
            <div key={c} className="px-2 py-1.5 rounded-lg text-[9px] cursor-pointer truncate"
              style={{ background: i === 0 ? BLUE_M : WHITE, color: i === 0 ? G : MUTED, border: i === 0 ? `1px solid ${BLUE_T}` : `1px solid ${BORDER}` }}>{c}</div>
          ))}
        </div>
        {/* Chat area */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: G }}>
              <Scale className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-black" style={{ color: DARK }}>المساعد القانوني الذكي</div>
              <div className="text-[9px] text-green-600">متاح ٢٤/٧</div>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-hidden">
            <div className="flex justify-start">
              <div className="max-w-[75%] px-3 py-2 rounded-2xl text-[10px] leading-relaxed"
                style={{ background: BG2, color: BODY }}> ما هي نقاط الضعف في دعوى الخصم في قضية العقار؟</div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[80%] px-3 py-2.5 rounded-2xl text-[10px] leading-relaxed"
                style={{ background: BLUE_L, color: "#1E40AF", border: `1px solid ${BLUE_T}` }}>
                <div className="font-bold mb-1.5 text-[11px]">✦ تحليل الذكاء الاصطناعي</div>
                حددت ٣ نقاط ضعف رئيسية في موقف الخصم:<br />
                ١. غياب وثيقة التسجيل الرسمية<br />
                ٢. تعارض في شهادات الشهود<br />
                ٣. انتهاء مدة التقادم القانونية<br />
                <span className="text-green-700">فرصة النجاح: 85%</span>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[75%] px-3 py-2 rounded-2xl text-[10px]"
                style={{ background: BG2, color: BODY }}>اكتب مذكرة رد احترافية على ادعاءاتهم</div>
            </div>
            <div className="flex justify-end">
              <div className="px-3 py-2 rounded-2xl text-[10px] flex items-center gap-1.5"
                style={{ background: "#EEF2FF", color: "#6366F1", border: "1px solid #A5B4FC" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                جاري صياغة المذكرة القانونية...
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
            <input type="text" placeholder="اسأل المساعد القانوني..." readOnly
              className="flex-1 px-3 py-2 rounded-xl outline-none text-[10px]"
              style={{ background: BG, border: `1px solid ${BORDER}`, color: MUTED }} />
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: G }}>
              <ArrowLeft className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ScreenOpponentSim() {
  return (
    <AppShell activeNav={4}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black" style={{ color: DARK }}>محاكي الخصم</div>
            <div className="text-[10px]" style={{ color: MUTED }}>قضية العقار #2024-091</div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: "#D1FAE5", border: "1px solid #6EE7B7" }}>
            <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            <span className="text-[10px] font-bold text-green-700">فرصة النجاح: 87%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: "#EEF2FF", border: "1px solid #A5B4FC" }}>
            <div className="text-[10px] font-bold text-indigo-700 mb-2">⚖ موقفك القانوني</div>
            <div className="text-[10px] leading-relaxed" style={{ color: BODY }}>
              الملكية مسجلة قانونياً منذ عام 2018، والعقد موثق رسمياً لدى الجهات المختصة. جميع الوثائق متوفرة وصالحة.
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <div className="text-[10px] font-bold text-red-600 mb-2">⚔ حجج الخصم المتوقعة</div>
            <div className="text-[10px] leading-relaxed" style={{ color: BODY }}>
              يدّعون وجود وثائق مزورة وتواريخ متناقضة في عقد البيع الأصلي، مع التشكيك في صلاحية التوثيق.
            </div>
          </div>
        </div>
        <div className="rounded-xl p-3" style={{ background: BLUE_L, border: `1px solid ${BLUE_T}` }}>
          <div className="text-[10px] font-bold mb-2" style={{ color: G }}>⚡ ردود مقترحة من الذكاء الاصطناعي</div>
          <div className="space-y-2">
            {[
              "تقديم سجل الملكية الرسمي الموثق كدليل دامغ لا يقبل الطعن",
              "طلب تعيين خبير مستقل للتحقق من صحة الوثائق",
              "الاستناد إلى الفقرة ١٢٣ من نظام التسجيل العقاري",
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black text-white shrink-0"
                  style={{ background: G }}>{i + 1}</div>
                <span className="text-[10px] leading-relaxed" style={{ color: BODY }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ScreenSessionPrep() {
  return (
    <AppShell activeNav={5}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black" style={{ color: DARK }}>التحضير للجلسات</div>
            <div className="text-[10px]" style={{ color: MUTED }}>3 جلسات هذا الأسبوع</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {/* Calendar */}
          <div className="rounded-xl p-3" style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
            <div className="text-[10px] font-bold mb-2" style={{ color: MUTED }}>مارس 2025</div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {["أح","إث","ثل","أر","خم","جم","سب"].map(d =>
                <div key={d} className="text-[7px] text-center" style={{ color: LIGHT }}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <div key={d} className="text-[8px] rounded text-center py-0.5 font-medium"
                  style={{
                    background: d === 15 ? G : d === 18 || d === 20 ? "#EEF2FF" : "transparent",
                    color: d === 15 ? WHITE : d === 18 || d === 20 ? "#6366F1" : LIGHT,
                  }}>{d}</div>
              ))}
            </div>
          </div>
          {/* Upcoming sessions */}
          <div className="col-span-2 space-y-2">
            {[
              { d: "السبت 15 مارس",   t: "قضية العقار #091",  q: "10:00 ص", c: "المحكمة العامة الرياض", s: "#10B981" },
              { d: "الثلاثاء 18 مارس",t: "نزاع تجاري #085",  q: "2:00 م",  c: "محكمة التجارة",          s: "#6366F1" },
              { d: "الخميس 20 مارس",  t: "قضية عمالية #079", q: "11:00 ص", c: "محكمة العمل",            s: "#F59E0B" },
            ].map(({ d, t, q, c, s }) => (
              <div key={t} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: WHITE, border: `1px solid ${s}25` }}>
                <div className="w-1 h-full min-h-[40px] rounded-full shrink-0" style={{ background: s }} />
                <div className="flex-1">
                  <div className="text-xs font-bold" style={{ color: DARK }}>{t}</div>
                  <div className="text-[9px]" style={{ color: MUTED }}>{d} • {q}</div>
                  <div className="text-[9px]" style={{ color: LIGHT }}>{c}</div>
                </div>
                <div className="text-[9px] px-2 py-1 rounded-lg font-bold"
                  style={{ background: `${s}12`, color: s }}>تحضير</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ScreenInvoices() {
  return (
    <AppShell activeNav={6}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black" style={{ color: DARK }}>الفواتير الإلكترونية</div>
            <div className="text-[10px]" style={{ color: MUTED }}>إجمالي 2.1M ريال</div>
          </div>
          <div className="text-[9px] px-3 py-1 rounded-lg font-bold text-white" style={{ background: G }}>+ فاتورة جديدة</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{ l: "مدفوعة", v: "89", c: "#10B981" }, { l: "معلقة", v: "24", c: "#F59E0B" }, { l: "متأخرة", v: "8", c: "#EF4444" }].map(({ l, v, c }) => (
            <div key={l} className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: `${c}08`, border: `1px solid ${c}25` }}>
              <div className="text-2xl font-black" style={{ color: c }}>{v}</div>
              <div className="text-[10px]" style={{ color: BODY }}>{l}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {[
            { id: "INV-2024-091", c: "شركة الأمل التجارية",     a: "42,500",  s: "مدفوعة",         sc: "#10B981" },
            { id: "INV-2024-092", c: "حمدان المطيري",           a: "8,200",   s: "معلقة",           sc: "#F59E0B" },
            { id: "INV-2024-093", c: "مجموعة النور العقارية",  a: "125,000", s: "رابط دفع أُرسل",  sc: "#6366F1" },
            { id: "INV-2024-094", c: "سارة الشمري",             a: "3,800",   s: "متأخرة 15 يوم",  sc: "#EF4444" },
          ].map(({ id, c, a, s, sc }) => (
            <div key={id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
              <div>
                <div className="text-xs font-bold" style={{ color: DARK }}>{id}</div>
                <div className="text-[10px]" style={{ color: MUTED }}>{c}</div>
              </div>
              <div className="mr-auto text-sm font-black" style={{ color: G }}>{a} ر</div>
              <div className="text-[10px] px-2.5 py-1 rounded-full"
                style={{ background: `${sc}12`, color: sc }}>{s}</div>
              <div className="text-[9px] px-2 py-1 rounded-lg"
                style={{ background: BG2, color: MUTED, border: `1px solid ${BORDER}` }}>عرض</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ScreenPaymentCenter() {
  return (
    <AppShell activeNav={7}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="text-sm font-black mb-1" style={{ color: DARK }}>مركز الدفع الإلكتروني</div>
        {/* Balance card */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: BLUE_L, border: `1px solid ${BLUE_T}` }}>
          <div className="absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-40"
            style={{ background: BLUE_M }} />
          <div className="relative">
            <div className="text-[10px] mb-1" style={{ color: MUTED }}>الرصيد المتاح للسحب</div>
            <div className="text-3xl font-black mb-1" style={{ color: G }}>184,250</div>
            <div className="text-[10px] mb-3" style={{ color: MUTED }}>ريال سعودي</div>
            <div className="flex gap-2">
              <div className="px-4 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: G }}>سحب للحساب</div>
              <div className="px-4 py-1.5 rounded-xl text-xs font-bold" style={{ background: WHITE, color: G, border: `1px solid ${BLUE_T}` }}>إرسال رابط دفع</div>
            </div>
          </div>
        </div>
        {/* Payment links */}
        <div>
          <div className="text-[10px] font-bold mb-2" style={{ color: MUTED }}>روابط الدفع النشطة</div>
          <div className="space-y-1.5">
            {[
              { c: "مجموعة النور العقارية",    a: "125,000", s: "بانتظار السداد", sc: "#F59E0B" },
              { c: "عبدالله القحطاني",         a: "18,500",  s: "تم الفتح",       sc: "#6366F1" },
              { c: "شركة التقنية المتقدمة",    a: "45,000",  s: "مدفوعة ✓",      sc: "#10B981" },
            ].map(({ c, a, s, sc }) => (
              <div key={c} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
                <CreditCard className="w-4 h-4 shrink-0" style={{ color: G }} />
                <div className="flex-1">
                  <div className="text-xs font-medium" style={{ color: DARK }}>{c}</div>
                  <div className="text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5"
                    style={{ background: `${sc}12`, color: sc }}>{s}</div>
                </div>
                <div className="text-sm font-black" style={{ color: G }}>{a} ر</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ScreenCollections() {
  return (
    <AppShell activeNav={8}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="text-sm font-black" style={{ color: DARK }}>التحصيل المالي</div>
        {/* Progress */}
        <div className="rounded-xl p-4" style={{ background: "#F0FDF4", border: "1px solid #A7F3D0" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: BODY }}>معدل التحصيل الشهري</span>
            <span className="text-2xl font-black text-green-600">96%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ background: "#D1FAE5" }}>
            <div className="h-full rounded-full" style={{ width: "96%", background: "linear-gradient(90deg, #10B981, #34D399)" }} />
          </div>
          <div className="grid grid-cols-2 gap-4 text-[10px]" style={{ color: MUTED }}>
            <span>المحصّل: <strong style={{ color: DARK }}>1,840,000 ر</strong></span>
            <span>المتبقي: <strong style={{ color: DARK }}>76,000 ر</strong></span>
          </div>
        </div>
        <div className="text-[10px] font-bold" style={{ color: MUTED }}>متابعة التحصيل</div>
        <div className="space-y-1.5">
          {[
            { c: "شركة الخليج الصناعية", a: "45,000", d: "30 يوم", col: "#EF4444", act: "إرسال تنبيه قانوني" },
            { c: "فهد العتيبي",          a: "12,500", d: "15 يوم", col: "#F59E0B", act: "تذكير تلقائي" },
            { c: "مؤسسة النجاح",         a: "8,200",  d: "5 أيام", col: "#10B981", act: "متابعة عادية" },
          ].map(({ c, a, d, col, act }) => (
            <div key={c} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
              <div className="flex-1">
                <div className="text-xs font-medium" style={{ color: DARK }}>{c}</div>
                <div className="text-[9px] mt-0.5" style={{ color: col }}>متأخر {d}</div>
              </div>
              <div className="text-sm font-black" style={{ color: DARK }}>{a} ر</div>
              <div className="text-[9px] px-2.5 py-1 rounded-xl font-medium"
                style={{ background: `${col}12`, color: col }}>{act}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ScreenHR() {
  return (
    <AppShell activeNav={9}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black" style={{ color: DARK }}>الموارد البشرية</div>
            <div className="text-[10px]" style={{ color: MUTED }}>38 موظف</div>
          </div>
          <div className="text-[9px] px-3 py-1 rounded-lg font-bold text-white" style={{ background: G }}>+ إضافة موظف</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{ l: "المحامون", v: "12", c: "#6366F1" }, { l: "المساعدون", v: "18", c: "#10B981" }, { l: "الإداريون", v: "8", c: G }].map(({ l, v, c }) => (
            <div key={l} className="rounded-xl p-3 text-center" style={{ background: `${c}08`, border: `1px solid ${c}25` }}>
              <div className="text-2xl font-black mb-0.5" style={{ color: c }}>{v}</div>
              <div className="text-[10px]" style={{ color: MUTED }}>{l}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {[
            { n: "أحمد المنصوري",  r: "محامي أول",          s: "8,500 ر", c: "#6366F1", status: "حاضر" },
            { n: "سارة القحطاني", r: "مساعد قانوني أول",   s: "4,200 ر", c: "#10B981", status: "حاضر" },
            { n: "محمد العمري",    r: "مدير إداري",          s: "3,800 ر", c: G,         status: "إجازة" },
            { n: "فاطمة الشهري",  r: "محامية",              s: "7,200 ر", c: "#6366F1", status: "حاضر" },
          ].map(({ n, r, s, c, status }) => (
            <div key={n} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                style={{ background: c }}>{n[0]}</div>
              <div className="flex-1">
                <div className="text-xs font-bold" style={{ color: DARK }}>{n}</div>
                <div className="text-[10px]" style={{ color: MUTED }}>{r}</div>
              </div>
              <div className="text-xs font-black" style={{ color: G }}>{s}</div>
              <div className="text-[9px] px-2 py-0.5 rounded-full"
                style={{ background: status === "حاضر" ? "#D1FAE5" : "#FEF3C7", color: status === "حاضر" ? "#059669" : "#D97706" }}>{status}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ScreenAttendance() {
  return (
    <AppShell activeNav={9}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="text-sm font-black" style={{ color: DARK }}>الحضور والانصراف</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 text-center" style={{ background: "#F0FDF4", border: "1px solid #A7F3D0" }}>
            <div className="text-3xl font-black mb-0.5" style={{ color: DARK }}>09:24</div>
            <div className="text-[10px] mb-2" style={{ color: MUTED }}>الأحد، 15 مارس 2025</div>
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white"
              style={{ background: "#10B981" }}>
              <Check className="w-3 h-3" /> حاضر الآن
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[{ l: "حضروا اليوم", v: "31", c: "#10B981" }, { l: "غائبون", v: "4", c: "#EF4444" }, { l: "إجازة", v: "3", c: "#F59E0B" }, { l: "خارج المكتب", v: "2", c: "#6366F1" }].map(({ l, v, c }) => (
              <div key={l} className="rounded-xl p-2.5 text-center" style={{ background: `${c}08`, border: `1px solid ${c}20` }}>
                <div className="text-lg font-black" style={{ color: c }}>{v}</div>
                <div className="text-[8px] leading-tight" style={{ color: MUTED }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-[10px] font-bold" style={{ color: MUTED }}>سجل الحضور اليوم</div>
        <div className="space-y-1.5">
          {[
            { n: "أحمد المنصوري",  i: "08:55", o: "—",   s: "حاضر",  c: "#10B981" },
            { n: "سارة القحطاني", i: "09:10", o: "—",   s: "حاضر",  c: "#10B981" },
            { n: "محمد العمري",    i: "—",     o: "—",   s: "إجازة", c: "#F59E0B" },
            { n: "فاطمة الشهري",  i: "08:30", o: "17:00", s: "انصرف",c: "#6366F1" },
          ].map(({ n, i, o, s, c }) => (
            <div key={n} className="flex items-center gap-3 px-4 py-2 rounded-xl"
              style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
              <div className="text-xs font-medium flex-1" style={{ color: DARK }}>{n}</div>
              <div className="text-[10px]" style={{ color: LIGHT }}>{i} ← {o}</div>
              <div className="text-[9px] px-2 py-0.5 rounded-full"
                style={{ background: `${c}12`, color: c }}>{s}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ScreenOfficeWebsite() {
  return (
    <AppShell activeNav={9}>
      <div className="h-full overflow-hidden flex flex-col">
        {/* Preview bar */}
        <div className="px-4 py-2 flex items-center gap-2 shrink-0"
          style={{ background: BG2, borderBottom: `1px solid ${BORDER}` }}>
          <Globe className="w-3.5 h-3.5" style={{ color: LIGHT }} />
          <span className="text-[10px] flex-1" style={{ color: MUTED }}>الموقع العام للمكتب</span>
          <div className="text-[9px] px-2 py-0.5 rounded-full font-bold text-green-700"
            style={{ background: "#D1FAE5" }}>● منشور</div>
        </div>
        {/* Website preview — light design */}
        <div className="flex-1 overflow-hidden" style={{ background: WHITE }}>
          {/* Site header */}
          <div className="px-6 py-3 flex items-center justify-between"
            style={{ background: WHITE, borderBottom: `2px solid ${G}20` }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: G }}>
                <Scale className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-black" style={{ color: DARK }}>مكتب الأحمدي للمحاماة</span>
            </div>
            <div className="flex gap-3 text-[10px]" style={{ color: MUTED }}>
              {["الرئيسية","خدماتنا","فريقنا","تواصل معنا"].map(l =>
                <span key={l} className="cursor-pointer hover:text-blue-600">{l}</span>)}
            </div>
          </div>
          {/* Hero */}
          <div className="px-6 py-5 text-center" style={{ background: BLUE_L }}>
            <div className="text-base font-black mb-1" style={{ color: DARK }}>مكتب الأحمدي للمحاماة والاستشارات القانونية</div>
            <div className="text-[10px] mb-3" style={{ color: MUTED }}>خبرة 15 عاماً في القانون السعودي — الرياض</div>
            <div className="flex justify-center gap-2">
              <div className="px-4 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: G }}>احجز استشارة مجانية</div>
              <div className="px-4 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: WHITE, color: G, border: `1px solid ${BLUE_T}` }}>خدماتنا</div>
            </div>
          </div>
          {/* Services */}
          <div className="px-6 py-3">
            <div className="grid grid-cols-3 gap-2">
              {[["⚖","قانون تجاري","#6366F1"],["🏠","قانون عقاري","#10B981"],["👨‍👩‍👧","أحوال شخصية",G]].map(([icon, label, color]) => (
                <div key={label as string} className="rounded-xl p-3 text-center"
                  style={{ background: BG, border: `1px solid ${color}20` }}>
                  <div className="text-xl mb-1">{icon as string}</div>
                  <div className="text-[10px] font-bold" style={{ color: DARK }}>{label as string}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ScreenLegalStore() {
  return (
    <AppShell activeNav={9}>
      <div className="p-4 h-full overflow-hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black" style={{ color: DARK }}>متجر الخدمات القانونية</div>
            <div className="text-[10px]" style={{ color: MUTED }}>12 خدمة منشورة</div>
          </div>
          <div className="text-[9px] px-3 py-1 rounded-lg font-bold text-white" style={{ background: G }}>+ خدمة جديدة</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { s: "استشارة قانونية سريعة",   p: "199 ر",   d: "30 دقيقة مع محامي متخصص",         c: "#6366F1", sold: 124, rating: "4.9" },
            { s: "صياغة عقد تجاري",          p: "899 ر",   d: "عقد احترافي خلال 48 ساعة",        c: "#10B981", sold: 56,  rating: "4.8" },
            { s: "مراجعة قانونية شاملة",     p: "399 ر",   d: "تدقيق كامل لأي وثيقة قانونية",  c: G,         sold: 89,  rating: "4.9" },
            { s: "تمثيل قضائي",              p: "تواصل",   d: "دفاع احترافي أمام المحاكم",      c: "#EC4899", sold: 31,  rating: "5.0" },
          ].map(({ s, p, d, c, sold, rating }) => (
            <div key={s} className="p-3 rounded-xl cursor-pointer"
              style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${c}12` }}>
                  <Scale className="w-4 h-4" style={{ color: c }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold leading-tight" style={{ color: DARK }}>{s}</div>
                  <div className="text-[9px] mt-0.5 leading-tight" style={{ color: MUTED }}>{d}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-black" style={{ color: G }}>{p}</div>
                <div className="text-[9px]" style={{ color: LIGHT }}>⭐ {rating} · {sold} طلب</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SCREENS CONFIG
═══════════════════════════════════════════════════════════════════ */
const SCREENS = [
  { id: 1,  key: "dashboard",   title: "لوحة التحكم الرئيسية",    subtitle: "نظرة شاملة على كامل المكتب في لحظة",          color: G,         features: ["152 قضية نشطة بلمسة واحدة","1.8 مليون ريال إيرادات محدّثة لحظياً","رسوم بيانية ذكية وتحليلات فورية","تنبيهات الجلسات والمواعيد الحرجة"], component: ScreenDashboard },
  { id: 2,  key: "cases",       title: "إدارة القضايا",            subtitle: "تتبع كل قضية من الفتح حتى الإغلاق",           color: "#6366F1", features: ["جدول احترافي مع فلترة متقدمة","ربط المستندات والعملاء تلقائياً","تحليل ذكي لأولويات القضايا","تصدير التقارير بصيغ متعددة"], component: ScreenCases },
  { id: 3,  key: "case-detail", title: "تفاصيل القضية",            subtitle: "كل تفصيل عن القضية في شاشة واحدة",            color: "#10B981", features: ["تحليل ذكاء اصطناعي بنسبة نجاح 85%","جدول زمني لمراحل القضية","مستندات مرفقة مصنّفة تلقائياً","ملاحظات وتعليقات الفريق القانوني"], component: ScreenCaseDetail },
  { id: 4,  key: "clients",     title: "إدارة العملاء",           subtitle: "قاعدة بيانات موكليك بالكامل",                color: "#F59E0B", features: ["183 موكل مصنّف حسب النوع","تتبع إيرادات كل موكل","سجل تواصل كامل وتاريخ القضايا","بطاقات موكلين احترافية"], component: ScreenClients },
  { id: 5,  key: "documents",   title: "المستندات والبحث الذكي",  subtitle: "بحث في 784 مستند بلغة طبيعية",               color: "#3B82F6", features: ["بحث ذكي بالعربية في ثوانٍ","تصنيف تلقائي للمستندات","معاينة سريعة بدون تحميل","مشاركة آمنة مع الفريق"], component: ScreenDocuments },
  { id: 6,  key: "legal-ai",    title: "المساعد القانوني الذكي",  subtitle: "محادثة قانونية ذكية متاحة ٢٤/٧",             color: "#818CF8", features: ["تحليل وثائق وعقود بالذكاء الاصطناعي","صياغة مذكرات ومستندات قانونية","دعم العربية واللغات القانونية","تاريخ محادثات كامل ومحفوظ"], component: ScreenLegalAI },
  { id: 7,  key: "opponent-sim",title: "محاكي الخصم",             subtitle: "استعد للجلسة بتحليل ذكي للخصم",              color: "#EC4899", features: ["تحليل نقاط ضعف موقف الخصم","اقتراح ردود قانونية احترافية","تقييم فرص النجاح بالذكاء الاصطناعي","استناد تلقائي للأنظمة واللوائح"], component: ScreenOpponentSim },
  { id: 8,  key: "sessions",    title: "التحضير للجلسات",         subtitle: "لا تحضر لجلسة دون أن تكون مستعداً",         color: "#06B6D4", features: ["تقويم جلسات تفاعلي متكامل","تذكيرات آلية قبل كل جلسة","ملف تحضير ذكي لكل جلسة","ربط تلقائي بوثائق القضية"], component: ScreenSessionPrep },
  { id: 9,  key: "invoices",    title: "الفواتير الإلكترونية",     subtitle: "فاتورة احترافية متوافقة مع ZATCA في ثوانٍ",   color: G,         features: ["فاتورة متوافقة مع ZATCA","إرسال فوري عبر البريد والواتساب","متابعة حالة السداد لحظياً","تقارير مالية تلقائية شهرية"], component: ScreenInvoices },
  { id: 10, key: "payment",     title: "مركز الدفع الإلكتروني",   subtitle: "استلم أتعابك من أي مكان في العالم",           color: "#10B981", features: ["روابط دفع مباشرة بضغطة واحدة","قبول بطاقات ائتمانية عالمية","تتبع حالة السداد لحظياً","تحويل فوري للحساب البنكي"], component: ScreenPaymentCenter },
  { id: 11, key: "collections", title: "التحصيل المالي",           subtitle: "معدل تحصيل 96% مع متابعة ذكية",              color: "#34D399", features: ["تذكيرات تلقائية للمتأخرين","جدولة مدفوعات مرنة","تقارير عمر الديون التفصيلية","إشعارات فورية عند كل سداد"], component: ScreenCollections },
  { id: 12, key: "hr",          title: "الموارد البشرية",          subtitle: "إدارة فريقك القانوني باحترافية",             color: "#A855F7", features: ["ملفات 38 موظف مكتملة","رواتب ومكافآت وعمولات آلية","تقييمات أداء دورية","هيكل تنظيمي تفاعلي"], component: ScreenHR },
  { id: 13, key: "attendance",  title: "الحضور والانصراف",         subtitle: "حضور رقمي مع تقارير فورية",                  color: "#06B6D4", features: ["حضور رقمي بدون بصمة تقليدية","تقارير حضور يومية وشهرية","حساب الإجازات تلقائياً","تنبيهات الغياب المتكرر"], component: ScreenAttendance },
  { id: 14, key: "website",     title: "موقع المكتب العام",        subtitle: "احضور رقمي احترافي لمكتبك",                 color: "#F97316", features: ["موقع جاهز لمكتبك في دقائق","صفحة خدمات وتخصصات","نموذج تواصل واستشارة أولية","ظهور في محركات البحث"], component: ScreenOfficeWebsite },
  { id: 15, key: "store",       title: "متجر الخدمات القانونية",  subtitle: "حوّل خبرتك القانونية إلى دخل رقمي",         color: "#D946EF", features: ["بيع خدماتك للعملاء مباشرة","استشارات مدفوعة إلكترونياً","عقود جاهزة قابلة للتخصيص","تقييمات وآراء العملاء"], component: ScreenLegalStore },
];

const JOURNEY = [
  { icon: "👤", label: "استقبال العميل" }, { icon: "📁", label: "فتح القضية" },
  { icon: "📄", label: "رفع المستندات" }, { icon: "🤖", label: "تحليل الذكاء الاصطناعي" },
  { icon: "📝", label: "إنشاء العقد" },   { icon: "🧾", label: "إصدار الفاتورة" },
  { icon: "🔗", label: "رابط الدفع" },    { icon: "💳", label: "سداد العميل" },
  { icon: "📊", label: "متابعة القضية" }, { icon: "✅", label: "إغلاق الملف" },
];

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function PlatformShowcase() {
  const { t } = useTranslation();
  const [active, setActive]   = useState(0);
  const [playing, setPlaying] = useState(true);
  const [modal, setModal]     = useState<number | null>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStart   = useRef<number | null>(null);

  const screensT       = t("landing.showcase.screens",      { returnObjects: true }) as { title: string; subtitle: string; features: string[] }[];
  const journeyLabels  = t("landing.showcase.journeySteps", { returnObjects: true }) as string[];
  const paymentFeatures = t("landing.showcase.paymentFeatures", { returnObjects: true }) as string[];

  const SCREENS_T = SCREENS.map((s, i) => ({
    ...s, title: screensT[i]?.title ?? s.title,
    subtitle: screensT[i]?.subtitle ?? s.subtitle,
    features: screensT[i]?.features ?? s.features,
  }));

  const JOURNEY_T = JOURNEY.map((j, i) => ({ ...j, label: journeyLabels[i] ?? j.label }));

  const goNext = useCallback(() => setActive(p => (p + 1) % SCREENS.length), []);
  const goPrev = useCallback(() => setActive(p => (p - 1 + SCREENS.length) % SCREENS.length), []);

  useEffect(() => {
    if (!playing) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(goNext, 3500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, goNext]);

  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? goNext() : goPrev(); }
    touchStart.current = null;
  };

  const screen = SCREENS_T[active];
  const Screen = screen.component;

  return (
    <section id="showcase" className="py-24 px-4 relative overflow-hidden"
      style={{ background: BG }}>

      {/* Soft blue orb */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full blur-[180px] opacity-[0.08]"
          style={{ background: G }} />
      </div>

      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-4"
            style={{ background: BLUE_M, border: `1px solid ${BLUE_T}`, color: G }}>
            <Play className="w-3.5 h-3.5 fill-current" />{t("landing.showcase.badge")}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4" style={{ color: DARK }}>
            {t("landing.showcase.title")}{" "}
            <span style={{ color: G }}>{t("landing.showcase.titleHighlight")}</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: BODY }}>
            {t("landing.showcase.subtitle")}
          </p>
        </motion.div>

        {/* Main layout */}
        <div className="grid lg:grid-cols-[220px_1fr] gap-5 items-start">

          {/* Left: screen list */}
          <div className="hidden lg:block rounded-2xl overflow-hidden"
            style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            {SCREENS_T.map((s, i) => (
              <button key={s.id} onClick={() => { setActive(i); setPlaying(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-right transition-all"
                style={{
                  background: active === i ? `${s.color}08` : "transparent",
                  borderRight: active === i ? `3px solid ${s.color}` : "3px solid transparent",
                  borderBottom: `1px solid ${BORDER}`,
                }}>
                <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black"
                  style={{ background: active === i ? s.color : BG2, color: active === i ? WHITE : MUTED }}>{s.id}</div>
                <span className="text-xs font-medium truncate"
                  style={{ color: active === i ? s.color : MUTED }}>{s.title}</span>
              </button>
            ))}
          </div>

          {/* Right: browser + screen */}
          <div>
            {/* Browser chrome */}
            <div className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${BORDER}`, boxShadow: "0 8px 32px rgba(26,86,219,0.10)" }}>
              {/* Browser top */}
              <div className="flex items-center gap-2 px-4 py-3"
                style={{ background: BG2, borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex gap-1.5">
                  {["#EF4444","#F59E0B","#10B981"].map(c =>
                    <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
                </div>
                <div className="flex-1 mx-3 px-3 py-1.5 rounded-lg text-xs text-center"
                  style={{ background: WHITE, border: `1px solid ${BORDER}`, color: MUTED }}>
                  app.adalah-ai.sa/{screen.key}
                </div>
                <button onClick={() => setPlaying(p => !p)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: playing ? BLUE_M : BG2 }}>
                  {playing
                    ? <Pause className="w-3 h-3" style={{ color: G }} />
                    : <Play  className="w-3 h-3" style={{ color: MUTED }} />}
                </button>
              </div>

              {/* Screen area */}
              <div className="relative overflow-hidden" style={{ height: 440 }}
                onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                <AnimatePresence mode="wait">
                  <motion.div key={active} className="absolute inset-0"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}>
                    <Screen />
                  </motion.div>
                </AnimatePresence>
                {/* Hover overlay */}
                <button onClick={() => setModal(active)}
                  className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(3px)" }}>
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white"
                    style={{ background: G }}>
                    <Zap className="w-4 h-4" />{t("landing.showcase.viewDetails")}
                  </div>
                </button>
              </div>

              {/* Bottom info */}
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ background: WHITE, borderTop: `1px solid ${BORDER}` }}>
                <div>
                  <div className="text-sm font-bold" style={{ color: DARK }}>{screen.title}</div>
                  <div className="text-xs" style={{ color: MUTED }}>{screen.subtitle}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: LIGHT }}>{active + 1}/{SCREENS.length}</span>
                  <button onClick={() => { goPrev(); setPlaying(false); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: BG2, border: `1px solid ${BORDER}` }}>
                    <ChevronLeft className="w-4 h-4 rotate-180" style={{ color: MUTED }} />
                  </button>
                  <button onClick={() => { goNext(); setPlaying(false); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: BG2, border: `1px solid ${BORDER}` }}>
                    <ChevronLeft className="w-4 h-4" style={{ color: MUTED }} />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
              {SCREENS_T.map((s, i) => (
                <button key={s.id} onClick={() => { setActive(i); setPlaying(false); }}
                  className="rounded-full transition-all"
                  style={{ width: active === i ? 22 : 6, height: 6, background: active === i ? screen.color : BORDER }} />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: horizontal scrollable tabs */}
        <div className="lg:hidden flex gap-2 mt-5 overflow-x-auto pb-2">
          {SCREENS_T.map((s, i) => (
            <button key={s.id} onClick={() => { setActive(i); setPlaying(false); }}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{ background: active === i ? s.color : BG2, color: active === i ? WHITE : MUTED }}>
              {s.id}. {s.title.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Journey strip */}
        <motion.div className="mt-14 rounded-2xl p-6 md:p-8"
          style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div className="text-center mb-6">
            <div className="text-sm font-bold mb-1" style={{ color: G }}>{t("landing.showcase.journeyLabel")}</div>
            <div className="font-black text-lg" style={{ color: DARK }}>{t("landing.showcase.journeyTitle")}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 md:gap-0">
            {JOURNEY_T.map((j, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center mx-1">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl mb-1.5"
                    style={{ background: `${G}${Math.round(8 + i * 4).toString(16).padStart(2,"0")}`, border: `1px solid ${BLUE_T}` }}>
                    {j.icon}
                  </div>
                  <span className="text-[9px] text-center max-w-[70px] leading-tight" style={{ color: MUTED }}>{j.label}</span>
                </div>
                {i < JOURNEY_T.length - 1 && (
                  <div className="hidden md:block mb-4 mx-0.5" style={{ color: BORDER }}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Payment strip */}
        <motion.div className="mt-5 rounded-2xl p-5 md:p-7 relative overflow-hidden"
          style={{ background: BLUE_L, border: `1px solid ${BLUE_T}` }}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[60px] opacity-20"
            style={{ background: G }} />
          <div className="relative flex flex-col md:flex-row items-center gap-5">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5" style={{ color: G }} />
                <span className="font-black text-lg" style={{ color: DARK }}>{t("landing.showcase.paymentTitle")}</span>
              </div>
              <p className="text-sm" style={{ color: BODY }}>{t("landing.showcase.paymentSubtitle")}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 flex-shrink-0">
              {paymentFeatures.map(f => (
                <div key={f} className="flex items-center gap-1.5 text-xs" style={{ color: BODY }}>
                  <Check className="w-3.5 h-3.5 shrink-0" style={{ color: G }} />{f}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div className="mt-10 text-center" initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={`${BASE}/sign-up`}>
              <button className="flex items-center gap-2 font-black px-8 py-4 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ background: G, color: WHITE, boxShadow: `0 8px 32px ${G}40` }}>
                {t("landing.showcase.startFree")}<ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <button onClick={() => { setModal(active); setPlaying(false); }}
              className="flex items-center gap-2 font-bold px-8 py-4 rounded-xl text-base transition-all"
              style={{ border: `1px solid ${BLUE_T}`, color: G, background: BLUE_L }}>
              <BarChart3 className="w-4 h-4" />{t("landing.showcase.viewAll")}
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {modal !== null && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setModal(null)}>
            <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.7)", backdropFilter: "blur(12px)" }} />
            <motion.div className="relative w-full max-w-4xl rounded-2xl overflow-hidden"
              style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={e => e.stopPropagation()}>
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4"
                style={{ background: BG2, borderBottom: `1px solid ${BORDER}` }}>
                <div>
                  <div className="font-black" style={{ color: DARK }}>{SCREENS_T[modal].title}</div>
                  <div className="text-sm" style={{ color: MUTED }}>{SCREENS_T[modal].subtitle}</div>
                </div>
                <button onClick={() => setModal(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: BG, border: `1px solid ${BORDER}` }}>
                  <X className="w-4 h-4" style={{ color: MUTED }} />
                </button>
              </div>

              <div className="grid md:grid-cols-[1fr_260px]">
                {/* Screen preview */}
                <div style={{ height: 460, borderLeft: `1px solid ${BORDER}` }}>
                  {(() => { const C = SCREENS_T[modal].component; return <C />; })()}
                </div>
                {/* Features */}
                <div className="p-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
                    style={{ background: `${SCREENS_T[modal].color}12`, color: SCREENS_T[modal].color, border: `1px solid ${SCREENS_T[modal].color}30` }}>
                    {t("landing.showcase.moduleOf")} {SCREENS_T[modal].id} {t("landing.showcase.of15")}
                  </div>
                  <h3 className="text-xl font-black mb-2" style={{ color: DARK }}>{SCREENS_T[modal].title}</h3>
                  <p className="text-sm mb-5" style={{ color: MUTED }}>{SCREENS_T[modal].subtitle}</p>
                  <div className="space-y-3">
                    {SCREENS_T[modal].features.map((f, i) => (
                      <motion.div key={f} className="flex items-start gap-2.5"
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}>
                        <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${SCREENS_T[modal].color}12`, border: `1px solid ${SCREENS_T[modal].color}30` }}>
                          <Check className="w-3 h-3" style={{ color: SCREENS_T[modal].color }} />
                        </div>
                        <span className="text-sm" style={{ color: BODY }}>{f}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button onClick={() => setModal((modal - 1 + SCREENS.length) % SCREENS.length)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: BG2, color: MUTED, border: `1px solid ${BORDER}` }}>
                      {t("landing.showcase.prev")}
                    </button>
                    <button onClick={() => setModal((modal + 1) % SCREENS.length)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                      style={{ background: SCREENS_T[modal].color, color: WHITE }}>
                      {t("landing.showcase.next")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ background: BG2, borderTop: `1px solid ${BORDER}` }}>
                <span className="text-xs" style={{ color: LIGHT }}>{t("landing.showcase.noCardRequired")}</span>
                <Link href={`${BASE}/sign-up`}>
                  <button className="flex items-center gap-1.5 font-bold px-5 py-2 rounded-xl text-sm text-white"
                    style={{ background: G }}>
                    {t("landing.showcase.startFreeShort")}<ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
