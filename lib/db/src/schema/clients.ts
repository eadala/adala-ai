import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const clientsTable = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  type: text("type").notNull().default("individual"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  nationalId: text("national_id"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  source: text("source").default("direct"),
  tags: jsonb("tags").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
