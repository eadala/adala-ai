import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth, createClerkClient } from "@clerk/express";
import crypto from "crypto";

const router = Router();

/* ── Auth ─────────────────────────────────────────── */
let _clerk: ReturnType<typeof createClerkClient> | null = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
}
async function isSuperAdmin(req: any): Promise<boolean> {
  const auth = getAuth(req);
  if (!auth?.userId) return false;
  try {
    const user = await getClerk().users.getUser(auth.userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const owner = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    return (!!owner && email === owner) || user.publicMetadata?.role === "super_admin";
  } catch { return false; }
}
async function adminOnly(req: any, res: any, next: any) {
  if (!(await isSuperAdmin(req))) return res.status(403).json({ error: "غير مصرح" });
  next();
}
async function safeRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

/* ══════════════════════════════════════════════════
   DATABASE STUDIO — Custom Tables
══════════════════════════════════════════════════ */
router.get("/studio/tables", adminOnly, async (_req, res) => {
  const rows = await safeRows(sql`
    SELECT t.*, COUNT(f.id)::int AS fields_count
    FROM studio_custom_tables t
    LEFT JOIN studio_custom_fields f ON f.table_id = t.id
    GROUP BY t.id ORDER BY t.created_at DESC
  `);
  res.json(rows);
});

router.post("/studio/tables", adminOnly, async (req, res) => {
  const { tableName, displayName, icon = "table", description } = req.body;
  if (!tableName) return res.status(400).json({ error: "اسم الجدول مطلوب" });
  const clean = tableName.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  try {
    const rows = await safeRows(sql`
      INSERT INTO studio_custom_tables (table_name, display_name, icon, description)
      VALUES (${clean}, ${displayName ?? clean}, ${icon}, ${description ?? null})
      RETURNING *
    `);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/studio/tables/:id", adminOnly, async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM studio_custom_fields WHERE table_id=${String(req.params.id)}::uuid`);
    await db.execute(sql`DELETE FROM studio_custom_tables WHERE id=${String(req.params.id)}::uuid`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Custom Fields ── */
router.get("/studio/tables/:id/fields", adminOnly, async (req, res) => {
  const rows = await safeRows(sql`
    SELECT * FROM studio_custom_fields WHERE table_id=${String(req.params.id)}::uuid ORDER BY sort_order, created_at
  `);
  res.json(rows);
});

router.post("/studio/tables/:id/fields", adminOnly, async (req, res) => {
  const { fieldName, fieldLabel, fieldType = "text", required = false, options, defaultValue } = req.body;
  if (!fieldName) return res.status(400).json({ error: "اسم الحقل مطلوب" });
  try {
    const rows = await safeRows(sql`
      INSERT INTO studio_custom_fields (table_id, field_name, field_label, field_type, required, default_value, options)
      VALUES (${String(req.params.id)}::uuid, ${fieldName}, ${fieldLabel ?? fieldName}, ${fieldType}, ${required}, ${defaultValue ?? null}, ${options ? JSON.stringify(options) : null})
      RETURNING *
    `);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/studio/fields/:id", adminOnly, async (req, res) => {
  await db.execute(sql`DELETE FROM studio_custom_fields WHERE id=${String(req.params.id)}::uuid`);
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   FORM BUILDER
══════════════════════════════════════════════════ */
router.get("/studio/forms", adminOnly, async (_req, res) => {
  const rows = await safeRows(sql`SELECT * FROM studio_forms ORDER BY created_at DESC`);
  res.json(rows);
});

router.post("/studio/forms", adminOnly, async (req, res) => {
  const { name, description, isPublic = false, fields = [], settings = {} } = req.body;
  if (!name) return res.status(400).json({ error: "اسم النموذج مطلوب" });
  const slug = name.replace(/\s+/g, "-").replace(/[^a-z0-9\-]/gi, "").toLowerCase() + "-" + Date.now();
  try {
    const rows = await safeRows(sql`
      INSERT INTO studio_forms (name, slug, description, is_public, fields, settings)
      VALUES (${name}, ${slug}, ${description ?? null}, ${isPublic}, ${JSON.stringify(fields)}, ${JSON.stringify(settings)})
      RETURNING *
    `);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/studio/forms/:id", adminOnly, async (req, res) => {
  const { name, description, isPublic, fields, settings } = req.body;
  try {
    const rows = await safeRows(sql`
      UPDATE studio_forms SET
        name=${name ?? sql`name`},
        description=${description ?? null},
        is_public=${isPublic ?? sql`is_public`},
        fields=${fields ? JSON.stringify(fields) : sql`fields`},
        settings=${settings ? JSON.stringify(settings) : sql`settings`},
        updated_at=NOW()
      WHERE id=${String(req.params.id)}::uuid RETURNING *
    `);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/studio/forms/:id", adminOnly, async (req, res) => {
  await db.execute(sql`DELETE FROM studio_forms WHERE id=${String(req.params.id)}::uuid`);
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   WORKFLOW BUILDER
══════════════════════════════════════════════════ */
router.get("/studio/workflows", adminOnly, async (_req, res) => {
  const rows = await safeRows(sql`SELECT * FROM studio_workflows ORDER BY created_at DESC`);
  res.json(rows);
});

router.post("/studio/workflows", adminOnly, async (req, res) => {
  const { name, description, trigger, triggerConfig = {}, actions = [] } = req.body;
  if (!name) return res.status(400).json({ error: "اسم سير العمل مطلوب" });
  try {
    const rows = await safeRows(sql`
      INSERT INTO studio_workflows (name, description, trigger, trigger_config, actions)
      VALUES (${name}, ${description ?? null}, ${trigger ?? "manual"}, ${JSON.stringify(triggerConfig)}, ${JSON.stringify(actions)})
      RETURNING *
    `);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/studio/workflows/:id/toggle", adminOnly, async (req, res) => {
  const rows = await safeRows(sql`
    UPDATE studio_workflows SET is_active=NOT is_active WHERE id=${String(req.params.id)}::uuid RETURNING *
  `);
  res.json(rows[0] ?? { ok: true });
});

router.delete("/studio/workflows/:id", adminOnly, async (req, res) => {
  await db.execute(sql`DELETE FROM studio_workflows WHERE id=${String(req.params.id)}::uuid`);
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   PLUGIN STORE
══════════════════════════════════════════════════ */
router.get("/studio/plugins", adminOnly, async (_req, res) => {
  const rows = await safeRows(sql`SELECT * FROM studio_plugins ORDER BY category, name`);
  res.json(rows);
});

router.patch("/studio/plugins/:id/toggle", adminOnly, async (req, res) => {
  const rows = await safeRows(sql`
    UPDATE studio_plugins
    SET is_enabled=NOT is_enabled,
        installed_at=CASE WHEN NOT is_enabled THEN NOW() ELSE NULL END
    WHERE id=${String(req.params.id)}::uuid RETURNING *
  `);
  res.json(rows[0] ?? { ok: true });
});

/* ══════════════════════════════════════════════════
   API CENTER — Studio API Keys
══════════════════════════════════════════════════ */
router.get("/studio/api-keys", adminOnly, async (_req, res) => {
  const rows = await safeRows(sql`SELECT id, name, scope, office_id, is_active, last_used_at, expires_at, created_at, left(api_key, 12) || '…' AS api_key_preview FROM studio_api_keys ORDER BY created_at DESC`);
  res.json(rows);
});

router.post("/studio/api-keys", adminOnly, async (req, res) => {
  const { name, scope = "read", officeId, expiresAt } = req.body;
  if (!name) return res.status(400).json({ error: "اسم المفتاح مطلوب" });
  const key = "sk_" + crypto.randomBytes(24).toString("hex");
  try {
    const rows = await safeRows(sql`
      INSERT INTO studio_api_keys (name, api_key, scope, office_id, expires_at)
      VALUES (${name}, ${key}, ${scope}, ${officeId ?? null}, ${expiresAt ?? null})
      RETURNING *
    `);
    res.json({ ...rows[0], api_key: key }); /* Return full key once only */
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/studio/api-keys/:id/toggle", adminOnly, async (req, res) => {
  const rows = await safeRows(sql`UPDATE studio_api_keys SET is_active=NOT is_active WHERE id=${String(req.params.id)}::uuid RETURNING id, name, is_active`);
  res.json(rows[0] ?? { ok: true });
});

router.delete("/studio/api-keys/:id", adminOnly, async (req, res) => {
  await db.execute(sql`DELETE FROM studio_api_keys WHERE id=${String(req.params.id)}::uuid`);
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   AI DEVELOPER — Task queue
══════════════════════════════════════════════════ */
router.get("/studio/ai-tasks", adminOnly, async (_req, res) => {
  const rows = await safeRows(sql`SELECT * FROM studio_ai_tasks ORDER BY created_at DESC LIMIT 50`);
  res.json(rows);
});

router.post("/studio/ai-tasks", adminOnly, async (req, res) => {
  const { prompt, taskType = "generate_module" } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: "الوصف مطلوب" });
  try {
    const rows = await safeRows(sql`
      INSERT INTO studio_ai_tasks (prompt, task_type) VALUES (${prompt}, ${taskType}) RETURNING *
    `);
    const task = rows[0];
    /* Simulate async processing — in production hook up to AI service */
    setTimeout(async () => {
      const result = {
        schema: `/* Auto-generated Drizzle schema for: ${prompt.slice(0, 50)} */\nexport const newTable = pgTable("new_table", { id: uuid("id").primaryKey() });`,
        routes: `// GET /api/new-module\n// POST /api/new-module\n// PUT /api/new-module/:id\n// DELETE /api/new-module/:id`,
        page: `// React page auto-scaffold\nexport default function NewModulePage() { return <div>New Module</div>; }`,
        navItem: `{ href: "/new-module", label: "الوحدة الجديدة", icon: FolderPlus }`,
      };
      await db.execute(sql`
        UPDATE studio_ai_tasks SET status='completed', result=${JSON.stringify(result)}, completed_at=NOW()
        WHERE id=${task.id}::uuid
      `);
    }, 2000);
    res.json(task);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/studio/ai-tasks/:id", adminOnly, async (req, res) => {
  const rows = await safeRows(sql`SELECT * FROM studio_ai_tasks WHERE id=${String(req.params.id)}::uuid`);
  res.json(rows[0] ?? { error: "not found" });
});

/* ── Studio Overview Stats ── */
router.get("/studio/stats", adminOnly, async (_req, res) => {
  const [tables, forms, workflows, plugins, apiKeys, aiTasks] = await Promise.all([
    safeRows(sql`SELECT COUNT(*)::int AS cnt FROM studio_custom_tables`),
    safeRows(sql`SELECT COUNT(*)::int AS cnt FROM studio_forms`),
    safeRows(sql`SELECT COUNT(*)::int AS cnt FROM studio_workflows WHERE is_active=true`),
    safeRows(sql`SELECT COUNT(*)::int AS cnt FROM studio_plugins WHERE is_enabled=true`),
    safeRows(sql`SELECT COUNT(*)::int AS cnt FROM studio_api_keys WHERE is_active=true`),
    safeRows(sql`SELECT COUNT(*)::int AS cnt FROM studio_ai_tasks`),
  ]);
  res.json({
    customTables:    tables[0]?.cnt ?? 0,
    forms:           forms[0]?.cnt ?? 0,
    activeWorkflows: workflows[0]?.cnt ?? 0,
    enabledPlugins:  plugins[0]?.cnt ?? 0,
    activeApiKeys:   apiKeys[0]?.cnt ?? 0,
    aiTasks:         aiTasks[0]?.cnt ?? 0,
  });
});

export default router;
