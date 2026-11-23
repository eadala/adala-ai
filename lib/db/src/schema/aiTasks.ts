import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiTasksTable = pgTable("ai_tasks", {
  id:         text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  caseId:     text("case_id"),
  documentId: text("document_id"),
  type:       text("type").notNull(),
  status:     text("status").notNull().default("pending"),
  priority:   integer("priority").notNull().default(3),
  inputText:  text("input_text"),
  outputText: text("output_text"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const insertAiTaskSchema = createInsertSchema(aiTasksTable).omit({ id: true, createdAt: true });
export type InsertAiTask = z.infer<typeof insertAiTaskSchema>;
export type AiTask = typeof aiTasksTable.$inferSelect;
