import { useEffect } from "react";
import { useBranding } from "@/hooks/use-branding";

export function OfficeThemeProvider() {
  const { data: branding } = useBranding();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--office-primary", branding?.primaryColor || "#1e3a5f");
    root.style.setProperty("--office-secondary", branding?.secondaryColor || "#c9a84c");
  }, [branding?.primaryColor, branding?.secondaryColor]);

  useEffect(() => {
    if (!branding?.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }, [branding?.faviconUrl]);

  useEffect(() => {
    if (!branding?.officeName) return;
    document.title = `${branding.officeName} — عدالة AI`;
  }, [branding?.officeName]);

  return null;
}
