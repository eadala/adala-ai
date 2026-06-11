import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export type OfficeBranding = {
  id?: string;
  tenantId?: string;
  officeName?: string | null;
  officeNameEn?: string | null;
  tagline?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  licenseNo?: string | null;
  logoUrl?: string | null;
  stampUrl?: string | null;
  signatureUrl?: string | null;
  faviconUrl?: string | null;
  loginBackgroundUrl?: string | null;
  watermarkUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  invoiceTemplate?: "classic_legal" | "modern_blue" | "minimal" | null;
  subscriptionTier?: string | null;
  showAdalalahLogo?: boolean;
  showAdalalahFooter?: boolean;
  adalalahLogoSize?: string | null;
};

export function useBranding() {
  return useQuery<OfficeBranding | null>({
    queryKey: ["branding"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/branding`);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
