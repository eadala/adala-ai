# Changelog — عدالة AI

جميع التغييرات الجوهرية موثّقة هنا.
التنسيق مبني على [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
الإصدارات تتبع [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Git Flow احترافي مع branch protection
- CODEOWNERS, CONTRIBUTING.md, SECURITY.md
- CI/CD شامل (10 quality gates)
- PR template + Issue templates
- إصلاح systemStatus.ts لـ Stripe/Storage عبر Replit Connectors

---

## [2.0.0] — 2026-07-02

### 🚀 P0 Production Release

#### Added
- **Legal Copilot v2** — Intent Engine + Tool Registry + Memory
- **Bankruptcy Module** — 11 جدول، دورة حياة كاملة للقضايا
- **Financial Core** — Stripe + Moyasar + Checkout.com + Double-Entry ERP
- **Enterprise HR** — roles/memberships/workflows/audit
- **AI Hub** — 7 صفحات AI في واجهة موحّدة
- **Document Center** — 14 route، Object Storage integration
- **Client Acquisition Portal** — Stripe checkout → auto-case
- **Operating Centers** — 7 مراكز عمل قابلة للطي
- **Go-Live Security Hardening** — 610/671 routes محمية
- **Tenant Isolation** — 17/17 tables مع office_id
- **Upload Guard** — 8 layers security
- **Prompt Injection Guard** — 25 patterns
- **Theme System** — 12 Arabic presets
- **Multi-tenant RBAC** — requirePermission() engine

#### Security
- CSP شامل، HSTS، X-Frame-Options
- Rate limiting per endpoint
- Fake JWT rejection
- SQL Injection prevention layer

#### Performance
- Bundle gzip: 1,649 KB (40% of 4,096 KB budget)
- TTFB: 320ms
- API avg: 330ms

---

## [1.0.0] — 2026-01-01

### Initial Release
- Core case management
- Client portal
- Basic AI integration
- Clerk authentication
- PostgreSQL database
