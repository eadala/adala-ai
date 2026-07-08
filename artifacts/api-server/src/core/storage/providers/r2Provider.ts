import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import type {
  IStorageProvider,
  StoredObjectInfo,
  StorageHealthResult,
} from "../types";

function requireR2Env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} غير مُعيَّن — مطلوب لـ Cloudflare R2`);
  return v;
}

export function createR2Provider(): IStorageProvider {
  const bucketName = requireR2Env("R2_BUCKET_NAME");
  const endpoint = requireR2Env("R2_ENDPOINT");
  const accessKeyId = requireR2Env("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireR2Env("R2_SECRET_ACCESS_KEY");

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const provider: IStorageProvider = {
    id: "cloudflare_r2",
    bucketName,

    async putObject(key, data, opts) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: data,
          ContentType: opts.contentType,
          Metadata: opts.metadata,
        })
      );
    },

    async getObject(key) {
      const resp = await client.send(
        new GetObjectCommand({ Bucket: bucketName, Key: key })
      );
      if (!resp.Body) throw new Error(`Object empty: ${key}`);
      const chunks: Buffer[] = [];
      for await (const chunk of resp.Body as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    },

    async getObjectStream(key) {
      const resp = await client.send(
        new GetObjectCommand({ Bucket: bucketName, Key: key })
      );
      if (!resp.Body) throw new Error(`Object empty: ${key}`);
      return {
        stream: resp.Body as NodeJS.ReadableStream,
        contentType: resp.ContentType ?? "application/octet-stream",
        size: resp.ContentLength,
      };
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
    },

    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
        return true;
      } catch {
        return false;
      }
    },

    async listObjects(prefix) {
      const out: StoredObjectInfo[] = [];
      let token: string | undefined;
      do {
        const resp = await client.send(
          new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            ContinuationToken: token,
          })
        );
        for (const obj of resp.Contents ?? []) {
          if (!obj.Key) continue;
          out.push({
            key: obj.Key,
            size: obj.Size ?? 0,
            contentType: "application/octet-stream",
            updatedAt: obj.LastModified?.toISOString() ?? "",
            etag: obj.ETag,
          });
        }
        token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
      } while (token);
      return out;
    },

    async getSignedUrl(key, opts) {
      const command =
        opts.method === "PUT"
          ? new PutObjectCommand({
              Bucket: bucketName,
              Key: key,
              ContentType: opts.contentType ?? "application/octet-stream",
            })
          : opts.method === "GET"
            ? new GetObjectCommand({ Bucket: bucketName, Key: key })
            : opts.method === "HEAD"
              ? new HeadObjectCommand({ Bucket: bucketName, Key: key })
              : new DeleteObjectCommand({ Bucket: bucketName, Key: key });

      return getSignedUrl(client, command, { expiresIn: opts.ttlSec });
    },

    async getObjectMetadata(key) {
      const resp = await client.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: key })
      );
      return {
        contentType: resp.ContentType,
        size: resp.ContentLength,
        metadata: resp.Metadata,
      };
    },

    async setObjectMetadata(key, metadata) {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: key })
      );
      await client.send(
        new CopyObjectCommand({
          Bucket: bucketName,
          Key: key,
          CopySource: `${bucketName}/${encodeURIComponent(key).replace(/%2F/g, "/")}`,
          Metadata: { ...(head.Metadata ?? {}), ...metadata },
          MetadataDirective: "REPLACE",
          ContentType: head.ContentType,
        })
      );
    },

    async healthCheck(): Promise<StorageHealthResult> {
      try {
        await client.send(
          new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 })
        );
        return { ok: true, provider: "cloudflare_r2", bucket: bucketName };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, provider: "cloudflare_r2", bucket: bucketName, detail: msg };
      }
    },
  };

  return provider;
}

/** Convert a Buffer stream helper for tests */
export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
