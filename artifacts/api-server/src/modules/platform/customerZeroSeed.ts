/**
 * Enterprise Customer Zero — realistic law firm tenant seed.
 * Run: pnpm --filter @workspace/api-server exec tsx src/runCustomerZeroSeed.ts [--force]
 *
 * Creates: multi-role team, clients, cases, invoices, employees, accounting, branches metadata.
 * Tag: [CUSTOMER-ZERO]
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const CZ_OFFICE_ID = "cccc0000-0000-0000-0000-000000000001";
export const CZ_BRANCH_RIYADH = "cccc0000-0000-0000-0000-000000000011";
export const CZ_BRANCH_JEDDAH = "cccc0000-0000-0000-0000-000000000012";

/** Placeholder Clerk user IDs — replace with real IDs in pilot */
export const CZ_USERS = {
  partner:    "cz_user_partner_001",
  manager:    "cz_user_manager_001",
  lawyer1:    "cz_user_lawyer_001",
  lawyer2:    "cz_user_lawyer_002",
  associate:  "cz_user_associate_001",
  assistant:  "cz_user_assistant_001",
  accountant: "cz_user_accountant_001",
  hr:         "cz_user_hr_001",
} as const;

const TAG = "[CUSTOMER-ZERO]";

type Row = Record<string, unknown>;
async function qAll(q: ReturnType<typeof sql>): Promise<Row[]> {
  const r = await db.execute(q).catch(() => ({ rows: [] }));
  return ((r as { rows?: Row[] }).rows ?? []) as Row[];
}

export async function isCustomerZeroSeeded(): Promise<boolean> {
  const row = await qAll(sql`
    SELECT COUNT(*)::int AS cnt FROM cases
    WHERE office_id = ${CZ_OFFICE_ID} AND case_number LIKE 'CZ-%'
  `);
  return Number(row[0]?.cnt ?? 0) >= 20;
}

export async function clearCustomerZeroData(): Promise<void> {
  const tables = [
    "invoice_payments", "client_invoices", "leaves", "payroll", "employee_warnings",
    "investigations", "attendance", "employees", "expenses", "revenues",
    "documents", "cases", "clients",
  ];
  for (const t of tables) {
    await db.execute(sql`
      DELETE FROM ${sql.raw(t)}
      WHERE office_id = ${CZ_OFFICE_ID}
    `).catch(() => {});
  }
  await db.execute(sql`
    DELETE FROM office_members WHERE office_id = ${CZ_OFFICE_ID}
  `).catch(() => {});
  await db.execute(sql`
    DELETE FROM office_registry WHERE id = ${CZ_OFFICE_ID}
  `).catch(() => {});
}

async function ensureTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS office_members (
      id SERIAL PRIMARY KEY,
      office_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'lawyer',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (office_id, user_id)
    )
  `).catch(() => {});
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id TEXT,
      employee_no TEXT,
      full_name TEXT,
      job_title TEXT,
      department TEXT,
      salary NUMERIC,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS office_id TEXT`).catch(() => {});
}

async function seedRoles(): Promise<void> {
  const defaults = [
    { name: "firm_owner", displayName: "مالك المكتب", permissions: '["*"]' },
    { name: "office_manager", displayName: "مدير المكتب", permissions: JSON.stringify([
      "dashboard:view", "cases:view", "cases:create", "cases:edit", "cases:assign",
      "clients:view", "clients:create", "clients:edit", "contracts:view", "contracts:create",
      "documents:view", "documents:upload", "users:view", "users:create", "users:edit",
      "roles:view", "reports:view", "financial:view", "payroll:view", "payroll:manage",
      "hr:manage", "invoices:view", "invoices:create", "invoices:edit",
      "payments:view", "payments:create", "settings:view", "ai:access", "messages:view", "messages:send",
    ]) },
    { name: "lawyer", displayName: "محامي", permissions: JSON.stringify([
      "dashboard:view", "cases:view", "cases:create", "cases:edit", "clients:view",
      "contracts:view", "contracts:create", "documents:view", "documents:upload",
      "ai:access", "messages:view", "messages:send", "invoices:view", "users:view",
    ]) },
    { name: "trainee_lawyer", displayName: "محامي متدرب", permissions: JSON.stringify([
      "dashboard:view", "cases:view", "clients:view", "documents:view", "documents:upload", "ai:access", "messages:view",
    ]) },
    { name: "accountant", displayName: "محاسب", permissions: JSON.stringify([
      "dashboard:view", "invoices:view", "invoices:create", "invoices:edit", "invoices:delete",
      "payments:view", "payments:create", "reports:view", "financial:view", "payroll:view", "clients:view",
    ]) },
    { name: "secretary", displayName: "سكرتير", permissions: JSON.stringify([
      "dashboard:view", "clients:view", "clients:create", "documents:view", "documents:upload", "messages:view", "messages:send",
    ]) },
  ];
  for (const r of defaults) {
    await db.execute(sql`
      INSERT INTO roles (name, display_name, permissions, is_system)
      VALUES (${r.name}, ${r.displayName}, ${r.permissions}, true)
      ON CONFLICT (name) DO NOTHING
    `).catch(() => {});
  }
}

async function seedOffice(): Promise<void> {
  await db.execute(sql`
    INSERT INTO office_registry (id, clerk_user_id, office_name, owner_name, owner_email, plan_name, status)
    VALUES (
      ${CZ_OFFICE_ID},
      ${CZ_USERS.partner},
      'مكتب الخليج للمحاماة والاستشارات',
      'الشريك المُدير أحمد الخليجي',
      'partner@alkhaleej-law.sa',
      'enterprise',
      'active'
    )
    ON CONFLICT (id) DO UPDATE SET
      office_name = EXCLUDED.office_name,
      plan_name = 'enterprise',
      status = 'active'
  `).catch(() => {});

  const members: Array<[string, string]> = [
    [CZ_USERS.partner, "firm_owner"],
    [CZ_USERS.manager, "office_manager"],
    [CZ_USERS.lawyer1, "lawyer"],
    [CZ_USERS.lawyer2, "lawyer"],
    [CZ_USERS.associate, "trainee_lawyer"],
    [CZ_USERS.assistant, "secretary"],
    [CZ_USERS.accountant, "accountant"],
    [CZ_USERS.hr, "office_manager"],
  ];
  for (const [userId, role] of members) {
    await db.execute(sql`
      INSERT INTO office_members (office_id, user_id, role, status)
      VALUES (${CZ_OFFICE_ID}, ${userId}, ${role}, 'active')
      ON CONFLICT (office_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'
    `);
  }
}

async function seedClients(): Promise<string[]> {
  const clients = [
    "شركة الأفق للتطوير العقاري", "مجموعة النخيل التجارية", "مؤسسة البناء الحديث",
    "شركة التقنية المتقدمة", "عبدالله محمد الغامدي", "نورة سعد العتيبي",
    "شركة الخليج للطاقة", "مريم فهد الشمري", "شركة الإمداد اللوجستي",
    "خالد عبدالرحمن القحطاني", "شركة الرياض للمقاولات", "هند سلمان الزهراني",
    "مؤسسة التوريد الوطنية", "فهد ناصر الحربي", "شركة المستقبل للاستثمار",
    "سارة عبدالعزيز الدوسري", "شركة الصناعات الثقيلة", "يوسف إبراهيم المطيري",
    "مجموعة الفجر القابضة", "لمياء أحمد الجهني",
  ];
  const ids: string[] = [];
  for (let i = 0; i < clients.length; i++) {
    const name = clients[i];
    const isCorp = name.startsWith("شركة") || name.startsWith("مجموعة") || name.startsWith("مؤسسة");
    const rows = await qAll(sql`
      INSERT INTO clients (full_name, type, email, phone, office_id, notes, tags)
      VALUES (
        ${name},
        ${isCorp ? "corporate" : "individual"},
        ${`client${i + 1}@example.sa`},
        ${`05${String(10000000 + i).slice(-8)}`},
        ${CZ_OFFICE_ID},
        ${`${TAG} فرع: ${i % 2 === 0 ? "الرياض" : "جدة"}`},
        ${JSON.stringify([TAG, isCorp ? "corporate" : "individual"])}::jsonb
      )
      RETURNING id::text AS id
    `);
    if (rows[0]?.id) ids.push(String(rows[0].id));
  }
  return ids;
}

async function seedCases(clientIds: string[]): Promise<void> {
  const types = ["تجاري", "مدني", "عمالي", "عقاري", "جنائي"];
  const statuses = ["active", "pending", "closed", "on_hold"];
  for (let i = 1; i <= 35; i++) {
    const clientId = clientIds[i % clientIds.length];
    const clientRow = await qAll(sql`SELECT full_name FROM clients WHERE id = ${clientId}::uuid LIMIT 1`);
    const clientName = String(clientRow[0]?.full_name ?? "عميل");
    await db.execute(sql`
      INSERT INTO cases (
        case_number, title, case_type, status, client_name, client_id,
        office_id, assigned_to, court, notes, priority
      )
      VALUES (
        ${`CZ-${String(i).padStart(4, "0")}`},
        ${`قضية ${types[i % types.length]} — ${clientName}`},
        ${types[i % types.length]},
        ${statuses[i % statuses.length]},
        ${clientName},
        ${clientId},
        ${CZ_OFFICE_ID},
        ${i % 3 === 0 ? "خالد السعد" : i % 3 === 1 ? "نورة العتيبي" : "فيصل الحربي"},
        ${"المحكمة التجارية بالرياض"},
        ${`${TAG} فرع ${i % 2 === 0 ? CZ_BRANCH_RIYADH : CZ_BRANCH_JEDDAH}`},
        ${i % 5 === 0 ? "high" : "normal"}
      )
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  }
}

async function seedInvoices(clientIds: string[]): Promise<void> {
  for (let i = 1; i <= 25; i++) {
    const total = 15000 + i * 2500;
    const status = i % 4 === 0 ? "paid" : i % 3 === 0 ? "sent" : "draft";
    await db.execute(sql`
      INSERT INTO client_invoices (
        invoice_number, title, client_id, client_name, office_id,
        items, subtotal, vat_rate, vat_amount, total, status, amount_paid, notes
      )
      VALUES (
        ${`CZ-INV-${String(i).padStart(4, "0")}`},
        ${`أتعاب قانونية — دفعة ${i}`},
        ${clientIds[i % clientIds.length]}::uuid,
        (SELECT full_name FROM clients WHERE id = ${clientIds[i % clientIds.length]}::uuid LIMIT 1),
        ${CZ_OFFICE_ID},
        ${JSON.stringify([{ description: "أتعاب استشارية", qty: 1, price: total }])},
        ${total}, 15, ${total * 0.15}, ${total * 1.15},
        ${status},
        ${status === "paid" ? total * 1.15 : 0},
        ${TAG}
      )
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  }
}

async function seedEmployees(): Promise<void> {
  const staff = [
    ["EMP-001", "أحمد الخليجي", "شريك مُدير", "الإدارة العليا", 45000],
    ["EMP-002", "سارة المنصور", "مديرة المكتب", "الإدارة", 28000],
    ["EMP-003", "خالد السعد", "محامٍ أول", "التقاضي", 22000],
    ["EMP-004", "نورة العتيبي", "محامية", "التقاضي", 20000],
    ["EMP-005", "محمد القحطاني", "محامٍ متدرب", "التقاضي", 12000],
    ["EMP-006", "فاطمة الحربي", "مساعدة قانونية", "الدعم", 9000],
    ["EMP-007", "عبدالله المحاسب", "محاسب", "المالية", 16000],
    ["EMP-008", "ريم الشهري", "أخصائية موارد بشرية", "الموارد البشرية", 14000],
    ["EMP-009", "طارق الغامدي", "محامٍ", "العقود", 21000],
    ["EMP-010", "هند الزهراني", "سكرتيرة", "الإدارة", 8000],
  ];
  for (const [no, name, title, dept, salary] of staff) {
    await db.execute(sql`
      INSERT INTO employees (office_id, employee_no, full_name, job_title, department, salary, status)
      VALUES (${CZ_OFFICE_ID}, ${no}, ${name}, ${title}, ${dept}, ${salary}, 'active')
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  }
}

async function seedAccounting(): Promise<void> {
  for (let i = 1; i <= 15; i++) {
    await db.execute(sql`
      INSERT INTO revenues (office_id, title, category, amount, payment_method, date, notes)
      VALUES (${CZ_OFFICE_ID}, ${`إيراد أتعاب ${i}`}, 'أتعاب قضائية', ${8000 + i * 500}, 'bank', CURRENT_DATE - ${i}, ${TAG})
    `).catch(() => {});
    await db.execute(sql`
      INSERT INTO expenses (office_id, title, category, amount, payment_method, date, notes)
      VALUES (${CZ_OFFICE_ID}, ${`مصروف تشغيلي ${i}`}, 'إدارية', ${1200 + i * 100}, 'cash', CURRENT_DATE - ${i}, ${TAG})
    `).catch(() => {});
  }
}

export interface CustomerZeroSeedResult {
  skipped: boolean;
  officeId: string;
  clients: number;
  cases: number;
  invoices: number;
  employees: number;
  members: number;
}

export async function seedCustomerZero(force = false): Promise<CustomerZeroSeedResult> {
  await ensureTables();
  if (!force && await isCustomerZeroSeeded()) {
    return { skipped: true, officeId: CZ_OFFICE_ID, clients: 0, cases: 0, invoices: 0, employees: 0, members: 0 };
  }
  if (force) await clearCustomerZeroData();

  await seedRoles();
  await seedOffice();
  const clientIds = await seedClients();
  await seedCases(clientIds);
  await seedInvoices(clientIds);
  await seedEmployees();
  await seedAccounting();

  const [c, cs, inv, emp] = await Promise.all([
    qAll(sql`SELECT COUNT(*)::int AS n FROM clients WHERE office_id = ${CZ_OFFICE_ID}`),
    qAll(sql`SELECT COUNT(*)::int AS n FROM cases WHERE office_id = ${CZ_OFFICE_ID}`),
    qAll(sql`SELECT COUNT(*)::int AS n FROM client_invoices WHERE office_id = ${CZ_OFFICE_ID}`),
    qAll(sql`SELECT COUNT(*)::int AS n FROM employees WHERE office_id = ${CZ_OFFICE_ID}`),
  ]);

  return {
    skipped: false,
    officeId: CZ_OFFICE_ID,
    clients: Number(c[0]?.n ?? 0),
    cases: Number(cs[0]?.n ?? 0),
    invoices: Number(inv[0]?.n ?? 0),
    employees: Number(emp[0]?.n ?? 0),
    members: Object.keys(CZ_USERS).length,
  };
}
