// Réception des notifications et ouverture de la bonne fiche au toucher.
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = { title: 'Alipto', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Alipto', {
    body: d.body || '', tag: d.tag, renotify: !!d.tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.postMessage({ type: 'open', url }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
