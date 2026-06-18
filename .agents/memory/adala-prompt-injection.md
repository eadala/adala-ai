---
name: Adala Prompt Injection Guard
description: Central prompt sanitization layer in callAI() — patterns, guard prompt, audit logging
---

## Location
`artifacts/api-server/src/core/promptSanitizer.ts`

## What it does
- `sanitizePrompt(input)` — runs 25 regex patterns, replaces matches with `[محتوى محظور]`, strips control chars, truncates at 8000 chars
- `SYSTEM_PROMPT_GUARD` — multi-line Arabic guard text prepended to EVERY systemPrompt in `callAI()`
- `logInjectionAttempt(officeId, userId, originalInput, patterns)` — writes to `audit_logs` table (action=PROMPT_INJECTION_ATTEMPT)

## Integration in callAI()
```typescript
// At top of callAI() — BEFORE any model is called
const { sanitized: safeMessage, wasInjectionAttempt, detectedPatterns } = sanitizePrompt(userMessage);
if (wasInjectionAttempt) {
  logInjectionAttempt(officeId, userId, userMessage, detectedPatterns).catch(() => {});
  return { reply: "⚠️ تم اكتشاف محاولة تجاوز...", modelUsed: "security-block", tier: "cheap" };
}
const guardedSystemPrompt = `${SYSTEM_PROMPT_GUARD}\n\n${systemPrompt}`;
// All model calls use guardedSystemPrompt + safeMessage (NOT original systemPrompt/userMessage)
```

## Patterns blocked (25)
- ignore/disregard/forget previous instructions
- system: / assistant: prefixes
- developer mode, jailbreak
- reveal/print/show prompt
- export memory
- cross-office access attempts
- bypass auth/security/isolation
- HTML script tags
- LLM injection markers: <<SYS>>, [INST], [/INST], ###instruction

**Why:** LLM systems are vulnerable to prompt injection where user input overrides system instructions. All AI entry points in عدالة must pass through this sanitizer to prevent data leakage across offices.

**How to apply:** `callAI()` signature now has optional 7th param `userId: string = "unknown"` for audit logging. Pass req auth userId when available.
