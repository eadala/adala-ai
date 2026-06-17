/* ═══════════════════════════════════════════════════════
   Landing Variant: BENTO  (Notion + Linear aesthetic)
   بساطة Notion + دقة Linear — بينتو جريد فاتح
═══════════════════════════════════════════════════════ */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const B  = "#1A56DB", B2 = "#3B82F6", T = "#0F172A", S = "#475569";
const M  = "#94A3B8", BD = "#E2E8F0", G = "#F8FAFC";

export function LandingBento() {
  const { data: plans = [] } = useQuery<any[]>({
    queryKey: ["billing-plans"],
    queryFn: () => fetch(`${BASE}/api/billing/plans`).then(r => r.json()),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div dir="rtl" style={{ minHeight:"100vh", background:G, fontFamily:"'IBM Plex Sans Arabic','Cairo',sans-serif", color:T }}>

      {/* NAV */}
      <nav style={{ position:"sticky",top:0,zIndex:50,background:"rgba(248,250,252,0.92)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${BD}`,padding:"0 56px",height:58,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ display:"flex",alignItems:"center",gap:9 }}>
          <div style={{ width:30,height:30,borderRadius:8,background:B,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>⚖️</div>
          <span style={{ fontSize:16,fontWeight:800,letterSpacing:"-0.4px" }}>عدالة AI</span>
        </div>
        <div style={{ display:"flex",gap:28 }}>
          {["المميزات","الأسعار","الأمان","التوثيق"].map(l=><span key={l} style={{fontSize:13.5,color:S,cursor:"pointer"}}>{l}</span>)}
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <Link href={`${BASE}/sign-in`}><button style={{padding:"7px 18px",borderRadius:8,border:`1px solid ${BD}`,background:"#fff",color:T,fontSize:13,cursor:"pointer"}}>دخول</button></Link>
          <Link href={`${BASE}/sign-up`}><button style={{padding:"7px 18px",borderRadius:8,background:B,border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>ابدأ مجاناً</button></Link>
        </div>
      </nav>

      <div style={{ maxWidth:1100,margin:"0 auto",padding:"0 40px" }}>
        {/* HERO */}
        <div style={{ padding:"72px 0 56px",textAlign:"center" }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:7,marginBottom:24,padding:"5px 14px",borderRadius:100,background:"#EFF6FF",border:"1px solid #BFDBFE" }}>
            <span style={{ width:5,height:5,borderRadius:"50%",background:B,display:"inline-block" }}/>
            <span style={{ color:B,fontSize:12,fontWeight:700 }}>النظام القانوني الأول بالذكاء الاصطناعي في السعودية</span>
          </div>
          <h1 style={{ fontSize:60,fontWeight:900,lineHeight:1.1,letterSpacing:"-2.5px",margin:"0 0 20px",color:T }}>
            مكتبك القانوني يستحق<br/>
            <span style={{ background:`linear-gradient(135deg,${B} 0%,${B2} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>أدوات استثنائية</span>
          </h1>
          <p style={{ fontSize:18,color:S,maxWidth:520,margin:"0 auto 36px",lineHeight:1.9 }}>
            منصة واحدة لإدارة القضايا والعملاء والفواتير والعقود، مدعومة بذكاء اصطناعي يفهم القانون السعودي
          </p>
          <div style={{ display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:52 }}>
            <Link href={`${BASE}/sign-up`}><button style={{padding:"12px 28px",borderRadius:10,background:B,border:"none",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:`0 4px 18px ${B}33`}}>ابدأ مجاناً — ١٤ يوم</button></Link>
            <Link href={`${BASE}/demo-login`}><button style={{ padding:"12px 24px",borderRadius:10,background:"#EEF2FF",border:`1px solid #C7D2FE`,color:B,fontSize:15,cursor:"pointer",fontWeight:700 }}>🎭 جرّب المنصة الآن</button></Link>
          </div>
          <div style={{ display:"flex",gap:10,justifyContent:"center" }}>
            {[["+٢٠٠ مكتب","🏢"],["٩٨٪ رضا","⭐"],["٣× أسرع","⚡"],["٢٤/٧ دعم","💬"]].map(([l,e])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:100,background:"#fff",border:`1px solid ${BD}`,fontSize:13,color:S,fontWeight:600}}><span>{e}</span><span>{l}</span></div>
            ))}
          </div>
        </div>

        {/* BENTO GRID */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:80 }}>
          {/* Large */}
          <div style={{ gridColumn:"span 2",padding:"32px",borderRadius:18,background:"#fff",border:`1px solid ${BD}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:38,marginBottom:18 }}>⚖️</div>
            <h3 style={{ fontSize:21,fontWeight:800,letterSpacing:"-0.5px",marginBottom:10 }}>إدارة القضايا الذكية</h3>
            <p style={{ fontSize:14,color:S,lineHeight:1.9,marginBottom:22 }}>سجّل كل قضية، تابع جلساتها، أدر مستنداتها، ولاحق مواعيدها. لا فوضى، لا فقدان للبيانات.</p>
            <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
              {["تتبع تلقائي","جلسات المحكمة","تنبيهات ذكية","إدارة الوثائق"].map(t=>(
                <span key={t} style={{padding:"4px 12px",borderRadius:100,background:"#EFF6FF",border:"1px solid #BFDBFE",color:B,fontSize:12,fontWeight:600}}>{t}</span>
              ))}
            </div>
          </div>
          {/* AI */}
          <div style={{ padding:"28px",borderRadius:18,background:"linear-gradient(145deg,#F5F3FF,#EDE9FE)",border:"1px solid #DDD6FE",display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ fontSize:34 }}>🤖</div>
            <div><h3 style={{fontSize:17,fontWeight:800,color:"#4C1D95",marginBottom:8}}>مساعد AI قانوني</h3><p style={{fontSize:13,color:"#6D28D9",lineHeight:1.7}}>تحليل فوري مدعوم بـ Gemini</p></div>
            <div style={{ background:"rgba(255,255,255,0.5)",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#6D28D9" }}>"حلّل هذا العقد وحدّد بنود الخطر..." →</div>
          </div>
          {/* Finance */}
          <div style={{ padding:"28px",borderRadius:18,background:"linear-gradient(145deg,#F0FDF4,#DCFCE7)",border:"1px solid #BBF7D0" }}>
            <div style={{ fontSize:34,marginBottom:14 }}>💳</div>
            <h3 style={{ fontSize:17,fontWeight:800,color:"#14532D",marginBottom:8 }}>الفواتير والدفع</h3>
            <p style={{ fontSize:13,color:"#166534",lineHeight:1.7,marginBottom:16 }}>PDF تلقائي · مدى · Visa · SADAD</p>
            <div style={{ display:"flex",gap:5 }}>
              {["Visa","Mada","SADAD"].map(b=><span key={b} style={{padding:"3px 9px",borderRadius:6,background:"rgba(255,255,255,0.6)",color:"#15803D",fontSize:11,fontWeight:700}}>{b}</span>)}
            </div>
          </div>
          {/* Analytics */}
          <div style={{ gridColumn:"span 2",padding:"28px 32px",borderRadius:18,background:"#fff",border:`1px solid ${BD}`,display:"flex",gap:32,alignItems:"center" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:34,marginBottom:14 }}>📊</div>
              <h3 style={{ fontSize:17,fontWeight:800,marginBottom:8 }}>تقارير وتحليلات</h3>
              <p style={{ fontSize:13,color:S,lineHeight:1.7 }}>رؤية 360° على أداء مكتبك — إيرادات، قضايا، نشاط الفريق</p>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,minWidth:200 }}>
              {[["الإيرادات","↑ 32٪","#059669"],["القضايا","↑ 18٪",B],["الإنجاز","↑ 45٪","#7C3AED"],["الرضا","↑ 12٪","#D97706"]].map(([l,v,c])=>(
                <div key={l} style={{padding:"10px 12px",borderRadius:10,background:G,border:`1px solid ${BD}`}}>
                  <div style={{fontSize:10,color:M,marginBottom:3}}>{l}</div>
                  <div style={{fontSize:17,fontWeight:800,color:c}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Security */}
          <div style={{ padding:"28px",borderRadius:18,background:"linear-gradient(145deg,#FEF2F2,#FEE2E2)",border:"1px solid #FECACA" }}>
            <div style={{ fontSize:34,marginBottom:14 }}>🔐</div>
            <h3 style={{ fontSize:17,fontWeight:800,color:"#7F1D1D",marginBottom:8 }}>أمان وتشفير</h3>
            <p style={{ fontSize:13,color:"#991B1B",lineHeight:1.7 }}>تشفير طرف لطرف، سجل كامل، ISO 27001</p>
          </div>
          {/* CTA banner */}
          <div style={{ gridColumn:"span 3",padding:"28px 36px",borderRadius:18,background:B,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <h3 style={{ fontSize:20,fontWeight:800,color:"#fff",marginBottom:6 }}>جرّب عدالة AI مجاناً لمدة ١٤ يوماً</h3>
              <p style={{ fontSize:13,color:"rgba(255,255,255,0.65)" }}>لا بطاقة ائتمان · إعداد فوري · دعم كامل</p>
            </div>
            <Link href={`${BASE}/sign-up`}><button style={{padding:"12px 28px",borderRadius:10,background:"#fff",border:"none",color:B,fontSize:14,fontWeight:800,cursor:"pointer"}}>ابدأ الآن ←</button></Link>
          </div>
        </div>

        {/* PRICING from DB */}
        {plans.length > 0 && (
          <div style={{ marginBottom:80 }}>
            <h2 style={{ fontSize:36,fontWeight:900,textAlign:"center",letterSpacing:"-1.5px",marginBottom:12 }}>خطط بسيطة وشفافة</h2>
            <p style={{ textAlign:"center",color:S,marginBottom:44 }}>ابدأ مجاناً · لا عقود · ألغِ في أي وقت</p>
            <div style={{ display:"grid",gridTemplateColumns:`repeat(${Math.min(plans.length,3)},1fr)`,gap:20 }}>
              {plans.slice(0,3).map((p:any,i:number)=>(
                <div key={i} style={{ padding:"32px 28px",borderRadius:20,background: i===1?B:"#fff",border:`1px solid ${i===1?B:BD}`,boxShadow:i===1?`0 20px 50px ${B}2A`:"0 2px 8px rgba(0,0,0,0.03)",position:"relative" }}>
                  {i===1&&<div style={{position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",background:"#F59E0B",color:"#fff",fontSize:11,fontWeight:800,padding:"4px 14px",borderRadius:100}}>الأكثر طلباً</div>}
                  <div style={{ fontSize:15,fontWeight:700,color:i===1?"rgba(255,255,255,0.7)":M,marginBottom:10 }}>{p.name}</div>
                  <div style={{ fontSize:40,fontWeight:900,color:i===1?"#fff":T,letterSpacing:"-1.5px",marginBottom:20 }}>
                    ﷼{p.price}<span style={{fontSize:14,fontWeight:400,color:i===1?"rgba(255,255,255,0.5)":M}}>/شهر</span>
                  </div>
                  <Link href={`${BASE}/sign-up`}><button style={{width:"100%",padding:"11px",borderRadius:9,border:"none",background:i===1?"#fff":B,color:i===1?B:"#fff",fontSize:14,fontWeight:800,cursor:"pointer"}}>ابدأ الآن</button></Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
