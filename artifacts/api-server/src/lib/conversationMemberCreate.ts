/**
 * Set-based conversation member creation for POST /conversations.
 * Replaces per-member SELECT (users) + INSERT (conversation_members) loops.
 */

export type ConversationMemberRole = "admin" | "member";

export type UserNameRow = {
  id: string;
  name: string | null;
};

export type ConversationMemberInsertRow = {
  conversation_id: string;
  office_id: string;
  user_id: string;
  user_name: string;
  role: ConversationMemberRole;
};

/** Unique member ids: creator first, then others (deduped). */
export function resolveUniqueMemberIds(
  creatorId: string,
  memberIds: string[],
): string[] {
  return [...new Set<string>([creatorId, ...memberIds.filter((id) => id !== creatorId)])];
}

export function memberRoleForUser(
  userId: string,
  creatorId: string,
): ConversationMemberRole {
  return userId === creatorId ? "admin" : "member";
}

export function resolveUserDisplayName(
  userId: string,
  nameById: Map<string, string>,
): string {
  return nameById.get(userId) ?? userId;
}

export function indexUserNames(rows: UserNameRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, row.name ?? row.id);
    }
  }
  return map;
}

/**
 * Build the exact conversation_members rows the legacy loop would insert
 * (one row per unique user_id; creator = admin).
 */
export function buildConversationMemberRows(args: {
  conversationId: string;
  officeId: string;
  creatorId: string;
  memberIds: string[];
  nameRows: UserNameRow[];
}): ConversationMemberInsertRow[] {
  const uniqueIds = resolveUniqueMemberIds(args.creatorId, args.memberIds);
  const nameById = indexUserNames(args.nameRows);

  return uniqueIds.map((userId) => ({
    conversation_id: args.conversationId,
    office_id: args.officeId,
    user_id: userId,
    user_name: resolveUserDisplayName(userId, nameById),
    role: memberRoleForUser(userId, args.creatorId),
  }));
}

/**
 * Deduplicate insert rows by (conversation_id, user_id) — mirrors
 * UNIQUE(conversation_id, user_id) / ON CONFLICT DO NOTHING.
 */
export function dedupeConversationMemberRows(
  rows: ConversationMemberInsertRow[],
): ConversationMemberInsertRow[] {
  const seen = new Set<string>();
  const out: ConversationMemberInsertRow[] = [];
  for (const row of rows) {
    const key = `${row.conversation_id}|${row.user_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Legacy member phase: SELECT name + INSERT per unique member. */
export function legacyConversationMemberQueryCount(memberCount: number): number {
  return memberCount * 2;
}

/**
 * Set-based member phase (independent of member count):
 * 1) batched users name lookup
 * 2) one bulk INSERT … SELECT FROM unnest … ON CONFLICT DO NOTHING
 */
export function setBasedConversationMemberQueryCount(): number {
  return 2;
}

/** Full POST /conversations DB round-trips after request validation. */
export function legacyConversationCreateQueryCount(
  memberCount: number,
  hasOtherMembers: boolean,
): number {
  return (hasOtherMembers ? 1 : 0) + 1 + legacyConversationMemberQueryCount(memberCount);
}

export function setBasedConversationCreateQueryCount(hasOtherMembers: boolean): number {
  return (hasOtherMembers ? 1 : 0) + 1 + setBasedConversationMemberQueryCount();
}

/** In-memory simulation for runtime parity / query-count tests. */
export function createConversationMembersInMemory(args: {
  conversationId: string;
  officeId: string;
  creatorId: string;
  memberIds: string[];
  nameRows: UserNameRow[];
  /** Existing members already in DB (for ON CONFLICT DO NOTHING simulation). */
  existingKeys?: Array<{ conversation_id: string; user_id: string }>;
}): {
  inserted: ConversationMemberInsertRow[];
  skippedDuplicates: number;
  setBasedQueries: number;
  legacyQueries: number;
} {
  const planned = buildConversationMemberRows(args);
  const deduped = dedupeConversationMemberRows(planned);
  const existing = new Set(
    (args.existingKeys ?? []).map((k) => `${k.conversation_id}|${k.user_id}`),
  );

  const inserted: ConversationMemberInsertRow[] = [];
  let skippedDuplicates = 0;
  for (const row of deduped) {
    const key = `${row.conversation_id}|${row.user_id}`;
    if (existing.has(key)) {
      skippedDuplicates += 1;
      continue;
    }
    existing.add(key);
    inserted.push(row);
  }

  const otherMembers = args.memberIds.filter((id) => id !== args.creatorId);
  const hasOthers = otherMembers.length > 0;

  return {
    inserted,
    skippedDuplicates,
    setBasedQueries: setBasedConversationCreateQueryCount(hasOthers),
    legacyQueries: legacyConversationCreateQueryCount(deduped.length, hasOthers),
  };
}
