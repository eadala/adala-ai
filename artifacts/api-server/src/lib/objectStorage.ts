import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";
import {
  getStorageProvider,
  getObjectStorageBucket,
  getPublicObjectKeyPrefixes,
  getPrivateObjectKeyPrefix,
  buildPrivateUploadKey,
  entityIdToObjectKey,
  isObjectStorageConfigured,
} from "../core/storage";
import { createStorageObjectHandle, type StorageObjectHandle } from "../core/storage/storageObject";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/** @deprecated Use getStorageProvider() — kept for gradual migration of direct imports. */
export function getObjectStorageBucketName(): string {
  return getObjectStorageBucket();
}

export class ObjectStorageService {
  private provider() {
    return getStorageProvider();
  }

  getPublicObjectSearchPaths(): Array<string> {
    const prefixes = getPublicObjectKeyPrefixes();
    if (prefixes.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Set comma-separated key prefixes " +
          "(e.g. /{bucket}/public) or configure STORAGE_PRIVATE_PREFIX."
      );
    }
    return prefixes.map((p) => `/${getObjectStorageBucket()}/${p}`);
  }

  getPrivateObjectDir(): string {
    const prefix = getPrivateObjectKeyPrefix();
    const bucket = getObjectStorageBucket();
    return `/${bucket}/${prefix}`;
  }

  async searchPublicObject(filePath: string): Promise<StorageObjectHandle | null> {
    const prefixes = getPublicObjectKeyPrefixes();
    for (const prefix of prefixes) {
      const key = `${prefix}/${filePath}`;
      const exists = await this.provider().exists(key);
      if (exists) {
        const meta = await this.provider().getObjectMetadata(key);
        return createStorageObjectHandle(key, getObjectStorageBucket(), {
          contentType: meta.contentType,
          size: meta.size,
        });
      }
    }
    return null;
  }

  async downloadObject(
    handle: StorageObjectHandle,
    cacheTtlSec: number = 3600
  ): Promise<Response> {
    const { stream, contentType, size } = await this.provider().getObjectStream(handle.key);
    const aclPolicy = await getObjectAclPolicy(handle);
    const isPublic = aclPolicy?.visibility === "public";

    const webStream = Readable.toWeb(stream as Readable) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": contentType || handle.contentType || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (size ?? handle.size) {
      headers["Content-Length"] = String(size ?? handle.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    if (!isObjectStorageConfigured()) {
      throw new Error("Object storage غير مُهيَّأ — عيّن متغيرات R2");
    }

    const objectId = randomUUID();
    const key = buildPrivateUploadKey(objectId);

    return this.provider().getSignedUrl(key, {
      method: "PUT",
      ttlSec: 900,
      contentType: "application/octet-stream",
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageObjectHandle> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    const key = entityIdToObjectKey(entityId);
    const exists = await this.provider().exists(key);
    if (!exists) {
      throw new ObjectNotFoundError();
    }

    const meta = await this.provider().getObjectMetadata(key);
    return createStorageObjectHandle(key, getObjectStorageBucket(), {
      contentType: meta.contentType,
      size: meta.size,
    });
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    if (!rawPath.startsWith("http")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const bucket = getObjectStorageBucket();

    // Legacy GCS URLs
    if (url.hostname.includes("storage.googleapis.com")) {
      let objectEntityDir = this.getPrivateObjectDir();
      if (!objectEntityDir.endsWith("/")) objectEntityDir = `${objectEntityDir}/`;
      const rawObjectPath = url.pathname;
      if (!rawObjectPath.startsWith(objectEntityDir)) {
        return rawObjectPath;
      }
      const entityId = rawObjectPath.slice(objectEntityDir.length);
      return `/objects/${entityId}`;
    }

    // R2 / S3 presigned URLs — extract object key from pathname
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith(`/${bucket}/`)) {
      pathname = pathname.slice(bucket.length + 2);
    } else if (pathname.startsWith("/")) {
      pathname = pathname.slice(1);
    }

    const prefix = getPrivateObjectKeyPrefix();
    const entityId =
      prefix && pathname.startsWith(`${prefix}/`)
        ? pathname.slice(prefix.length + 1)
        : pathname;

    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StorageObjectHandle;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

/** Legacy path parser — /{bucket}/{key...} */
export function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return { bucketName, objectName };
}
