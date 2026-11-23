export class TenantContext {
  readonly officeId: string;
  readonly userId: string;
  readonly role: string;
  private readonly createdAt: Date;

  constructor(officeId: string, userId: string, role = "member") {
    if (!officeId) throw new Error("MISSING_TENANT_CONTEXT");
    if (!userId)   throw new Error("MISSING_USER_CONTEXT");
    this.officeId  = officeId;
    this.userId    = userId;
    this.role      = role;
    this.createdAt = new Date();
  }

  validateAccess(requestOfficeId: string): void {
    if (requestOfficeId !== this.officeId) {
      throw new Error(`TENANT_ISOLATION_VIOLATION: expected=${this.officeId} got=${requestOfficeId}`);
    }
  }

  isAdmin(): boolean {
    return ["admin", "owner", "platform_admin"].includes(this.role);
  }

  toLog() {
    return { officeId: this.officeId, userId: this.userId, role: this.role, at: this.createdAt };
  }
}
