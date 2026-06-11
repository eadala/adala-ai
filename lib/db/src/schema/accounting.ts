import { pgTable, uuid, text, timestamp, numeric, date, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/* ── Revenues ────────────────────────────────────────────── */
export const revenuesTable = pgTable("revenues", {
  id:            uuid("id").primaryKey().defaultRandom(),
  title:         text("title").notNull(),
  category:      text("category").notNull().default("أتعاب محاماة"),
  amount:        numeric("amount", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("bank"),
  date:          date("date").notNull(),
  clientId:      text("client_id"),
  caseId:        text("case_id"),
  invoiceId:     text("invoice_id"),
  notes:         text("notes"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

/* ── Expenses ────────────────────────────────────────────── */
export const expensesTable = pgTable("expenses", {
  id:            uuid("id").primaryKey().defaultRandom(),
  title:         text("title").notNull(),
  category:      text("category").notNull().default("مصاريف عامة"),
  amount:        numeric("amount", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("bank"),
  date:          date("date").notNull(),
  vendor:        text("vendor"),
  isPayroll:     boolean("is_payroll").default(false),
  payrollId:     text("payroll_id"),
  notes:         text("notes"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

/* ── Bank Accounts ───────────────────────────────────────── */
export const bankAccountsTable = pgTable("bank_accounts", {
  id:             uuid("id").primaryKey().defaultRandom(),
  bankName:       text("bank_name").notNull(),
  accountName:    text("account_name").notNull(),
  accountNumber:  text("account_number").notNull(),
  iban:           text("iban"),
  currency:       text("currency").default("SAR"),
  currentBalance: numeric("current_balance", { precision: 15, scale: 2 }).default("0"),
  isDefault:      boolean("is_default").default(false),
  isActive:       boolean("is_active").default(true),
  notes:          text("notes"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
});

/* ── Cash Advances ───────────────────────────────────────── */
export const cashAdvancesTable = pgTable("cash_advances", {
  id:               uuid("id").primaryKey().defaultRandom(),
  employeeId:       uuid("employee_id"),
  employeeName:     text("employee_name").notNull(),
  amount:           numeric("amount", { precision: 15, scale: 2 }).notNull(),
  purpose:          text("purpose").notNull(),
  repaymentMonths:  integer("repayment_months").default(1),
  amountRepaid:     numeric("amount_repaid", { precision: 15, scale: 2 }).default("0"),
  status:           text("status").default("pending"),
  approvedBy:       text("approved_by"),
  approvedAt:       timestamp("approved_at"),
  date:             date("date").notNull(),
  notes:            text("notes"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
});

/* ── Insert Schemas ──────────────────────────────────────── */
export const insertRevenueSchema = createInsertSchema(revenuesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRevenue = z.infer<typeof insertRevenueSchema>;
export type Revenue = typeof revenuesTable.$inferSelect;

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;

export const insertBankAccountSchema = createInsertSchema(bankAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankAccount = typeof bankAccountsTable.$inferSelect;

export const insertCashAdvanceSchema = createInsertSchema(cashAdvancesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCashAdvance = z.infer<typeof insertCashAdvanceSchema>;
export type CashAdvance = typeof cashAdvancesTable.$inferSelect;
