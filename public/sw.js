/* Service worker for the public driver page: receives Web Push from the
 * server and shows it as a system notification. No fetch handler — the page
 * itself is never cached or intercepted. Registered with scope "/driver/". */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Fameline Queue';
  const options = {
    body: data.body || '',
    tag: data.tag || 'fameline-queue',
    renotify: true,
    requireInteraction: Boolean(data.requireInteraction),
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : [300, 100, 300],
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.indexOf(url) === 0 && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
