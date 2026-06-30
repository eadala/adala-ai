/**
 * Database Registry — عدالة AI Platform
 * السجل المركزي لجميع جداول قاعدة البيانات
 *
 * يوثّق: الجداول، العلاقات، سياسات العزل، الفهارس الإلزامية
 * المرجع الوحيد — أي جدول جديد يُضاف هنا + migration
 */

export type TableCategory =
  | "legal-core"
  | "financial"
  | "hr"
  | "ai"
  | "communications"
  | "platform"
  | "auth"
  | "storage"
  | "bankruptcy"
  | "jlwm"
  | "analytics";

export type IsolationPolicy = "office_id" | "user_id" | "platform-wide" | "public";

export interface ColumnSummary {
  name: string;
  type: string;
  required: boolean;
  isIndex?: boolean;
  isForeignKey?: boolean;
  references?: string;
}

export interface DBTableDefinition {
  tableName: string;                  // اسم الجدول في DB
  drizzleName: string;                // اسم المتغير في Drizzle (e.g. casesTable)
  category: TableCategory;
  isolation: IsolationPolicy;         // سياسة العزل الإلزامية
  isolationColumn?: string;           // العمود المستخدم للعزل (افتراضاً office_id)
  keyColumns: ColumnSummary[];        // الأعمدة الأساسية فقط
  requiredIndexes: string[];          // الفهارس الإلزامية
  relations?: string[];               // الجداول المرتبطة
  migrationFile?: string;             // ملف الترحيل المرتبط
  rowEstimate?: string;               // حجم تقديري للبيانات
  retentionPolicy?: string;           // سياسة الاحتفاظ بالبيانات
  hasSoftDelete?: boolean;
  description?: string;
}

export const DB_REGISTRY: DBTableDefinition[] = [

  /* ══ النواة القانونية ══════════════════════════════════════ */
  {
    tableName: "cases",
    drizzleName: "casesTable",
    category: "legal-core",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "TEXT (UUID)", required: true, isIndex: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "title", type: "TEXT", required: true },
      { name: "status", type: "TEXT", required: true },
      { name: "client_id", type: "TEXT", required: false, isForeignKey: true, references: "clients.id" },
      { name: "next_hearing", type: "TIMESTAMPTZ", required: false },
      { name: "created_at", type: "TIMESTAMPTZ", required: true },
    ],
    requiredIndexes: ["idx_cases_office_id", "idx_cases_status", "idx_cases_client_id"],
    relations: ["clients", "documents", "case_sessions", "case_tasks", "ai_tasks"],
    rowEstimate: "~1K-10K per office",
    description: "الجدول المحوري — القضايا القانونية",
  },
  {
    tableName: "clients",
    drizzleName: "clientsTable",
    category: "legal-core",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "TEXT (UUID)", required: true, isIndex: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "full_name", type: "TEXT", required: true },
      { name: "phone", type: "TEXT", required: false },
      { name: "national_id", type: "TEXT", required: false },
      { name: "client_type", type: "TEXT", required: false },
    ],
    requiredIndexes: ["idx_clients_office_id", "idx_clients_national_id"],
    relations: ["cases", "client_invoices", "client_accounts"],
    rowEstimate: "~500-5K per office",
    description: "عملاء المكتب القانوني",
  },
  {
    tableName: "case_sessions",
    drizzleName: "caseSessionsTable",
    category: "legal-core",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true, isIndex: true },
      { name: "case_id", type: "TEXT", required: true, isForeignKey: true, references: "cases.id" },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "session_date", type: "TIMESTAMPTZ", required: true },
      { name: "court_name", type: "TEXT", required: false },
    ],
    requiredIndexes: ["idx_case_sessions_office_id", "idx_case_sessions_case_id"],
    relations: ["cases"],
    retentionPolicy: "indefinite",
  },

  /* ══ المستندات ══════════════════════════════════════════════ */
  {
    tableName: "documents",
    drizzleName: "documentsTable",
    category: "legal-core",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "TEXT (UUID)", required: true, isIndex: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "case_id", type: "TEXT", required: false, isForeignKey: true },
      { name: "title", type: "TEXT", required: true },
      { name: "storage_url", type: "TEXT", required: false },
      { name: "doc_type", type: "TEXT", required: false },
    ],
    requiredIndexes: ["idx_documents_office_id", "idx_documents_case_id"],
    relations: ["cases", "storage_files"],
    rowEstimate: "~2K-20K per office",
  },
  {
    tableName: "document_signatures",
    drizzleName: "documentSignaturesTable",
    category: "legal-core",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "document_id", type: "TEXT", required: true },
      { name: "sign_token", type: "TEXT", required: true, isIndex: true },
      { name: "signed_at", type: "TIMESTAMPTZ", required: false },
      { name: "ip_address", type: "TEXT", required: false },
    ],
    requiredIndexes: ["idx_signatures_office_id", "idx_signatures_token"],
    relations: ["documents"],
    description: "التوقيعات الإلكترونية مع token للرابط العام",
  },

  /* ══ المالية ════════════════════════════════════════════════ */
  {
    tableName: "client_invoices",
    drizzleName: "clientInvoicesTable",
    category: "financial",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true, isIndex: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "client_id", type: "TEXT", required: false, isForeignKey: true },
      { name: "amount", type: "NUMERIC", required: true },
      { name: "status", type: "TEXT", required: true },
      { name: "due_date", type: "DATE", required: false },
      { name: "invoice_token", type: "TEXT", required: false, isIndex: true },
    ],
    requiredIndexes: ["idx_invoices_office_id", "idx_invoices_status", "idx_invoices_token"],
    relations: ["clients", "payment_transactions"],
    rowEstimate: "~1K-20K per office",
    hasSoftDelete: false,
    description: "الفواتير — تُستخدم في P&L كإيرادات مدفوعة",
  },
  {
    tableName: "revenues",
    drizzleName: "revenuesTable",
    category: "financial",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "amount", type: "NUMERIC", required: true },
      { name: "category", type: "TEXT", required: false },
      { name: "date", type: "DATE", required: true },
    ],
    requiredIndexes: ["idx_revenues_office_id"],
    relations: [],
    description: "إيرادات مباشرة (غير فواتير)",
  },
  {
    tableName: "expenses",
    drizzleName: "expensesTable",
    category: "financial",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "amount", type: "NUMERIC", required: true },
      { name: "category", type: "TEXT", required: false },
      { name: "date", type: "DATE", required: true },
    ],
    requiredIndexes: ["idx_expenses_office_id"],
    relations: [],
  },
  {
    tableName: "journal_entries",
    drizzleName: "journalEntriesTable",
    category: "financial",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true, isIndex: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "entry_date", type: "DATE", required: true },
      { name: "description", type: "TEXT", required: true },
      { name: "reference", type: "TEXT", required: false },
    ],
    requiredIndexes: ["idx_journal_entries_office_id"],
    relations: ["journal_items", "chart_of_accounts"],
    description: "القيود المحاسبية — نظام القيد المزدوج",
  },
  {
    tableName: "payment_transactions",
    drizzleName: "paymentTransactionsTable",
    category: "financial",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "amount", type: "NUMERIC", required: true },
      { name: "provider", type: "TEXT", required: true },
      { name: "status", type: "TEXT", required: true },
      { name: "settlement_status", type: "TEXT", required: false },
      { name: "stripe_fee", type: "NUMERIC", required: false },
      { name: "net_amount", type: "NUMERIC", required: false },
    ],
    requiredIndexes: ["idx_payment_transactions_office_id"],
    relations: ["office_ledger"],
    description: "معاملات الدفع — Stripe + Moyasar",
  },

  /* ══ الموارد البشرية ════════════════════════════════════════ */
  {
    tableName: "employees",
    drizzleName: "employeesTable",
    category: "hr",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true, isIndex: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "full_name", type: "TEXT", required: true },
      { name: "position", type: "TEXT", required: false },
      { name: "salary", type: "NUMERIC", required: false },
      { name: "office_location", type: "TEXT", required: false },
    ],
    requiredIndexes: ["idx_employees_office_id"],
    relations: ["payroll", "attendance", "leaves"],
    description: "موظفو المكتب — يحتوي office_location للعزل",
  },
  {
    tableName: "payroll",
    drizzleName: "payrollTable",
    category: "hr",
    isolation: "office_id",
    isolationColumn: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "employee_id", type: "INTEGER", required: true, isForeignKey: true },
      { name: "month", type: "TEXT", required: true },
      { name: "net_salary", type: "NUMERIC", required: true },
      { name: "status", type: "TEXT", required: true },
    ],
    requiredIndexes: ["idx_payroll_office_id"],
    relations: ["employees"],
    description: "الرواتب — محمية بـ payroll:view",
  },

  /* ══ الاتصالات ══════════════════════════════════════════════ */
  {
    tableName: "office_messages",
    drizzleName: "officeMessagesTable",
    category: "communications",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "sender_id", type: "TEXT", required: true },
      { name: "subject", type: "TEXT", required: false },
      { name: "body", type: "TEXT", required: true },
      { name: "is_ai_generated", type: "BOOLEAN", required: false },
    ],
    requiredIndexes: ["idx_messages_office_id"],
    relations: ["message_recipients"],
  },

  /* ══ الذكاء الاصطناعي ════════════════════════════════════════ */
  {
    tableName: "ai_tasks",
    drizzleName: "aiTasksTable",
    category: "ai",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true, isIndex: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "task_type", type: "TEXT", required: true },
      { name: "status", type: "TEXT", required: true },
      { name: "result", type: "TEXT", required: false },
      { name: "model_used", type: "TEXT", required: false },
      { name: "credits_used", type: "INTEGER", required: false },
    ],
    requiredIndexes: ["idx_ai_tasks_office_id"],
    relations: ["cases"],
    retentionPolicy: "90 days",
    description: "سجل مهام الذكاء الاصطناعي مع الرصيد المستهلك",
  },
  {
    tableName: "ai_analytics_cache",
    drizzleName: "aiAnalyticsCacheTable",
    category: "ai",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "cache_key", type: "TEXT", required: true },
      { name: "data", type: "JSONB", required: true },
      { name: "expires_at", type: "TIMESTAMPTZ", required: true },
    ],
    requiredIndexes: ["idx_ai_cache_office_id"],
    retentionPolicy: "6 hours TTL",
    description: "كاش تحليلات الذكاء — TTL 6 ساعات",
  },

  /* ══ المنصة ═════════════════════════════════════════════════ */
  {
    tableName: "office_members",
    drizzleName: "officeMembersTable",
    category: "platform",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true },
      { name: "user_id", type: "TEXT", required: true, isIndex: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "role", type: "TEXT", required: true },
      { name: "joined_at", type: "TIMESTAMPTZ", required: true },
    ],
    requiredIndexes: ["idx_office_members_user_id", "idx_office_members_office_id"],
    description: "ربط المستخدمين بالمكاتب — أساس tenant resolution",
  },
  {
    tableName: "office_registry",
    drizzleName: "officeRegistryTable",
    category: "platform",
    isolation: "platform-wide",
    keyColumns: [
      { name: "office_id", type: "TEXT (PK)", required: true },
      { name: "name", type: "TEXT", required: true },
      { name: "slug", type: "TEXT", required: true, isIndex: true },
      { name: "plan", type: "TEXT", required: true },
      { name: "status", type: "TEXT", required: true },
    ],
    requiredIndexes: ["idx_office_registry_slug"],
    relations: ["office_members", "subscription"],
    description: "سجل جميع المكاتب — إدارة المنصة",
  },
  {
    tableName: "audit_logs",
    drizzleName: "auditLogsTable",
    category: "platform",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true, isIndex: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "user_id", type: "TEXT", required: true },
      { name: "action", type: "TEXT", required: true },
      { name: "resource", type: "TEXT", required: true },
      { name: "resource_id", type: "TEXT", required: false },
      { name: "details", type: "TEXT", required: false },
      { name: "created_at", type: "TIMESTAMPTZ", required: true },
    ],
    requiredIndexes: ["idx_audit_logs_office_id", "idx_audit_logs_resource"],
    retentionPolicy: "90 days (log rotation cron)",
    description: "سجل التدقيق الشامل — كل فعل يُسجَّل",
  },
  {
    tableName: "system_events",
    drizzleName: "systemEventsTable",
    category: "analytics",
    isolation: "platform-wide",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true },
      { name: "type", type: "TEXT", required: true, isIndex: true },
      { name: "payload", type: "JSONB", required: false },
      { name: "office_id", type: "TEXT", required: false, isIndex: true },
      { name: "created_at", type: "TIMESTAMPTZ", required: true },
    ],
    requiredIndexes: ["idx_system_events_type", "idx_system_events_office_id"],
    retentionPolicy: "30 days (log rotation)",
    description: "Domain Events المحفوظة من EventBus",
  },

  /* ══ التخزين ════════════════════════════════════════════════ */
  {
    tableName: "storage_files",
    drizzleName: "storageFilesTable",
    category: "storage",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "SERIAL", required: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "file_key", type: "TEXT", required: true, isIndex: true },
      { name: "file_name", type: "TEXT", required: true },
      { name: "size_bytes", type: "INTEGER", required: false },
      { name: "content_type", type: "TEXT", required: false },
      { name: "folder_id", type: "INTEGER", required: false },
    ],
    requiredIndexes: ["idx_storage_files_office_id", "idx_storage_files_key"],
    relations: ["storage_folders"],
  },

  /* ══ الإفلاس ════════════════════════════════════════════════ */
  {
    tableName: "bk_cases",
    drizzleName: "bkCasesTable",
    category: "bankruptcy",
    isolation: "office_id",
    keyColumns: [
      { name: "id", type: "TEXT (UUID)", required: true, isIndex: true },
      { name: "office_id", type: "TEXT", required: true, isIndex: true },
      { name: "debtor_name", type: "TEXT", required: true },
      { name: "case_type", type: "TEXT", required: true },
      { name: "status", type: "TEXT", required: true },
    ],
    requiredIndexes: ["idx_bk_cases_office_id", "idx_bk_cases_status"],
    relations: ["bk_creditors", "bk_assets", "bk_reports"],
    description: "قضايا الإفلاس — 11 جداول bk_*",
  },
];

/* ── Helpers ─────────────────────────────────────────────── */
export function getTable(name: string): DBTableDefinition | undefined {
  return DB_REGISTRY.find(t => t.tableName === name || t.drizzleName === name);
}

export function getTablesByCategory(category: TableCategory): DBTableDefinition[] {
  return DB_REGISTRY.filter(t => t.category === category);
}

export function getIsolationViolations(): DBTableDefinition[] {
  return DB_REGISTRY.filter(t => t.isolation === "office_id" && !t.isolationColumn && !t.keyColumns.some(c => c.name === "office_id"));
}

export function getRegistryStats() {
  const byIsolation: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const t of DB_REGISTRY) {
    byIsolation[t.isolation] = (byIsolation[t.isolation] ?? 0) + 1;
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
  }
  return {
    total: DB_REGISTRY.length,
    byIsolation,
    byCategory,
    softDelete: DB_REGISTRY.filter(t => t.hasSoftDelete).length,
    withRetentionPolicy: DB_REGISTRY.filter(t => t.retentionPolicy).length,
  };
}
