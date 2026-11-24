import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Matches migrations 003/004/015/017 — DDL authority is artifacts/api-server/migrations. */
export const casesTable = pgTable("cases", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title:       text("title").notNull(),
  description: text("description"),
  caseType:    text("case_type").notNull().default("مدنية"),
  status:      text("status").notNull().default("open"),
  clientName:  text("client_name"),
  assignedTo:  text("assigned_to"),
  officeId:    text("office_id"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
  /* Migration 017 — nullable ADD COLUMN IF NOT EXISTS (no NOT NULL force) */
  caseNumber:            text("case_number"),
  courtName:             text("court_name"),
  courtCode:             text("court_code"),
  courtCity:             text("court_city"),
  courtDistrictNumber:   integer("court_district_number"),
  courtDistrictType:     text("court_district_type"),
  nextHearingDate:       timestamp("next_hearing_date", { withTimezone: true }),
  deletedAt:             timestamp("deleted_at", { withTimezone: true }),
  version:               integer("version").default(1),
});

export const insertCaseSchema = createInsertSchema(casesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof casesTable.$inferSelect;
