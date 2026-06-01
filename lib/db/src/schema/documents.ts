import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentsTable = pgTable("documents", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  caseId:    text("case_id"),
  fileUrl:   text("file_url").notNull(),
  fileType:  text("file_type").notNull(),
  fileName:  text("file_name"),
  ocrText:   text("ocr_text"),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, createdAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
