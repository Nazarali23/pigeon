/**
 * Frontend Push Notification Handler
 * 
 * Bu dosya:
 * - Service Worker'ı kaydeder
 * - Push izni ister
 * - Push subscription oluşturur
 * - Subscription'ı Cloudflare Worker'a POST eder
 * - Bildirim tıklama olaylarını yönetir
 */

// Cloudflare Worker URL'inizi buraya yazın
// Worker'ı deploy ettikten sonra buraya gerçek URL'i yazın
// Örnek: 'https://pigeon-worker.your-subdomain.workers.dev'
// Local development için: 'http://localhost:8787' (wrangler dev çalışırken)

// Otomatik localhost detection (development için)
let WORKER_URL = '';

// Hostname kontrolü - IPv4, IPv6 ve localhost için
const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname === '[::1]' ||
                    hostname === '::1' ||
                    hostname.startsWith('127.') ||
                    hostname.startsWith('192.168.') ||
                    hostname.startsWith('10.') ||
                    window.location.port === '8000' || // Python server port
                    window.location.port === '8787';   // Wrangler dev port

if (isLocalhost) {
    // Local development - wrangler dev çalışıyorsa
    WORKER_URL = 'http://localhost:8787';
    console.log('🔧 Development mode detected:', {
        hostname: hostname,
        port: window.location.port,
        protocol: window.location.protocol,
        workerUrl: WORKER_URL
    });
} else {
    // Production - gerçek worker URL'i
    WORKER_URL = 'https://pigeon-worker.plannerai-proxy.workers.dev';
    console.log('🌐 Production mode:', {
        hostname: hostname,
        workerUrl: WORKER_URL
    });
}

// Global scope'a ekle (chat.js için)
window.WORKER_URL = WORKER_URL;
console.log('✅ window.WORKER_URL set to:', window.WORKER_URL);

// VAPID Public Key - Worker'dan veya environment'tan alınmalı
const VAPID_PUBLIC_KEY = 'BEdkhPxV0n8fap9klm7kbXEwmok2x7CW1_lgTzscsKo2lgmrxXa1OlaJMZipJTKeuK9Lg5OjN4oYdbwZCz3J0eU';

/**
 * Service Worker'ı kaydet ve hazır olduğunda devam et
 */
async function registerServiceWorker() {
  try {
    // Service Worker sadece HTTP/HTTPS veya localhost üzerinde çalışır
    // file:// protokolünde çalışmaz
    const protocol = window.location ? window.location.protocol : 'file:';
    const hostname = window.location ? window.location.hostname : '';

    // file:// protokolü kontrolü
    if (protocol === 'file:' || !window.location || !window.location.href) {
      console.warn('Service Workers require HTTPS or localhost. Running in limited mode (file:// protocol detected).');
      return null;
    }

    // Secure context kontrolü
    const isSecureContext =
      protocol === 'https:' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]';

    if (!isSecureContext) {
      console.warn('Service Workers require HTTPS or localhost. Running in limited mode.');
      return null;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported in this browser.');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('frontend/sw.js');
      console.log('Service Worker registered:', registration);

      // Service Worker hazır olana kadar bekle
      await navigator.serviceWorker.ready;
      console.log('Service Worker ready');

      return registration;
    } catch (error) {
      console.warn('Service Worker registration failed:', error.message);
      // Hata durumunda exception fırlatma, null dön
      return null;
    }
  } catch (error) {
    console.warn('Service Worker initialization error:', error.message);
    return null;
  }
}

/**
 * VAPID public key'i Uint8Array'e çevir
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Push izni iste ve subscription oluştur
 */
async function requestPushPermission(registration) {
  if (!registration || !registration.pushManager) {
    throw new Error('Push manager not available');
  }

  // Önce izin durumunu kontrol et
  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('Push notification permission denied');
  }

  // Mevcut subscription'ı kontrol et
  let subscription = await registration.pushManager.getSubscription();

  // Eğer subscription yoksa yeni bir tane oluştur
  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    console.log('New subscription created:', subscription);
  } else {
    console.log('Existing subscription found:', subscription);
  }

  return subscription;
}

/**
 * Subscription'ı Cloudflare Worker'a gönder
 */
async function sendSubscriptionToWorker(subscription) {
  try {
    // Worker URL kontrolü
    if (!WORKER_URL || WORKER_URL.trim() === '' || WORKER_URL.includes('YOUR_SUBDOMAIN') || WORKER_URL === 'https://your-worker.workers.dev') {
      console.warn('⚠️ Worker URL henüz ayarlanmamış. Push notifications için worker\'ı deploy edip URL\'i güncelleyin.');
      return { success: false, message: 'Worker not configured' };
    }

    const response = await fetch(`${WORKER_URL}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription)
    });

    if (!response.ok) {
      throw new Error(`Failed to send subscription: ${response.status}`);
    }

    const result = await response.json();
    console.log('Subscription sent to worker:', result);
    return result;
  } catch (error) {
    console.warn('⚠️ Error sending subscription to worker:', error.message);
    // Worker deploy edilmemişse hata fırlatma, sadece logla
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      console.warn('Worker henüz deploy edilmemiş veya erişilemiyor.');
      return { success: false, message: 'Worker not available' };
    }
    throw error;
  }
}

/**
 * Subscription'ı sil (unsubscribe)
 */
async function unsubscribeFromWorker(registration) {
  try {
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Worker'dan sil
      await fetch(`${WORKER_URL}/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });

      // Local subscription'ı sil
      await subscription.unsubscribe();
      console.log('Unsubscribed successfully');
    }
  } catch (error) {
    console.error('Error unsubscribing:', error);
    throw error;
  }
}

/**
 * Test bildirimi gönder (debugging için)
 */
async function sendTestNotification() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      throw new Error('No subscription found');
    }

    const response = await fetch(`${WORKER_URL}/send-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });

    const result = await response.json();
    console.log('Test notification result:', result);
    return result;
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
}

/**
 * Ana initializasyon fonksiyonu
 * Sayfa yüklendiğinde bu fonksiyonu çağırın
 */
async function initializePushNotifications() {
  try {
    console.log('Initializing push notifications...');

    // 1. Service Worker'ı kaydet
    const registration = await registerServiceWorker();

    // Eğer service worker kayıt edilemediyse (file:// protocol gibi)
    if (!registration) {
      console.warn('Push notifications require HTTPS or localhost. Skipping initialization.');
      return { success: false, error: 'Service Worker requires HTTPS or localhost', skipped: true };
    }

    // 2. Push izni iste ve subscription oluştur
    const subscription = await requestPushPermission(registration);

    // 3. Subscription'ı Worker'a gönder
    await sendSubscriptionToWorker(subscription);

    console.log('Push notifications initialized successfully!');
    return { success: true, subscription };

  } catch (error) {
    console.error('Failed to initialize push notifications:', error);
    // Hata durumunda bile uygulamanın çalışmaya devam etmesini sağla
    return { success: false, error: error.message };
  }
}

/**
 * Service Worker mesajlarını dinle
 * Worker'dan gelen mesajları handle et
 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Message from service worker:', event.data);

    // Örnek: Bildirim tıklama mesajı
    if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
      const url = event.data.url;
      if (url) {
        window.open(url, '_blank');
      }
    }
  });
}

// Export functions for external use
// Eğer modül sistemi kullanıyorsanız:
// export { initializePushNotifications, sendTestNotification, unsubscribeFromWorker };

// Eğer global scope kullanıyorsanız:
window.initializePushNotifications = initializePushNotifications;
window.sendTestNotification = sendTestNotification;
window.unsubscribeFromWorker = unsubscribeFromWorker;

// Protocol kontrolü ve uyarı gösterimi
function checkProtocol() {
  try {
    const protocol = window.location ? window.location.protocol : 'file:';
    if (protocol === 'file:') {
      const warning = document.getElementById('protocolWarning');
      if (warning) {
        warning.style.display = 'flex';
      }
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Otomatik olarak başlatmak için
window.addEventListener('load', () => {
  // Önce protocol kontrolü yap
  const isSecureProtocol = checkProtocol();

  // Loading overlay'i kapat (chat.js ile çift kapanmayı önlemek için)
  setTimeout(() => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay && overlay.style.display !== 'none') {
      overlay.classList.add('hidden');
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 500);
    }
  }, 500);

  // Push notifications'ı başlat (hata olsa bile devam et)
  if (isSecureProtocol) {
    initializePushNotifications().then(result => {
      console.log('Push notifications initialized:', result);
    }).catch(error => {
      console.error('Push notification initialization error:', error);
      // Hata olsa bile uygulama çalışmaya devam etsin
    });
  } else {
    console.warn('Running in file:// protocol. Service Worker features disabled.');
  }
});
