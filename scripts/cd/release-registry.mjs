#!/usr/bin/env node
/**
 * Track last N successful application releases (image/commit digests).
 * Never stores secrets. Does not modify PostgreSQL.
 *
 * Usage:
 *   node scripts/cd/release-registry.mjs record --commit SHA --digest DIGEST --status success
 *   node scripts/cd/release-registry.mjs list
 *   node scripts/cd/release-registry.mjs previous
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).stdout.trim();
const policy = JSON.parse(readFileSync(resolve(root, "release-guardian/cd-policy.json"), "utf8"));
const retain = policy.retain_successful_releases || 3;
const storeDir = resolve(root, "release-guardian/releases");
const storePath = resolve(storeDir, "registry.json");

function load() {
  if (!existsSync(storePath)) return { version: 1, releases: [] };
  return JSON.parse(readFileSync(storePath, "utf8"));
}
function save(doc) {
  mkdirSync(storeDir, { recursive: true });
  writeFileSync(storePath, JSON.stringify(doc, null, 2) + "\n");
}

const cmd = process.argv[2] || "list";
const args = Object.fromEntries(
  process.argv.slice(3).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

if (cmd === "record") {
  const doc = load();
  const entry = {
    recorded_at_utc: new Date().toISOString(),
    commit: args.commit || null,
    digest: args.digest || null,
    status: args.status || "success",
    note: args.note || null,
  };
  if (entry.status === "success") {
    doc.releases = [entry, ...doc.releases.filter((r) => r.status === "success")].slice(0, retain);
  } else {
    doc.releases = [entry, ...doc.releases].slice(0, retain + 5);
  }
  save(doc);
  console.log(JSON.stringify({ ok: true, retained: doc.releases.length, entry }, null, 2));
  process.exit(0);
}

if (cmd === "previous") {
  const doc = load();
  const prev = doc.releases[1] || null;
  console.log(JSON.stringify({ previous: prev, latest: doc.releases[0] || null }, null, 2));
  process.exit(prev ? 0 : 1);
}

const doc = load();
console.log(JSON.stringify(doc, null, 2));
process.exit(0);
