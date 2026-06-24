import { useState } from "react";
import { Star, MapPin, Phone, Mail, MessageCircle, Calendar, Users, Briefcase, Shield, Scale, Zap, Globe, Twitter, Linkedin, ArrowRight, Cpu, Brain, TrendingUp, Lock, ChevronDown, Quote, CheckCircle2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./LuxLegal";

const imgSrc = (p: string | null | undefined) => !p ? undefined : p.startsWith("http") ? p : `/api/storage/objects${p.startsWith("/") ? p : "/" + p}`;
const waNum = (r: string) => { const d = r.replace(/\D/g, ""); return d.startsWith("0") ? "966" + d.slice(1) : d; };

function Stars({ n }: { n: number }) {
  return <div className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn("h-3.5 w-3.5 fill-current", i < n ? "text-blue-400" : "text-white/10")} />
  ))}</div>;
}

const BG = "#070B18";
const CARD = "#0D1424";
const BORDER = "rgba(59,130,246,0.2)";
const BLUE = "#3B82F6";
const BLUE_DIM = "rgba(59,130,246,0.12)";

export function AILegal({ office, services, team, reviews, lang, slug, onOrder, onNegotiate }: TemplateProps) {
  const [filterCat, setFilterCat] = useState("الكل");
  const officeName = lang === "ar" ? (office.name ?? "") : (office.nameEn || office.name || "");
  const tagline = lang === "ar" ? (office.tagline ?? "") : (office.taglineEn || office.tagline || "");
  const avgRating = reviews.length > 0 ? (reviews.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const cats = ["الكل", ...Array.from(new Set(services.map((s: any) => s.category).filter(Boolean))) as string[]];
  const filtered = filterCat === "الكل" ? services : services.filter((s: any) => s.category === filterCat);
  const wh = office.whatsapp || office.phone;
  const waUrl = wh ? `https://wa.me/${waNum(wh)}` : null;
  const primaryColor = office.website_config?.colors?.primary || BLUE;

  return (
    <div dir="rtl" style={{ background: BG, color: "#E2E8F0", fontFamily: "'Cairo', sans-serif", minHeight: "100vh" }}>

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-4"
        style={{ background: "rgba(7,11,24,0.85)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3">
          {office.logo
            ? <img src={imgSrc(office.logo)} alt="" className="h-9 w-9 rounded-xl object-cover ring-1" style={{ outlineColor: BORDER }} />
            : <div className="h-9 w-9 rounded-xl flex items-center justify-center font-black" style={{ background: BLUE_DIM, color: primaryColor, border: `1px solid ${BORDER}` }}>{(officeName || "م")[0]}</div>
          }
          <span className="font-black text-sm">{officeName}</span>
          <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: BLUE_DIM, color: primaryColor, border: `1px solid ${BORDER}` }}>
            <Bot className="h-2.5 w-2.5" /> AI-Powered
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-xs text-slate-400">
          {services.length > 0 && <a href="#services" className="hover:text-white transition-colors">الخدمات</a>}
          {team.length > 0 && <a href="#team" className="hover:text-white transition-colors">الفريق</a>}
          <a href="#contact" className="hover:text-white transition-colors">تواصل</a>
        </div>
        <a href={`/firms/${slug}/book`}>
          <button className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, #1D4ED8)` }}>
            <Calendar className="h-3.5 w-3.5" /> احجز الآن
          </button>
        </a>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center pt-20">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-[120px] opacity-15" style={{ background: primaryColor }} />
          <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full blur-[80px] opacity-8" style={{ background: "#8B5CF6" }} />
          {/* Grid */}
          <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(${BORDER} 1px, transparent 1px), linear-gradient(90deg, ${BORDER} 1px, transparent 1px)`, backgroundSize: "60px 60px", opacity: 0.4 }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-8 py-20 grid md:grid-cols-2 gap-16 items-center">
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-xs font-bold" style={{ background: BLUE_DIM, color: primaryColor, border: `1px solid ${BORDER}` }}>
              <Cpu className="h-3.5 w-3.5" />
              الذكاء الاصطناعي في خدمة القانون
              <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-green-400" />
            </div>

            <h1 className="text-5xl md:text-6xl font-black leading-tight mb-5 tracking-tight" style={{ color: "#F8FAFC" }}>
              {officeName}
            </h1>
            {tagline && <p className="text-base mb-8 leading-relaxed" style={{ color: "#94A3B8" }}>{tagline}</p>}

            <div className="flex flex-wrap gap-3 mb-10">
              <a href={`/firms/${slug}/book`}>
                <button className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, #1D4ED8)` }}>
                  <Calendar className="h-4 w-4" /> احجز استشارة ذكية
                  <ArrowRight className="h-4 w-4" />
                </button>
              </a>
              {waUrl && (
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <button className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all">
                    <MessageCircle className="h-4 w-4" /> واتساب
                  </button>
                </a>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-3">
              {avgRating && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <Star className="h-3.5 w-3.5 fill-current text-blue-400" /> {avgRating} تقييم ممتاز
                </div>
              )}
              {office.city && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <MapPin className="h-3.5 w-3.5" /> {office.city}
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <Lock className="h-3.5 w-3.5" /> استشارة آمنة 100%
              </div>
            </div>
          </div>

          {/* Dashboard card */}
          <div className="hidden md:block">
            <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: BORDER }}>
                {[primaryColor, "#8B5CF6", "#10B981"].map((c, i) => (
                  <div key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                ))}
                <span className="text-xs text-slate-500 mr-2">لوحة القضايا</span>
              </div>
              <div className="p-5 space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { v: office.casesCount || "٢٤٠", l: "قضية", c: primaryColor },
                    { v: office.clientsCount || "١٨٠", l: "عميل", c: "#8B5CF6" },
                    { v: office.yearsActive || "١٢", l: "سنة", c: "#10B981" },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl p-3 text-center" style={{ background: `${s.c}15`, border: `1px solid ${s.c}30` }}>
                      <div className="text-xl font-black" style={{ color: s.c }}>{s.v}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{s.l}</div>
                    </div>
                  ))}
                </div>
                {/* Case list */}
                {services.slice(0, 4).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: BLUE_DIM }}>
                      <Scale className="h-4 w-4" style={{ color: primaryColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{s.name}</div>
                      {!s.customQuote && s.price > 0 && <div className="text-[10px] mt-0.5" style={{ color: primaryColor }}>{Number(s.price).toLocaleString("ar-SA")} ر.س</div>}
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Brain, title: "تحليل ذكي", desc: "نستخدم AI لتحليل قضيتك وتقديم أفضل استراتيجية" },
            { icon: Zap, title: "استجابة فورية", desc: "رد خلال ساعات لا أيام على جميع الاستفسارات" },
            { icon: Shield, title: "سرية تامة", desc: "حماية كاملة لبياناتك بأعلى معايير الأمن" },
            { icon: TrendingUp, title: "نتائج مُثبتة", desc: "سجل حافل بالقضايا الناجحة والعملاء الراضين" },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl p-5 transition-all hover:translate-y-[-2px]" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4" style={{ background: BLUE_DIM }}>
                <f.icon className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <h3 className="font-bold text-sm mb-2 text-white">{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      {services.length > 0 && (
        <section id="services" className="max-w-6xl mx-auto px-8 py-16">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: BLUE_DIM, color: primaryColor, border: `1px solid ${BORDER}` }}>
                <Briefcase className="h-3.5 w-3.5" /> الخدمات القانونية
              </div>
              <h2 className="text-3xl font-black text-white">حلول قانونية متكاملة</h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              {cats.map(c => (
                <button key={c} onClick={() => setFilterCat(c)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={filterCat === c
                    ? { background: primaryColor, color: "#fff" }
                    : { background: CARD, color: "#64748B", border: `1px solid ${BORDER}` }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((svc: any) => (
              <div key={svc.id} className="group rounded-2xl p-5 transition-all hover:border-blue-500/40" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: BLUE_DIM }}>
                    <Scale className="h-5 w-5" style={{ color: primaryColor }} />
                  </div>
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse mt-2" />
                </div>
                <h3 className="font-bold text-sm mb-2 text-white">{svc.name}</h3>
                {svc.description && <p className="text-xs leading-relaxed mb-4" style={{ color: "#64748B" }}>{svc.description}</p>}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t" style={{ borderColor: BORDER }}>
                  {!svc.customQuote && svc.price > 0
                    ? <span className="text-sm font-black" style={{ color: primaryColor }}>{Number(svc.price).toLocaleString("ar-SA")} ر.س</span>
                    : <span className="text-xs text-slate-500">حسب الطلب</span>
                  }
                  <div className="flex gap-2">
                    <button onClick={() => onOrder?.(svc)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all" style={{ background: primaryColor }}>اطلب</button>
                    <button onClick={() => onNegotiate?.(svc)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={{ background: BLUE_DIM, color: primaryColor, border: `1px solid ${BORDER}` }}>تفاوض</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TEAM */}
      {team.length > 0 && (
        <section id="team" className="max-w-6xl mx-auto px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white">فريق المحامين</h2>
            <p className="mt-2 text-sm" style={{ color: "#64748B" }}>خبراء قانونيون بأعلى كفاءة</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {team.map((m: any) => (
              <div key={m.id} className="rounded-2xl p-5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                {m.avatar
                  ? <img src={imgSrc(m.avatar)} alt="" className="h-16 w-16 rounded-2xl object-cover mx-auto mb-3 ring-1" style={{ outlineColor: BORDER }} />
                  : <div className="h-16 w-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-xl font-black" style={{ background: BLUE_DIM, color: primaryColor }}>{(m.name || "م")[0]}</div>
                }
                <h3 className="text-sm font-bold text-white">{m.name}</h3>
                {m.title && <p className="text-xs mt-1" style={{ color: primaryColor }}>{m.title}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* REVIEWS */}
      {reviews.length > 0 && (
        <section className="max-w-6xl mx-auto px-8 py-16">
          <h2 className="text-3xl font-black text-white text-center mb-10">تقييمات العملاء</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.slice(0, 6).map((r: any) => (
              <div key={r.id} className="rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <Stars n={Number(r.rating || 5)} />
                <p className="text-xs leading-relaxed my-3" style={{ color: "#94A3B8" }}>"{r.text}"</p>
                <p className="text-xs font-bold" style={{ color: primaryColor }}>{r.clientName}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CONTACT */}
      <section id="contact" className="max-w-4xl mx-auto px-8 py-20 text-center">
        <div className="rounded-3xl p-12 relative overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${primaryColor}15 0%, transparent 60%)` }} />
          <div className="relative">
            <Cpu className="h-8 w-8 mx-auto mb-4" style={{ color: primaryColor }} />
            <h2 className="text-3xl font-black text-white mb-3">ابدأ استشارتك الذكية</h2>
            <p className="mb-8 text-sm" style={{ color: "#64748B" }}>استشارة قانونية مدعومة بالذكاء الاصطناعي — فورية ودقيقة</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href={`/firms/${slug}/book`}>
                <button className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-105" style={{ background: `linear-gradient(135deg, ${primaryColor}, #1D4ED8)` }}>
                  <Calendar className="h-4 w-4" /> احجز استشارة
                </button>
              </a>
              {waUrl && (
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <button className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all">
                    <MessageCircle className="h-4 w-4" /> واتساب
                  </button>
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-6 justify-center mt-8 text-sm" style={{ color: "#475569" }}>
              {office.phone && <a href={`tel:${office.phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors"><Phone className="h-4 w-4" />{office.phone}</a>}
              {office.email && <a href={`mailto:${office.email}`} className="flex items-center gap-1.5 hover:text-white transition-colors"><Mail className="h-4 w-4" />{office.email}</a>}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs" style={{ borderColor: BORDER, color: "#475569" }}>
        <p>© {new Date().getFullYear()} {officeName} · Powered by عدالة AI</p>
      </footer>
    </div>
  );
}
