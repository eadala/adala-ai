/* ═══════════════════════════════════════════════════
   Variant 1 — "NotionLinear"
   Notion بساطة + Linear دقة
   بينتو جريد فاتح، تايبوغرافي حاد، مسافات واسعة
═══════════════════════════════════════════════════ */
import { useState } from "react";

const B  = "#1A56DB";
const B2 = "#3B82F6";
const G  = "#F8FAFC";
const G2 = "#F1F5F9";
const T  = "#0F172A";
const S  = "#475569";
const M  = "#94A3B8";
const BD = "#E2E8F0";

const bentoItems = [
  {
    col: "col-span-2", large: true,
    emoji: "⚖️", title: "إدارة القضايا",
    desc: "سجّل كل قضية، تابع جلساتها، أدر مستنداتها، ولاحق مواعيدها — كل شيء في مكان واحد، لا فوضى، لا فقدان للبيانات.",
    tags: ["تتبع تلقائي","جلسات","مستندات","مواعيد"],
    accent: B,
  },
  {
    col: "", large: false,
    emoji: "🤖", title: "مساعد ذكاء اصطناعي",
    desc: "تحليل فوري مدعوم بـ Gemini AI",
    accent: "#7C3AED",
  },
  {
    col: "", large: false,
    emoji: "💳", title: "الفواتير والدفع",
    desc: "احصّل على مدفوعاتك إلكترونياً",
    accent: "#059669",
  },
  {
    col: "col-span-2", large: false,
    emoji: "📊", title: "تقارير وتحليلات",
    desc: "رؤية 360° على أداء مكتبك — الإيرادات، معدل إنجاز القضايا، نشاط الفريق",
    accent: "#D97706",
    wideRow: true,
  },
  {
    col: "", large: false,
    emoji: "🔐", title: "أمان وتشفير",
    desc: "بياناتك محمية بتشفير طرف لطرف",
    accent: "#DC2626",
  },
];

export function BentoGlass() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: G, fontFamily: "'IBM Plex Sans Arabic','Cairo',sans-serif", color: T }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(248,250,252,0.92)", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${BD}`,
        padding: "0 56px", height: 58,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: B, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚖️</div>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.4px" }}>عدالة AI</span>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {["المميزات","الأسعار","الأمان","التوثيق"].map(l => (
            <span key={l} style={{ fontSize: 13.5, color: S, cursor: "pointer" }}>{l}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ padding: "7px 18px", borderRadius: 8, border: `1px solid ${BD}`, background: "#fff", color: T, fontSize: 13, cursor: "pointer" }}>دخول</button>
          <button style={{ padding: "7px 18px", borderRadius: 8, background: B, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>ابدأ مجاناً</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 40px" }}>

        {/* ── HERO ── */}
        <div style={{ padding: "72px 0 56px", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 24,
            padding: "5px 14px", borderRadius: 100,
            background: "#EFF6FF", border: "1px solid #BFDBFE",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: B, display: "inline-block" }} />
            <span style={{ color: B, fontSize: 12, fontWeight: 700 }}>النظام القانوني الأول بالذكاء الاصطناعي في السعودية</span>
          </div>

          <h1 style={{ fontSize: 60, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-2.5px", margin: "0 0 20px", color: T }}>
            مكتبك القانوني يستحق<br />
            <span style={{ background: `linear-gradient(135deg, ${B} 0%, ${B2} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>أدوات استثنائية</span>
          </h1>

          <p style={{ fontSize: 18, color: S, maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.9 }}>
            منصة واحدة لإدارة القضايا والعملاء والفواتير والعقود، مدعومة بذكاء اصطناعي يفهم القانون السعودي
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 52 }}>
            <button style={{ padding: "12px 28px", borderRadius: 10, background: B, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 18px ${B}33` }}>
              ابدأ مجاناً — ١٤ يوم
            </button>
            <button style={{ padding: "12px 24px", borderRadius: 10, background: "#fff", border: `1px solid ${BD}`, color: T, fontSize: 15, cursor: "pointer" }}>
              شاهد العرض ▶
            </button>
          </div>

          {/* Stat pills */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {[["+٢٠٠ مكتب","🏢"],[" ٩٨٪ رضا","⭐"],["٣× أسرع","⚡"],["٢٤/٧ دعم","💬"]].map(([l, e]) => (
              <div key={l} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 16px", borderRadius: 100,
                background: "#fff", border: `1px solid ${BD}`,
                fontSize: 13, color: S, fontWeight: 600,
              }}><span>{e}</span><span>{l}</span></div>
            ))}
          </div>
        </div>

        {/* ── BENTO GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 80 }}>

          {/* Large card (2/3) */}
          <div style={{
            gridColumn: "span 2", padding: "32px", borderRadius: 18,
            background: "#fff", border: `1px solid ${BD}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            transition: "box-shadow 0.2s",
          }}>
            <div style={{ fontSize: 38, marginBottom: 18 }}>⚖️</div>
            <h3 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 10, color: T }}>إدارة القضايا الذكية</h3>
            <p style={{ fontSize: 14, color: S, lineHeight: 1.9, marginBottom: 22, maxWidth: 420 }}>
              سجّل كل قضية، تابع جلساتها، أدر مستنداتها، ولاحق مواعيدها. لا فوضى، لا فقدان للبيانات — كل شيء منظم ودقيق.
            </p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {["تتبع تلقائي","جلسات المحكمة","تنبيهات ذكية","إدارة الوثائق"].map(tag => (
                <span key={tag} style={{ padding: "4px 12px", borderRadius: 100, background: "#EFF6FF", border: "1px solid #BFDBFE", color: B, fontSize: 12, fontWeight: 600 }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* AI card (1/3) */}
          <div style={{
            padding: "28px", borderRadius: 18,
            background: "linear-gradient(145deg, #F5F3FF, #EDE9FE)",
            border: "1px solid #DDD6FE",
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{ fontSize: 34 }}>🤖</div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#4C1D95", marginBottom: 8 }}>مساعد AI قانوني</h3>
              <p style={{ fontSize: 13, color: "#6D28D9", lineHeight: 1.7 }}>تحليل فوري مدعوم بـ Gemini</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.5)", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#6D28D9" }}>
              "حلّل هذا العقد وحدّد بنود الخطر..." →
            </div>
          </div>

          {/* Finance card */}
          <div style={{
            padding: "28px", borderRadius: 18,
            background: "linear-gradient(145deg, #F0FDF4, #DCFCE7)",
            border: "1px solid #BBF7D0",
          }}>
            <div style={{ fontSize: 34, marginBottom: 14 }}>💳</div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#14532D", marginBottom: 8 }}>الفواتير والدفع</h3>
            <p style={{ fontSize: 13, color: "#166534", lineHeight: 1.7, marginBottom: 16 }}>PDF تلقائي · مدى · Visa · SADAD</p>
            <div style={{ display: "flex", gap: 5 }}>
              {["Visa","Mada","SADAD"].map(b => (
                <span key={b} style={{ padding: "3px 9px", borderRadius: 6, background: "rgba(255,255,255,0.6)", color: "#15803D", fontSize: 11, fontWeight: 700 }}>{b}</span>
              ))}
            </div>
          </div>

          {/* Analytics card — wide */}
          <div style={{
            gridColumn: "span 2", padding: "28px 32px", borderRadius: 18,
            background: "#fff", border: `1px solid ${BD}`,
            display: "flex", gap: 32, alignItems: "center",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 34, marginBottom: 14 }}>📊</div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: T, marginBottom: 8 }}>تقارير وتحليلات</h3>
              <p style={{ fontSize: 13, color: S, lineHeight: 1.7 }}>رؤية 360° على أداء مكتبك — إيرادات، قضايا، نشاط الفريق</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, minWidth: 200 }}>
              {[["الإيرادات","↑ 32٪","#059669"],["القضايا","↑ 18٪",B],["الإنجاز","↑ 45٪","#7C3AED"],["الرضا","↑ 12٪","#D97706"]].map(([l,v,c]) => (
                <div key={l} style={{ padding: "10px 12px", borderRadius: 10, background: G, border: `1px solid ${BD}` }}>
                  <div style={{ fontSize: 10, color: M, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Security card */}
          <div style={{
            padding: "28px", borderRadius: 18,
            background: "linear-gradient(145deg, #FEF2F2, #FEE2E2)",
            border: "1px solid #FECACA",
          }}>
            <div style={{ fontSize: 34, marginBottom: 14 }}>🔐</div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#7F1D1D", marginBottom: 8 }}>أمان وتشفير</h3>
            <p style={{ fontSize: 13, color: "#991B1B", lineHeight: 1.7 }}>تشفير طرف لطرف، سجل كامل، ISO 27001</p>
          </div>

          {/* CTA Banner — full width */}
          <div style={{
            gridColumn: "span 3", padding: "28px 36px", borderRadius: 18,
            background: B, display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 6 }}>جرّب عدالة AI مجاناً لمدة ١٤ يوماً</h3>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>لا بطاقة ائتمان · إعداد فوري · دعم كامل</p>
            </div>
            <button style={{
              padding: "12px 28px", borderRadius: 10,
              background: "#fff", border: "none",
              color: B, fontSize: 14, fontWeight: 800, cursor: "pointer",
            }}>ابدأ الآن ←</button>
          </div>

        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800;900&family=Cairo:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html,body { background: ${G}; }
      `}</style>
    </div>
  );
}
