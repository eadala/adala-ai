import type { Request, RequestHandler } from "express";
import type { ArcRole } from "./types.js";
import { verifyBearerCredential, type VerifiedOperator } from "./identity.js";
import { roleHasPermission, type Permission } from "./permissions.js";
import { store } from "./store.js";

export type AuthedRequest = Request & {
  operator?: VerifiedOperator;
  requestId: string;
};

export function asAuthed(req: Request): AuthedRequest {
  return req as AuthedRequest;
}

export const requestIdMiddleware: RequestHandler = (req, _res, next) => {
  asAuthed(req).requestId =
    (req.header("x-request-id") as string) ||
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  next();
};

/**
 * Authenticate via Authorization: Bearer <signed credential>.
 * Rejects X-ARC-Role and legacy X-ARC-Token (F-001 closure).
 */
export const authenticate: RequestHandler = (req, res, next) => {
  const result = verifyBearerCredential(req.header("authorization") ?? undefined, {
    roleHeader: req.header("x-arc-role"),
    legacyToken: req.header("x-arc-token"),
  });
  if (!result.ok) {
    const status = result.reason === "role_header_forbidden" ? 403 : 401;
    store.appendAudit({
      actor: "anonymous",
      action: "auth.denied",
      target: req.path,
      requestId: asAuthed(req).requestId,
      previousState: null,
      newState: result.reason,
      evidenceReference: null,
    });
    res.status(status).json({
      error: status === 401 ? "unauthorized" : "forbidden",
      reason: result.reason,
      message:
        result.reason === "role_header_forbidden"
          ? "Client-supplied X-ARC-Role is rejected (server-bound roles only)"
          : "Verified operator credential required",
    });
    return;
  }
  asAuthed(req).operator = result.operator;
  next();
};

/** Optional auth: attaches operator if valid bearer present; does not reject missing */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  if (req.header("x-arc-role") || req.header("x-arc-token")) {
    /* Do not silently ignore forge attempts on optional routes — reject */
    const result = verifyBearerCredential(req.header("authorization") ?? undefined, {
      roleHeader: req.header("x-arc-role"),
      legacyToken: req.header("x-arc-token"),
    });
    if (!result.ok) {
      asAuthed(req).operator = undefined;
      (req as Request & { authReject?: string }).authReject = result.reason;
    } else {
      asAuthed(req).operator = result.operator;
    }
    next();
    return;
  }
  const auth = req.header("authorization");
  if (!auth) {
    next();
    return;
  }
  const result = verifyBearerCredential(auth, { roleHeader: null, legacyToken: null });
  if (result.ok) asAuthed(req).operator = result.operator;
  next();
};

export const requireAuth: RequestHandler = (req, res, next) => {
  authenticate(req, res, next);
};

export function requirePermission(...needed: Permission[]): RequestHandler {
  return (req, res, next) => {
    const op = asAuthed(req).operator;
    if (!op) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const missing = needed.filter((p) => !roleHasPermission(op.role, p));
    if (missing.length > 0) {
      store.appendAudit({
        actor: op.id,
        action: "authz.denied",
        target: req.path,
        requestId: asAuthed(req).requestId,
        previousState: op.role,
        newState: missing.join(","),
        evidenceReference: null,
      });
      res.status(403).json({
        error: "forbidden",
        message: `Missing permission(s): ${missing.join(", ")}`,
        role: op.role,
        required: needed,
      });
      return;
    }
    next();
  };
}

/** @deprecated use requirePermission — kept name for clarity in role checks during transition */
export function requireRoles(..._roles: ArcRole[]): RequestHandler {
  return (_req, res) => {
    res.status(500).json({
      error: "misconfigured",
      message: "requireRoles removed — use requirePermission",
    });
  };
}

export function isIndependentReviewer(role: ArcRole): boolean {
  return role === "independent_reviewer";
}

export function isAiAgent(role: ArcRole): boolean {
  return role === "ai_agent";
}
