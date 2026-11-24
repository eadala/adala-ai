---
name: Adala Telegram Integration
description: Telegram Bot API integration for notifications and free unlimited file storage
---

# Telegram Integration

## Files
- `artifacts/api-server/src/routes/telegram.ts` — all routes + exported helpers
- `artifacts/adala/src/pages/telegram-settings.tsx` — 4-tab settings page

## DB Tables
- `telegram_settings` — per office: bot_token, chat_id, enabled, notify_cases/invoices/reminders, use_as_storage
- `telegram_logs` — id/office_id/chat_id/message/type/file_id/status/error/sent_at

## Exported Functions (imported by other routes)
- `notifyTelegramCaseStatus(caseData)` — fire-and-forget, call alongside `notifyWhatsAppCaseStatus` in cases.ts PATCH
- `sendTelegramMessage(botToken, chatId, text)` — returns {ok, messageId, error}
- `callTelegramAPI(botToken, method, body)` — raw Bot API caller

## Storage Feature
- `use_as_storage: true` → POST /api/telegram/forward-file forwards file URL to channel
- Telegram stores it; `file_id` returned and logged in telegram_logs
- Max file size: 2GB per file, unlimited total

## Nav
- Icon: `Send` (from lucide-react) — distinct from WhatsApp's `MessageSquare`
- i18n key: `nav.items.telegram` = "تكامل تليجرام"

**Why:** Telegram Bot API is free with no rate limits for notifications; channels = free unlimited cloud storage (unlike S3/object-storage which has cost)
**How to apply:** Other notification trigger points (emailCron, invoice creation) can call `notifyTelegramCaseStatus`-style helpers after importing from telegram.ts
