import { pgTable, uuid, text, timestamp, numeric, boolean, integer, date } from "drizzle-orm/pg-core";

export const officePageTable = pgTable("office_page", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logo: text("logo"),
  tagline: text("tagline"),
  about: text("about"),
  licenseNumber: text("license_number"),
  experienceYears: integer("experience_years").default(0),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  regions: text("regions"),
  facebook: text("facebook"),
  twitter: text("twitter"),
  linkedin: text("linkedin"),
  website: text("website"),
  casesCount: integer("cases_count").default(0),
  clientsCount: integer("clients_count").default(0),
  successRate: integer("success_rate").default(0),
  showStats: boolean("show_stats").default(true),
  isPublished: boolean("is_published").default(false),
  primaryColor: text("primary_color").default("#C9A84C"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const officeServicesTable = pgTable("office_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  officeId: uuid("office_id").notNull().references(() => officePageTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price"),
  isCustomQuote: boolean("is_custom_quote").default(false),
  category: text("category").default("استشارات"),
  deliveryDays: integer("delivery_days").default(1),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const officeTeamTable = pgTable("office_team", {
  id: uuid("id").primaryKey().defaultRandom(),
  officeId: uuid("office_id").notNull().references(() => officePageTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  title: text("title").notNull(),
  specialties: text("specialties"),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  linkedin: text("linkedin"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const officeOrdersTable = pgTable("office_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  officeId: uuid("office_id").notNull().references(() => officePageTable.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").references(() => officeServicesTable.id),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientEmail: text("client_email"),
  notes: text("notes"),
  amount: numeric("amount"),
  status: text("status").notNull().default("pending"),
  isQuoteRequest: boolean("is_quote_request").default(false),
  stripeSessionId: text("stripe_session_id"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const officeReviewsTable = pgTable("office_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  officeId: uuid("office_id").notNull().references(() => officePageTable.id, { onDelete: "cascade" }),
  clientName: text("client_name").notNull(),
  rating: integer("rating").notNull().default(5),
  comment: text("comment"),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const officeArticlesTable = pgTable("office_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  officeId: uuid("office_id").notNull().references(() => officePageTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  category: text("category").default("قانوني"),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
