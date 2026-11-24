/**
 * Set-based folder ACL filtering for GET /storage/folders.
 * Mirrors getFolderAccess(..., "read") without per-folder DB round-trips.
 */

export type FolderListUser = {
  userId: string;
  officeId: string;
  isSA: boolean;
  isAdmin: boolean;
};

export type FolderListRow = {
  id: string;
  parent_id: string | null;
  name: string;
  visibility: string | null;
  created_by: string | null;
  created_at: unknown;
  file_count: number;
  office_id?: string;
};

export type FolderPermissionRow = {
  folder_id: string;
  user_id: string;
  can_read: boolean;
  can_write?: boolean;
};

export type FolderListItem = FolderListRow & {
  isOwner: boolean;
  canManage: boolean;
};

/**
 * Legacy GET /storage/folders query count:
 * 1 folder list + 1 SELECT per folder inside getFolderAccess
 * + 1 extra SELECT per custom folder for folder_permissions.
 */
export function legacyFolderListQueryCount(
  folderCount: number,
  customFolderCount: number,
): number {
  return 1 + folderCount + customFolderCount;
}

/**
 * Set-based plan is O(1) DB round-trips (independent of folder count):
 * 1) SELECT folders for office_id
 * 2) SELECT this user's folder_permissions joined to office folders
 *    (skipped for SA — they see every office folder)
 */
export function setBasedFolderListQueryCount(isSA = false): number {
  return isSA ? 1 : 2;
}

/** Pure: same rules as getFolderAccess(folderId, u, "read"). */
export function canReadFolder(
  folder: Pick<FolderListRow, "visibility" | "created_by">,
  user: Pick<FolderListUser, "userId" | "isSA" | "isAdmin">,
  customCanRead: boolean | undefined,
): boolean {
  if (user.isSA) return true;

  const isOwner = folder.created_by === user.userId;
  const isAdmin = user.isAdmin;

  switch (folder.visibility as string) {
    case "owner_only":
      return isOwner || isAdmin;
    case "admins_only":
      return isAdmin;
    case "custom": {
      if (isOwner || isAdmin) return true;
      return !!customCanRead;
    }
    default: // 'everyone' (and any unknown / null treated like legacy default)
      return true;
  }
}

export function indexCustomReadByFolderId(
  permissions: FolderPermissionRow[],
  userId: string,
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const p of permissions) {
    if (p.user_id !== userId) continue;
    // UNIQUE(folder_id, user_id) — keep first if duplicates appear in fixtures
    if (!map.has(p.folder_id)) {
      map.set(p.folder_id, !!p.can_read);
    }
  }
  return map;
}

/**
 * Filter office folders to those the user can read, preserving input order
 * (caller should already ORDER BY name ASC). Dedupes by folder id.
 */
export function filterVisibleFolders(
  folders: FolderListRow[],
  user: FolderListUser,
  permissions: FolderPermissionRow[],
): FolderListItem[] {
  const officeFolders = folders.filter((f) =>
    f.office_id == null ? true : f.office_id === user.officeId,
  );

  const customRead = user.isSA
    ? new Map<string, boolean>()
    : indexCustomReadByFolderId(permissions, user.userId);

  const seen = new Set<string>();
  const visible: FolderListItem[] = [];

  for (const f of officeFolders) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);

    if (!canReadFolder(f, user, customRead.get(f.id))) continue;

    visible.push({
      ...f,
      isOwner: f.created_by === user.userId,
      canManage: f.created_by === user.userId || user.isAdmin,
    });
  }

  return visible;
}

/** In-memory simulation used by runtime tests (parity + fixed query count). */
export function listVisibleFoldersInMemory(input: {
  user: FolderListUser;
  folders: FolderListRow[];
  permissions: FolderPermissionRow[];
}): {
  response: FolderListItem[];
  setBasedQueries: number;
  legacyQueries: number;
} {
  const tenantFolders = input.folders.filter((f) => f.office_id === input.user.officeId);
  const customCount = tenantFolders.filter((f) => f.visibility === "custom").length;

  return {
    response: filterVisibleFolders(input.folders, input.user, input.permissions),
    setBasedQueries: setBasedFolderListQueryCount(input.user.isSA),
    legacyQueries: legacyFolderListQueryCount(tenantFolders.length, customCount),
  };
}
