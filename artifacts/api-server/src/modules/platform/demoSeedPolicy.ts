/** Pure Demo seed policy helpers (no DB import). */

/** Optional Demo seed — off in production unless DEMO_SEED_ENABLED=true. */
export function isDemoSeedEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.DEMO_SEED_ENABLED === "true") return true;
  if (env.DEMO_SEED_ENABLED === "false") return false;
  return env.NODE_ENV !== "production";
}

export function classifyDemoSeedError(err: unknown): {
  code: string | null;
  reason: string;
} {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  const code = e?.code ?? e?.cause?.code ?? null;
  const message = String(e?.message ?? e?.cause ?? err ?? "");

  if (code === "42703" || /column .* does not exist/i.test(message)) {
    return { code: code ?? "42703", reason: "undefined_column" };
  }
  if (code === "42P01" || /relation .* does not exist/i.test(message)) {
    return { code: code ?? "42P01", reason: "undefined_table" };
  }
  if (code === "23503" || /foreign key/i.test(message)) {
    return { code: code ?? "23503", reason: "foreign_key_violation" };
  }
  if (code === "23505" || /duplicate key/i.test(message)) {
    return { code: code ?? "23505", reason: "unique_violation" };
  }
  return { code, reason: "seed_failed" };
}
