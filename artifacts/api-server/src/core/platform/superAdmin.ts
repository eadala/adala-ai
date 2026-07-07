/**
 * Canonical super-admin identity check — single source of truth.
 * Used by tenant kernel, auth middleware, and platform modules.
 */
import { createClerkClient } from "@clerk/express";

let _saClerk: ReturnType<typeof createClerkClient> | null = null;

function getSAClerk() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is required for super-admin checks");
  if (!_saClerk) _saClerk = createClerkClient({ secretKey });
  return _saClerk;
}

export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? process.env.PLATFORM_OWNER_EMAIL ?? "";
  const saEmails = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  try {
    const clerk = getSAClerk();
    const user = await clerk.users.getUser(userId);
    const email = (user.emailAddresses[0]?.emailAddress ?? "").toLowerCase();
    return saEmails.includes(email) || user.publicMetadata?.role === "super_admin";
  } catch {
    return false;
  }
}
