/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; authFetch migration */
/**
 * usePushNotifications — manages browser push subscription lifecycle
 */
import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/authFetch";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const SW_PATH = "/sw.js"; // service worker at root scope

type State = "unsupported" | "denied" | "prompt" | "subscribed" | "loading";

export function usePushNotifications() {
  const [state,      setState]      = useState<State>("loading");
  const [error,      setError]      = useState<string | null>(null);

  /* Check current state on mount */
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    const perm = Notification.permission;
    if (perm === "denied") { setState("denied"); return; }
    checkSubscription();
  }, []);

  async function checkSubscription() {
    try {
      const reg  = await navigator.serviceWorker.ready;
      const sub  = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "prompt");
    } catch {
      setState("prompt");
    }
  }

  /* Subscribe */
  const subscribe = useCallback(async (officeId = "default") => {
    setError(null);
    setState("loading");
    try {
      /* Get VAPID public key */
      const keyRes = await fetch(`${BASE}/api/push/vapid-public-key`);
      if (!keyRes.ok) throw new Error("فشل جلب مفتاح VAPID");
      const { publicKey } = await keyRes.json();

      /* Register SW */
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
      await navigator.serviceWorker.ready;

      /* Request permission */
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("denied");
        setError("لم يتم منح إذن الإشعارات");
        return false;
      }

      /* Subscribe via PushManager */
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });

      /* Send to server */
      const resp = await authFetch(`${BASE}/api/push/subscribe`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ subscription: sub.toJSON(), officeId }),
      });
      if (!resp.ok) throw new Error("فشل حفظ الاشتراك");

      setState("subscribed");
      return true;
    } catch (e: any) {
      setError(e.message);
      setState("prompt");
      return false;
    }
  }, []);

  /* Unsubscribe */
  const unsubscribe = useCallback(async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await authFetch(`${BASE}/api/push/unsubscribe`, {
          method:  "DELETE",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("prompt");
    } catch (e: any) {
      setError(e.message);
      setState("subscribed");
    }
  }, []);

  /* Test push */
  const sendTest = useCallback(async (officeId = "default") => {
    const r = await authFetch(`${BASE}/api/push/test`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ officeId }),
    });
    return r.json();
  }, []);

  return { state, error, subscribe, unsubscribe, sendTest };
}

/* Convert VAPID base64 key → Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw      = atob(base64);
  const arr      = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
