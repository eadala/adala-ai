---
name: Adala Electronic Signatures
description: e-signature flow — document_signatures table, /api/signatures/* routes, public /sign/:token page
---

# Adala Electronic Signatures

## DB Table
`document_signatures` — id, document_id, signer_name, signer_email, token (UUID), status (pending/signed/declined), signed_at, ip_address, created_at

## Routes (signatures.ts → registered in index.ts)
- POST /api/signatures/request — create signature request for a legal_document (by documentId); returns signUrl
- GET  /api/signatures/token/:token — public fetch (no auth) — returns doc content + signer info
- POST /api/signatures/token/:token — public sign — sets status=signed, signed_at, ip_address
- GET  /api/signatures/document/:docId — list all signatures for a document (auth required)

## Frontend
- /sign/:token — public page (no Clerk auth); shows document content + signature pad (canvas); submit calls POST token route
- legal-ai.tsx — "توقيع" button appears after document generation (when generatedId is set); opens dialog to enter signer name/email; calls POST /signatures/request; shows copy-able signUrl

## Key Notes
- signUrl = `${origin}/sign/${token}` (built server-side using req.protocol + req.get("host"))
- generatedId in legal-ai.tsx is now correctly set from `data.id` (was incorrectly null before)
- No auth on /sign/:token routes — they are public by design
