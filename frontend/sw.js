/**
 * Service Worker - Push Notification Handler
 * 
 * Bu dosya:
 * - Push event'lerini yakalar ve bildirim gösterir
 * - Notification click event'lerini handle eder
 * - Bildirime tıklandığında siteyi açar ve mesajı query parameter olarak gönderir
 */

// Service Worker version (cache busting için)
const CACHE_VERSION = 'v1';

/**
 * Service Worker install event
 * İlk kurulumda çalışır
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  // Service Worker'ı hemen aktif et (skipWaiting)
  self.skipWaiting();
});

/**
 * Service Worker activate event
 * Service Worker aktif olduğunda çalışır
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  // Tüm client'larda kontrolü al (claim)
  event.waitUntil(
    clients.claim().then(() => {
      console.log('Service Worker activated and claiming clients');
    })
  );
});

/**
 * Push event handler
 * Server'dan push geldiğinde bu fonksiyon çalışır
 */
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  // Push data'sını parse et
let notificationData = {
    title: 'Hello ❤️',
    body: 'You have a new message!',
    icon: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f497.png',
    badge: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f49c.png',
    data: {
      url: '/'
    }
  };
  
  // Eğer push data varsa kullan
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        data: data.data || notificationData.data,
        tag: data.tag || 'default', // Aynı tag'li bildirimler replace edilir
        requireInteraction: data.requireInteraction || false
      };
    } catch (e) {
      // JSON parse edilemezse text olarak al
      notificationData.body = event.data.text() || notificationData.body;
    }
  }
  
  // Bildirimi göster
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      vibrate: [200, 100, 200], // Vibrasyon pattern (mobile)
      actions: [
        {
          action: 'open',
          title: 'Aç'
        },
        {
          action: 'close',
          title: 'Kapat'
        }
      ]
    })
  );
});

/**
 * Notification click event handler
 * Kullanıcı bildirime tıkladığında bu fonksiyon çalışır
 */
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  // Notification'ı kapat
  event.notification.close();
  
  // Action kontrolü
  const action = event.action;
  
  if (action === 'close') {
    // Kapat action'ı seçildiyse sadece kapat
    return;
  }
  
  // Bildirim data'sından URL'i al
  // Eğer data.url varsa onu kullan, yoksa default URL
  const urlToOpen = event.notification.data?.url || '/';
  
  // Mesajı query parameter olarak ekle
  const message = event.notification.body || '';
  const targetUrl = `/chat?msg=${encodeURIComponent(message)}`;
  
  // Açık pencereleri kontrol et
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Eğer site zaten açıksa, o pencereyi focus et ve navigate et
      for (const client of clientList) {
        if (client.url === self.location.origin && 'focus' in client) {
          // Mesajı client'a gönder
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            url: targetUrl,
            message: message
          });
          
          return client.focus().then(() => {
            // URL'i navigate et
            return client.navigate(targetUrl);
          });
        }
      }
      
      // Eğer site açık değilse yeni pencere aç
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

/**
 * Notification close event handler (opsiyonel)
 * Bildirim kapatıldığında çalışır
 */
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  // İstatistik toplama veya analytics için kullanılabilir
});

/**
 * Message event handler
 * Client'tan Service Worker'a mesaj geldiğinde çalışır
 */
self.addEventListener('message', (event) => {
  console.log('Message received in service worker:', event.data);
  
  // Eğer skipWaiting mesajı gelirse
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Eğer test notification mesajı gelirse
  if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification('Test Bildirimi', {
      body: 'Bu bir test bildirimidir!',
      icon: '/icon-192x192.png',
      tag: 'test'
    });
  }
});

/**
 * Background sync event handler (opsiyonel)
 * Offline durumda task'ları senkronize etmek için
 */
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  // Örnek: Offline'da subscription gönderilemediyse tekrar dene
  if (event.tag === 'sync-subscription') {
    event.waitUntil(
      // Sync logic buraya gelecek
      Promise.resolve()
    );
  }
});

/**
 * Error handler
 * Service Worker hatalarını logla
 */
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
});

/**
 * Unhandled rejection handler
 */
self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in Service Worker:', event.reason);
});
