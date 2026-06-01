import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email:     text("email").notNull().unique(),
  fullName:  text("full_name").notNull(),
  phone:     text("phone"),
  status:    text("status").notNull().default("active"),
  role:      text("role").notNull().default("lawyer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
