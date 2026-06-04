import { pgTable, uuid, text, timestamp, numeric, date, boolean, jsonb, integer } from "drizzle-orm/pg-core";

export const employeesTable = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeNo: text("employee_no").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  nationalId: text("national_id"),
  jobTitle: text("job_title").notNull(),
  department: text("department"),
  managerId: uuid("manager_id"),
  salary: numeric("salary").notNull().default("0"),
  salaryType: text("salary_type").notNull().default("monthly"),
  hireDate: date("hire_date"),
  contractType: text("contract_type").default("permanent"),
  status: text("status").notNull().default("active"),
  gender: text("gender"),
  nationality: text("nationality").default("سعودي"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const attendanceTable = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  workDate: date("work_date").notNull(),
  status: text("status").notNull().default("present"),
  notes: text("notes"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leavesTable = pgTable("leaves", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("annual"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: integer("days").notNull().default(1),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollTable = pgTable("payroll", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  baseSalary: numeric("base_salary").notNull().default("0"),
  allowances: numeric("allowances").notNull().default("0"),
  deductions: numeric("deductions").notNull().default("0"),
  gosi: numeric("gosi").notNull().default("0"),
  netSalary: numeric("net_salary").notNull().default("0"),
  status: text("status").notNull().default("draft"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
