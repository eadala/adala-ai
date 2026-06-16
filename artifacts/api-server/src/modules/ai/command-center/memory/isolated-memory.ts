import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

interface MemoryEntry {
  role: "user" | "assistant";
  content: string;
  agent: string;
  ts: number;
}

const inMemoryStore = new Map<string, MemoryEntry[]>();
const MAX_IN_MEMORY = 20;

function memKey(officeId: string, sessionId: string): string {
  return `${officeId}::${sessionId}`;
}

export class IsolatedMemory {
  static add(officeId: string, sessionId: string, entry: MemoryEntry): void {
    const key = memKey(officeId, sessionId);
    const arr = inMemoryStore.get(key) ?? [];
    arr.push(entry);
    if (arr.length > MAX_IN_MEMORY) arr.splice(0, arr.length - MAX_IN_MEMORY);
    inMemoryStore.set(key, arr);
  }

  static get(officeId: string, sessionId: string): MemoryEntry[] {
    return inMemoryStore.get(memKey(officeId, sessionId)) ?? [];
  }

  static clear(officeId: string, sessionId: string): void {
    inMemoryStore.delete(memKey(officeId, sessionId));
  }

  static clearOffice(officeId: string): void {
    for (const key of inMemoryStore.keys()) {
      if (key.startsWith(`${officeId}::`)) inMemoryStore.delete(key);
    }
  }

  static async persistSession(
    officeId: string, userId: string, agentType: string,
    sessionId: string, messages: MemoryEntry[]
  ): Promise<void> {
    if (!messages.length) return;
    const title = messages.find(m => m.role === "user")?.content?.slice(0, 60) ?? "محادثة";
    await db.execute(sql`
      INSERT INTO ai_command_sessions (id, office_id, user_id, agent_type, messages, title, updated_at)
      VALUES (${sessionId}, ${officeId}, ${userId}, ${agentType},
        ${JSON.stringify(messages)}::jsonb, ${title}, NOW())
      ON CONFLICT (id) DO UPDATE
        SET messages = EXCLUDED.messages, updated_at = NOW()
    `);
  }

  static async loadSession(officeId: string, sessionId: string): Promise<MemoryEntry[]> {
    try {
      const r = await db.execute(sql`
        SELECT messages FROM ai_command_sessions
        WHERE id = ${sessionId} AND office_id = ${officeId}
        LIMIT 1
      `) as any;
      const arr = Array.isArray(r) ? r : (r?.rows ?? []);
      if (!arr.length) return [];
      const msgs: MemoryEntry[] = arr[0].messages ?? [];
      const key = memKey(officeId, sessionId);
      inMemoryStore.set(key, msgs.slice(-MAX_IN_MEMORY));
      return msgs;
    } catch { return []; }
  }
}
