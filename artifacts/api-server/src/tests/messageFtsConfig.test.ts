import assert from "node:assert/strict";
import {
  parseFtsConfigFromGeneratedExpr,
  resolveMessageFtsConfigFromCatalogResult,
  __getCachedMessageFtsConfigForTests,
  __resetMessageFtsConfigCacheForTests,
} from "../modules/operations/messageFtsConfig";

console.log("═══ messageFtsConfig unit tests ═══");

__resetMessageFtsConfigCacheForTests();
assert.equal(__getCachedMessageFtsConfigForTests(), null);

assert.equal(
  parseFtsConfigFromGeneratedExpr(
    "to_tsvector('arabic'::regconfig, ((COALESCE(subject, ''::text) || ' '::text) || COALESCE(body, ''::text)))",
  ),
  "arabic",
);
assert.equal(
  parseFtsConfigFromGeneratedExpr(
    "to_tsvector('simple'::regconfig, (COALESCE(subject, ''::text) || COALESCE(body, ''::text)))",
  ),
  "simple",
);
assert.equal(parseFtsConfigFromGeneratedExpr("''::tsvector"), null);
assert.equal(parseFtsConfigFromGeneratedExpr(null), null);

const arabicOk = resolveMessageFtsConfigFromCatalogResult({
  status: "ok",
  columnPresent: true,
  generated: "s",
  expr: "to_tsvector('arabic'::regconfig, coalesce(subject, '') || ' ' || coalesce(body, ''))",
});
assert.deepEqual(arabicOk, { config: "arabic", cache: true });

const simpleOk = resolveMessageFtsConfigFromCatalogResult({
  status: "ok",
  columnPresent: true,
  generated: "s",
  expr: "to_tsvector('simple'::regconfig, coalesce(subject, '') || ' ' || coalesce(body, ''))",
});
assert.deepEqual(simpleOk, { config: "simple", cache: true });

const absent = resolveMessageFtsConfigFromCatalogResult({
  status: "ok",
  columnPresent: false,
  generated: null,
  expr: null,
});
assert.deepEqual(absent, { config: "simple", cache: true });

const nonGenerated = resolveMessageFtsConfigFromCatalogResult({
  status: "ok",
  columnPresent: true,
  generated: "",
  expr: null,
});
assert.deepEqual(nonGenerated, { config: "simple", cache: true });

const unreadableGenerated = resolveMessageFtsConfigFromCatalogResult({
  status: "ok",
  columnPresent: true,
  generated: "s",
  expr: "NULL::tsvector",
});
assert.deepEqual(unreadableGenerated, { config: "simple", cache: true });

const transient = resolveMessageFtsConfigFromCatalogResult({
  status: "transient_error",
});
assert.deepEqual(transient, { config: "simple", cache: false });
assert.equal(
  __getCachedMessageFtsConfigForTests(),
  null,
  "transient catalog failure must not permanently cache simple",
);

console.log("  ✅ parse + cache policy: expression config / absent / transient");
