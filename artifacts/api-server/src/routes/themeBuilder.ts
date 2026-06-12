import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

/* ═══════════════════════════════════════════════════
   DEFAULT TOKENS  (dark navy — platform default)
═══════════════════════════════════════════════════ */
export const DEFAULT_TOKENS = {
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
    fontFamily:    "Cairo",
    headingFont:   "Cairo",
    baseSize:      "14",
    headingWeight: "700",
    bodyWeight:    "400",
  },
  radius:  { card: "12", button: "8",  input: "8",  badge: "6"  },
  spacing: { sm:  "8",   md:     "16", lg:    "24", xl:   "32" },
  shadows: {
    card:   "0 4px 24px rgba(0,0,0,0.3)",
    button: "0 2px 8px rgba(201,168,76,0.25)",
  },
  scope: "both" as const,
};

/* ═══════════════════════════════════════════════════
   PRESET DEFINITIONS  (12 Arabic-named presets)
═══════════════════════════════════════════════════ */
const PRESETS = [
  /* ── DARK ── */
  {
    id: "dark-navy",
    name: "أزرق داكن (الافتراضي)",
    category: "dark",
    preview: "#1A2744",
    tokens: DEFAULT_TOKENS,
  },
  {
    id: "midnight-gold",
    name: "ليلي ذهبي",
    category: "dark",
    preview: "#0A0A1A",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: { ...DEFAULT_TOKENS.colors, primary: "#0A0A1A", accent: "#FFD700", background: "#05050F", surface: "#111125", sidebar: "#080818", border: "#1E1E38", textMuted: "#888AAA" },
    },
  },
  {
    id: "deep-teal",
    name: "فيروزي داكن",
    category: "dark",
    preview: "#0A2E2E",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: { ...DEFAULT_TOKENS.colors, primary: "#0A2E2E", accent: "#00C9A7", background: "#071E1E", surface: "#0D2A2A", sidebar: "#071E1E", border: "#1A4040", textMuted: "#669988" },
    },
  },
  {
    id: "royal-purple",
    name: "بنفسجي ملكي",
    category: "dark",
    preview: "#1A0A3D",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: { ...DEFAULT_TOKENS.colors, primary: "#1A0A3D", accent: "#9F7AEA", background: "#0D0520", surface: "#180940", sidebar: "#0D0520", border: "#2D1060", textMuted: "#8070B0" },
    },
  },
  {
    id: "charcoal-slate",
    name: "فحمي رمادي",
    category: "dark",
    preview: "#1E2430",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: { ...DEFAULT_TOKENS.colors, primary: "#1E2430", accent: "#64B5F6", background: "#12151C", surface: "#1E2430", sidebar: "#12151C", border: "#2C3440", textMuted: "#7A8898" },
    },
  },
  {
    id: "dark-green-legal",
    name: "أخضر قضائي",
    category: "dark",
    preview: "#0D2820",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: { ...DEFAULT_TOKENS.colors, primary: "#0D2820", accent: "#4CAF76", background: "#081812", surface: "#0D2820", sidebar: "#081812", border: "#1A3D2E", textMuted: "#5D9B78" },
    },
  },

  /* ── LIGHT ── */
  {
    id: "pure-white",
    name: "أبيض نقي",
    category: "light",
    preview: "#FFFFFF",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: {
        primary:    "#E8EEF8",
        accent:     "#1E3A5F",
        background: "#FFFFFF",
        surface:    "#F8FAFC",
        sidebar:    "#F1F5F9",
        text:       "#0F172A",
        textMuted:  "#64748B",
        border:     "#CBD5E1",
        success:    "#16A34A",
        warning:    "#D97706",
        danger:     "#DC2626",
      },
    },
  },
  {
    id: "white-gold",
    name: "أبيض ذهبي",
    category: "light",
    preview: "#FFFEF7",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: {
        primary:    "#EEE8D8",
        accent:     "#C9A84C",
        background: "#FFFEF7",
        surface:    "#FFFFFF",
        sidebar:    "#FBF8F1",
        text:       "#1C1610",
        textMuted:  "#78663A",
        border:     "#DDD5BE",
        success:    "#16A34A",
        warning:    "#D97706",
        danger:     "#DC2626",
      },
    },
  },
  {
    id: "warm-sand",
    name: "رملي دافئ",
    category: "light",
    preview: "#FAF5EC",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: {
        primary:    "#E8D9B8",
        accent:     "#A0845C",
        background: "#FAF5EC",
        surface:    "#FFF8F0",
        sidebar:    "#EEE0C8",
        text:       "#2C1810",
        textMuted:  "#7C6040",
        border:     "#D4BC90",
        success:    "#4A7C59",
        warning:    "#D4831F",
        danger:     "#C0392B",
      },
    },
  },
  {
    id: "morning-blue",
    name: "أزرق صباحي",
    category: "light",
    preview: "#F0F7FF",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: {
        primary:    "#DBE9F8",
        accent:     "#1565C0",
        background: "#F0F7FF",
        surface:    "#FFFFFF",
        sidebar:    "#E3EEFA",
        text:       "#0D2137",
        textMuted:  "#4A6585",
        border:     "#BDD4EF",
        success:    "#1B7340",
        warning:    "#C77700",
        danger:     "#C0392B",
      },
    },
  },
  {
    id: "mint-fresh",
    name: "أخضر نعناعي",
    category: "light",
    preview: "#F0FAF5",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: {
        primary:    "#D0EEDC",
        accent:     "#0E7549",
        background: "#F0FAF5",
        surface:    "#FFFFFF",
        sidebar:    "#E0F2E9",
        text:       "#0D2818",
        textMuted:  "#3D7055",
        border:     "#B0DCC0",
        success:    "#0E7549",
        warning:    "#C77700",
        danger:     "#C0392B",
      },
    },
  },
  {
    id: "soft-gray",
    name: "رمادي ناعم",
    category: "light",
    preview: "#F5F7FA",
    tokens: {
      ...DEFAULT_TOKENS,
      colors: {
        primary:    "#E8ECF4",
        accent:     "#4F6BD6",
        background: "#F5F7FA",
        surface:    "#FFFFFF",
        sidebar:    "#EAEEF5",
        text:       "#1A202C",
        textMuted:  "#718096",
        border:     "#D1D9E8",
        success:    "#2E8B57",
        warning:    "#D4831F",
        danger:     "#E53E3E",
      },
    },
  },
];

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
async function sqlOne(q: any) {
  try {
    const r = await db.execute(q) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return rows[0] ?? null;
  } catch { return null; }
}

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS office_themes (
      id         SERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      name       TEXT NOT NULL DEFAULT 'الثيم المخصص',
      tokens     JSONB NOT NULL,
      is_active  BOOLEAN DEFAULT true,
      scope      TEXT DEFAULT 'both',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
}

/* ═══════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════ */

/* GET /theme-builder/tokens — current user's active theme */
router.get("/theme-builder/tokens", async (req, res) => {
  try {
    await ensureTable();
    const { userId } = getAuth(req as any);
    const uid = userId ?? "default";
    const row = await sqlOne(sql`
      SELECT tokens FROM office_themes
      WHERE user_id = ${uid} AND is_active = true
      ORDER BY updated_at DESC LIMIT 1
    `);
    res.json({ tokens: row?.tokens ?? DEFAULT_TOKENS });
  } catch { res.json({ tokens: DEFAULT_TOKENS }); }
});

/* GET /theme-builder/public-tokens — public (no auth) for landing page */
router.get("/theme-builder/public-tokens", async (_req, res) => {
  try {
    await ensureTable();
    const row = await sqlOne(sql`
      SELECT tokens FROM office_themes
      WHERE is_active = true
      ORDER BY updated_at DESC LIMIT 1
    `);
    const tokens = row?.tokens ?? DEFAULT_TOKENS;
    const scope = (tokens as any).scope ?? "both";
    if (scope === "platform") {
      return res.json({ tokens: DEFAULT_TOKENS });
    }
    res.json({ tokens });
  } catch { res.json({ tokens: DEFAULT_TOKENS }); }
});

/* POST /theme-builder/save */
router.post("/theme-builder/save", requireAuth, async (req, res) => {
  try {
    await ensureTable();
    const { userId } = getAuth(req as any);
    const { tokens, name } = req.body;
    if (!tokens) return res.status(400).json({ error: "tokens مطلوب" });

    const existing = await sqlOne(sql`
      SELECT id FROM office_themes WHERE user_id = ${userId!} AND is_active = true LIMIT 1
    `);
    if (existing) {
      await db.execute(sql`
        UPDATE office_themes
        SET tokens     = ${JSON.stringify(tokens)}::jsonb,
            name       = ${name ?? "الثيم المخصص"},
            scope      = ${(tokens as any).scope ?? "both"},
            updated_at = NOW()
        WHERE user_id = ${userId!} AND is_active = true
      `);
    } else {
      await db.execute(sql`
        INSERT INTO office_themes (user_id, name, tokens, scope, is_active, updated_at)
        VALUES (${userId!}, ${name ?? "الثيم المخصص"}, ${JSON.stringify(tokens)}::jsonb,
                ${(tokens as any).scope ?? "both"}, true, NOW())
      `);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /theme-builder/reset — restore to defaults */
router.delete("/theme-builder/reset", requireAuth, async (req, res) => {
  try {
    await ensureTable();
    const { userId } = getAuth(req as any);
    await db.execute(sql`DELETE FROM office_themes WHERE user_id = ${userId!}`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /theme-builder/presets */
router.get("/theme-builder/presets", (_req, res) => res.json(PRESETS));

export default router;
