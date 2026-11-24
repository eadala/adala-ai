import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "*.config.*", "public/**"] },

  /* ══════════════════════════════════════════════════════════════════════════
   * BASE RULES — all src/**
   * ══════════════════════════════════════════════════════════════════════════ */
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      // ─── React Hooks ──────────────────────────────────────────────────────
      "react-hooks/rules-of-hooks":  "error",
      "react-hooks/exhaustive-deps": "warn",

      // ─── React ────────────────────────────────────────────────────────────
      "react/jsx-key": "error",

      // ─── TypeScript ───────────────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any":       "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // ─── Security / Critical ──────────────────────────────────────────────
      "no-debugger": "error",
      "no-eval":     "error",
      "no-new-func": "error",
      "no-var":      "error",
      "prefer-const": "warn",
    },
  },

  /* ══════════════════════════════════════════════════════════════════════════
   * ARCHITECTURE GOVERNANCE — pages/** and features/**
   *
   * These rules enforce the Design System contract:
   *   • Dialog/DialogContent must come from AdaptiveDialog (not raw shadcn)
   *   • console.log is production-forbidden (use console.warn/error only)
   *   • No debugger statements
   * ══════════════════════════════════════════════════════════════════════════ */
  {
    files: ["src/pages/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    rules: {
      // ── Architecture Lock: ban raw Dialog/DialogContent in page/feature layer
      // Pages MUST use AdaptiveDialog + AdaptiveDialogContent from @/components/adaptive.
      // DialogHeader / DialogTitle / DialogFooter / DialogDescription are allowed
      // as sub-components inside AdaptiveDialogContent.
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "@/components/ui/dialog",
            importNames: ["Dialog", "DialogContent"],
            message:
              "⛔ Architecture Lock: use AdaptiveDialog + AdaptiveDialogContent from " +
              "'@/components/adaptive' in pages and features. " +
              "DialogHeader/Title/Footer/Description from '@/components/ui/dialog' are still allowed.",
          },
        ],
      }],

      // ── Console.log ban in application code
      // Use console.warn/error for genuine warnings; use Sentry for production errors.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  /* ══════════════════════════════════════════════════════════════════════════
   * EXCEPTION: main.tsx and service-worker files may use console.log
   * (SW registration log, dev error overlays)
   * ══════════════════════════════════════════════════════════════════════════ */
  {
    files: ["src/main.tsx", "src/sw.ts", "public/sw.js"],
    rules: {
      "no-console": "off",
    },
  },
);
