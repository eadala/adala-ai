/**
 * Gemini Generative Language API — authentication helpers.
 *
 * Google-recommended auth: `x-goog-api-key` header (not `?key=` query).
 * Keys are always trimmed so Coolify/env whitespace cannot poison the credential.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Trimmed GEMINI_API_KEY, or undefined when missing/blank. */
export function getGeminiApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || undefined;
}

export function geminiGenerateContentUrl(model: string): string {
  return `${GEMINI_API_BASE}/${model}:generateContent`;
}

/** SSE stream endpoint — auth via header, not query. */
export function geminiStreamGenerateContentUrl(model: string): string {
  return `${GEMINI_API_BASE}/${model}:streamGenerateContent?alt=sse`;
}

/**
 * JSON + API-key headers for Gemini REST calls.
 * @throws if no usable GEMINI_API_KEY
 */
export function geminiApiHeaders(apiKey?: string): Record<string, string> {
  const key = (apiKey ?? getGeminiApiKey())?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY غير متوفر");
  }
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": key,
  };
}
