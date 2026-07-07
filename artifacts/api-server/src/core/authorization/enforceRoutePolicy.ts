/**
 * Registry-driven route policy enforcement.
 * PR-AUTH-001: only enforces routes explicitly listed in ROUTE_POLICIES when
 * AUTHORIZATION_ENFORCEMENT=strict. Default/warn modes log but allow (foundation).
 */
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authorize, hasAllPermissions, hasAnyPermission } from "./authorize";
import {
  AUTHZ_REQUEST_KEY,
  ensureAuthorizationContext,
  type AuthzRequest,
} from "./authorizationContext";
import {
  authorizationContextMissingResponse,
  authorizationDeniedResponse,
  membershipRequiredResponse,
} from "./errors";
import { findRoutePolicy, normalizeApiPath } from "./routePolicyRegistry";
import type { RoutePolicy } from "./routePolicyRegistry";
import { isValidPermissionKey } from "./permissionCatalog";

export type EnforcementMode = "off" | "warn" | "strict";

export function getEnforcementMode(): EnforcementMode {
  const raw = (process.env.AUTHORIZATION_ENFORCEMENT ?? "warn").toLowerCase();
  if (raw === "off" || raw === "strict") return raw;
  return "warn";
}

function requiredPermissions(policy: RoutePolicy): string[] {
  if (policy.permission) return [policy.permission];
  return policy.permissions ?? [];
}

function evaluatePolicy(
  ctx: NonNullable<AuthzRequest[typeof AUTHZ_REQUEST_KEY]>,
  policy: RoutePolicy,
): boolean {
  const perms = requiredPermissions(policy);
  if (perms.length === 0) return true;
  if (policy.match === "all") return hasAllPermissions(ctx, perms);
  if (perms.length === 1) return authorize(ctx, perms[0]).allowed;
  return hasAnyPermission(ctx, perms);
}

async function logSaBypass(userId: string, path: string, officeId: string) {
  db.execute(sql`
    INSERT INTO audit_logs (user_id, user_full_name, action, resource, resource_id, details)
    VALUES (${userId}, ${"Super Admin"}, 'SA_RBAC_BYPASS', 'authorization', ${path},
            ${JSON.stringify({ officeId, path, ts: new Date().toISOString() })}::jsonb)
  `).catch(() => {});
}

/**
 * enforceRoutePolicy — optional middleware after requireAuthWithTenant.
 * When a matching policy exists, validates permissions via authorization kernel.
 */
export function enforceRoutePolicy() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const mode = getEnforcementMode();
    if (mode === "off") return next();

    const normalized = normalizeApiPath(req.originalUrl || req.url);
    const policy = findRoutePolicy(req.method, normalized);
    if (!policy || policy.routeClass !== "TENANT_RBAC") {
      return next();
    }

    const perms = requiredPermissions(policy);
    for (const p of perms) {
      if (!isValidPermissionKey(p)) {
        console.warn(`[AUTHZ] Invalid permission key in route policy: ${p} for ${req.method} ${normalized}`);
      }
    }

    const authReq = req as AuthzRequest;
    const userId = authReq.userId;
    const officeId = authReq.tenantId;

    if (!userId || !officeId) {
      if (mode === "strict") {
        return res.status(403).json(authorizationContextMissingResponse());
      }
      console.warn(`[AUTHZ:warn] missing tenant context ${req.method} ${normalized}`);
      return next();
    }

    const ctx = await ensureAuthorizationContext(authReq);
    if (!ctx) {
      if (mode === "strict") {
        return res.status(403).json(membershipRequiredResponse(officeId));
      }
      console.warn(`[AUTHZ:warn] no membership ${req.method} ${normalized} user=${userId} office=${officeId}`);
      return next();
    }

    if (ctx.isSuperAdmin && !ctx.isImpersonating) {
      logSaBypass(userId, normalized, officeId);
      return next();
    }

    const allowed = evaluatePolicy(ctx, policy);
    if (allowed) return next();

    const body = authorizationDeniedResponse(perms, {
      role: ctx.roleName,
      officeId: ctx.officeId,
    });

    if (mode === "strict") {
      return res.status(403).json(body);
    }

    console.warn(
      `[AUTHZ:warn] would deny ${req.method} ${normalized} required=${perms.join(",")} role=${ctx.roleName}`,
    );
    return next();
  };
}
