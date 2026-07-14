import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useAuthReady } from "@/hooks/use-auth-ready";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export interface MyPermissions {
  role: string;
  displayName: string;
  permissions: string[];
  officeId?: string;
}

export function usePermissions() {
  const authReady = useAuthReady();
  const { data, isPending } = useQuery<MyPermissions>({
    queryKey: ["my-permissions"],
    queryFn: () =>
      authFetch(`${BASE}/api/rbac/my-permissions`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: authReady,
  });

  const permissions: string[] = data?.permissions ?? [];

  const hasPermission = (key: string): boolean => {
    // SECURITY FIX: return false while loading — never grant access before permissions are fetched
    if (!data) return false;
    if (permissions.includes("*")) return true;
    return permissions.includes(key);
  };

  const hasAny = (...keys: string[]): boolean => keys.some(k => hasPermission(k));
  const hasAll = (...keys: string[]): boolean => keys.every(k => hasPermission(k));

  const isOwner   = permissions.includes("*");
  const isAdmin   = isOwner || data?.role === "office_manager";
  const isLawyer  = isOwner || isAdmin || data?.role === "lawyer" || data?.role === "trainee_lawyer";

  return {
    permissions,
    role: data?.role ?? "",
    roleDisplayName: data?.displayName ?? "",
    hasPermission,
    hasAny,
    hasAll,
    isOwner,
    isAdmin,
    isLawyer,
    // Wait for auth readiness + query settle (disabled query stays pending)
    isLoaded: authReady && !isPending,
  };
}
