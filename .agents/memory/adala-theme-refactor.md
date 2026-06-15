---
name: Adala Theme Refactor
description: Complete platform theme change from Dark Navy/Gold to Professional White/Blue; key files and pitfalls
---

# Theme Refactor: Dark Navy/Gold → Professional White/Blue

## Core vars (index.css :root)
- --primary: 221 83% 53% (#2563EB)
- --primary-foreground: 0 0% 100%
- --sidebar: 210 40% 98% (off-white)
- --sidebar-foreground: 222 47% 11% (dark text)
- --sidebar-accent: 214 32% 94%
- --secondary/accent: 214 32% 91% (light slate)
- --ring: 221 83% 53%

## Critical pitfall
The :root CSS vars were NOT updated by the previous session. Always verify index.css :root 
actually has --primary: 221 83% 53% and --sidebar: 210 40% 98%. The scratchpad lied.

## account-menu.tsx
- Default localStorage theme is now "light" (was "dark")
- GOLD constant = "#2563EB"

## Intentionally preserved dark themes
- office-store.tsx + office-service-detail.tsx: public marketplace (bg-[#080d1a])
- floating-copilot.tsx: dark popup overlay
- adoul-widget.tsx: dark chat widget
- document-print-template.tsx: print template

## Pattern replacements applied
- bg-sidebar → bg-card (in dashboard pages)
- border-sidebar-border → border-border
- text-white (on light bg) → text-foreground / text-sidebar-foreground
- bg-white/5 / border-white/10 → bg-muted/30 / border-border (light glass)
- #C9A84C gold → #2563EB blue (50+ files)
- #1A2744/#243058/#2D3D6B → light equivalents

**Why:** Platform rebranding from dark/gold legal brand to modern SaaS white/blue (Stripe/Linear/Notion/Clio style)
