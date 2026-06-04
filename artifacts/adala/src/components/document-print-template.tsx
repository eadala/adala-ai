import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

type Branding = {
  officeName?: string;
  officeNameEn?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  licenseNo?: string;
  logoUrl?: string;
  stampUrl?: string;
  signatureUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  showAdalalahLogo?: boolean;
  showAdalalahFooter?: boolean;
  subscriptionTier?: string;
};

type PrintTemplateProps = {
  title: string;
  subtitle?: string;
  docNumber?: string;
  date?: string;
  children: React.ReactNode;
  showStamp?: boolean;
  showSignature?: boolean;
};

export function useBranding() {
  return useQuery<Branding | null>({
    queryKey: ["branding"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}api/branding`);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function DocumentPrintTemplate({
  title,
  subtitle,
  docNumber,
  date,
  children,
  showStamp = false,
  showSignature = false,
}: PrintTemplateProps) {
  const { data: branding } = useBranding();
  const primary = branding?.primaryColor || "#1e3a5f";
  const secondary = branding?.secondaryColor || "#c9a84c";
  const showAdalah = branding?.showAdalalahLogo !== false;
  const showFooter = branding?.showAdalalahFooter !== false;

  return (
    <div className="font-[Cairo,sans-serif] bg-white text-gray-900" dir="rtl" style={{ fontFamily: "Cairo, sans-serif" }}>
      {/* ══ HEADER ══ */}
      <div className="flex items-start justify-between pb-4 mb-6" style={{ borderBottom: `3px solid ${secondary}` }}>
        <div className="flex items-center gap-4">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="شعار المكتب" className="h-16 w-16 object-contain" />
          ) : (
            <div className="h-16 w-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: primary }}>
              {(branding?.officeName || "م")[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: primary }}>
              {branding?.officeName || "مكتب المحاماة"}
            </h1>
            {branding?.officeNameEn && (
              <p className="text-sm text-gray-500 font-medium">{branding.officeNameEn}</p>
            )}
            {branding?.tagline && (
              <p className="text-xs text-gray-400 mt-0.5">{branding.tagline}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              {branding?.phone && <span className="text-xs text-gray-500">📞 {branding.phone}</span>}
              {branding?.email && <span className="text-xs text-gray-500">✉ {branding.email}</span>}
              {branding?.licenseNo && <span className="text-xs text-gray-500">رخصة: {branding.licenseNo}</span>}
            </div>
          </div>
        </div>
        {showAdalah && (
          <div className="flex flex-col items-center gap-1 opacity-75">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: primary }}>ع</div>
            <span className="text-xs font-bold" style={{ color: primary }}>عدالة AI</span>
          </div>
        )}
      </div>

      {/* ══ DOC TITLE ══ */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-extrabold mb-1" style={{ color: primary }}>{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
          {docNumber && <span>رقم: {docNumber}</span>}
          {date && <span>التاريخ: {date}</span>}
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div className="space-y-4">{children}</div>

      {/* ══ SIGNATURE + STAMP ══ */}
      {(showStamp || showSignature) && (
        <div className="flex justify-between items-end mt-12 pt-6 border-t" style={{ borderColor: secondary }}>
          {showSignature && branding?.signatureUrl ? (
            <div className="text-center">
              <img src={branding.signatureUrl} alt="التوقيع" className="h-16 object-contain mb-1" />
              <p className="text-xs text-gray-500 border-t pt-1">توقيع المسؤول</p>
            </div>
          ) : showSignature ? (
            <div className="w-40 border-t border-gray-400 text-center pt-1">
              <p className="text-xs text-gray-500">توقيع المسؤول</p>
            </div>
          ) : <div />}
          {showStamp && branding?.stampUrl ? (
            <div className="text-center">
              <img src={branding.stampUrl} alt="الختم" className="h-16 w-16 object-contain mb-1" />
              <p className="text-xs text-gray-500">ختم المكتب</p>
            </div>
          ) : showStamp ? (
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
              <p className="text-xs text-gray-400 text-center">ختم المكتب</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ══ FOOTER ══ */}
      {showFooter && (
        <div className="mt-8 pt-3 text-center text-xs text-gray-400" style={{ borderTop: `2px solid ${secondary}` }}>
          تم إنشاء هذا المستند بواسطة منصة <strong>عدالة AI</strong> — Powered by Adalah AI
          {branding?.address && (
            <span className="mx-2">| {branding.address}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function PrintButton({ children, label = "طباعة / تصدير PDF" }: {
  children: React.ReactNode;
  label?: string;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win || !printRef.current) return;
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<title>مستند</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cairo', sans-serif; direction: rtl; color: #111; background: #fff; padding: 20mm 15mm; }
  @media print { @page { size: A4; margin: 15mm; } }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
  th { background: #f5f5f5; }
</style>
</head>
<body>${printRef.current.innerHTML}</body>
</html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <>
      <button
        onClick={handlePrint}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        🖨️ {label}
      </button>
      <div ref={printRef} style={{ display: "none" }}>{children}</div>
    </>
  );
}
