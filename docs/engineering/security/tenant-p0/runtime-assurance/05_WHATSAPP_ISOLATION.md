# WhatsApp Isolation Closure

## Root cause

1. Unsigned webhooks could be processed when `WHATSAPP_APP_SECRET` unset (fail-open).  
2. Status updates keyed only by provider `external_id` could cross tenants.  

## Remediation

File: `artifacts/api-server/src/modules/integrations/webhook.ts`

- Fail closed if `WHATSAPP_APP_SECRET` missing or signature invalid.  
- Map `phone_number_id` → `whatsapp_settings.office_id` before insert.  
- Status updates require `and(eq(externalId), eq(officeId))`.  
- `messages.officeId` retained in schema.

## Runtime evidence

| Test ID | Result |
|---|---|
| WHATSAPP_UNSIGNED | HTTP 403 |
| WHATSAPP_CROSS_STATUS | HTTP 200 ack; msg-a status remains `received` |

Provider message identifiers do not grant access to another tenant’s conversation.
