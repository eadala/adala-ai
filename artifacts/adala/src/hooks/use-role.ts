import { useUser } from "@clerk/react";

export type AppRole = "platform_admin" | "law_firm_user";

/** Returns the current user's role + loading state */
export function useRole(): { role: AppRole; isLoaded: boolean } {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return { role: "law_firm_user", isLoaded: false };
  if (!user)     return { role: "law_firm_user", isLoaded: true  };

  const superAdminEmails = [
    ...(import.meta.env.VITE_SUPER_ADMIN_EMAILS ?? "").split(","),
    ...(import.meta.env.VITE_PLATFORM_OWNER_EMAIL ?? "").split(","),
  ].map((e: string) => e.trim()).filter(Boolean);

  const email   = user.primaryEmailAddress?.emailAddress ?? "";
  const byRole  = user.publicMetadata?.role === "super_admin"
               || user.publicMetadata?.role === "platform_admin";
  const byEmail = superAdminEmails.length > 0 && superAdminEmails.includes(email);

  const role: AppRole = byRole || byEmail ? "platform_admin" : "law_firm_user";
  return { role, isLoaded: true };
}

export function useIsSuperAdmin(): boolean {
  return useRole().role === "platform_admin";
}
