import { pgTable, text, numeric, integer, timestamp, boolean, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = pgTable("invoices", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  amount:    numeric("amount", { precision: 18, scale: 2 }).notNull(),
  status:    text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id:              text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  planName:        text("plan_name").notNull(),
  planPrice:       numeric("plan_price", { precision: 18, scale: 2 }).notNull(),
  status:          text("status").notNull().default("active"),
  startDate:       timestamp("start_date").notNull().defaultNow(),
  endDate:         timestamp("end_date").notNull(),
  acceptedTerms:   boolean("accepted_terms").default(false),
  acceptedTermsAt: timestamp("accepted_terms_at"),
  ipAddress:       varchar("ip_address", { length: 100 }),
  userAgent:       text("user_agent"),
});

export const usageLogsTable = pgTable("usage_logs", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  feature:   text("feature").notNull(),
  units:     integer("units").notNull(),
  cost:      numeric("cost", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

export const insertUsageLogSchema = createInsertSchema(usageLogsTable).omit({ id: true, createdAt: true });
export type InsertUsageLog = z.infer<typeof insertUsageLogSchema>;
export type UsageLog = typeof usageLogsTable.$inferSelect;

/* ── Plan Change Notifications ──────────────────────── */
export const planNotificationsTable = pgTable("plan_notifications", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type:      text("type").notNull().default("plan_change"),
  oldPlan:   text("old_plan"),
  newPlan:   text("new_plan"),
  title:     text("title").notNull(),
  message:   text("message").notNull(),
  isRead:    boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type PlanNotification = typeof planNotificationsTable.$inferSelect;
