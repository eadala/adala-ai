import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const DEFAULT_TOKENS = {
  colors: {
    primary:    "#1A2744",
    accent:     "#C9A84C",
    background: "#0D1526",
    surface:    "#1E2D4A",
    sidebar:    "#0F1C35",
    text:       "#E8EAF0",
    textMuted:  "#8899AA",
    border:     "#2A3A58",
    success:    "#10B981",
    warning:    "#F59E0B",
    danger:     "#EF4444",
  },
  typography: {
    fontFamily:   "Cairo",
    headingFont:  "Cairo",
    baseSize:     "14",
    headingWeight:"700",
    bodyWeight:   "400",
  },
  radius: {
    card:   "12",
    button: "8",
    input:  "8",
    badge:  "6",
  },
  spacing: {
    sm: "8",
    md: "16",
    lg: "24",
    xl: "32",
  },
  shadows: {
    card: "0 4px 24px rgba(0,0,0,0.3)",
    button: "0 2px 8px rgba(201,168,76,0.25)",
  },
};

async function sqlOne(q: any) {
  try {
    const r = await db.execute(q) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return rows[0] ?? null;
  } catch { return null; }
}

/* ── GET /theme-builder/tokens ── */
router.get("/theme-builder/tokens", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    const uid = userId ?? "default";
    const row = await sqlOne(sql`
      SELECT tokens FROM office_themes WHERE user_id = ${uid} AND is_active = true
      ORDER BY updated_at DESC LIMIT 1
    `);
    res.json({ tokens: row?.tokens ?? DEFAULT_TOKENS });
  } catch { res.json({ tokens: DEFAULT_TOKENS }); }
});

/* ── POST /theme-builder/save ── */
router.post("/theme-builder/save", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    const { tokens, name } = req.body;
    if (!tokens) return res.status(400).json({ error: "tokens مطلوب" });
    const row = await sqlOne(sql`
      INSERT INTO office_themes (user_id, name, tokens, is_active, updated_at)
      VALUES (
        ${userId!},
        ${name ?? "الثيم المخصص"},
        ${JSON.stringify(tokens)}::jsonb,
        true,
        NOW()
      )
      ON CONFLICT DO NOTHING
      RETURNING *
    `);
    if (!row) {
      await db.execute(sql`
        UPDATE office_themes
        SET tokens = ${JSON.stringify(tokens)}::jsonb,
            name   = ${name ?? "الثيم المخصص"},
            updated_at = NOW()
        WHERE user_id = ${userId!} AND is_active = true
      `);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /theme-builder/presets ── */
router.get("/theme-builder/presets", (_req, res) => {
  res.json([
    {
      id: "dark-navy",
      name: "أزرق داكن (الافتراضي)",
      preview: "#1A2744",
      tokens: DEFAULT_TOKENS,
    },
    {
      id: "midnight-gold",
      name: "ليلي ذهبي",
      preview: "#0A0A1A",
      tokens: {
        ...DEFAULT_TOKENS,
        colors: { ...DEFAULT_TOKENS.colors, primary: "#0A0A1A", accent: "#FFD700", background: "#05050F", surface: "#111125", sidebar: "#080818" },
      },
    },
    {
      id: "deep-teal",
      name: "فيروزي داكن",
      preview: "#0A2E2E",
      tokens: {
        ...DEFAULT_TOKENS,
        colors: { ...DEFAULT_TOKENS.colors, primary: "#0A2E2E", accent: "#00C9A7", background: "#071E1E", surface: "#0D2A2A", sidebar: "#071E1E" },
      },
    },
    {
      id: "royal-purple",
      name: "بنفسجي ملكي",
      preview: "#1A0A3D",
      tokens: {
        ...DEFAULT_TOKENS,
        colors: { ...DEFAULT_TOKENS.colors, primary: "#1A0A3D", accent: "#9F7AEA", background: "#0D0520", surface: "#180940", sidebar: "#0D0520" },
      },
    },
    {
      id: "light-legal",
      name: "قانوني فاتح",
      preview: "#F8F9FA",
      tokens: {
        ...DEFAULT_TOKENS,
        colors: { ...DEFAULT_TOKENS.colors, primary: "#1E3A5F", accent: "#C9A84C", background: "#F8F9FA", surface: "#FFFFFF", sidebar: "#1E3A5F", text: "#1A202C", textMuted: "#718096", border: "#E2E8F0" },
      },
    },
  ]);
});

export default router;
