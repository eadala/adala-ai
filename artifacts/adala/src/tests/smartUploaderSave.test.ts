/**
 * Documents SmartUploader — Save must be able to dispatch upload requests.
 * Run: pnpm --filter @workspace/adala run test:smart-uploader-save
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getUploadDispatchGate,
  normalizeUploadFile,
  resolveUploadMime,
} from "../lib/smartUploaderCore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploaderSrc = readFileSync(
  resolve(__dirname, "../components/smart-uploader.tsx"),
  "utf8",
);

console.log("\n═══ smartUploader: MIME resolution (empty File.type) ═══");

assert.equal(
  resolveUploadMime({ name: "report.pdf", type: "" }),
  "application/pdf",
  "empty type + .pdf → application/pdf",
);
console.log("  ✅ empty MIME + .pdf resolves");

assert.equal(
  resolveUploadMime({ name: "scan.PDF", type: "application/octet-stream" }),
  "application/pdf",
  "octet-stream + .PDF → application/pdf",
);
console.log("  ✅ octet-stream + extension resolves");

assert.equal(
  resolveUploadMime({
    name: "brief.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
);
console.log("  ✅ allowlisted MIME passes through");

assert.equal(
  resolveUploadMime({ name: "malware.exe", type: "" }),
  null,
  "blocked extension → null",
);
console.log("  ✅ unsupported extension rejected");

assert.equal(
  resolveUploadMime({ name: "notes", type: "" }),
  null,
  "no extension → null",
);
console.log("  ✅ nameless/no-ext rejected");

console.log("\n═══ smartUploader: normalizeUploadFile ═══");

const barePdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "a.pdf", {
  type: "",
});
const normalized = normalizeUploadFile(barePdf);
assert.ok(normalized, "normalize returns File for .pdf with empty type");
if (!normalized) throw new Error("expected normalized file");
assert.equal(normalized.type, "application/pdf");
assert.equal(normalized.name, "a.pdf");
console.log("  ✅ File with empty type normalized for API contentType");

assert.equal(
  normalizeUploadFile(new File([new Uint8Array([1])], "x.exe", { type: "" })),
  null,
);
console.log("  ✅ unsupported file normalize → null");

console.log("\n═══ smartUploader: Save dispatch gate ═══");

assert.deepEqual(
  getUploadDispatchGate({ busy: true, items: [{ status: "queued" }] }),
  { ok: false, reason: "busy" },
);
console.log("  ✅ busy blocks dispatch");

assert.deepEqual(
  getUploadDispatchGate({ busy: false, items: [{ status: "done" }] }),
  { ok: false, reason: "empty_queue" },
);
console.log("  ✅ no queued items → empty_queue (must not fetch)");

assert.deepEqual(
  getUploadDispatchGate({
    busy: false,
    items: [{ status: "error" }, { status: "queued" }],
  }),
  { ok: true, pendingCount: 1 },
);
console.log("  ✅ queued item allows dispatch");

console.log("\n═══ smartUploader.tsx wiring ═══");

assert.match(
  uploaderSrc,
  /from "@\/lib\/authFetch"/,
  "SmartUploader must import authFetch",
);
assert.match(
  uploaderSrc,
  /authFetch\(`\$\{BASE\}\/api\/storage\/uploads\/request-url`/,
  "request-url must use authFetch so Save actually reaches a protected API",
);
assert.match(
  uploaderSrc,
  /authFetch\(`\$\{BASE\}\/api\/storage\/files`/,
  "register must use authFetch",
);
assert.doesNotMatch(
  uploaderSrc,
  /await fetch\(`\$\{BASE\}\/api\/storage\/uploads\/request-url`/,
  "bare fetch must not be used for request-url (auth regression)",
);
assert.match(
  uploaderSrc,
  /normalizeUploadFile/,
  "addFiles must normalize MIME via shared helper",
);
assert.match(
  uploaderSrc,
  /getUploadDispatchGate/,
  "uploadAll must use the shared dispatch gate",
);
assert.match(
  uploaderSrc,
  /data-testid="smart-uploader-save"/,
  "Save CTA must remain identifiable",
);
assert.match(
  uploaderSrc,
  /> حفظ/,
  'primary CTA label must be "حفظ" (Documents upload dialog)',
);
assert.match(
  uploaderSrc,
  /type="button"/,
  "action buttons must set type=button",
);
console.log("  ✅ authFetch + MIME normalize + Save CTA wired");

console.log("\n✅ smartUploaderSave: all checks passed\n");
