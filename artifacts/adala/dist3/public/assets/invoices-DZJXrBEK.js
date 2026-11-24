import{a as d,j as e}from"./vendor-react-CT0_hoX6.js";import{B as x,a as ue,D as ds,d as cs,e as ms,f as V,g as _e,h as xs,i as ps,T as hs,n as gs}from"./index-DRsFUE3c.js";import{a as Ze,u as Fe,b as Q,d as us,f as qe,g as fs,e as bs,h as js,i as Ns}from"./vendor-tanstack-BdGrscrn.js";import{C as ce,c as me,a as vs,b as ys}from"./card-01wupgd_.js";import{I as L}from"./input-ZVw9LIqo.js";import{L as K}from"./label-ChVJe_QJ.js";import{S as Te}from"./separator-TqebWX4O.js";import{C as Ve}from"./checkbox-gVX472MV.js";import{A as ws,a as Ss}from"./adaptive-dialog-DCbFZb5P.js";import{S as ks,a as Cs,b as $s,c as Fs}from"./sheet-BKxbb0bU.js";import{S as fe,a as be,b as je,c as Ne,d as H}from"./select-BoS3xIA3.js";import{T as Ts,a as As,b as $e,c as Ps,d as Es,e as Ke}from"./table-BoBQ_nz9.js";import{t as p}from"./index-D6pOB7Oe.js";import{R as ve,aR as z,aa as Ds,E as es,a9 as ss,aY as Ee,a6 as zs,cd as Os,m as Rs,b as xe,F as Is,H as J,d as Ls,an as Ms,s as He,C as Ye,ce as Ge,bq as De,ai as Bs,bs as Us,y as Ae,br as re,aS as _s,cf as qs,cg as Vs,b5 as ze,O as ge,aX as ts,w as We,bn as Ks}from"./vendor-icons-BFrUBqiJ.js";import{R as Hs,B as Ys,C as Gs,X as Ws,Y as Js,T as Qs,b as Je}from"./vendor-charts-CneYNIhr.js";import"./vendor-router-DkVvMFVl.js";import"./vendor-i18n-lBdt9ta2.js";import"./vendor-clerk-Pjup2QWV.js";import"./index-CSSW656p.js";import"./use-breakpoint-l8ceMopP.js";const v="/".replace(/\/$/,"");function pe(s,f){const c=()=>{p.success("تم نسخ الرابط ✓"),f?.()},l=()=>p.error("تعذّر نسخ الرابط، يرجى نسخه يدوياً");navigator.clipboard&&typeof navigator.clipboard.writeText=="function"?navigator.clipboard.writeText(s).then(c).catch(()=>Qe(s,c,l)):Qe(s,c,l)}function Qe(s,f,c){try{const l=document.createElement("textarea");l.value=s,l.style.cssText="position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent;",document.body.appendChild(l),l.focus(),l.select(),typeof l.setSelectionRange=="function"&&l.setSelectionRange(0,s.length);const n=document.execCommand("copy");document.body.removeChild(l),n?f():c()}catch{c()}}const ye={draft:{label:"مسودة",cls:"bg-muted/30 text-muted-foreground border-gray-500/20",icon:Is},sent:{label:"مُرسَلة",cls:"bg-blue-500/10 text-blue-400 border-blue-500/20",icon:xe},paid:{label:"مدفوعة",cls:"bg-green-500/10 text-green-400 border-green-500/20",icon:z},partially_paid:{label:"مدفوعة جزئياً",cls:"bg-teal-500/10 text-teal-400 border-teal-500/20",icon:Ee},overdue:{label:"متأخرة",cls:"bg-red-500/10 text-red-400 border-red-500/20",icon:es},cancelled:{label:"ملغاة",cls:"bg-orange-500/10 text-orange-400 border-orange-500/20",icon:Rs}};function u(s){return Number(s??0).toLocaleString("ar-SA",{minimumFractionDigits:2,maximumFractionDigits:2})}function X(s){return s?new Date(s).toLocaleDateString("ar-SA",{year:"numeric",month:"short",day:"numeric"}):"—"}function Pe({status:s}){const f=ye[s]??ye.draft,c=f.icon;return e.jsxs(ue,{variant:"outline",className:`text-xs gap-1 ${f.cls}`,children:[e.jsx(c,{className:"h-3 w-3"}),f.label]})}function Xs({invoices:s}){const f=d.useMemo(()=>{const c={};return s.forEach(l=>{const n=new Date(l.createdAt),b=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`,C=n.toLocaleDateString("ar-SA",{month:"short",year:"2-digit"});c[b]||(c[b]={month:C,total:0,paid:0}),c[b].total+=Number(l.total??0),(l.status==="paid"||l.status==="partially_paid")&&(c[b].paid+=Number(l.amountPaid??(l.status==="paid"?l.total:0)))}),Object.entries(c).sort(([l],[n])=>l.localeCompare(n)).map(([,l])=>l).slice(-6)},[s]);return f.length===0?null:e.jsxs(ce,{children:[e.jsx(vs,{className:"pb-2",children:e.jsxs(ys,{className:"text-sm font-medium text-muted-foreground flex items-center gap-2",children:[e.jsx(ss,{className:"h-4 w-4 text-primary"}),"الإيرادات الشهرية"]})}),e.jsxs(me,{children:[e.jsx(Hs,{width:"100%",height:160,children:e.jsxs(Ys,{data:f,margin:{top:0,right:0,left:-10,bottom:0},children:[e.jsx(Gs,{strokeDasharray:"3 3",stroke:"rgba(255,255,255,0.05)"}),e.jsx(Ws,{dataKey:"month",tick:{fontSize:11,fill:"#9ca3af"},tickLine:!1,axisLine:!1}),e.jsx(Js,{tick:{fontSize:10,fill:"#9ca3af"},tickLine:!1,axisLine:!1,tickFormatter:c=>c>=1e3?`${(c/1e3).toFixed(0)}k`:c}),e.jsx(Qs,{contentStyle:{background:"#0f1b2e",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8},formatter:(c,l)=>[`${Number(c).toLocaleString("ar-SA")} ر.س`,l==="paid"?"محصّل":"إجمالي"]}),e.jsx(Je,{dataKey:"total",fill:"rgba(180,130,60,0.3)",radius:[4,4,0,0],name:"total"}),e.jsx(Je,{dataKey:"paid",fill:"#1A56DB",radius:[4,4,0,0],name:"paid"})]})}),e.jsxs("div",{className:"flex gap-4 mt-2 text-xs text-muted-foreground",children:[e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"w-3 h-2 rounded-sm bg-primary inline-block"}),"محصّل"]}),e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"w-3 h-2 rounded-sm bg-[rgba(180,130,60,0.3)] inline-block"}),"إجمالي"]})]})]})]})}function Xe({clients:s,onCreated:f}){const[c,l]=d.useState(!1),[n,b]=d.useState(""),[C,R]=d.useState(""),[M,Y]=d.useState(""),[Z,I]=d.useState(""),[G,y]=d.useState(""),[T,B]=d.useState(!0),[j,O]=d.useState(15),[w,E]=d.useState([{description:"",quantity:1,unitPrice:0}]),ne=()=>E(i=>[...i,{description:"",quantity:1,unitPrice:0}]),W=i=>E(g=>g.filter((D,ee)=>ee!==i)),A=(i,g,D)=>E(ee=>ee.map((se,he)=>he===i?{...se,[g]:D}:se)),h=+w.reduce((i,g)=>i+g.quantity*g.unitPrice,0).toFixed(2),U=T?+(h*j/100).toFixed(2):0,t=+(h+U).toFixed(2),[a,o]=d.useState("form"),[S,$]=d.useState(null),[_,q]=d.useState(!1),N=Q({mutationFn:()=>fetch(`${v}/api/invoices`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:n,items:w,vatRate:j,taxEnabled:T,dueDate:Z||void 0,notes:G||void 0,clientId:C&&C!=="__manual__"?C:void 0,clientName:(C==="__manual__"||!C)&&M.trim()?M.trim():void 0})}).then(async i=>{const g=await i.json();if(!i.ok)throw new Error(g?.error?.message??g?.error??"خطأ في الخادم");return g}),onSuccess:i=>{$(i),o("success"),f()},onError:i=>p.error(i.message||"فشل إنشاء الفاتورة")}),P=()=>{o("form"),$(null),b(""),R(""),Y(""),I(""),y(""),B(!0),O(15),E([{description:"",quantity:1,unitPrice:0}])};return e.jsxs(e.Fragment,{children:[e.jsxs(x,{className:"gap-2 bg-primary hover:bg-primary/90 text-white",onClick:()=>l(!0),children:[e.jsx(ge,{className:"h-4 w-4"}),"فاتورة جديدة"]}),e.jsx(ws,{open:c,onOpenChange:l,children:e.jsxs(Ss,{className:"max-w-2xl max-h-[90vh] overflow-y-auto",dir:"rtl",size:"full",children:[e.jsx(xs,{children:e.jsxs(ps,{className:"flex items-center gap-2",children:[e.jsx(ve,{className:"h-5 w-5 text-primary"}),a==="success"?"تم إنشاء الفاتورة ✅":"إنشاء فاتورة جديدة"]})}),a==="success"&&S&&(()=>{const i=S.viewToken?`${window.location.origin}/invoice/${S.viewToken}`:null;return e.jsxs("div",{className:"space-y-5 pt-2",children:[e.jsxs("div",{className:"flex flex-col items-center gap-3 py-4 text-center",children:[e.jsx("div",{className:"h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center",children:e.jsx(z,{className:"h-8 w-8 text-green-500"})}),e.jsxs("div",{children:[e.jsxs("p",{className:"text-lg font-bold",children:["الفاتورة ",S.invoiceNumber]}),e.jsx("p",{className:"text-sm text-muted-foreground mt-1",children:S.title})]}),e.jsxs("div",{className:"text-2xl font-mono font-bold text-primary",children:[Number(S.total).toLocaleString("ar-SA",{minimumFractionDigits:2})," ",S.currency??"SAR"]})]}),i&&e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"text-sm font-semibold text-center",children:"رابط الفاتورة للعميل"}),e.jsxs("div",{className:"flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3",children:[e.jsx(De,{className:"h-4 w-4 text-primary shrink-0"}),e.jsx("span",{className:"text-xs text-muted-foreground truncate flex-1 font-mono select-all",children:i}),e.jsx("button",{onClick:()=>pe(i,()=>{q(!0),setTimeout(()=>q(!1),2e3)}),className:"shrink-0 text-muted-foreground hover:text-foreground transition-colors",children:_?e.jsx(z,{className:"h-4 w-4 text-green-500"}):e.jsx(re,{className:"h-4 w-4"})})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsx(x,{size:"sm",variant:"outline",className:"gap-1.5 text-xs",asChild:!0,children:e.jsxs("a",{href:i,target:"_blank",rel:"noopener noreferrer",children:[e.jsx(ts,{className:"h-3.5 w-3.5"}),"فتح الفاتورة"]})}),e.jsxs(x,{size:"sm",variant:"outline",className:"gap-1.5 text-xs",onClick:()=>pe(i,()=>{q(!0),setTimeout(()=>q(!1),2e3)}),children:[e.jsx(re,{className:"h-3.5 w-3.5"}),"نسخ الرابط"]})]}),e.jsx("p",{className:"text-xs text-muted-foreground text-center",children:"أرسل هذا الرابط للعميل — يمكنه عرض الفاتورة وطباعتها بدون تسجيل دخول"})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-2 pt-2",children:[e.jsxs(x,{variant:"outline",onClick:P,className:"gap-1.5",children:[e.jsx(ge,{className:"h-4 w-4"}),"فاتورة جديدة"]}),e.jsx(x,{onClick:()=>{l(!1),P()},className:"bg-primary text-white",children:"إغلاق"})]})]})})(),a==="form"&&e.jsxs("div",{className:"space-y-5 pt-2",children:[e.jsxs("div",{className:"grid grid-cols-2 gap-4 mobile-single-col",children:[e.jsxs("div",{className:"space-y-2 col-span-2",children:[e.jsx(K,{children:"عنوان الفاتورة *"}),e.jsx(L,{placeholder:"مثال: أتعاب قضية رقم 2025/123",value:n,onChange:i=>b(i.target.value)})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(K,{children:"العميل"}),s.length>0?e.jsxs(fe,{value:C,onValueChange:i=>{R(i),Y("")},children:[e.jsx(be,{children:e.jsx(je,{placeholder:"اختر من القائمة..."})}),e.jsxs(Ne,{children:[e.jsx(H,{value:"__manual__",children:"✏️ كتابة اسم يدوياً"}),s.map(i=>e.jsx(H,{value:String(i.id),children:i.fullName},i.id))]})]}):null,(C==="__manual__"||s.length===0)&&e.jsx(L,{placeholder:"اكتب اسم العميل...",value:M,onChange:i=>Y(i.target.value),className:"mt-1"})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(K,{children:"تاريخ الاستحقاق"}),e.jsx(L,{type:"date",value:Z,onChange:i=>I(i.target.value)})]}),e.jsxs("div",{className:"col-span-2 flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-3",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-medium",children:"ضريبة القيمة المضافة (VAT)"}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"تُطبَّق على إجمالي الفاتورة"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{type:"button",onClick:()=>B(i=>!i),className:`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${T?"bg-primary":"bg-muted"}`,children:e.jsx("span",{className:`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${T?"translate-x-4":"translate-x-0"}`})}),T&&e.jsxs(fe,{value:String(j),onValueChange:i=>O(Number(i)),children:[e.jsx(be,{className:"w-28 h-8 text-xs",children:e.jsx(je,{})}),e.jsxs(Ne,{children:[e.jsx(H,{value:"15",children:"15% — قياسية"}),e.jsx(H,{value:"5",children:"5%"}),e.jsx(H,{value:"0",children:"0% — معفى"})]})]})]})]})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx(K,{children:"بنود الفاتورة *"}),e.jsxs(x,{variant:"outline",size:"sm",onClick:ne,className:"gap-1 text-xs",children:[e.jsx(ge,{className:"h-3 w-3"}),"إضافة بند"]})]}),e.jsxs("div",{className:"grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1",children:[e.jsx("span",{className:"col-span-6",children:"البيان"}),e.jsx("span",{className:"col-span-2 text-center",children:"الكمية"}),e.jsx("span",{className:"col-span-3 text-center",children:"السعر (ر.س)"}),e.jsx("span",{className:"col-span-1"})]}),w.map((i,g)=>e.jsxs("div",{className:"grid grid-cols-12 gap-2 items-center",children:[e.jsx(L,{className:"col-span-6 text-sm",placeholder:"وصف الخدمة",value:i.description,onChange:D=>A(g,"description",D.target.value)}),e.jsx(L,{className:"col-span-2 text-sm text-center",type:"number",min:1,value:i.quantity,onChange:D=>A(g,"quantity",Number(D.target.value))}),e.jsx(L,{className:"col-span-3 text-sm text-center",type:"number",min:0,step:"0.01",placeholder:"0.00",value:i.unitPrice||"",onChange:D=>A(g,"unitPrice",Number(D.target.value))}),e.jsx(x,{variant:"ghost",size:"icon",className:"col-span-1 h-8 w-8 text-red-400",onClick:()=>W(g),disabled:w.length===1,children:e.jsx(ze,{className:"h-3.5 w-3.5"})})]},g))]}),e.jsxs("div",{className:"bg-muted/50 rounded-xl p-4 space-y-2",children:[e.jsxs("div",{className:"flex justify-between text-sm",children:[e.jsx("span",{className:"text-muted-foreground",children:"المجموع قبل الضريبة"}),e.jsxs("span",{className:"font-mono",children:[u(h)," ر.س"]})]}),T&&e.jsxs("div",{className:"flex justify-between text-sm",children:[e.jsxs("span",{className:"text-muted-foreground",children:["ضريبة القيمة المضافة (",j,"%)"]}),e.jsxs("span",{className:"font-mono",children:[u(U)," ر.س"]})]}),!T&&e.jsxs("div",{className:"flex justify-between text-xs text-muted-foreground/60",children:[e.jsx("span",{children:"بدون ضريبة"}),e.jsx("span",{children:"—"})]}),e.jsx(Te,{}),e.jsxs("div",{className:"flex justify-between font-bold text-base",children:[e.jsx("span",{children:"الإجمالي"}),e.jsxs("span",{className:"text-primary font-mono",children:[u(t)," ر.س"]})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(K,{children:"ملاحظات (اختياري)"}),e.jsx(hs,{placeholder:"شروط الدفع، تعليمات خاصة...",value:G,onChange:i=>y(i.target.value),rows:2})]}),e.jsxs(x,{className:"w-full bg-primary hover:bg-primary/90 text-white",onClick:()=>N.mutate(),disabled:!n||w.every(i=>!i.description.trim())||N.isPending,children:[N.isPending?e.jsx(J,{className:"h-4 w-4 animate-spin ms-2"}):e.jsx(ve,{className:"h-4 w-4 ms-2"}),"إنشاء الفاتورة"]})]})]})})]})}function Zs({invoice:s,open:f,onClose:c,onRefresh:l}){Ze();const{data:n}=gs(),[b,C]=d.useState(!1),[R,M]=d.useState(!1),Y=d.useMemo(()=>{try{return JSON.parse(s?.items||"[]")}catch{return[]}},[s]),Z=async()=>{if(s){C(!0);try{const m=await(await fetch(`${v}/api/invoices/${s.id}/payment-link`,{method:"POST"})).json();m.error?p.error(m.error):(p.success(m.existing?"تم استرجاع رابط الدفع ✅":"تم إنشاء رابط الدفع ✅"),l(),c())}catch{p.error("فشل إنشاء رابط الدفع")}C(!1)}},I=Q({mutationFn:()=>fetch(`${v}/api/invoices/${s.id}/mark-paid`,{method:"POST"}).then(r=>{if(!r.ok)throw new Error("خطأ في الخادم");return r.json()}),onSuccess:()=>{p.success("تم تسجيل الدفع ✅"),l(),c()}}),G=Q({mutationFn:r=>fetch(`${v}/api/invoices/${s.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:r})}).then(m=>{if(!m.ok)throw new Error("خطأ في الخادم");return m.json()}),onSuccess:()=>{p.success("تم تحديث الحالة ✅"),l()}}),y=()=>{const r=s?.stripePaymentLinkUrl;r&&pe(r,()=>{M(!0),setTimeout(()=>M(!1),2e3)})},[T,B]=d.useState(!1),[j,O]=d.useState(""),[w,E]=d.useState(!1),[ne,W]=d.useState(!1),[A,h]=d.useState(""),[U,t]=d.useState(!1),a=async()=>{if(!(!s||!A)){t(!0);try{const m=await(await fetch(`${v}/api/invoices/${s.id}/send-email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:A})})).json();m.success?(p.success("تم إرسال الفاتورة بالبريد الإلكتروني ✅"),W(!1),h("")):p.error(m.error?.message??m.error??"فشل الإرسال")}catch{p.error("تعذّر الاتصال بالخادم")}t(!1)}},[o,S]=d.useState(!1),$=()=>s?.viewToken?`${window.location.origin}/invoice/${s.viewToken}`:null,_=()=>{const r=$();r&&pe(r,()=>{S(!0),setTimeout(()=>S(!1),2e3)})},[q,N]=d.useState(!1),[P,i]=d.useState(""),[g,D]=d.useState("bank"),[ee,se]=d.useState(""),he={bank:"تحويل بنكي",cash:"نقداً",card:"بطاقة ائتمانية",cheque:"شيك",transfer:"حوالة",stripe:"Stripe",other:"أخرى"},{data:F,refetch:Oe}=Fe({queryKey:["invoice-payments",s?.id],queryFn:()=>fetch(`${v}/api/invoices/${s.id}/payments`).then(r=>r.json()),enabled:!!s?.id&&f}),we=Q({mutationFn:()=>fetch(`${v}/api/invoices/${s.id}/payments`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount:parseFloat(P),method:g,notes:ee||void 0})}).then(async r=>{const m=await r.json();if(!r.ok)throw new Error(m?.error?.message??"خطأ في الخادم");return m}),onSuccess:r=>{p.success(`تم تسجيل الدفعة ✅ — المتبقي: ${u(r.remaining)} ر.س`),N(!1),i(""),se(""),D("bank"),Oe(),l()},onError:r=>p.error(r.message||"فشل تسجيل الدفعة")}),as=Q({mutationFn:r=>fetch(`${v}/api/invoices/${s.id}/payments/${r}`,{method:"DELETE"}).then(m=>m.json()),onSuccess:()=>{p.success("تم حذف الدفعة"),Oe(),l()},onError:()=>p.error("فشل حذف الدفعة")}),Re=async r=>{if(!s)return;const m=$(),ie=`السلام عليكم،
يرجى سداد الفاتورة رقم ${s.invoiceNumber} بمبلغ ${u(s.total)} ر.س${s.stripePaymentLinkUrl?`
رابط الدفع: ${s.stripePaymentLinkUrl}`:""}${m?`
عرض الفاتورة: ${m}`:""}`;B(!0);try{const le=await(await fetch(`${v}/api/whatsapp/send`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:r,message:ie,template:"invoice"})})).json();le.ok?(p.success("تم إرسال إشعار الفاتورة عبر واتساب ✅"),E(!1),O("")):p.error(le.error||"فشل الإرسال — تحقق من إعدادات واتساب")}catch{p.error("تعذّر الاتصال بخدمة واتساب")}finally{B(!1)}},rs=()=>{s&&E(!0)},ns=()=>{if(!s)return;const r=s,m=(typeof r.items=="string"?JSON.parse(r.items||"[]"):r.items)??[],ie=m.reduce((k,de)=>k+Number(de.total??(de.quantity??1)*(de.unitPrice??0)),0),Se=Number(s.vatRate??15),le=parseFloat((ie*(Se/100)).toFixed(2)),is=Number(s.total??ie+le),te=s.status==="paid",ae=s.status==="overdue",Ie=s.createdAt?new Date(s.createdAt):new Date,ke=s.dueDate?new Date(s.dueDate):null,oe=k=>Number(k??0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}),Le=k=>k.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"}),Me=k=>k.toLocaleDateString("ar-SA-u-nu-latn",{day:"2-digit",month:"long",year:"numeric"}),ls=`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>فاتورة ضريبية / Tax Invoice — ${s.invoiceNumber??""}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Montserrat:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#1a1a2e;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* ═══ WATERMARK ═══ */
.watermark{
  position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
  font-size:88pt;font-weight:900;letter-spacing:4px;pointer-events:none;z-index:0;
  ${te?"color:rgba(16,185,129,0.07);content:'PAID'":ae?"color:rgba(239,68,68,0.07)":"color:rgba(201,168,76,0.05)"}
}

/* ═══ WRAPPER ═══ */
.page{
  width:210mm;min-height:297mm;margin:0 auto;position:relative;z-index:1;
  display:flex;flex-direction:column;
}

/* ═══ TOP ACCENT BAR ═══ */
.accent-bar{
  height:6px;
  background:linear-gradient(90deg,#FFFFFF 0%,#FFFFFF 40%,#2563EB 40%,#2563EB 60%,#FFFFFF 60%,#FFFFFF 100%);
}

/* ═══ HEADER ═══ */
.header{
  background:linear-gradient(135deg,#0f1c35 0%,#FFFFFF 60%,#243560 100%);
  padding:28px 32px 24px;
  display:flex;justify-content:space-between;align-items:flex-start;
  position:relative;overflow:hidden;
}
.header::before{
  content:'';position:absolute;top:-40px;left:-40px;
  width:180px;height:180px;border-radius:50%;
  background:rgba(201,168,76,0.08);
}
.header::after{
  content:'';position:absolute;bottom:-50px;right:10%;
  width:240px;height:240px;border-radius:50%;
  background:rgba(201,168,76,0.05);
}

.brand-block{position:relative;z-index:1}
.brand-ar{font-size:28pt;font-weight:900;color:#fff;line-height:1;letter-spacing:-0.5px}
.brand-ar span{color:#2563EB}
.brand-en{font-family:'Montserrat',Arial,sans-serif;font-size:10pt;font-weight:600;color:rgba(201,168,76,0.8);letter-spacing:3px;text-transform:uppercase;margin-top:3px}
.brand-tagline{font-size:8pt;color:rgba(255,255,255,0.45);margin-top:5px;font-weight:300}

.inv-badge{
  position:relative;z-index:1;text-align:left;
}
.inv-badge .inv-type-ar{font-size:16pt;font-weight:900;color:#2563EB;line-height:1.1}
.inv-badge .inv-type-en{font-family:'Montserrat',Arial,sans-serif;font-size:9pt;color:rgba(201,168,76,0.7);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.inv-badge .inv-num{
  background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);
  border-radius:6px;padding:6px 12px;display:inline-block;
  font-family:'Montserrat',Arial,sans-serif;font-size:11pt;font-weight:700;
  color:#fff;letter-spacing:1px;
}

/* ═══ STATUS RIBBON ═══ */
.status-ribbon{
  padding:8px 32px;
  display:flex;justify-content:space-between;align-items:center;
  font-family:'Montserrat',Arial,sans-serif;font-size:8.5pt;
  ${te?"background:#f0fdf4;border-bottom:2px solid #86efac;":ae?"background:#fef2f2;border-bottom:2px solid #fca5a5;":"background:#fffbf0;border-bottom:2px solid #2563EB40;"}
}
.status-ribbon .dates{display:flex;gap:24px;color:#555}
.status-ribbon .dates span{display:flex;align-items:center;gap:6px}
.status-ribbon .dates label{font-weight:700;color:#333}
.status-pill{
  display:flex;align-items:center;gap:7px;
  font-weight:700;font-size:9pt;padding:4px 14px;border-radius:20px;
  ${te?"background:#dcfce7;color:#15803d;border:1.5px solid #86efac;":ae?"background:#fee2e2;color:#b91c1c;border:1.5px solid #fca5a5;":"background:#fff7ed;color:#b45309;border:1.5px solid #fcd34d;"}
}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;
  ${te?"background:#22c55e":ae?"background:#ef4444":"background:#f59e0b"}
}

/* ═══ BODY ═══ */
.body{padding:22px 32px;flex:1}

/* ═══ PARTIES GRID ═══ */
.parties{display:grid;grid-template-columns:1fr 1px 1fr;gap:0;margin-bottom:20px;
  border:1px solid #e8e8e8;border-radius:10px;overflow:hidden}
.party{padding:16px 20px}
.party:first-child{background:#fafbfd}
.party-divider{background:#e8e8e8}
.party:last-child{background:#fff}
.party-label{
  font-size:7.5pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;
  color:#2563EB;margin-bottom:8px;display:flex;align-items:center;gap:5px;
}
.party-label .dot{width:5px;height:5px;border-radius:50%;background:#2563EB}
.party-name{font-size:13pt;font-weight:900;color:#FFFFFF;margin-bottom:4px}
.party-detail{font-size:9pt;color:#666;line-height:1.7}
.party-detail strong{color:#444}

/* ═══ TABLE ═══ */
.tbl-wrap{border-radius:10px;overflow:hidden;border:1px solid #e8e8e8;margin-bottom:20px}
table{width:100%;border-collapse:collapse}
.tbl-head{background:linear-gradient(90deg,#FFFFFF,#243560)}
th{
  padding:11px 14px;font-size:9pt;font-weight:700;color:#fff;
  text-align:right;
}
th.en{font-family:'Montserrat',Arial,sans-serif;font-size:7pt;color:rgba(201,168,76,0.8);font-weight:600;display:block;letter-spacing:1px}
td{padding:10px 14px;font-size:10pt;border-bottom:1px solid #f0f0f0;color:#333;text-align:right}
tr:last-child td{border-bottom:none}
tr:nth-child(even) td{background:#f9fafb}
td.idx{width:36px;color:#aaa;font-size:9pt;font-family:'Montserrat',Arial,sans-serif}
td.num{font-family:'Montserrat',Arial,sans-serif;font-weight:600;color:#FFFFFF}
td.desc-en{font-size:8pt;color:#aaa;font-family:'Montserrat',Arial,sans-serif}
td.service-cell .svc-ar{font-weight:700;color:#FFFFFF}
td.service-cell .svc-en{font-size:8pt;color:#aaa;font-family:'Montserrat',Arial,sans-serif;margin-top:2px}

/* ═══ BOTTOM ROW ═══ */
.bottom-row{display:grid;grid-template-columns:1fr 280px;gap:20px;margin-bottom:20px}

/* ═══ PAYMENT INFO ═══ */
.payment-box{
  border:1px solid #e8e8e8;border-radius:10px;padding:16px;
  display:flex;flex-direction:column;justify-content:space-between;
}
.payment-box h4{
  font-size:8pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;
  color:#2563EB;margin-bottom:10px;display:flex;align-items:center;gap:5px;
}
.payment-methods{display:flex;flex-wrap:wrap;gap:6px}
.pm-chip{
  padding:4px 10px;border-radius:20px;font-size:8pt;font-weight:600;
  background:#f4f4f5;color:#555;border:1px solid #e4e4e7;
  font-family:'Montserrat',Arial,sans-serif;
}
.pm-chip.primary{background:#FFFFFF;color:#2563EB;border-color:#FFFFFF}
.due-notice{
  margin-top:10px;padding:7px 10px;border-radius:6px;
  background:#fffbf0;border:1px dashed #2563EB60;
  font-size:8.5pt;color:#92400e;
}
.due-notice strong{color:#2563EB}

/* ═══ TOTALS ═══ */
.totals-box{border:1px solid #e8e8e8;border-radius:10px;overflow:hidden}
.tot-row{
  display:flex;justify-content:space-between;align-items:center;
  padding:10px 16px;border-bottom:1px solid #f0f0f0;
  font-size:10pt;
}
.tot-row:last-child{border-bottom:none}
.tot-row .lbl{color:#666}
.tot-row .lbl-en{font-family:'Montserrat',Arial,sans-serif;font-size:7.5pt;color:#aaa;display:block}
.tot-row .val{font-weight:700;color:#FFFFFF;font-family:'Montserrat',Arial,sans-serif;font-size:11pt}
.tot-row.vat .val{color:#555}
.tot-row.grand{background:linear-gradient(90deg,#FFFFFF,#243560);padding:14px 16px}
.tot-row.grand .lbl{color:rgba(255,255,255,0.8);font-weight:700;font-size:11pt}
.tot-row.grand .lbl-en{color:rgba(201,168,76,0.7)}
.tot-row.grand .val{color:#2563EB;font-size:15pt;font-weight:900}
.tot-row.grand .currency{font-size:10pt;font-weight:600;opacity:.8}

/* ═══ NOTES ═══ */
.notes-box{
  border:1px solid #e8e8e8;border-radius:10px;padding:14px 16px;
  margin-bottom:20px;background:#fafbfd;
}
.notes-box h4{font-size:8pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#2563EB;margin-bottom:6px}
.notes-box p{font-size:9.5pt;color:#555;line-height:1.7}

/* ═══ SIGNATURE ROW ═══ */
.sig-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px}
.sig-box{border-top:1.5px solid #d0d0d0;padding-top:8px}
.sig-box .sig-label{font-size:8pt;color:#aaa;font-weight:600;letter-spacing:1px}
.sig-box .sig-name{font-size:9.5pt;color:#444;margin-top:16px;font-weight:700}

/* ═══ FOOTER ═══ */
.footer-bar{
  background:linear-gradient(90deg,#0f1c35,#FFFFFF);
  padding:14px 32px;
  display:flex;justify-content:space-between;align-items:center;
  margin-top:auto;
}
.footer-bar .f-brand{color:#2563EB;font-weight:900;font-size:10pt}
.footer-bar .f-brand span{color:rgba(255,255,255,0.5);font-weight:400;font-size:8pt}
.footer-bar .f-meta{font-family:'Montserrat',Arial,sans-serif;font-size:7.5pt;color:rgba(255,255,255,0.4);text-align:left;line-height:1.7}

/* ═══ PRINT OVERRIDES ═══ */
@media print{
  body{margin:0}
  .page{width:100%;min-height:100vh}
  .no-print{display:none!important}
}
</style>
</head>
<body>

${te?'<div class="watermark">PAID ✓</div>':ae?'<div class="watermark">OVERDUE</div>':""}

<div class="page">

  <!-- TOP ACCENT -->
  <div class="accent-bar"></div>

  <!-- HEADER -->
  <div class="header">
    <div class="brand-block">
      ${n?.logoUrl?`<img src="${n.logoUrl}" alt="شعار المكتب" style="height:54px;width:auto;object-fit:contain;margin-bottom:6px;display:block;filter:brightness(0) invert(1)"/>`:""}
      <div class="brand-ar">${n?.officeName?`${n.officeName}`:"مكتب <span>المحاماة</span>"}</div>
      ${n?.officeNameEn?`<div class="brand-en">${n.officeNameEn}</div>`:""}
      ${n?.tagline?`<div class="brand-tagline">${n.tagline}</div>`:n?.licenseNo?`<div class="brand-tagline">رقم الترخيص: ${n.licenseNo}</div>`:""}
    </div>
    <div class="inv-badge">
      <div class="inv-type-ar">فاتورة ضريبية</div>
      <div class="inv-type-en">Tax Invoice</div>
      <div class="inv-num">${s.invoiceNumber??"INV-0000"}</div>
    </div>
  </div>

  <!-- STATUS RIBBON -->
  <div class="status-ribbon">
    <div class="dates">
      <span>
        <label>تاريخ الإصدار:</label>
        ${Me(Ie)} &nbsp;·&nbsp; ${Le(Ie)}
      </span>
      ${ke?`<span><label>تاريخ الاستحقاق / Due:</label> ${Me(ke)} &nbsp;·&nbsp; ${Le(ke)}</span>`:""}
    </div>
    <div class="status-pill">
      <div class="status-dot"></div>
      ${te?"مدفوعة / PAID":ae?"متأخرة / OVERDUE":"قيد الانتظار / PENDING"}
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- PARTIES -->
    <div class="parties">
      <div class="party">
        <div class="party-label"><div class="dot"></div> المُصدِر / ISSUED BY</div>
        <div class="party-name">${n?.officeName||"مكتب المحاماة"}</div>
        <div class="party-detail">
          ${n?.officeNameEn?`${n.officeNameEn}<br>`:""}
          ${n?.address?`<strong>📍</strong> ${n.address}<br>`:""}
          ${n?.phone?`<strong>📞</strong> ${n.phone}<br>`:""}
          ${n?.email?`<strong>✉</strong> ${n.email}<br>`:""}
          ${n?.website?`<strong>🌐</strong> ${n.website}<br>`:""}
          ${n?.licenseNo?`<strong>🪪</strong> رقم الترخيص: ${n.licenseNo}`:""}
        </div>
      </div>
      <div class="party-divider"></div>
      <div class="party">
        <div class="party-label"><div class="dot"></div> العميل / BILLED TO</div>
        <div class="party-name">${s.clientName??s.title??"—"}</div>
        <div class="party-detail">
          ${s.clientEmail?`<strong>✉</strong> ${s.clientEmail}<br>`:""}
          ${s.caseTitle?`<strong>⚖️</strong> القضية: ${s.caseTitle}`:""}
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <div class="tbl-wrap">
      <table>
        <thead class="tbl-head">
          <tr>
            <th style="width:36px">#</th>
            <th>الخدمة / Service <span class="en">DESCRIPTION</span></th>
            <th style="width:70px">الكمية <span class="en">QTY</span></th>
            <th style="width:120px">سعر الوحدة <span class="en">UNIT PRICE</span></th>
            <th style="width:130px">الإجمالي <span class="en">TOTAL</span></th>
          </tr>
        </thead>
        <tbody>
          ${m.length>0?m.map((k,de)=>{const Be=Number(k.quantity??1),Ue=Number(k.unitPrice??0),os=Number(k.total??Be*Ue);return`<tr>
                  <td class="idx">${de+1}</td>
                  <td class="service-cell">
                    <div class="svc-ar">${k.description??k.name??"—"}</div>
                    ${k.nameEn?`<div class="svc-en">${k.nameEn}</div>`:""}
                  </td>
                  <td class="num" style="text-align:center">${Be}</td>
                  <td class="num">${oe(Ue)} <small style="color:#aaa;font-size:8pt">SAR</small></td>
                  <td class="num">${oe(os)} <small style="color:#aaa;font-size:8pt">SAR</small></td>
                </tr>`}).join(""):`<tr><td colspan="5" style="text-align:center;padding:24px;color:#bbb;font-size:10pt">${s.title??"لا توجد بنود"}</td></tr>`}
        </tbody>
      </table>
    </div>

    <!-- BOTTOM ROW -->
    <div class="bottom-row">
      <!-- PAYMENT INFO -->
      <div class="payment-box">
        <div>
          <h4>💳 طرق الدفع / Payment Methods</h4>
          <div class="payment-methods">
            <span class="pm-chip primary">تحويل بنكي / Bank Transfer</span>
            <span class="pm-chip">بطاقة ائتمانية / Card</span>
            <span class="pm-chip">رابط دفع / Payment Link</span>
            <span class="pm-chip">مدى / MADA</span>
          </div>
        </div>
        <div class="due-notice">
          ⏰ الدفع مستحق خلال <strong>14 يوماً</strong> من تاريخ الإصدار<br>
          <span style="font-family:'Montserrat',Arial,sans-serif;font-size:7.5pt">Payment due within 14 days of issue</span>
        </div>
      </div>

      <!-- TOTALS -->
      <div class="totals-box">
        <div class="tot-row">
          <span class="lbl">المجموع قبل الضريبة<span class="lbl-en">Subtotal</span></span>
          <span class="val">${oe(ie)} <small class="currency">SAR</small></span>
        </div>
        <div class="tot-row vat">
          <span class="lbl">ضريبة القيمة المضافة (${Se}%)<span class="lbl-en">VAT</span></span>
          <span class="val">${oe(le)} <small class="currency">SAR</small></span>
        </div>
        <div class="tot-row grand">
          <span class="lbl">الإجمالي النهائي<span class="lbl-en">Grand Total</span></span>
          <span class="val">${oe(is)} <small class="currency">SAR</small></span>
        </div>
      </div>
    </div>

    ${s.notes?`
    <div class="notes-box">
      <h4>📋 ملاحظات / Notes</h4>
      <p>${s.notes}</p>
    </div>`:""}

    <!-- SIGNATURES -->
    <div class="sig-row">
      <div class="sig-box">
        ${n?.signatureUrl?`<img src="${n.signatureUrl}" alt="توقيع" style="height:56px;max-width:140px;object-fit:contain;margin-bottom:4px;display:block"/>`:'<div style="height:56px"></div>'}
        <div class="sig-label">توقيع المسؤول / Authorized Signature</div>
        <div class="sig-name">${n?.officeName||"&nbsp;"}</div>
      </div>
      <div class="sig-box">
        ${n?.stampUrl?`<img src="${n.stampUrl}" alt="ختم" style="height:60px;width:60px;object-fit:contain;margin:0 auto 4px;display:block"/>`:'<div style="height:60px"></div>'}
        <div class="sig-label">ختم المكتب / Office Stamp</div>
        <div class="sig-name">&nbsp;</div>
      </div>
      <div class="sig-box">
        <div style="height:60px"></div>
        <div class="sig-label">توقيع العميل / Client Signature</div>
        <div class="sig-name">&nbsp;</div>
      </div>
    </div>

  </div><!-- /body -->

  <!-- FOOTER -->
  <div class="footer-bar">
    <div class="f-brand">${n?.officeName||"مكتب المحاماة"} ${n?.showAdalalahFooter!==!1?"<span>· Adalah AI</span>":""}</div>
    <div class="f-meta">
      ${n?.website?`${n.website} &nbsp;·&nbsp; `:""}${n?.phone||""}${n?.email?` &nbsp;·&nbsp; ${n.email}`:""}<br>
      Generated: ${new Date().toLocaleDateString("en-GB")}${n?.licenseNo?` &nbsp;·&nbsp; رخصة: ${n.licenseNo}`:""}
    </div>
  </div>

</div><!-- /page -->

<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),600)})<\/script>
</body>
</html>`,Ce=window.open("","_blank","width=900,height=1100,scrollbars=yes");Ce&&(Ce.document.write(ls),Ce.document.close())};return s?e.jsx(ks,{open:f,onOpenChange:c,children:e.jsxs(Cs,{side:"left",className:"w-full sm:w-[560px] overflow-y-auto",dir:"rtl",children:[e.jsx($s,{className:"pb-4 border-b border-border/40",children:e.jsxs("div",{className:"flex items-start justify-between gap-3",children:[e.jsxs("div",{children:[e.jsx(Fs,{className:"text-base font-bold",children:s.invoiceNumber}),e.jsx("p",{className:"text-sm text-muted-foreground mt-0.5",children:s.title})]}),e.jsx(Pe,{status:s.status})]})}),e.jsxs("div",{className:"space-y-5 pt-5",children:[e.jsxs("div",{className:"bg-primary/10 border border-primary/20 rounded-xl p-4 text-center",children:[e.jsx("p",{className:"text-xs text-muted-foreground mb-1",children:"المبلغ الإجمالي"}),e.jsx("p",{className:"text-3xl font-bold text-primary font-mono",children:u(s.total)}),e.jsx("p",{className:"text-sm text-muted-foreground mt-0.5",children:"ريال سعودي"})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3 text-sm",children:[e.jsxs("div",{className:"bg-muted/30 rounded-lg p-3",children:[e.jsx("p",{className:"text-xs text-muted-foreground mb-0.5",children:"تاريخ الإنشاء"}),e.jsx("p",{className:"font-medium",children:X(s.createdAt)})]}),e.jsxs("div",{className:"bg-muted/30 rounded-lg p-3",children:[e.jsx("p",{className:"text-xs text-muted-foreground mb-0.5",children:"تاريخ الاستحقاق"}),e.jsx("p",{className:"font-medium",children:X(s.dueDate)})]}),s.paidAt&&e.jsxs("div",{className:"bg-green-500/10 rounded-lg p-3 col-span-2",children:[e.jsx("p",{className:"text-xs text-green-400 mb-0.5",children:"تاريخ السداد"}),e.jsx("p",{className:"font-medium text-green-400",children:X(s.paidAt)})]})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-semibold mb-2",children:"بنود الفاتورة"}),e.jsx("div",{className:"border border-border/40 rounded-xl overflow-hidden overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm min-w-[340px]",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-border/40 bg-muted/30",children:[e.jsx("th",{className:"p-3 text-right text-xs text-muted-foreground",children:"البيان"}),e.jsx("th",{className:"p-3 text-center text-xs text-muted-foreground w-16",children:"كمية"}),e.jsx("th",{className:"p-3 text-center text-xs text-muted-foreground w-24",children:"سعر"}),e.jsx("th",{className:"p-3 text-left text-xs text-muted-foreground w-28",children:"الإجمالي"})]})}),e.jsx("tbody",{children:Y.map((r,m)=>e.jsxs("tr",{className:"border-b border-border/20",children:[e.jsx("td",{className:"p-3",children:r.description||"—"}),e.jsx("td",{className:"p-3 text-center text-muted-foreground",children:r.quantity}),e.jsx("td",{className:"p-3 text-center text-muted-foreground font-mono",children:u(r.unitPrice)}),e.jsx("td",{className:"p-3 text-left font-mono",children:u(r.quantity*r.unitPrice)})]},m))}),e.jsxs("tfoot",{children:[e.jsxs("tr",{className:"border-t border-border/40",children:[e.jsx("td",{colSpan:3,className:"p-3 text-right text-xs text-muted-foreground",children:"قبل الضريبة"}),e.jsx("td",{className:"p-3 text-left font-mono text-sm",children:u(s.subtotal)})]}),e.jsxs("tr",{children:[e.jsxs("td",{colSpan:3,className:"p-3 text-right text-xs text-muted-foreground",children:["ضريبة ",s.vatRate,"%"]}),e.jsx("td",{className:"p-3 text-left font-mono text-sm",children:u(s.vatAmount)})]}),e.jsxs("tr",{className:"bg-muted/20",children:[e.jsx("td",{colSpan:3,className:"p-3 text-right font-bold text-sm",children:"الإجمالي"}),e.jsx("td",{className:"p-3 text-left font-bold font-mono text-sm text-primary",children:u(s.total)})]})]})]})})]}),s.notes&&e.jsxs("div",{className:"bg-muted/30 rounded-xl p-3",children:[e.jsx("p",{className:"text-xs text-muted-foreground mb-1",children:"ملاحظات"}),e.jsx("p",{className:"text-sm",children:s.notes})]}),e.jsx(Te,{}),$()&&e.jsxs("div",{className:"space-y-2",children:[e.jsxs("p",{className:"text-xs font-semibold text-muted-foreground flex items-center gap-1.5",children:[e.jsx(De,{className:"h-3.5 w-3.5 text-primary"}),"رابط الفاتورة للعميل"]}),e.jsxs("div",{className:"flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5",children:[e.jsx("span",{className:"text-xs text-muted-foreground truncate flex-1 font-mono select-all",children:$()}),e.jsx("button",{onClick:_,className:"shrink-0 text-muted-foreground hover:text-foreground transition-colors",children:o?e.jsx(z,{className:"h-4 w-4 text-green-500"}):e.jsx(re,{className:"h-4 w-4"})})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsx(x,{size:"sm",variant:"outline",className:"gap-1.5 text-xs",asChild:!0,children:e.jsxs("a",{href:$(),target:"_blank",rel:"noopener noreferrer",children:[e.jsx(ts,{className:"h-3.5 w-3.5"}),"فتح الفاتورة"]})}),e.jsxs(x,{size:"sm",variant:"outline",className:"gap-1.5 text-xs",onClick:_,children:[e.jsx(re,{className:"h-3.5 w-3.5"}),"نسخ الرابط"]})]})]}),s.stripePaymentLinkUrl?e.jsxs("div",{className:"space-y-2",children:[e.jsxs("p",{className:"text-xs font-semibold text-muted-foreground flex items-center gap-1.5",children:[e.jsx(Ae,{className:"h-3.5 w-3.5 text-green-500"}),"رابط الدفع الإلكتروني (Stripe)"]}),e.jsxs("div",{className:"flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-xl px-3 py-2.5",children:[e.jsx("span",{className:"text-xs text-green-400 truncate flex-1 font-mono",children:s.stripePaymentLinkUrl.replace("https://","")}),e.jsx("button",{onClick:y,className:"shrink-0 text-muted-foreground hover:text-foreground transition-colors",children:R?e.jsx(z,{className:"h-4 w-4 text-green-500"}):e.jsx(re,{className:"h-4 w-4"})})]})]}):s.status!=="paid"&&s.status!=="cancelled"&&e.jsxs(x,{variant:"outline",size:"sm",className:"w-full gap-2 text-xs",onClick:Z,disabled:b,children:[b?e.jsx(J,{className:"h-3.5 w-3.5 animate-spin"}):e.jsx(Ae,{className:"h-3.5 w-3.5"}),b?"جاري الإنشاء...":"إنشاء رابط دفع Stripe"]}),s.status!=="cancelled"&&e.jsxs("div",{className:"space-y-3 pt-1",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("p",{className:"text-sm font-semibold flex items-center gap-1.5",children:[e.jsx(Ee,{className:"h-4 w-4 text-primary"}),"سجل الدفعات"]}),s.status!=="paid"&&e.jsxs(x,{size:"sm",variant:"outline",className:"gap-1.5 text-xs text-primary border-primary/30 h-7 px-2.5",onClick:()=>N(r=>!r),children:[e.jsx(ge,{className:"h-3 w-3"}),"تسجيل دفعة"]})]}),F&&e.jsxs("div",{className:"space-y-1.5",children:[e.jsxs("div",{className:"flex justify-between text-xs text-muted-foreground",children:[e.jsxs("span",{children:["المدفوع: ",e.jsxs("span",{className:"font-mono text-foreground",children:[u(F.amountPaid)," ر.س"]})]}),e.jsxs("span",{children:["المتبقي: ",e.jsxs("span",{className:`font-mono ${F.remaining>0?"text-amber-400":"text-green-400"}`,children:[u(F.remaining)," ر.س"]})]})]}),e.jsx("div",{className:"h-2 bg-muted/50 rounded-full overflow-hidden",children:e.jsx("div",{className:`h-full rounded-full transition-all ${F.remaining<=0?"bg-green-500":"bg-primary"}`,style:{width:`${Math.min(100,F.amountPaid/F.total*100)}%`}})})]}),q&&s.status!=="paid"&&e.jsxs("div",{className:"border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3",children:[e.jsx("p",{className:"text-xs font-semibold text-primary",children:"تسجيل دفعة جديدة"}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsxs("div",{className:"space-y-1",children:[e.jsx(K,{className:"text-xs",children:"المبلغ (ر.س)"}),e.jsx(L,{type:"number",step:"0.01",min:"0.01",placeholder:F?u(F.remaining):"0.00",value:P,onChange:r=>i(r.target.value),className:"h-8 text-sm"})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx(K,{className:"text-xs",children:"طريقة الدفع"}),e.jsxs(fe,{value:g,onValueChange:D,children:[e.jsx(be,{className:"h-8 text-xs",children:e.jsx(je,{})}),e.jsx(Ne,{children:Object.entries(he).map(([r,m])=>e.jsx(H,{value:r,className:"text-xs",children:m},r))})]})]}),e.jsxs("div",{className:"col-span-2 space-y-1",children:[e.jsx(K,{className:"text-xs",children:"ملاحظات (اختياري)"}),e.jsx(L,{placeholder:"رقم المرجع، التحويل...",value:ee,onChange:r=>se(r.target.value),className:"h-8 text-sm"})]})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs(x,{size:"sm",className:"flex-1 gap-1.5 text-xs bg-primary hover:bg-primary/90",onClick:()=>we.mutate(),disabled:!P||isNaN(parseFloat(P))||parseFloat(P)<=0||we.isPending,children:[we.isPending?e.jsx(J,{className:"h-3 w-3 animate-spin"}):e.jsx(z,{className:"h-3 w-3"}),"تأكيد الدفعة"]}),e.jsx(x,{size:"sm",variant:"ghost",className:"text-xs",onClick:()=>{N(!1),i(""),se("")},children:"إلغاء"})]})]}),F?.payments&&F.payments.length>0?e.jsx("div",{className:"space-y-1.5 max-h-48 overflow-y-auto",children:F.payments.map(r=>e.jsxs("div",{className:"flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2",children:[e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("span",{className:"text-xs font-mono font-semibold text-green-400",children:[u(r.amount)," ر.س"]}),e.jsx(ue,{variant:"outline",className:"text-[10px] h-4 px-1.5",children:he[r.method]??r.method})]}),e.jsxs("p",{className:"text-[11px] text-muted-foreground mt-0.5",children:[X(r.paidAt),r.notes&&` · ${r.notes}`]})]}),e.jsx(x,{variant:"ghost",size:"icon",className:"h-6 w-6 text-red-400/60 hover:text-red-400 shrink-0",onClick:()=>{window.confirm("حذف هذه الدفعة؟")&&as.mutate(r.id)},children:e.jsx(ze,{className:"h-3 w-3"})})]},r.id))}):F&&e.jsx("p",{className:"text-xs text-muted-foreground text-center py-2",children:"لا توجد دفعات مسجّلة"})]}),e.jsx(Te,{}),e.jsxs("div",{className:"grid grid-cols-2 sm:grid-cols-4 gap-2",children:[s.status!=="paid"&&e.jsxs(x,{size:"sm",variant:"outline",className:"gap-1.5 text-xs text-green-400 border-green-500/30",onClick:()=>I.mutate(),disabled:I.isPending,children:[I.isPending?e.jsx(J,{className:"h-3 w-3 animate-spin"}):e.jsx(z,{className:"h-3.5 w-3.5"}),"مدفوعة"]}),e.jsxs(x,{size:"sm",variant:"outline",className:"gap-1.5 text-xs",onClick:rs,children:[e.jsx(We,{className:"h-3.5 w-3.5 text-green-500"}),"واتساب"]}),e.jsxs(x,{size:"sm",variant:"outline",className:"gap-1.5 text-xs",onClick:()=>{W(r=>!r),E(!1)},children:[e.jsx(xe,{className:"h-3.5 w-3.5 text-blue-500"}),"بريد"]}),e.jsxs(x,{size:"sm",variant:"outline",className:"gap-1.5 text-xs",onClick:ns,children:[e.jsx(Ks,{className:"h-3.5 w-3.5"}),"طباعة"]})]}),ne&&e.jsxs("div",{className:"border border-blue-500/30 bg-blue-500/5 rounded-xl p-4 space-y-3",children:[e.jsxs("p",{className:"text-sm font-medium text-blue-400 flex items-center gap-2",children:[e.jsx(xe,{className:"h-4 w-4"}),"إرسال الفاتورة بالبريد الإلكتروني"]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("input",{dir:"ltr",type:"email",className:"flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background placeholder:text-muted-foreground",placeholder:"client@example.com",value:A,onChange:r=>h(r.target.value),onKeyDown:r=>r.key==="Enter"&&A&&a()}),e.jsxs(x,{size:"sm",className:"gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shrink-0",onClick:a,disabled:!A||U,children:[U?e.jsx(J,{className:"h-3.5 w-3.5 animate-spin"}):e.jsx(xe,{className:"h-3.5 w-3.5"}),"إرسال"]}),e.jsx(x,{size:"sm",variant:"ghost",onClick:()=>{W(!1),h("")},children:"✕"})]}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"سيستلم العميل الفاتورة كاملة مع رابط العرض"})]}),w&&e.jsxs("div",{className:"border border-green-500/30 bg-green-500/5 rounded-xl p-4 space-y-3",children:[e.jsxs("p",{className:"text-sm font-medium text-green-400 flex items-center gap-2",children:[e.jsx(We,{className:"h-4 w-4"}),"إرسال الفاتورة عبر واتساب"]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("input",{dir:"ltr",className:"flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background placeholder:text-muted-foreground",placeholder:"+966501234567 أو 0501234567",value:j,onChange:r=>O(r.target.value),onKeyDown:r=>r.key==="Enter"&&j&&Re(j)}),e.jsxs(x,{size:"sm",className:"gap-1.5 bg-green-600 hover:bg-green-700 text-white shrink-0",onClick:()=>Re(j),disabled:!j||T,children:[T?e.jsx(J,{className:"h-3.5 w-3.5 animate-spin"}):e.jsx(xe,{className:"h-3.5 w-3.5"}),"إرسال"]}),e.jsx(x,{size:"sm",variant:"ghost",onClick:()=>{E(!1),O("")},children:"✕"})]}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"سيتم إرسال تفاصيل الفاتورة ورابط الدفع تلقائياً"})]}),s.status!=="paid"&&e.jsxs("div",{className:"pt-2 border-t border-border/40",children:[e.jsx("p",{className:"text-xs text-muted-foreground mb-2",children:"تغيير الحالة"}),e.jsx("div",{className:"flex gap-2 flex-wrap",children:Object.entries(ye).filter(([r])=>r!==s.status&&r!=="paid").map(([r,m])=>e.jsx(x,{size:"sm",variant:"ghost",className:`text-xs h-7 px-3 ${m.cls} border`,onClick:()=>G.mutate(r),disabled:G.isPending,children:m.label},r))})]})]})]})}):null}function Nt(){const s=Ze(),[f,c]=d.useState(null),[l,n]=d.useState(!1),[b,C]=d.useState(""),[R,M]=d.useState("all"),[Y,Z]=d.useState([{id:"createdAt",desc:!0}]),[I,G]=d.useState({}),{data:y=[],isLoading:T}=Fe({queryKey:["invoices"],queryFn:async()=>{const t=await fetch(`${v}/api/invoices?limit=200`);if(!t.ok)throw new Error("خطأ في الخادم");const a=await t.json();return Array.isArray(a)?a:a?.data??[]}}),{data:B=[]}=Fe({queryKey:["clients-list"],queryFn:()=>fetch(`${v}/api/clients`).then(t=>{if(!t.ok)throw new Error("خطأ في الخادم");return t.json()})}),j=()=>s.invalidateQueries({queryKey:["invoices"]}),O=d.useMemo(()=>y.filter(t=>{const a=!b||t.invoiceNumber?.toLowerCase().includes(b.toLowerCase())||t.title?.toLowerCase().includes(b.toLowerCase()),o=R==="all"||t.status===R;return a&&o}),[y,b,R]),w=d.useMemo(()=>{const t=y.length,a=y.filter(N=>N.status==="paid"),o=y.filter(N=>["sent","draft"].includes(N.status)),S=y.filter(N=>N.status==="overdue"),$=a.reduce((N,P)=>N+P.total,0),_=o.concat(S).reduce((N,P)=>N+P.total,0),q=t>0?Math.round(a.length/t*100):0;return{total:t,paidCount:a.length,pendingCount:o.length,overdueCount:S.length,revenue:$,outstanding:_,rate:q}},[y]),E=Q({mutationFn:async t=>{const a=await fetch(`${v}/api/invoices/${t}`,{method:"DELETE"}),o=await a.json();if(!a.ok||o?.error?.code==="HAS_PAYMENTS")throw new Error(o?.error?.message??"فشل الحذف");return o},onSuccess:()=>{p.success("تم حذف الفاتورة"),j()},onError:t=>p.error(t.message||"فشل الحذف")}),ne=async t=>{try{const o=await(await fetch(`${v}/api/invoices/${t.id}/payment-link`,{method:"POST"})).json();o.error?p.error(o.error):(p.success("تم إنشاء رابط الدفع ✅"),j())}catch{p.error("فشل إنشاء الرابط")}},W=Q({mutationFn:t=>fetch(`${v}/api/invoices/${t}/mark-paid`,{method:"POST"}).then(a=>{if(!a.ok)throw new Error("خطأ في الخادم");return a.json()}),onSuccess:()=>{p.success("تم تسجيل الدفع ✅"),j()}}),A=[{id:"select",header:({table:t})=>e.jsx(Ve,{checked:t.getIsAllPageRowsSelected(),onCheckedChange:a=>t.toggleAllPageRowsSelected(!!a),"aria-label":"تحديد الكل",className:"translate-y-px"}),cell:({row:t})=>e.jsx(Ve,{checked:t.getIsSelected(),onCheckedChange:a=>t.toggleSelected(!!a),"aria-label":"تحديد",className:"translate-y-px",onClick:a=>a.stopPropagation()}),enableSorting:!1},{accessorKey:"invoiceNumber",header:"رقم الفاتورة",cell:({getValue:t})=>e.jsx("span",{className:"font-mono text-xs text-muted-foreground",children:t()})},{accessorKey:"title",header:({column:t})=>e.jsxs(x,{variant:"ghost",size:"sm",className:"gap-1 -me-3 text-xs h-8",onClick:()=>t.toggleSorting(t.getIsSorted()==="asc"),children:["العنوان",t.getIsSorted()==="asc"?e.jsx(He,{className:"h-3 w-3"}):t.getIsSorted()==="desc"?e.jsx(Ye,{className:"h-3 w-3"}):e.jsx(Ge,{className:"h-3 w-3 opacity-40"})]}),cell:({getValue:t})=>e.jsx("span",{className:"font-medium text-sm max-w-[180px] truncate block",children:t()})},{accessorKey:"total",header:({column:t})=>e.jsxs(x,{variant:"ghost",size:"sm",className:"gap-1 -me-3 text-xs h-8",onClick:()=>t.toggleSorting(t.getIsSorted()==="asc"),children:["المبلغ",t.getIsSorted()==="asc"?e.jsx(He,{className:"h-3 w-3"}):t.getIsSorted()==="desc"?e.jsx(Ye,{className:"h-3 w-3"}):e.jsx(Ge,{className:"h-3 w-3 opacity-40"})]}),cell:({getValue:t})=>e.jsxs("span",{className:"font-mono text-sm font-semibold text-primary",children:[u(t())," ",e.jsx("span",{className:"text-xs text-muted-foreground",children:"ر.س"})]})},{accessorKey:"status",header:"الحالة",cell:({getValue:t})=>e.jsx(Pe,{status:t()})},{accessorKey:"dueDate",header:"الاستحقاق",cell:({getValue:t})=>{const a=t();if(!a)return e.jsx("span",{className:"text-muted-foreground text-xs",children:"—"});const o=new Date(a)<new Date;return e.jsx("span",{className:`text-xs ${o?"text-red-400":"text-muted-foreground"}`,children:X(a)})}},{id:"payment",header:"الدفع",cell:({row:t})=>{const a=t.original;return a.stripePaymentLinkUrl?e.jsxs(ue,{variant:"outline",className:"text-xs gap-1 bg-green-500/10 text-green-400 border-green-500/20",children:[e.jsx(De,{className:"h-3 w-3"}),"رابط نشط"]}):a.status==="paid"?e.jsxs(ue,{variant:"outline",className:"text-xs gap-1 bg-green-500/10 text-green-400 border-green-500/20",children:[e.jsx(z,{className:"h-3 w-3"}),"مدفوعة"]}):e.jsx("span",{className:"text-xs text-muted-foreground",children:"—"})}},{accessorKey:"createdAt",header:"تاريخ الإنشاء",cell:({getValue:t})=>e.jsx("span",{className:"text-xs text-muted-foreground",children:X(t())})},{id:"actions",header:"",cell:({row:t})=>{const a=t.original;return e.jsxs(ds,{children:[e.jsx(cs,{asChild:!0,children:e.jsx(x,{variant:"ghost",size:"icon",className:"h-7 w-7",onClick:o=>o.stopPropagation(),children:e.jsx(Bs,{className:"h-4 w-4"})})}),e.jsxs(ms,{align:"start",className:"w-48",children:[e.jsxs(V,{onClick:o=>{o.stopPropagation(),c(a),n(!0)},children:[e.jsx(Us,{className:"h-4 w-4 ms-2"}),"عرض التفاصيل"]}),!a.stripePaymentLinkUrl&&a.status!=="paid"&&a.status!=="cancelled"&&e.jsxs(V,{onClick:o=>{o.stopPropagation(),ne(a)},children:[e.jsx(Ae,{className:"h-4 w-4 ms-2"}),"إنشاء رابط دفع"]}),a.stripePaymentLinkUrl&&e.jsxs(V,{onClick:o=>{o.stopPropagation(),pe(a.stripePaymentLinkUrl)},children:[e.jsx(re,{className:"h-4 w-4 ms-2"}),"نسخ رابط الدفع"]}),a.status!=="paid"&&e.jsxs(V,{onClick:o=>{o.stopPropagation(),W.mutate(a.id)},children:[e.jsx(z,{className:"h-4 w-4 ms-2 text-green-500"}),"تسجيل كمدفوعة"]}),e.jsx(_e,{}),a.status!=="draft"&&e.jsxs(V,{onClick:o=>{o.stopPropagation(),window.open(`${v}/api/invoices/${a.id}/revisions`,"_blank")},children:[e.jsx(_s,{className:"h-4 w-4 ms-2"}),"سجل التعديلات"]}),a.status!=="draft"&&a.status!=="cancelled"&&e.jsxs(V,{onClick:async o=>{o.stopPropagation();const S=window.prompt("سبب إشعار الدائن:");if(!S)return;const $=await fetch(`${v}/api/invoices/${a.id}/credit-note`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:S,fullCredit:!0})});if($.ok)alert("تم إصدار إشعار الدائن بنجاح");else{const _=await $.json();alert("خطأ: "+(_.error??"فشل"))}},children:[e.jsx(qs,{className:"h-4 w-4 ms-2 text-amber-400"}),"إشعار دائن"]}),a.zatca_uuid?e.jsxs(V,{onClick:o=>{o.stopPropagation(),window.open(`${v}/api/invoices/${a.id}/zatca`,"_blank")},children:[e.jsx(Vs,{className:"h-4 w-4 ms-2"}),"بيانات ZATCA"]}):null,e.jsx(_e,{}),e.jsxs(V,{className:"text-red-400 focus:text-red-400",onClick:o=>{o.stopPropagation(),window.confirm("هل تريد حذف الفاتورة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")&&E.mutate(a.id)},children:[e.jsx(ze,{className:"h-4 w-4 ms-2"}),"حذف"]})]})]})}}],h=us({data:O,columns:A,state:{sorting:Y,rowSelection:I},onSortingChange:Z,onRowSelectionChange:G,getCoreRowModel:Ns(),getSortedRowModel:js(),getFilteredRowModel:bs(),getPaginationRowModel:fs(),initialState:{pagination:{pageSize:10}}}),U=Object.keys(I).length;return e.jsxs("div",{className:"space-y-5 max-w-7xl",children:[e.jsxs("div",{className:"flex flex-wrap items-start justify-between gap-3",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-bold tracking-tight",children:"الفواتير"}),e.jsx("p",{className:"text-muted-foreground text-sm mt-0.5",children:"إدارة الفواتير والتحصيل عبر Stripe — مدى · Visa · Mastercard · Apple Pay · Google Pay"})]}),e.jsx(Xe,{clients:B,onCreated:j})]}),e.jsx("div",{className:"grid grid-cols-2 md:grid-cols-5 gap-3",children:[{label:"إجمالي الفواتير",value:w.total,icon:ve,color:"text-primary",bg:"bg-primary/5"},{label:"المحصّلة",value:w.paidCount,icon:z,color:"text-green-400",bg:"bg-green-500/5"},{label:"في الانتظار",value:w.pendingCount,icon:Ds,color:"text-amber-400",bg:"bg-amber-500/5"},{label:"المتأخرة",value:w.overdueCount,icon:es,color:"text-red-400",bg:"bg-red-500/5"},{label:"معدل التحصيل",value:`${w.rate}%`,icon:ss,color:"text-blue-400",bg:"bg-blue-500/5"}].map(t=>{const a=t.icon;return e.jsx(ce,{className:`border-0 ${t.bg}`,children:e.jsx(me,{className:"p-4",children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(a,{className:`h-5 w-5 ${t.color} shrink-0`}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-muted-foreground leading-tight",children:t.label}),e.jsx("p",{className:`text-xl font-bold font-mono ${t.color}`,children:t.value})]})]})})},t.label)})}),e.jsxs("div",{className:"grid md:grid-cols-3 gap-4",children:[e.jsx("div",{className:"md:col-span-2",children:e.jsx(Xs,{invoices:y})}),e.jsxs("div",{className:"space-y-3",children:[e.jsx(ce,{className:"border-primary/20 bg-primary/5",children:e.jsxs(me,{className:"p-4",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-1",children:[e.jsx(z,{className:"h-4 w-4 text-primary"}),e.jsx("span",{className:"text-xs text-muted-foreground",children:"الإيرادات المحصّلة"})]}),e.jsx("p",{className:"text-2xl font-bold text-primary font-mono",children:u(w.revenue)}),e.jsx("p",{className:"text-xs text-muted-foreground mt-0.5",children:"ريال سعودي"})]})}),w.outstanding>0&&e.jsx(ce,{className:"border-amber-500/20 bg-amber-500/5",children:e.jsxs(me,{className:"p-4",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-1",children:[e.jsx(Ee,{className:"h-4 w-4 text-amber-400"}),e.jsx("span",{className:"text-xs text-muted-foreground",children:"مستحقات غير محصّلة"})]}),e.jsx("p",{className:"text-2xl font-bold text-amber-400 font-mono",children:u(w.outstanding)}),e.jsx("p",{className:"text-xs text-muted-foreground mt-0.5",children:"ريال سعودي"})]})})]})]}),e.jsxs("div",{className:"flex gap-3 flex-wrap",children:[e.jsxs("div",{className:"relative flex-1 min-w-[200px]",children:[e.jsx(zs,{className:"absolute right-3 top-2.5 h-4 w-4 text-muted-foreground"}),e.jsx(L,{placeholder:"بحث برقم الفاتورة أو العنوان...",value:b,onChange:t=>C(t.target.value),className:"pe-9"})]}),e.jsxs(fe,{value:R,onValueChange:M,children:[e.jsxs(be,{className:"w-[150px] gap-2",children:[e.jsx(Os,{className:"h-3.5 w-3.5 text-muted-foreground"}),e.jsx(je,{})]}),e.jsxs(Ne,{children:[e.jsx(H,{value:"all",children:"جميع الحالات"}),Object.entries(ye).map(([t,a])=>e.jsx(H,{value:t,children:a.label},t))]})]}),U>0&&e.jsx("div",{className:"flex items-center gap-2 bg-primary/10 rounded-lg px-3 text-sm text-primary",children:e.jsxs("span",{children:[U," محدد"]})})]}),e.jsx(ce,{className:"overflow-hidden",children:T?e.jsx("div",{className:"flex items-center justify-center h-48",children:e.jsx(J,{className:"h-8 w-8 animate-spin text-primary"})}):y.length===0?e.jsxs(me,{className:"flex flex-col items-center justify-center py-20 gap-3",children:[e.jsx(ve,{className:"h-14 w-14 text-muted-foreground/20"}),e.jsx("p",{className:"text-muted-foreground",children:"لا توجد فواتير بعد"}),e.jsx(Xe,{clients:B,onCreated:j})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"md:hidden divide-y",children:h.getRowModel().rows.length===0?e.jsx("p",{className:"text-center py-10 text-muted-foreground text-sm",children:"لا توجد نتائج مطابقة"}):h.getRowModel().rows.map(t=>{const a=t.original;return e.jsx("button",{className:"w-full text-right p-4 hover:bg-muted/30 transition-colors block",onClick:()=>{c(a),n(!0)},children:e.jsxs("div",{className:"flex items-start justify-between gap-3",children:[e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-1",children:[e.jsx("span",{className:"font-mono text-[11px] text-muted-foreground",children:a.invoiceNumber}),e.jsx(Pe,{status:a.status})]}),e.jsx("p",{className:"text-sm font-medium truncate",children:a.title}),e.jsx("div",{className:"flex items-center gap-3 mt-1.5 text-xs text-muted-foreground",children:a.dueDate&&e.jsxs("span",{className:new Date(a.dueDate)<new Date&&a.status!=="paid"?"text-red-400":"",children:["استحقاق: ",X(a.dueDate)]})})]}),e.jsxs("div",{className:"text-left flex-shrink-0",children:[e.jsx("p",{className:"font-mono font-bold text-primary text-base",children:u(a.total)}),e.jsx("p",{className:"text-[11px] text-muted-foreground text-left",children:"ر.س"})]})]})},a.id)})}),e.jsx("div",{className:"hidden md:block overflow-x-auto w-full",children:e.jsxs(Ts,{dir:"rtl",children:[e.jsx(As,{children:h.getHeaderGroups().map(t=>e.jsx($e,{className:"border-border/40 hover:bg-transparent",children:t.headers.map(a=>e.jsx(Ps,{className:"text-right text-xs",children:a.isPlaceholder?null:qe(a.column.columnDef.header,a.getContext())},a.id))},t.id))}),e.jsx(Es,{children:h.getRowModel().rows.length===0?e.jsx($e,{children:e.jsx(Ke,{colSpan:A.length,className:"text-center py-12 text-muted-foreground",children:"لا توجد نتائج مطابقة"})}):h.getRowModel().rows.map(t=>e.jsx($e,{className:"border-border/30 hover:bg-muted/30 cursor-pointer transition-colors",onClick:()=>{c(t.original),n(!0)},"data-state":t.getIsSelected()?"selected":void 0,children:t.getVisibleCells().map(a=>e.jsx(Ke,{className:"py-3",children:qe(a.column.columnDef.cell,a.getContext())},a.id))},t.id))})]})}),e.jsxs("div",{className:"flex items-center justify-between px-4 py-3 border-t border-border/40",children:[e.jsxs("p",{className:"text-xs text-muted-foreground",children:[O.length," فاتورة",O.length!==y.length&&` (من ${y.length})`]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(x,{variant:"outline",size:"icon",className:"h-7 w-7",onClick:()=>h.previousPage(),disabled:!h.getCanPreviousPage(),children:e.jsx(Ls,{className:"h-4 w-4"})}),e.jsxs("span",{className:"text-xs text-muted-foreground",children:[h.getState().pagination.pageIndex+1," / ",h.getPageCount()||1]}),e.jsx(x,{variant:"outline",size:"icon",className:"h-7 w-7",onClick:()=>h.nextPage(),disabled:!h.getCanNextPage(),children:e.jsx(Ms,{className:"h-4 w-4"})})]})]})]})}),e.jsx(Zs,{invoice:f,open:l,onClose:()=>n(!1),onRefresh:j})]})}export{Nt as default};
