/* ═══════════════════════════════════════════════════════
   Landing Variant: HUBSPOT  (HubSpot + Stripe aesthetic)
   داشبورد ضخم في الهيرو + أرقام ثقة + شهادات + مميزات شبكة
═══════════════════════════════════════════════════════ */
import { useState } from "react";
import { Link } from "wouter";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const B = "#1A56DB", B2 = "#3B82F6", T = "#0F172A", S = "#475569";
const M = "#94A3B8", BD = "#E2E8F0", G = "#F8FAFC";

const features = [
  { icon:"⚖️", title:"إدارة القضايا", desc:"تتبع كامل: جلسات، ملفات، مواعيد، قرارات — كل شيء موثّق ومرتّب", color:B },
  { icon:"🤖", title:"ذكاء اصطناعي", desc:"تحليل عقود، صياغة مذكرات، ملخصات فورية بالعربية مدعومة بـ Gemini", color:"#7C3AED" },
  { icon:"👥", title:"إدارة العملاء", desc:"ملفات موكّلين شاملة، تواصل مباشر، بوابة إلكترونية للمتابعة", color:"#059669" },
  { icon:"💳", title:"فواتير ودفع", desc:"فواتير PDF احترافية، دفع إلكتروني فوري، تتبع لحظي للمستحقات", color:"#D97706" },
  { icon:"📊", title:"تقارير ذكية", desc:"رؤية 360° على مكتبك — إيرادات، قضايا، أداء الفريق", color:"#DC2626" },
  { icon:"🔐", title:"أمان مؤسسي", desc:"تشفير طرف لطرف، سجل تدقيق كامل، صلاحيات متقدمة، ISO 27001", color:"#0891B2" },
];

const testimonials = [
  { name:"أ. فيصل الحربي", role:"مكتب الحربي للمحاماة", text:"وفّرت لنا عدالة AI أكثر من ١٠ ساعات أسبوعياً في إدارة الملفات والفواتير.", avatar:"ف" },
  { name:"أ. نورة المطيري", role:"مكتب المطيري والشركاء", text:"مساعد الذكاء الاصطناعي غيّر طريقة عملنا. تحليل العقود أصبح دقائق بدل ساعات.", avatar:"ن" },
  { name:"أ. خالد الزهراني", role:"مكتب الزهراني القانوني", text:"لوحة التحكم واضحة وسريعة، والدعم الفني ممتاز. أنصح به كل مكتب محاماة.", avatar:"خ" },
];

function DashPreview() {
  return (
    <div style={{ background:"#fff",borderRadius:20,border:`1px solid ${BD}`,boxShadow:"0 24px 60px rgba(0,0,0,0.10)",overflow:"hidden" }}>
      <div style={{ background:G,borderBottom:`1px solid ${BD}`,padding:"10px 18px",display:"flex",gap:6,alignItems:"center" }}>
        {["#FF5F57","#FFBD2E","#28CA41"].map(c=><div key={c} style={{width:10,height:10,borderRadius:"50%",background:c}}/>)}
        <span style={{ marginRight:14,fontSize:11,color:M }}>عدالة AI — لوحة التحكم</span>
      </div>
      <div style={{ display:"flex",height:360 }}>
        <div style={{ width:170,background:"#F1F5F9",borderLeft:`1px solid ${BD}`,padding:"16px 12px",display:"flex",flexDirection:"column",gap:4 }}>
          {[["🏠","الرئيسية",true],["⚖️","القضايا",false],["👥","العملاء",false],["💳","الفواتير",false],["📊","التقارير",false]].map(([ic,lbl,act])=>(
            <div key={lbl as string} style={{ display:"flex",gap:8,alignItems:"center",padding:"8px 10px",borderRadius:8,background:act?B:"transparent",color:(act?"#fff":S) as string,fontSize:12,fontWeight:act?700:400 }}>
              <span>{ic}</span><span>{lbl}</span>
            </div>
          ))}
        </div>
        <div style={{ flex:1,padding:18 }}>
          <div style={{ fontSize:13,fontWeight:800,color:T,marginBottom:14 }}>لوحة التحكم</div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14 }}>
            {[["القضايا","٤٧",B],["الجلسات","٨","#7C3AED"],["الإيرادات","٤٥K","#059669"],["المعلقة","١٢K","#D97706"]].map(([l,v,c])=>(
              <div key={l} style={{ background:G,border:`1px solid ${BD}`,borderRadius:10,padding:"10px 12px" }}>
                <div style={{ fontSize:9.5,color:M,marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:18,fontWeight:900,color:c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ background:G,border:`1px solid ${BD}`,borderRadius:10,padding:12 }}>
            <div style={{ fontSize:12,fontWeight:700,color:T,marginBottom:10 }}>أحدث القضايا</div>
            {[["شركة الرياض","تجاري","قيد النظر",B],["محمد حسن","مدني","استئناف","#7C3AED"],["مؤسسة الشمال","عمالي","جلسة قادمة","#059669"]].map(([n,t,s,c])=>(
              <div key={n} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${BD}` }}>
                <div style={{ fontSize:11.5,fontWeight:700,color:T }}>{n} <span style={{color:M,fontWeight:400}}>· {t}</span></div>
                <span style={{ fontSize:10,padding:"2px 8px",borderRadius:100,background:`${c}12`,color:c as string,fontWeight:700 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingHubspot() {
  const [hov, setHov] = useState<number|null>(null);

  return (
    <div dir="rtl" style={{ minHeight:"100vh",background:"#fff",fontFamily:"'IBM Plex Sans Arabic','Cairo',sans-serif",color:T }}>
      {/* NAV */}
      <nav style={{ position:"sticky",top:0,zIndex:50,background:"rgba(255,255,255,0.94)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${BD}`,padding:"0 60px",height:62,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:33,height:33,borderRadius:9,background:B,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>⚖️</div>
          <span style={{ fontSize:17,fontWeight:900,letterSpacing:"-0.4px" }}>عدالة AI</span>
        </div>
        <div style={{ display:"flex",gap:30 }}>
          {["المميزات","الأسعار","العملاء","الشركات","التوثيق"].map(l=><span key={l} style={{fontSize:13.5,color:S,cursor:"pointer"}}>{l}</span>)}
        </div>
        <div style={{ display:"flex",gap:9 }}>
          <Link href={`${BASE}/sign-in`}><button style={{padding:"7px 18px",borderRadius:8,border:`1px solid ${BD}`,background:"transparent",color:T,fontSize:13,cursor:"pointer"}}>دخول</button></Link>
          <Link href={`${BASE}/sign-up`}><button style={{padding:"7px 20px",borderRadius:8,background:B,border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:`0 2px 10px ${B}33`}}>ابدأ مجاناً</button></Link>
        </div>
      </nav>

      <div style={{ maxWidth:1140,margin:"0 auto",padding:"0 40px" }}>
        {/* HERO */}
        <div style={{ textAlign:"center",padding:"72px 0 52px" }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:8,marginBottom:24,padding:"5px 16px",borderRadius:100,background:"#EFF6FF",border:"1px solid #BFDBFE" }}>
            <span style={{ width:5,height:5,borderRadius:"50%",background:"#4ADE80",display:"inline-block" }}/>
            <span style={{ color:B,fontSize:12,fontWeight:700 }}>النظام القانوني الأول في السعودية بالذكاء الاصطناعي</span>
          </div>
          <h1 style={{ fontSize:64,fontWeight:900,lineHeight:1.08,letterSpacing:"-2.5px",margin:"0 0 20px",color:T }}>
            أدر مكتبك القانوني بثقة<br/>
            <span style={{ background:`linear-gradient(135deg,${B} 0%,${B2} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>من أي مكان</span>
          </h1>
          <p style={{ fontSize:18,color:S,maxWidth:560,margin:"0 auto 36px",lineHeight:1.9 }}>
            منصة واحدة تجمع إدارة القضايا، العملاء، الفواتير، العقود، والذكاء الاصطناعي — صُمّمت للمحامي السعودي
          </p>
          <div style={{ display:"flex",gap:10,justifyContent:"center",marginBottom:48 }}>
            <Link href={`${BASE}/sign-up`}><button style={{padding:"14px 32px",borderRadius:10,background:B,border:"none",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:`0 6px 24px ${B}33`}}>ابدأ مجاناً — ١٤ يوم</button></Link>
            <button style={{ padding:"14px 26px",borderRadius:10,background:G,border:`1px solid ${BD}`,color:T,fontSize:15,cursor:"pointer" }}>▶ شاهد كيف يعمل</button>
          </div>
          <DashPreview/>
        </div>

        {/* STATS */}
        <div style={{ display:"flex",justifyContent:"center",gap:0,borderTop:`1px solid ${BD}`,borderBottom:`1px solid ${BD}`,margin:"0 -40px",padding:"32px 40px" }}>
          {[["+٢٠٠","مكتب قانوني"],["٩٨٪","رضا العملاء"],["٣×","أسرع في الإنجاز"],["٢٤/٧","دعم متواصل"],["٥ ★","تقييم المستخدمين"]].map(([v,l],i)=>(
            <div key={l} style={{ flex:1,textAlign:"center",padding:"0 24px",borderRight:i<4?`1px solid ${BD}`:"none" }}>
              <div style={{ fontSize:28,fontWeight:900,color:T,letterSpacing:"-0.8px" }}>{v}</div>
              <div style={{ fontSize:12,color:M,marginTop:3 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* FEATURES GRID */}
        <div style={{ padding:"72px 0 0" }}>
          <div style={{ textAlign:"center",marginBottom:52 }}>
            <h2 style={{ fontSize:40,fontWeight:900,letterSpacing:"-1.5px",color:T,marginBottom:12 }}>كل ما يحتاجه مكتبك</h2>
            <p style={{ fontSize:16,color:S }}>مصمّم خصيصاً للمحامين والمكاتب القانونية السعودية</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20,marginBottom:72 }}>
            {features.map((f,i)=>(
              <div key={i} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)} style={{ padding:"30px 28px",borderRadius:16,background:hov===i?"#fff":G,border:`1px solid ${hov===i?f.color+"30":BD}`,transition:"all 0.2s",cursor:"pointer",boxShadow:hov===i?`0 8px 30px ${f.color}12`:"none",transform:hov===i?"translateY(-3px)":"none" }}>
                <div style={{ width:48,height:48,borderRadius:13,marginBottom:18,background:`${f.color}12`,border:`1px solid ${f.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>{f.icon}</div>
                <h3 style={{ fontSize:17,fontWeight:800,color:T,marginBottom:9,letterSpacing:"-0.3px" }}>{f.title}</h3>
                <p style={{ fontSize:13.5,color:S,lineHeight:1.8 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* TESTIMONIALS */}
        <div style={{ marginBottom:72 }}>
          <h2 style={{ fontSize:36,fontWeight:900,letterSpacing:"-1.5px",color:T,marginBottom:40,textAlign:"center" }}>يثق بنا المحامون السعوديون</h2>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20 }}>
            {testimonials.map((t,i)=>(
              <div key={i} style={{ padding:"28px",borderRadius:16,background:G,border:`1px solid ${BD}` }}>
                <div style={{ display:"flex",gap:4,marginBottom:16 }}>
                  {[1,2,3,4,5].map(s=><span key={s} style={{color:"#F59E0B",fontSize:14}}>★</span>)}
                </div>
                <p style={{ fontSize:14,color:S,lineHeight:1.8,marginBottom:20 }}>"{t.text}"</p>
                <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                  <div style={{ width:38,height:38,borderRadius:"50%",background:B,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:15,fontWeight:800 }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontSize:13,fontWeight:700,color:T }}>{t.name}</div>
                    <div style={{ fontSize:11,color:M }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign:"center",padding:"60px 40px",marginBottom:80,background:B,borderRadius:24,boxShadow:`0 24px 60px ${B}33` }}>
          <h2 style={{ fontSize:38,fontWeight:900,color:"#fff",letterSpacing:"-1.5px",marginBottom:14 }}>ابدأ رحلتك مع عدالة AI اليوم</h2>
          <p style={{ fontSize:16,color:"rgba(255,255,255,0.65)",marginBottom:32 }}>١٤ يوم مجاناً · لا بطاقة ائتمان · إعداد فوري بدقيقتين</p>
          <div style={{ display:"flex",gap:12,justifyContent:"center" }}>
            <Link href={`${BASE}/sign-up`}><button style={{padding:"14px 32px",borderRadius:10,background:"#fff",border:"none",color:B,fontSize:15,fontWeight:800,cursor:"pointer"}}>ابدأ الآن مجاناً ←</button></Link>
            <button style={{ padding:"14px 28px",borderRadius:10,background:"transparent",border:"1px solid rgba(255,255,255,0.3)",color:"rgba(255,255,255,0.8)",fontSize:15,cursor:"pointer" }}>تحدّث مع الفريق</button>
          </div>
        </div>
      </div>
    </div>
  );
}
