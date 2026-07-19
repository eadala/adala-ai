/**
 * Documents Library — Create Folder Save must dispatch POST /api/storage/folders.
 * Run: pnpm --filter @workspace/adala run test:documents-create-folder
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsSrc = readFileSync(
  resolve(__dirname, "../pages/legal-core/documents.tsx"),
  "utf8",
);

function sliceFolderNameInput(): string {
  const start = docsSrc.indexOf("function FolderNameInput");
  assert.ok(start >= 0, "FolderNameInput must exist");
  const end = docsSrc.indexOf("export default function Documents", start);
  assert.ok(end > start, "Documents component follows FolderNameInput");
  return docsSrc.slice(start, end);
}

console.log("\n═══ documents create-folder: FolderNameInput Save wiring ═══");

const folderInput = sliceFolderNameInput();

assert.match(folderInput, /type="button"/, "Save must be type=button");
assert.match(
  folderInput,
  /onMouseDown=\{e => e\.preventDefault\(\)\}/,
  "Save must preventDefault on mousedown so autofocus blur does not swallow the click",
);
assert.match(folderInput, /onClick=\{submit\}/, "Save must call submit onClick");
assert.match(
  folderInput,
  /const name = val\.trim\(\);\s*if \(name\) onSubmit\(name\);/s,
  "submit must forward trimmed name to onSubmit (createFolderMut.mutate)",
);
console.log("  ✅ Save onClick / mousedown / type=button wired");

console.log("\n═══ documents create-folder: input placement + mutation ═══");

assert.match(
  docsSrc,
  /saveTestId="documents-create-folder-save"/,
  "create-folder FolderNameInput must expose a stable test id",
);
assert.match(
  docsSrc,
  /Create-folder input — main pane/,
  "create-folder input must live in the main pane (not the w-52 sidebar)",
);
assert.match(
  docsSrc,
  /newFolderParent !== "NONE" && \([\s\S]*?FolderNameInput[\s\S]*?createFolderMut\.mutate\(\{ name, parentId: newFolderParent \}\)/,
  "toolbar مجلد جديد must wire FolderNameInput → createFolderMut.mutate",
);

/* Regression: do not put create-folder inputs back in the narrow sidebar */
const sidebarMarker = "Sidebar: Folder Tree";
const sidebarIdx = docsSrc.indexOf(sidebarMarker);
const mainPaneMarker = "Create-folder input — main pane";
const mainIdx = docsSrc.indexOf(mainPaneMarker);
assert.ok(sidebarIdx >= 0 && mainIdx > sidebarIdx, "main-pane create input after sidebar block");

const sidebarBlock = docsSrc.slice(sidebarIdx, mainIdx);
assert.doesNotMatch(
  sidebarBlock,
  /createFolderMut\.mutate/,
  "sidebar must not host createFolderMut Save (clipped / untappable regression)",
);
console.log("  ✅ create-folder UI in main pane; sidebar has no create mutate");

assert.match(
  docsSrc,
  /from "@\/lib\/authFetch"/,
  "documents page must import authFetch",
);
assert.match(
  docsSrc,
  /authFetch\(`\$\{BASE\}\/api\/storage\/folders`/,
  "createFolderMut must POST via authFetch",
);
assert.doesNotMatch(
  docsSrc,
  /fetch\(`\$\{BASE\}\/api\/storage\/folders`, \{ method: "POST"/,
  "bare fetch must not be used for create-folder POST",
);
console.log("  ✅ createFolderMut uses authFetch");

assert.match(
  docsSrc,
  /const \{ toast \} = useToast\(\);[\s\S]*createFolderMut = useMutation/,
  "useToast must be declared before createFolderMut (safe onSuccess toasts)",
);
console.log("  ✅ useToast before folder mutations");

console.log("\n✅ documentsCreateFolder: all checks passed\n");
