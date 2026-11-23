import { useState } from "react";
import { Star, MapPin, Phone, Mail, MessageCircle, BadgeCheck, Calendar, Users, Briefcase, Shield, Scale, FileText, Gavel, Globe, Twitter, Linkedin, Instagram, ChevronDown, Building, CheckCircle2, ArrowLeft, Quote, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./LuxLegal";

const imgSrc = (p: string | null | undefined) => !p ? undefined : p.startsWith("http") ? p : `/api/storage/objects${p.startsWith("/") ? p : "/" + p}`;
const waNum = (r: string) => { const d = r.replace(/\D/g, ""); return d.startsWith("0") ? "966" + d.slice(1) : d; };

const NAVY = "#1B2B5B";
const LIGHT_NAVY = "#EEF1F8";
const ACCENT = "#2563EB";

function Stars({ n }: { n: number }) {
  return <div className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn("h-3.5 w-3.5 fill-current", i < n ? "text-amber-400" : "text-gray-200")} />
  ))}</div>;
}

export function Corporate({ office, services, team, reviews, lang, slug, onOrder, onNegotiate }: TemplateProps) {
  const [filterCat, setFilterCat] = useState("الكل");
  const officeName = lang === "ar" ? (office.name ?? "") : (office.nameEn || office.name || "");
  const tagline = lang === "ar" ? (office.tagline ?? "") : (office.taglineEn || office.tagline || "");
  const about = office.about ?? office.description ?? "";
  const avgRating = reviews.length > 0 ? (reviews.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const cats = ["الكل", ...Array.from(new Set(services.map((s: any) => s.category).filter(Boolean))) as string[]];
  const filtered = filterCat === "الكل" ? services : services.filter((s: any) => s.category === filterCat);
  const wh = office.whatsapp || office.phone;
  const waUrl = wh ? `https://wa.me/${waNum(wh)}` : null;
  const primaryColor = office.website_config?.colors?.primary || NAVY;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif", background: "#FFFFFF", color: "#1F2937", minHeight: "100vh" }}>

      {/* TOP BAR */}
      <div className="hidden md:flex items-center justify-between px-8 py-2.5 text-xs" style={{ background: primaryColor, color: "#FFFFFF" }}>
        <div className="flex items-center gap-6">
          {office.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{office.phone}</span>}
          {office.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{office.email}</span>}
        </div>
        <div className="flex items-center gap-4">
          {avgRating && <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-300 text-amber-300" />{avgRating}</span>}
          {office.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{office.city}</span>}
        </div>
      </div>

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 shadow-sm bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          {office.logo
            ? <img src={imgSrc(office.logo)} alt="" className="h-12 w-12 rounded-lg object-cover" />
            : <div className="h-12 w-12 rounded-lg flex items-center justify-center text-xl font-black text-white" style={{ background: primaryColor }}>{(officeName || "م")[0]}</div>
          }
          <div>
            <div className="font-black text-base leading-tight">{officeName}</div>
            {office.city && <div className="text-xs text-gray-400">{office.city}</div>}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-600">
          {services.length > 0 && <a href="#services" className="hover:text-gray-900 transition-colors">خدماتنا</a>}
          {team.length > 0 && <a href="#team" className="hover:text-gray-900 transition-colors">فريقنا</a>}
          {reviews.length > 0 && <a href="#reviews" className="hover:text-gray-900 transition-colors">آراء العملاء</a>}
          <a href="#contact" className="hover:text-gray-900 transition-colors">تواصل</a>
        </div>
        <a href={`/firms/${slug}/book`}>
          <button className="px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 shadow-sm" style={{ background: primaryColor }}>
            احجز استشارة
          </button>
        </a>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #0F1E3D 100%)` }}>
        {office.cover && (
          <img src={imgSrc(office.cover)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
        )}
        <div className="relative max-w-7xl mx-auto px-8 py-28 grid md:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            {office.licenseNumber && (
              <div className="inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-md text-xs font-bold" style={{ background: "rgba(255,255,255,0.15)" }}>
                <BadgeCheck className="h-3.5 w-3.5" /> مكتب محاماة مرخّص · {office.licenseNumber}
              </div>
            )}
            <h1 className="text-4xl md:text-6xl font-black leading-tight mb-5">{officeName}</h1>
            {tagline && <p className="text-lg opacity-80 mb-8 leading-relaxed">{tagline}</p>}
            <div className="flex flex-wrap gap-3">
              <a href={`/firms/${slug}/book`}>
                <button className="flex items-center gap-2 px-7 py-3.5 rounded-lg font-bold text-sm bg-white transition-all hover:opacity-90 shadow-lg" style={{ color: primaryColor }}>
                  <Calendar className="h-4 w-4" /> احجز استشارة مجانية
                </button>
              </a>
              {waUrl && (
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <button className="flex items-center gap-2 px-7 py-3.5 rounded-lg font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white transition-all">
                    <MessageCircle className="h-4 w-4" /> واتساب
                  </button>
                </a>
              )}
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-4 mt-12">
              {[
                { v: office.casesCount, l: "قضية" },
                { v: office.clientsCount, l: "عميل" },
                { v: office.yearsActive, l: "سنة خبرة" },
              ].map((s, i) => s.v ? (
                <div key={i} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="text-2xl font-black">{Number(s.v).toLocaleString("ar-SA")}+</div>
                  <div className="text-xs opacity-70 mt-1">{s.l}</div>
                </div>
              ) : null)}
            </div>
          </div>

          <div className="hidden md:block">
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur p-8">
              <h3 className="text-white font-black text-lg mb-6">أبرز خدماتنا</h3>
              <div className="space-y-3">
                {services.slice(0, 5).map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-white text-sm font-medium">{s.name}</span>
                    {!s.customQuote && s.price > 0 && (
                      <span className="text-xs text-white/60 mr-auto">{Number(s.price).toLocaleString("ar-SA")} ر.س</span>
                    )}
                  </div>
                ))}
              </div>
              <a href={`/firms/${slug}/book`} className="block mt-6">
                <button className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all" style={{ background: ACCENT }}>
                  احجز استشارة الآن
                </button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      {about && (
        <section className="max-w-5xl mx-auto px-8 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold mb-4" style={{ background: LIGHT_NAVY, color: primaryColor }}>
                <Building className="h-3.5 w-3.5" /> عن المكتب
              </div>
              <h2 className="text-3xl font-black mb-4" style={{ color: NAVY }}>قصتنا وتميّزنا</h2>
              <p className="text-gray-600 leading-relaxed">{about}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Shield, title: "خبرة معتمدة", desc: "ممارسة قانونية موثّقة بموجب لوائح وزارة العدل" },
                { icon: Users, title: "فريق متخصص", desc: "محامون ومستشارون في مختلف التخصصات" },
                { icon: Scale, title: "دقة قانونية", desc: "توثيق كامل لكل الإجراءات والمستندات" },
                { icon: Award, title: "ثقة العملاء", desc: "سمعة راسخة ومبنية على النتائج" },
              ].map((f, i) => (
                <div key={i} className="p-4 rounded-xl border border-gray-100">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center mb-3" style={{ background: LIGHT_NAVY }}>
                    <f.icon className="h-4.5 w-4.5" style={{ color: primaryColor }} />
                  </div>
                  <h4 className="font-bold text-sm mb-1">{f.title}</h4>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SERVICES */}
      {services.length > 0 && (
        <section id="services" style={{ background: LIGHT_NAVY }}>
          <div className="max-w-6xl mx-auto px-8 py-20">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold mb-4 bg-white" style={{ color: primaryColor }}>
                <Briefcase className="h-3.5 w-3.5" /> خدماتنا القانونية
              </div>
              <h2 className="text-3xl font-black" style={{ color: NAVY }}>ما نقدمه لك</h2>
            </div>

            {cats.length > 2 && (
              <div className="flex gap-2 flex-wrap justify-center mb-8">
                {cats.map(c => (
                  <button key={c} onClick={() => setFilterCat(c)}
                    className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                    style={filterCat === c ? { background: primaryColor, color: "#fff" } : { background: "#fff", color: "#374151", border: "1px solid #E5E7EB" }}>
                    {c}
                  </button>
                ))}
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((svc: any) => (
                <div key={svc.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                  <div className="h-1.5" style={{ background: primaryColor }} />
                  <div className="p-6">
                    <h3 className="font-black text-base mb-2">{svc.name}</h3>
                    {svc.description && <p className="text-sm text-gray-500 leading-relaxed mb-4">{svc.description}</p>}
                    <div className="flex items-center justify-between">
                      {!svc.customQuote && svc.price > 0
                        ? <span className="font-black" style={{ color: primaryColor }}>{Number(svc.price).toLocaleString("ar-SA")} ر.س</span>
                        : <span className="text-xs text-gray-400">حسب الاتفاق</span>
                      }
                      <div className="flex gap-2">
                        <button onClick={() => onOrder?.(svc)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: primaryColor }}>اطلب</button>
                        <button onClick={() => onNegotiate?.(svc)} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: LIGHT_NAVY, color: primaryColor }}>تفاوض</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TEAM */}
      {team.length > 0 && (
        <section id="team" className="max-w-6xl mx-auto px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black" style={{ color: NAVY }}>فريقنا القانوني</h2>
            <p className="text-gray-500 mt-2">كوادر متخصصة لخدمتك على أعلى مستوى</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {team.map((m: any) => (
              <div key={m.id} className="text-center p-6 rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                {m.avatar
                  ? <img src={imgSrc(m.avatar)} alt="" className="h-20 w-20 rounded-full object-cover mx-auto mb-4 ring-4 ring-white shadow-md" />
                  : <div className="h-20 w-20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-black text-white shadow-md" style={{ background: primaryColor }}>{(m.name || "م")[0]}</div>
                }
                <h3 className="font-black text-sm">{m.name}</h3>
                {m.title && <p className="text-xs mt-1" style={{ color: primaryColor }}>{m.title}</p>}
                {m.linkedin && (
                  <a href={m.linkedin} target="_blank" rel="noreferrer" className="inline-flex mt-3 h-7 w-7 items-center justify-center rounded-full" style={{ background: LIGHT_NAVY, color: primaryColor }}>
                    <Linkedin className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* REVIEWS */}
      {reviews.length > 0 && (
        <section id="reviews" style={{ background: LIGHT_NAVY }}>
          <div className="max-w-6xl mx-auto px-8 py-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black" style={{ color: NAVY }}>آراء عملائنا</h2>
              {avgRating && <p className="text-5xl font-black mt-4" style={{ color: primaryColor }}>{avgRating} <span className="text-xl text-gray-400 font-normal">/ 5</span></p>}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.slice(0, 6).map((r: any) => (
                <div key={r.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <Stars n={Number(r.rating || 5)} />
                  <p className="text-sm text-gray-600 leading-relaxed my-4">"{r.text}"</p>
                  <p className="text-xs font-bold" style={{ color: primaryColor }}>{r.clientName}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT CTA */}
      <section id="contact" className="max-w-4xl mx-auto px-8 py-20 text-center">
        <div className="rounded-2xl p-12 text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, #0F1E3D)` }}>
          <h2 className="text-3xl font-black mb-4">تواصل معنا اليوم</h2>
          <p className="opacity-80 mb-8">فريقنا القانوني جاهز للإجابة على استفساراتك في أقرب وقت</p>
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <a href={`/firms/${slug}/book`}>
              <button className="px-8 py-3.5 rounded-xl font-bold text-sm bg-white transition-all hover:opacity-90" style={{ color: primaryColor }}>
                احجز استشارة
              </button>
            </a>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noreferrer">
                <button className="px-8 py-3.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white transition-all">
                  واتساب
                </button>
              </a>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm opacity-80">
            {office.phone && <a href={`tel:${office.phone}`} className="flex items-center gap-1.5 hover:opacity-100"><Phone className="h-4 w-4" />{office.phone}</a>}
            {office.email && <a href={`mailto:${office.email}`} className="flex items-center gap-1.5 hover:opacity-100"><Mail className="h-4 w-4" />{office.email}</a>}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        <p>© {new Date().getFullYear()} {officeName} · جميع الحقوق محفوظة</p>
        <div className="flex justify-center gap-4 mt-3">
          {office.twitter && <a href={office.twitter} target="_blank" rel="noreferrer"><Twitter className="h-4 w-4 hover:text-gray-600 transition-colors" /></a>}
          {office.linkedin && <a href={office.linkedin} target="_blank" rel="noreferrer"><Linkedin className="h-4 w-4 hover:text-gray-600 transition-colors" /></a>}
        </div>
      </footer>
    </div>
  );
}
