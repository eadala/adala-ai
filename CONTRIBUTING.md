# Contributing to عدالة AI

دليل المساهمة الرسمي للمشروع. **GitHub هو المصدر الوحيد للحقيقة (Single Source of Truth).**

---

## Git Flow المعتمد

```
main          ← Stable Production only
develop       ← Integration branch (all PRs merge here first)
feature/*     ← New features
hotfix/*      ← Urgent production fixes (branches from main)
release/*     ← Release preparation (branches from develop)
```

## قواعد إلزامية

- ❌ لا تُطوّر مباشرةً على `main` أو `develop`
- ❌ لا تستخدم `git push --force` على main/develop
- ✅ كل عمل جديد يبدأ من `develop`
- ✅ كل PR يمر عبر GitHub Actions قبل الدمج
- ✅ Squash & Merge لـ feature branches

## خطوات العمل

### 1. ابدأ من develop

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### 2. Conventional Commits

```
feat(cases):     إضافة خاصية جديدة للقضايا
fix(auth):       إصلاح خطأ في المصادقة
docs(api):       تحديث توثيق API
refactor(hr):    إعادة هيكلة وحدة HR
perf(db):        تحسين أداء قاعدة البيانات
test(billing):   إضافة اختبارات نظام الفوترة
chore(deps):     تحديث الاعتماديات
security(auth):  تعزيز أمان المصادقة
```

### 3. افتح Pull Request

- Base: `develop` (وليس `main`)
- يُوضَح في الوصف: ماذا؟ لماذا؟ كيف تختبر؟
- استخدم PR Template الموجود
- CI يجب أن يمر (جميع الـ 10 gates)

### 4. بعد الاعتماد

```bash
# تنظيف branch محلياً
git checkout develop
git pull origin develop
git branch -d feature/your-feature-name
```

## AI Agents (Replit Agent / Codex / Cursor)

- كل agent يعمل على feature branch مستقل
- Replit checkpoints تبقى في replit-agent branch (لا تُدمج مباشرةً في main)
- التغييرات الحقيقية تُنقل عبر PR من feature branch

## Branch Naming

```
feature/document-center
feature/legal-ai-v2
feature/hr-payroll
fix/stripe-webhook
hotfix/prod-auth-crash
release/v2.1.0
```

## Code Standards

- TypeScript: لا أخطاء (`tsc --noEmit`)
- ESLint: لا أخطاء (warnings مسموحة مؤقتاً)
- Bundle gzip: أقل من 4,096 KB
- لا secrets في الكود مطلقاً

## للتواصل

eadala1000@gmail.com
