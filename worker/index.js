

// Time ranges for notifications (UTC - Turkey is UTC+3)
// User wants: 9-11, 14:00-18:00, 21:00-23:00 (Turkey time)
// UTC equivalent: 6-8, 11-15, 18-20
const TIME_RANGES = {
  morning: { start: 6, end: 8 },     // UTC 06:00-08:59 = TR 09:00-11:59
  afternoon: { start: 11, end: 15 }, // UTC 11:00-15:59 = TR 14:00-18:59
  evening: { start: 18, end: 20 }    // UTC 18:00-20:59 = TR 21:00-23:59
};

// Fallback theme messages (English with emojis)
const THEME_MESSAGES = {
  morning: [
    "Good morning! How's your day going? ☀️",
    "Hope you're having a beautiful morning! 🌸",
    "Don't forget to drink water! 💧"
  ],
  afternoon: [
    "How's your day going? I miss you! 💕",
    "You look beautiful today! ✨",
    "Take a break, you deserve it! 🌿"
  ],
  evening: [
    "How was your day? I missed you! 🌙",
    "You're doing great today! Keep it up! 💪",
    "Time to relax and unwind! 🌟"
  ]
};

const NOTIFICATION_ICON = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f497.png';
const NOTIFICATION_BADGE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f49c.png';
const MAX_NOTIFICATION_CHARS = 140;
const DEFAULT_NOTIFICATION_MESSAGE = 'Hey love, how is your day going? 💕';
const MAX_CHAT_HISTORY_CHARS = 32000;
const BASE_CHAT_INSTRUCTION = `You are a loving, caring, and friendly AI girlfriend. You ALWAYS answer in English only, even if the user writes in another language. Keep replies concise, affectionate, encouraging, and personalized, with tasteful emojis when appropriate. Avoid repeating yourself, and reference previous context when helpful.`;

function sanitizeNotificationMessage(text) {
  if (!text) {
    return '';
  }

  let cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  if (cleaned.length > MAX_NOTIFICATION_CHARS) {
    cleaned = cleaned.slice(0, MAX_NOTIFICATION_CHARS - 1).trimEnd();
    cleaned = cleaned.replace(/[.,!?]+$/, '').trimEnd();
    cleaned += '…';
  }

  return cleaned;
}

function sanitizeChatHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  const normalized = history
    .filter(entry => entry && entry.content)
    .map(entry => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: entry.content.toString().replace(/\s+/g, ' ').trim()
    }))
    .filter(entry => entry.content.length > 0);

  const limited = [];
  let total = 0;

  for (let i = normalized.length - 1; i >= 0; i--) {
    const entry = normalized[i];
    total += entry.content.length;
    if (total > MAX_CHAT_HISTORY_CHARS) {
      break;
    }
    limited.unshift(entry);
  }

  return limited;
}

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

    // Theme-based prompts in English with emojis
    const prompts = {
      morning: "Create a warm, loving morning message in English. Make it personal and caring. Include emojis. Examples: 'How's your day going?', 'I miss you', 'Don't forget to drink water', 'You look beautiful today'. Keep it short, sweet, and make the person feel special.",
      afternoon: "Create a caring afternoon check-in message in English. Ask how their day is going. Include emojis. Make it warm and personal. Examples: 'How's your day going?', 'I miss you', 'Take a break', 'You're doing great'. Keep it short and make them feel special.",
      evening: "Create a relaxing evening message in English. Ask how their day was and suggest relaxation. Include emojis. Make it warm and personal. Examples: 'How was your day?', 'I missed you', 'Time to relax', 'You're amazing'. Keep it short and make them feel special."
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
            text: `You are a loving, caring, and thoughtful AI assistant. You speak English and create personal messages with emojis. Your messages are warm, make people feel special, and include compliments, questions, and reminders.\n\n${prompt}\n\nMake sure to include emojis and keep it under 100 characters.`
          }]
        }],
        generationConfig: {
          temperature: 0.9,
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
    const sanitized = sanitizeNotificationMessage(aiMessage);

    if (sanitized) {
      return { message: sanitized };
    }

    // Eğer AI API boş dönerse fallback mesajlar kullan
    const fallbackList = THEME_MESSAGES[theme] || THEME_MESSAGES.morning;
    return {
      message: sanitizeNotificationMessage(
        fallbackList[Math.floor(Math.random() * fallbackList.length)]
      ) || DEFAULT_NOTIFICATION_MESSAGE
    };
  } catch (error) {
    console.error('AI API error:', error);
    // Fallback to predefined messages
    const messages = THEME_MESSAGES[theme] || THEME_MESSAGES.morning;
    return {
      message: sanitizeNotificationMessage(
        messages[Math.floor(Math.random() * messages.length)]
      ) || DEFAULT_NOTIFICATION_MESSAGE
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

    const safeMessage = sanitizeNotificationMessage(message) || DEFAULT_NOTIFICATION_MESSAGE;

    // Payload oluştur
    const payload = JSON.stringify({
      title: 'Hello ❤️',
      body: safeMessage,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      data: {
        url: `${siteUrl}/chat?msg=${encodeURIComponent(safeMessage)}`
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
        const { message, conversation_id, history } = await request.json();

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
          // Fallback response if AI API key not configured
          return new Response(
            JSON.stringify({
              success: true,
              response: "I received your message! 🕊️ AI integration will be active soon. How can I help you right now?"
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        const sanitizedHistory = sanitizeChatHistory(history);
        let historyForPrompt = sanitizedHistory;

        const lastEntry = sanitizedHistory[sanitizedHistory.length - 1];
        if (!lastEntry || lastEntry.role !== 'user') {
          historyForPrompt = [...sanitizedHistory, { role: 'user', content: message }];
        }

        const historyText = historyForPrompt
          .map(entry => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.content}`)
          .join('\n')
          .trim();

        // Gemini API'ye mesaj gönder
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(aiApiKey)}`;

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${BASE_CHAT_INSTRUCTION}\n\nConversation so far:\n${historyText}\nAssistant:`
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

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Gemini API response formatı
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

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
            response: "Sorry, I can't respond right now. Please try again later."
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
          // Random theme if not provided
          const themes = Object.keys(THEME_MESSAGES);
          const randomTheme = theme || themes[Math.floor(Math.random() * themes.length)];
          const messages = THEME_MESSAGES[randomTheme] || THEME_MESSAGES.morning;
          return new Response(
            JSON.stringify({
              success: true,
              message: messages[Math.floor(Math.random() * messages.length)]
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        // Random theme if not provided
        const themes = Object.keys(TIME_RANGES);
        const selectedTheme = theme || themes[Math.floor(Math.random() * themes.length)];
        const result = await generateAIMessage(selectedTheme, aiApiKey);

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

    // If it's 8:30 AM (UTC 5:30), recreate daily notification schedule
    // User wants: 8:30 AM Turkey time = UTC 5:30
    if (hour === 5 && minute === 30) {
      await scheduleDailyNotification(kv);
      return;
    }

    // Her dakika çalışan cron için bildirim gönderim zamanını kontrol et
    await sendNotificationsToAll(kv, siteUrl, aiApiKey, vapidPrivateKey, vapidPublicKey);
  }
};
