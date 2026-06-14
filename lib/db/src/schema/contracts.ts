import { pgTable, uuid, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const contractsTable = pgTable("contracts", {
  id:          uuid("id").primaryKey().defaultRandom(),
  title:       text("title").notNull(),
  type:        text("type").notNull().default("general"),
  status:      text("status").notNull().default("draft"),
  parties:     jsonb("parties").notNull().default([]),
  content:     text("content"),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  riskScore:   text("risk_score"),
  notes:       text("notes"),
  expiresAt:   timestamp("expires_at"),
  signedAt:    timestamp("signed_at"),
  clientId:    uuid("client_id"),
  caseId:      uuid("case_id"),
  officeId:    text("office_id"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});
