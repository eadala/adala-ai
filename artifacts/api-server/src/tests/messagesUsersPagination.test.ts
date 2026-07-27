/**
 * Messages & Users pagination (Task 10.4.3).
 * Run: pnpm --filter @workspace/api-server run test:messages-users-pagination
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_PAGE_LIMIT,
  parsePageLimit,
  queryHasPageAndLimit,
} from "../lib/paginationSafety";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADALA = join(ROOT, "../../adala/src");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}
function readAdala(rel: string) {
  return readFileSync(join(ADALA, rel), "utf8");
}

console.log("\n═══ helper policy ═══");
{
  assert.equal(MAX_PAGE_LIMIT, 200);
  assert.equal(queryHasPageAndLimit({ page: "1", limit: "50" }), true);
  assert.equal(queryHasPageAndLimit({ page: "1" }), false);
  assert.equal(queryHasPageAndLimit({ limit: "50" }), false);
  assert.deepEqual(parsePageLimit({ page: "2", limit: "50" }, 30), {
    page: 2,
    limit: 50,
    offset: 50,
  });
  assert.deepEqual(parsePageLimit({ page: "1", limit: "999" }, 30), {
    page: 1,
    limit: 200,
    offset: 0,
  });
  console.log("  ✅ shared helper OK");
}

console.log("\n═══ backend wiring ═══");
{
  const messages = read("modules/operations/messages.ts");
  const conversations = read("modules/operations/conversations.ts");
  const users = read("modules/platform/users.ts");

  assert.match(messages, /parsePageLimit/);
  assert.match(messages, /queryHasPageAndLimit/);
  assert.match(messages, /LIMIT \$\{limit\} OFFSET \$\{offset\}/);
  assert.match(messages, /COUNT\(\*\)::int AS total/);
  assert.match(messages, /ORDER BY created_at ASC/);
  assert.match(messages, /MAX_PAGE_LIMIT/);
  assert.match(messages, /ORDER BY created_at DESC\s*\n\s*LIMIT \$\{MAX_PAGE_LIMIT\}/);

  assert.match(conversations, /queryHasPageAndLimit/);
  assert.match(conversations, /parsePageLimit/);
  assert.match(conversations, /LIMIT \$\{limit\} OFFSET \$\{offset\}/);
  assert.match(conversations, /req\.query\.pageSize \?\? req\.query\.limit/);
  assert.match(conversations, /messages: msgs, page, pageSize, total/);
  assert.match(conversations, /c\.office_id = \$\{tenantId\}/);

  assert.match(users, /queryHasPageAndLimit/);
  assert.match(users, /parsePageLimit\(req\.query,\s*50\)/);
  assert.match(users, /\.limit\(limit\)/);
  assert.match(users, /\.offset\(offset\)/);
  assert.match(users, /orderBy\(asc\(usersTable\.createdAt\)\)/);
  assert.match(users, /res\.json\(mapped\)/);
  assert.match(users, /data: mapped/);
  /* Active aggregate must use FILTER (full filtered set), not page slice. */
  assert.match(
    users,
    /count\(\*\) FILTER \(WHERE \$\{usersTable\.status\} = 'active'\)::int/,
  );
  assert.match(users, /stats:\s*\{\s*active\s*\}/);
  assert.match(users, /\.from\(usersTable\)\.where\(where\)/);

  console.log("  ✅ messages/conversations/users use helper + SQL bounds");
}

console.log("\n═══ users active-stat aggregate (not page-local) ═══");
{
  const users = read("modules/platform/users.ts");
  const usersPage = readAdala("pages/platform/users.tsx");

  /* Backend: active count shares the same `where` as list + total. */
  assert.match(users, /active: sql<number>`count\(\*\) FILTER/);
  assert.doesNotMatch(
    users,
    /stats:[\s\S]*users\.filter|active:[\s\S]*\.length/,
  );

  /* Frontend must consume backend stats, not page.data filter. */
  assert.match(usersPage, /usersPage\?\.stats\?\.active/);
  assert.match(usersPage, /usersActive/);
  assert.doesNotMatch(
    usersPage,
    /users\.filter\(u\s*=>\s*u\.status\s*===\s*"active"\)\.length/,
  );

  console.log("  ✅ active count is DB aggregate over full filtered set");
}

console.log("\n═══ frontend consumers ═══");
{
  const usersPage = readAdala("pages/platform/users.tsx");
  const messagesPage = readAdala("pages/operations/messages.tsx");

  assert.match(usersPage, /ListPagination/);
  assert.match(usersPage, /page: String\(page\)/);
  assert.match(usersPage, /setPage\(1\)/);
  assert.doesNotMatch(usersPage, /useListUsers/);

  assert.match(messagesPage, /ListPagination/);
  assert.match(messagesPage, /\/api\/conversations\?\$\{p\}/);
  assert.match(messagesPage, /pageSize: "50"/);
  assert.match(messagesPage, /setThreadPage\(1\)/);
  assert.match(messagesPage, /convPage/);

  console.log("  ✅ users + conversations panels send page params");
}

console.log("\n✅ messagesUsersPagination tests passed\n");
