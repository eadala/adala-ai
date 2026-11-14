/**
 * Local filesystem storage emulator for isolated backup/restore tests.
 * Never contacts live object storage. Root: LOCAL_STORAGE_ROOT (required).
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  existsSync,
  readdirSync,
  statSync,
  createReadStream,
  renameSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type {
  IStorageProvider,
  StoredObjectInfo,
  StorageHealthResult,
} from "../types";

function safeJoin(root: string, key: string): string {
  if (!key || key.includes("\0") || key.startsWith("/") || key.includes("..")) {
    throw new Error(`unsafe_object_key:${key}`);
  }
  const full = join(root, key);
  const rel = relative(root, full);
  if (rel.startsWith("..") || rel === "") {
    throw new Error(`path_escape:${key}`);
  }
  return full;
}

export function createLocalFsProvider(): IStorageProvider {
  const root = process.env.LOCAL_STORAGE_ROOT;
  if (!root) {
    throw new Error("LOCAL_STORAGE_ROOT required for STORAGE_PROVIDER=local");
  }
  mkdirSync(root, { recursive: true });
  const bucketName = process.env.LOCAL_STORAGE_BUCKET || "adala-local-backups";

  const metaPath = (key: string) => `${safeJoin(root, key)}.meta.json`;

  const provider: IStorageProvider = {
    id: "local",
    bucketName,

    async putObject(key, data, opts) {
      const path = safeJoin(root, key);
      mkdirSync(dirname(path), { recursive: true });
      const tmp = `${path}.${randomBytes(4).toString("hex")}.partial`;
      writeFileSync(tmp, data);
      renameSync(tmp, path);
      writeFileSync(
        metaPath(key),
        JSON.stringify({
          contentType: opts.contentType,
          size: data.length,
          sha256: createHash("sha256").update(data).digest("hex"),
          updatedAt: new Date().toISOString(),
          metadata: opts.metadata ?? {},
          encryption: process.env.LOCAL_STORAGE_SSE || "local-at-rest-filesystem",
        }),
      );
    },

    async getObject(key) {
      const path = safeJoin(root, key);
      if (!existsSync(path)) throw new Error(`Object missing: ${key}`);
      return readFileSync(path);
    },

    async getObjectStream(key) {
      const path = safeJoin(root, key);
      if (!existsSync(path)) throw new Error(`Object missing: ${key}`);
      let contentType = "application/octet-stream";
      try {
        contentType = JSON.parse(readFileSync(metaPath(key), "utf8")).contentType;
      } catch {
        /* default */
      }
      const st = statSync(path);
      return { stream: createReadStream(path), contentType, size: st.size };
    },

    async deleteObject(key) {
      const path = safeJoin(root, key);
      if (existsSync(path)) unlinkSync(path);
      const mp = metaPath(key);
      if (existsSync(mp)) unlinkSync(mp);
    },

    async exists(key) {
      return existsSync(safeJoin(root, key));
    },

    async listObjects(prefix) {
      const out: StoredObjectInfo[] = [];
      const walk = (dir: string) => {
        if (!existsSync(dir)) return;
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          const st = statSync(full);
          if (st.isDirectory()) walk(full);
          else if (!name.endsWith(".meta.json") && !name.endsWith(".partial")) {
            const key = relative(root, full).replace(/\\/g, "/");
            if (key.startsWith(prefix)) {
              out.push({
                key,
                size: st.size,
                contentType: "application/octet-stream",
                updatedAt: st.mtime.toISOString(),
              });
            }
          }
        }
      };
      walk(root);
      return out;
    },

    async getSignedUrl(key, opts) {
      /* Local emulator — opaque URL, not network-reachable */
      return `local://${bucketName}/${key}?method=${opts.method}&ttl=${opts.ttlSec}`;
    },

    async getObjectMetadata(key) {
      const mp = metaPath(key);
      if (!existsSync(mp)) return {};
      const m = JSON.parse(readFileSync(mp, "utf8"));
      return { contentType: m.contentType, size: m.size, metadata: m.metadata };
    },

    async setObjectMetadata(key, metadata) {
      const mp = metaPath(key);
      const prev = existsSync(mp) ? JSON.parse(readFileSync(mp, "utf8")) : {};
      writeFileSync(mp, JSON.stringify({ ...prev, metadata }));
    },

    async healthCheck(): Promise<StorageHealthResult> {
      try {
        mkdirSync(root, { recursive: true });
        return { ok: true, provider: "local", bucket: bucketName, detail: root };
      } catch (e: unknown) {
        return {
          ok: false,
          provider: "local",
          detail: e instanceof Error ? e.message : "local_fs_error",
        };
      }
    },
  };

  return provider;
}
