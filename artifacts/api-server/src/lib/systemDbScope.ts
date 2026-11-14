/**
 * Privileged DB scope for platform cron/workers (INV-008).
 * Always clears to fail-closed sentinel in finally — same client best-effort
 * via pool GUC guard on release.
 */
export async function withSystemDbScope<T>(fn: () => Promise<T>): Promise<T> {
  const { setBypassRlsSession, clearTenantSessionFailClosed } = await import("./tenantSession");
  await setBypassRlsSession();
  try {
    return await fn();
  } finally {
    await clearTenantSessionFailClosed().catch(() => {});
  }
}
