/**
 * fileUploadRegistry.ts — سجل رفع الملفات المركزي
 * ─────────────────────────────────────────────────
 * المرجع الرسمي الوحيد لجميع نقاط رفع الملفات في عدالة AI.
 * أي عملية رفع جديدة تُسجَّل هنا أولاً قبل أي كود.
 *
 * @version 1.0.0
 * @updated 2025-01-30
 */

/* ── Types ────────────────────────────────────────────────────────── */

export type UploadStorageProvider =
  | "replit_object_storage"
  | "db_base64"
  | "signed_url"
  | "clerk_sdk"
  | "client_side_only";

export type UploadAuthMethod =
  | "requireAuthWithTenant"
  | "requireAuth"
  | "portal_token"
  | "clerk"
  | "none";

export interface FileUploadPoint {
  /** معرّف فريد */
  id:               string;
  /** اسم الوحدة بالعربي */
  moduleAr:         string;
  /** اسم الوحدة بالإنجليزي */
  moduleEn:         string;
  /** الصفحة (route) */
  page:             string;
  /** اسم الـ Component في الواجهة */
  component:        string;
  /** API Endpoint في الخادم */
  apiEndpoint:      string;
  /** HTTP Method */
  method:           "POST" | "PUT" | "PATCH" | "none";
  /** طريقة المصادقة */
  auth:             UploadAuthMethod;
  /** مزوّد التخزين */
  storageProvider:  UploadStorageProvider;
  /** أنواع الملفات المسموح بها (MIME) */
  allowedMime:      string[];
  /** الامتدادات المسموح بها */
  allowedExtensions: string[];
  /** الحد الأقصى للحجم (MB) */
  maxSizeMB:        number;
  /** طريقة إرسال البيانات */
  uploadMethod:     "base64_json" | "signed_url_put" | "multipart" | "sdk" | "client_side";
  /** هل يدعم رفع ملفات متعددة؟ */
  multipleFiles:    boolean;
  /** هل يدعم السحب والإفلات؟ */
  dragAndDrop:      boolean;
  /** هل يدعم معاينة الملف؟ */
  preview:          boolean;
  /** هل يدعم الحذف؟ */
  deletable:        boolean;
  /** هل يدعم التحميل؟ */
  downloadable:     boolean;
  /** Permission المطلوب */
  permission?:      string;
  /** Feature flag المرتبط */
  featureFlag?:     string;
  /** الباقة المطلوبة */
  subscriptionMin?: "trial" | "starter" | "professional" | "enterprise" | "bankruptcy";
  /** هل يوجد فحص أمني للفيروسات؟ */
  virusScan:        boolean;
  /** سياسة الاحتفاظ (أيام، 0 = للأبد) */
  retentionDays:    number;
  /** ملاحظات */
  notes?:           string;
  /** هل تم تطبيق uploadGuard عليه؟ */
  guardApplied:     boolean;
  /** هل تم الاختبار؟ */
  tested:           boolean;
}

/* ── Registry ─────────────────────────────────────────────────────── */

export const FILE_UPLOAD_REGISTRY: FileUploadPoint[] = [

  /* ══ 1. مركز المستندات ══════════════════════════════════════════ */
  {
    id:               "doc-center-upload",
    moduleAr:         "مركز المستندات",
    moduleEn:         "Document Center",
    page:             "/document-center",
    component:        "UploadDialog",
    apiEndpoint:      "POST /api/document-center/upload",
    method:           "POST",
    auth:             "requireAuthWithTenant",
    storageProvider:  "replit_object_storage",
    allowedMime: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg", "image/png", "image/webp",
      "text/csv", "application/zip",
    ],
    allowedExtensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".webp", ".csv", ".zip"],
    maxSizeMB:        15,
    uploadMethod:     "base64_json",
    multipleFiles:    false,
    dragAndDrop:      true,
    preview:          true,
    deletable:        true,
    downloadable:     true,
    permission:       "documents:manage",
    featureFlag:      "documentCenter",
    subscriptionMin:  "starter",
    virusScan:        false,
    retentionDays:    0,
    guardApplied:     true,
    tested:           true,
    notes:            "تم إصلاح DialogTitle bug (P1) + uploadGuard مطبّق",
  },

  /* ══ 2. القضايا — مستندات القضية ═══════════════════════════════ */
  {
    id:               "case-documents-upload",
    moduleAr:         "القضايا",
    moduleEn:         "Cases",
    page:             "/cases/:id",
    component:        "DocumentUploadDialog",
    apiEndpoint:      "POST /api/cases/:id/documents",
    method:           "POST",
    auth:             "requireAuthWithTenant",
    storageProvider:  "db_base64",
    allowedMime: [
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "text/plain", "text/csv", "application/zip",
    ],
    allowedExtensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt", ".csv", ".zip"],
    maxSizeMB:        10,
    uploadMethod:     "base64_json",
    multipleFiles:    false,
    dragAndDrop:      true,
    preview:          false,
    deletable:        true,
    downloadable:     true,
    permission:       "documents:manage",
    featureFlag:      "caseManagement",
    subscriptionMin:  "trial",
    virusScan:        false,
    retentionDays:    0,
    guardApplied:     true,
    tested:           true,
    notes:            "يخزّن base64 في DB — يُنصح بالترحيل إلى Object Storage",
  },

  /* ══ 3. بوابة العميل ════════════════════════════════════════════ */
  {
    id:               "portal-client-upload",
    moduleAr:         "بوابة العميل",
    moduleEn:         "Client Portal",
    page:             "/portal/:token",
    component:        "inline upload (portal-view.tsx)",
    apiEndpoint:      "POST /api/portal/:token/upload",
    method:           "POST",
    auth:             "portal_token",
    storageProvider:  "replit_object_storage",
    allowedMime: [
      "application/pdf",
      "image/jpeg", "image/png", "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".doc", ".docx"],
    maxSizeMB:        5,
    uploadMethod:     "base64_json",
    multipleFiles:    false,
    dragAndDrop:      false,
    preview:          false,
    deletable:        false,
    downloadable:     false,
    permission:       undefined,
    featureFlag:      "clientPortal",
    subscriptionMin:  "professional",
    virusScan:        false,
    retentionDays:    365,
    guardApplied:     true,
    tested:           true,
    notes:            "بوابة عامة — token يتحكم في السماح بالرفع + تاريخ الانتهاء",
  },

  /* ══ 4. إعدادات المكتب — شعار / ختم / توقيع ═══════════════════ */
  {
    id:               "office-settings-branding",
    moduleAr:         "إعدادات المكتب — هوية بصرية",
    moduleEn:         "Office Settings — Branding",
    page:             "/office-settings",
    component:        "UploadZone",
    apiEndpoint:      "GET /api/storage/uploads/request-url → PUT (signed URL)",
    method:           "PUT",
    auth:             "requireAuthWithTenant",
    storageProvider:  "signed_url",
    allowedMime:      ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".svg"],
    maxSizeMB:        5,
    uploadMethod:     "signed_url_put",
    multipleFiles:    false,
    dragAndDrop:      false,
    preview:          true,
    deletable:        true,
    downloadable:     false,
    permission:       "settings:manage",
    featureFlag:      "branding",
    subscriptionMin:  "starter",
    virusScan:        false,
    retentionDays:    0,
    guardApplied:     false,
    tested:           false,
    notes:            "Signed URL — التحقق يتم على جانب الـ storage مباشرةً. لا يمر بـ uploadGuard.",
  },

  /* ══ 5. الملف الشخصي — صورة المستخدم ══════════════════════════ */
  {
    id:               "user-profile-photo",
    moduleAr:         "الملف الشخصي",
    moduleEn:         "User Profile",
    page:             "/my-profile",
    component:        "inline (my-profile.tsx)",
    apiEndpoint:      "Clerk SDK: user.setProfileImage()",
    method:           "none",
    auth:             "clerk",
    storageProvider:  "clerk_sdk",
    allowedMime:      ["image/jpeg", "image/png", "image/webp", "image/gif"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
    maxSizeMB:        10,
    uploadMethod:     "sdk",
    multipleFiles:    false,
    dragAndDrop:      false,
    preview:          true,
    deletable:        false,
    downloadable:     false,
    permission:       undefined,
    virusScan:        false,
    retentionDays:    0,
    guardApplied:     false,
    tested:           false,
    notes:            "Clerk يدير الصورة — لا نتحكم به مباشرةً. Clerk يحدّد الحدود داخلياً.",
  },

  /* ══ 6. المستندات الذكية — SmartUploader ═══════════════════════ */
  {
    id:               "smart-uploader",
    moduleAr:         "المستندات الذكية",
    moduleEn:         "Smart Documents",
    page:             "/documents (SmartUploader component)",
    component:        "SmartUploader",
    apiEndpoint:      "GET /api/storage/uploads/request-url → PUT (signed URL)",
    method:           "PUT",
    auth:             "requireAuthWithTenant",
    storageProvider:  "signed_url",
    allowedMime: [
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
      "application/zip",
    ],
    allowedExtensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".zip"],
    maxSizeMB:        10,
    uploadMethod:     "signed_url_put",
    multipleFiles:    true,
    dragAndDrop:      true,
    preview:          true,
    deletable:        true,
    downloadable:     true,
    permission:       "documents:manage",
    featureFlag:      "smartDocuments",
    subscriptionMin:  "professional",
    virusScan:        false,
    retentionDays:    0,
    guardApplied:     false,
    tested:           false,
    notes:            "يضغط الصور تلقائياً (600KB target) + تحليل AI. Signed URL → لا يمر بـ uploadGuard.",
  },

  /* ══ 7. الإفلاس — وثائق الطلب ═══════════════════════════════════ */
  {
    id:               "bankruptcy-documents",
    moduleAr:         "الإفلاس — وثائق الطلب",
    moduleEn:         "Bankruptcy Documents",
    page:             "/office-bankruptcy",
    component:        "inline (office-bankruptcy.tsx)",
    apiEndpoint:      "POST /api/bankruptcy/opening-requests/:id/documents",
    method:           "POST",
    auth:             "requireAuth",
    storageProvider:  "db_base64",
    allowedMime:      [],
    allowedExtensions: [],
    maxSizeMB:        0,
    uploadMethod:     "base64_json",
    multipleFiles:    false,
    dragAndDrop:      false,
    preview:          false,
    deletable:        true,
    downloadable:     false,
    permission:       "cases:manage",
    featureFlag:      "bankruptcy",
    subscriptionMin:  "bankruptcy",
    virusScan:        false,
    retentionDays:    0,
    guardApplied:     false,
    tested:           false,
    notes:            "يخزّن URL فقط (لا يرفع ملفاً فعلياً عبر هذا الـ endpoint) — يُشير لملف مرفوع مسبقاً",
  },

  /* ══ 8. استيراد CSV ══════════════════════════════════════════════ */
  {
    id:               "csv-import",
    moduleAr:         "استيراد CSV",
    moduleEn:         "CSV Import",
    page:             "various (import-dialog.tsx)",
    component:        "ImportDialog",
    apiEndpoint:      "client-side parse only",
    method:           "none",
    auth:             "none",
    storageProvider:  "client_side_only",
    allowedMime:      ["text/csv", "text/plain"],
    allowedExtensions: [".csv"],
    maxSizeMB:        2,
    uploadMethod:     "client_side",
    multipleFiles:    false,
    dragAndDrop:      false,
    preview:          false,
    deletable:        false,
    downloadable:     false,
    virusScan:        false,
    retentionDays:    0,
    guardApplied:     false,
    tested:           false,
    notes:            "يُعالج CSV محلياً في المتصفح — لا يُرفع للخادم. أمان يتوقف على parsing صحيح.",
  },

  /* ══ 9. النسخ الاحتياطي — استيراد JSON ════════════════════════ */
  {
    id:               "backup-import",
    moduleAr:         "النسخ الاحتياطي — استيراد",
    moduleEn:         "Backup Import",
    page:             "/backup",
    component:        "inline (backup.tsx)",
    apiEndpoint:      "client-side JSON parse only",
    method:           "none",
    auth:             "none",
    storageProvider:  "client_side_only",
    allowedMime:      ["application/json"],
    allowedExtensions: [".json"],
    maxSizeMB:        50,
    uploadMethod:     "client_side",
    multipleFiles:    false,
    dragAndDrop:      false,
    preview:          false,
    deletable:        false,
    downloadable:     false,
    permission:       "settings:manage",
    virusScan:        false,
    retentionDays:    0,
    guardApplied:     false,
    tested:           false,
    notes:            "يُعالج JSON محلياً لاستعادة بيانات النسخة الاحتياطية",
  },
];

/* ── Helpers ───────────────────────────────────────────────────────── */

export const UPLOAD_POINT_COUNT = FILE_UPLOAD_REGISTRY.length;

export function getUploadPoint(id: string): FileUploadPoint | undefined {
  return FILE_UPLOAD_REGISTRY.find(p => p.id === id);
}

export function getUploadsByModule(moduleEn: string): FileUploadPoint[] {
  return FILE_UPLOAD_REGISTRY.filter(p =>
    p.moduleEn.toLowerCase().includes(moduleEn.toLowerCase())
  );
}

export function getUnsecuredUploadPoints(): FileUploadPoint[] {
  return FILE_UPLOAD_REGISTRY.filter(p =>
    !p.guardApplied && p.uploadMethod !== "client_side" && p.uploadMethod !== "sdk"
  );
}

export function getUntestedUploadPoints(): FileUploadPoint[] {
  return FILE_UPLOAD_REGISTRY.filter(p => !p.tested);
}

/** Master MIME allowlist (union of all upload points) */
export const ALL_ALLOWED_MIME = new Set(
  FILE_UPLOAD_REGISTRY.flatMap(p => p.allowedMime)
);

/** Summary for reporting */
export function getUploadRegistrySummary() {
  const guardApplied  = FILE_UPLOAD_REGISTRY.filter(p => p.guardApplied).length;
  const tested        = FILE_UPLOAD_REGISTRY.filter(p => p.tested).length;
  const serverUploads = FILE_UPLOAD_REGISTRY.filter(p => p.method !== "none").length;
  const unsecured     = getUnsecuredUploadPoints().length;

  return {
    total:        UPLOAD_POINT_COUNT,
    serverUploads,
    guardApplied,
    tested,
    unsecured,
    storageProviders: [...new Set(FILE_UPLOAD_REGISTRY.map(p => p.storageProvider))],
    modules:      [...new Set(FILE_UPLOAD_REGISTRY.map(p => p.moduleAr))],
  };
}
