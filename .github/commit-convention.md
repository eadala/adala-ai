# Conventional Commits — دليل كتابة رسائل الـ Commit

## الصيغة

```
type(scope): description

[optional body]

[optional footer]
```

## الأنواع المعتمدة

| النوع | متى يُستخدم |
|---|---|
| `feat` | ميزة جديدة |
| `fix` | إصلاح خطأ |
| `docs` | توثيق فقط |
| `refactor` | إعادة هيكلة بدون تغيير وظيفي |
| `perf` | تحسين أداء |
| `test` | اختبارات فقط |
| `chore` | صيانة/dependencies |
| `security` | تعزيز أمان |
| `hotfix` | إصلاح عاجل لـ production |
| `release` | تجهيز إصدار |

## النطاقات (Scopes) المعتمدة

```
cases, clients, documents, invoices, payroll, hr, auth,
billing, ai, storage, messages, calendar, bankruptcy,
legal, analytics, org, admin, settings, portal, api, db
```

## أمثلة

```bash
feat(cases): إضافة تصدير القضايا إلى PDF
fix(auth): إصلاح انتهاء صلاحية token في صفحة المستندات
security(upload): رفض ملفات PHP في uploadGuard
perf(db): إضافة index على cases.office_id
docs(api): توثيق endpoints الإفلاس
chore(deps): تحديث @clerk/react إلى v6.12
refactor(billing): استخراج planCms.ts من billing.ts
hotfix(stripe): إصلاح عدم تعرف status check على Replit Connectors
```

## BREAKING CHANGES

```bash
feat(api)!: تغيير schema رد /api/cases

BREAKING CHANGE: حقل case_number أُعيد تسميته إلى caseNumber
```

## القواعد

1. الوصف: فعل مضارع، عربي أو إنجليزي
2. لا حرف كبير في البداية
3. لا نقطة في النهاية
4. أقل من 72 حرفاً
5. BREAKING CHANGE دائماً في footer أو بـ `!`
