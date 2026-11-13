/**
 * Canonical office id from an EventBus payload.
 * Never invent "default" / "platform" — callers must fail closed.
 */
export function resolveEventOfficeId(event: {
  officeId?: string | null;
  data?: Record<string, unknown> | null;
}): string | null {
  const fromData = event.data ?? {};
  const candidates = [
    event.officeId,
    typeof fromData.officeId === "string" ? fromData.officeId : null,
    typeof fromData.office_id === "string" ? fromData.office_id : null,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() && c !== "default" && c !== "platform") {
      return c;
    }
  }
  return null;
}

export function isRealOfficeId(officeId: string | null | undefined): officeId is string {
  return typeof officeId === "string" && !!officeId.trim() && officeId !== "default" && officeId !== "platform";
}
