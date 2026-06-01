import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = pgTable("messages", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  caseId:    text("case_id"),
  channel:   text("channel").notNull().default("whatsapp"),
  direction: text("direction").notNull().default("outbound"),
  content:   text("content").notNull(),
  status:    text("status").notNull().default("sent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
