/**
 * Stage 9 — /internal/heal Bearer secret resolution.
 * Production must not fall back to a hard-coded default.
 */

export type HealSecretResolution =
  | { ok: true; secret: string }
  | { ok: false; reason: "missing_in_production" | "too_short" };

const MIN_LEN = 12;

/**
 * Resolve HEAL_SECRET for the heal webhook.
 * - production: require a real env value (fail closed if missing/empty)
 * - non-production: allow default only for local/dev convenience
 */
export function resolveHealSecret(
  env: NodeJS.ProcessEnv = process.env,
): HealSecretResolution {
  const raw = env.HEAL_SECRET;
  const configured = typeof raw === "string" ? raw.trim() : "";
  const isProduction = env.NODE_ENV === "production";

  if (!configured) {
    if (isProduction) {
      return { ok: false, reason: "missing_in_production" };
    }
    return { ok: true, secret: "adala-heal-token" };
  }

  if (configured.length < MIN_LEN) {
    return { ok: false, reason: "too_short" };
  }

  return { ok: true, secret: configured };
}
