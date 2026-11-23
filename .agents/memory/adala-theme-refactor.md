---
name: Adala Theme Refactor
description: Complete platform theme — current is Legal Blue/White with IBM Plex Sans Arabic; key files and pitfalls
---

# Current Theme: Legal Blue (#1E3A8A) + Clean White (IBM Plex Sans Arabic)

## Core vars (index.css :root)
- --primary: 221 63% 33% (#1E3A8A legal blue)
- --primary-foreground: 0 0% 100%
- --background: 210 40% 98% (#F8FAFC soft off-white)
- --card: 0 0% 100% (pure white)
- --sidebar: 0 0% 100% (pure white — no color tint)
- --sidebar-primary: 221 63% 33%
- --sidebar-accent: 210 40% 96%
- --muted-foreground: 215 16% 47% (#64748B)
- --destructive: 0 72% 51% (#DC2626)
- Font: 'IBM Plex Sans Arabic' (was Cairo)

## Source files
- index.css :root — all CSS vars
- index.html — Google Fonts link (IBM Plex Sans Arabic 300-700)
- account-menu.tsx — GOLD const = "#1E3A8A"
- layout.tsx — plan trial banner uses emerald (not blue)

## Design Control Panel
- Tab id "design" added to TABS in constants.ts (Palette icon)
- DesignCenterTab.tsx in features/super-admin/tabs/ — lazy wrapper for ThemeBuilderPage
- super-admin.tsx registers it as lazy Suspense TabsContent

## History
1. Original: Dark Navy/Gold theme (#1A2744 bg, #C9A84C gold)
2. Refactor 1: White/Blue SaaS (#2563EB primary) — "Professional Blue & White"
3. Refactor 2: White/Teal (#1a9c6e primary) — brief intermediate
4. Current (final): Legal Blue + IBM Plex Sans Arabic — matches UI Kit spec

## Critical pitfall
The :root CSS vars must be verified in index.css after each change.
The scratchpad and memory can lag behind actual file state.

## Intentionally preserved dark themes
- office-store.tsx + office-service-detail.tsx: public marketplace (bg-[#080d1a])
- floating-copilot.tsx: dark popup overlay
- adoul-widget.tsx: dark chat widget
- document-print-template.tsx: print template
