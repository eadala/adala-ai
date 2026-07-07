/**
 * @deprecated Use core/tenant/dataAccess.ts — getRequiredTenantId + tenantDB
 *
 * Legacy Zero Trust query wrapper. Injects and validates tenant isolation for DB calls.
 */
import type { Request } from "express";

const MAX_EXPORT_ROWS = 500;

export function getTenantId(req: Request): string {
  const tid = (req as any).tenantId as string | undefined;
  if (!tid || tid === "platform") {
    throw Object.assign(new Error("MISSING_TENANT_CONTEXT"), { statusCode: 403 });
  }
  return tid;
}

export async function tenantQuery<T>(
  req: Request,
  queryFn: (tenantId: string) => Promise<T>
): Promise<T> {
  const tenantId = getTenantId(req);
  return queryFn(tenantId);
}

/**
 * tenantExport — same as tenantQuery but enforces MAX 500 rows.
 * Use for any data export endpoint.
 */
export async function tenantExport<T>(
  req: Request,
  queryFn: (tenantId: string, limit: number) => Promise<T>
): Promise<T> {
  const tenantId = getTenantId(req);
  const requestedLimit = Math.min(
    parseInt(String((req.query.limit ?? MAX_EXPORT_ROWS))) || MAX_EXPORT_ROWS,
    MAX_EXPORT_ROWS
  );
  return queryFn(tenantId, requestedLimit);
}

export { MAX_EXPORT_ROWS };
