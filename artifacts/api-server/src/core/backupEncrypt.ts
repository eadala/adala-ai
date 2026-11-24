/**
 * backupEncrypt.ts — AES-256-CBC encrypt/decrypt for backup data
 * Uses Node.js built-in crypto — no external packages required.
 *
 * Format: [ IV (16 bytes) | HMAC (32 bytes) | Encrypted data ]
 * HMAC-SHA256 validates integrity before decryption (fail-safe design).
 *
 * ⚠️  BACKUP_ENCRYPTION_KEY must be set in environment secrets.
 *     The server refuses to start backup operations without it.
 *     Generate a key with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

import crypto from "crypto";

function getKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw || raw.trim() === "") {
    throw new Error(
      "[backupEncrypt] BACKUP_ENCRYPTION_KEY is not set. " +
      "Set it in Coolify (or your host) environment secrets before using the backup system."
    );
  }
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptBuffer(buffer: Buffer): Buffer {
  const key = getKey();
  const iv  = crypto.randomBytes(16);

  const cipher    = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

  const hmac = crypto.createHmac("sha256", key).update(Buffer.concat([iv, encrypted])).digest();

  return Buffer.concat([iv, hmac, encrypted]);
}

export function decryptBuffer(buffer: Buffer): Buffer {
  const key        = getKey();
  const iv         = buffer.subarray(0, 16);
  const storedHmac = buffer.subarray(16, 48);
  const encrypted  = buffer.subarray(48);

  const expectedHmac = crypto.createHmac("sha256", key).update(Buffer.concat([iv, encrypted])).digest();
  if (!crypto.timingSafeEqual(storedHmac, expectedHmac)) {
    throw new Error("HMAC mismatch — backup data may be tampered or corrupted");
  }

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/** Decrypt a buffer that was encrypted with the old fallback key (for one-time migration). */
export function decryptBufferLegacy(buffer: Buffer): Buffer {
  const legacyKey = crypto.createHash("sha256").update("adala-default-dev-key-change-in-prod", "utf8").digest();
  const iv         = buffer.subarray(0, 16);
  const storedHmac = buffer.subarray(16, 48);
  const encrypted  = buffer.subarray(48);

  const expectedHmac = crypto.createHmac("sha256", legacyKey).update(Buffer.concat([iv, encrypted])).digest();
  if (!crypto.timingSafeEqual(storedHmac, expectedHmac)) {
    throw new Error("Legacy HMAC mismatch — file was not encrypted with the default key");
  }

  const decipher = crypto.createDecipheriv("aes-256-cbc", legacyKey, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function isEncryptionEnabled(): boolean {
  return !!(process.env.BACKUP_ENCRYPTION_KEY?.trim());
}

/**
 * Try to decrypt with the current key; if HMAC fails (legacy unencrypted backup
 * stored before BACKUP_ENCRYPTION_KEY was configured), return the raw buffer.
 */
export function safeDecryptBuffer(buffer: Buffer): Buffer {
  if (!isEncryptionEnabled()) return buffer;
  try {
    return decryptBuffer(buffer);
  } catch {
    return buffer; /* legacy backup written as plain JSON before key was set */
  }
}
