import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  X, ChevronLeft, ChevronRight, Play, Pause,
  Scale, ArrowLeft, Check, CreditCard, Globe, Zap,
  TrendingUp, Bell, BarChart3,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── Colour palette ────────────────────────────────────────────── */
const G = "#C9A84C";

/* ══════════════════════════════════════════════════════════════════
   15 SCREEN MOCK-UPs
   Each returns a styled div that looks like a real UI screenshot
═══════════════════════════════════════════════════════════════════ */

function ScreenDashboard() {
  return (
    <div className="w-full h-full p-3 space-y-2 overflow-hidden" style={{ background: "#0D1626" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-black text-white">لوحة التحكم</div>
        <div className="flex gap-1">
          {["#EF4444","#F59E0B","#10B981"].map(c=><div key={c} className="w-2 h-2 rounded-full" style={{background:c}}/>)}
        </div>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          {l:"القضايا النشطة",v:"152",c:"#6366F1"},
          {l:"الإيرادات",v:"1.8M",c:G},
          {l:"الموظفون",v:"38",c:"#10B981"},
          {l:"التحصيل",v:"96%",c:"#EC4899"},
        ].map(({l,v,c})=>(
          <div key={l} className="rounded-lg p-2 flex flex-col gap-0.5" style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${c}30`}}>
            <span className="text-[8px] text-white/40 leading-none">{l}</span>
            <span className="text-sm font-black leading-none" style={{color:c}}>{v}</span>
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="rounded-lg p-2" style={{background:"rgba(255,255,255,0.03)"}}>
        <div className="text-[8px] text-white/40 mb-1.5">الإيرادات الشهرية (ريال)</div>
        <div className="flex items-end gap-1 h-12">
          {[55,70,45,90,65,100,80,95,60,85,75,100].map((h,i)=>(
            <div key={i} className="flex-1 rounded-sm transition-all" style={{height:`${h}%`,background:i===11?G:`rgba(201,168,76,${0.2+i*0.03})`}}/>
          ))}
        </div>
      </div>
      {/* Recent cases */}
      <div className="space-y-1">
        {[
          ["قضية العقار - شركة الأمل","مفتوحة","#10B981"],
          ["نزاع تجاري - حمدان","جلسة قريبة","#6366F1"],
          ["استشارة قانونية","مكتملة","#C9A84C"],
        ].map(([n,s,c])=>(
          <div key={n as string} className="flex items-center justify-between px-2 py-1 rounded" style={{background:"rgba(255,255,255,0.03)"}}>
            <span className="text-[9px] text-white/60">{n as string}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{background:`${c}22`,color:c as string}}>{s as string}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenCases() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black text-white">إدارة القضايا</span>
        <div className="flex items-center gap-1">
          <div className="text-[8px] px-2 py-0.5 rounded-full font-bold" style={{background:`${G}22`,color:G}}>152 قضية</div>
          <div className="text-[8px] px-2 py-0.5 rounded-full" style={{background:"rgba(99,102,241,0.2)",color:"#818CF8"}}>+ إضافة</div>
        </div>
      </div>
      {/* Filter row */}
      <div className="flex gap-1 mb-2">
        {["الكل","مفتوحة","جلسة قريبة","مغلقة"].map((f,i)=>(
          <div key={f} className="text-[7px] px-2 py-0.5 rounded-full" style={{background:i===0?G:"rgba(255,255,255,0.06)",color:i===0?"#0D1626":"rgba(255,255,255,0.5)"}}>{f}</div>
        ))}
      </div>
      {/* Table */}
      <div className="space-y-1">
        {[
          {n:"قضية العقار #2024-091",t:"عقاري",s:"مفتوحة",c:"#10B981",d:"15 مارس"},
          {n:"نزاع تجاري #2024-085",t:"تجاري",s:"جلسة قريبة",c:"#6366F1",d:"18 مارس"},
          {n:"قضية عمالية #2024-079",t:"عمالي",s:"تحت التنفيذ",c:"#F59E0B",d:"20 مارس"},
          {n:"قضية أحوال شخصية #078",t:"أسري",s:"مفتوحة",c:"#10B981",d:"22 مارس"},
          {n:"استئناف حكم #2024-071",t:"جنائي",s:"مكتملة",c:"#6B7280",d:"1 مارس"},
        ].map(({n,t,s,c,d})=>(
          <div key={n} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
            <div className="flex-1 min-w-0">
              <div className="text-[8px] text-white/80 truncate">{n}</div>
              <div className="text-[7px] text-white/30">{t} • {d}</div>
            </div>
            <div className="text-[7px] px-1.5 py-0.5 rounded-full shrink-0" style={{background:`${c}22`,color:c}}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenCaseDetail() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="text-[8px] text-white/30">القضايا</div>
        <ChevronLeft className="w-2.5 h-2.5 text-white/30"/>
        <div className="text-[8px] text-white font-bold">قضية العقار #2024-091</div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {[{l:"رقم القضية",v:"#2024-091"},{l:"المحكمة",v:"العامة الرياض"},{l:"الجلسة القادمة",v:"15 مارس"}].map(({l,v})=>(
          <div key={l} className="rounded-lg p-1.5" style={{background:"rgba(255,255,255,0.04)"}}>
            <div className="text-[7px] text-white/30">{l}</div>
            <div className="text-[8px] text-white font-bold mt-0.5">{v}</div>
          </div>
        ))}
      </div>
      {/* AI Analysis card */}
      <div className="rounded-lg p-2 mb-2" style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)"}}>
        <div className="flex items-center gap-1 mb-1">
          <div className="w-3 h-3 rounded flex items-center justify-center" style={{background:"#6366F1"}}><Scale className="w-1.5 h-1.5 text-white"/></div>
          <span className="text-[8px] text-indigo-300 font-bold">تحليل الذكاء الاصطناعي</span>
          <span className="mr-auto text-[7px] px-1 rounded-full" style={{background:"rgba(16,185,129,0.2)",color:"#10B981"}}>85% فرصة نجاح</span>
        </div>
        <p className="text-[7px] text-white/50 leading-relaxed">بناءً على تحليل المستندات والسوابق القضائية، الموقف القانوني قوي. يُنصح بتقديم مستندات الملكية إضافياً.</p>
      </div>
      {/* Timeline */}
      <div className="space-y-1">
        {[["تقديم الدعوى","✓","#10B981"],["جلسة أولى","✓","#10B981"],["رفع المذكرة","✓","#C9A84C"],["جلسة قادمة","●","#6366F1"]].map(([l,ic,c])=>(
          <div key={l as string} className="flex items-center gap-2">
            <div className="text-[8px] font-bold" style={{color:c as string}}>{ic as string}</div>
            <div className="text-[8px] text-white/60">{l as string}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenClients() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black text-white">إدارة الموكلين</span>
        <div className="text-[8px] px-2 py-0.5 rounded-full font-bold" style={{background:`${G}22`,color:G}}>183 موكل</div>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        {[{l:"نشط",v:"147",c:"#10B981"},{l:"محتمل",v:"23",c:"#6366F1"},{l:"شركات",v:"41",c:G}].map(({l,v,c})=>(
          <div key={l} className="rounded-lg p-1.5 text-center" style={{background:`${c}12`,border:`1px solid ${c}25`}}>
            <div className="text-sm font-black" style={{color:c}}>{v}</div>
            <div className="text-[7px] text-white/40">{l}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {[
          {n:"شركة الأمل التجارية",t:"شركة",c:"#10B981",v:"42,000 ر"},
          {n:"حمدان المطيري",t:"فرد",c:"#6366F1",v:"8,500 ر"},
          {n:"مجموعة النور العقارية",t:"شركة",c:"#10B981",v:"125,000 ر"},
          {n:"سارة الشمري",t:"فرد",c:"#F59E0B",v:"3,200 ر"},
        ].map(({n,t,c,v})=>(
          <div key={n} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{background:"rgba(255,255,255,0.03)"}}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black text-[#0D1626] shrink-0" style={{background:c}}>{n[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[8px] text-white/80 truncate">{n}</div>
              <div className="text-[7px] text-white/30">{t}</div>
            </div>
            <div className="text-[8px] font-bold" style={{color:G}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenDocuments() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black text-white">المستندات</span>
        <div className="text-[8px] text-white/40">784 مستند</div>
      </div>
      {/* AI search */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg mb-2" style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)"}}>
        <Scale className="w-3 h-3 text-indigo-400 shrink-0"/>
        <span className="text-[8px] text-white/40">ابحث بالذكاء الاصطناعي... "عقود الإيجار 2024"</span>
        <div className="mr-auto text-[7px] px-1.5 py-0.5 rounded-full" style={{background:"#6366F1",color:"white"}}>بحث</div>
      </div>
      <div className="space-y-1">
        {[
          {n:"عقد بيع عقار - الأمل.pdf",s:"2.4 MB",d:"15 مارس",c:"#EF4444"},
          {n:"مذكرة قانونية #091.docx",s:"380 KB",d:"12 مارس",c:"#3B82F6"},
          {n:"صور الملكية.zip",s:"8.1 MB",d:"10 مارس",c:"#F59E0B"},
          {n:"حكم ابتدائي.pdf",s:"1.2 MB",d:"5 مارس",c:"#EF4444"},
          {n:"تقرير خبير عقاري.docx",s:"540 KB",d:"1 مارس",c:"#3B82F6"},
        ].map(({n,s,d,c})=>(
          <div key={n} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{background:"rgba(255,255,255,0.03)"}}>
            <div className="w-4 h-5 rounded flex items-center justify-center text-[6px] font-black text-white" style={{background:c}}>
              {n.includes(".pdf")?"PDF":n.includes(".docx")?"DOC":"ZIP"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[8px] text-white/80 truncate">{n}</div>
              <div className="text-[7px] text-white/30">{s} • {d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenLegalAI() {
  return (
    <div className="w-full h-full p-3 flex flex-col overflow-hidden" style={{background:"#0D1626"}}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#C9A84C,#E0C060)"}}><Scale className="w-2.5 h-2.5 text-[#0D1626]"/></div>
        <span className="text-xs font-black text-white">الذكاء الاصطناعي القانوني</span>
        <span className="mr-auto text-[7px] px-1.5 py-0.5 rounded-full text-green-400" style={{background:"rgba(16,185,129,0.15)"}}>متاح</span>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex justify-start">
          <div className="max-w-[75%] px-2 py-1.5 rounded-xl text-[8px] text-white/70" style={{background:"rgba(255,255,255,0.06)"}}>
            ما هي نقاط الضعف في دعوى الخصم؟
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[75%] px-2 py-1.5 rounded-xl text-[8px] leading-relaxed" style={{background:"rgba(201,168,76,0.12)",color:"#F0D060",border:"1px solid rgba(201,168,76,0.2)"}}>
            حددت ٣ نقاط ضعف رئيسية:<br/>
            ١. غياب وثيقة التسجيل<br/>
            ٢. تعارض في الشهادات<br/>
            ٣. انتهاء مدة التقادم
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[75%] px-2 py-1.5 rounded-xl text-[8px] text-white/70" style={{background:"rgba(255,255,255,0.06)"}}>
            اكتب مذكرة رد على ادعاءاتهم
          </div>
        </div>
        <div className="flex justify-end">
          <div className="px-2 py-1.5 rounded-xl text-[8px]" style={{background:"rgba(99,102,241,0.15)",color:"#818CF8",border:"1px solid rgba(99,102,241,0.2)"}}>
            ✦ جاري صياغة المذكرة...
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-1.5 px-2 py-1 rounded-lg" style={{background:"rgba(255,255,255,0.05)"}}>
        <span className="text-[8px] text-white/30 flex-1">اسأل المساعد القانوني...</span>
        <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{background:G}}><ArrowLeft className="w-2.5 h-2.5 text-[#0D1626]"/></div>
      </div>
    </div>
  );
}

function ScreenOpponentSim() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="text-xs font-black text-white mb-2">محاكي الخصم</div>
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <div className="rounded-lg p-2" style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)"}}>
          <div className="text-[7px] text-indigo-300 mb-1 font-bold">موقفك</div>
          <div className="text-[8px] text-white/70 leading-relaxed">الملكية مسجلة قانونياً منذ 2018، والعقد موثق لدى الجهات الرسمية</div>
        </div>
        <div className="rounded-lg p-2" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>
          <div className="text-[7px] text-red-400 mb-1 font-bold">⚔ الخصم يحتج بـ</div>
          <div className="text-[8px] text-white/70 leading-relaxed">وثائق مزورة وتواريخ متناقضة في عقد البيع الأصلي</div>
        </div>
      </div>
      <div className="rounded-lg p-2 mb-1.5" style={{background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)"}}>
        <div className="text-[7px] text-amber-400 font-bold mb-1">⚡ ردود مقترحة للمحاكمة</div>
        {["تقديم سجل الملكية الرسمي كدليل دامغ","طلب تحقيق خبير مستقل","الاستناد إلى الفقرة ١٢٣ نظام التسجيل"].map((r,i)=>(
          <div key={i} className="flex items-center gap-1 mb-0.5">
            <div className="w-3 h-3 rounded flex items-center justify-center text-[6px] font-black" style={{background:G,color:"#0D1626"}}>{i+1}</div>
            <span className="text-[7px] text-white/60">{r}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{background:"rgba(16,185,129,0.1)"}}>
        <TrendingUp className="w-3 h-3 text-green-400 shrink-0"/>
        <span className="text-[8px] text-green-400 font-bold">فرصة النجاح: 87%</span>
      </div>
    </div>
  );
}

function ScreenSessionPrep() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="text-xs font-black text-white mb-2">التحضير للجلسات</div>
      {/* Mini calendar */}
      <div className="rounded-lg p-2 mb-2" style={{background:"rgba(255,255,255,0.03)"}}>
        <div className="text-[8px] text-white/50 mb-1.5 font-bold">مارس 2025</div>
        <div className="grid grid-cols-7 gap-0.5">
          {["أح","إث","ثل","أر","خم","جم","سب"].map(d=><div key={d} className="text-[6px] text-white/30 text-center">{d}</div>)}
          {Array.from({length:31},(_, i)=>i+1).map(d=>(
            <div key={d} className={`text-[7px] rounded text-center py-0.5 ${d===15?"font-black text-[#0D1626]":d===18||d===20?"text-indigo-300":"text-white/30"}`}
              style={{background:d===15?G:d===18||d===20?"rgba(99,102,241,0.2)":"transparent"}}>
              {d}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        {[
          {d:"السبت 15 مارس",t:"قضية العقار #091","q":"10:00 ص","s":"#10B981"},
          {d:"الثلاثاء 18 مارس",t:"نزاع تجاري #085","q":"2:00 م","s":"#6366F1"},
          {d:"الخميس 20 مارس",t:"قضية عمالية #079","q":"11:00 ص","s":"#F59E0B"},
        ].map(({d,t,q,s})=>(
          <div key={t} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{background:"rgba(255,255,255,0.03)"}}>
            <div className="w-1 h-8 rounded-full shrink-0" style={{background:s}}/>
            <div>
              <div className="text-[8px] text-white/80 font-bold">{t}</div>
              <div className="text-[7px] text-white/30">{d} • {q}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenInvoices() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black text-white">الفواتير</span>
        <div className="text-[8px] font-bold" style={{color:G}}>2.1M إجمالي</div>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        {[{l:"مدفوعة",v:"89",c:"#10B981"},{l:"معلقة",v:"24",c:"#F59E0B"},{l:"متأخرة",v:"8",c:"#EF4444"}].map(({l,v,c})=>(
          <div key={l} className="rounded-lg p-1.5 text-center" style={{background:`${c}12`}}>
            <div className="text-sm font-black" style={{color:c}}>{v}</div>
            <div className="text-[7px] text-white/40">{l}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {[
          {id:"INV-2024-091",c:"شركة الأمل",a:"42,500",s:"مدفوعة",sc:"#10B981"},
          {id:"INV-2024-092",c:"حمدان المطيري",a:"8,200",s:"معلقة",sc:"#F59E0B"},
          {id:"INV-2024-093",c:"مجموعة النور",a:"125,000",s:"رابط دفع",sc:"#6366F1"},
          {id:"INV-2024-094",c:"سارة الشمري",a:"3,800",s:"متأخرة",sc:"#EF4444"},
        ].map(({id,c,a,s,sc})=>(
          <div key={id} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{background:"rgba(255,255,255,0.03)"}}>
            <div className="flex-1 min-w-0">
              <div className="text-[8px] text-white/70">{id}</div>
              <div className="text-[7px] text-white/30">{c}</div>
            </div>
            <div className="text-[8px] font-bold text-white">{a} ر</div>
            <div className="text-[7px] px-1.5 py-0.5 rounded-full" style={{background:`${sc}22`,color:sc}}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenPaymentCenter() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="text-xs font-black text-white mb-2">مركز الدفع الإلكتروني</div>
      {/* Stripe-like balance card */}
      <div className="rounded-xl p-3 mb-2 relative overflow-hidden" style={{background:"linear-gradient(135deg,rgba(201,168,76,0.15),rgba(99,102,241,0.1))",border:`1px solid ${G}30`}}>
        <div className="text-[7px] text-white/40 mb-0.5">الرصيد المتاح</div>
        <div className="text-2xl font-black" style={{color:G}}>184,250</div>
        <div className="text-[7px] text-white/40">ريال سعودي</div>
        <div className="flex gap-2 mt-2">
          <div className="text-[7px] px-2 py-1 rounded-lg font-bold text-[#0D1626]" style={{background:G}}>سحب</div>
          <div className="text-[7px] px-2 py-1 rounded-lg" style={{background:"rgba(255,255,255,0.1)",color:"white"}}>إرسال رابط</div>
        </div>
      </div>
      {/* Payment links */}
      <div className="text-[8px] text-white/50 mb-1 font-bold">روابط الدفع النشطة</div>
      <div className="space-y-1">
        {[
          {c:"مجموعة النور",a:"125,000",s:"بانتظار السداد"},
          {c:"عبدالله القحطاني",a:"18,500",s:"تم الفتح"},
          {c:"شركة التقنية",a:"45,000",s:"مدفوعة ✓"},
        ].map(({c,a,s})=>(
          <div key={c} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{background:"rgba(255,255,255,0.03)"}}>
            <CreditCard className="w-3 h-3 shrink-0" style={{color:G}}/>
            <div className="flex-1 min-w-0">
              <div className="text-[8px] text-white/70">{c}</div>
              <div className="text-[7px] text-white/30">{s}</div>
            </div>
            <div className="text-[8px] font-bold" style={{color:G}}>{a} ر</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenCollections() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="text-xs font-black text-white mb-2">التحصيل المالي</div>
      <div className="rounded-lg p-2 mb-2" style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)"}}>
        <div className="flex justify-between text-[8px] mb-1">
          <span className="text-white/50">معدل التحصيل</span>
          <span className="font-black text-green-400">96%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.08)"}}>
          <div className="h-full rounded-full" style={{width:"96%",background:"linear-gradient(90deg,#10B981,#34D399)"}}/>
        </div>
        <div className="flex justify-between text-[7px] mt-1 text-white/30">
          <span>المحصّل: 1.84M ر</span>
          <span>المتبقي: 76K ر</span>
        </div>
      </div>
      <div className="text-[8px] text-white/50 mb-1 font-bold">متابعة التحصيل</div>
      {[
        {c:"شركة الخليج",a:"45,000",d:"30 يوم",col:"#EF4444",act:"إرسال تنبيه"},
        {c:"فهد العتيبي",a:"12,500",d:"15 يوم",col:"#F59E0B",act:"تذكير تلقائي"},
        {c:"مؤسسة النجاح",a:"8,200",d:"5 أيام",col:"#10B981",act:"متابعة"},
      ].map(({c,a,d,col,act})=>(
        <div key={c} className="flex items-center gap-2 px-2 py-1.5 rounded mb-1" style={{background:"rgba(255,255,255,0.03)"}}>
          <div className="flex-1 min-w-0">
            <div className="text-[8px] text-white/80">{c}</div>
            <div className="text-[7px]" style={{color:col}}>متأخر {d}</div>
          </div>
          <div className="text-[8px] font-bold text-white">{a} ر</div>
          <div className="text-[7px] px-1.5 py-0.5 rounded-full" style={{background:`${col}22`,color:col}}>{act}</div>
        </div>
      ))}
    </div>
  );
}

function ScreenHR() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black text-white">الموارد البشرية</span>
        <span className="text-[8px]" style={{color:G}}>38 موظف</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        {[{l:"المحامون",v:"12",c:"#6366F1"},{l:"المساعدون",v:"18",c:"#10B981"},{l:"الإداريون",v:"8",c:G}].map(({l,v,c})=>(
          <div key={l} className="rounded-lg p-1.5 text-center" style={{background:`${c}12`}}>
            <div className="text-sm font-black" style={{color:c}}>{v}</div>
            <div className="text-[7px] text-white/40">{l}</div>
          </div>
        ))}
      </div>
      {[
        {n:"أحمد المنصوري",r:"محامي أول",s:"8,500",c:"#6366F1"},
        {n:"سارة القحطاني",r:"مساعد قانوني",s:"4,200",c:"#10B981"},
        {n:"محمد العمري",r:"إداري",s:"3,800",c:G},
        {n:"فاطمة الشهري",r:"محامية",s:"7,200",c:"#6366F1"},
      ].map(({n,r,s,c})=>(
        <div key={n} className="flex items-center gap-2 px-2 py-1.5 rounded mb-1" style={{background:"rgba(255,255,255,0.03)"}}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black text-[#0D1626] shrink-0" style={{background:c}}>{n[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[8px] text-white/80">{n}</div>
            <div className="text-[7px] text-white/30">{r}</div>
          </div>
          <div className="text-[8px] font-bold" style={{color:G}}>{s} ر</div>
        </div>
      ))}
    </div>
  );
}

function ScreenAttendance() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="text-xs font-black text-white mb-2">الحضور والانصراف</div>
      {/* Clock in card */}
      <div className="rounded-xl p-3 mb-2 text-center" style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)"}}>
        <div className="text-2xl font-black text-white mb-0.5">09:24</div>
        <div className="text-[7px] text-white/40 mb-2">الأحد، 15 مارس 2025</div>
        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[8px] font-bold" style={{background:"#10B981",color:"white"}}>
          <Check className="w-2.5 h-2.5"/> حاضر
        </div>
      </div>
      <div className="text-[8px] text-white/50 mb-1 font-bold">سجل الحضور اليوم</div>
      {[
        {n:"أحمد المنصوري",in:"08:55",out:"—",s:"حاضر","sc":"#10B981"},
        {n:"سارة القحطاني",in:"09:10",out:"—",s:"حاضر",sc:"#10B981"},
        {n:"محمد العمري",in:"—",out:"—",s:"غائب",sc:"#EF4444"},
        {n:"فاطمة الشهري",in:"08:30",out:"17:00",s:"انصرف",sc:"#6366F1"},
      ].map(({n,in:i,out:o,s,sc})=>(
        <div key={n} className="flex items-center gap-2 px-2 py-1 rounded mb-0.5" style={{background:"rgba(255,255,255,0.03)"}}>
          <div className="text-[8px] text-white/70 flex-1">{n}</div>
          <div className="text-[7px] text-white/30">{i} → {o}</div>
          <div className="text-[7px] px-1 rounded" style={{color:sc}}>{s}</div>
        </div>
      ))}
    </div>
  );
}

function ScreenOfficeWebsite() {
  return (
    <div className="w-full h-full overflow-hidden" style={{background:"#0D1626"}}>
      {/* Mini website header */}
      <div className="px-3 py-2 flex items-center gap-2" style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div className="w-4 h-4 rounded flex items-center justify-center" style={{background:G}}><Scale className="w-2 h-2 text-[#0D1626]"/></div>
        <span className="text-[9px] font-black text-white">مكتب الأحمدي للمحاماة</span>
        <Globe className="w-3 h-3 text-white/20 mr-auto"/>
      </div>
      <div className="p-3">
        {/* Hero */}
        <div className="rounded-xl p-3 mb-2 text-center" style={{background:"linear-gradient(135deg,rgba(201,168,76,0.12),rgba(99,102,241,0.08))"}}>
          <div className="text-[10px] font-black text-white mb-0.5">مكتب الأحمدي للمحاماة</div>
          <div className="text-[7px] text-white/40 mb-1.5">خبرة 15 عاماً في القانون السعودي</div>
          <div className="flex justify-center gap-1">
            <div className="text-[7px] px-2 py-0.5 rounded-full font-bold text-[#0D1626]" style={{background:G}}>احجز استشارة</div>
            <div className="text-[7px] px-2 py-0.5 rounded-full" style={{background:"rgba(255,255,255,0.1)",color:"white"}}>تواصل معنا</div>
          </div>
        </div>
        {/* Services */}
        <div className="grid grid-cols-3 gap-1">
          {["قانون تجاري","قانون عقاري","أحوال شخصية"].map((s,i)=>(
            <div key={s} className="rounded-lg p-1.5 text-center" style={{background:"rgba(255,255,255,0.04)"}}>
              <div className="w-4 h-4 rounded mx-auto mb-0.5 flex items-center justify-center" style={{background:["#6366F1","#10B981",G][i]+"22"}}>
                <Scale className="w-2 h-2" style={{color:["#6366F1","#10B981",G][i]}}/>
              </div>
              <div className="text-[7px] text-white/60">{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenLegalStore() {
  return (
    <div className="w-full h-full p-3 overflow-hidden" style={{background:"#0D1626"}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black text-white">متجر الخدمات القانونية</span>
        <span className="text-[7px]" style={{color:G}}>12 خدمة</span>
      </div>
      <div className="space-y-1.5">
        {[
          {s:"استشارة قانونية سريعة",p:"199",d:"30 دقيقة مع محامي متخصص",c:"#6366F1",sold:124},
          {s:"صياغة عقد تجاري",p:"899",d:"عقد احترافي خلال 48 ساعة",c:"#10B981",sold:56},
          {s:"مراجعة قانونية",p:"399",d:"تدقيق كامل لأي وثيقة",c:G,sold:89},
          {s:"تمثيل قضائي",p:"التواصل",d:"دفاع احترافي أمام المحاكم",c:"#EC4899",sold:31},
        ].map(({s,p,d,c,sold})=>(
          <div key={s} className="flex items-center gap-2 p-2 rounded-lg" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{background:`${c}18`}}>
              <Scale className="w-3.5 h-3.5" style={{color:c}}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[8px] text-white/80 font-bold">{s}</div>
              <div className="text-[7px] text-white/30">{d}</div>
              <div className="text-[7px] text-white/20">{sold} طلب مكتمل</div>
            </div>
            <div className="text-[9px] font-black shrink-0" style={{color:G}}>{p} {p!=="التواصل"?"ر":""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SCREENS CONFIG
═══════════════════════════════════════════════════════════════════ */
const SCREENS = [
  {
    id: 1, key: "dashboard",
    title: "لوحة التحكم الرئيسية",
    subtitle: "نظرة شاملة على كامل المكتب في لحظة",
    color: "#C9A84C",
    features: ["152 قضية نشطة بلمسة واحدة", "1.8 مليون ريال إيرادات محدّثة لحظياً", "رسوم بيانية ذكية وتحليلات فورية", "تنبيهات الجلسات والمواعيد الحرجة"],
    component: ScreenDashboard,
  },
  {
    id: 2, key: "cases",
    title: "إدارة القضايا",
    subtitle: "تتبع كل قضية من الفتح حتى الإغلاق",
    color: "#6366F1",
    features: ["تصفية القضايا حسب النوع والحالة", "جدول احترافي مع بيانات كاملة", "ربط المستندات والموكلين تلقائياً", "تحليل ذكي لأولويات القضايا"],
    component: ScreenCases,
  },
  {
    id: 3, key: "case-detail",
    title: "تفاصيل القضية",
    subtitle: "كل تفصيل عن القضية في شاشة واحدة",
    color: "#10B981",
    features: ["تحليل ذكاء اصطناعي بنسبة نجاح 85%", "جدول زمني لمراحل القضية", "مستندات مرفقة مصنّفة تلقائياً", "ملاحظات وتعليقات الفريق القانوني"],
    component: ScreenCaseDetail,
  },
  {
    id: 4, key: "clients",
    title: "إدارة الموكلين (CRM)",
    subtitle: "قاعدة بيانات موكليك بالكامل",
    color: "#F59E0B",
    features: ["183 موكل مصنّف حسب النوع", "تتبع إيرادات كل موكل", "سجل تواصل كامل وتاريخ القضايا", "بطاقات موكلين احترافية قابلة للطباعة"],
    component: ScreenClients,
  },
  {
    id: 5, key: "documents",
    title: "المستندات والبحث الذكي",
    subtitle: "بحث في 784 مستند بلغة طبيعية",
    color: "#3B82F6",
    features: ["بحث ذكي بالعربية في ثوانٍ", "تصنيف تلقائي للمستندات", "معاينة سريعة بدون تحميل", "مشاركة آمنة مع الفريق"],
    component: ScreenDocuments,
  },
  {
    id: 6, key: "legal-ai",
    title: "الذكاء الاصطناعي القانوني",
    subtitle: "مساعدك القانوني الذكي على مدار الساعة",
    color: "#8B5CF6",
    features: ["تحليل نقاط قوة وضعف القضية", "صياغة مذكرات قانونية احترافية", "اقتراح استراتيجيات الدفاع", "بحث في السوابق القضائية السعودية"],
    component: ScreenLegalAI,
  },
  {
    id: 7, key: "opponent",
    title: "محاكي الخصم",
    subtitle: "تدرّب على المواجهة قبل يوم المحاكمة",
    color: "#EF4444",
    features: ["توقع حجج الخصم بدقة 87%", "اقتراح ردود قانونية فعّالة", "تحليل نقاط الضعف في موقفهم", "تمرين كامل لسيناريوهات المحاكمة"],
    component: ScreenOpponentSim,
  },
  {
    id: 8, key: "sessions",
    title: "التحضير للجلسات",
    subtitle: "لا تدخل قاعة المحكمة غير مستعد",
    color: "#EC4899",
    features: ["تقويم تفاعلي بجميع الجلسات", "قائمة تحضير لكل جلسة", "تذكيرات تلقائية قبل الجلسة", "ملف إحاطة شامل لكل قضية"],
    component: ScreenSessionPrep,
  },
  {
    id: 9, key: "invoices",
    title: "الفواتير الإلكترونية",
    subtitle: "فاتورة احترافية في ثوانٍ",
    color: "#C9A84C",
    features: ["فاتورة متوافقة مع ZATCA", "إرسال فوري عبر البريد والواتساب", "متابعة حالة السداد لحظياً", "تقارير مالية تلقائية شهرية"],
    component: ScreenInvoices,
  },
  {
    id: 10, key: "payment",
    title: "مركز الدفع الإلكتروني",
    subtitle: "استلم أتعابك من أي مكان في العالم",
    color: "#10B981",
    features: ["روابط دفع مباشرة بضغطة واحدة", "قبول بطاقات ائتمانية عالمية", "تتبع حالة السداد لحظياً", "تحويل فوري للحساب البنكي"],
    component: ScreenPaymentCenter,
  },
  {
    id: 11, key: "collections",
    title: "التحصيل المالي",
    subtitle: "معدل تحصيل 96% مع متابعة ذكية",
    color: "#34D399",
    features: ["تذكيرات تلقائية للمتأخرين", "جدولة مدفوعات مرنة", "تقارير عمر الديون التفصيلية", "إشعارات فورية عند كل سداد"],
    component: ScreenCollections,
  },
  {
    id: 12, key: "hr",
    title: "الموارد البشرية",
    subtitle: "إدارة فريقك القانوني باحترافية",
    color: "#A855F7",
    features: ["ملفات 38 موظف مكتملة", "رواتب ومكافآت وعمولات آلية", "تقييمات أداء دورية", "هيكل تنظيمي تفاعلي"],
    component: ScreenHR,
  },
  {
    id: 13, key: "attendance",
    title: "الحضور والانصراف",
    subtitle: "حضور بصمة أو GPS مع تقارير فورية",
    color: "#06B6D4",
    features: ["حضور رقمي بدون بصمة تقليدية", "تقارير حضور يومية وشهرية", "حساب الإجازات والغيابات تلقائياً", "تنبيهات الغياب المتكرر"],
    component: ScreenAttendance,
  },
  {
    id: 14, key: "website",
    title: "موقع المكتب العام",
    subtitle: "احضور رقمي احترافي لمكتبك",
    color: "#F97316",
    features: ["موقع جاهز لمكتبك في دقائق", "صفحة خدمات وتخصصات", "نموذج تواصل واستشارة أولية", "ظهور في محركات البحث"],
    component: ScreenOfficeWebsite,
  },
  {
    id: 15, key: "store",
    title: "متجر الخدمات القانونية",
    subtitle: "حوّل خبرتك القانونية إلى دخل رقمي",
    color: "#D946EF",
    features: ["بيع خدماتك للعملاء مباشرة", "استشارات مدفوعة إلكترونياً", "عقود جاهزة قابلة للتخصيص", "تقييمات وآراء العملاء"],
    component: ScreenLegalStore,
  },
];

/* ══════════════════════════════════════════════════════════════════
   WORKFLOW JOURNEY
═══════════════════════════════════════════════════════════════════ */
const JOURNEY = [
  { icon: "👤", label: "استقبال العميل" },
  { icon: "📁", label: "فتح القضية" },
  { icon: "📄", label: "رفع المستندات" },
  { icon: "🤖", label: "تحليل الذكاء الاصطناعي" },
  { icon: "📝", label: "إنشاء العقد" },
  { icon: "🧾", label: "إصدار الفاتورة" },
  { icon: "🔗", label: "رابط الدفع" },
  { icon: "💳", label: "سداد العميل" },
  { icon: "📊", label: "متابعة القضية" },
  { icon: "✅", label: "إغلاق الملف" },
];

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function PlatformShowcase() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [modal, setModal] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStart = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => setActive(p => (p + 1) % SCREENS.length), []);
  const goPrev = useCallback(() => setActive(p => (p - 1 + SCREENS.length) % SCREENS.length), []);

  /* Auto-play */
  useEffect(() => {
    if (!playing) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(goNext, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, goNext]);

  /* Touch swipe */
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? goNext() : goPrev(); }
    touchStart.current = null;
  };

  const screen = SCREENS[active];
  const Screen = screen.component;

  return (
    <section id="showcase" className="py-24 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full blur-[160px] opacity-[0.06]" style={{ background: G }} />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-4"
            style={{ background: `${G}18`, border: `1px solid ${G}35`, color: G }}>
            <Play className="w-3.5 h-3.5 fill-current" />
            عدالة في 60 ثانية
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
            شاهد كيف تعمل{" "}
            <span style={{ background: `linear-gradient(135deg, ${G}, #F0D060)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              عدالة
            </span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            لا وصف أقوى من الواقع — تصفّح 15 وحدة حقيقية من المنصة وشاهد كيف تُدار القضية كاملةً من الاستقبال حتى التحصيل
          </p>
        </motion.div>

        {/* Main showcase grid */}
        <div className="grid lg:grid-cols-[280px_1fr_280px] gap-6 items-start">

          {/* Left thumbnails (desktop) */}
          <div className="hidden lg:flex flex-col gap-1.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
            {SCREENS.slice(0, 8).map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setActive(i); setPlaying(false); }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-right transition-all"
                style={{
                  background: active === i ? `${s.color}18` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active === i ? s.color + "40" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: active === i ? s.color : "rgba(255,255,255,0.15)" }} />
                <span className="text-xs font-medium truncate" style={{ color: active === i ? s.color : "rgba(255,255,255,0.5)" }}>
                  {s.title}
                </span>
              </button>
            ))}
          </div>

          {/* Center: main screen */}
          <div
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="relative"
          >
            {/* Browser chrome */}
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              {/* Top bar */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#070E1C", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex gap-1.5">
                  {["#EF4444","#F59E0B","#10B981"].map(c=><div key={c} className="w-3 h-3 rounded-full" style={{background:c}}/>)}
                </div>
                <div className="flex-1 mx-4 px-3 py-1.5 rounded-lg text-xs text-white/30 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                  app.adalah-ai.sa / {screen.key}
                </div>
                {/* Playback controls */}
                <button
                  onClick={() => setPlaying(p => !p)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                  style={{ background: playing ? `${G}25` : "rgba(255,255,255,0.08)" }}
                >
                  {playing
                    ? <Pause className="w-3 h-3" style={{ color: G }} />
                    : <Play className="w-3 h-3 text-white/60" />
                  }
                </button>
              </div>

              {/* Screen content */}
              <div className="relative overflow-hidden" style={{ height: 340, background: "#0D1626" }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    className="absolute inset-0"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <Screen />
                  </motion.div>
                </AnimatePresence>

                {/* Click overlay */}
                <button
                  onClick={() => setModal(active)}
                  className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
                >
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-[#0D1626]" style={{ background: G }}>
                    <Zap className="w-4 h-4" />
                    عرض التفاصيل
                  </div>
                </button>
              </div>

              {/* Bottom info bar */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#070E1C", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <div className="text-sm font-bold text-white">{screen.title}</div>
                  <div className="text-xs text-white/40">{screen.subtitle}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { goPrev(); setPlaying(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <ChevronRight className="w-4 h-4 text-white/60" />
                  </button>
                  <button onClick={() => { goNext(); setPlaying(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <ChevronLeft className="w-4 h-4 text-white/60" />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
              {SCREENS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { setActive(i); setPlaying(false); }}
                  className="rounded-full transition-all"
                  style={{
                    width: active === i ? 20 : 6,
                    height: 6,
                    background: active === i ? screen.color : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>

            {/* Screen counter */}
            <div className="text-center mt-2">
              <span className="text-xs text-white/30">{active + 1} / {SCREENS.length}</span>
            </div>
          </div>

          {/* Right thumbnails (desktop) */}
          <div className="hidden lg:flex flex-col gap-1.5 max-h-[500px] overflow-y-auto pl-1 scrollbar-thin">
            {SCREENS.slice(8).map((s, i) => {
              const idx = i + 8;
              return (
                <button
                  key={s.id}
                  onClick={() => { setActive(idx); setPlaying(false); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-right transition-all"
                  style={{
                    background: active === idx ? `${s.color}18` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active === idx ? s.color + "40" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: active === idx ? s.color : "rgba(255,255,255,0.15)" }} />
                  <span className="text-xs font-medium truncate" style={{ color: active === idx ? s.color : "rgba(255,255,255,0.5)" }}>
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile: horizontal scroll thumbnails */}
        <div className="lg:hidden flex gap-2 mt-4 overflow-x-auto pb-2">
          {SCREENS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setActive(i); setPlaying(false); }}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: active === i ? s.color : "rgba(255,255,255,0.06)",
                color: active === i ? "#0D1626" : "rgba(255,255,255,0.5)",
              }}
            >
              {s.title.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* ── WORKFLOW JOURNEY ───────────────────────────────────────── */}
        <motion.div
          className="mt-16 rounded-2xl p-6 md:p-8 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-6">
            <div className="text-sm font-bold mb-1" style={{ color: G }}>رحلة العمل الكاملة</div>
            <div className="text-white font-black text-lg">من استقبال العميل حتى استلام الأتعاب</div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 md:gap-0">
            {JOURNEY.map((j, i) => (
              <div key={j.label} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg mb-1.5 transition-all"
                    style={{ background: `rgba(201,168,76,${0.06 + i * 0.04})`, border: "1px solid rgba(201,168,76,0.15)" }}>
                    {j.icon}
                  </div>
                  <span className="text-[9px] text-white/50 text-center max-w-[60px] leading-tight">{j.label}</span>
                </div>
                {i < JOURNEY.length - 1 && (
                  <div className="hidden md:flex items-center mx-1 mb-4">
                    <div className="h-px w-6" style={{ background: `rgba(201,168,76,${0.15 + i * 0.03})` }} />
                    <ChevronLeft className="w-3 h-3 -mr-2" style={{ color: `rgba(201,168,76,${0.2 + i * 0.04})` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── PAYMENT STRIP ──────────────────────────────────────────── */}
        <motion.div
          className="mt-6 rounded-2xl p-5 md:p-7 overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.1), rgba(16,185,129,0.06))", border: "1px solid rgba(201,168,76,0.2)" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[60px] opacity-20" style={{ background: G }} />
          <div className="relative">
            <div className="flex flex-col md:flex-row items-center gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-5 h-5" style={{ color: G }} />
                  <span className="font-black text-white text-lg">استلم أتعابك من أي مكان في العالم</span>
                </div>
                <p className="text-white/50 text-sm">بوابة دفع مدمجة تدعم البطاقات الائتمانية العالمية وMada وApple Pay</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 flex-shrink-0">
                {[
                  "إصدار فاتورة خلال ثوانٍ",
                  "روابط دفع مباشرة",
                  "بطاقات ائتمانية عالمية",
                  "تتبع حالة السداد",
                  "إشعارات تلقائية",
                  "تقارير مالية لحظية",
                ].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-white/70">
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: G }} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── CTA ────────────────────────────────────────────────────── */}
        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={`${BASE}/sign-up`}>
              <button
                className="flex items-center gap-2 font-black px-8 py-4 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02] shadow-xl"
                style={{ background: `linear-gradient(135deg, ${G}, #E0C060)`, color: "#0D1626", boxShadow: `0 8px 32px ${G}40` }}
              >
                ابدأ تجربتك المجانية الآن
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <button
              onClick={() => { setModal(active); setPlaying(false); }}
              className="flex items-center gap-2 font-bold px-8 py-4 rounded-xl text-base transition-all hover:bg-white/5"
              style={{ border: `1px solid ${G}40`, color: G, background: `${G}08` }}
            >
              <BarChart3 className="w-4 h-4" />
              شاهد جميع إمكانيات عدالة
            </button>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           MODAL / LIGHTBOX
      ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }} />

            <motion.div
              className="relative w-full max-w-3xl rounded-2xl overflow-hidden"
              style={{ background: "#0D1626", border: "1px solid rgba(255,255,255,0.1)" }}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#070E1C" }}>
                <div>
                  <div className="font-black text-white">{SCREENS[modal].title}</div>
                  <div className="text-sm text-white/40">{SCREENS[modal].subtitle}</div>
                </div>
                <button onClick={() => setModal(null)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-0">
                {/* Screen preview */}
                <div className="relative" style={{ height: 340, background: "#0D1626", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                  {(() => { const Comp = SCREENS[modal].component; return <Comp />; })()}
                </div>

                {/* Features list */}
                <div className="p-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
                    style={{ background: `${SCREENS[modal].color}18`, color: SCREENS[modal].color, border: `1px solid ${SCREENS[modal].color}30` }}>
                    <Bell className="w-3 h-3" />
                    الوحدة {SCREENS[modal].id} من 15
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">{SCREENS[modal].title}</h3>
                  <p className="text-white/50 text-sm mb-5">{SCREENS[modal].subtitle}</p>
                  <div className="space-y-2.5">
                    {SCREENS[modal].features.map((f, i) => (
                      <motion.div
                        key={f}
                        className="flex items-start gap-2.5"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                      >
                        <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${SCREENS[modal].color}20`, border: `1px solid ${SCREENS[modal].color}30` }}>
                          <Check className="w-3 h-3" style={{ color: SCREENS[modal].color }} />
                        </div>
                        <span className="text-sm text-white/70">{f}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={() => { setModal((modal - 1 + SCREENS.length) % SCREENS.length); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-80"
                      style={{ background: "rgba(255,255,255,0.06)", color: "white/60" }}
                    >
                      السابق
                    </button>
                    <button
                      onClick={() => { setModal((modal + 1) % SCREENS.length); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                      style={{ background: SCREENS[modal].color, color: "#0D1626" }}
                    >
                      التالي
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal footer CTA */}
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#070E1C" }}>
                <span className="text-xs text-white/30">ابدأ مجاناً — لا بطاقة ائتمانية مطلوبة</span>
                <Link href={`${BASE}/sign-up`}>
                  <button className="flex items-center gap-1.5 font-bold px-5 py-2 rounded-xl text-sm text-[#0D1626] transition-all hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${G}, #E0C060)` }}>
                    ابدأ مجاناً الآن
                    <ArrowLeft className="w-3.5 h-3.5" />
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
