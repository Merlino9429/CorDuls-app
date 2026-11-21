/* Service worker di Cor Duls: notifiche web. Volutamente senza cache, così gli aggiornamenti arrivano subito. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch (_e) { msg = { title: 'Cor Duls', body: event.data && event.data.text() }; }
  const data = msg.data || {};
  event.waitUntil(self.registration.showNotification(msg.title || 'Cor Duls', {
    body: msg.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: data.orderId ? 'order-' + data.orderId : undefined,
    data,
  }));
});

function targetUrl(data) {
  if (data && data.orderId) return '/order/' + data.orderId;
  if (data && data.type === 'loyalty') return '/tessera';
  if (data && data.type === 'broadcast') return '/promo';
  return '/';
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(targetUrl(event.notification.data), self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        if ('navigate' in w) await w.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
