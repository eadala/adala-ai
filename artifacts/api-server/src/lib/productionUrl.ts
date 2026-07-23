/**
 * Canonical public base URL for production callbacks, webhooks, and emails.
 * Requires PRODUCTION_URL or APP_URL — no hardcoded domain fallbacks.
 */

const MISSING_MSG =
  "PRODUCTION_URL أو APP_URL غير مضبوط — عيّن عنوان النطاق العام للتطبيق في متغيرات البيئة";

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Returns normalized base URL, or null when unset and not required. */
export function getProductionBaseUrl(options: { required?: boolean } = {}): string | null {
  const raw = process.env.PRODUCTION_URL ?? process.env.APP_URL;
  if (!raw?.trim()) {
    if (options.required) throw new Error(MISSING_MSG);
    return null;
  }
  return normalizeBaseUrl(raw);
}

/** Throws when PRODUCTION_URL / APP_URL is missing. */
export function requireProductionBaseUrl(): string {
  return getProductionBaseUrl({ required: true })!;
}
