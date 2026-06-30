/**
 * Case Service — المصدر الوحيد للحقيقة (Single Source of Truth)
 * ───────────────────────────────────────────────────────────────
 * القواعد الصارمة:
 *  ✅ كل الـ business logic هنا
 *  ✅ يستخدم CaseRepository للـ DB
 *  ✅ يُطلق أحداث CaseEvents
 *  ❌ لا DB مباشر هنا
 *  ❌ لا req/res هنا (Controller's responsibility)
 */

import { CaseRepository }        from "./case.repository";
import { CaseEvents }             from "./case.events";
import { auditLog }               from "../lib/auditLogger";
import { notifyTelegramCaseStatus } from "../modules/integrations/telegram";
import type { CreateCaseInput, UpdateCaseInput, CaseFilters, CaseEntity } from "./case.entity";
import { STATUS_LABELS }          from "./case.entity";

export class CaseService {
  private repo: CaseRepository;

  constructor(
    private readonly tenantId: string,
    private readonly userId?: string,
  ) {
    this.repo = new CaseRepository(tenantId);
  }

  /* ── List ── */
  async listCases(filters?: CaseFilters): Promise<CaseEntity[]> {
    return this.repo.findAll(filters);
  }

  /* ── Count (for pagination totals) ── */
  async countCases(filters?: Pick<CaseFilters, "status" | "caseType" | "search" | "assignedUserId">): Promise<number> {
    return this.repo.countAll(filters);
  }

  /* ── Stats ── */
  async getStats() {
    return this.repo.getStats();
  }

  /* ── Get one ── */
  async getCase(id: string): Promise<CaseEntity> {
    const c = await this.repo.findById(id);
    if (!c) throw Object.assign(new Error("القضية غير موجودة"), { statusCode: 404 });
    return c;
  }

  /* ── Create ── */
  async createCase(data: CreateCaseInput): Promise<CaseEntity> {
    if (!data.title?.trim()) throw Object.assign(new Error("العنوان مطلوب"), { statusCode: 400 });
    const created = await this.repo.create({ ...data, createdBy: this.userId });
    CaseEvents.emit("CASE_CREATED", created);
    auditLog({ userId: this.userId, action: "create", resource: "cases", resourceId: created.id, details: created.title }).catch(() => {});
    return created;
  }

  /* ── Update ── */
  async updateCase(id: string, data: UpdateCaseInput): Promise<{ before: CaseEntity; after: CaseEntity }> {
    const before = await this.getCase(id);
    const updated = await this.repo.update(id, data);
    if (!updated) throw Object.assign(new Error("فشل التحديث"), { statusCode: 500 });

    /* Side-effects: WhatsApp / Telegram notification on status change */
    if (data.status && data.status !== before.status) {
      notifyTelegramCaseStatus(updated as any).catch(() => {});
      this.notifyWhatsApp(updated).catch(() => {});
    }

    CaseEvents.emit("CASE_UPDATED", { before, after: updated });
    auditLog({ userId: this.userId, action: "update", resource: "cases", resourceId: id, details: updated.title }).catch(() => {});
    return { before, after: updated };
  }

  /* ── Soft Delete (default) ── */
  async deleteCase(id: string): Promise<void> {
    await this.getCase(id);
    await this.repo.softDelete(id);
    CaseEvents.emit("CASE_DELETED", { id });
    auditLog({ userId: this.userId, action: "soft_delete", resource: "cases", resourceId: id }).catch(() => {});
  }

  /* ── Hard Delete (super_admin only) ── */
  async hardDeleteCase(id: string): Promise<void> {
    await this.repo.hardDelete(id);
    auditLog({ userId: this.userId, action: "hard_delete", resource: "cases", resourceId: id }).catch(() => {});
  }

  /* ── WhatsApp notification (private helper) ── */
  private async notifyWhatsApp(c: CaseEntity): Promise<void> {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    try {
      const settingsR = await db.execute(sql`SELECT * FROM whatsapp_settings WHERE office_id = ${this.tenantId} LIMIT 1`);
      const settings: any = ((settingsR as any).rows ?? settingsR)?.[0];
      if (!settings?.enabled) return;

      const clientR = await db.execute(sql`SELECT phone FROM clients WHERE full_name = ${c.clientName} AND phone IS NOT NULL LIMIT 1`);
      const phone: string = ((clientR as any).rows ?? clientR)?.[0]?.phone;
      if (!phone) return;

      const statusLabel = STATUS_LABELS[c.status] ?? c.status;
      const message = `السلام عليكم،\nتم تحديث حالة قضيتكم "${c.title}" إلى: ${statusLabel}.\nشكراً لثقتكم.`;

      if (settings.provider === "meta" && settings.meta_token && settings.meta_phone_id) {
        await fetch(`https://graph.facebook.com/v18.0/${settings.meta_phone_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${settings.meta_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } }),
        });
      }
    } catch { /* non-fatal */ }
  }
}
