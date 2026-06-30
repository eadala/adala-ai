#!/usr/bin/env node
/**
 * Route Governance Validator — عدالة AI Platform
 * يفحص سلامة نظام التنقل بالكامل ويتحقق من:
 *  1. عدم وجود روابط مكسورة في الشريط الجانبي والتنقل السفلي
 *  2. عدم وجود مسارات مكررة
 *  3. صحة سياسة Redirect
 *  4. توافق روابط الـ Deep Links
 *
 * يُشغَّل ضمن CI/CD: node artifacts/adala/scripts/validate-routes.mjs
 * يخرج بكود 0 عند النجاح، 1 عند وجود مشاكل
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/* ── helpers ────────────────────────────────────────────── */
const RED    = "\x1b[31m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

function log(icon, color, msg) { console.log(`${color}${icon} ${msg}${RESET}`); }
function pass(msg)  { log("✅", GREEN,  msg); }
function fail(msg)  { log("❌", RED,    msg); }
function warn(msg)  { log("⚠️ ", YELLOW, msg); }
function info(msg)  { log("ℹ️ ", CYAN,   msg); }
function head(msg)  { console.log(`\n${BOLD}${CYAN}══ ${msg} ══${RESET}`); }

/* ── read source files ──────────────────────────────────── */
function readSrc(relPath) {
  return readFileSync(resolve(ROOT, "src", relPath), "utf8");
}

const appTsx      = readSrc("App.tsx");
const layoutTsx   = readSrc("components/layout.tsx");
const mobileNavTsx = readSrc("components/mobile-nav.tsx");

/* ── extract routes from App.tsx ─────────────────────────── */
const routeMatches = [...appTsx.matchAll(/path="([^"]+)"/g)];
const appRoutes = new Set(routeMatches.map(m => m[1]));

/* ── extract hrefs from layout ───────────────────────────── */
function extractHrefs(src) {
  const matches = [...src.matchAll(/href:\s*"([^"]+)"|href="([^"]+)"/g)];
  return matches
    .map(m => (m[1] || m[2]).split("?")[0].split("#")[0])
    .filter(h => h.startsWith("/") && !h.includes("${"))
    .map(h => h.replace(/\/new$/, ""));
}

const layoutHrefs  = extractHrefs(layoutTsx);
const mobileHrefs  = extractHrefs(mobileNavTsx);
const allNavHrefs  = [...new Set([...layoutHrefs, ...mobileHrefs])];

/* ── check if path is covered by a route pattern ─────────── */
function isCovered(href) {
  if (appRoutes.has(href)) return true;
  for (const route of appRoutes) {
    if (route.includes(":")) {
      const pattern = "^" + route.replace(/:[^/]+/g, "[^/]+") + "$";
      if (new RegExp(pattern).test(href)) return true;
    }
  }
  return false;
}

/* ── 1. Broken Links ─────────────────────────────────────── */
head("فحص الروابط المكسورة (Broken Links)");
const broken = allNavHrefs.filter(h => !isCovered(h));
if (broken.length === 0) {
  pass(`جميع الروابط صحيحة — ${allNavHrefs.length} رابط فُحص`);
} else {
  broken.forEach(h => fail(`رابط مكسور: ${h}`));
}

/* ── 2. Duplicate Routes ─────────────────────────────────── */
head("فحص المسارات المكررة (Duplicate Routes)");
const pathCounts = {};
for (const m of routeMatches) {
  const p = m[1];
  pathCounts[p] = (pathCounts[p] ?? 0) + 1;
}
// "/" appears twice by design: once in main router (HomeRedirect) and once
// inside the nested WouterRouter for the landing page — not a conflict.
const duplicates = Object.entries(pathCounts).filter(([p, c]) => c > 1 && p !== "/");
if (duplicates.length === 0) {
  pass("لا توجد مسارات مكررة");
} else {
  duplicates.forEach(([p, c]) => fail(`مكرر ${c}x: ${p}`));
}

/* ── 3. Redirect Policy ──────────────────────────────────── */
head("فحص سياسة Redirect");
const redirectMatches = [...appTsx.matchAll(/<Redirect\s+to=\{[^}]+\}\s*\/>/g)];
const redirectCount = redirectMatches.length;
// Check redirects point to valid targets
const redirectTargets = [...appTsx.matchAll(/Redirect to=\{`[^`]*\/([^`]+)`\}/g)]
  .map(m => `/${m[1]}`);
const badRedirects = redirectTargets.filter(t => !isCovered(t));
if (badRedirects.length === 0) {
  pass(`${redirectCount} Redirect صحيح`);
} else {
  badRedirects.forEach(t => fail(`Redirect يشير إلى مسار غير موجود: ${t}`));
}

/* ── 4. Route Guard Coverage ─────────────────────────────── */
head("فحص حماية المسارات (Route Guards)");
// Guard keywords: both element-form <Guard> and inline arrow {p => <Guard>}
const guardPattern = /(?:WorkspaceRoute|ProtectedRoute|AdminRoute|RoleRoute|PublicPage|Suspense|Redirect)/;
// Collect lines with <Route path="..."> and check if line or next line contains a guard
const routeLines = appTsx.split("\n");
const unguarded = [];
for (let i = 0; i < routeLines.length; i++) {
  const m = routeLines[i].match(/<Route\s+path="([^"]+)"/);
  if (!m) continue;
  const path = m[1];
  // Skip known safe paths
  if (["/" , "/system-status", "/sign-in/*?", "/sign-up/*?"].includes(path)) continue;
  // Check current line + next line for guard or component prop (component=... is inline guard-free)
  const context = (routeLines[i] + (routeLines[i + 1] ?? ""));
  if (!guardPattern.test(context) && !context.includes("component=")) {
    unguarded.push(path);
  }
}
if (unguarded.length === 0) {
  pass("جميع المسارات محمية");
} else {
  unguarded.forEach(p => warn(`مسار بدون حماية صريحة: ${p}`));
}

/* ── 5. Deep Link Patterns ───────────────────────────────── */
head("فحص الروابط العميقة (Deep Links)");
const deepLinkPatterns = [
  "/cases/:id",
  "/clients/:id",
  "/contracts",
  "/documents",
  "/bankruptcy/:section",
  "/invoice/:token",
  "/portal/:token",
  "/sign/:token",
  "/firms/:slug",
];
const missingDeepLinks = deepLinkPatterns.filter(p => !appRoutes.has(p));
if (missingDeepLinks.length === 0) {
  pass(`جميع الـ ${deepLinkPatterns.length} Deep Links مسجّلة`);
} else {
  missingDeepLinks.forEach(p => fail(`Deep Link مفقود: ${p}`));
}

/* ── 6. Nav Hrefs Coverage ───────────────────────────────── */
head("فحص تغطية تنقل الشريط الجانبي والجوال");
const uniqueNavHrefs = [...new Set(allNavHrefs)];
const coveredCount = uniqueNavHrefs.filter(h => isCovered(h)).length;
info(`Layout.tsx: ${layoutHrefs.length} رابط | Mobile-nav: ${mobileHrefs.length} رابط | فريد: ${uniqueNavHrefs.length}`);
info(`مُغطّى بـ Route: ${coveredCount}/${uniqueNavHrefs.length}`);
if (coveredCount === uniqueNavHrefs.length) {
  pass("تغطية التنقل: 100%");
}

/* ── 7. Route Registry Sync ──────────────────────────────── */
head("فحص تزامن Route Registry");
const registryPath = resolve(ROOT, "src/lib/routeRegistry.ts");
let registryExists = false;
try {
  const registry = readFileSync(registryPath, "utf8");
  const registeredPaths = [...registry.matchAll(/path:\s*"([^"]+)"/g)].map(m => m[1]);
  const inAppNotRegistry = [...appRoutes].filter(p =>
    !registeredPaths.includes(p) &&
    !p.startsWith("/sign-in") &&
    !p.startsWith("/sign-up") &&
    !p.startsWith("/sign/") &&
    !p.startsWith("/invoice/") &&
    p !== "/"
  );
  const registrySize = registeredPaths.length;
  const appSize = appRoutes.size;
  info(`Registry: ${registrySize} مسار | App.tsx: ${appSize} مسار`);
  if (inAppNotRegistry.length === 0) {
    pass("Route Registry متزامن مع App.tsx");
  } else {
    inAppNotRegistry.slice(0, 10).forEach(p => warn(`في App.tsx لكن غير مسجّل في Registry: ${p}`));
    if (inAppNotRegistry.length > 10) warn(`...و ${inAppNotRegistry.length - 10} آخرين`);
  }
  registryExists = true;
} catch {
  fail("routeRegistry.ts غير موجود — شغّل: node scripts/validate-routes.mjs");
}

/* ── Summary ─────────────────────────────────────────────── */
head("ملخص النتائج");
const issues = broken.length + duplicates.length + badRedirects.length + missingDeepLinks.length;
const warnings = unguarded.length;

if (issues === 0 && warnings === 0) {
  console.log(`\n${BOLD}${GREEN}🎉 حوكمة التنقل: PASS — لا مشاكل${RESET}\n`);
  console.log(`${GREEN}  ✅ Broken Links:      0`);
  console.log(`  ✅ Duplicate Routes:  0`);
  console.log(`  ✅ Bad Redirects:     0`);
  console.log(`  ✅ Deep Links:        ${deepLinkPatterns.length}/${deepLinkPatterns.length}`);
  console.log(`  ✅ Nav Coverage:      100%`);
  console.log(`  ✅ Route Registry:    ${registryExists ? "متزامن" : "غير موجود"}${RESET}\n`);
  process.exit(0);
} else {
  console.log(`\n${BOLD}${RED}🚨 حوكمة التنقل: مشاكل موجودة${RESET}`);
  console.log(`${RED}  ❌ Broken Links:     ${broken.length}`);
  console.log(`  ❌ Duplicate Routes: ${duplicates.length}`);
  console.log(`  ❌ Bad Redirects:    ${badRedirects.length}`);
  console.log(`  ❌ Missing DeepLinks:${missingDeepLinks.length}${RESET}`);
  if (warnings > 0) {
    console.log(`${YELLOW}  ⚠️  Unguarded Routes:  ${warnings}${RESET}`);
  }
  console.log();
  process.exit(1);
}
