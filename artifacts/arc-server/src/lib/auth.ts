import type { Request, RequestHandler } from "express";
import type { ArcRole, OperatorIdentity } from "./types.js";

/**
 * Phase 1 local operator auth — deny-by-default.
 * Header: X-ARC-Operator: <id>
 * Header: X-ARC-Role: <role>
 * Header: X-ARC-Token: must match ARC_OPERATOR_TOKEN (default local-dev-only token)
 *
 * AI agents are never treated as independent reviewers.
 */

const DEV_TOKEN = process.env.ARC_OPERATOR_TOKEN ?? "arc-local-dev-token";

const KNOWN: Record<string, OperatorIdentity> = {
  owner: { id: "owner", displayName: "Platform Owner", role: "platform_owner" },
  releaser: { id: "releaser", displayName: "Release Manager", role: "release_manager" },
  reviewer: {
    id: "reviewer",
    displayName: "Independent Reviewer",
    role: "independent_reviewer",
  },
  operator: {
    id: "operator",
    displayName: "Production Operator",
    role: "production_operator",
  },
  auditor: { id: "auditor", displayName: "Read-only Auditor", role: "read_only_auditor" },
  agent: { id: "agent", displayName: "AI Agent", role: "ai_agent" },
};

export type AuthedRequest = Request & {
  operator?: OperatorIdentity;
  requestId: string;
};

export function asAuthed(req: Request): AuthedRequest {
  return req as AuthedRequest;
}

export const requestIdMiddleware: RequestHandler = (req, _res, next) => {
  const r = asAuthed(req);
  r.requestId = (req.header("x-request-id") as string) || cryptoRandom();
  next();
};

function cryptoRandom(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = req.header("x-arc-token");
  const opId = req.header("x-arc-operator");
  if (token === DEV_TOKEN && opId && KNOWN[opId]) {
    const roleHeader = req.header("x-arc-role") as ArcRole | undefined;
    const base = KNOWN[opId];
    asAuthed(req).operator = roleHeader ? { ...base, role: roleHeader } : base;
  }
  next();
};

export const requireAuth: RequestHandler = (req, res, next) => {
  optionalAuth(req, res, () => {
    if (!asAuthed(req).operator) {
      res.status(401).json({
        error: "unauthorized",
        message: "ARC operator identity required (deny-by-default)",
      });
      return;
    }
    next();
  });
};

export function requireRoles(...roles: ArcRole[]): RequestHandler {
  return (req, res, next) => {
    const op = asAuthed(req).operator;
    if (!op) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!roles.includes(op.role)) {
      res.status(403).json({
        error: "forbidden",
        message: `Role ${op.role} cannot perform this action`,
        required: roles,
      });
      return;
    }
    next();
  };
}

export function isIndependentReviewer(role: ArcRole): boolean {
  return role === "independent_reviewer";
}

export function isAiAgent(role: ArcRole): boolean {
  return role === "ai_agent";
}
