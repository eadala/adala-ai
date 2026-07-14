/**
 * HTTP mapping for GET /api/office(s)/my — authenticated bootstrap only.
 * Never used for public marketplace routes.
 */

import type { OfficePageForUserResult } from "./officePageResolver";

export type GetMyOfficeHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Map resolver outcome to HTTP status + body.
 *
 * - found → 200 full office_page row (private, auth-gated)
 * - trial_pending → 200 soft payload (tenant exists, marketplace page not created)
 * - forbidden → 403
 * - not_found → 404 OFFICE_NOT_FOUND (true missing office)
 */
export function buildGetMyOfficeHttpResult(
  result: OfficePageForUserResult,
): GetMyOfficeHttpResult {
  switch (result.kind) {
    case "found":
      return {
        status: 200,
        body: result.office as unknown as Record<string, unknown>,
      };
    case "trial_pending":
      return {
        status: 200,
        body: {
          /* Soft bootstrap fields — no marketplace page / unpublished payload */
          name: result.officeName ?? null,
          code: "OFFICE_PAGE_NOT_CREATED",
          trialOfficeId: result.trialOfficeId,
          tenantId: result.tenantId,
          marketplacePageCreated: false,
          message:
            "لم يُنشأ صفحة المكتب بعد — أكمل إعداد المكتب أو أنشئ صفحة marketplace",
        },
      };
    case "forbidden":
      return {
        status: 403,
        body: {
          error: "لا يمكن الوصول إلى هذا المكتب",
          code: "TNT_403",
        },
      };
    case "not_found":
      return {
        status: 404,
        body: {
          error: "صفحة المكتب غير موجودة",
          code: "OFFICE_NOT_FOUND",
          tenantId: result.tenantId,
        },
      };
  }
}
