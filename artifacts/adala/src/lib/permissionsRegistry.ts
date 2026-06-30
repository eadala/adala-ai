/**
 * Permissions Registry — عدالة AI Platform
 * السجل المركزي لجميع صلاحيات RBAC في المنصة
 *
 * هذا السجل هو المرجع الوحيد لكل صلاحية — أي صلاحية جديدة يجب تسجيلها هنا أولاً
 * ثم ربطها بـ requirePermission() في الباكند وبـ RoleRoute/Can في الفرونتند
 */

export type PermissionAction = "view" | "manage" | "create" | "delete" | "export" | "approve";
export type PermissionScope = "office" | "branch" | "platform";

export interface PermissionDefinition {
  key: string;                    // "payroll:view"
  nameAr: string;                 // الاسم العربي
  category: string;               // التصنيف
  action: PermissionAction;       // الفعل
  scope: PermissionScope;         // النطاق
  routes?: string[];              // Routes المحمية بهذه الصلاحية
  apiPaths?: string[];            // API paths المحمية
  defaultForRoles: string[];      // الأدوار التي تمتلكها افتراضياً
  subscription?: string;          // الباقة المطلوبة
  description?: string;
}

export const PERMISSIONS_REGISTRY: PermissionDefinition[] = [

  /* ══ المالية ══════════════════════════════════════════════ */
  {
    key: "financial:view",
    nameAr: "مشاهدة البيانات المالية",
    category: "financial",
    action: "view",
    scope: "office",
    routes: ["/revenues", "/expenses", "/cashflow", "/bank-accounts", "/advances", "/tax-settings"],
    apiPaths: ["/api/accounting/*", "/api/revenues/*", "/api/expenses/*"],
    defaultForRoles: ["admin", "accountant"],
  },
  {
    key: "financial:manage",
    nameAr: "إدارة البيانات المالية",
    category: "financial",
    action: "manage",
    scope: "office",
    apiPaths: ["/api/accounting/*", "/api/revenues/*", "/api/expenses/*"],
    defaultForRoles: ["admin", "accountant"],
  },
  {
    key: "accounting:delete",
    nameAr: "حذف القيود المحاسبية",
    category: "financial",
    action: "delete",
    scope: "office",
    apiPaths: ["/api/accounting/journal-entries/*"],
    defaultForRoles: ["admin"],
    description: "صلاحية خطيرة — تحذف قيود دائمة",
  },

  /* ══ الرواتب ══════════════════════════════════════════════ */
  {
    key: "payroll:view",
    nameAr: "مشاهدة الرواتب",
    category: "hr",
    action: "view",
    scope: "office",
    routes: ["/payroll"],
    apiPaths: ["/api/payroll/*"],
    defaultForRoles: ["admin", "hr_manager"],
  },
  {
    key: "payroll:manage",
    nameAr: "إدارة الرواتب",
    category: "hr",
    action: "manage",
    scope: "office",
    apiPaths: ["/api/payroll/*"],
    defaultForRoles: ["admin", "hr_manager"],
  },

  /* ══ الموارد البشرية ══════════════════════════════════════ */
  {
    key: "hr:manage",
    nameAr: "إدارة الموارد البشرية",
    category: "hr",
    action: "manage",
    scope: "office",
    apiPaths: ["/api/employees/*", "/api/attendance/*", "/api/leaves/*"],
    defaultForRoles: ["admin", "hr_manager"],
  },

  /* ══ المستخدمون ════════════════════════════════════════════ */
  {
    key: "users:view",
    nameAr: "مشاهدة المستخدمين",
    category: "admin",
    action: "view",
    scope: "office",
    routes: ["/users"],
    apiPaths: ["/api/users/*"],
    defaultForRoles: ["admin"],
  },
  {
    key: "users:manage",
    nameAr: "إدارة المستخدمين",
    category: "admin",
    action: "manage",
    scope: "office",
    apiPaths: ["/api/users/*"],
    defaultForRoles: ["admin"],
  },

  /* ══ الإعدادات ════════════════════════════════════════════ */
  {
    key: "settings:view",
    nameAr: "مشاهدة الإعدادات",
    category: "settings",
    action: "view",
    scope: "office",
    routes: ["/office-settings"],
    apiPaths: ["/api/office-settings/*"],
    defaultForRoles: ["admin"],
  },
  {
    key: "settings:manage",
    nameAr: "إدارة إعدادات المكتب",
    category: "settings",
    action: "manage",
    scope: "office",
    apiPaths: ["/api/office-settings/*"],
    defaultForRoles: ["admin"],
  },

  /* ══ العملاء ══════════════════════════════════════════════ */
  {
    key: "clients:view",
    nameAr: "مشاهدة العملاء",
    category: "legal",
    action: "view",
    scope: "office",
    routes: ["/clients", "/clients/:id"],
    apiPaths: ["/api/clients/*"],
    defaultForRoles: ["admin", "lawyer", "paralegal"],
  },
  {
    key: "clients:manage",
    nameAr: "إدارة العملاء",
    category: "legal",
    action: "manage",
    scope: "office",
    apiPaths: ["/api/clients/*"],
    defaultForRoles: ["admin", "lawyer"],
  },

  /* ══ القضايا ══════════════════════════════════════════════ */
  {
    key: "cases:view",
    nameAr: "مشاهدة القضايا",
    category: "legal",
    action: "view",
    scope: "office",
    routes: ["/cases", "/cases/:id"],
    apiPaths: ["/api/cases/*"],
    defaultForRoles: ["admin", "lawyer", "paralegal"],
  },
  {
    key: "cases:manage",
    nameAr: "إدارة القضايا",
    category: "legal",
    action: "manage",
    scope: "office",
    apiPaths: ["/api/cases/*"],
    defaultForRoles: ["admin", "lawyer"],
  },

  /* ══ المستندات ════════════════════════════════════════════ */
  {
    key: "documents:view",
    nameAr: "مشاهدة المستندات",
    category: "documents",
    action: "view",
    scope: "office",
    routes: ["/documents", "/contracts", "/letters"],
    apiPaths: ["/api/documents/*", "/api/contracts/*"],
    defaultForRoles: ["admin", "lawyer", "paralegal"],
  },
  {
    key: "documents:delete",
    nameAr: "حذف المستندات",
    category: "documents",
    action: "delete",
    scope: "office",
    apiPaths: ["/api/documents/*"],
    defaultForRoles: ["admin"],
  },

  /* ══ التقارير والتصدير ════════════════════════════════════ */
  {
    key: "reports:export",
    nameAr: "تصدير التقارير",
    category: "analytics",
    action: "export",
    scope: "office",
    apiPaths: ["/api/export/*"],
    defaultForRoles: ["admin", "accountant"],
    subscription: "professional",
  },
];

/* ── Helpers ─────────────────────────────────────────────── */
export const PERMISSION_KEYS = PERMISSIONS_REGISTRY.map(p => p.key);

export const PERMISSIONS_BY_CATEGORY = PERMISSIONS_REGISTRY.reduce(
  (acc, p) => { (acc[p.category] ??= []).push(p); return acc; },
  {} as Record<string, PermissionDefinition[]>
);

export function getPermission(key: string): PermissionDefinition | undefined {
  return PERMISSIONS_REGISTRY.find(p => p.key === key);
}

export function getPermissionsForRole(role: string): PermissionDefinition[] {
  return PERMISSIONS_REGISTRY.filter(p => p.defaultForRoles.includes(role));
}

export function isValidPermission(key: string): boolean {
  return PERMISSION_KEYS.includes(key);
}
