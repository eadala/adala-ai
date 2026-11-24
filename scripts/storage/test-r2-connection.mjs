#!/usr/bin/env node
/**
 * Live R2 connectivity check — run against staging/production credentials.
 *
 *   node scripts/storage/test-r2-connection.mjs
 *
 * Requires: STORAGE_PROVIDER, R2_BUCKET_NAME, R2_ENDPOINT,
 *           R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 */

import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

function req(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ ${name} is not set`);
    process.exit(1);
  }
  return v;
}

const bucket = req("R2_BUCKET_NAME");
const endpoint = req("R2_ENDPOINT");
const accessKeyId = req("R2_ACCESS_KEY_ID");
const secretAccessKey = req("R2_SECRET_ACCESS_KEY");

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

const testKey = `__healthcheck__/${Date.now()}.txt`;

async function main() {
  console.log("🔍 R2 connectivity test");
  console.log(`   bucket:   ${bucket}`);
  console.log(`   endpoint: ${endpoint}`);

  await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
  console.log("✅ ListObjects — OK");

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: Buffer.from("adala-r2-healthcheck"),
      ContentType: "text/plain",
    })
  );
  console.log("✅ PutObject — OK");

  const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: testKey }));
  const body = await got.Body.transformToByteArray();
  if (Buffer.from(body).toString() !== "adala-r2-healthcheck") {
    throw new Error("GetObject content mismatch");
  }
  console.log("✅ GetObject — OK");

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
  console.log("✅ DeleteObject — OK");

  console.log("\n✅ All R2 checks passed");
}

main().catch((e) => {
  console.error("❌ R2 test failed:", e.message);
  process.exit(1);
});
