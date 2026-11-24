/** Storage provider identifiers — extend for GCS/S3 later. */
export type StorageProviderId = "cloudflare_r2" | "aws_s3" | "gcs" | "local";

export type SignedUrlMethod = "GET" | "PUT" | "DELETE" | "HEAD";

export interface PutObjectOptions {
  contentType: string;
  metadata?: Record<string, string>;
}

export interface SignedUrlOptions {
  method: SignedUrlMethod;
  ttlSec: number;
  contentType?: string;
}

export interface StoredObjectInfo {
  key: string;
  size: number;
  contentType: string;
  updatedAt: string;
  etag?: string;
}

export interface StorageHealthResult {
  ok: boolean;
  provider: StorageProviderId;
  bucket?: string;
  detail?: string;
}

export interface IStorageProvider {
  readonly id: StorageProviderId;
  readonly bucketName: string;

  putObject(key: string, data: Buffer, opts: PutObjectOptions): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  getObjectStream(key: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string; size?: number }>;
  deleteObject(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  listObjects(prefix: string): Promise<StoredObjectInfo[]>;
  getSignedUrl(key: string, opts: SignedUrlOptions): Promise<string>;
  getObjectMetadata(key: string): Promise<{ contentType?: string; size?: number; metadata?: Record<string, string> }>;
  setObjectMetadata(key: string, metadata: Record<string, string>): Promise<void>;
  healthCheck(): Promise<StorageHealthResult>;
}
