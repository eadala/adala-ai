/**
 * Authorization context loader — single JOIN per request.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Request } from "express";
import { PLATFORM_TENANT_ID } from "../tenantContext";
import type { AuthorizationContext, PrincipalType } from "./types";

export const AUTHZ_REQUEST_KEY = "authz" as const;

export type AuthzRequest = Request & {
  userId?: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
  [AUTHZ_REQUEST_KEY]?: AuthorizationContext;
};

export interface LoadAuthContextOptions {
  isSuperAdmin?: boolean;
  skipImpersonationCheck?: boolean;
}

async function loadImpersonationOffice(userId: string): Promise<string | null> {
  try {
    const imp = await db.execute(sql`
      SELECT impersonated_office_id FROM developer_impersonation
      WHERE super_admin_user_id = ${userId} AND expires_at > NOW()
      LIMIT 1
    `) as { rows?: { impersonated_office_id?: string }[] };
    const rows = Array.isArray(imp) ? imp : (imp?.rows ?? []);
    return rows[0]?.impersonated_office_id ?? null;
  } catch {
    return null;
  }
}

async function loadFirmOwnerPermissions(): Promise<string[]> {
  try {
    const roleRows = await db.execute(sql`
      SELECT permissions FROM roles WHERE name = 'firm_owner' LIMIT 1
    `) as { rows?: { permissions?: string }[] };
    const rows = Array.isArray(roleRows) ? roleRows : (roleRows?.rows ?? []);
    const raw = rows[0]?.permissions;
    return raw ? (JSON.parse(raw) as string[]) : ["*"];
  } catch {
    return ["*"];
  }
}

/**
 * Load office membership + role permissions (one JOIN).
 * Returns null when no active membership — caller must deny.
 */
export async function loadAuthorizationContext(
  userId: string,
  officeId: string,
  options: LoadAuthContextOptions = {},
): Promise<AuthorizationContext | null> {
  if (!userId || !officeId || officeId === PLATFORM_TENANT_ID) {
    return null;
  }

  let principalType: PrincipalType = "user";
  let isImpersonating = false;

  if (options.isSuperAdmin && !options.skipImpersonationCheck) {
    const impOffice = await loadImpersonationOffice(userId);
    if (impOffice && impOffice === officeId) {
      isImpersonating = true;
      principalType = "impersonated";
      const permissions = await loadFirmOwnerPermissions();
      return {
        userId,
        officeId,
        roleName: "firm_owner",
        roleDisplayName: "مالك المكتب (انتحال دعم)",
        permissions,
        principalType,
        isSuperAdmin: false,
        isImpersonating: true,
      };
    }
  }

  const result = await db.execute(sql`
    SELECT
      om.role AS role_name,
      r.display_name AS role_display_name,
      r.permissions AS permissions_json
    FROM office_members om
    LEFT JOIN roles r ON r.name = om.role
    WHERE om.user_id = ${userId}
      AND om.office_id = ${officeId}
      AND om.status = 'active'
    LIMIT 1
  `) as { rows?: { role_name?: string; role_display_name?: string; permissions_json?: string }[] };

  const rows = Array.isArray(result) ? result : (result?.rows ?? []);
  const row = rows[0];
  if (!row?.role_name) {
    return null;
  }

  let permissions: string[] = [];
  try {
    permissions = row.permissions_json
      ? (JSON.parse(row.permissions_json) as string[])
      : [];
  } catch {
    permissions = [];
  }

  if (options.isSuperAdmin && !isImpersonating) {
    principalType = "super_admin";
  }

  return {
    userId,
    officeId,
    roleName: row.role_name,
    roleDisplayName: row.role_display_name ?? row.role_name,
    permissions,
    principalType,
    isSuperAdmin: !!options.isSuperAdmin && !isImpersonating,
    isImpersonating,
  };
}

/** Attach authorization context to request (idempotent). */
export async function ensureAuthorizationContext(req: AuthzRequest): Promise<AuthorizationContext | null> {
  if (req[AUTHZ_REQUEST_KEY]) {
    return req[AUTHZ_REQUEST_KEY];
  }

  const userId = req.userId;
  const officeId = req.tenantId;
  if (!userId || !officeId || officeId === PLATFORM_TENANT_ID) {
    return null;
  }

  const isSA = !!req.isSuperAdmin;
  const ctx = await loadAuthorizationContext(userId, officeId, { isSuperAdmin: isSA });
  if (ctx) {
    req[AUTHZ_REQUEST_KEY] = ctx;
  }
  return ctx;
}

export function getAuthorizationContext(req: AuthzRequest): AuthorizationContext | undefined {
  return req[AUTHZ_REQUEST_KEY];
}
