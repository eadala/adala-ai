/* eslint-disable react-hooks/exhaustive-deps -- pre-existing lint debt; authFetch migration */
/**
 * useLoginTracker — fires once when the user successfully signs in,
 * and records the login event to the backend with device info.
 *
 * Usage: call this hook once inside a component that is always
 * mounted for authenticated users (e.g. the Layout component).
 */
import { useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useLoginTracker() {
  const { isSignedIn, user } = useUser();
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;

    // Only track once per user per page load (not on every re-render)
    if (trackedRef.current === user.id) return;
    trackedRef.current = user.id;

    const payload = {
      email:     user.primaryEmailAddress?.emailAddress ?? null,
      fullName:  user.fullName ?? (user.firstName ?? "") + " " + (user.lastName ?? ""),
      status:    "success",
      sessionId: null,
    };

    // Fire-and-forget — don't block the UI
    authFetch(`${BASE}/api/security/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    }).catch(() => {/* silent — non-critical */});
  }, [isSignedIn, user?.id]);
}
