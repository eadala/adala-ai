import { createHmac, timingSafeEqual } from "node:crypto";
import type { ArcRole, OperatorIdentity } from "./types.js";
import { verifyOidcBearer } from "./oidc.js";

/**
 * Server-verified operator identity.
 * Prefer OIDC/JWT (3-part). HMAC (2-part) only when ARC_ALLOW_DEV_HMAC=true and not production.
 * Roles never from client headers.
 */

export type VerifiedOperator = OperatorIdentity & {
  issuedAt: number;
  expiresAt: number;
  identitySource: "oidc" | "hmac_dev";
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

export function allowDevHmac(): boolean {
  if (isProductionConfig()) return false;
  return (process.env.ARC_ALLOW_DEV_HMAC ?? "true").toLowerCase() === "true";
}

function identitySecret(): string | null {
  const secret = process.env.ARC_IDENTITY_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  if (isProductionConfig()) return null;
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
  | "ai_agent_credential_blocked"
  | "hmac_disabled";

export function issueDevCredential(
  operatorId: string,
  opts?: { ttlSeconds?: number; allowAiAgent?: boolean },
): { token: string } | { error: CredentialIssueError } {
  if (isProductionConfig()) return { error: "production_blocks_dev_issuer" };
  if (!allowDevHmac()) return { error: "hmac_disabled" };
  const record = OPERATOR_REGISTRY[operatorId];
  if (!record) return { error: "unknown_operator" };
  if (record.role === "ai_agent" && opts?.allowAiAgent === false) {
    return { error: "ai_agent_credential_blocked" };
  }
  const now = Math.floor(Date.now() / 1000);
  const ttl = opts?.ttlSeconds ?? 3600;
  const payload = { sub: record.id, iat: now, exp: now + ttl, v: 1 };
  const secret = identitySecret();
  if (!secret) return { error: "production_blocks_dev_issuer" };
  const payloadB64 = b64url(JSON.stringify(payload));
  return { token: `${payloadB64}.${sign(payloadB64, secret)}` };
}

export type VerifyFailure =
  | "missing"
  | "malformed"
  | "bad_signature"
  | "expired"
  | "unknown_subject"
  | "role_header_forbidden"
  | "legacy_auth_forbidden"
  | "wrong_issuer"
  | "wrong_audience"
  | "unsupported_alg"
  | "hmac_disabled"
  | "live_unconfigured"
  | "jwks_outage"
  | "revoked"
  | "not_allowlisted"
  | "mfa_required";

export async function verifyBearerCredential(
  authorizationHeader: string | undefined,
  forbiddenHeaders: { roleHeader?: string | null; legacyToken?: string | null },
): Promise<{ ok: true; operator: VerifiedOperator } | { ok: false; reason: VerifyFailure }> {
  if (forbiddenHeaders.roleHeader) {
    return { ok: false, reason: "role_header_forbidden" };
  }
  if (forbiddenHeaders.legacyToken) {
    return { ok: false, reason: "legacy_auth_forbidden" };
  }
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { ok: false, reason: "missing" };
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  const parts = token.split(".");

  /* JWT / OIDC path */
  if (parts.length === 3) {
    const oidc = await verifyOidcBearer(authorizationHeader);
    if (!oidc.ok) {
      const map: Record<string, VerifyFailure> = {
        missing: "missing",
        invalid_signature: "bad_signature",
        wrong_issuer: "wrong_issuer",
        wrong_audience: "wrong_audience",
        expired: "expired",
        nbf: "expired",
        unsupported_alg: "unsupported_alg",
        unknown_kid: "bad_signature",
        malformed: "malformed",
        live_unconfigured: "live_unconfigured",
        jwks_outage: "jwks_outage",
        revoked: "revoked",
        not_allowlisted: "not_allowlisted",
        mfa_required: "mfa_required",
      };
      return { ok: false, reason: map[oidc.reason] ?? "bad_signature" };
    }
    const short = oidc.claims.sub.replace(/^oidc\|/, "");
    return {
      ok: true,
      operator: {
        id: short,
        displayName: `OIDC ${short}`,
        role: oidc.role,
        issuedAt: (oidc.claims.iat ?? 0) * 1000,
        expiresAt: (oidc.claims.exp ?? 0) * 1000,
        identitySource: "oidc",
      },
    };
  }

  /* HMAC dev path */
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  if (!allowDevHmac()) return { ok: false, reason: "hmac_disabled" };
  const secret = identitySecret();
  if (!secret) return { ok: false, reason: "bad_signature" };
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
  if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };
  const record = OPERATOR_REGISTRY[payload.sub];
  if (!record) return { ok: false, reason: "unknown_subject" };
  return {
    ok: true,
    operator: {
      ...record,
      issuedAt: payload.iat * 1000,
      expiresAt: payload.exp * 1000,
      identitySource: "hmac_dev",
    },
  };
}

export function lookupOperator(id: string): OperatorIdentity | undefined {
  return OPERATOR_REGISTRY[id];
}

export function listOperatorIds(): string[] {
  return Object.keys(OPERATOR_REGISTRY);
}

export function issueExpiredDevCredential(operatorId: string): string {
  if (isProductionConfig() || !allowDevHmac()) throw new Error("blocked");
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
