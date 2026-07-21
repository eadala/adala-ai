/**
 * Payment DB helpers — fail closed (log + rethrow) instead of empty-array
 * false success used by the former payments.ts `rows()` helper.
 */
import { logger } from "./logger";

export async function paymentDbRows(
  execute: (q: unknown) => Promise<unknown>,
  q: unknown,
): Promise<Record<string, unknown>[]> {
  try {
    const r = (await execute(q)) as unknown;
    if (Array.isArray(r)) return r as Record<string, unknown>[];
    const rows = (r as { rows?: Record<string, unknown>[] } | null)?.rows;
    return rows ?? [];
  } catch (err) {
    logger.error({ err }, "[payments] DB query failed");
    throw err;
  }
}

/** Side-effect failures (event bus, etc.) after a successful payment write — log, do not invent success. */
export function logPaymentSideEffectFailure(
  context: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  logger.error({ err, ...extra }, `[payments] ${context}`);
}
