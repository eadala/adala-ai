import { useAuth } from "@clerk/react";
import { isAuthReady } from "@/lib/authFetch";

/**
 * React Query `enabled` gate for protected workspace requests.
 * Prefer the live Clerk hook; fall back to bridge module flag.
 */
export function useAuthReady(): boolean {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded) return Boolean(isSignedIn);
  return isAuthReady();
}
