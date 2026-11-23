## ماذا يفعل هذا الـ PR؟

<!-- وصف موجز وواضح للتغييرات -->

## لماذا هذا التغيير؟

<!-- المشكلة التي يحلّها أو الميزة التي يُضيفها -->

## نوع التغيير

- [ ] `feat` — ميزة جديدة
- [ ] `fix` — إصلاح خطأ
- [ ] `refactor` — إعادة هيكلة بدون تغيير وظيفي
- [ ] `perf` — تحسين أداء
- [ ] `docs` — توثيق فقط
- [ ] `test` — اختبارات فقط
- [ ] `chore` — صيانة/اعتماديات
- [ ] `security` — تعزيز أمان
- [ ] `hotfix` — إصلاح عاجل لـ production

## اختبارات

- [ ] TypeScript: `pnpm typecheck` → 0 errors
- [ ] ESLint: `pnpm lint` → 0 errors
- [ ] Build: `pnpm build` → نجاح
- [ ] Bundle: حجم gzip أقل من 4,096 KB
- [ ] اختبرت التغيير يدوياً في dev environment
- [ ] لا توجد secrets أو credentials في الكود

## Tenant Isolation

- [ ] جميع queries تحتوي `office_id` حيث مطلوب
- [ ] Routes الجديدة محمية بـ `requireAuthWithTenant()`
- [ ] لا تسريب بيانات بين tenants

## Checklist

- [ ] PR يستهدف `develop` (وليس `main`)
- [ ] Commit messages تتبع Conventional Commits
- [ ] لا Merge Commits غير ضرورية
- [ ] CODEOWNERS مُبلَّغون
- [ ] CHANGELOG.md محدَّث (لـ features/fixes كبيرة)

## صور/فيديو (اختياري)

<!-- أضف screenshots إذا كانت هناك تغييرات UI -->

## مخاطر محتملة

<!-- أي آثار جانبية أو مخاطر يجب أن يعرفها المراجع -->
