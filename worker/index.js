/**
 * Cloudflare Worker - Web Push Notification System
 * 
 * Endpoints:
 * - POST /subscribe - Kayıt subscription'ı KV'ye kaydeder
 * - POST /unsubscribe - Subscription'ı KV'den siler
 * - POST /send-test - Test bildirimi gönderir
 * - POST /generate-message - AI ile mesaj üretir
 * curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent" \
 * Cron Jobs:
 * - "0 9 * * *" - Her gün saat 09:00'da rastgele zaman seçer
 * - "* * * * *" - Her dakika kontrol eder, zaman geldiyse bildirim gönderir
 */


// Time ranges for notifications (UTC - Türkiye için +3 ekleyin)
const TIME_RANGES = {
  morning: { start: 7, end: 9 },    // UTC 07:00-09:59 = TR 10:00-12:59
  afternoon: { start: 11, end: 14 }, // UTC 11:00-14:59 = TR 14:00-17:59
  evening: { start: 18, end: 20 }    // UTC 18:00-20:59 = TR 21:00-23:59
};

// Theme messages
const THEME_MESSAGES = {
  morning: [
    "Günaydın tatlım, bugün nasıl hissediyorsun?",
    "Bugün güzel bir gün olacak mı birlikte görelim mi?"
  ],
  afternoon: [
    "Umarım günün güzel geçiyordur, biraz mola vermeye ne dersin?",
    "Şu ana kadar günün nasıl geçti?"
  ],
  evening: [
    "Bugün nasıldı tatlım?",
    "Rahatlamak için güzel bir akşam, günün nasıl geçti?"
  ]
};

/**
 * Web Push encryption için gerekli utility fonksiyonlar
 * Web Push Protocol RFC 8291'e göre implementasyon
 */
async function urlBase64ToUint8Array(base64String) {
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
 * Base64 URL-safe encoding
 */
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * VAPID JWT token oluşturur
 * Web Crypto API kullanarak ES256 ile imzalar
 */
async function generateVAPIDJWT(privateKeyBase64, vapidPublicKey) {
  try {
    // Private key'i import et
    // VAPID private key PEM formatında değil, raw key olmalı
    // Bu basitleştirilmiş bir implementasyon
    // Production'da web-push kütüphanesi kullanılması önerilir

    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'ES256',
      typ: 'JWT'
    };

    // Endpoint'ten audience'ı çıkar (FCM için)
    const payload = {
      aud: 'https://fcm.googleapis.com',
      exp: now + 43200, // 12 saat
      sub: 'mailto:your-email@example.com'
    };

    // JWT header ve payload'ı base64 encode et
    const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Not: Gerçek ES256 imzalama için Web Crypto API ile ECDSA kullanılmalı
    // Bu çok karmaşık olduğu için basitleştirilmiş bir implementasyon
    // Production'da web-push kütüphanesi (npm package) kullanılması önerilir
    // Şimdilik placeholder döndürüyoruz

    // Production için: web-push kütüphanesini kullanın veya
    // tam Web Crypto API implementasyonu yazın
    return 'vapid-jwt-token-placeholder';
  } catch (error) {
    console.error('VAPID JWT generation error:', error);
    return 'vapid-jwt-token-placeholder';
  }
}

/**
 * Web Push gönderimi için payload şifreleme
 */
async function encryptPayload(payload, subscription) {
  // Web Push Encryption RFC 8291 implementasyonu
  // Production'da web-push kütüphanesi veya native crypto API kullanılmalı

  const encoder = new TextEncoder();
  return encoder.encode(payload);
}

/**
 * AI API'den mesaj üretir (Google Gemini API)
 */
async function generateAIMessage(theme, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key not provided');
    }

    // Theme'e göre prompt oluştur
    const prompts = {
      morning: "Türkçe olarak sıcak, sevgi dolu bir sabah mesajı oluştur. Kişisel ve özenli olsun. Kısa ve samimi olsun.",
      afternoon: "Türkçe olarak öğlen kontrol mesajı oluştur. Günün nasıl geçtiğini sor. Sıcak ve ilgili olsun.",
      evening: "Türkçe olarak rahatlatıcı bir akşam mesajı oluştur. Günün nasıl geçtiğini sor ve rahatlamayı öner. Samimi olsun."
    };

    const prompt = prompts[theme] || prompts.morning;

    // Gemini API URL - API key query parameter olarak eklenir
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    // Gemini API request formatı
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Sen sevgi dolu, samimi ve özenli bir AI asistanısın. Türkçe konuşuyorsun ve kişisel mesajlar oluşturuyorsun.\n\n${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 150,
          topP: 0.95,
          topK: 40
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Gemini API response formatı farklı
    const aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // Eğer AI API kullanılamıyorsa fallback mesajlar kullan
    return {
      message: aiMessage || THEME_MESSAGES[theme][Math.floor(Math.random() * THEME_MESSAGES[theme].length)]
    };
  } catch (error) {
    console.error('AI API error:', error);
    // Fallback to predefined messages
    const messages = THEME_MESSAGES[theme] || THEME_MESSAGES.morning;
    return {
      message: messages[Math.floor(Math.random() * messages.length)]
    };
  }
}

/**
 * Belirli bir theme için zaman aralığından rastgele saat seçer
 */
function pickRandomTimeInRange(theme) {
  const range = TIME_RANGES[theme];
  const hour = Math.floor(Math.random() * (range.end - range.start + 1)) + range.start;
  const minute = Math.floor(Math.random() * 60);
  return { hour, minute };
}

/**
 * Günün rastgele zamanını belirler ve KV'ye kaydeder
 * Her gün 3 zaman aralığından birini seçer, o aralıkta rastgele bir dakika seçer
 */
async function scheduleDailyNotification(kv) {
  // Random bir theme seç (morning, afternoon, evening)
  const themes = Object.keys(TIME_RANGES);
  const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

  // Seçilen theme'in zaman aralığından rastgele bir saat seç
  const { hour, minute } = pickRandomTimeInRange(selectedTheme);

  // Bugünün tarihi ile birlikte kaydet
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const scheduledTime = {
    date: today,
    hour,
    minute,
    theme: selectedTheme,
    done: false
  };

  // KV'ye kaydet
  await kv.put('scheduled_time', JSON.stringify(scheduledTime));

  return scheduledTime;
}

/**
 * Şu anki zamanın scheduled time ile eşleşip eşleşmediğini kontrol eder
 */
function isTimeToSend(scheduledTime) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  return (
    scheduledTime.hour === currentHour &&
    scheduledTime.minute === currentMinute &&
    !scheduledTime.done
  );
}

/**
 * Tüm subscription'ları KV'den alır
 */
async function getAllSubscriptions(kv) {
  const keys = [];
  let cursor = null;

  do {
    const list = await kv.list({ prefix: 'sub:', cursor });
    keys.push(...list.keys.map(k => k.name));
    cursor = list.cursor;
  } while (cursor);

  const subscriptions = [];
  for (const key of keys) {
    const value = await kv.get(key);
    if (value) {
      try {
        subscriptions.push(JSON.parse(value));
      } catch (e) {
        console.error(`Error parsing subscription ${key}:`, e);
      }
    }
  }

  return subscriptions;
}

/**
 * Web Push bildirimi gönderir
 * 
 * ÖNEMLİ: Bu basitleştirilmiş bir implementasyon
 * Production'da web-push npm paketi kullanılmalı veya
 * tam Web Push Encryption (RFC 8291) implementasyonu yapılmalı
 */
async function sendPushNotification(subscription, message, siteUrl, vapidPrivateKey, vapidPublicKey) {
  try {
    // Web Push Protocol gereksinimleri
    const vapidToken = await generateVAPIDJWT(vapidPrivateKey, vapidPublicKey);

    // Payload oluştur
    const payload = JSON.stringify({
      title: 'Merhaba ❤️',
      body: message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: {
        url: `${siteUrl}/chat?msg=${encodeURIComponent(message)}`
      }
    });

    // Encrypt payload (basitleştirilmiş - production'da tam encryption gerekli)
    // Web Push Encryption (RFC 8291) gerektirir:
    // - ECDH key exchange
    // - AES-GCM encryption
    // - Padding ve formatting
    const encryptedPayload = await encryptPayload(payload, subscription);

    // Web Push endpoint'e POST request gönder
    // Not: Farklı push service'ler (FCM, Mozilla, vb.) farklı endpoint'ler kullanır
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${vapidToken}, k=${vapidPublicKey}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400'
      },
      body: encryptedPayload
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Push failed: ${response.status} - ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Push notification error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tüm kullanıcılara bildirim gönderir
 */
async function sendNotificationsToAll(kv, siteUrl, apiKey, vapidPrivateKey, vapidPublicKey) {
  // Scheduled time'ı kontrol et
  const scheduledData = await kv.get('scheduled_time');
  if (!scheduledData) {
    return { sent: 0, error: 'No scheduled time found' };
  }

  const scheduledTime = JSON.parse(scheduledData);

  // Zaman gelmediyse veya zaten gönderildiyse çık
  if (!isTimeToSend(scheduledTime)) {
    return { sent: 0, message: 'Not time yet or already sent' };
  }

  // AI ile mesaj üret
  const aiResponse = await generateAIMessage(scheduledTime.theme, apiKey);
  const message = aiResponse.message;

  // Tüm subscription'ları al
  const subscriptions = await getAllSubscriptions(kv);

  let sentCount = 0;
  let failedCount = 0;

  // Her subscription'a bildirim gönder
  for (const sub of subscriptions) {
    const result = await sendPushNotification(sub, message, siteUrl, vapidPrivateKey, vapidPublicKey);
    if (result.success) {
      sentCount++;
    } else {
      failedCount++;
    }
  }

  // Done flag'i set et
  scheduledTime.done = true;
  await kv.put('scheduled_time', JSON.stringify(scheduledTime));

  return { sent: sentCount, failed: failedCount, message };
}

/**
 * Main worker handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // OPTIONS request için CORS
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // KV ve environment variables
    const kv = env.subs; // KV binding
    const aiApiKey = env.AI_API_KEY; // AI API key
    const siteUrl = env.SITE_URL || 'https://github.com/Nazarali23/pigeon'; // Site URL

    // Debug: AI API key kontrolü
    if (!aiApiKey) {
      console.warn('⚠️ AI_API_KEY not found in environment variables');
      console.warn('For local development, create .dev.vars file with: AI_API_KEY=your-key-here');
      console.warn('For production, set with: wrangler secret put AI_API_KEY');
    } else {
      console.log('✅ AI_API_KEY found (length:', aiApiKey.length, ')');
    }
    // VAPID keys - Sadece environment variables'dan al (hardcoded fallback yok)
    const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
    const vapidPublicKey = env.VAPID_PUBLIC_KEY;

    if (!vapidPrivateKey || !vapidPublicKey) {
      console.warn('⚠️ VAPID keys not configured. Push notifications will not work.');
      console.warn('Set them with: wrangler secret put VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY');
    }

    // GET / - Health check
    if (path === '/' && method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'pigeon-worker',
          endpoints: ['/chat', '/subscribe', '/unsubscribe', '/send-test', '/generate-message'],
          message: 'Worker is running! Use POST /chat to send messages.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // GET /chat - Info endpoint (POST kullanılmalı)
    if (path === '/chat' && method === 'GET') {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
          message: 'Use POST method to send chat messages',
          example: { method: 'POST', path: '/chat', body: { message: 'Hello', conversation_id: 'optional' } }
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // POST /subscribe - Subscription kaydet
    if (path === '/subscribe' && method === 'POST') {
      try {
        const subscription = await request.json();

        // Subscription'ı unique key ile KV'ye kaydet
        // Endpoint URL'den unique ID çıkar
        const subKey = `sub:${subscription.endpoint.split('/').pop()}`;
        await kv.put(subKey, JSON.stringify(subscription));

        return new Response(
          JSON.stringify({ success: true, message: 'Subscription saved' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // POST /unsubscribe - Subscription sil
    if (path === '/unsubscribe' && method === 'POST') {
      try {
        const { endpoint } = await request.json();
        const subKey = `sub:${endpoint.split('/').pop()}`;
        await kv.delete(subKey);

        return new Response(
          JSON.stringify({ success: true, message: 'Subscription removed' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // POST /send-test - Test bildirimi gönder
    if (path === '/send-test' && method === 'POST') {
      try {
        const { endpoint } = await request.json();
        const subKey = `sub:${endpoint.split('/').pop()}`;
        const subscriptionData = await kv.get(subKey);

        if (!subscriptionData) {
          return new Response(
            JSON.stringify({ success: false, error: 'Subscription not found' }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        const subscription = JSON.parse(subscriptionData);
        const testMessage = 'Bu bir test bildirimidir! 🔔';

        const result = await sendPushNotification(subscription, testMessage, siteUrl, vapidPrivateKey, vapidPublicKey);

        return new Response(
          JSON.stringify(result),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // POST /chat - AI chat endpoint
    if (path === '/chat' && method === 'POST') {
      try {
        const { message, conversation_id } = await request.json();

        if (!message) {
          return new Response(
            JSON.stringify({ success: false, error: 'Message is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        if (!aiApiKey) {
          console.warn('⚠️ AI_API_KEY not configured, returning fallback message');
          // Fallback response if AI API key not configured
          return new Response(
            JSON.stringify({
              success: true,
              response: "Mesajınızı aldım! 🕊️ AI entegrasyonu yakında aktif olacak. Şu an size nasıl yardımcı olabilirim?"
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        // Gemini API'ye mesaj gönder
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(aiApiKey)}`;

        console.log('📤 Sending request to Gemini API...');
        console.log('📤 Gemini URL (without key):', geminiUrl.replace(aiApiKey, '***'));
        console.log('📤 Message:', message.substring(0, 50) + '...');

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Sen sevgi dolu, samimi ve arkadaş canlısı bir AI asistanısın. Türkçe konuşuyorsun ve kullanıcıya sıcak, kişisel mesajlar gönderiyorsun. Kısa ve öz cevaplar ver.\n\nKullanıcı: ${message}\n\nSen:`
              }]
            }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 300,
              topP: 0.95,
              topK: 40
            }
          })
        });

        console.log('📥 Gemini API response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Gemini API error:', response.status, errorText);
          throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('📥 Gemini API response received, candidates:', data.candidates?.length || 0);

        // Gemini API response formatı
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        console.log('📥 AI Response extracted (length:', aiResponse.length, '):', aiResponse.substring(0, 100) + '...');

        return new Response(
          JSON.stringify({
            success: true,
            response: aiResponse
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('Chat error:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
            response: "Üzgünüm, şu anda cevap veremiyorum. Lütfen daha sonra tekrar deneyin."
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // POST /generate-message - AI ile mesaj üret
    if (path === '/generate-message' && method === 'POST') {
      try {
        const { theme } = await request.json();

        if (!aiApiKey) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'AI API key not configured',
              message: THEME_MESSAGES[theme || 'morning'][0]
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        const result = await generateAIMessage(theme || 'morning', aiApiKey);

        return new Response(
          JSON.stringify(result),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Unknown endpoint
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  },

  /**
   * Scheduled event handler (Cron Triggers)
   * Cloudflare Workers Cron Triggers kullanıyor
   * 
   * wrangler.toml'da iki cron tanımlanmalı:
   * - "0 9 * * *" - Her gün saat 09:00 UTC'de günün zamanını planlar
   * - "* * * * *" - Her dakika kontrol eder, zaman geldiyse bildirim gönderir
   */
  async scheduled(event, env, ctx) {
    const kv = env.subs;
    const aiApiKey = env.AI_API_KEY;
    const siteUrl = env.SITE_URL || 'https://nazarali23.github.io/pigeon';
    // VAPID keys - Sadece environment variables'dan al (hardcoded fallback yok)
    const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
    const vapidPublicKey = env.VAPID_PUBLIC_KEY;

    if (!vapidPrivateKey || !vapidPublicKey) {
      console.warn('⚠️ VAPID keys not configured in scheduled event. Push notifications will not work.');
    }

    // Zamanı UTC olarak al
    const now = new Date(event.scheduledTime);
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();

    // Eğer sabah 09:00 ise (UTC), günün zamanını planla
    if (hour === 9 && minute === 0) {
      await scheduleDailyNotification(kv);
      return;
    }

    // Her dakika çalışan cron için bildirim gönderim zamanını kontrol et
    await sendNotificationsToAll(kv, siteUrl, aiApiKey, vapidPrivateKey, vapidPublicKey);
  }
};
