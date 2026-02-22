/* Peopole AI — frontend/chat.js v3.0 — COMPLETE & FINAL */

const API_URL     = '/api/chat';
const STORAGE_KEY = 'peopole_chats_v3';
const STAGE_KEY   = 'peopole_stage_v3';
const AI_NAME     = 'Peopole AI';

const STAGES = {
  1: { icon: "🌱", label: "Foundation",    range: "Pre-School – Class 5" },
  2: { icon: "🔍", label: "Development",   range: "Class 6 – 8" },
  3: { icon: "🎯", label: "Strategic",     range: "Class 9 – 12" },
  4: { icon: "🎓", label: "Undergraduate", range: "Bachelor's Degree" },
  5: { icon: "🔬", label: "Master's",      range: "Postgraduate" },
  6: { icon: "🏛️", label: "Doctoral",      range: "PhD Research" },
  7: { icon: "👨‍👩‍👧", label: "Parent Mode",   range: "Education & Career Guidance for Parents" }
};

const STAGE_PROMPTS = {
  1: ["Basics of learning", "Fun activities"],
  2: ["Study tips", "Subject guidance"],
  3: ["Exam prep", "Career advice"],
  4: ["University selection", "Scholarship info"],
  5: ["Research topics", "Thesis guidance"],
  6: ["Publication help", "Advanced research"],
  7: ["Parent advisory", "Education planning"]
};

const OFFLINE_REPLIES = {
  default: "⚠️ Offline mode — please reconnect to get AI responses.",
  1: "Offline: Foundation stage guidance paused.",
  2: "Offline: Development stage guidance paused.",
  3: "Offline: Strategic stage guidance paused.",
  4: "Offline: Undergraduate guidance paused.",
  5: "Offline: Master's guidance paused.",
  6: "Offline: Doctoral guidance paused.",
  7: "Offline: Parent advisory paused."
};

// ── Storage ─────────────────────────────────────────────
function loadChats() {
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : []; }
  catch (e) { return []; }
}
function saveChats() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch (e) {}
}

// ── Globals ──────────────────────────────────────────────
let chats        = loadChats();
let activeChatId = chats.length ? chats[0].id : null;
let currentStage = localStorage.getItem(STAGE_KEY) || null;
let isStreaming  = false;
let isOnline     = navigator.onLine;

const messagesEl       = document.getElementById('messages');
const inputEl          = document.getElementById('messageInput');
const sendBtn          = document.getElementById('sendBtn');
const newChatBtn       = document.getElementById('newChatBtn');
const clearBtn         = document.getElementById('clearBtn');
const chatListEl       = document.getElementById('chatList');
const chatTitleEl      = document.getElementById('chatTitle');
const topbarSubEl      = document.getElementById('topbarSub');
const menuBtn          = document.getElementById('menuBtn');
const sidebarEl        = document.getElementById('sidebar');
const overlayEl        = document.getElementById('overlay');
const stageModalEl     = document.getElementById('stageModalBackdrop');
const stageBadgeWrapEl = document.getElementById('stageBadgeWrap');
const stageBadgeEl     = document.getElementById('stageBadge');
const stageChangeBtnEl = document.getElementById('stageChangeBtn');
const offlineBarEl     = document.getElementById('offlineBar');
const statusDotEl      = document.getElementById('statusDot');

// ── Sidebar ──────────────────────────────────────────────
// CSS uses .overlay.show (not .active) — matched here
function openSidebar() {
  sidebarEl.classList.add('open');
  overlayEl.classList.add('show');
}
function closeSidebar() {
  sidebarEl.classList.remove('open');
  overlayEl.classList.remove('show');
}
function toggleSidebar() {
  sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar();
}

// ── Online Status ────────────────────────────────────────
function updateOnlineStatus() {
  if (isOnline) {
    offlineBarEl.style.display = 'none';
    statusDotEl.classList.remove('offline');
    statusDotEl.title = 'Online';
  } else {
    offlineBarEl.style.display = 'flex';
    statusDotEl.classList.add('offline');
    statusDotEl.title = 'Offline';
  }
}

// ── Stage Modal ──────────────────────────────────────────
function showStageModal() { stageModalEl.classList.remove('hidden'); }
function hideStageModal() { stageModalEl.classList.add('hidden'); }

function attachStageCards() {
  document.querySelectorAll('.stage-card').forEach(card => {
    card.addEventListener('click', () => selectStage(card.dataset.stage));
  });
}

function selectStage(stage) {
  currentStage = stage;
  localStorage.setItem(STAGE_KEY, stage);
  hideStageModal();
  applyStage(stage, true);
  if (!chats.length) createNewChat();
  else { renderSidebar(); renderMessages(); }
}

function applyStage(stage, isNew) {
  const s = STAGES[stage];
  if (!s) return;
  stageBadgeEl.textContent = `${s.icon} ${s.label}`;
  stageBadgeWrapEl.style.display = 'flex';
  topbarSubEl.textContent = `${s.icon} ${s.label} · ${s.range}`;
  if (isNew) {
    const greetings = {
      1: "🌱 Welcome to Foundation stage! I'm here to make learning fun and easy.",
      2: "🔍 Development stage selected. Let's sharpen your study skills!",
      3: "🎯 Strategic stage ready. Exam prep and career guidance starts now.",
      4: "🎓 Undergraduate guidance activated. Let's plan your university journey.",
      5: "🔬 Master's guidance activated. Ready to dive into research?",
      6: "🏛️ Doctoral research mode. Let's advance your academic work.",
      7: "👨‍👩‍👧 Parent advisory mode. I'm here to guide your child's education journey."
    };
    const greeting = greetings[stage];
    if (greeting) setTimeout(() => sendMessage(greeting, true), 400);
  }
}

// ── Chat Management ──────────────────────────────────────
function createNewChat() {
  const id = Date.now().toString();
  chats.unshift({ id, title: "New Conversation", messages: [] });
  activeChatId = id;
  saveChats();
  renderSidebar();
  renderMessages();
}

function getActiveChat() {
  return chats.find(c => c.id === activeChatId);
}

function switchChat(id) {
  activeChatId = id;
  closeSidebar();
  renderSidebar();
  renderMessages();
  if (chatTitleEl) chatTitleEl.textContent = getActiveChat()?.title || 'Conversation';
}

function clearActiveChat() {
  const chat = getActiveChat();
  if (!chat) return;
  if (!confirm('Clear this conversation?')) return;
  chat.messages = [];
  saveChats();
  renderMessages();
}

function deleteChat(id, e) {
  e.stopPropagation();
  chats = chats.filter(c => c.id !== id);
  if (activeChatId === id) activeChatId = chats.length ? chats[0].id : null;
  if (!chats.length) createNewChat();
  else { saveChats(); renderSidebar(); renderMessages(); }
}

// ── Render Sidebar ───────────────────────────────────────
function renderSidebar() {
  if (!chatListEl) return;
  chatListEl.innerHTML = '';
  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (chat.id === activeChatId ? ' active' : '');
    item.innerHTML = `
      <span class="chat-item-icon">💬</span>
      <span class="chat-item-title" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(chat.title)}</span>
      <button class="chat-delete-btn" title="Delete" style="background:none;border:none;color:#4f6180;cursor:pointer;padding:2px 5px;font-size:12px;flex-shrink:0;opacity:0;transition:opacity .2s">✕</button>
    `;
    item.addEventListener('click', () => switchChat(chat.id));
    item.addEventListener('mouseenter', () => item.querySelector('.chat-delete-btn').style.opacity = '1');
    item.addEventListener('mouseleave', () => item.querySelector('.chat-delete-btn').style.opacity = '0');
    item.querySelector('.chat-delete-btn').addEventListener('click', e => deleteChat(chat.id, e));
    chatListEl.appendChild(item);
  });
}

// ── Render Messages ──────────────────────────────────────
// CSS uses .msg.user / .msg.ai — matched here
function renderMessages() {
  if (!messagesEl) return;
  const chat = getActiveChat();
  messagesEl.innerHTML = '';

  if (!chat || !chat.messages.length) {
    const stage = STAGES[currentStage];
    const prompts = STAGE_PROMPTS[currentStage] || [];
    // CSS uses .welcome, .quick-prompts, .qp
    messagesEl.innerHTML = `
      <div class="welcome">
        <div class="welcome-logo-wrap">
          <img src="logo.jpg" alt="Peopole AI"/>
        </div>
        <h2>Welcome to <span>Peopole AI</span></h2>
        <p>${stage ? `${stage.icon} ${stage.label} · ${stage.range}` : 'Select a stage to begin'}</p>
        ${prompts.length ? `
          <div class="quick-prompts">
            ${prompts.map(p => `<button class="qp" onclick="sendMessage('${escapeHtml(p)}', false)">${p}</button>`).join('')}
          </div>` : ''}
      </div>
    `;
    return;
  }

  chat.messages.forEach(msg => appendMessageEl(msg));
  scrollBottom();
  if (chatTitleEl) chatTitleEl.textContent = chat.title;
}

// CSS structure: .msg.user / .msg.ai > .msg-avatar + .msg-body > .msg-meta + .msg-text
function appendMessageEl(msg) {
  const isUser = msg.role === 'user';
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'ai'}`;

  const avatarHtml = isUser
    ? `<div class="msg-avatar">U</div>`
    : `<div class="msg-avatar"><img src="logo.jpg" alt="AI"/></div>`;

  const content = isUser ? escapeHtml(msg.content) : formatMarkdown(msg.content);
  const time = msg.time || nowTime();

  div.innerHTML = `
    ${avatarHtml}
    <div class="msg-body">
      <div class="msg-meta">${isUser ? 'You' : AI_NAME} · ${time}</div>
      <div class="msg-text">${content}</div>
    </div>
  `;
  messagesEl.appendChild(div);
}

// ── Typing Indicator ─────────────────────────────────────
// CSS uses .typing-wrap > .typing-avatar + .typing-bubble > span × 3
function showTyping() {
  removeTyping();
  const div = document.createElement('div');
  div.className = 'typing-wrap';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="typing-avatar"><img src="logo.jpg" alt="AI"/></div>
    <div class="typing-bubble">
      <span></span><span></span><span></span>
    </div>
  `;
  messagesEl.appendChild(div);
  scrollBottom();
}

function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

// ── Send Message ─────────────────────────────────────────
async function sendMessage(overrideText, isSystem = false) {
  if (isStreaming) return;

  const text = (typeof overrideText === 'string') ? overrideText.trim() : inputEl.value.trim();
  if (!text) return;

  if (!isSystem && typeof overrideText !== 'string') {
    inputEl.value = '';
    inputEl.style.height = 'auto';
  }

  if (!isOnline) {
    showToast(OFFLINE_REPLIES[currentStage] || OFFLINE_REPLIES.default);
    return;
  }

  const chat = getActiveChat();
  if (!chat) return;

  if (!isSystem) {
    const userMsg = { role: 'user', content: text, time: nowTime() };
    chat.messages.push(userMsg);
    if (chat.messages.filter(m => m.role === 'user').length === 1) {
      chat.title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
    }
    saveChats();
    renderSidebar();
    appendMessageEl(userMsg);
    scrollBottom();
  }

  isStreaming = true;
  sendBtn.disabled = true;
  showTyping();

  const history = chat.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));

  const stage = STAGES[currentStage];
  const systemPrompt = stage
    ? `You are ${AI_NAME}, an expert academic and visa consultant from Earth Solutions Visa Zone, Dhaka, Bangladesh. You are helping a student at ${stage.label} level (${stage.range}). Be concise, warm, and give practical guidance tailored to their stage. For visa queries always recommend verifying with official sources.`
    : `You are ${AI_NAME}, an expert academic and visa consultant from Earth Solutions Visa Zone, Dhaka, Bangladesh.`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, system: systemPrompt, stage: currentStage })
    });

    if (!res.ok) throw new Error(`Server error ${res.status}`);

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
      removeTyping();
      const aiMsg = { role: 'assistant', content: '', time: nowTime() };
      chat.messages.push(aiMsg);

      // Create streaming bubble using correct CSS classes
      const div = document.createElement('div');
      div.className = 'msg ai';
      div.innerHTML = `
        <div class="msg-avatar"><img src="logo.jpg" alt="AI"/></div>
        <div class="msg-body">
          <div class="msg-meta">${AI_NAME} · ${aiMsg.time}</div>
          <div class="msg-text" id="streamTarget"></div>
        </div>
      `;
      messagesEl.appendChild(div);
      const streamTarget = document.getElementById('streamTarget');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices?.[0]?.delta?.content
                       || parsed.delta?.text
                       || parsed.content || '';
            if (chunk) {
              aiMsg.content += chunk;
              streamTarget.innerHTML = formatMarkdown(aiMsg.content);
              scrollBottom();
            }
          } catch (_) {}
        }
      }

      streamTarget.removeAttribute('id');
      saveChats();

    } else {
      const data = await res.json();
      const reply = data.content
        || data.message
        || data.choices?.[0]?.message?.content
        || data.reply
        || '⚠️ No response received.';

      removeTyping();
      const aiMsg = { role: 'assistant', content: reply, time: nowTime() };
      chat.messages.push(aiMsg);
      saveChats();
      appendMessageEl(aiMsg);
      scrollBottom();
    }

  } catch (err) {
    console.error('sendMessage error:', err);
    removeTyping();
    const errMsg = {
      role: 'assistant',
      content: `⚠️ Could not reach the server: ${err.message}. Please check your connection and try again.`,
      time: nowTime()
    };
    chat.messages.push(errMsg);
    saveChats();
    appendMessageEl(errMsg);
    scrollBottom();
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ── Utilities ────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    .replace(/^### (.+)$/gm,   '<h4>$1</h4>')
    .replace(/^## (.+)$/gm,    '<h3>$1</h3>')
    .replace(/^# (.+)$/gm,     '<h2>$1</h2>')
    .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>');
}
function showToast(msg) {
  let t = document.getElementById('paToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'paToast';
    t.style.cssText = 'position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:#1a2a45;color:#e8edf5;padding:11px 22px;border-radius:10px;font-size:13px;z-index:9999;max-width:92vw;text-align:center;border:1px solid rgba(255,255,255,.1);box-shadow:0 4px 16px rgba(0,0,0,.4);font-family:Outfit,sans-serif;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

// ── Input Setup ──────────────────────────────────────────
function setupAutoResize() {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  });
}
function setupKeyboard() {
  if (!inputEl) return;
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// ── Events ───────────────────────────────────────────────
sendBtn.addEventListener('click', () => sendMessage());
newChatBtn.addEventListener('click', createNewChat);
clearBtn.addEventListener('click', clearActiveChat);
menuBtn.addEventListener('click', toggleSidebar);
overlayEl.addEventListener('click', closeSidebar);
stageChangeBtnEl.addEventListener('click', showStageModal);

// ── Init (always last) ───────────────────────────────────
function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  window.addEventListener('online',  () => { isOnline = true;  updateOnlineStatus(); });
  window.addEventListener('offline', () => { isOnline = false; updateOnlineStatus(); });
  updateOnlineStatus();

  if (!currentStage) showStageModal();
  else {
    hideStageModal();
    applyStage(currentStage, false);
    if (!chats.length) createNewChat();
    else { renderSidebar(); renderMessages(); }
  }

  setupAutoResize();
  setupKeyboard();
  attachStageCards();
}

init();
