import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setAuthReady, setClerkTokenGetter } from "@/lib/authFetch";

/**
 * Syncs Clerk session into the shared authFetch helper.
 * Must render inside <ClerkProvider>.
 */
export function ClerkAuthFetchBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    const ready = Boolean(isLoaded && isSignedIn);
    setAuthReady(ready);
    setClerkTokenGetter(ready ? () => getToken() : null);

    return () => {
      setClerkTokenGetter(null);
      setAuthReady(false);
    };
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
