/**
 * Runtime tests for set-based GET /storage/folders ACL (Stage 10.6.1).
 * Run: pnpm --filter @workspace/api-server run test:storage-folders-acl
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canReadFolder,
  filterVisibleFolders,
  legacyFolderListQueryCount,
  listVisibleFoldersInMemory,
  setBasedFolderListQueryCount,
  type FolderListRow,
  type FolderListUser,
  type FolderPermissionRow,
} from "../lib/storageFolderListAccess";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const officeA = "office-a";
const officeB = "office-b";
const userLawyer = "user-lawyer";
const userAdmin = "user-admin";
const userOther = "user-other";

const folders: FolderListRow[] = [
  {
    id: "f-everyone",
    parent_id: null,
    name: "عام",
    visibility: "everyone",
    created_by: userAdmin,
    created_at: "2026-01-01",
    file_count: 2,
    office_id: officeA,
  },
  {
    id: "f-owner",
    parent_id: null,
    name: "خاص",
    visibility: "owner_only",
    created_by: userLawyer,
    created_at: "2026-01-02",
    file_count: 0,
    office_id: officeA,
  },
  {
    id: "f-admins",
    parent_id: null,
    name: "إدارة",
    visibility: "admins_only",
    created_by: userAdmin,
    created_at: "2026-01-03",
    file_count: 1,
    office_id: officeA,
  },
  {
    id: "f-custom-granted",
    parent_id: null,
    name: "مخصص-مسموح",
    visibility: "custom",
    created_by: userAdmin,
    created_at: "2026-01-04",
    file_count: 3,
    office_id: officeA,
  },
  {
    id: "f-custom-denied",
    parent_id: null,
    name: "مخصص-مرفوض",
    visibility: "custom",
    created_by: userAdmin,
    created_at: "2026-01-05",
    file_count: 0,
    office_id: officeA,
  },
  {
    id: "f-custom-false",
    parent_id: null,
    name: "مخصص-قراءة-false",
    visibility: "custom",
    created_by: userAdmin,
    created_at: "2026-01-06",
    file_count: 0,
    office_id: officeA,
  },
  {
    id: "f-tenant-b",
    parent_id: null,
    name: "مكتب-ب",
    visibility: "everyone",
    created_by: userOther,
    created_at: "2026-01-07",
    file_count: 9,
    office_id: officeB,
  },
];

const permissions: FolderPermissionRow[] = [
  { folder_id: "f-custom-granted", user_id: userLawyer, can_read: true },
  { folder_id: "f-custom-false", user_id: userLawyer, can_read: false },
  /* Grant for another user must not leak to lawyer */
  { folder_id: "f-custom-denied", user_id: userOther, can_read: true },
  /* Cross-tenant grant must not surface folders from office B */
  { folder_id: "f-tenant-b", user_id: userLawyer, can_read: true },
];

const lawyer: FolderListUser = {
  userId: userLawyer,
  officeId: officeA,
  isSA: false,
  isAdmin: false,
};

const admin: FolderListUser = {
  userId: userAdmin,
  officeId: officeA,
  isSA: false,
  isAdmin: true,
};

const sa: FolderListUser = {
  userId: "user-sa",
  officeId: officeA,
  isSA: true,
  isAdmin: true,
};

/** Legacy getFolderAccess(..., "read") mirrored for parity assertions. */
function legacyCanRead(
  folder: FolderListRow,
  user: FolderListUser,
  perms: FolderPermissionRow[],
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
      const p = perms.find(
        (row) => row.folder_id === folder.id && row.user_id === user.userId,
      );
      if (!p) return false;
      return !!p.can_read;
    }
    default:
      return true;
  }
}

console.log("\n═══ source: set-based GET /storage/folders ═══");
{
  const src = read("modules/operations/storage.ts");
  const start = src.indexOf('router.get("/storage/folders"');
  const end = src.indexOf('router.post("/storage/folders"');
  assert.ok(start >= 0 && end > start, "GET /storage/folders route present");
  const block = src.slice(start, end);

  assert.match(block, /filterVisibleFolders/);
  assert.match(block, /FROM folder_permissions fp/);
  assert.match(block, /f\.office_id=\$\{u\.officeId\}/);
  assert.match(block, /fp\.user_id = \$\{u\.userId\}/);
  assert.doesNotMatch(block, /await getFolderAccess\(/);
  assert.doesNotMatch(block, /for\s*\(\s*const\s+f\s+of\s+all\s*\)/);
  console.log("  ✅ route uses set-based ACL; no per-folder getFolderAccess loop");
}

console.log("\n═══ runtime: visibility parity with legacy logic ═══");
{
  const tenantFolders = folders.filter((f) => f.office_id === officeA);
  for (const user of [lawyer, admin, sa]) {
    for (const f of tenantFolders) {
      const setBased = canReadFolder(
        f,
        user,
        permissions.find((p) => p.folder_id === f.id && p.user_id === user.userId)
          ?.can_read,
      );
      const legacy = legacyCanRead(f, user, permissions);
      assert.equal(
        setBased,
        legacy,
        `parity fail user=${user.userId} folder=${f.id} visibility=${f.visibility}`,
      );
    }
  }
  console.log("  ✅ canReadFolder ≡ legacy getFolderAccess(read) for all visibilities");
}

console.log("\n═══ runtime: custom access ═══");
{
  const out = filterVisibleFolders(folders, lawyer, permissions);
  const ids = out.map((f) => f.id);
  assert.ok(ids.includes("f-everyone"));
  assert.ok(ids.includes("f-owner")); // lawyer is owner
  assert.equal(ids.includes("f-admins"), false);
  assert.ok(ids.includes("f-custom-granted"));
  assert.equal(ids.includes("f-custom-denied"), false);
  assert.equal(ids.includes("f-custom-false"), false);

  const adminOut = filterVisibleFolders(folders, admin, permissions);
  const adminIds = adminOut.map((f) => f.id);
  assert.ok(adminIds.includes("f-admins"));
  assert.ok(adminIds.includes("f-custom-denied")); // admin bypasses custom
  assert.ok(adminIds.includes("f-custom-false"));
  console.log("  ✅ custom grants / denials / admin bypass behave correctly");
}

console.log("\n═══ runtime: tenant isolation ═══");
{
  const out = listVisibleFoldersInMemory({
    user: lawyer,
    folders,
    permissions,
  });
  assert.equal(out.response.some((f) => f.id === "f-tenant-b"), false);
  assert.equal(out.response.every((f) => f.office_id === officeA || f.office_id == null), true);

  const forB = listVisibleFoldersInMemory({
    user: { ...lawyer, officeId: officeB },
    folders,
    permissions,
  });
  assert.deepEqual(
    forB.response.map((f) => f.id),
    ["f-tenant-b"],
  );
  console.log("  ✅ office A caller never sees office B folders");
}

console.log("\n═══ runtime: no duplicate folders ═══");
{
  const everyone = folders.find((f) => f.id === "f-everyone");
  assert.ok(everyone);
  const duped: FolderListRow[] = [
    ...folders.filter((f) => f.office_id === officeA),
    everyone,
  ];
  const out = filterVisibleFolders(duped, lawyer, permissions);
  const ids = out.map((f) => f.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(ids.filter((id) => id === "f-everyone").length, 1);

  const ordered = folders
    .filter((f) => f.office_id === officeA)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const preserved = filterVisibleFolders(ordered, lawyer, permissions);
  const expectedOrder = ordered
    .filter((f) => legacyCanRead(f, lawyer, permissions))
    .map((f) => f.id);
  assert.deepEqual(
    preserved.map((f) => f.id),
    expectedOrder,
  );
  console.log("  ✅ duplicates collapsed; input order preserved");
}

console.log("\n═══ runtime: response shape (isOwner / canManage) ═══");
{
  const out = filterVisibleFolders(folders, lawyer, permissions);
  const owned = out.find((f) => f.id === "f-owner");
  const shared = out.find((f) => f.id === "f-everyone");
  assert.ok(owned && shared);
  assert.equal(owned.isOwner, true);
  assert.equal(owned.canManage, true);
  assert.equal(shared.isOwner, false);
  assert.equal(shared.canManage, false);

  const adminOut = filterVisibleFolders(folders, admin, permissions);
  const sharedAdmin = adminOut.find((f) => f.id === "f-everyone");
  assert.equal(sharedAdmin?.canManage, true);
  console.log("  ✅ isOwner / canManage match legacy response fields");
}

console.log("\n═══ runtime: fixed query count as folder count grows ═══");
{
  const n = 50;
  const custom = 20;
  const legacy = legacyFolderListQueryCount(n, custom);
  const setBased = setBasedFolderListQueryCount(false);
  assert.equal(legacy, 1 + n + custom);
  assert.equal(setBased, 2);
  assert.ok(setBased < legacy);
  assert.ok(legacy / setBased > 30);

  const sim = listVisibleFoldersInMemory({
    user: lawyer,
    folders,
    permissions,
  });
  assert.equal(sim.setBasedQueries, 2);
  assert.equal(sim.legacyQueries, 1 + 6 + 3); // 6 office-A folders, 3 custom

  const saSim = listVisibleFoldersInMemory({
    user: sa,
    folders,
    permissions,
  });
  assert.equal(saSim.setBasedQueries, 1);
  assert.equal(saSim.response.length, 6);
  console.log(`  ✅ N=50: legacy ${legacy} → set-based ${setBased}`);
}

console.log("\n✅ storageFoldersAcl runtime tests passed\n");
