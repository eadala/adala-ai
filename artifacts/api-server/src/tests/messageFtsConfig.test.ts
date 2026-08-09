/**
 * Stage 20.2 — FTS config allow-list + cache hardening.
 * Run: pnpm --filter @workspace/api-server run test:message-fts-config
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isAllowedMessageFtsConfig,
  MESSAGE_FTS_ALLOWED_CONFIGS,
  parseFtsConfigFromGeneratedExpr,
  resolveMessageFtsConfigFromCatalogResult,
} from "../modules/operations/messageFtsConfigLogic";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

const ARABIC_EXPR =
  "to_tsvector('arabic'::regconfig, ((COALESCE(subject, ''::text) || ' '::text) || COALESCE(body, ''::text)))";
const SIMPLE_EXPR =
  "to_tsvector('simple'::regconfig, (COALESCE(subject, ''::text) || COALESCE(body, ''::text)))";
const ENGLISH_EXPR =
  "to_tsvector('english'::regconfig, (COALESCE(subject, ''::text) || COALESCE(body, ''::text)))";

console.log("═══ messageFtsConfig unit tests ═══");

console.log("\n═══ allow-list: arabic / simple only ═══");
{
  assert.deepEqual([...MESSAGE_FTS_ALLOWED_CONFIGS].sort(), ["arabic", "simple"]);
  assert.equal(isAllowedMessageFtsConfig("arabic"), true);
  assert.equal(isAllowedMessageFtsConfig("simple"), true);
  for (const bad of ["english", "german", "french", "x", "", "ARABIC", "Simple"]) {
    assert.equal(isAllowedMessageFtsConfig(bad), false, `must reject ${bad}`);
  }
  console.log("  ✅ allow-list accepts arabic/simple only");
}

console.log("\n═══ parse generated expression ═══");
{
  assert.equal(parseFtsConfigFromGeneratedExpr(ARABIC_EXPR), "arabic");
  assert.equal(parseFtsConfigFromGeneratedExpr(SIMPLE_EXPR), "simple");
  assert.equal(parseFtsConfigFromGeneratedExpr(ENGLISH_EXPR), "english");
  assert.equal(parseFtsConfigFromGeneratedExpr("''::tsvector"), null);
  assert.equal(parseFtsConfigFromGeneratedExpr(null), null);
  console.log("  ✅ parse extracts catalog literal");
}

console.log("\n═══ resolve: authoritative arabic/simple cacheable ═══");
{
  const arabicOk = resolveMessageFtsConfigFromCatalogResult({
    status: "ok",
    columnPresent: true,
    generated: "s",
    expr: ARABIC_EXPR,
  });
  assert.deepEqual(arabicOk, {
    config: "arabic",
    cache: true,
    reason: "authoritative",
  });

  const simpleOk = resolveMessageFtsConfigFromCatalogResult({
    status: "ok",
    columnPresent: true,
    generated: "s",
    expr: SIMPLE_EXPR,
  });
  assert.deepEqual(simpleOk, {
    config: "simple",
    cache: true,
    reason: "authoritative",
  });
  console.log("  ✅ arabic/simple authoritative + cacheable");
}

console.log("\n═══ resolve: unsupported config rejected (not used as regconfig) ═══");
{
  const unsupported = resolveMessageFtsConfigFromCatalogResult({
    status: "ok",
    columnPresent: true,
    generated: "s",
    expr: ENGLISH_EXPR,
  });
  assert.equal(unsupported.config, null);
  assert.equal(unsupported.cache, false);
  assert.equal(unsupported.reason, "unsupported_config");
  assert.equal(unsupported.rejectedConfig, "english");
  assert.notEqual(unsupported.config, "english");
  assert.notEqual(unsupported.config, "simple");
  console.log("  ✅ unsupported catalog config not passed to ::regconfig");
}

console.log("\n═══ resolve: absent / unreadable / transient do not poison cache ═══");
{
  const absent = resolveMessageFtsConfigFromCatalogResult({
    status: "ok",
    columnPresent: false,
    generated: null,
    expr: null,
  });
  assert.deepEqual(absent, {
    config: null,
    cache: false,
    reason: "column_absent",
  });

  const nonGenerated = resolveMessageFtsConfigFromCatalogResult({
    status: "ok",
    columnPresent: true,
    generated: "",
    expr: null,
  });
  assert.equal(nonGenerated.cache, false);
  assert.equal(nonGenerated.config, null);
  assert.equal(nonGenerated.reason, "not_generated");

  const unreadableGenerated = resolveMessageFtsConfigFromCatalogResult({
    status: "ok",
    columnPresent: true,
    generated: "s",
    expr: "NULL::tsvector",
  });
  assert.deepEqual(unreadableGenerated, {
    config: null,
    cache: false,
    reason: "parse_failure",
  });

  const transient = resolveMessageFtsConfigFromCatalogResult({
    status: "transient_error",
  });
  assert.deepEqual(transient, {
    config: null,
    cache: false,
    reason: "transient_error",
  });
  console.log("  ✅ non-authoritative states return null without cache");
}

console.log("\n═══ request/user input cannot control FTS config ═══");
{
  const im = readSrc("modules/operations/internal-messages.ts");
  const fts = readSrc("modules/operations/messageFtsConfig.ts");
  const logic = readSrc("modules/operations/messageFtsConfigLogic.ts");

  assert.match(im, /getMessageFtsConfig\(\)/);
  assert.doesNotMatch(im, /getMessageFtsConfig\(\s*req/);
  assert.doesNotMatch(im, /ftsConfig\s*=\s*req\.(query|body|headers)/);
  assert.doesNotMatch(im, /plainto_tsquery\(\s*\$\{?req/);
  assert.doesNotMatch(im, /::regconfig[^;]*req\.(query|body|headers)/);
  assert.doesNotMatch(fts, /req\.(query|body|headers)/);
  assert.doesNotMatch(logic, /req\.(query|body|headers)/);
  assert.match(logic, /MESSAGE_FTS_ALLOWED_CONFIGS/);
  assert.match(im, /plainto_tsquery\(\$\{ftsConfig\}::regconfig/);
  console.log("  ✅ config sourced from catalog allow-list only");
}

console.log("\n═══ Stage 20.1 tenant filters remain present ═══");
{
  const im = readSrc("modules/operations/internal-messages.ts");
  assert.match(im, /requireAuthWithTenant/);
  assert.match(im, /assertCanonicalBusinessOfficeId/);
  assert.match(im, /resolveCanonicalMessageOfficeId/);
  assert.match(im, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(
    im,
    /INSERT INTO office_messages\s*\(\s*office_id\s*,/,
  );
  assert.match(
    im,
    /WHERE id = \$\{String\(req\.params\.id\)\}::uuid AND office_id = \$\{tenantId\}/,
  );
  assert.match(im, /router\.get\(\s*"\/"\s*,\s*requireAuthWithTenant/);
  assert.match(im, /router\.post\(\s*"\/"\s*,\s*requireAuthWithTenant/);
  console.log("  ✅ Stage 20.1 tenant isolation surface unchanged");
}

async function runCacheLifecycleTests() {
  /* messageFtsConfig imports @workspace/db which requires DATABASE_URL at load. */
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@127.0.0.1:5432/adala_fts_config_test";

  const {
    __getCachedMessageFtsConfigForTests,
    __resetMessageFtsConfigCacheForTests,
    __setMessageFtsCatalogReaderForTests,
    getMessageFtsConfig,
  } = await import("../modules/operations/messageFtsConfig");

  console.log("\n═══ getMessageFtsConfig: absent then ready discovers arabic ═══");
  {
    __resetMessageFtsConfigCacheForTests();
    let calls = 0;
    __setMessageFtsCatalogReaderForTests(async () => {
      calls += 1;
      if (calls === 1) {
        return { columnPresent: false, generated: null, expr: null };
      }
      return { columnPresent: true, generated: "s", expr: ARABIC_EXPR };
    });

    const before = await getMessageFtsConfig();
    assert.equal(before, null);
    assert.equal(__getCachedMessageFtsConfigForTests(), null, "absent must not cache simple");

    const after = await getMessageFtsConfig();
    assert.equal(after, "arabic");
    assert.equal(__getCachedMessageFtsConfigForTests(), "arabic");
    assert.equal(calls, 2);

    const cached = await getMessageFtsConfig();
    assert.equal(cached, "arabic");
    assert.equal(calls, 2, "authoritative cache must short-circuit catalog");
    console.log("  ✅ readiness transition discovers arabic without process restart");
  }

  console.log("\n═══ getMessageFtsConfig: transient error does not poison cache ═══");
  {
    __resetMessageFtsConfigCacheForTests();
    let calls = 0;
    __setMessageFtsCatalogReaderForTests(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("catalog unavailable");
      }
      return { columnPresent: true, generated: "s", expr: SIMPLE_EXPR };
    });

    const failed = await getMessageFtsConfig();
    assert.equal(failed, null);
    assert.equal(__getCachedMessageFtsConfigForTests(), null);

    const recovered = await getMessageFtsConfig();
    assert.equal(recovered, "simple");
    assert.equal(__getCachedMessageFtsConfigForTests(), "simple");
    assert.equal(calls, 2);
    console.log("  ✅ transient failure then recovery caches simple");
  }

  console.log("\n═══ getMessageFtsConfig: unsupported never cached / never used ═══");
  {
    __resetMessageFtsConfigCacheForTests();
    let calls = 0;
    __setMessageFtsCatalogReaderForTests(async () => {
      calls += 1;
      if (calls === 1) {
        return { columnPresent: true, generated: "s", expr: ENGLISH_EXPR };
      }
      return { columnPresent: true, generated: "s", expr: ARABIC_EXPR };
    });

    const rejected = await getMessageFtsConfig();
    assert.equal(rejected, null);
    assert.equal(__getCachedMessageFtsConfigForTests(), null);

    const next = await getMessageFtsConfig();
    assert.equal(next, "arabic");
    assert.equal(__getCachedMessageFtsConfigForTests(), "arabic");
    console.log("  ✅ unsupported then authoritative recovers");
  }

  console.log("\n═══ query config compatible with discovered generated-column config ═══");
  {
    __resetMessageFtsConfigCacheForTests();
    __setMessageFtsCatalogReaderForTests(async () => ({
      columnPresent: true,
      generated: "s",
      expr: ARABIC_EXPR,
    }));
    const cfg = await getMessageFtsConfig();
    assert.equal(cfg, "arabic");
    assert.equal(
      parseFtsConfigFromGeneratedExpr(ARABIC_EXPR),
      cfg,
      "plainto_tsquery config must match generated to_tsvector config",
    );

    __resetMessageFtsConfigCacheForTests();
    __setMessageFtsCatalogReaderForTests(async () => ({
      columnPresent: true,
      generated: "s",
      expr: SIMPLE_EXPR,
    }));
    const cfgSimple = await getMessageFtsConfig();
    assert.equal(cfgSimple, "simple");
    assert.equal(parseFtsConfigFromGeneratedExpr(SIMPLE_EXPR), cfgSimple);
    console.log("  ✅ query config matches generated-column config");
  }

  __setMessageFtsCatalogReaderForTests(null);
  __resetMessageFtsConfigCacheForTests();
}

await runCacheLifecycleTests();
console.log("\n✅ messageFtsConfig tests passed\n");
