import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "عدالة AI — API Documentation",
    version: "2.0.0",
    description:
      "RESTful API for عدالة AI Legal Practice Management SaaS. All protected endpoints require a valid Clerk session cookie or Bearer token.",
    contact: { name: "عدالة AI Support", email: "support@adalah-ai.sa" },
    license: { name: "Proprietary" },
  },
  servers: [
    { url: "/api", description: "Current environment" },
  ],
  tags: [
    { name: "Auth",         description: "Authentication & sessions" },
    { name: "Cases",        description: "Legal case management" },
    { name: "Clients",      description: "Client directory" },
    { name: "Documents",    description: "Document storage & templates" },
    { name: "Invoices",     description: "Billing & invoices" },
    { name: "Accounting",   description: "Revenues, expenses & ledger" },
    { name: "AI",           description: "AI assistant, legal analysis & copilot" },
    { name: "Admin",        description: "Super-admin platform controls" },
    { name: "Billing",      description: "Subscriptions & payment plans" },
    { name: "Security",     description: "2FA, sessions & audit logs" },
    { name: "Demo",         description: "Demo environment" },
  ],
  components: {
    securitySchemes: {
      ClerkSession: {
        type: "apiKey" as const,
        in: "cookie",
        name: "__session",
        description: "Clerk session cookie (set automatically after login)",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "string" },
        },
      },
      Case: {
        type: "object",
        properties: {
          id:          { type: "string", format: "uuid" },
          title:       { type: "string" },
          caseNumber:  { type: "string" },
          status:      { type: "string", enum: ["open", "closed", "pending", "archived"] },
          type:        { type: "string" },
          clientId:    { type: "string", format: "uuid" },
          officeId:    { type: "string", format: "uuid" },
          description: { type: "string" },
          nextSession: { type: "string", format: "date-time" },
          createdAt:   { type: "string", format: "date-time" },
          updatedAt:   { type: "string", format: "date-time" },
        },
      },
      Client: {
        type: "object",
        properties: {
          id:        { type: "string", format: "uuid" },
          name:      { type: "string" },
          email:     { type: "string", format: "email" },
          phone:     { type: "string" },
          idNumber:  { type: "string" },
          type:      { type: "string", enum: ["individual", "company"] },
          officeId:  { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Invoice: {
        type: "object",
        properties: {
          id:          { type: "string", format: "uuid" },
          invoiceNumber: { type: "string" },
          clientId:    { type: "string", format: "uuid" },
          caseId:      { type: "string", format: "uuid" },
          amount:      { type: "number" },
          status:      { type: "string", enum: ["draft", "sent", "paid", "overdue", "cancelled"] },
          dueDate:     { type: "string", format: "date" },
          createdAt:   { type: "string", format: "date-time" },
        },
      },
      TwoFactorStatus: {
        type: "object",
        properties: {
          enabled:    { type: "boolean" },
          configured: { type: "boolean" },
        },
      },
    },
  },
  security: [{ ClerkSession: [] }],
  paths: {
    "/health": {
      get: {
        tags: ["Auth"],
        summary: "Health check",
        security: [],
        responses: {
          "200": { description: "Server is healthy", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, uptime: { type: "number" } } } } } },
        },
      },
    },
    "/demo/credentials": {
      get: {
        tags: ["Demo"],
        summary: "Get demo login credentials",
        security: [],
        responses: {
          "200": {
            description: "Demo credentials",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email:    { type: "string" },
                    password: { type: "string" },
                    note:     { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/cases": {
      get: {
        tags: ["Cases"],
        summary: "List all cases for the current office",
        parameters: [
          { name: "status",  in: "query", schema: { type: "string" } },
          { name: "page",    in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",   in: "query", schema: { type: "integer", default: 20 } },
          { name: "search",  in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "List of cases", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { "$ref": "#/components/schemas/Case" } }, total: { type: "integer" } } } } } },
          "401": { description: "Unauthorized" },
        },
      },
      post: {
        tags: ["Cases"],
        summary: "Create a new case",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "clientId"],
                properties: {
                  title:       { type: "string" },
                  clientId:    { type: "string", format: "uuid" },
                  type:        { type: "string" },
                  description: { type: "string" },
                  caseNumber:  { type: "string" },
                  nextSession: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Case created", content: { "application/json": { schema: { "$ref": "#/components/schemas/Case" } } } },
          "400": { description: "Validation error" },
        },
      },
    },
    "/cases/{id}": {
      get: {
        tags: ["Cases"],
        summary: "Get case details",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Case details", content: { "application/json": { schema: { "$ref": "#/components/schemas/Case" } } } },
          "404": { description: "Not found" },
        },
      },
      put: {
        tags: ["Cases"],
        summary: "Update a case",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/Case" } } } },
        responses: {
          "200": { description: "Updated case" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        tags: ["Cases"],
        summary: "Delete a case",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Deleted successfully" },
          "404": { description: "Not found" },
        },
      },
    },
    "/clients": {
      get: {
        tags: ["Clients"],
        summary: "List clients",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "type",   in: "query", schema: { type: "string", enum: ["individual", "company"] } },
        ],
        responses: {
          "200": { description: "Clients list", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/Client" } } } } },
        },
      },
      post: {
        tags: ["Clients"],
        summary: "Create a client",
        requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/Client" } } } },
        responses: { "201": { description: "Client created" } },
      },
    },
    "/invoices": {
      get: {
        tags: ["Invoices"],
        summary: "List invoices",
        responses: {
          "200": { description: "Invoices", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/Invoice" } } } } },
        },
      },
      post: {
        tags: ["Invoices"],
        summary: "Create invoice",
        requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/Invoice" } } } },
        responses: { "201": { description: "Invoice created" } },
      },
    },
    "/ai/query": {
      post: {
        tags: ["AI"],
        summary: "Unified AI query gateway",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "query"],
                properties: {
                  type:    { type: "string", enum: ["legal_analysis", "contract_review", "case_summary", "document_draft", "research", "translation", "risk_assessment"] },
                  query:   { type: "string" },
                  context: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "AI response", content: { "application/json": { schema: { type: "object", properties: { result: { type: "string" }, cached: { type: "boolean" }, model: { type: "string" } } } } } },
        },
      },
    },
    "/2fa/status": {
      get: {
        tags: ["Security"],
        summary: "Check 2FA status for current user",
        responses: {
          "200": { description: "2FA status", content: { "application/json": { schema: { "$ref": "#/components/schemas/TwoFactorStatus" } } } },
        },
      },
    },
    "/2fa/setup": {
      post: {
        tags: ["Security"],
        summary: "Initiate 2FA setup — returns QR code and secret",
        responses: {
          "200": {
            description: "Setup data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    secret:     { type: "string" },
                    qrCodeUrl:  { type: "string" },
                    manualCode: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/2fa/verify": {
      post: {
        tags: ["Security"],
        summary: "Verify TOTP code (confirms setup or authenticates login)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["token"], properties: { token: { type: "string", minLength: 6, maxLength: 6 } } } } },
        },
        responses: {
          "200": { description: "Verified", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, backupCodes: { type: "array", items: { type: "string" } } } } } } },
          "400": { description: "Invalid token" },
        },
      },
    },
    "/2fa/disable": {
      post: {
        tags: ["Security"],
        summary: "Disable 2FA (requires current TOTP token)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["token"], properties: { token: { type: "string" } } } } },
        },
        responses: {
          "200": { description: "2FA disabled" },
          "400": { description: "Invalid token" },
        },
      },
    },
    "/billing/plans": {
      get: {
        tags: ["Billing"],
        summary: "List available subscription plans",
        security: [],
        responses: {
          "200": {
            description: "Plans list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" }, name: { type: "string" },
                      price: { type: "number" }, currency: { type: "string" },
                      features: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/admin/offices": {
      get: {
        tags: ["Admin"],
        summary: "List all registered offices (super-admin only)",
        responses: {
          "200": { description: "Offices list" },
          "403": { description: "Forbidden — super-admin only" },
        },
      },
    },
    "/audit-logs": {
      get: {
        tags: ["Security"],
        summary: "Get audit log for current office",
        parameters: [
          { name: "page",   in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",  in: "query", schema: { type: "integer", default: 50 } },
          { name: "action", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Audit log entries" },
        },
      },
    },
  },
};

export function registerSwaggerDocs(app: Express) {
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: "عدالة AI — API Docs",
      customCss: `
        .swagger-ui .topbar { background: #1A56DB; }
        .swagger-ui .topbar-wrapper .link { color: #fff; font-family: Arial; }
        .swagger-ui .info .title { font-family: Arial; }
        body { direction: ltr; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
    }),
  );

  app.get("/api/docs.json", (_req, res) => {
    res.json(spec);
  });
}
