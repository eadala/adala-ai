import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { ArcRole } from "./types.js";

/**
 * Production-capable OIDC/JWT verification.
 * Local fixture JWKS used when ARC_OIDC_MODE=fixture (default in non-production).
 * Live JWKS via ARC_OIDC_JWKS_URL — reported UNVERIFIED if not configured.
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
  | "live_unconfigured";

let fixturePrivateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"] | null = null;
let fixtureJwks: ReturnType<typeof createLocalJWKSet> | null = null;
let fixtureKid = "arc-fixture-1";

export async function ensureFixtureKeys(): Promise<void> {
  if (fixturePrivateKey && fixtureJwks) return;
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  fixturePrivateKey = privateKey;
  const jwk = await exportJWK(publicKey);
  jwk.kid = fixtureKid;
  jwk.alg = "RS256";
  jwk.use = "sig";
  fixtureJwks = createLocalJWKSet({ keys: [jwk] });
}

export function oidcConfig() {
  return {
    mode: (process.env.ARC_OIDC_MODE ?? "fixture") as "fixture" | "live",
    issuer: process.env.ARC_OIDC_ISSUER ?? "https://arc.local/oidc",
    audience: process.env.ARC_OIDC_AUDIENCE ?? "adalah-arc",
    jwksUrl: process.env.ARC_OIDC_JWKS_URL?.trim() || null,
    clockToleranceSec: Number(process.env.ARC_OIDC_CLOCK_SKEW_SEC ?? 30),
  };
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

export async function issueFixtureAccessToken(
  subjectKey: string,
  opts?: { expiresInSec?: number },
): Promise<string> {
  await ensureFixtureKeys();
  const cfg = oidcConfig();
  const sub = subjectKey.startsWith("oidc|") ? subjectKey : `oidc|${subjectKey}`;
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: fixtureKid, typ: "JWT" })
    .setSubject(sub)
    .setIssuer(cfg.issuer)
    .setAudience(cfg.audience)
    .setIssuedAt()
    .setExpirationTime(`${opts?.expiresInSec ?? 3600}s`)
    .sign(fixturePrivateKey!);
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
      /* Live JWKS — only when explicitly configured; Phase 2B local tests use fixture */
      const { createRemoteJWKSet } = await import("jose");
      jwks = createRemoteJWKSet(new URL(cfg.jwksUrl));
    } else {
      await ensureFixtureKeys();
      jwks = fixtureJwks!;
    }

    const { payload, protectedHeader } = await jwtVerify(token, jwks!, {
      issuer: cfg.issuer,
      audience: cfg.audience,
      algorithms: ["RS256"],
      clockTolerance: cfg.clockToleranceSec,
    });

    if (protectedHeader.alg !== "RS256") return { ok: false, reason: "unsupported_alg" };
    if (!payload.sub) return { ok: false, reason: "malformed" };

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
        sid: typeof payload.sid === "string" ? payload.sid : undefined,
        email: typeof payload.email === "string" ? payload.email : undefined,
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
    if (code === "ERR_JOSE_NOT_SUPPORTED" || /alg/i.test(msg)) {
      return { ok: false, reason: "unsupported_alg" };
    }
    if (code === "ERR_JWKS_NO_MATCHING_KEY" || /JWKS|key|kid/i.test(msg)) {
      return { ok: false, reason: "unknown_kid" };
    }
    /* Decode payload without verify for claim classification when JWS lib mis-orders errors */
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
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: fixtureKid })
    .setSubject(sub)
    .setIssuer(cfg.issuer)
    .setAudience(cfg.audience)
    .setIssuedAt(now - 7200)
    .setExpirationTime(now - 3600)
    .sign(fixturePrivateKey!);
}

export async function issueWrongIssuerToken(subjectKey: string): Promise<string> {
  await ensureFixtureKeys();
  const cfg = oidcConfig();
  const sub = subjectKey.startsWith("oidc|") ? subjectKey : `oidc|${subjectKey}`;
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: fixtureKid })
    .setSubject(sub)
    .setIssuer("https://evil.example/oidc")
    .setAudience(cfg.audience)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(fixturePrivateKey!);
}

export type { JWTPayload };
