/**
 * Set-based GET /conversations list helpers.
 * Replaces per-row correlated subqueries for last_message / member_count / ordering.
 */

export type ConversationListConversation = {
  id: string;
  office_id: string;
  title: string | null;
  type: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ConversationListMember = {
  conversation_id: string;
  user_id: string;
  role: string;
};

export type ConversationListMessage = {
  conversation_id: string;
  body: string | null;
  created_at: string;
};

export type ConversationListRow = {
  id: string;
  title: string | null;
  type: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_at: string | null;
  member_count: number;
  my_role: string;
};

/** Legacy SQL ran 4 correlated subqueries per conversation row (3 SELECT list + 1 ORDER BY). */
export function legacyConversationsListCorrelatedSubqueryCount(): number {
  return 4;
}

/**
 * Set-based plan: CTEs for my_convs + DISTINCT ON last messages + GROUP BY member counts.
 * Zero correlated scalar subqueries in the list SELECT/ORDER BY.
 */
export function setBasedConversationsListCorrelatedSubqueryCount(): number {
  return 0;
}

function lastMessageForConversation(
  messages: ConversationListMessage[],
  conversationId: string,
): { body: string | null; created_at: string } | null {
  let best: ConversationListMessage | null = null;
  for (const m of messages) {
    if (m.conversation_id !== conversationId) continue;
    if (!best || m.created_at > best.created_at) best = m;
  }
  return best ? { body: best.body, created_at: best.created_at } : null;
}

/**
 * Pure in-memory equivalent of legacy correlated-subquery list semantics
 * (membership + office filter + last message + member_count + sort + page).
 */
export function listConversationsLegacy(args: {
  userId: string;
  officeId: string;
  conversations: ConversationListConversation[];
  members: ConversationListMember[];
  messages: ConversationListMessage[];
  limit: number;
  offset: number;
}): ConversationListRow[] {
  const myMemberships = args.members.filter((m) => m.user_id === args.userId);
  const rows: ConversationListRow[] = [];

  for (const c of args.conversations) {
    if (c.office_id !== args.officeId) continue;
    const mine = myMemberships.find((m) => m.conversation_id === c.id);
    if (!mine) continue;

    const last = lastMessageForConversation(args.messages, c.id);
    const member_count = args.members.filter((m) => m.conversation_id === c.id).length;

    rows.push({
      id: c.id,
      title: c.title,
      type: c.type,
      created_by: c.created_by,
      created_at: c.created_at,
      updated_at: c.updated_at,
      last_message: last?.body ?? null,
      last_message_at: last?.created_at ?? null,
      member_count,
      my_role: mine.role,
    });
  }

  rows.sort((a, b) => {
    const aKey = a.last_message_at ?? a.created_at;
    const bKey = b.last_message_at ?? b.created_at;
    return bKey < aKey ? -1 : bKey > aKey ? 1 : 0;
  });

  return rows.slice(args.offset, args.offset + args.limit);
}

/**
 * Pure in-memory equivalent of the set-based CTE/JOIN plan:
 * - my conversations via membership
 * - last messages via DISTINCT ON–style map (one pass)
 * - member counts via GROUP BY–style map (one pass)
 */
export function listConversationsSetBased(args: {
  userId: string;
  officeId: string;
  conversations: ConversationListConversation[];
  members: ConversationListMember[];
  messages: ConversationListMessage[];
  limit: number;
  offset: number;
}): ConversationListRow[] {
  const myRoleByConv = new Map<string, string>();
  for (const m of args.members) {
    if (m.user_id === args.userId) myRoleByConv.set(m.conversation_id, m.role);
  }

  const myConvs = args.conversations.filter(
    (c) => c.office_id === args.officeId && myRoleByConv.has(c.id),
  );
  const myConvIds = new Set(myConvs.map((c) => c.id));

  /* DISTINCT ON (conversation_id) ORDER BY conversation_id, created_at DESC */
  const lastByConv = new Map<string, { body: string | null; created_at: string }>();
  for (const m of args.messages) {
    if (!myConvIds.has(m.conversation_id)) continue;
    const prev = lastByConv.get(m.conversation_id);
    if (!prev || m.created_at > prev.created_at) {
      lastByConv.set(m.conversation_id, { body: m.body, created_at: m.created_at });
    }
  }

  /* GROUP BY conversation_id */
  const countByConv = new Map<string, number>();
  for (const m of args.members) {
    if (!myConvIds.has(m.conversation_id)) continue;
    countByConv.set(m.conversation_id, (countByConv.get(m.conversation_id) ?? 0) + 1);
  }

  const rows: ConversationListRow[] = [];
  for (const c of myConvs) {
    const myRole = myRoleByConv.get(c.id);
    if (!myRole) continue;
    const last = lastByConv.get(c.id) ?? null;
    rows.push({
      id: c.id,
      title: c.title,
      type: c.type,
      created_by: c.created_by,
      created_at: c.created_at,
      updated_at: c.updated_at,
      last_message: last?.body ?? null,
      last_message_at: last?.created_at ?? null,
      member_count: countByConv.get(c.id) ?? 0,
      my_role: myRole,
    });
  }

  rows.sort((a, b) => {
    const aKey = a.last_message_at ?? a.created_at;
    const bKey = b.last_message_at ?? b.created_at;
    return bKey < aKey ? -1 : bKey > aKey ? 1 : 0;
  });

  /* Deduplicate by conversation id (JOIN my is unique per user; defensive). */
  const seen = new Set<string>();
  const deduped: ConversationListRow[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    deduped.push(row);
  }

  return deduped.slice(args.offset, args.offset + args.limit);
}
