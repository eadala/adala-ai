import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  SignJWT,
  type JWTPayload,
  type JWK,
} from "jose";
import type { ArcRole } from "./types.js";

/**
 * Production-capable OIDC/JWT verification (Phase 2C-1).
 * Fixture JWKS by default. Live JWKS only when ARC_OIDC_MODE=live + ARC_OIDC_JWKS_URL.
 * Without authorized test IdP credentials, live integration remains BLOCKED.
 */

export type OidcClaims = {
  sub: string;
  iss: string;
  aud: string | string[];
  iat?: number;
  exp?: number;
  nbf?: number;
  sid?: string;
  email?: string;
  acr?: string;
  amr?: string[];
};

export type OidcVerifyFailure =
  | "missing"
  | "invalid_signature"
  | "wrong_issuer"
  | "wrong_audience"
  | "expired"
  | "nbf"
  | "unsupported_alg"
  | "unknown_kid"
  | "malformed"
  | "live_unconfigured"
  | "jwks_outage"
  | "revoked"
  | "not_allowlisted"
  | "mfa_required";

type FixtureKey = {
  kid: string;
  privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
  jwk: JWK;
};

let fixtureKeys: FixtureKey[] = [];
let activeKid = "arc-fixture-1";
let fixtureJwks: ReturnType<typeof createLocalJWKSet> | null = null;

/** Explicit operator allowlist — empty means fixture defaults only */
const revokedSubjects = new Set<string>();
const revokedSessions = new Set<string>();

export function oidcConfig() {
  return {
    mode: (process.env.ARC_OIDC_MODE ?? "fixture") as "fixture" | "live",
    issuer: process.env.ARC_OIDC_ISSUER ?? "https://arc.local/oidc",
    audience: process.env.ARC_OIDC_AUDIENCE ?? "adalah-arc",
    jwksUrl: process.env.ARC_OIDC_JWKS_URL?.trim() || null,
    clockToleranceSec: Number(process.env.ARC_OIDC_CLOCK_SKEW_SEC ?? 30),
    /** MFA design: when true, require acr matching ARC_OIDC_REQUIRED_ACR (default urn:mfa) */
    requireMfa: (process.env.ARC_OIDC_REQUIRE_MFA ?? "false").toLowerCase() === "true",
    requiredAcr: process.env.ARC_OIDC_REQUIRED_ACR ?? "urn:adalah:acr:mfa",
  };
}

export function liveOidcStatus(): {
  status: "fixture" | "live_ready" | "BLOCKED";
  reason: string;
} {
  const cfg = oidcConfig();
  if (cfg.mode !== "live") {
    return {
      status: "fixture",
      reason: "ARC_OIDC_MODE is not live — fixture validation only",
    };
  }
  if (!cfg.jwksUrl) {
    return {
      status: "BLOCKED",
      reason: "ARC_OIDC_JWKS_URL missing — authorized test IdP unavailable",
    };
  }
  return {
    status: "live_ready",
    reason: "JWKS URL configured (operator must still attest test IdP isolation)",
  };
}

function rebuildJwks(): void {
  fixtureJwks = createLocalJWKSet({
    keys: fixtureKeys.map((k) => ({ ...k.jwk, kid: k.kid, alg: "RS256", use: "sig" })),
  });
}

export async function ensureFixtureKeys(): Promise<void> {
  if (fixtureKeys.length > 0 && fixtureJwks) return;
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  jwk.kid = activeKid;
  jwk.alg = "RS256";
  jwk.use = "sig";
  fixtureKeys = [{ kid: activeKid, privateKey, jwk }];
  rebuildJwks();
}

/** JWKS rotation: add new signing key, retain prior key for verify window */
export async function rotateFixtureJwks(newKid = `arc-fixture-${Date.now()}`): Promise<{
  previousKid: string;
  activeKid: string;
}> {
  await ensureFixtureKeys();
  const previousKid = activeKid;
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  jwk.kid = newKid;
  jwk.alg = "RS256";
  jwk.use = "sig";
  fixtureKeys.push({ kid: newKid, privateKey, jwk });
  /* Keep at most 2 keys (current + previous) */
  if (fixtureKeys.length > 2) fixtureKeys = fixtureKeys.slice(-2);
  activeKid = newKid;
  rebuildJwks();
  return { previousKid, activeKid };
}

export function dropFixtureKid(kid: string): void {
  fixtureKeys = fixtureKeys.filter((k) => k.kid !== kid);
  rebuildJwks();
}

function activePrivateKey() {
  const k = fixtureKeys.find((x) => x.kid === activeKid) ?? fixtureKeys[0];
  if (!k) throw new Error("fixture_keys_missing");
  return k;
}

/** Map verified subject → ARC role via server config (never from token role claim). */
const SUBJECT_ROLE_MAP: Record<string, ArcRole> = {
  "oidc|owner": "platform_owner",
  "oidc|releaser": "release_manager",
  "oidc|reviewer": "independent_reviewer",
  "oidc|operator": "production_operator",
  "oidc|auditor": "read_only_auditor",
  "oidc|agent": "ai_agent",
};

export function mapSubjectToRole(sub: string): ArcRole | null {
  const envMap = process.env.ARC_OIDC_SUBJECT_ROLE_JSON?.trim();
  if (envMap) {
    try {
      const parsed = JSON.parse(envMap) as Record<string, ArcRole>;
      if (parsed[sub]) return parsed[sub];
    } catch {
      /* ignore */
    }
  }
  return SUBJECT_ROLE_MAP[sub] ?? null;
}

/** Explicit allowlist — if ARC_OIDC_OPERATOR_ALLOWLIST set, subject must be listed */
export function operatorAllowlist(): Set<string> | null {
  const raw = process.env.ARC_OIDC_OPERATOR_ALLOWLIST?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isOperatorAllowlisted(sub: string): boolean {
  const list = operatorAllowlist();
  if (!list) {
    /* Fixture default: known SUBJECT_ROLE_MAP subjects only */
    return mapSubjectToRole(sub) != null;
  }
  return list.has(sub);
}

export function revokeOperator(sub: string): void {
  revokedSubjects.add(sub.startsWith("oidc|") ? sub : `oidc|${sub}`);
}

export function revokeSession(sid: string): void {
  revokedSessions.add(sid);
}

export function clearRevocations(): void {
  revokedSubjects.clear();
  revokedSessions.clear();
}

export function isRevoked(sub: string, sid?: string): boolean {
  if (revokedSubjects.has(sub)) return true;
  if (sid && revokedSessions.has(sid)) return true;
  return false;
}

export async function issueFixtureAccessToken(
  subjectKey: string,
  opts?: { expiresInSec?: number; sid?: string; acr?: string; amr?: string[] },
): Promise<string> {
  await ensureFixtureKeys();
  const cfg = oidcConfig();
  const sub = subjectKey.startsWith("oidc|") ? subjectKey : `oidc|${subjectKey}`;
  const key = activePrivateKey();
  const claims: Record<string, unknown> = {};
  if (opts?.sid) claims.sid = opts.sid;
  if (opts?.acr) claims.acr = opts.acr;
  if (opts?.amr) claims.amr = opts.amr;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: key.kid, typ: "JWT" })
    .setSubject(sub)
    .setIssuer(cfg.issuer)
    .setAudience(cfg.audience)
    .setIssuedAt()
    .setExpirationTime(`${opts?.expiresInSec ?? 3600}s`)
    .sign(key.privateKey);
}

export async function verifyOidcBearer(
  authorizationHeader: string | undefined,
): Promise<{ ok: true; claims: OidcClaims; role: ArcRole } | { ok: false; reason: OidcVerifyFailure }> {
  if (!authorizationHeader?.startsWith("Bearer ")) return { ok: false, reason: "missing" };
  const token = authorizationHeader.slice(7).trim();
  const cfg = oidcConfig();

  try {
    let jwks = fixtureJwks;
    if (cfg.mode === "live") {
      if (!cfg.jwksUrl) return { ok: false, reason: "live_unconfigured" };
      try {
        const { createRemoteJWKSet } = await import("jose");
        jwks = createRemoteJWKSet(new URL(cfg.jwksUrl));
      } catch {
        return { ok: false, reason: "jwks_outage" };
      }
    } else {
      await ensureFixtureKeys();
      jwks = fixtureJwks!;
    }

    let payload: JWTPayload;
    let protectedHeader: { alg?: string; kid?: string };
    try {
      const verified = await jwtVerify(token, jwks!, {
        issuer: cfg.issuer,
        audience: cfg.audience,
        algorithms: ["RS256"],
        clockTolerance: cfg.clockToleranceSec,
      });
      payload = verified.payload;
      protectedHeader = verified.protectedHeader;
    } catch (e) {
      const err = e as { code?: string };
      if (cfg.mode === "live" && (err.code === "ERR_JWKS_TIMEOUT" || err.code === "ECONNREFUSED")) {
        return { ok: false, reason: "jwks_outage" };
      }
      throw e;
    }

    if (protectedHeader.alg !== "RS256") return { ok: false, reason: "unsupported_alg" };
    if (!payload.sub) return { ok: false, reason: "malformed" };

    const sid = typeof payload.sid === "string" ? payload.sid : undefined;
    if (isRevoked(payload.sub, sid)) return { ok: false, reason: "revoked" };
    if (!isOperatorAllowlisted(payload.sub)) return { ok: false, reason: "not_allowlisted" };

    const acr = typeof payload.acr === "string" ? payload.acr : undefined;
    if (cfg.requireMfa && acr !== cfg.requiredAcr) {
      return { ok: false, reason: "mfa_required" };
    }

    const role = mapSubjectToRole(payload.sub);
    if (!role) return { ok: false, reason: "malformed" };

    return {
      ok: true,
      role,
      claims: {
        sub: payload.sub,
        iss: String(payload.iss),
        aud: payload.aud as string | string[],
        iat: payload.iat,
        exp: payload.exp,
        nbf: payload.nbf,
        sid,
        email: typeof payload.email === "string" ? payload.email : undefined,
        acr,
        amr: Array.isArray(payload.amr) ? (payload.amr as string[]) : undefined,
      },
    };
  } catch (e) {
    const err = e as { code?: string; claim?: string; message?: string };
    const msg = err.message ?? (e instanceof Error ? e.message : "");
    const code = err.code ?? "";
    const claim = err.claim ?? "";
    if (code === "ERR_JWT_EXPIRED" || /expir/i.test(msg)) return { ok: false, reason: "expired" };
    if (code === "ERR_JWT_CLAIM_VALIDATION_FAILED" && (claim === "iss" || /issuer/i.test(msg))) {
      return { ok: false, reason: "wrong_issuer" };
    }
    if (code === "ERR_JWT_CLAIM_VALIDATION_FAILED" && (claim === "aud" || /audience/i.test(msg))) {
      return { ok: false, reason: "wrong_audience" };
    }
    if (claim === "nbf" || /nbf|not.yet/i.test(msg)) return { ok: false, reason: "nbf" };
    if (code === "ERR_JOSE_NOT_SUPPORTED" || /unsupported.*alg|alg.*not/i.test(msg)) {
      return { ok: false, reason: "unsupported_alg" };
    }
    if (code === "ERR_JWKS_NO_MATCHING_KEY" || /no matching|JWKS|unknown.*kid|kid/i.test(msg)) {
      return { ok: false, reason: "unknown_kid" };
    }
    try {
      const raw = authorizationHeader!.slice(7).trim().split(".")[1];
      if (raw) {
        const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
          exp?: number;
          iss?: string;
          aud?: string | string[];
        };
        const now = Math.floor(Date.now() / 1000) - cfg.clockToleranceSec;
        if (typeof payload.exp === "number" && payload.exp < now) {
          return { ok: false, reason: "expired" };
        }
        if (payload.iss && payload.iss !== cfg.issuer) {
          return { ok: false, reason: "wrong_issuer" };
        }
        const aud = payload.aud;
        const audOk = Array.isArray(aud) ? aud.includes(cfg.audience) : aud === cfg.audience;
        if (aud != null && !audOk) return { ok: false, reason: "wrong_audience" };
      }
    } catch {
      /* fall through */
    }
    return { ok: false, reason: "invalid_signature" };
  }
}

export async function issueExpiredFixtureToken(subjectKey: string): Promise<string> {
  await ensureFixtureKeys();
  const cfg = oidcConfig();
  const sub = subjectKey.startsWith("oidc|") ? subjectKey : `oidc|${subjectKey}`;
  const now = Math.floor(Date.now() / 1000);
  const key = activePrivateKey();
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
    .setSubject(sub)
    .setIssuer(cfg.issuer)
    .setAudience(cfg.audience)
    .setIssuedAt(now - 7200)
    .setExpirationTime(now - 3600)
    .sign(key.privateKey);
}

export async function issueWrongIssuerToken(subjectKey: string): Promise<string> {
  await ensureFixtureKeys();
  const cfg = oidcConfig();
  const sub = subjectKey.startsWith("oidc|") ? subjectKey : `oidc|${subjectKey}`;
  const key = activePrivateKey();
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
    .setSubject(sub)
    .setIssuer("https://evil.example/oidc")
    .setAudience(cfg.audience)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key.privateKey);
}

export type { JWTPayload };
