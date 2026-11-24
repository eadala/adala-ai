import { useState } from "react";
import { Star, MapPin, Phone, Mail, MessageCircle, Calendar, Users, Briefcase, Shield, Scale, ArrowLeft, Quote, Linkedin, Twitter, Instagram, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./LuxLegal";

const imgSrc = (p: string | null | undefined) => !p ? undefined : p.startsWith("http") ? p : `/api/storage/objects${p.startsWith("/") ? p : "/" + p}`;
const waNum = (r: string) => { const d = r.replace(/\D/g, ""); return d.startsWith("0") ? "966" + d.slice(1) : d; };

function Stars({ n }: { n: number }) {
  return <div className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn("h-3 w-3 fill-current", i < n ? "text-amber-400" : "text-gray-200")} />
  ))}</div>;
}

export function Modern({ office, services, team, reviews, lang, slug, onOrder, onNegotiate }: TemplateProps) {
  const [filterCat, setFilterCat] = useState("الكل");
  const officeName = lang === "ar" ? (office.name ?? "") : (office.nameEn || office.name || "");
  const tagline = lang === "ar" ? (office.tagline ?? "") : (office.taglineEn || office.tagline || "");
  const about = office.about ?? office.description ?? "";
  const avgRating = reviews.length > 0 ? (reviews.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const cats = ["الكل", ...Array.from(new Set(services.map((s: any) => s.category).filter(Boolean))) as string[]];
  const filtered = filterCat === "الكل" ? services : services.filter((s: any) => s.category === filterCat);
  const wh = office.whatsapp || office.phone;
  const waUrl = wh ? `https://wa.me/${waNum(wh)}` : null;
  const primaryColor = office.website_config?.colors?.primary || "#111827";

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif", background: "#FAFAFA", color: "#111827", minHeight: "100vh" }}>

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 md:px-16 py-5 bg-white/80" style={{ backdropFilter: "blur(20px)", borderBottom: "1px solid #F3F4F6" }}>
        <div className="flex items-center gap-3">
          {office.logo
            ? <img src={imgSrc(office.logo)} alt="" className="h-9 w-9 rounded-full object-cover" />
            : <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-black text-white" style={{ background: primaryColor }}>{(officeName || "م")[0]}</div>
          }
          <span className="font-black text-sm">{officeName}</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          {services.length > 0 && <a href="#services" className="hover:text-gray-900 transition-colors">الخدمات</a>}
          {team.length > 0 && <a href="#team" className="hover:text-gray-900 transition-colors">الفريق</a>}
          <a href="#contact" className="hover:text-gray-900 transition-colors">تواصل</a>
        </div>
        <a href={`/firms/${slug}/book`}>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:opacity-90" style={{ background: primaryColor }}>
            احجز استشارة <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        </a>
      </nav>

      {/* HERO — full-width editorial */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden px-8 md:px-16">
        {office.cover && (
          <div className="absolute inset-0">
            <img src={imgSrc(office.cover)} alt="" className="w-full h-full object-cover opacity-5" />
          </div>
        )}
        <div className="relative max-w-4xl">
          {avgRating && (
            <div className="flex items-center gap-2 mb-8">
              <Stars n={5} />
              <span className="text-xs text-gray-400">{avgRating} من 5 ({reviews.length} تقييم)</span>
            </div>
          )}
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black leading-none tracking-tighter mb-8" style={{ color: primaryColor }}>
            {officeName}
          </h1>
          {tagline && (
            <p className="text-xl md:text-2xl text-gray-400 max-w-2xl leading-relaxed mb-12">
              {tagline}
            </p>
          )}
          <div className="flex flex-wrap gap-4">
            <a href={`/firms/${slug}/book`}>
              <button className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base text-white transition-all hover:opacity-90" style={{ background: primaryColor }}>
                احجز استشارة <ArrowLeft className="h-5 w-5" />
              </button>
            </a>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noreferrer">
                <button className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white transition-all">
                  <MessageCircle className="h-5 w-5" /> واتساب
                </button>
              </a>
            )}
          </div>
        </div>

        {/* Stats — floating right */}
        {(office.casesCount || office.clientsCount || office.yearsActive) && (
          <div className="absolute left-8 bottom-20 hidden lg:flex flex-col gap-4">
            {[
              { v: office.casesCount, l: "قضية" },
              { v: office.clientsCount, l: "عميل" },
              { v: office.yearsActive, l: "سنة" },
            ].map((s, i) => s.v ? (
              <div key={i} className="flex items-center gap-3">
                <div className="text-4xl font-black" style={{ color: primaryColor }}>{Number(s.v).toLocaleString("ar-SA")}+</div>
                <div className="text-xs text-gray-400">{s.l}</div>
              </div>
            ) : null)}
          </div>
        )}

        {/* Decorative line */}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `linear-gradient(to bottom, transparent, ${primaryColor}, transparent)` }} />
      </section>

      {/* SERVICES */}
      {services.length > 0 && (
        <section id="services" className="px-8 md:px-16 py-24">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-16 flex-wrap gap-4">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">خدماتنا</span>
                <h2 className="text-4xl font-black mt-2" style={{ color: primaryColor }}>ما نقدمه لك</h2>
              </div>
              {cats.length > 2 && (
                <div className="flex gap-2 flex-wrap">
                  {cats.map(c => (
                    <button key={c} onClick={() => setFilterCat(c)}
                      className="px-4 py-2 text-xs font-bold rounded-full transition-all border"
                      style={filterCat === c ? { background: primaryColor, color: "#fff", borderColor: primaryColor } : { borderColor: "#E5E7EB", color: "#9CA3AF" }}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-px">
              {filtered.map((svc: any, i: number) => (
                <div key={svc.id} className="group flex items-center justify-between py-6 border-b border-gray-100 hover:bg-white transition-all px-4 -mx-4 rounded-xl">
                  <div className="flex items-start gap-5 flex-1">
                    <span className="text-gray-200 font-black text-xl tabular-nums w-8 shrink-0 pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-base">{svc.name}</h3>
                      {svc.description && <p className="text-sm text-gray-400 mt-1 leading-relaxed line-clamp-2">{svc.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 mr-6">
                    {!svc.customQuote && svc.price > 0 && (
                      <span className="font-black text-sm" style={{ color: primaryColor }}>{Number(svc.price).toLocaleString("ar-SA")} ر.س</span>
                    )}
                    <div className="hidden group-hover:flex gap-2">
                      <button onClick={() => onOrder?.(svc)} className="px-4 py-2 rounded-full text-xs font-bold text-white transition-all" style={{ background: primaryColor }}>اطلب</button>
                      <button onClick={() => onNegotiate?.(svc)} className="px-4 py-2 rounded-full text-xs font-bold border border-gray-200 hover:border-gray-400">تفاوض</button>
                    </div>
                    <ArrowLeft className="h-4 w-4 text-gray-300 group-hover:hidden" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT */}
      {about && (
        <section className="px-8 md:px-16 py-24 bg-white">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">من نحن</span>
              <h2 className="text-4xl font-black mt-2 mb-6" style={{ color: primaryColor }}>قصتنا</h2>
              <p className="text-gray-500 leading-relaxed text-base">{about}</p>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {[
                { v: office.casesCount, l: "قضية ناجحة" },
                { v: office.clientsCount, l: "عميل راضٍ" },
                { v: office.yearsActive, l: "سنة خبرة" },
                { v: services.length || "١٠+", l: "خدمة قانونية" },
              ].map((s, i) => s.v ? (
                <div key={i} className="p-6 rounded-2xl border border-gray-100">
                  <div className="text-4xl font-black mb-2" style={{ color: primaryColor }}>{typeof s.v === "number" ? Number(s.v).toLocaleString("ar-SA") + "+" : s.v}</div>
                  <div className="text-xs text-gray-400">{s.l}</div>
                </div>
              ) : null)}
            </div>
          </div>
        </section>
      )}

      {/* TEAM */}
      {team.length > 0 && (
        <section id="team" className="px-8 md:px-16 py-24">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">الفريق</span>
              <h2 className="text-4xl font-black mt-2" style={{ color: primaryColor }}>محامونا</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((m: any) => (
                <div key={m.id} className="group">
                  <div className="overflow-hidden rounded-2xl mb-4 bg-gray-50 aspect-square">
                    {m.avatar
                      ? <img src={imgSrc(m.avatar)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="w-full h-full flex items-center justify-center text-5xl font-black" style={{ color: primaryColor, opacity: 0.1 }}>{(m.name || "م")[0]}</div>
                    }
                  </div>
                  <h3 className="font-black text-sm">{m.name}</h3>
                  {m.title && <p className="text-xs text-gray-400 mt-1">{m.title}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* REVIEWS */}
      {reviews.length > 0 && (
        <section className="px-8 md:px-16 py-24 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">التقييمات</span>
              <h2 className="text-4xl font-black mt-2" style={{ color: primaryColor }}>يقول عنا عملاؤنا</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.slice(0, 6).map((r: any) => (
                <div key={r.id} className="p-6 rounded-2xl border border-gray-100">
                  <Stars n={Number(r.rating || 5)} />
                  <p className="text-sm text-gray-500 leading-relaxed mt-4 mb-4">"{r.text}"</p>
                  <span className="text-xs font-bold" style={{ color: primaryColor }}>{r.clientName}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT */}
      <section id="contact" className="px-8 md:px-16 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">تواصل</span>
          <h2 className="text-5xl font-black mt-2 mb-6" style={{ color: primaryColor }}>ابدأ الآن</h2>
          <p className="text-gray-400 mb-10">نحن هنا لمساعدتك — تواصل معنا اليوم لأخذ أول خطوة نحو حل قضيتك</p>
          <div className="flex flex-wrap gap-4 justify-center mb-10">
            <a href={`/firms/${slug}/book`}>
              <button className="flex items-center gap-2 px-10 py-4 rounded-full font-bold text-base text-white transition-all hover:opacity-90" style={{ background: primaryColor }}>
                احجز استشارة <ArrowLeft className="h-5 w-5" />
              </button>
            </a>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noreferrer">
                <button className="flex items-center gap-2 px-10 py-4 rounded-full font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white transition-all">
                  <MessageCircle className="h-5 w-5" /> واتساب
                </button>
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-8 justify-center text-sm text-gray-400">
            {office.phone && <a href={`tel:${office.phone}`} className="flex items-center gap-2 hover:text-gray-900 transition-colors"><Phone className="h-4 w-4" />{office.phone}</a>}
            {office.email && <a href={`mailto:${office.email}`} className="flex items-center gap-2 hover:text-gray-900 transition-colors"><Mail className="h-4 w-4" />{office.email}</a>}
            {office.city && <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{office.city}</span>}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 px-8 flex items-center justify-between text-xs text-gray-300">
        <span>© {new Date().getFullYear()} {officeName}</span>
        <div className="flex gap-4">
          {office.twitter && <a href={office.twitter} target="_blank" rel="noreferrer"><Twitter className="h-4 w-4 hover:text-gray-600 transition-colors" /></a>}
          {office.linkedin && <a href={office.linkedin} target="_blank" rel="noreferrer"><Linkedin className="h-4 w-4 hover:text-gray-600 transition-colors" /></a>}
        </div>
      </footer>
    </div>
  );
}
