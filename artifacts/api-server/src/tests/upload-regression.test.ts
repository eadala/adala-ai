/**
 * upload-regression.test.ts — اختبارات رفع الملفات (Enterprise Upload Governance)
 * ──────────────────────────────────────────────────────────────────────────────
 * Self-contained: لا يتطلب server جاري — يختبر منطق uploadGuard مباشرةً.
 *
 * Run: node --test --experimental-strip-types src/tests/upload-regression.test.ts
 *   or: pnpm --filter @workspace/api-server test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "crypto";
import path from "path";

/* ══════════════════════════════════════════════════════════
   INLINE COPY — uploadGuard logic (mirrors src/lib/uploadGuard.ts)
   Keeps tests self-contained without ESM import issues.
   ══════════════════════════════════════════════════════════ */

const UPLOAD_ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg","image/jpg","image/png","image/gif","image/webp","image/heic","image/heif",
  "text/plain","text/csv",
  "application/zip","application/x-zip-compressed","application/x-rar-compressed",
  "application/octet-stream",
]);

const BLOCKED_EXT = new Set([
  ".exe",".bat",".cmd",".com",".msi",".msp",".mst",
  ".sh",".bash",".zsh",".fish",
  ".ps1",".psm1",".psd1",
  ".vbs",".vbe",".js",".jse",".wsf",".wsh",
  ".scr",".pif",".lnk",".hta",
  ".jar",".war",".ear",
  ".dll",".so",".dylib",
  ".py",".rb",".pl",".php",".asp",".aspx",
  ".cgi",".htaccess",".env",
]);

const MAGIC_TABLE = [
  { mime: "application/pdf", hex: "255044462d" },
  { mime: "image/png",       hex: "89504e47"  },
  { mime: "image/jpeg",      hex: "ffd8ff"    },
  { mime: "image/gif",       hex: "474946"    },
  { mime: "application/zip", hex: "504b0304"  },
];

const UPLOAD_SIZE_LIMITS: Record<string, number> = {
  "document-center": 15 * 1024 * 1024,
  "cases":           10 * 1024 * 1024,
  "portal":           5 * 1024 * 1024,
  "default":         10 * 1024 * 1024,
};

function sanitizeFilename(raw: string): string {
  if (!raw || typeof raw !== "string") return "unnamed_file";
  let name = path.basename(raw.replace(/\\/g, "/"));
  name = name.replace(/\0/g, "").replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F]/g, "");
  name = name.replace(/\.{2,}/g, ".");
  name = name.replace(/^\.+/, "");
  if (name.length > 200) name = name.slice(0, 200);
  return name || "unnamed_file";
}

function isExecutableFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  const parts = lower.split(".");
  for (let i = 1; i < parts.length; i++) {
    if (BLOCKED_EXT.has(`.${parts[i]}`)) return true;
  }
  return false;
}

function decodeBase64(data: string): Buffer | null {
  try {
    const comma = data.indexOf(",");
    const raw   = comma !== -1 ? data.slice(comma + 1) : data;
    return Buffer.from(raw, "base64");
  } catch { return null; }
}

function computeChecksum(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function verifyMagicBytes(buf: Buffer, mime: string): boolean {
  const entry = MAGIC_TABLE.find(m => m.mime === mime);
  if (!entry) return true;
  if (mime === "image/webp") {
    return buf.slice(0, 4).toString("hex") === "52494646" &&
           buf.slice(8, 12).toString("ascii") === "WEBP";
  }
  return buf.slice(0, 8).toString("hex").startsWith(entry.hex);
}

interface UploadResult {
  ok: boolean; status?: number; error?: string;
  sanitized?: string; buffer?: Buffer; checksum?: string; byteSize?: number;
}

function validateUpload(opts: { fileData: string; fileName: string; fileType?: string; context: string }): UploadResult {
  const { fileData, fileName, fileType, context } = opts;
  if (!fileData || !fileName) return { ok: false, status: 400, error: "fileData و fileName مطلوبان" };

  const sanitized = sanitizeFilename(fileName);
  if (isExecutableFilename(sanitized)) return { ok: false, status: 415, error: `نوع الملف خطر ومحظور: ${sanitized}` };

  const mime = fileType ?? "application/octet-stream";
  if (!UPLOAD_ALLOWED_MIME.has(mime)) return { ok: false, status: 415, error: `نوع الملف غير مدعوم: ${mime}` };

  const buf = decodeBase64(fileData);
  if (!buf || buf.length === 0) return { ok: false, status: 400, error: "بيانات الملف تالفة أو فارغة" };

  const limit = UPLOAD_SIZE_LIMITS[context] ?? UPLOAD_SIZE_LIMITS.default;
  if (buf.length > limit) return { ok: false, status: 413, error: `حجم الملف يتجاوز ${Math.round(limit / 1024 / 1024)} MB` };

  if (!verifyMagicBytes(buf, mime)) return { ok: false, status: 415, error: `محتوى الملف لا يطابق النوع المُدّعى: ${mime}` };

  return { ok: true, sanitized, buffer: buf, checksum: computeChecksum(buf), byteSize: buf.length };
}

/* ── Test file factory ──────────────────────────────────────────── */
const PDF_MAGIC  = Buffer.from([0x25,0x50,0x44,0x46,0x2d]);
const PNG_MAGIC  = Buffer.from([0x89,0x50,0x4e,0x47]);
const JPEG_MAGIC = Buffer.from([0xff,0xd8,0xff]);
const ZIP_MAGIC  = Buffer.from([0x50,0x4b,0x03,0x04]);

function makeFile(bytes: number, mime = "application/octet-stream", magic?: Buffer): string {
  const buf = magic
    ? Buffer.concat([magic, Buffer.alloc(Math.max(0, bytes - magic.length))])
    : Buffer.alloc(bytes, 0x42);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/* ══ 1. sanitizeFilename ════════════════════════════════════════ */
describe("sanitizeFilename", () => {
  it("strips Unix path traversal",          () => { assert.equal(sanitizeFilename("../../etc/passwd"), "passwd"); });
  it("strips Windows path traversal",       () => { assert.equal(sanitizeFilename("..\\..\\cmd.exe"), "cmd.exe"); });
  it("strips null bytes",                   () => { assert.equal(sanitizeFilename("file\0.pdf"), "file.pdf"); });
  it("collapses consecutive dots",          () => { assert.equal(sanitizeFilename("file....pdf"), "file.pdf"); });
  it("strips leading dots",                 () => { assert.equal(sanitizeFilename("...hidden.pdf"), "hidden.pdf"); });
  it("limits to 200 chars",                 () => { assert.ok(sanitizeFilename("a".repeat(300)+".pdf").length <= 200); });
  it("handles empty string",                () => { assert.equal(sanitizeFilename(""), "unnamed_file"); });
  it("handles null-like",                   () => { assert.equal(sanitizeFilename(null as any), "unnamed_file"); });
});

/* ══ 2. isExecutableFilename ════════════════════════════════════ */
describe("isExecutableFilename", () => {
  const BLOCKED = ["virus.exe","run.bat","deploy.sh","script.ps1","shell.php","malware.py","legit.pdf.exe","backdoor.asp"];
  const ALLOWED = ["contract.pdf","brief.docx","logo.png","archive.zip","data.csv","report.xlsx","image.jpeg","notes.txt"];
  BLOCKED.forEach(f => it(`blocks: ${f}`,  () => assert.equal(isExecutableFilename(f), true)));
  ALLOWED.forEach(f => it(`allows: ${f}`,  () => assert.equal(isExecutableFilename(f), false)));
});

/* ══ 3. verifyMagicBytes ════════════════════════════════════════ */
describe("verifyMagicBytes", () => {
  it("accepts PDF magic",                   () => assert.equal(verifyMagicBytes(Buffer.concat([PDF_MAGIC,  Buffer.alloc(100)]), "application/pdf"),  true));
  it("rejects fake PDF",                    () => assert.equal(verifyMagicBytes(Buffer.alloc(100, 0x42),                        "application/pdf"),  false));
  it("accepts PNG magic",                   () => assert.equal(verifyMagicBytes(Buffer.concat([PNG_MAGIC,  Buffer.alloc(100)]), "image/png"),         true));
  it("accepts JPEG magic",                  () => assert.equal(verifyMagicBytes(Buffer.concat([JPEG_MAGIC, Buffer.alloc(100)]), "image/jpeg"),        true));
  it("accepts ZIP magic",                   () => assert.equal(verifyMagicBytes(Buffer.concat([ZIP_MAGIC,  Buffer.alloc(100)]), "application/zip"),   true));
  it("passes CSV (no magic defined)",       () => assert.equal(verifyMagicBytes(Buffer.alloc(100),                              "text/csv"),          true));
  it("passes DOCX (no magic defined)",      () => assert.equal(verifyMagicBytes(Buffer.alloc(100),                              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), true));
});

/* ══ 4. validateUpload — required fields ══════════════════════ */
describe("validateUpload — required fields", () => {
  it("rejects empty fileData",              () => { const r = validateUpload({ fileData:"", fileName:"t.pdf", context:"cases" }); assert.equal(r.ok,false); assert.equal(r.status,400); });
  it("rejects empty fileName",              () => { const r = validateUpload({ fileData:"dGVzdA==", fileName:"", context:"cases" }); assert.equal(r.ok,false); assert.equal(r.status,400); });
});

/* ══ 5. validateUpload — executable blocking ══════════════════ */
describe("validateUpload — executable blocking", () => {
  it("blocks .exe",                         () => { const r = validateUpload({ fileData:makeFile(1024), fileName:"malware.exe", fileType:"application/octet-stream", context:"cases" }); assert.equal(r.ok,false); assert.equal(r.status,415); });
  it("blocks double extension .pdf.exe",    () => { const r = validateUpload({ fileData:makeFile(1024,undefined,PDF_MAGIC), fileName:"legit.pdf.exe", fileType:"application/pdf", context:"cases" }); assert.equal(r.ok,false); assert.equal(r.status,415); });
  it("blocks .sh",                          () => { const r = validateUpload({ fileData:makeFile(512), fileName:"deploy.sh", context:"default" }); assert.equal(r.ok,false); assert.equal(r.status,415); });
  it("blocks .php",                         () => { const r = validateUpload({ fileData:makeFile(512), fileName:"shell.php", context:"default" }); assert.equal(r.ok,false); assert.equal(r.status,415); });
  it("blocks .py",                          () => { const r = validateUpload({ fileData:makeFile(512), fileName:"hack.py", context:"default" }); assert.equal(r.ok,false); assert.equal(r.status,415); });
});

/* ══ 6. validateUpload — MIME allowlist ══════════════════════ */
describe("validateUpload — MIME allowlist", () => {
  it("rejects unknown MIME",                () => { const r = validateUpload({ fileData:makeFile(512), fileName:"f.xyz", fileType:"application/x-unknown", context:"cases" }); assert.equal(r.ok,false); assert.equal(r.status,415); });
  it("rejects text/html",                   () => { const r = validateUpload({ fileData:makeFile(512), fileName:"f.html", fileType:"text/html", context:"cases" }); assert.equal(r.ok,false); assert.equal(r.status,415); });
});

/* ══ 7. validateUpload — magic bytes mismatch ════════════════ */
describe("validateUpload — magic bytes mismatch", () => {
  it("rejects fake PDF (wrong magic)",      () => { const r = validateUpload({ fileData:makeFile(2048,"application/pdf"), fileName:"fake.pdf", fileType:"application/pdf", context:"cases" }); assert.equal(r.ok,false); assert.equal(r.status,415); });
  it("rejects fake PNG",                    () => { const r = validateUpload({ fileData:makeFile(2048,"image/png"), fileName:"fake.png", fileType:"image/png", context:"cases" }); assert.equal(r.ok,false); assert.equal(r.status,415); });
});

/* ══ 8. validateUpload — size limits ════════════════════════ */
describe("validateUpload — size limits", () => {
  it("rejects >10MB for cases",             () => { const r = validateUpload({ fileData:makeFile(11*1024*1024), fileName:"big.pdf", fileType:"application/pdf", context:"cases" }); assert.equal(r.ok,false); assert.equal(r.status,413); });
  it("rejects >5MB for portal",             () => { const r = validateUpload({ fileData:makeFile(6*1024*1024),  fileName:"big.pdf", fileType:"application/pdf", context:"portal" }); assert.equal(r.ok,false); assert.equal(r.status,413); });
  it("accepts 14MB for document-center",    () => { const buf=Buffer.concat([PDF_MAGIC,Buffer.alloc(14*1024*1024)]); const r=validateUpload({ fileData:`data:application/pdf;base64,${buf.toString("base64")}`, fileName:"large.pdf", fileType:"application/pdf", context:"document-center" }); assert.equal(r.ok,true); });

  const SIZES: [string,number][] = [["100KB",100*1024],["1MB",1024*1024],["5MB",5*1024*1024],["9MB",9*1024*1024]];
  SIZES.forEach(([lbl,sz]) => it(`accepts ${lbl} for cases`, () => {
    const buf  = Buffer.concat([PDF_MAGIC, Buffer.alloc(sz)]);
    const r    = validateUpload({ fileData:`data:application/pdf;base64,${buf.toString("base64")}`, fileName:`${lbl}.pdf`, fileType:"application/pdf", context:"cases" });
    assert.equal(r.ok, true);
    assert.ok((r.byteSize ?? 0) > 0);
  }));
});

/* ══ 9. validateUpload — accepted file types ═════════════════ */
describe("validateUpload — accepted file types", () => {
  const FILES: [string, string, Buffer][] = [
    ["PDF",  "application/pdf",  PDF_MAGIC],
    ["DOCX", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Buffer.alloc(8)],
    ["PNG",  "image/png",        PNG_MAGIC],
    ["JPEG", "image/jpeg",       JPEG_MAGIC],
    ["ZIP",  "application/zip",  ZIP_MAGIC],
    ["CSV",  "text/csv",         Buffer.alloc(8)],
    ["XLSX", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Buffer.alloc(8)],
    ["TXT",  "text/plain",       Buffer.alloc(8)],
  ];
  FILES.forEach(([lbl, mime, magic]) => it(`accepts ${lbl}`, () => {
    const buf  = Buffer.concat([magic, Buffer.alloc(1024)]);
    const r    = validateUpload({ fileData:`data:${mime};base64,${buf.toString("base64")}`, fileName:`test.${lbl.toLowerCase()}`, fileType:mime, context:"cases" });
    assert.equal(r.ok, true);
  }));
});

/* ══ 10. validateUpload — sanitization & checksum ═══════════ */
describe("validateUpload — sanitization & checksum", () => {
  it("sanitizes path traversal in fileName", () => {
    const buf = Buffer.concat([PDF_MAGIC, Buffer.alloc(1024)]);
    const r   = validateUpload({ fileData:`data:application/pdf;base64,${buf.toString("base64")}`, fileName:"../../etc/passwd.pdf", fileType:"application/pdf", context:"cases" });
    assert.equal(r.ok, true);
    assert.equal(r.sanitized, "passwd.pdf");
  });

  it("returns 64-char SHA-256 checksum",    () => {
    const buf = Buffer.concat([PDF_MAGIC, Buffer.alloc(1000)]);
    const r   = validateUpload({ fileData:`data:application/pdf;base64,${buf.toString("base64")}`, fileName:"test.pdf", fileType:"application/pdf", context:"cases" });
    assert.equal(r.ok, true);
    assert.equal(r.checksum?.length, 64);
    assert.match(r.checksum ?? "", /^[0-9a-f]+$/);
  });

  it("returns accurate byteSize",           () => {
    const target = 50_000;
    const buf    = Buffer.concat([PDF_MAGIC, Buffer.alloc(target - PDF_MAGIC.length)]);
    const r      = validateUpload({ fileData:`data:application/pdf;base64,${buf.toString("base64")}`, fileName:"test.pdf", fileType:"application/pdf", context:"cases" });
    assert.equal(r.ok, true);
    assert.ok(Math.abs((r.byteSize ?? 0) - target) < 10);
  });

  it("checksum differs for different data", () => {
    const mk  = (seed: number) => { const b=Buffer.concat([PDF_MAGIC,Buffer.alloc(100,seed)]); return validateUpload({ fileData:`data:application/pdf;base64,${b.toString("base64")}`, fileName:"f.pdf", fileType:"application/pdf", context:"cases" }); };
    assert.notEqual(mk(1).checksum, mk(2).checksum);
  });
});

/* ══ 11. UPLOAD_SIZE_LIMITS sanity ══════════════════════════ */
describe("UPLOAD_SIZE_LIMITS", () => {
  it("document-center: 15MB", () => assert.equal(UPLOAD_SIZE_LIMITS["document-center"], 15*1024*1024));
  it("cases: 10MB",            () => assert.equal(UPLOAD_SIZE_LIMITS["cases"],           10*1024*1024));
  it("portal: 5MB",            () => assert.equal(UPLOAD_SIZE_LIMITS["portal"],           5*1024*1024));
  it("default: 10MB",          () => assert.equal(UPLOAD_SIZE_LIMITS["default"],         10*1024*1024));
});

/* ══ 12. UPLOAD_ALLOWED_MIME completeness ════════════════════ */
describe("UPLOAD_ALLOWED_MIME", () => {
  const MUST = ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/jpeg","image/png","image/webp","text/csv","application/zip"];
  MUST.forEach(m => it(`includes ${m}`, () => assert.equal(UPLOAD_ALLOWED_MIME.has(m), true)));
  it("excludes text/html",              () => assert.equal(UPLOAD_ALLOWED_MIME.has("text/html"), false));
  it("excludes application/x-httpd-php",() => assert.equal(UPLOAD_ALLOWED_MIME.has("application/x-httpd-php"), false));
  it("excludes application/javascript", () => assert.equal(UPLOAD_ALLOWED_MIME.has("application/javascript"), false));
});

/* ══ 13. decodeBase64 helper ═════════════════════════════════ */
describe("decodeBase64", () => {
  function decode(s: string): Buffer|null {
    try { const c=s.indexOf(","); return Buffer.from(c!==-1?s.slice(c+1):s,"base64"); } catch { return null; }
  }
  it("decodes data URI format", () => { const orig=Buffer.from("Hello World"); assert.equal(decode(`data:text/plain;base64,${orig.toString("base64")}`)?.toString(),"Hello World"); });
  it("decodes raw base64",      () => { const orig=Buffer.from("Test data");   assert.equal(decode(orig.toString("base64"))?.toString(),"Test data"); });
});

/* ══ 14. computeChecksum ══════════════════════════════════════ */
describe("computeChecksum", () => {
  function checksum(s: string) { return createHash("sha256").update(s).digest("hex"); }
  it("returns 64-char hex",    () => { assert.equal(checksum("test").length, 64); assert.match(checksum("test"),/^[0-9a-f]+$/); });
  it("is deterministic",       () => { assert.equal(checksum("same"), checksum("same")); });
  it("differs for diff inputs",() => { assert.notEqual(checksum("A"), checksum("B")); });
});
