import { Router } from "express";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI } from "./aiChat";

const router = Router();

const SYSTEM_PROMPT = `أنت نظام توليد واجهات المستخدم لمنصة عدالة القانونية.
مهمتك: تحليل الوصف النصي وتوليد JSON Schema لبناء صفحة واجهة مستخدم.

قواعد صارمة:
- أرجع JSON فقط. بدون شرح. بدون markdown.
- اتبع البنية التالية بدقة.
- كل النصوص بالعربية.
- استخدم بيانات واقعية ومنطقية تناسب السياق القانوني.

البنية المطلوبة:
{
  "page": "عنوان الصفحة",
  "layout": "dashboard|form|report|landing",
  "description": "وصف مختصر للصفحة",
  "components": [
    COMPONENT_LIST
  ]
}

أنواع المكونات المتاحة:

{ "type": "hero", "title": "...", "subtitle": "...", "badge": "...", "action": "..." }

{ "type": "stats", "items": [
  { "label": "...", "value": "...", "icon": "scale|users|file|money|clock|check", "trend": "+12%", "trendUp": true }
]}

{ "type": "table", "title": "...", "columns": ["col1","col2","col3"], "rows": [["val","val","val"]], "source": "cases|clients|contracts" }

{ "type": "card", "title": "...", "content": "...", "variant": "info|success|warning|danger", "icon": "scale|alert|check|info" }

{ "type": "timeline", "title": "...", "items": [{ "label": "...", "date": "...", "status": "done|current|pending" }] }

{ "type": "form", "title": "...", "fields": [{ "label": "...", "type": "text|select|date|textarea|number", "required": true, "placeholder": "..." }], "submitLabel": "..." }

{ "type": "section", "title": "...", "columns": 2, "children": [COMPONENT, COMPONENT] }

{ "type": "alert", "title": "...", "message": "...", "variant": "info|warning|success|danger" }

قواعد التصميم:
- صفحة dashboard: ابدأ بـ hero ثم stats ثم table أو cards
- صفحة form: ابدأ بـ hero ثم form واحد رئيسي
- صفحة report: stats ثم tables ثم timeline
- أضف من 3 إلى 7 مكونات حسب الطلب
- ملأ جدول rows بـ 3 صفوف من بيانات تجريبية مناسبة للموضوع`;

const TEMPLATES = [
  {
    id: "case-dashboard",
    title: "لوحة القضايا",
    description: "إحصائيات وجدول وتحليل",
    prompt: "صفحة لوحة تحكم القضايا تحتوي على إحصائيات عدد القضايا والعملاء والإيرادات، وجدول بأحدث القضايا مع حالاتها، وتسليط الضوء على القضايا العاجلة",
    icon: "scale",
  },
  {
    id: "client-profile",
    title: "ملف العميل",
    description: "بيانات وقضايا وفواتير",
    prompt: "صفحة ملف عميل كامل تحتوي على بياناته الشخصية ومعلومات التواصل وقائمة قضاياه النشطة والمنتهية وسجل الفواتير والمدفوعات",
    icon: "users",
  },
  {
    id: "invoice-form",
    title: "نموذج فاتورة",
    description: "نموذج إنشاء فاتورة قانونية",
    prompt: "نموذج إنشاء فاتورة قانونية يحتوي على حقول: اسم العميل والقضية ونوع الخدمة والمبلغ وتاريخ الاستحقاق وملاحظات إضافية",
    icon: "file",
  },
  {
    id: "financial-report",
    title: "تقرير مالي",
    description: "قائمة الدخل والمصاريف",
    prompt: "تقرير مالي شهري يحتوي على إحصائيات الإيرادات والمصاريف وصافي الربح، وجدول بأكبر العملاء من حيث الإيرادات، وتايم لاين بأهم الأحداث المالية",
    icon: "money",
  },
  {
    id: "contract-tracker",
    title: "متابعة العقود",
    description: "جدول العقود ومواعيدها",
    prompt: "صفحة متابعة العقود تحتوي على إحصائيات عدد العقود النشطة والمنتهية والمقاربة للانتهاء، وجدول بالعقود مع تواريخها ومبالغها، وتنبيهات للعقود التي تنتهي خلال 30 يوم",
    icon: "check",
  },
  {
    id: "team-tasks",
    title: "مهام الفريق",
    description: "لوحة توزيع المهام",
    prompt: "لوحة مهام الفريق القانوني تحتوي على إحصائيات المهام المنجزة والمعلقة والمتأخرة، وجدول بالمهام الحالية مع المسؤول عنها وتاريخ الاستحقاق، وتسليط الضوء على الأولويات العالية",
    icon: "clock",
  },
];

router.get("/ui-builder/templates", requireAuthWithTenant, async (_req, res) => {
  res.json({ templates: TEMPLATES });
});

router.post("/ui-builder/generate", requireAuthWithTenant, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ error: "الوصف قصير جداً" });
    }

    const { reply } = await callAI(
      SYSTEM_PROMPT,
      `اصنع واجهة مستخدم لـ: ${prompt.trim()}`,
    );

    let schema: any;
    try {
      const cleaned = reply
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();
      schema = JSON.parse(cleaned);
    } catch {
      return res.status(422).json({ error: "فشل توليد المخطط — حاول مرة أخرى" });
    }

    res.json({ schema });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "خطأ في الخادم" });
  }
});

export default router;
