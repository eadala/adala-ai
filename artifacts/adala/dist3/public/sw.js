/* عدالة AI — Service Worker v1 */
const CACHE = "adala-sw-v1";

/* ── Push event ── */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: "عدالة AI", body: event.data.text() }; }

  const { title = "عدالة AI", body = "", url = "/", icon, badge, tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  icon  ?? "/logo.svg",
      badge: badge ?? "/logo.svg",
      tag:   tag   ?? "adala-event",
      dir:   "rtl",
      lang:  "ar",
      vibrate: [200, 100, 200],
      data:  { url },
      actions: [
        { action: "open",    title: "فتح" },
        { action: "dismiss", title: "إغلاق" },
      ],
    })
  );
});

/* ── Notification click ── */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

/* ── Install / activate ── */
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
