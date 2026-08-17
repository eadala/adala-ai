/**
 * In-process Command Center memory (v2 /api/cc/*).
 *
 * Durable DB persistence via ai_command_sessions was retired: production has no
 * such relation, the live UI does not reload sessions from DB, and inventing a
 * Migration 046 schema from conflicting v1/v2 DML is out of scope.
 * Continuity within a process is keyed by officeId::sessionId only.
 */
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

  /** No-op: durable session table not owned / not present in production. */
  static async persistSession(
    _officeId: string, _userId: string, _agentType: string,
    _sessionId: string, _messages: MemoryEntry[]
  ): Promise<void> {
    return;
  }

  /** In-memory only (office-scoped key). */
  static async loadSession(officeId: string, sessionId: string): Promise<MemoryEntry[]> {
    return IsolatedMemory.get(officeId, sessionId);
  }

  /** List in-memory sessions for an office+user (no DB). */
  static listSessions(officeId: string, _userId: string): { id: string; agent_type: string | null; title: string; updated_at: string }[] {
    const prefix = `${officeId}::`;
    const out: { id: string; agent_type: string | null; title: string; updated_at: string }[] = [];
    for (const [key, msgs] of inMemoryStore.entries()) {
      if (!key.startsWith(prefix) || !msgs.length) continue;
      const sessionId = key.slice(prefix.length);
      const last = msgs[msgs.length - 1];
      const firstUser = msgs.find(m => m.role === "user");
      out.push({
        id: sessionId,
        agent_type: last?.agent ?? null,
        title: (firstUser?.content ?? "محادثة").slice(0, 60),
        updated_at: new Date(last?.ts ?? Date.now()).toISOString(),
      });
    }
    return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 30);
  }
}
