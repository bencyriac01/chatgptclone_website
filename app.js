// ══════════════════════════════════════════════════════════════════════════════
// 🔑 YOUR OPENAI API KEY
// ══════════════════════════════════════════════════════════════════════════════
const OPENAI_API_KEY = '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'; // ← replace with your key (or set in .env and load via server)

// ══════════════════════════════════════════════════════════════════════════════
// 💡 SUGGESTION CARDS  — edit freely
// ══════════════════════════════════════════════════════════════════════════════
const suggestions = [
    { icon: '✍️', text: 'Write a cover letter', sub: 'for a software engineering role' },
    { icon: '🧠', text: 'Brainstorm ideas', sub: 'for a new mobile app startup' },
    { icon: '💻', text: 'Debug my code', sub: 'paste your snippet and I\'ll help' },
    { icon: '📝', text: 'Summarize this', sub: 'paste any article or text' },
    { icon: '🌍', text: 'Translate text', sub: 'to Spanish, French, or any language' },
    { icon: '😂', text: 'Tell me a joke', sub: 'something clever and funny' },
    { icon: '📊', text: 'Explain a concept', sub: 'machine learning, blockchain…' },
    { icon: '🎯', text: 'Plan my day', sub: 'create a productive schedule' },
];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const chatWindow = document.getElementById('chatWindow');
const chatScroll = document.getElementById('chatScroll');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const openSidebar = document.getElementById('openSidebar');
const overlay = document.getElementById('overlay');
const newChatBtn = document.getElementById('newChatBtn');
const newChatBtnMobile = document.getElementById('newChatBtnMobile');
const historyList = document.getElementById('historyList');

// ── State ─────────────────────────────────────────────────────────────────────
let isBotTyping = false;
let chatSessions = [];      // [{id, title, history}]
let activeChatId = null;

const SYSTEM_PROMPT = {
    role: 'system',
    content:
        'You are Nova, a helpful and concise AI assistant similar to ChatGPT. ' +
        'Be friendly, clear, and direct. Keep answers focused unless the user wants more detail.'
};

// ── Validate API key ──────────────────────────────────────────────────────────
const keyOk = OPENAI_API_KEY && OPENAI_API_KEY !== 'sk-your-api-key-here';
if (!keyOk) {
    console.warn('[Nova] No API key set — update OPENAI_API_KEY in app.js');
}

// ── Sidebar toggle (desktop: collapse, mobile: drawer) ─────────────────────
function isMobile() { return window.innerWidth < 768; }

function openSidebarFn() {
    if (isMobile()) {
        sidebar.classList.add('open');
        overlay.classList.add('show');
    } else {
        sidebar.classList.remove('collapsed');
    }
}

function closeSidebarFn() {
    if (isMobile()) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    } else {
        sidebar.classList.add('collapsed');
    }
}

sidebarToggle.addEventListener('click', () => {
    if (isMobile()) {
        closeSidebarFn();
    } else {
        sidebar.classList.toggle('collapsed');
    }
});

openSidebar.addEventListener('click', openSidebarFn);
overlay.addEventListener('click', closeSidebarFn);

// Close sidebar on mobile when window resizes to desktop
window.addEventListener('resize', () => {
    if (!isMobile()) {
        overlay.classList.remove('show');
        sidebar.classList.remove('open');
    }
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast--show'));
    setTimeout(() => {
        t.classList.remove('toast--show');
        setTimeout(() => t.remove(), 300);
    }, 2400);
}

// ── Scroll to bottom ──────────────────────────────────────────────────────────
function scrollBottom() {
    chatScroll.scrollTop = chatScroll.scrollHeight;
}

// ── Chat session helpers ──────────────────────────────────────────────────────
function createSession(firstMessage) {
    const id = Date.now();
    const title = firstMessage.length > 32
        ? firstMessage.slice(0, 32) + '…'
        : firstMessage;
    const session = { id, title, history: [SYSTEM_PROMPT] };
    chatSessions.unshift(session);
    activeChatId = id;
    renderHistory();
    return session;
}

function getActiveSession() {
    return chatSessions.find(s => s.id === activeChatId);
}

function renderHistory() {
    // Keep the label, re-render items below it
    const existing = historyList.querySelectorAll('.history-item');
    existing.forEach(el => el.remove());

    chatSessions.forEach(session => {
        const item = document.createElement('button');
        item.className = 'history-item' + (session.id === activeChatId ? ' active' : '');
        item.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span style="overflow:hidden;text-overflow:ellipsis">${session.title}</span>
    `;
        item.addEventListener('click', () => {
            if (isMobile()) closeSidebarFn();
            loadSession(session.id);
        });
        historyList.appendChild(item);
    });
}

function loadSession(id) {
    activeChatId = id;
    renderHistory();
    chatWindow.innerHTML = '';
    const session = getActiveSession();
    // Re-render all messages from history (skip system prompt)
    session.history.slice(1).forEach(msg => {
        renderMessage(msg.content, msg.role === 'user' ? 'user' : 'bot');
    });
    scrollBottom();
}

// ── New chat ──────────────────────────────────────────────────────────────────
function startNewChat() {
    activeChatId = null;
    chatWindow.innerHTML = '';
    renderWelcome();
    renderHistory();
    if (isMobile()) closeSidebarFn();
}

newChatBtn.addEventListener('click', startNewChat);
newChatBtnMobile.addEventListener('click', startNewChat);

// ── Welcome screen ────────────────────────────────────────────────────────────
function renderWelcome() {
    const wrap = document.createElement('div');
    wrap.className = 'welcome';
    wrap.id = 'welcomeScreen';

    wrap.innerHTML = `
    <div class="welcome-logo">N</div>
    <h1>How can I help you today?</h1>
    <p>Ask me anything — writing, coding, analysis, or just for fun.</p>
  `;

    // Suggestion grid (show first 4 on small screens, all 8 otherwise)
    const grid = document.createElement('div');
    grid.className = 'suggestion-grid';

    const count = window.innerWidth < 480 ? 4 : suggestions.length;
    suggestions.slice(0, count).forEach(({ icon, text, sub }) => {
        const card = document.createElement('button');
        card.className = 'sug-card';
        card.innerHTML = `
      <span class="sug-icon">${icon}</span>
      <span class="sug-text">${text}</span>
      <span class="sug-sub">${sub}</span>
    `;
        card.addEventListener('click', () => {
            if (!keyOk) { showToast('⚠️ Add your API key to app.js first'); return; }
            sendUserMessage(text);
        });
        grid.appendChild(card);
    });

    wrap.appendChild(grid);
    chatWindow.appendChild(wrap);
}

// ── Render a message into the DOM ─────────────────────────────────────────────
function renderMessage(text, role) {
    document.getElementById('welcomeScreen')?.remove();

    if (role === 'user') {
        const row = document.createElement('div');
        row.className = 'msg-group msg-user';
        const bubble = document.createElement('div');
        bubble.className = 'msg-user-bubble';
        bubble.textContent = text;
        row.appendChild(bubble);
        chatWindow.appendChild(row);
        return null;

    } else {
        const row = document.createElement('div');
        row.className = 'msg-group msg-bot';

        const avatar = document.createElement('div');
        avatar.className = 'bot-avatar';
        avatar.textContent = 'N';

        const body = document.createElement('div');
        body.className = 'bot-body';

        const name = document.createElement('div');
        name.className = 'bot-name';
        name.textContent = 'Nova';

        const textEl = document.createElement('div');
        textEl.className = 'bot-text' + (role === 'error' ? ' error' : '');
        textEl.textContent = text;

        body.appendChild(name);
        body.appendChild(textEl);
        row.appendChild(avatar);
        row.appendChild(body);
        chatWindow.appendChild(row);
        scrollBottom();
        return textEl;
    }
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function showTyping() {
    const row = document.createElement('div');
    row.className = 'msg-group msg-bot';
    row.id = 'typingRow';

    const avatar = document.createElement('div');
    avatar.className = 'bot-avatar';
    avatar.textContent = 'N';

    const body = document.createElement('div');
    body.className = 'bot-body';

    const name = document.createElement('div');
    name.className = 'bot-name';
    name.textContent = 'Nova';

    const dots = document.createElement('div');
    dots.className = 'typing-indicator';
    dots.innerHTML = '<span></span><span></span><span></span>';

    body.appendChild(name);
    body.appendChild(dots);
    row.appendChild(avatar);
    row.appendChild(body);
    chatWindow.appendChild(row);
    scrollBottom();
}

function hideTyping() {
    document.getElementById('typingRow')?.remove();
}

// ── Send message ──────────────────────────────────────────────────────────────
function sendUserMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || isBotTyping) return;
    if (!keyOk) { showToast('⚠️ Add your API key to app.js first'); return; }

    // Create session on first message
    if (!activeChatId) createSession(trimmed);

    const session = getActiveSession();

    renderMessage(trimmed, 'user');
    session.history.push({ role: 'user', content: trimmed });

    messageInput.value = '';
    autoResize();
    messageInput.focus();
    scrollBottom();

    callOpenAI(session);
}

// ── OpenAI streaming ──────────────────────────────────────────────────────────
async function callOpenAI(session) {
    isBotTyping = true;
    sendBtn.disabled = true;
    showTyping();

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: session.history,
                stream: true,
                max_tokens: 700,
                temperature: 0.7
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message || `HTTP ${res.status}`);
        }

        hideTyping();
        const textEl = renderMessage('', 'bot');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (data === '[DONE]') break;
                try {
                    const delta = JSON.parse(data).choices?.[0]?.delta?.content;
                    if (delta) {
                        full += delta;
                        textEl.textContent = full;
                        scrollBottom();
                    }
                } catch (_) { }
            }
        }

        if (full) session.history.push({ role: 'assistant', content: full });

    } catch (err) {
        hideTyping();
        const msg = err.message.includes('401')
            ? 'Invalid API key — update OPENAI_API_KEY in app.js.'
            : `Error: ${err.message}`;
        renderMessage(msg, 'error');
    } finally {
        isBotTyping = false;
        sendBtn.disabled = false;
    }
}

// ── Auto-resize textarea ──────────────────────────────────────────────────────
function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
}

messageInput.addEventListener('input', () => {
    autoResize();
    sendBtn.disabled = !messageInput.value.trim();
});

// Enter = send, Shift+Enter = newline
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!messageInput.value.trim()) return;
        sendUserMessage(messageInput.value);
    }
});

// ── Form submit ───────────────────────────────────────────────────────────────
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendUserMessage(messageInput.value);
});

// ── Init ──────────────────────────────────════════════════════════════════════
renderWelcome();
if (!keyOk) showToast('⚠️ Set OPENAI_API_KEY in app.js');

addMessage('Hi there! I am a chatbot demo. Send me a message to start.', 'bot');
