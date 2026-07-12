/**
 * Authorization error contracts — stable codes for clients and audit.
 */
export const AUTH_ERROR_CODES = {
  AUTH_401: "AUTH_401",
  AUTH_403: "AUTH_403",
  AUTHZ_CONTEXT_MISSING: "AUTHZ_CONTEXT_MISSING",
  AUTHZ_MEMBERSHIP_REQUIRED: "AUTHZ_MEMBERSHIP_REQUIRED",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export interface AuthorizationErrorBody {
  error: string;
  code: AuthErrorCode;
  required?: string | string[];
  role?: string;
  officeId?: string;
}

export function authorizationDeniedResponse(
  permission: string | string[],
  opts?: { role?: string; officeId?: string; message?: string },
): AuthorizationErrorBody {
  return {
    error: opts?.message ?? "ليس لديك صلاحية تنفيذ هذا الإجراء",
    code: AUTH_ERROR_CODES.AUTH_403,
    required: permission,
    role: opts?.role,
    officeId: opts?.officeId,
  };
}

export function authorizationContextMissingResponse(): AuthorizationErrorBody {
  return {
    error: "سياق التفويض مفقود — يجب استدعاء requireAuthWithTenant أولاً",
    code: AUTH_ERROR_CODES.AUTHZ_CONTEXT_MISSING,
  };
}

export function membershipRequiredResponse(officeId?: string): AuthorizationErrorBody {
  return {
    error: "عضوية المكتب غير موجودة أو غير فعّالة",
    code: AUTH_ERROR_CODES.AUTHZ_MEMBERSHIP_REQUIRED,
    officeId,
  };
}
