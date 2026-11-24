import { useState } from "react";
import { Star, MapPin, Phone, Mail, MessageCircle, BadgeCheck, Calendar, Users, Briefcase, Award, ChevronLeft, Shield, Scale, FileText, Gavel, Globe, Twitter, Linkedin, Instagram, ArrowLeft, ShoppingBag, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const imgSrc = (p: string | null | undefined) => !p ? undefined : p.startsWith("http") ? p : `/api/storage/objects${p.startsWith("/") ? p : "/" + p}`;
const waNum = (r: string) => { const d = r.replace(/\D/g, ""); return d.startsWith("0") ? "966" + d.slice(1) : d; };

const GOLD = "#C9A84C";
const GOLD_DIM = "#C9A84C33";
const GOLD_BORDER = "#C9A84C50";

function Stars({ n }: { n: number }) {
  return <div className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn("h-3.5 w-3.5", i < n ? "fill-current" : "opacity-20")} style={{ color: GOLD }} />
  ))}</div>;
}

export interface TemplateProps {
  office: any; services: any[]; team: any[]; reviews: any[];
  lang: "ar" | "en"; slug: string;
  onOrder?: (svc: any) => void; onNegotiate?: (svc: any) => void;
}

export function LuxLegal({ office, services, team, reviews, lang, slug, onOrder, onNegotiate }: TemplateProps) {
  const [filterCat, setFilterCat] = useState<string>("الكل");
  const officeName = lang === "ar" ? (office.name ?? "") : (office.nameEn || office.name || "");
  const tagline = lang === "ar" ? (office.tagline ?? "") : (office.taglineEn || office.tagline || "");
  const avgRating = reviews.length > 0 ? (reviews.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const cats = ["الكل", ...Array.from(new Set(services.map((s: any) => s.category).filter(Boolean))) as string[]];
  const filtered = filterCat === "الكل" ? services : services.filter((s: any) => s.category === filterCat);
  const wh = office.whatsapp || office.phone;
  const waUrl = wh ? `https://wa.me/${waNum(wh)}` : null;

  return (
    <div dir="rtl" style={{ background: "#080810", color: "#E2D9C8", fontFamily: "'Cairo', sans-serif", minHeight: "100vh" }}>

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-5"
        style={{ background: "rgba(8,8,16,0.9)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${GOLD_BORDER}` }}>
        <div className="flex items-center gap-3">
          {office.logo
            ? <img src={imgSrc(office.logo)} alt="" className="h-10 w-10 rounded-full object-cover ring-1" style={{ outlineColor: GOLD_BORDER }} />
            : <div className="h-10 w-10 rounded-full flex items-center justify-center font-black text-base" style={{ background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>{(officeName || "م")[0]}</div>
          }
          <span className="font-black text-base tracking-wide" style={{ color: "#E2D9C8" }}>{officeName}</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm" style={{ color: "#9A8F7E" }}>
          {services.length > 0 && <a href="#services" className="hover:opacity-80 transition-opacity">خدماتنا</a>}
          {team.length > 0 && <a href="#team" className="hover:opacity-80 transition-opacity">فريقنا</a>}
          <a href="#contact" className="hover:opacity-80 transition-opacity">تواصل</a>
        </div>
        <a href={`/firms/${slug}/book`}>
          <button className="px-5 py-2 rounded-full text-sm font-bold transition-all hover:opacity-90"
            style={{ background: GOLD, color: "#080810" }}>
            احجز استشارة
          </button>
        </a>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center text-center overflow-hidden pt-20">
        <div className="absolute inset-0">
          {office.cover
            ? <><img src={imgSrc(office.cover)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" /><div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, #080810 0%, rgba(8,8,16,0.7) 50%, #080810 100%)" }} /></>
            : <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(201,168,76,0.08) 0%, transparent 70%)" }} />
          }
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A84C' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-32">
          <div className="inline-flex items-center gap-2 mb-8 px-5 py-2 rounded-full text-xs font-bold tracking-widest uppercase"
            style={{ background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>
            <Shield className="h-3.5 w-3.5" />
            {office.city ? `${office.city} — ` : ""}محاماة واستشارات قانونية
          </div>

          <h1 className="text-6xl md:text-8xl font-black mb-6 leading-none tracking-tight"
            style={{ color: "#F0E6D3", textShadow: `0 0 80px ${GOLD}30` }}>
            {officeName}
          </h1>

          {tagline && (
            <p className="text-xl md:text-2xl mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: "#9A8F7E" }}>
              {tagline}
            </p>
          )}

          <div className="flex flex-wrap gap-3 justify-center mb-16">
            {avgRating && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>
                <Star className="h-4 w-4 fill-current" /> {avgRating} ({reviews.length} تقييم)
              </span>
            )}
            {office.licenseNumber && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ background: "rgba(255,255,255,0.05)", color: "#9A8F7E", border: "1px solid rgba(255,255,255,0.1)" }}>
                <BadgeCheck className="h-4 w-4" /> مرخّص رسمياً
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <a href={`/firms/${slug}/book`}>
              <button className="flex items-center gap-2 px-10 py-4 rounded-full font-black text-base transition-all hover:scale-105 hover:shadow-2xl"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #A07830)`, color: "#080810" }}>
                <Calendar className="h-5 w-5" /> احجز استشارة
              </button>
            </a>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noreferrer">
                <button className="flex items-center gap-2 px-10 py-4 rounded-full font-bold text-base transition-all hover:scale-105"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#E2D9C8", border: `1px solid ${GOLD_BORDER}` }}>
                  <MessageCircle className="h-5 w-5" /> واتساب
                </button>
              </a>
            )}
          </div>

          {/* Stats bar */}
          {(office.casesCount || office.clientsCount || office.yearsActive) && (
            <div className="grid grid-cols-3 gap-px mt-24 overflow-hidden rounded-2xl" style={{ border: `1px solid ${GOLD_BORDER}`, background: GOLD_BORDER }}>
              {[
                { value: office.casesCount, label: "قضية ناجحة" },
                { value: office.clientsCount, label: "عميل موثوق" },
                { value: office.yearsActive, label: "سنة خبرة" },
              ].map((s, i) => s.value ? (
                <div key={i} className="px-6 py-5 text-center" style={{ background: "#080810" }}>
                  <div className="text-3xl font-black mb-1" style={{ color: GOLD }}>{Number(s.value).toLocaleString("ar-SA")}+</div>
                  <div className="text-xs tracking-wider" style={{ color: "#9A8F7E" }}>{s.label}</div>
                </div>
              ) : null)}
            </div>
          )}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 inset-x-0 flex justify-center animate-bounce">
          <div className="h-10 w-px" style={{ background: `linear-gradient(to bottom, transparent, ${GOLD})` }} />
        </div>
      </section>

      {/* SERVICES */}
      {services.length > 0 && (
        <section id="services" className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase"
              style={{ background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>
              <Scale className="h-3.5 w-3.5" /> خدماتنا القانونية
            </div>
            <h2 className="text-4xl md:text-5xl font-black" style={{ color: "#F0E6D3" }}>استثمر في حمايتك القانونية</h2>
            <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: "#9A8F7E" }}>خدمات قانونية متكاملة بمعايير دولية — نستجيب خلال 24 ساعة</p>
          </div>

          {cats.length > 2 && (
            <div className="flex gap-2 justify-center flex-wrap mb-10">
              {cats.map(c => (
                <button key={c} onClick={() => setFilterCat(c)}
                  className="px-4 py-2 rounded-full text-xs font-bold tracking-wider transition-all"
                  style={filterCat === c
                    ? { background: GOLD, color: "#080810" }
                    : { background: "rgba(255,255,255,0.04)", color: "#9A8F7E", border: `1px solid ${GOLD_BORDER}` }}>
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((svc: any) => (
              <div key={svc.id} className="group relative overflow-hidden rounded-2xl p-6 transition-all hover:translate-y-[-2px]"
                style={{ background: "rgba(201,168,76,0.04)", border: `1px solid ${GOLD_BORDER}` }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: "radial-gradient(circle at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 70%)" }} />
                <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4" style={{ background: GOLD_DIM }}>
                  <Briefcase className="h-5 w-5" style={{ color: GOLD }} />
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: "#F0E6D3" }}>{svc.name}</h3>
                {svc.description && <p className="text-sm leading-relaxed mb-4" style={{ color: "#9A8F7E" }}>{svc.description}</p>}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  {!svc.customQuote && svc.price > 0
                    ? <span className="text-lg font-black" style={{ color: GOLD }}>{Number(svc.price).toLocaleString("ar-SA")} ر.س</span>
                    : <span className="text-sm" style={{ color: "#9A8F7E" }}>السعر عند الطلب</span>
                  }
                  <div className="flex gap-2">
                    <button onClick={() => onOrder?.(svc)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                      style={{ background: GOLD, color: "#080810" }}>اطلب الآن</button>
                    <button onClick={() => onNegotiate?.(svc)} className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>تفاوض</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TEAM */}
      {team.length > 0 && (
        <section id="team" className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full text-xs font-bold tracking-widest"
              style={{ background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>
              <Users className="h-3.5 w-3.5" /> فريق المحامين
            </div>
            <h2 className="text-4xl md:text-5xl font-black" style={{ color: "#F0E6D3" }}>نخبة من الكوادر القانونية</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {team.map((m: any) => (
              <div key={m.id} className="text-center group" style={{ padding: "1px", background: `linear-gradient(135deg, ${GOLD_BORDER}, transparent)`, borderRadius: "1rem" }}>
                <div className="rounded-[calc(1rem-1px)] p-6" style={{ background: "#0D0D1A" }}>
                  {m.avatar
                    ? <img src={imgSrc(m.avatar)} alt="" className="h-20 w-20 rounded-full object-cover mx-auto mb-4 ring-2" style={{ outlineColor: GOLD_BORDER }} />
                    : <div className="h-20 w-20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-black" style={{ background: GOLD_DIM, color: GOLD }}>{(m.name || "م")[0]}</div>
                  }
                  <h3 className="font-bold text-sm mb-1" style={{ color: "#F0E6D3" }}>{m.name}</h3>
                  {m.title && <p className="text-xs" style={{ color: GOLD }}>{m.title}</p>}
                  {m.linkedin && (
                    <a href={m.linkedin} target="_blank" rel="noreferrer" className="inline-flex mt-3 h-7 w-7 items-center justify-center rounded-full transition-all hover:opacity-80"
                      style={{ background: GOLD_DIM, color: GOLD }}>
                      <Linkedin className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* REVIEWS */}
      {reviews.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black" style={{ color: "#F0E6D3" }}>ما يقوله عملاؤنا</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.slice(0, 6).map((r: any) => (
              <div key={r.id} className="relative rounded-2xl p-6" style={{ background: "rgba(201,168,76,0.04)", border: `1px solid ${GOLD_BORDER}` }}>
                <Quote className="absolute top-4 left-4 h-8 w-8 opacity-10" style={{ color: GOLD }} />
                <Stars n={Number(r.rating || 5)} />
                <p className="text-sm leading-relaxed my-4" style={{ color: "#9A8F7E" }}>{r.text}</p>
                <p className="text-xs font-bold" style={{ color: GOLD }}>{r.clientName}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CONTACT */}
      <section id="contact" className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="rounded-3xl p-12 relative overflow-hidden" style={{ background: "rgba(201,168,76,0.05)", border: `1px solid ${GOLD_BORDER}` }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 60%)" }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full text-xs font-bold" style={{ background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>
              <Phone className="h-3.5 w-3.5" /> تواصل معنا
            </div>
            <h2 className="text-4xl font-black mb-4" style={{ color: "#F0E6D3" }}>ابدأ بحماية حقوقك اليوم</h2>
            <p className="mb-10" style={{ color: "#9A8F7E" }}>فريقنا جاهز للإجابة على استفساراتك ومساعدتك في اتخاذ القرار الصحيح</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href={`/firms/${slug}/book`}>
                <button className="flex items-center gap-2 px-8 py-4 rounded-full font-black transition-all hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, #A07830)`, color: "#080810" }}>
                  <Calendar className="h-5 w-5" /> احجز استشارتك
                </button>
              </a>
              {waUrl && (
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <button className="flex items-center gap-2 px-8 py-4 rounded-full font-bold transition-all hover:scale-105"
                    style={{ background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}>
                    <MessageCircle className="h-5 w-5" /> واتساب
                  </button>
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-6 justify-center mt-10" style={{ color: "#9A8F7E" }}>
              {office.phone && <a href={`tel:${office.phone}`} className="flex items-center gap-2 text-sm hover:opacity-80"><Phone className="h-4 w-4" />{office.phone}</a>}
              {office.email && <a href={`mailto:${office.email}`} className="flex items-center gap-2 text-sm hover:opacity-80"><Mail className="h-4 w-4" />{office.email}</a>}
              {office.address && <span className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" />{office.address}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8 text-center text-xs" style={{ borderColor: GOLD_BORDER, color: "#9A8F7E" }}>
        <p>© {new Date().getFullYear()} {officeName} · جميع الحقوق محفوظة</p>
        <div className="flex justify-center gap-4 mt-4">
          {office.twitter && <a href={office.twitter} target="_blank" rel="noreferrer" className="hover:opacity-80"><Twitter className="h-4 w-4" /></a>}
          {office.linkedin && <a href={office.linkedin} target="_blank" rel="noreferrer" className="hover:opacity-80"><Linkedin className="h-4 w-4" /></a>}
          {office.instagram && <a href={office.instagram} target="_blank" rel="noreferrer" className="hover:opacity-80"><Instagram className="h-4 w-4" /></a>}
        </div>
      </footer>
    </div>
  );
}
