/**
 * Set-based recipient/attachment writes for POST /internal-messages.
 * Replaces sequential per-row INSERT loops with bulk unnest inserts.
 */

export type IncomingRecipient = {
  userId?: unknown;
  userName?: unknown;
};

export type IncomingAttachment = {
  fileName?: unknown;
  fileUrl?: unknown;
  fileSize?: unknown;
};

export type MessageRecipientInsertRow = {
  message_id: string;
  user_id: string;
  user_name: string;
};

export type MessageAttachmentInsertRow = {
  message_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
};

/** Dedupe recipients by user_id (first userName wins). Skips empty/non-string ids. */
export function buildMessageRecipientRows(
  messageId: string,
  recipients: IncomingRecipient[],
): MessageRecipientInsertRow[] {
  const seen = new Set<string>();
  const rows: MessageRecipientInsertRow[] = [];

  for (const r of recipients) {
    if (typeof r.userId !== "string" || r.userId.length === 0) continue;
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    const userName =
      typeof r.userName === "string" && r.userName.length > 0 ? r.userName : r.userId;
    rows.push({
      message_id: messageId,
      user_id: r.userId,
      user_name: userName,
    });
  }

  return rows;
}

/** Dedupe attachments by (file_name, file_url); first fileSize wins. */
export function buildMessageAttachmentRows(
  messageId: string,
  attachments: IncomingAttachment[],
): MessageAttachmentInsertRow[] {
  const seen = new Set<string>();
  const rows: MessageAttachmentInsertRow[] = [];

  for (const a of attachments) {
    const fileName = typeof a.fileName === "string" ? a.fileName : "";
    const fileUrl = typeof a.fileUrl === "string" ? a.fileUrl : "";
    if (!fileName && !fileUrl) continue;
    const key = `${fileName}\0${fileUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fileSize = Number(a.fileSize ?? 0);
    rows.push({
      message_id: messageId,
      file_name: fileName,
      file_url: fileUrl,
      file_size: Number.isFinite(fileSize) ? fileSize : 0,
    });
  }

  return rows;
}

/** Legacy write phase: 1 INSERT per recipient + 1 INSERT per attachment. */
export function legacyInternalMessageWriteQueryCount(
  recipientCount: number,
  attachmentCount: number,
): number {
  return recipientCount + attachmentCount;
}

/**
 * Set-based write phase (independent of R/A counts when both non-empty):
 * 0–1 bulk recipient INSERT + 0–1 bulk attachment INSERT.
 * Empty collections skip their statement.
 */
export function setBasedInternalMessageWriteQueryCount(
  recipientCount: number,
  attachmentCount: number,
): number {
  return (recipientCount > 0 ? 1 : 0) + (attachmentCount > 0 ? 1 : 0);
}

/** Full POST /internal-messages: message INSERT + write phase. */
export function legacyInternalMessageCreateQueryCount(
  recipientCount: number,
  attachmentCount: number,
): number {
  return 1 + legacyInternalMessageWriteQueryCount(recipientCount, attachmentCount);
}

export function setBasedInternalMessageCreateQueryCount(
  recipientCount: number,
  attachmentCount: number,
): number {
  return 1 + setBasedInternalMessageWriteQueryCount(recipientCount, attachmentCount);
}

/** In-memory simulation for runtime parity / query-count tests. */
export function createInternalMessageSideEffectsInMemory(args: {
  messageId: string;
  officeId?: string | null;
  recipients: IncomingRecipient[];
  attachments: IncomingAttachment[];
}): {
  recipients: MessageRecipientInsertRow[];
  attachments: MessageAttachmentInsertRow[];
  recipientIdsForNotify: string[];
  setBasedQueries: number;
  legacyQueries: number;
  /** Child rows are always scoped to messageId only (no office column on child tables). */
  messageScope: string;
  officeId: string | null;
} {
  const recipients = buildMessageRecipientRows(args.messageId, args.recipients);
  const attachments = buildMessageAttachmentRows(args.messageId, args.attachments);

  return {
    recipients,
    attachments,
    recipientIdsForNotify: recipients.map((r) => r.user_id),
    setBasedQueries: setBasedInternalMessageCreateQueryCount(
      recipients.length,
      attachments.length,
    ),
    /* Legacy counted raw array lengths (including dups) before insert loops */
    legacyQueries: legacyInternalMessageCreateQueryCount(
      args.recipients.length,
      args.attachments.length,
    ),
    messageScope: args.messageId,
    officeId: args.officeId ?? null,
  };
}
