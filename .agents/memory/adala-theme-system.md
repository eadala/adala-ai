---
name: Adala Theme System
description: Advanced theme builder with 12 Arabic presets, light/dark mode, and landing page theming.
---

## Architecture

### Backend: `themeBuilder.ts`
- 12 named presets: 6 dark (أزرق داكن, ليلي ذهبي, فيروزي داكن, بنفسجي ملكي, فحمي رمادي, أخضر قضائي) + 6 light (أبيض نقي, أبيض ذهبي, رملي دافئ, أزرق صباحي, أخضر نعناعي, رمادي ناعم)
- Routes: GET /theme-builder/tokens (auth), GET /theme-builder/public-tokens (public, for landing page), POST /theme-builder/save, DELETE /theme-builder/reset, GET /theme-builder/presets
- `office_themes` DB table (id, user_id, name, tokens JSONB, is_active, scope, updated_at)
- `scope` field: "platform" | "landing" | "both" — controls what gets themed

### Frontend: `office-theme-provider.tsx`
- `getLuminance(hex)` helper for contrast detection (WCAG relative luminance)
- `applyDesignTokens()` sets ALL CSS vars on `:root` inline styles
- KEY FIX: `--primary-foreground` is auto-computed from accent luminance (not text color)
- Adds `data-theme="light"` or `"dark"` to `<html>` based on background luminance
- `applyLandingVars()` injects `--lp-*` CSS vars + `<style id="lp-theme-vars">` tag for landing page
- Landing CSS vars: --lp-bg, --lp-accent, --lp-accent-end, --lp-accent-text, --lp-text, --lp-text-muted, --lp-text-subtle, --lp-navbar-bg, --lp-navbar-border, --lp-card-bg, --lp-card-border, --lp-section-bg
- Attributes: `data-lp-theme="light"/"dark"` on `<html>`

### Frontend: `index.css` (additions at bottom)
- `html[data-theme="light"] .lp-t { color: var(--lp-text) !important; }`
- `html[data-theme="light"] .lp-tm { ... }` (muted text)
- `html[data-theme="light"] .lp-ts { ... }` (subtle text)
- `.lp-nav-link`, `.lp-section-border`, `.lp-stat-label`, `.lp-trust-tag` CSS helpers

### Frontend: `theme-builder.tsx`
- `previewMode` state: "platform" | "landing" — toggle in top bar
- `LandingCanvas` component: full landing page preview with theme tokens
- Presets tab shows two categories: 🌙 ثيمات داكنة / ☀️ ثيمات فاتحة
- Scope selector in presets tab (3 buttons: الكل / المنصة / الرئيسية)
- `scope` field in DesignTokens interface and DEFAULT_TOKENS

### Frontend: `landing.tsx`
- Main wrapper: `background: "var(--lp-bg, #080F1E)"`
- Navbar: `background: "var(--lp-navbar-bg, rgba(8,15,30,0.95))"`
- Accent buttons use CSS vars: `var(--lp-accent)`, `var(--lp-accent-end)`, `var(--lp-accent-text)`
- Text classes: `lp-t` (main), `lp-tm` (muted), `lp-ts` (subtle), `lp-nav-link` (nav links), `lp-stat-label`, `lp-trust-tag`

## White Theme Fix

**Why:** The primary-foreground bug: old code used `c.text` for `--primary-foreground`, which is dark for light themes, causing dark-text-on-dark-button. Fixed: `--primary-foreground` is computed from accent luminance.

**How to apply:** Use `getLuminance(accent) > 0.35` → light accent = dark text; dark accent = white text on buttons.

## Light Mode Principle

- Background luminance > 0.35 → `data-theme="light"` on html
- CSS `.lp-t` class overrides `text-white` only when `html[data-theme="light"]`
- Sidebar inherits dark text from `c.text` color token
- Light sidebar (`#F1F5F9`) + dark text (`#0F172A`) = fully readable white theme
