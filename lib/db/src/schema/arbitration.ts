import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const arbitrationCasesTable = pgTable("arbitration_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  type: text("type").notNull().default("arbitration"),
  status: text("status").notNull().default("pending"),
  claimant: text("claimant").notNull(),
  respondent: text("respondent").notNull(),
  arbitrator: text("arbitrator"),
  claimAmount: text("claim_amount"),
  description: text("description"),
  parties: jsonb("parties").notNull().default([]),
  documents: jsonb("documents").notNull().default([]),
  sessions: jsonb("sessions").notNull().default([]),
  decision: text("decision"),
  decisionDate: timestamp("decision_date"),
  filedAt: timestamp("filed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
