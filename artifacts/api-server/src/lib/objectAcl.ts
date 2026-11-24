import { ACL_META_KEY } from "../core/storage/config";
import { getStorageProvider } from "../core/storage/storageFactory";
import type { StorageObjectHandle } from "../core/storage/storageObject";

export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }
  return granted === ObjectPermission.WRITE;
}

abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  public abstract hasMember(userId: string): Promise<boolean>;
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

export async function setObjectAclPolicy(
  objectFile: StorageObjectHandle,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const provider = getStorageProvider();
  const exists = await provider.exists(objectFile.key);
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.key}`);
  }

  await provider.setObjectMetadata(objectFile.key, {
    [ACL_META_KEY]: JSON.stringify(aclPolicy),
  });
}

export async function getObjectAclPolicy(
  objectFile: StorageObjectHandle,
): Promise<ObjectAclPolicy | null> {
  const provider = getStorageProvider();
  const meta = await provider.getObjectMetadata(objectFile.key);
  const aclPolicy = meta.metadata?.[ACL_META_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy) as ObjectAclPolicy;
}

export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: StorageObjectHandle;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }

  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (aclPolicy.owner === userId) {
    return true;
  }

  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (
      (await accessGroup.hasMember(userId)) &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) {
      return true;
    }
  }

  return false;
}
