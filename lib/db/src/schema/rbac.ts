import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rolesTable = pgTable("roles", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:        text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  permissions: text("permissions").notNull().default("[]"),
  isSystem:    boolean("is_system").notNull().default(false),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export const invitationsTable = pgTable("invitations", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email:       text("email").notNull(),
  role:        text("role").notNull().default("lawyer"),
  token:       text("token").notNull().$defaultFn(() => crypto.randomUUID()),
  status:      text("status").notNull().default("pending"),
  invitedBy:   text("invited_by"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  expiresAt:   timestamp("expires_at").notNull(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:       text("user_id"),
  userFullName: text("user_full_name"),
  action:       text("action").notNull(),
  resource:     text("resource").notNull(),
  resourceId:   text("resource_id"),
  details:      text("details"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const insertRoleSchema = createInsertSchema(rolesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof rolesTable.$inferSelect;

export const insertInvitationSchema = createInsertSchema(invitationsTable).omit({ id: true, token: true, createdAt: true });
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitationsTable.$inferSelect;

export type AuditLog = typeof auditLogsTable.$inferSelect;
