import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useAuthReady } from "@/hooks/use-auth-ready";

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
  letterheadUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  invoiceTemplate?: "classic_legal" | "modern_blue" | "minimal" | null;
  subscriptionTier?: string | null;
  showAdalalahLogo?: boolean;
  showAdalalahFooter?: boolean;
  adalalahLogoSize?: string | null;
};

export function useBranding() {
  const authReady = useAuthReady();
  return useQuery<OfficeBranding | null>({
    queryKey: ["branding"],
    queryFn: async () => {
      const r = await authFetch(`${BASE}/api/branding`);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: authReady,
  });
}
