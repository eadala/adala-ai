import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/* ── Backup Settings (per office) ──────────────────────── */
export const backupSettingsTable = pgTable("backup_settings", {
  id:              text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schedule:        text("schedule").notNull().default("daily"),
  retentionDays:   integer("retention_days").notNull().default(30),
  storageProvider: text("storage_provider").notNull().default("local"),
  cloudConfig:     jsonb("cloud_config").$type<Record<string, string>>().default({}),
  isEnabled:       boolean("is_enabled").notNull().default(true),
  lastBackupAt:    timestamp("last_backup_at"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
});

/* ── Backup Jobs (history log) ──────────────────────────── */
export const backupJobsTable = pgTable("backup_jobs", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type:         text("type").notNull().default("manual"),
  scheduleType: text("schedule_type"),
  status:       text("status").notNull().default("completed"),
  sizeBytes:    integer("size_bytes").default(0),
  fileName:     text("file_name"),
  fileData:     text("file_data"),
  errorMessage: text("error_message"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  completedAt:  timestamp("completed_at"),
});

/* ── Zod schemas ─────────────────────────────────────────── */
export const insertBackupJobSchema = createInsertSchema(backupJobsTable).omit({ id: true, createdAt: true });
export type InsertBackupJob = z.infer<typeof insertBackupJobSchema>;
export type BackupJob = typeof backupJobsTable.$inferSelect;

export const insertBackupSettingsSchema = createInsertSchema(backupSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBackupSettings = z.infer<typeof insertBackupSettingsSchema>;
export type BackupSettings = typeof backupSettingsTable.$inferSelect;
