import { createHmac, timingSafeEqual } from "node:crypto";
import type { ArcRole, OperatorIdentity } from "./types.js";

/**
 * Server-verified operator identity.
 * Roles are bound in OPERATOR_REGISTRY — never accepted from client headers.
 */

export type VerifiedOperator = OperatorIdentity & {
  issuedAt: number;
  expiresAt: number;
};

const OPERATOR_REGISTRY: Record<string, OperatorIdentity> = {
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

export function isProductionConfig(): boolean {
  return (process.env.ARC_ENV ?? "").toLowerCase() === "production";
}

function identitySecret(): string | null {
  const secret = process.env.ARC_IDENTITY_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  if (isProductionConfig()) {
    /* Fail closed — no fallback secret in production */
    return null;
  }
  /* Local/test only — never use in production config */
  return "arc-local-dev-identity-secret";
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export type CredentialIssueError =
  | "unknown_operator"
  | "production_blocks_dev_issuer"
  | "ai_agent_credential_blocked";

/**
 * Issue a short-lived signed credential for local/test use.
 * Payload contains only subject id — role resolved from registry at verify time.
 */
export function issueDevCredential(
  operatorId: string,
  opts?: { ttlSeconds?: number; allowAiAgent?: boolean },
): { token: string } | { error: CredentialIssueError } {
  if (isProductionConfig()) {
    return { error: "production_blocks_dev_issuer" };
  }
  const record = OPERATOR_REGISTRY[operatorId];
  if (!record) return { error: "unknown_operator" };
  if (record.role === "ai_agent" && opts?.allowAiAgent === false) {
    return { error: "ai_agent_credential_blocked" };
  }
  const now = Math.floor(Date.now() / 1000);
  const ttl = opts?.ttlSeconds ?? 3600;
  const payload = {
    sub: record.id,
    iat: now,
    exp: now + ttl,
    v: 1,
  };
  const secret = identitySecret();
  if (!secret) return { error: "production_blocks_dev_issuer" };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = sign(payloadB64, secret);
  return { token: `${payloadB64}.${sig}` };
}

export type VerifyFailure =
  | "missing"
  | "malformed"
  | "bad_signature"
  | "expired"
  | "unknown_subject"
  | "role_header_forbidden"
  | "legacy_auth_forbidden";

export function verifyBearerCredential(
  authorizationHeader: string | undefined,
  forbiddenHeaders: { roleHeader?: string | null; legacyToken?: string | null },
): { ok: true; operator: VerifiedOperator } | { ok: false; reason: VerifyFailure } {
  if (forbiddenHeaders.roleHeader) {
    return { ok: false, reason: "role_header_forbidden" };
  }
  /* Legacy X-ARC-Token / X-ARC-Operator no longer authorize */
  if (forbiddenHeaders.legacyToken) {
    return { ok: false, reason: "legacy_auth_forbidden" };
  }
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { ok: false, reason: "missing" };
  }
  const secret = identitySecret();
  if (!secret) return { ok: false, reason: "bad_signature" };
  const token = authorizationHeader.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sig] = parts;
  const expected = sign(payloadB64, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad_signature" };
    }
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
  let payload: { sub?: string; iat?: number; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      sub?: string;
      iat?: number;
      exp?: number;
    };
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!payload.sub || typeof payload.exp !== "number" || typeof payload.iat !== "number") {
    return { ok: false, reason: "malformed" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { ok: false, reason: "expired" };
  const record = OPERATOR_REGISTRY[payload.sub];
  if (!record) return { ok: false, reason: "unknown_subject" };
  return {
    ok: true,
    operator: {
      ...record,
      issuedAt: payload.iat * 1000,
      expiresAt: payload.exp * 1000,
    },
  };
}

export function lookupOperator(id: string): OperatorIdentity | undefined {
  return OPERATOR_REGISTRY[id];
}

export function listOperatorIds(): string[] {
  return Object.keys(OPERATOR_REGISTRY);
}

/** Test helper: mint expired credential */
export function issueExpiredDevCredential(operatorId: string): string {
  if (isProductionConfig()) throw new Error("blocked");
  const record = OPERATOR_REGISTRY[operatorId];
  if (!record) throw new Error("unknown");
  const payload = {
    sub: record.id,
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600,
    v: 1,
  };
  const secret = identitySecret();
  if (!secret) throw new Error("blocked");
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export type { ArcRole };
