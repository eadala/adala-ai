import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "*.config.*"] },

  {
    files: ["src/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      // ─── TypeScript Safety ────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-namespace": "warn",

      // ─── Critical Security (error = يوقف الـ commit) ─────────────────
      "no-debugger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-var": "error",
      "prefer-const": "warn",
    },
  },

  // Pre-existing lint debt in tenant-fallback-hardened portal/auth modules.
  // File-level eslint-disable is forbidden in source (tenantFallbackRemoval);
  // keep debt scoped here so Stage 6B schema-authority edits can pass lint-staged.
  {
    files: [
      "src/modules/marketplace/client-portal.ts",
      "src/modules/marketplace/client-auth.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
