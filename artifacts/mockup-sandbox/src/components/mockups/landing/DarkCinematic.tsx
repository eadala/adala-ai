/* ═══════════════════════════════════════════════════
   Variant 2 — "StripeClean"
   Stripe نظافة + Linear دقة — أبيض ناصع، تايبوغرافي ضخم
   شرائح أفقية، لقطة تطبيق، أسعار نظيفة
═══════════════════════════════════════════════════ */
import { useState } from "react";

const B  = "#1A56DB";
const T  = "#0F172A";
const S  = "#475569";
const M  = "#94A3B8";
const BD = "#E2E8F0";
const G  = "#F8FAFC";

const segments = [
  {
    emoji: "⚖️",
    title: "إدارة القضايا بدقة كاملة",
    desc: "من تسجيل القضية حتى صدور الحكم — جلسات موثّقة، ملفات منظّمة، تنبيهات تلقائية للمواعيد. لا يفوتك شيء.",
    items: ["تتبع تلقائي لكل قضية","جدول جلسات مرئي","إشعارات قبل كل موعد","مشاركة الملفات مع الموكّل"],
    img: "cases",
  },
  {
    emoji: "🤖",
    title: "ذكاء اصطناعي يفهم القانون",
    desc: "حلّل العقود، اقترح صياغات قانونية، واحصل على ملخصات فورية للقضايا — كل ذلك بالعربية بدقة عالية.",
    items: ["تحليل العقود وكشف المخاطر","صياغة مذكرات قانونية","ملخص ذكي للقضايا","دعم اللغة العربية الكاملة"],
    img: "ai",
  },
  {
    emoji: "💰",
    title: "فواتير ومدفوعات لحظية",
    desc: "أنشئ فواتير احترافية بنقرة، واحصل على مدفوعاتك إلكترونياً عبر مدى وVisa وSADAD.",
    items: ["فواتير PDF احترافية","دفع إلكتروني آمن","تتبع لحظي للمستحقات","تقارير مالية شهرية"],
    img: "billing",
  },
];

const plans = [
  { name: "Starter", price: 99, features: ["٣ مستخدمين","١٠٠ قضية","AI أساسي","دعم إلكتروني"], color: T },
  { name: "Pro", price: 299, features: ["١٠ مستخدمين","قضايا غير محدودة","AI متقدم","دعم أولوية","API كامل"], featured: true, color: B },
  { name: "Enterprise", price: null, features: ["مستخدمون غير محدودون","نشر خاص","SLA مضمون","مدير حساب","تكامل مخصص"], color: T },
];

function AppMockup({ type }: { type: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${BD}`, boxShadow: "0 12px 40px rgba(0,0,0,0.08)", overflow: "hidden" }}>
      {/* Window chrome */}
      <div style={{ background: G, borderBottom: `1px solid ${BD}`, padding: "10px 16px", display: "flex", gap: 6, alignItems: "center" }}>
        {["#FF5F57","#FFBD2E","#28CA41"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
        <div style={{ flex: 1, marginRight: 16 }}>
          <div style={{ height: 18, background: BD, borderRadius: 4, width: 200, margin: "0 auto" }} />
        </div>
      </div>
      {type === "cases" && (
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T }}>القضايا النشطة</span>
            <span style={{ fontSize: 12, color: "#fff", background: B, padding: "3px 10px", borderRadius: 100, fontWeight: 700 }}>+جديدة</span>
          </div>
          {[["شركة الرياض للبناء","تجاري","قيد النظر",B],["محمد علي حسن","مدني","استئناف","#7C3AED"],["مؤسسة الشمال","عمالي","جلسة قادمة","#059669"]].map(([n,t,s,c]) => (
            <div key={n} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px", background: G, borderRadius: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚖️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T }}>{n}</div>
                <div style={{ fontSize: 11, color: M }}>{t}</div>
              </div>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: `${c}12`, color: c as string, fontWeight: 700 }}>{s}</span>
            </div>
          ))}
        </div>
      )}
      {type === "ai" && (
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T, marginBottom: 14 }}>مساعد AI القانوني</div>
          <div style={{ background: "#EDE9FE", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#6D28D9", fontWeight: 600, marginBottom: 6 }}>طلبك</div>
            <div style={{ fontSize: 12, color: "#4C1D95" }}>حلّل هذا العقد وحدّد بنود المخاطرة العالية</div>
          </div>
          <div style={{ background: G, borderRadius: 12, padding: "12px 14px", border: `1px solid ${BD}` }}>
            <div style={{ fontSize: 12, color: B, fontWeight: 600, marginBottom: 6 }}>تحليل AI</div>
            <div style={{ fontSize: 11, color: S, lineHeight: 1.7 }}>وجدت ٣ بنود تستوجب المراجعة: المادة ٧ (الغرامات) غير متوازنة، المادة ١٢ (التحكيم) تحتاج تعديل...</div>
          </div>
        </div>
      )}
      {type === "billing" && (
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T, marginBottom: 14 }}>لوحة الإيرادات</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[["الإيرادات","٤٥,٢٠٠ ﷼","↑ 23٪","#059669"],["المعلقة","١٢,٨٠٠ ﷼","٨ فاتورة","#D97706"],["المحصّلة","٣٢,٤٠٠ ﷼","↑ 18٪",B]].map(([l,v,s,c]) => (
              <div key={l} style={{ background: G, borderRadius: 10, padding: "10px" }}>
                <div style={{ fontSize: 10, color: M }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: T, margin: "3px 0" }}>{v}</div>
                <div style={{ fontSize: 10, color: c as string, fontWeight: 700 }}>{s}</div>
              </div>
            ))}
          </div>
          {[["فاتورة #١٠٢٤","شركة الرياض","٨,٥٠٠ ﷼","مدفوعة","#059669"],["فاتورة #١٠٢٥","محمد حسن","٤,٢٠٠ ﷼","معلقة","#D97706"]].map(([id,n,v,s,c]) => (
            <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${BD}` }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T }}>{id} — {n}</div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: T }}>{v}</span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: `${c}12`, color: c as string, fontWeight: 700 }}>{s}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DarkCinematic() {
  const [activeSeg, setActiveSeg] = useState(0);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#fff", fontFamily: "'IBM Plex Sans Arabic','Cairo',sans-serif", color: T }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${BD}`,
        padding: "0 60px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: B, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚖️</div>
          <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.5px" }}>عدالة AI</span>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {["المنتج","الأسعار","العملاء","التوثيق"].map(l => (
            <span key={l} style={{ fontSize: 14, color: S, cursor: "pointer" }}>{l}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ padding: "7px 18px", borderRadius: 8, border: `1px solid ${BD}`, background: "transparent", color: T, fontSize: 13, cursor: "pointer" }}>دخول</button>
          <button style={{ padding: "7px 18px", borderRadius: 8, background: B, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>جرّب مجاناً</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 40px 70px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28,
          padding: "5px 16px", borderRadius: 100,
          background: "#EFF6FF", border: "1px solid #BFDBFE",
        }}>
          <span style={{ fontSize: 11 }}>✨</span>
          <span style={{ color: B, fontSize: 12, fontWeight: 700 }}>مدعوم بـ Gemini AI · محدّث باستمرار</span>
        </div>

        <h1 style={{ fontSize: 66, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-3px", margin: "0 0 22px", color: T }}>
          منصة الإدارة القانونية<br />
          <span style={{ background: `linear-gradient(135deg, ${B} 0%, #3B82F6 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            الأذكى والأسهل
          </span>
        </h1>

        <p style={{ fontSize: 18, color: S, maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.9 }}>
          كل ما يحتاجه مكتبك القانوني — قضايا، عملاء، فواتير، عقود، تقارير — في منصة واحدة تعمل بالذكاء الاصطناعي
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 56 }}>
          <button style={{ padding: "14px 32px", borderRadius: 10, background: B, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 24px ${B}33` }}>
            ابدأ الآن مجاناً
          </button>
          <button style={{ padding: "14px 28px", borderRadius: 10, background: G, border: `1px solid ${BD}`, color: T, fontSize: 15, cursor: "pointer" }}>
            تحدّث مع المبيعات
          </button>
        </div>

        {/* Trust bar */}
        <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${BD}`, paddingTop: 32, justifyContent: "center" }}>
          {[["+٢٠٠","مكتب قانوني"],["٩٨٪","رضا العملاء"],["٣×","أسرع في الإنجاز"],["٢٤/٧","دعم متواصل"]].map(([v,l], i) => (
            <div key={l} style={{
              textAlign: "center", padding: "0 36px",
              borderRight: i < 3 ? `1px solid ${BD}` : "none",
            }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: T, letterSpacing: "-0.8px" }}>{v}</div>
              <div style={{ fontSize: 12, color: M, marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURE SEGMENTS ── */}
      <div style={{ background: G, borderTop: `1px solid ${BD}`, borderBottom: `1px solid ${BD}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 48, background: "#fff", border: `1px solid ${BD}`, borderRadius: 12, padding: 4, width: "fit-content" }}>
            {segments.map((seg, i) => (
              <button key={i} onClick={() => setActiveSeg(i)} style={{
                padding: "8px 20px", borderRadius: 9,
                background: activeSeg === i ? B : "transparent",
                border: "none", color: activeSeg === i ? "#fff" : S,
                fontSize: 13, fontWeight: activeSeg === i ? 700 : 400,
                cursor: "pointer", transition: "all 0.2s",
              }}>
                {seg.emoji} {seg.title.split(" ")[0]}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-1.5px", color: T, marginBottom: 16, lineHeight: 1.2 }}>
                {segments[activeSeg].title}
              </h2>
              <p style={{ fontSize: 16, color: S, lineHeight: 1.9, marginBottom: 28 }}>
                {segments[activeSeg].desc}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {segments[activeSeg].items.map(item => (
                  <div key={item} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#DCFCE7", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#059669", flexShrink: 0 }}>✓</div>
                    <span style={{ fontSize: 14, color: S }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <AppMockup type={segments[activeSeg].img} />
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-1.5px", color: T, marginBottom: 12 }}>خطط بسيطة وشفافة</h2>
          <p style={{ fontSize: 16, color: S }}>ابدأ مجاناً · لا عقود ملزمة · ألغِ في أي وقت</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {plans.map((p, i) => (
            <div key={i} style={{
              padding: "32px 28px", borderRadius: 20,
              background: p.featured ? B : "#fff",
              border: `1px solid ${p.featured ? B : BD}`,
              boxShadow: p.featured ? `0 20px 50px ${B}2A` : "0 2px 8px rgba(0,0,0,0.03)",
              position: "relative",
            }}>
              {p.featured && (
                <div style={{
                  position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                  background: "#F59E0B", color: "#fff",
                  fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 100,
                }}>الأكثر طلباً</div>
              )}
              <div style={{ fontSize: 15, fontWeight: 700, color: p.featured ? "rgba(255,255,255,0.7)" : M, marginBottom: 10 }}>{p.name}</div>
              {p.price ? (
                <div style={{ fontSize: 42, fontWeight: 900, color: p.featured ? "#fff" : T, letterSpacing: "-1.5px", marginBottom: 4 }}>
                  ﷼{p.price}
                  <span style={{ fontSize: 15, fontWeight: 400, color: p.featured ? "rgba(255,255,255,0.5)" : M }}>/شهر</span>
                </div>
              ) : (
                <div style={{ fontSize: 32, fontWeight: 900, color: p.featured ? "#fff" : T, marginBottom: 4 }}>حسب الطلب</div>
              )}
              <div style={{ height: 1, background: p.featured ? "rgba(255,255,255,0.15)" : BD, margin: "20px 0" }} />
              {p.features.map(f => (
                <div key={f} style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 10 }}>
                  <span style={{ color: p.featured ? "rgba(255,255,255,0.7)" : "#4ADE80", fontSize: 14 }}>✓</span>
                  <span style={{ fontSize: 13, color: p.featured ? "rgba(255,255,255,0.85)" : S }}>{f}</span>
                </div>
              ))}
              <button style={{
                width: "100%", marginTop: 22, padding: "11px",
                borderRadius: 9, border: "none",
                background: p.featured ? "#fff" : B,
                color: p.featured ? B : "#fff",
                fontSize: 14, fontWeight: 800, cursor: "pointer",
              }}>
                {p.price ? "ابدأ الآن" : "تواصل معنا"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800;900&family=Cairo:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html,body { background: #fff; }
      `}</style>
    </div>
  );
}
