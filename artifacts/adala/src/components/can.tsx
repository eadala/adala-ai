import { usePermissions } from "@/hooks/use-permissions";

interface CanProps {
  permission?: string;
  any?: string[];
  all?: string[];
  role?: string | string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * <Can permission="cases:create"> — hides children if no permission.
 * Never disables — always hides completely (per RBAC design rule #1).
 */
export function Can({ permission, any: anyPerms, all: allPerms, role, fallback = null, children }: CanProps) {
  const { hasPermission, hasAny, hasAll, role: userRole, isLoaded } = usePermissions();

  if (!isLoaded) return null;

  let allowed = true;

  if (permission) allowed = hasPermission(permission);
  else if (anyPerms) allowed = hasAny(...anyPerms);
  else if (allPerms) allowed = hasAll(...allPerms);

  if (role && allowed) {
    const roles = Array.isArray(role) ? role : [role];
    allowed = roles.includes(userRole);
  }

  return allowed ? <>{children}</> : <>{fallback}</>;
}
