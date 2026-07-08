/**
 * R2 storage provider — unit + optional live connectivity test.
 *
 * Live test runs only when R2_* env vars are set:
 *   node --import tsx --test src/tests/r2-storage.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  getStorageProviderId,
  isObjectStorageConfigured,
  buildPrivateUploadKey,
  entityIdToObjectKey,
  objectKeyToEntityPath,
} from "../core/storage/config.ts";
import { getStorageProvider, resetStorageProviderCache } from "../core/storage/storageFactory.ts";

const LIVE = process.env.R2_RUN_LIVE_TEST === "1" && isObjectStorageConfigured();

describe("storage config", () => {
  it("defaults to cloudflare_r2 provider id", () => {
    const prev = process.env.STORAGE_PROVIDER;
    delete process.env.STORAGE_PROVIDER;
    assert.equal(getStorageProviderId(), "cloudflare_r2");
    if (prev) process.env.STORAGE_PROVIDER = prev;
  });

  it("builds private upload keys under prefix", () => {
    const key = buildPrivateUploadKey("abc-123");
    assert.match(key, /uploads\/abc-123$/);
  });

  it("maps entity paths to object keys", () => {
    const key = entityIdToObjectKey("uploads/foo");
    assert.ok(key.includes("uploads/foo"));
    assert.equal(objectKeyToEntityPath(key), "/objects/uploads/foo");
  });
});

describe("R2 provider", () => {
  before(() => {
    resetStorageProviderCache();
  });

  after(() => {
    resetStorageProviderCache();
  });

  it("throws when R2 credentials are missing", () => {
    const saved = {
      STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      R2_ENDPOINT: process.env.R2_ENDPOINT,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    };
    delete process.env.R2_BUCKET_NAME;
    resetStorageProviderCache();
    assert.throws(() => getStorageProvider(), /R2_BUCKET_NAME/);
    Object.assign(process.env, saved);
    resetStorageProviderCache();
  });

  it("healthCheck succeeds against live R2", { skip: !LIVE }, async () => {
    const provider = getStorageProvider();
    const health = await provider.healthCheck();
    assert.equal(health.ok, true, health.detail);
    assert.equal(health.provider, "cloudflare_r2");
  });

  it("round-trips put/get/delete on live R2", { skip: !LIVE }, async () => {
    const provider = getStorageProvider();
    const key = `__healthcheck__/${Date.now()}.txt`;
    const payload = Buffer.from("adala-r2-ok");

    await provider.putObject(key, payload, { contentType: "text/plain" });
    assert.equal(await provider.exists(key), true);

    const downloaded = await provider.getObject(key);
    assert.equal(downloaded.toString(), "adala-r2-ok");

    const signedGet = await provider.getSignedUrl(key, { method: "GET", ttlSec: 60 });
    assert.ok(signedGet.startsWith("http"));

    const signedPut = await provider.getSignedUrl(key + ".put", {
      method: "PUT",
      ttlSec: 60,
      contentType: "text/plain",
    });
    assert.ok(signedPut.startsWith("http"));

    await provider.deleteObject(key);
    assert.equal(await provider.exists(key), false);
  });
});
