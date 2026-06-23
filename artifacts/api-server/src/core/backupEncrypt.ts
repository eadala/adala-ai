/**
 * backupEncrypt.ts — AES-256-CBC encrypt/decrypt for backup data
 * Uses Node.js built-in crypto — no external packages required.
 *
 * Format: [ IV (16 bytes) | HMAC (32 bytes) | Encrypted data ]
 * HMAC-SHA256 validates integrity before decryption (fail-safe design).
 */

import crypto from "crypto";

function getDerivedKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY ?? "adala-default-dev-key-change-in-prod";
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptBuffer(buffer: Buffer): Buffer {
  const key = getDerivedKey();
  const iv  = crypto.randomBytes(16);

  const cipher    = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

  const hmac = crypto.createHmac("sha256", key).update(Buffer.concat([iv, encrypted])).digest();

  return Buffer.concat([iv, hmac, encrypted]);
}

export function decryptBuffer(buffer: Buffer): Buffer {
  const key       = getDerivedKey();
  const iv        = buffer.subarray(0, 16);
  const storedHmac = buffer.subarray(16, 48);
  const encrypted = buffer.subarray(48);

  const expectedHmac = crypto.createHmac("sha256", key).update(Buffer.concat([iv, encrypted])).digest();
  if (!crypto.timingSafeEqual(storedHmac, expectedHmac)) {
    throw new Error("HMAC mismatch — backup data may be tampered or corrupted");
  }

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function isEncryptionEnabled(): boolean {
  return !!process.env.BACKUP_ENCRYPTION_KEY;
}
