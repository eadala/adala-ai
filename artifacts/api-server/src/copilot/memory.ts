import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function rememberFact(
  userId: string,
  officeId: string,
  type: string,
  key: string,
  value: string
) {
  try {
    await db.execute(sql`
      INSERT INTO copilot_memory (user_id, office_id, memory_type, key, value, updated_at)
      VALUES (${userId}, ${officeId}, ${type}, ${key}, ${value}, NOW())
      ON CONFLICT (office_id, user_id, memory_type, key)
      DO UPDATE SET value = ${value}, updated_at = NOW()
    `);
  } catch { /* non-blocking */ }
}

export async function recallMemory(
  userId: string,
  officeId: string,
  type?: string
): Promise<Record<string, string>> {
  try {
    const rows = await db.execute(sql`
      SELECT memory_type, key, value FROM copilot_memory
      WHERE user_id = ${userId} AND office_id = ${officeId}
        ${type ? sql`AND memory_type = ${type}` : sql``}
      ORDER BY updated_at DESC LIMIT 30
    `);
    const mem: Record<string, string> = {};
    for (const r of (rows.rows ?? rows) as any[]) {
      mem[`${r.memory_type}.${r.key}`] = r.value;
    }
    return mem;
  } catch {
    return {};
  }
}

export async function buildMemoryContext(userId: string, officeId: string): Promise<string> {
  const mem = await recallMemory(userId, officeId);
  if (Object.keys(mem).length === 0) return "";
  const lines = Object.entries(mem).map(([k, v]) => `• ${k}: ${v}`).join("\n");
  return `\n🧠 ذاكرة المستخدم:\n${lines}`;
}
