#!/usr/bin/env node
/**
 * عدالة AI — Automated UI Audit
 * Runs a full scan of the frontend codebase and reports:
 *   1. Console.log usage in pages/features
 *   2. Raw Dialog usage (Architecture Lock violations)
 *   3. Hooks after early-returns (heuristic)
 *   4. Unused imports (heuristic)
 *   5. Large page files (over threshold)
 *   6. Duplicate component patterns
 *   7. Missing EmptyState in data-fetching pages
 *   8. Design System compliance summary
 *
 * Usage:  node scripts/governance/ui-audit.mjs [--json] [--fail-on-issues]
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";

const FRONTEND_SRC = "artifacts/adala/src";
const PAGES_DIR    = `${FRONTEND_SRC}/pages`;
const FEATURES_DIR = `${FRONTEND_SRC}/features`;
const ARGS         = process.argv.slice(2);
const JSON_MODE    = ARGS.includes("--json");
const FAIL_ON      = ARGS.includes("--fail-on-issues");

// ── Helpers ──────────────────────────────────────────────────────────────────
function walkDir(dir, exts = [".ts", ".tsx"]) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) results.push(...walkDir(full, exts));
      else if (exts.some(e => entry.endsWith(e))) results.push(full);
    }
  } catch { /* dir might not exist */ }
  return results;
}

function readFile(p) {
  try { return readFileSync(p, "utf8"); }
  catch { return ""; }
}

// ── Audit Results ─────────────────────────────────────────────────────────────
const issues   = [];
const warnings = [];
const info     = [];

function issue(category, file, line, msg) {
  issues.push({ category, file: relative(process.cwd(), file), line, msg });
}
function warn(category, file, line, msg) {
  warnings.push({ category, file: relative(process.cwd(), file), line, msg });
}
function note(category, msg) {
  info.push({ category, msg });
}

const allPages    = walkDir(PAGES_DIR);
const allFeatures = walkDir(FEATURES_DIR);
const allSource   = walkDir(FRONTEND_SRC);
const appPages    = [...allPages, ...allFeatures];

// ─────────────────────────────────────────────────────────────────────────────
// Check 1 — console.log in pages/features
// ─────────────────────────────────────────────────────────────────────────────
for (const file of appPages) {
  const src = readFile(file);
  src.split("\n").forEach((line, i) => {
    if (/console\.log\s*\(/.test(line) && !line.trimStart().startsWith("//")) {
      issue("console.log", file, i + 1, line.trim().slice(0, 80));
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 2 — Raw Dialog usage in pages/features
// ─────────────────────────────────────────────────────────────────────────────
for (const file of appPages) {
  const src = readFile(file);
  src.split("\n").forEach((line, i) => {
    if (
      /from ["']@\/components\/ui\/dialog["']/.test(line) &&
      /\b(Dialog|DialogContent)\b/.test(line) &&
      !/DialogHeader|DialogTitle|DialogFooter|DialogDescription/.test(line)
    ) {
      issue("architecture-lock", file, i + 1,
        `Raw Dialog import — use AdaptiveDialog from @/components/adaptive`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 3 — Large files (> 800 lines)
// ─────────────────────────────────────────────────────────────────────────────
const LINE_THRESHOLD = 800;
for (const file of appPages) {
  const lines = readFile(file).split("\n").length;
  if (lines > LINE_THRESHOLD) {
    warn("file-size", file, 0,
      `${lines} lines — consider splitting into smaller modules (threshold: ${LINE_THRESHOLD})`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 4 — Hooks after early returns (heuristic)
// ─────────────────────────────────────────────────────────────────────────────
for (const file of appPages) {
  const src  = readFile(file);
  const lines = src.split("\n");
  let inFn = false;
  let returnSeen = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^(function|const)\s+[A-Z]/.test(l)) { inFn = true; returnSeen = false; }
    if (inFn && /^if\s*\(.*\)\s*return/.test(l)) returnSeen = true;
    if (inFn && returnSeen && /=\s*use(Query|State|Effect|Memo|Callback|Ref|Context)\s*[(<]/.test(l)) {
      warn("hooks-order", file, i + 1,
        `Hook called after potential early-return — verify: ${l.slice(0, 60)}`);
      returnSeen = false; // report once per fn
    }
    if (l === "}" || l === "};") { inFn = false; returnSeen = false; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 5 — Pages with useQuery but no loading state
// ─────────────────────────────────────────────────────────────────────────────
for (const file of allPages) {
  const src = readFile(file);
  if (/useQuery/.test(src) && !/isLoading|isFetching|Skeleton|skeleton|Loader/.test(src)) {
    warn("ux-loading", file, 0,
      "useQuery present but no loading indicator found (isLoading / Skeleton / Loader2)");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 6 — Unused imports (heuristic: imported but never used in JSX/code)
// ─────────────────────────────────────────────────────────────────────────────
for (const file of appPages) {
  const src = readFile(file);
  const importLines = src.split("\n").filter(l => l.trimStart().startsWith("import "));
  for (const importLine of importLines) {
    const match = importLine.match(/import\s*\{([^}]+)\}/);
    if (!match) continue;
    const names = match[1].split(",").map(n => n.trim().split(" as ").pop()?.trim()).filter(Boolean);
    const restOfFile = src.replace(importLine, "");
    for (const name of names ?? []) {
      if (name && name.length > 2 && !new RegExp(`\\b${name}\\b`).test(restOfFile)) {
        warn("unused-import", file, 0, `Potentially unused import: '${name}'`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 7 — Design System compliance: EmptyState usage
// ─────────────────────────────────────────────────────────────────────────────
let emptyStateCount  = 0;
let adaptiveDialogCount = 0;
let skeletonCount    = 0;

for (const file of allPages) {
  const src = readFile(file);
  if (/EmptyState/.test(src))     emptyStateCount++;
  if (/AdaptiveDialog/.test(src)) adaptiveDialogCount++;
  if (/SkeletonCard|Skeleton/.test(src)) skeletonCount++;
}
note("design-system", `EmptyState:      used in ${emptyStateCount} pages`);
note("design-system", `AdaptiveDialog:  used in ${adaptiveDialogCount} pages`);
note("design-system", `Skeleton/loading: used in ${skeletonCount} pages`);

// ─────────────────────────────────────────────────────────────────────────────
// Check 8 — Duplicate component names (same exported component across files)
// ─────────────────────────────────────────────────────────────────────────────
const exportMap = new Map();
for (const file of allSource) {
  const src = readFile(file);
  const matches = [...src.matchAll(/export\s+(?:default\s+)?function\s+([A-Z]\w+)/g)];
  for (const m of matches) {
    const name = m[1];
    if (!exportMap.has(name)) exportMap.set(name, []);
    exportMap.get(name).push(relative(process.cwd(), file));
  }
}
for (const [name, files] of exportMap) {
  if (files.length > 1) {
    warn("duplicate-component", files[0], 0,
      `Component '${name}' exported from ${files.length} files: ${files.join(", ")}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    issues:   issues.length,
    warnings: warnings.length,
    info:     info.length,
  },
  issues,
  warnings,
  info,
};

if (JSON_MODE) {
  const outPath = "scripts/governance/ui-audit-report.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Audit report written to ${outPath}`);
} else {
  const C = { R: "\x1b[31m", Y: "\x1b[33m", G: "\x1b[32m", B: "\x1b[34m", RESET: "\x1b[0m", BOLD: "\x1b[1m" };
  console.log(`\n${C.BOLD}${C.B}╔═══════════════════════════════════════════╗${C.RESET}`);
  console.log(`${C.BOLD}${C.B}║    عدالة AI — UI Governance Audit         ║${C.RESET}`);
  console.log(`${C.BOLD}${C.B}╚═══════════════════════════════════════════╝${C.RESET}\n`);

  if (issues.length) {
    console.log(`${C.BOLD}${C.R}── ISSUES (${issues.length}) ──${C.RESET}`);
    issues.forEach(i => console.log(`  ${C.R}✗${C.RESET}  [${i.category}] ${i.file}:${i.line}\n     ${i.msg}`));
    console.log("");
  }

  if (warnings.length) {
    console.log(`${C.BOLD}${C.Y}── WARNINGS (${warnings.length}) ──${C.RESET}`);
    warnings.slice(0, 30).forEach(w => console.log(`  ${C.Y}⚠${C.RESET}  [${w.category}] ${w.file}:${w.line}\n     ${w.msg}`));
    if (warnings.length > 30) console.log(`  ... and ${warnings.length - 30} more (run with --json for full list)`);
    console.log("");
  }

  console.log(`${C.BOLD}── DESIGN SYSTEM STATS ──${C.RESET}`);
  info.forEach(n => console.log(`  ${C.G}ℹ${C.RESET}  ${n.msg}`));
  console.log("");

  console.log(`${C.BOLD}── SUMMARY ──${C.RESET}`);
  console.log(`  Issues:   ${issues.length === 0 ? C.G : C.R}${issues.length}${C.RESET}`);
  console.log(`  Warnings: ${warnings.length === 0 ? C.G : C.Y}${warnings.length}${C.RESET}`);
  console.log("");
}

if (FAIL_ON && issues.length > 0) {
  process.exit(1);
}
