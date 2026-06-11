import { pgTable, text, real, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/* ── Subscription Plans ─────────────────────────────── */
export const plansTable = pgTable("plans", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:          text("name").notNull(),
  nameEn:        text("name_en"),
  slug:          text("slug"),
  description:   text("description"),
  price:         real("price").notNull().default(0),
  monthlyPrice:  real("monthly_price"),
  yearlyPrice:   real("yearly_price"),
  billingCycle:  text("billing_cycle").notNull().default("monthly"),
  color:         text("color").default("#C9A84C"),
  features:      jsonb("features").$type<string[]>().default([]),
  featureFlags:  jsonb("feature_flags").$type<Record<string, boolean>>().default({}),
  maxUsers:      integer("max_users").notNull().default(5),
  maxCases:      integer("max_cases").notNull().default(100),
  maxClients:    integer("max_clients").default(50),
  maxAiCalls:    integer("max_ai_calls").notNull().default(500),
  maxStorageGb:  integer("max_storage_gb").default(5),
  maxBranches:   integer("max_branches").default(0),
  isActive:      boolean("is_active").notNull().default(true),
  isVisible:     boolean("is_visible").notNull().default(true),
  isHighlighted: boolean("is_highlighted").notNull().default(false),
  displayOrder:  integer("display_order").notNull().default(0),
  stripePriceId: text("stripe_price_id"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

/* ── Discount Codes ─────────────────────────────────── */
export const discountCodesTable = pgTable("discount_codes", {
  id:         text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code:       text("code").notNull().unique(),
  type:       text("type").notNull().default("percent"),
  value:      real("value").notNull(),
  planId:     text("plan_id"),
  maxUses:    integer("max_uses").notNull().default(100),
  usedCount:  integer("used_count").notNull().default(0),
  expiresAt:  timestamp("expires_at"),
  isActive:   boolean("is_active").notNull().default(true),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

/* ── AI API Keys ─────────────────────────────────────── */
export const aiApiKeysTable = pgTable("ai_api_keys", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider:    text("provider").notNull(),
  keyLabel:    text("key_label").notNull(),
  keyHash:     text("key_hash").notNull(),
  keyMasked:   text("key_masked").notNull(),
  isActive:    boolean("is_active").notNull().default(true),
  usageCount:  integer("usage_count").notNull().default(0),
  totalCost:   real("total_cost").notNull().default(0),
  lastUsedAt:  timestamp("last_used_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

/* ── Platform Settings ──────────────────────────────── */
export const platformSettingsTable = pgTable("platform_settings", {
  key:         text("key").primaryKey(),
  value:       text("value").notNull().default(""),
  label:       text("label").notNull(),
  description: text("description"),
  group:       text("group").notNull().default("general"),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

/* ── Departments ────────────────────────────────────── */
export const departmentsTable = pgTable("departments", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:        text("name").notNull(),
  nameEn:      text("name_en"),
  description: text("description"),
  parentId:    text("parent_id"),
  color:       text("color").default("#C9A84C"),
  isActive:    boolean("is_active").notNull().default(true),
  sortOrder:   integer("sort_order").notNull().default(0),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

/* ── Job Titles ─────────────────────────────────────── */
export const jobTitlesTable = pgTable("job_titles", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:         text("name").notNull(),
  nameEn:       text("name_en"),
  departmentId: text("department_id"),
  level:        text("level").default("staff"),
  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

/* ── Legal Systems & Rulings ────────────────────────── */
export const legalSystemsTable = pgTable("legal_systems", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title:         text("title").notNull(),
  titleEn:       text("title_en"),
  category:      text("category").notNull().default("نظام"),
  content:       text("content"),
  fileUrl:       text("file_url"),
  source:        text("source"),
  effectiveDate: text("effective_date"),
  version:       text("version"),
  isActive:      boolean("is_active").notNull().default(true),
  viewCount:     integer("view_count").notNull().default(0),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

/* ── Support Tickets ────────────────────────────────── */
export const supportTicketsTable = pgTable("support_tickets", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subject:      text("subject").notNull(),
  body:         text("body").notNull(),
  status:       text("status").notNull().default("open"),
  priority:     text("priority").notNull().default("medium"),
  category:     text("category").notNull().default("technical"),
  userEmail:    text("user_email").notNull(),
  userName:     text("user_name").notNull(),
  officeName:   text("office_name"),
  assignedTo:   text("assigned_to"),
  response:     text("response"),
  resolvedAt:   timestamp("resolved_at"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});

/* ── Office Registry (for super admin view) ─────────── */
export const officeRegistryTable = pgTable("office_registry", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  officeName:  text("office_name"),
  ownerName:   text("owner_name"),
  ownerEmail:  text("owner_email").notNull(),
  planId:      text("plan_id"),
  planName:    text("plan_name").default("free"),
  status:      text("status").notNull().default("active"),
  notes:       text("notes"),
  joinedAt:    timestamp("joined_at").notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at"),
});

/* ── Insert Schemas ─────────────────────────────────── */
export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;

export const insertDiscountCodeSchema = createInsertSchema(discountCodesTable).omit({ id: true, createdAt: true, usedCount: true });
export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;
export type DiscountCode = typeof discountCodesTable.$inferSelect;

export const insertLegalSystemSchema = createInsertSchema(legalSystemsTable).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true });
export type InsertLegalSystem = z.infer<typeof insertLegalSystemSchema>;
export type LegalSystem = typeof legalSystemsTable.$inferSelect;

export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;

export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({ id: true, createdAt: true });
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departmentsTable.$inferSelect;

export const insertJobTitleSchema = createInsertSchema(jobTitlesTable).omit({ id: true, createdAt: true });
export type InsertJobTitle = z.infer<typeof insertJobTitleSchema>;
export type JobTitle = typeof jobTitlesTable.$inferSelect;
