/**
 * Chat functionality for Pigeon app
 * Handles AI chat interactions and displays notification messages
 */

// Cloudflare Worker URL - main.js'den al (window.WORKER_URL kullan)
// main.js'de WORKER_URL tanımlı ve window.WORKER_URL'e atanmış olmalı

// WORKER_URL'i yükle - main.js'den veya otomatik localhost detection
function loadWorkerUrl() {
    try {
        // Önce window.WORKER_URL'den al (main.js tarafından ayarlanmış olabilir)
        if (typeof window !== 'undefined' && window.WORKER_URL) {
            console.log('✅ WORKER_URL loaded from window:', window.WORKER_URL);
            return window.WORKER_URL;
        }

        // Eğer window.WORKER_URL yoksa, otomatik localhost detection yap
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '[::1]' ||
            hostname === '::1' ||
            window.location.port === '8000' ||
            window.location.port === '8787';

        if (isLocalhost) {
            const localUrl = 'http://localhost:8787';
            console.log('🔧 Auto-detected localhost, using:', localUrl);
            // window'a da ekle (main.js henüz yüklenmemişse)
            window.WORKER_URL = localUrl;
            return localUrl;
        }

        console.warn('⚠️ window.WORKER_URL not found and not localhost');
        return '';
    } catch (e) {
        console.warn('Could not get WORKER_URL:', e);
        return '';
    }
}

// WORKER_URL'i al (window.WORKER_URL'den veya loadWorkerUrl'dan)
function getWorkerUrl() {
    // Önce window.WORKER_URL'i kontrol et
    if (typeof window !== 'undefined' && window.WORKER_URL) {
        return window.WORKER_URL;
    }
    // Yoksa loadWorkerUrl'den al
    return loadWorkerUrl();
}

// Final check - log the URL being used
const currentWorkerUrl = getWorkerUrl();
console.log('🔧 Final WORKER_URL:', currentWorkerUrl || '(empty - chat will not work)');

const MAX_HISTORY_CHARS = 30000;
let conversationHistory = [];

const GREETING_MESSAGES = {
    morning: 'Good morning ☀️',
    afternoon: 'Hope your day goes wonderfully 💐',
    evening: 'Good evening ✨',
    night: 'Good night 🌙'
};

function getGreetingForCurrentTime() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return GREETING_MESSAGES.morning;
    if (hour >= 12 && hour < 18) return GREETING_MESSAGES.afternoon;
    if (hour >= 18 && hour < 22) return GREETING_MESSAGES.evening;
    return GREETING_MESSAGES.night;
}

function getHistoryCharLength(extraText = '') {
    const historyChars = conversationHistory.reduce((total, entry) => total + (entry.content?.length || 0), 0);
    return historyChars + (extraText?.length || 0);
}

function ensureHistoryLimit(nextMessage) {
    if (getHistoryCharLength(nextMessage) > MAX_HISTORY_CHARS) {
        alert('Chat history is full. Please refresh the page to continue.');
        window.location.reload();
        return false;
    }
    return true;
}

let keyboardIsOpen = false;

function handleKeyboardOpen() {
    if (keyboardIsOpen) return; // zaten açık, tekrar etme
    keyboardIsOpen = true;
    document.body.classList.add('keyboard-open');

    setTimeout(() => {
        scrollToBottom();
    }, 50);
}

function handleKeyboardClose() {
    keyboardIsOpen = false;
    setTimeout(() => {
        document.body.classList.remove('keyboard-open');
    }, 150);
}


/**
 * Send chat message
 * Global scope'a ekle (HTML onclick için) - ERKEN TANIMLA
 */
window.sendMessage = async function sendMessage() {
    console.log('sendMessage() called');

    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const chatMessages = document.getElementById('chatMessages');

    if (!chatInput || !sendButton) {
        console.error('Chat elements not found in sendMessage()');
        return;
    }

    const message = chatInput.value.trim();

    if (!message) {
        console.log('Empty message, returning');
        return;
    }

    console.log('Sending message:', message);

    if (!ensureHistoryLimit(message)) {
        return;
    }

    // Disable input and button
    // chatInput.disabled = true;
    sendButton.disabled = true;

    // Add user message to chat
    addUserMessage(message);

    // Clear input
    chatInput.value = '';

    // Worker URL kontrolü - window.WORKER_URL'den al
    let workerUrl = getWorkerUrl();

    if (!workerUrl || workerUrl.trim() === '') {
        console.warn('⚠️ WORKER_URL is empty, trying to reload...');
        workerUrl = loadWorkerUrl();
    }

    // Hala boşsa, hata göster
    if (!workerUrl || workerUrl.trim() === '') {
        console.error('❌ WORKER_URL is still empty!', {
            windowWorkerUrl: window.WORKER_URL,
            currentWorkerUrl: workerUrl,
            hostname: window.location.hostname,
            port: window.location.port
        });
        addBotMessage("⚠️ Worker URL is not configured!\n\nSolution:\n1. Start the worker: `npm run dev` (in another terminal)\n2. Refresh the page\n\nDebug: hostname=" + window.location.hostname + ", port=" + window.location.port);
        // Re-enable input and button
        chatInput.disabled = false;
        sendButton.disabled = false;
        chatInput.focus();
        return;
    }

    console.log('📤 Sending message to worker:', workerUrl);

    // Show typing indicator
    const typingIndicator = showTypingIndicator();

    try {
        const chatUrl = `${workerUrl}/chat`;
        console.log('📤 Sending request to:', chatUrl);
        console.log('📤 Request details:', {
            url: chatUrl,
            method: 'POST',
            message: message.substring(0, 50) + '...'
        });

        // Send message to AI (via Worker)
        const response = await fetch(chatUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                conversation_id: getConversationId(),
                history: conversationHistory
            })
        });

        console.log('📥 Response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            url: response.url,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (response.ok) {
            try {
                const data = await response.json();
                console.log('📥 Response data:', data);
                console.log('📥 Response message:', data.response);
                console.log('📥 Response success:', data.success);

                // Remove typing indicator after successful response
                removeTypingIndicator(typingIndicator);

                // Worker'dan gelen response formatını kontrol et
                const botResponse = data.response || data.message || data.text || "Sorry, I can't respond now.";
                console.log('📥 Bot response to display:', botResponse);
                console.log('📥 Bot response type:', typeof botResponse);
                console.log('📥 Bot response length:', botResponse ? botResponse.length : 0);

                if (botResponse && botResponse.trim() !== '') {
                    console.log('📥 Calling addBotMessage with:', botResponse);
                    addBotMessage(botResponse);
                    console.log('📥 addBotMessage call completed');
                } else {
                    console.warn('⚠️ Bot response is empty!');
                    addBotMessage("Sorry, an error occurred. Please try again.");
                }
            } catch (parseError) {
                console.error('❌ Error parsing response JSON:', parseError);
                removeTypingIndicator(typingIndicator);
                const responseText = await response.text();
                console.log('📥 Raw response text:', responseText);
                addBotMessage("Message parsing error. Please try again.");
            }
        } else {
            // Remove typing indicator on error
            removeTypingIndicator(typingIndicator);
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('❌ Response error:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText,
                url: response.url
            });

            // Try to parse error message
            try {
                const errorData = JSON.parse(errorText);
                if (response.status === 404) {
                    addBotMessage(`⚠️ Endpoint not found (404)!\n\nURL: ${response.url}\n\nMake sure the worker is running and the request is sent to the correct endpoint.`);
                } else {
                    addBotMessage(errorData.error || `An error occurred (${response.status}). Please try again.`);
                }
            } catch {
                if (response.status === 404) {
                    addBotMessage(`⚠️ Endpoint not found (404)!\n\nRequested URL: ${response.url}\n\nCheck:\n1. Is the worker running? (npm run dev)\n2. Is the URL correct? (${workerUrl}/chat)`);
                } else {
                    addBotMessage(`⚠️ Worker error (${response.status}). Ensure the worker is running.`);
                }
            }
        }
    } catch (error) {
        console.error('Error sending message:', error);
        removeTypingIndicator(typingIndicator);

        // Daha açıklayıcı hata mesajları
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            addBotMessage(`⚠️ Cannot connect to the worker!\n\nPossible reasons:\n1. The worker is not deployed\n2. The worker URL is incorrect\n3. CORS errors\n\nCurrent URL: ${workerUrl}\n\nSolutions:\n- Deploy the worker: \`wrangler deploy\`\n- Check the URL: \`frontend/main.js\``);
        } else {
            addBotMessage(`Connection error: ${error.message}`);
        }
    } finally {
        // Re-enable input and button
        // Keep the input enabled (user controls keyboard). Re-enable only the send button.
        sendButton.disabled = false;

        // Gecikmeli focus, böylece mobilde klavye tekrar açılmaz
        setTimeout(() => {
            chatInput.focus();
        }, 200); // 200ms veya 300ms uygun
    }

};

/**
 * Initialize chat functionality
 */
function initChat() {
    console.log('🔍 initChat() called');
    try {
        console.log('🔍 Looking for elements...');
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const chatMessages = document.getElementById('chatMessages');
        const notificationText = document.getElementById('notificationText');

        console.log('🔍 Elements found:', {
            chatInput: !!chatInput,
            sendButton: !!sendButton,
            chatMessages: !!chatMessages,
            notificationText: !!notificationText
        });

        // Element kontrolü
        if (!chatInput || !sendButton) {
            console.error('❌ Chat elements not found!', {
                chatInput: chatInput,
                sendButton: sendButton,
                documentReady: document.readyState
            });
            // Retry after a delay
            setTimeout(() => {
                console.log('🔄 Retrying initChat after delay...');
                initChat();
            }, 500);
            return false;
        }

        // Set current time for bot message
        const botMessageTime = document.getElementById('botMessageTime');
        if (botMessageTime) {
            botMessageTime.textContent = getCurrentTime();
        }

        // Check URL for notification message
        checkNotificationMessage();

        // Prevent focus events on sky and pigeon areas so chat doesn't resize/lag
        const sky = document.querySelector('.sky');
        const pigeonContainer = document.getElementById('pigeon3DContainer');
        const notificationMessage = document.getElementById('notificationMessage');

        const preventFocusEvent = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        // Attach to sky and clouds
        if (sky) {
            sky.addEventListener('touchstart', preventFocusEvent, { passive: false });
            sky.addEventListener('mousedown', preventFocusEvent, { passive: false });
            sky.addEventListener('click', preventFocusEvent, { passive: false });
        }

        // Attach to pigeon container
        if (pigeonContainer) {
            pigeonContainer.addEventListener('touchstart', preventFocusEvent, { passive: false });
            pigeonContainer.addEventListener('mousedown', preventFocusEvent, { passive: false });
            pigeonContainer.addEventListener('click', preventFocusEvent, { passive: false });
        }

        // Attach to notification message
        if (notificationMessage) {
            notificationMessage.addEventListener('touchstart', preventFocusEvent, { passive: false });
            notificationMessage.addEventListener('mousedown', preventFocusEvent, { passive: false });
            notificationMessage.addEventListener('click', preventFocusEvent, { passive: false });
        }

        // Prevent focus events on chat container and messages area (except input)
        const chatContainer = document.querySelector('.chat-container');
        const chatMessagesElement = document.getElementById('chatMessages');
        const chatInputContainer = document.querySelector('.chat-input-container');

        if (chatMessagesElement) {
            chatMessagesElement.addEventListener('touchstart', preventFocusEvent, { passive: false });
            chatMessagesElement.addEventListener('mousedown', preventFocusEvent, { passive: false });
            chatMessagesElement.addEventListener('click', preventFocusEvent, { passive: false });
        }

        if (chatInputContainer) {
            // Allow input to function normally, but prevent other clicks in container from triggering keyboard
            chatInputContainer.addEventListener('click', (e) => {
                // Let the input or send button handle their own clicks
                if (e.target !== chatInput && e.target !== sendButton && !sendButton.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, { passive: false });
        }

        // Send message on button click - Multiple event handlers for reliability
        console.log('🔍 Adding click event listener to sendButton');
        console.log('🔍 sendMessage function available:', typeof window.sendMessage);

        // Remove any existing onclick attribute (HTML'den gelen)
        sendButton.removeAttribute('onclick');

        // Prevent send button from stealing focus on mobile so keyboard stays open.
        // Keep the input focused on pointer/touch start (passive:false so preventDefault works).
        const keepFocusOnInput = (e) => {
            if (chatInput) {
                e.preventDefault(); // avoid the button taking focus which can close the virtual keyboard
                chatInput.focus();
            }
        };
        sendButton.addEventListener('pointerdown', keepFocusOnInput, { passive: false });
        sendButton.addEventListener('touchstart', keepFocusOnInput, { passive: false });

        // Add event listener (primary method)
        sendButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ Send button clicked (addEventListener)!');
            if (typeof window.sendMessage === 'function') {
                window.sendMessage();
            } else {
                console.error('❌ window.sendMessage is not a function!', typeof window.sendMessage);
            }
        }, false);

        // Also set onclick as fallback (for maximum compatibility)
        sendButton.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ Send button clicked (onclick)!');
            if (typeof window.sendMessage === 'function') {
                window.sendMessage();
            } else {
                console.error('❌ window.sendMessage is not a function!', typeof window.sendMessage);
            }
            return false;
        };

        console.log('✅ Event listeners added. sendMessage available:', typeof window.sendMessage);
        console.log('✅ Button element:', sendButton);

        // Send message on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                console.log('Enter key pressed');
                sendMessage();
            }
        });

        // Create Message button
        const createMessageButton = document.getElementById('createMessageButton');
        if (createMessageButton) {
            createMessageButton.addEventListener('click', () => {
                createRandomMessage();
            });
        }

        chatInput.addEventListener('focus', handleKeyboardOpen);
        chatInput.addEventListener('blur', handleKeyboardClose);

        // Track initial bot message for history
        const initialBotMessage = chatMessages?.querySelector('.message.bot-message p');
        if (initialBotMessage && conversationHistory.length === 0) {
            conversationHistory.push({
                role: 'assistant',
                content: initialBotMessage.textContent.trim()
            });
        }

        // Focus input on load
        chatInput.focus();

        console.log('✅ Chat initialized successfully');
        console.log('Send button:', sendButton);
        console.log('Chat input:', chatInput);
        return true;
    } catch (error) {
        console.error('Error in initChat:', error);
        return false;
    }
}

/**
 * Check URL parameters for notification message
 */
function checkNotificationMessage() {
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('msg');

    if (message) {
        // Decode and display notification message
        const decodedMessage = decodeURIComponent(message);
        displayNotificationMessage();

        // Also add to chat as bot message
        addBotMessage(decodedMessage);

        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        // Load today's notification if available
        loadTodaysNotification();
    }
}

/**
 * Display notification message in the sky
 */
function displayNotificationMessage() {
    const notificationText = document.getElementById('notificationText');
    if (notificationText) {
        notificationText.textContent = getGreetingForCurrentTime();
    }

    // Show notification with animation
    const notificationMessage = document.getElementById('notificationMessage');
    if (notificationMessage) {
        notificationMessage.style.opacity = '1';

        // Hide after 10 seconds
        setTimeout(() => {
            notificationMessage.style.opacity = '0.7';
        }, 10000);
    }
}

/**
 * Load today's notification message
 */
async function loadTodaysNotification() {
    try {
        // Try to get today's message from Worker
        // This would require an endpoint to get today's scheduled message
        // For now, use a default message
        displayNotificationMessage();
    } catch (error) {
        console.error('Error loading notification:', error);
    }
}

/**
 * Create a random message instantly
 */
async function createRandomMessage() {
    const button = document.getElementById('createMessageButton');
    if (button) {
        button.disabled = true;
        button.textContent = '✨ Creating...';
    }

    try {
        const workerUrl = getWorkerUrl();
        if (!workerUrl) {
            addBotMessage("⚠️ Worker URL not configured. Please check your setup.");
            return;
        }

        const response = await fetch(`${workerUrl}/generate-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });

        if (response.ok) {
            const data = await response.json();
            const message = data.message || "Hello! How are you today? 💕";

            // Display in notification area
            displayNotificationMessage();

            // Add to chat
            addBotMessage(message);
        } else {
            const errorData = await response.json().catch(() => ({}));
            addBotMessage(errorData.message || "Could not generate message. Please try again.");
        }
    } catch (error) {
        console.error('Error creating message:', error);
        addBotMessage("Error creating message. Please try again.");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = '✨ Create Message';
        }
    }
}

// Make createRandomMessage globally available
window.createRandomMessage = createRandomMessage;


/**
 * Add user message to chat
 */
function addUserMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';

    messageDiv.innerHTML = `
        <div class="message-avatar">👤</div>
        <div class="message-content">
            <p>${escapeHtml(message)}</p>
            <span class="message-time">${getCurrentTime()}</span>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    scrollToBottom();

    conversationHistory.push({
        role: 'user',
        content: message
    });
}

/**
 * Add bot message to chat
 */
function addBotMessage(message) {
    console.log('🤖 addBotMessage called with:', message);

    if (!message || message.trim() === '') {
        console.warn('⚠️ addBotMessage: Empty message, skipping');
        return;
    }

    const chatMessages = document.getElementById('chatMessages');

    if (!chatMessages) {
        console.error('❌ addBotMessage: chatMessages element not found!');
        return;
    }

    console.log('✅ addBotMessage: chatMessages found:', chatMessages);

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    // Ensure message is visible
    messageDiv.style.display = 'flex';
    messageDiv.style.opacity = '1';
    messageDiv.style.visibility = 'visible';

    messageDiv.innerHTML = `
        <div class="message-avatar">🕊️</div>
        <div class="message-content">
            <p>${escapeHtml(message)}</p>
            <span class="message-time">${getCurrentTime()}</span>
        </div>
    `;

    console.log('✅ addBotMessage: Message div created:', messageDiv);
    console.log('✅ addBotMessage: chatMessages children before:', chatMessages.children.length);

    // Append message to DOM
    chatMessages.appendChild(messageDiv);

    console.log('✅ addBotMessage: Message appended to chatMessages');
    console.log('✅ addBotMessage: chatMessages children after:', chatMessages.children.length);
    console.log('✅ addBotMessage: Last child:', chatMessages.lastElementChild);
    console.log('✅ addBotMessage: Last child classes:', chatMessages.lastElementChild?.className);
    console.log('✅ addBotMessage: Last child computed style display:', window.getComputedStyle(chatMessages.lastElementChild).display);
    console.log('✅ addBotMessage: Last child computed style opacity:', window.getComputedStyle(chatMessages.lastElementChild).opacity);
    console.log('✅ addBotMessage: Last child computed style visibility:', window.getComputedStyle(chatMessages.lastElementChild).visibility);

    // Force reflow to ensure rendering
    void chatMessages.offsetHeight;
    void messageDiv.offsetHeight;

    // Ensure message is visible after animation
    setTimeout(() => {
        messageDiv.style.opacity = '1';
        messageDiv.style.display = 'flex';
    }, 100);

    // Eğer klavye açıksa scroll etme
    if (!keyboardIsOpen) {
        scrollToBottom();
    }

    console.log('✅ addBotMessage: Scrolled to bottom, scrollTop:', chatMessages.scrollTop, 'scrollHeight:', chatMessages.scrollHeight);

    conversationHistory.push({
        role: 'assistant',
        content: message
    });
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.id = 'typingIndicator';

    typingDiv.innerHTML = `
        <div class="message-avatar">🕊️</div>
        <div class="message-content">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;

    chatMessages.appendChild(typingDiv);
    scrollToBottom();

    return typingDiv;
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator(typingDiv) {
    if (typingDiv && typingDiv.parentNode) {
        typingDiv.remove();
    }
}

/**
 * Scroll chat to bottom
 */
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Get current time string
 */
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get or create conversation ID
 */
function getConversationId() {
    let convId = sessionStorage.getItem('conversation_id');
    if (!convId) {
        convId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('conversation_id', convId);
    }
    return convId;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Hide loading overlay
 */
function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 500);
    }
}

// Initialize when DOM is ready
function initializeApp() {
    try {
        const initialized = initChat();
        // Her durumda loading overlay'i kapat (hatalar olsa bile UI göster)
        setTimeout(() => {
            hideLoadingOverlay();
        }, 500);

        if (initialized) {
            console.log('✅ App initialized successfully');
        } else {
            console.warn('⚠️ Chat initialization had issues, but UI is ready');
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        // Hata olsa bile loading overlay'i kapat
        hideLoadingOverlay();
    }
}

// DOM ready kontrolü - Multiple fallbacks
console.log('🔍 Script loaded, document.readyState:', document.readyState);

function tryInitialize() {
    console.log('🔍 tryInitialize() called');
    try {
        initializeApp();
    } catch (error) {
        console.error('❌ Error in tryInitialize:', error);
        // Retry after delay
        setTimeout(() => {
            console.log('🔄 Retrying initialization...');
            tryInitialize();
        }, 1000);
    }
}

if (document.readyState === 'loading') {
    console.log('🔍 DOM is loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ DOMContentLoaded fired');
        tryInitialize();
    });
} else {
    // DOM already ready
    console.log('🔍 DOM already ready, initializing immediately...');
    tryInitialize();
}

// Extra fallback: window.onload
window.addEventListener('load', () => {
    console.log('✅ window.load fired');
    // If init didn't attach listeners, try again after a short delay
    const sendButton = document.getElementById('sendButton');
    if (sendButton && !sendButton.onclick) {
        console.log('⚠️ Chat not initialized on load, retrying...');
        setTimeout(() => {
            tryInitialize();
        }, 500);
    }
});

// Force hide loading overlay after load as safety
window.addEventListener('load', () => {
    setTimeout(() => {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay && overlay.style.display !== 'none') {
            console.log('Force hiding loading overlay after window load');
            hideLoadingOverlay();
        }
    }, 2000);
});

// Service Worker message listener for notification clicks
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
            const message = event.data.message;
            if (message) {
                displayNotificationMessage();
                addBotMessage(message);
            }
        }
    });
}

// Keep CSS viewport variable updated and scroll if keyboard is open
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        document.body.style.setProperty('--viewport-height', `${window.visualViewport.height}px`);
        if (document.body.classList.contains('keyboard-open')) {
            scrollToBottom();
        }
    });
}

/**
 * Open model in AR (Augmented Reality)
 */
function openModelInAR() {
    try {
        const origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
        const glbUrl = `${origin}/frontend/pigeon.glb`;
        const usdzUrl = `${origin}/frontend/pigeon.usdz`; // iOS Quick Look asset - add this file to repo

        // Detect iOS (iPhone/iPad) - include Mac touch devices
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOS) {
            // Quick Look requires an <a rel="ar" href="...usdz"> click
            const a = document.createElement('a');
            a.setAttribute('rel', 'ar');
            a.setAttribute('href', usdzUrl);
            // Optional: provide a child with a link for older iOS
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 1000);
            return;
        }

        // Android: try Scene Viewer via intent link
        const sceneViewerIntent = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glbUrl)}&mode=ar_preferred#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end`;
        window.location.href = sceneViewerIntent;

        // Fallback: try to trigger model-viewer's AR button if available
    } catch (err) {
        console.warn('AR open error (primary), trying fallback:', err);
        try {
            const mv = document.querySelector('model-viewer');
            if (mv) {
                // Try programmatic API if supported
                if (typeof mv.enterAR === 'function') {
                    mv.enterAR();
                    return;
                }
                // Try to click internal AR button in shadow root
                try {
                    const shadow = mv.shadowRoot;
                    const arButton = shadow && (shadow.querySelector('[slot="ar-button"]') || shadow.querySelector('button[aria-label="view in AR"]') || shadow.querySelector('button[title*="AR"]'));
                    if (arButton) {
                        arButton.click();
                        return;
                    }
                } catch (e2) {
                    // ignore
                }
            }
        } catch (finalErr) {
            console.error('AR fallback failed:', finalErr);
        }
    }
}

// Attach AR button handler during initChat (non-invasive)
function attachArButton() {
    try {
        const arBtn = document.getElementById('viewInArButton');
        if (!arBtn) return;
        arBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openModelInAR();
        }, { passive: false });
    } catch (e) {
        console.error('attachArButton error:', e);
    }
}

const toggleButton = document.getElementById('toggleChatSize');
const chatContainer = document.querySelector('.chat-container');

function updateTogglePosition() {
    const inputContainerHeight = chatContainer.querySelector('.chat-input-container').offsetHeight;
    const chatHeight = chatContainer.offsetHeight;
    // Toggle buton input'un üstüne
    toggleButton.style.bottom = `${chatHeight}px`;
}

// Başlangıçta pozisyonu ayarla
updateTogglePosition();

toggleButton.addEventListener('click', () => {
    chatContainer.classList.toggle('minimized');
    updateTogglePosition();
});

// Ekran boyutu değişirse toggle pozisyonunu güncelle
window.addEventListener('resize', updateTogglePosition);


