import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientInvoicesTable = pgTable("client_invoices", {
  id:                   text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceNumber:        text("invoice_number").notNull(),
  clientId:             text("client_id"),
  caseId:               text("case_id"),
  title:                text("title").notNull(),
  items:                text("items").notNull().default("[]"),
  subtotal:             integer("subtotal").notNull().default(0),
  vatRate:              integer("vat_rate").notNull().default(15),
  vatAmount:            integer("vat_amount").notNull().default(0),
  total:                integer("total").notNull().default(0),
  currency:             text("currency").notNull().default("SAR"),
  status:               text("status").notNull().default("draft"),
  dueDate:              text("due_date"),
  notes:                text("notes"),
  stripePaymentLinkId:  text("stripe_payment_link_id"),
  stripePaymentLinkUrl: text("stripe_payment_link_url"),
  stripePriceId:        text("stripe_price_id"),
  stripeProductId:      text("stripe_product_id"),
  paidAt:               timestamp("paid_at"),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at"),
});

export const insertClientInvoiceSchema = createInsertSchema(clientInvoicesTable).omit({ id: true, createdAt: true });
export type InsertClientInvoice = z.infer<typeof insertClientInvoiceSchema>;
export type ClientInvoice = typeof clientInvoicesTable.$inferSelect;
