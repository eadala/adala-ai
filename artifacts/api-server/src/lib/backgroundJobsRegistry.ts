/**
 * Background Jobs Registry — عدالة AI Platform
 * السجل المركزي لجميع المهام المجدولة والـ Cron Jobs
 *
 * كل مهمة موثَّقة بجدولها وآليات إعادة المحاولة والتأثير على النظام
 * المرجع الوحيد — agentCron.ts وبقية ملفات cron/
 */

export type JobStatus = "active" | "paused" | "experimental";
export type JobPriority = "critical" | "high" | "normal" | "low";

export interface BackgroundJobDefinition {
  id: string;
  nameAr: string;
  sourceFile: string;               // الملف الذي يُعرَّف فيه
  schedule: string;                 // cron expression
  scheduleHuman: string;            // وصف الجدول بالعربية
  status: JobStatus;
  priority: JobPriority;
  maxDurationMs?: number;           // الحد الأقصى لوقت التشغيل
  retryPolicy?: string;
  affectedTables?: string[];        // الجداول التي يعدّل عليها
  triggersEvents?: string[];        // الأحداث التي يُصدر
  isOfficeScoped?: boolean;         // يعمل لكل مكتب على حدة؟
  manualTriggerApi?: string;        // API لتشغيله يدوياً
  alertOnFailure?: boolean;
  description?: string;
}

export const BACKGROUND_JOBS_REGISTRY: BackgroundJobDefinition[] = [

  /* ══ البريد الإلكتروني ═════════════════════════════════════ */
  {
    id: "email-cron",
    nameAr: "إرسال إشعارات البريد",
    sourceFile: "src/cron/emailCron.ts",
    schedule: "0 * * * *",
    scheduleHuman: "كل ساعة عند الدقيقة صفر",
    status: "active",
    priority: "high",
    maxDurationMs: 60_000,
    retryPolicy: "لا — يُعيد عند الدورة التالية",
    affectedTables: ["email_notifications", "invoice_notifications"],
    triggersEvents: ["INVOICE_OVERDUE"],
    isOfficeScoped: true,
    manualTriggerApi: "/api/email-notifications/run-now",
    alertOnFailure: true,
    description: "يُرسل: تذكيرات الفواتير، جلسات القضايا، تذكيرات عامة، مواعيد نهائية. يستخدم recipient_ref لمنع التكرار.",
  },

  /* ══ النسخ الاحتياطي ════════════════════════════════════════ */
  {
    id: "backup-tenant",
    nameAr: "نسخ احتياطي لكل مكتب",
    sourceFile: "src/cron/agentCron.ts",
    schedule: "0 */6 * * *",
    scheduleHuman: "كل 6 ساعات",
    status: "active",
    priority: "critical",
    maxDurationMs: 300_000,
    retryPolicy: "لا — يُعيد عند الدورة التالية مع تسجيل الخطأ",
    affectedTables: ["backup_jobs", "backup_settings"],
    isOfficeScoped: true,
    alertOnFailure: true,
    description: "نسخ احتياطي مجدول لبيانات كل مكتب منفصلاً",
  },
  {
    id: "backup-full",
    nameAr: "النسخ الاحتياطي الكامل",
    sourceFile: "src/cron/agentCron.ts",
    schedule: "30 2 * * *",
    scheduleHuman: "يومياً الساعة 02:30 صباحاً",
    status: "active",
    priority: "critical",
    maxDurationMs: 600_000,
    retryPolicy: "لا — يُعيد اليوم التالي",
    affectedTables: ["backup_jobs"],
    alertOnFailure: true,
    description: "نسخ احتياطي شامل لجميع البيانات",
  },

  /* ══ المراقبة ══════════════════════════════════════════════ */
  {
    id: "monitoring-heartbeat",
    nameAr: "نبضة المراقبة",
    sourceFile: "src/cron/monitoringCron.ts",
    schedule: "*/10 * * * *",
    scheduleHuman: "كل 10 دقائق",
    status: "active",
    priority: "high",
    maxDurationMs: 30_000,
    retryPolicy: "لا — يتجاهل الفشل ويكمل",
    affectedTables: ["system_events"],
    alertOnFailure: false,
    description: "يفحص صحة النظام، DB، memory، API latency. كل 3 دورات يُشغّل فحصاً عميقاً.",
  },

  /* ══ تدوير السجلات ═════════════════════════════════════════ */
  {
    id: "log-rotation",
    nameAr: "تدوير سجلات النظام",
    sourceFile: "src/cron/logRotationCron.ts",
    schedule: "0 3 * * *",
    scheduleHuman: "يومياً الساعة 03:00 صباحاً",
    status: "active",
    priority: "normal",
    maxDurationMs: 120_000,
    retryPolicy: "لا",
    affectedTables: ["system_events", "event_daily_counts", "audit_logs"],
    alertOnFailure: false,
    description: "يحذف السجلات القديمة (>90 يوم لـ audit_logs، >30 يوم لـ system_events).",
  },

  /* ══ الوكلاء الذكيون ════════════════════════════════════════ */
  {
    id: "ai-agents-cron",
    nameAr: "دورة وكلاء الذكاء",
    sourceFile: "src/cron/agentCron.ts",
    schedule: "0 2 * * *",
    scheduleHuman: "يومياً الساعة 02:00 صباحاً",
    status: "active",
    priority: "normal",
    maxDurationMs: 300_000,
    retryPolicy: "لا",
    affectedTables: ["ai_agents", "agent_actions", "case_autopilot_reports"],
    triggersEvents: ["CASE_UPDATED"],
    isOfficeScoped: true,
    alertOnFailure: false,
    description: "تشغيل دوري للوكلاء الذكيين: تحليل صحة القضايا، اقتراحات الأتمتة.",
  },

  /* ══ مهام فورية (one-off بعد boot) ════════════════════════ */
  {
    id: "boot-ai-warmup",
    nameAr: "تسخين الذكاء عند البدء",
    sourceFile: "src/cron/agentCron.ts",
    schedule: "@boot+5s",
    scheduleHuman: "مرة واحدة عند بدء الخادم بعد 5 ثوانٍ",
    status: "active",
    priority: "low",
    maxDurationMs: 30_000,
    retryPolicy: "لا",
    affectedTables: [],
    alertOnFailure: false,
    description: "تحميل مسبق للنماذج وإعداد العوامل الأولية.",
  },
];

/* ── Helpers ─────────────────────────────────────────────── */
export function getJob(id: string): BackgroundJobDefinition | undefined {
  return BACKGROUND_JOBS_REGISTRY.find(j => j.id === id);
}

export function getActiveJobs(): BackgroundJobDefinition[] {
  return BACKGROUND_JOBS_REGISTRY.filter(j => j.status === "active");
}

export function getCriticalJobs(): BackgroundJobDefinition[] {
  return BACKGROUND_JOBS_REGISTRY.filter(j => j.priority === "critical");
}

export function getJobsWithManualTrigger(): BackgroundJobDefinition[] {
  return BACKGROUND_JOBS_REGISTRY.filter(j => j.manualTriggerApi);
}

export function getRegistrySummary() {
  return {
    total: BACKGROUND_JOBS_REGISTRY.length,
    active: BACKGROUND_JOBS_REGISTRY.filter(j => j.status === "active").length,
    critical: BACKGROUND_JOBS_REGISTRY.filter(j => j.priority === "critical").length,
    officeScoped: BACKGROUND_JOBS_REGISTRY.filter(j => j.isOfficeScoped).length,
  };
}
