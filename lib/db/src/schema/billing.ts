import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = pgTable("invoices", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  amount:    real("amount").notNull(),
  status:    text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  planName:  text("plan_name").notNull(),
  planPrice: real("plan_price").notNull(),
  status:    text("status").notNull().default("active"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate:   timestamp("end_date").notNull(),
});

export const usageLogsTable = pgTable("usage_logs", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  feature:   text("feature").notNull(),
  units:     integer("units").notNull(),
  cost:      real("cost").notNull(),
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
