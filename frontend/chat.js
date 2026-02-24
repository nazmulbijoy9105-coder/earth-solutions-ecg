// frontend/chat.js — Peopole AI v8.0
// Earth Solutions Visa Zone | Hybrid FAQ+AI | EN/BN | Push Notifications | Analytics
'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// 0. LANGUAGE CONFIG
// ═══════════════════════════════════════════════════════════════════════════
const LANG = {
  en: {
    chatTitle:  'Peopole AI',
    topbarSub:  'Earth Solutions Visa Zone, Dhaka',
    newChat:    'New Conversation',
    change:     'Change',
    clearLabel: 'Clear',
    sendLabel:  'Send',
    placeholder: 'Ask about universities, visas, scholarships, SOP writing…',
    disclaimer:  'Peopole AI can make mistakes. Always verify important decisions with an official consultant.',
    faqToggle:   'Common Questions',
    pricingBtn:  'Pricing',
    langBtn:     'বাংলা',
    pmTitle:     'Service Plans & Pricing',
    pmSub:       'Earth Solutions Visa Zone — Choose what fits you',
    pmNote:      '⚠️ No visa or admission guarantee. Results depend on individual eligibility.',
    pmFullLink:  'View Full Pricing Page →',
    thinking:    'Thinking…',
    offlineMsg:  'You are offline. Please check your connection.',
    errorMsg:    'Connection issue. Please try again.',
    pushPrompt:  '🔔 Get updates & scholarship alerts?',
    pushAllow:   'Allow Notifications',
    pushDeny:    'No Thanks',
    welcomeMsg:  `👋 Welcome to **Peopole AI** — your expert academic and visa consultant from **Earth Solutions Visa Zone, Dhaka**.

I can help you with:
• University selection & admissions
• Visa requirements & step-by-step guidance
• Scholarship opportunities & funding
• SOP, CV & document preparation
• Study abroad pathways & country comparisons

Select your academic stage to begin, or ask me anything directly!`,
    stageNames: {
      1: '🌱 Foundation (Pre-School – Class 5)',
      2: '🔍 Development (Class 6–8)',
      3: '🎯 Strategic (Class 9–12)',
      4: '🎓 Undergraduate (Bachelor\'s)',
      5: '🔬 Master\'s (Postgraduate)',
      6: '🏛️ Doctoral (PhD)',
      7: '👨‍👩‍👧 Parent Mode'
    }
  },
  bn: {
    chatTitle:  'পিপল এআই',
    topbarSub:  'আর্থ সলিউশনস ভিসা জোন, ঢাকা',
    newChat:    'নতুন কথোপকথন',
    change:     'পরিবর্তন',
    clearLabel: 'মুছুন',
    sendLabel:  'পাঠান',
    placeholder: 'বিশ্ববিদ্যালয়, ভিসা, বৃত্তি, এসওপি সম্পর্কে জিজ্ঞাসা করুন…',
    disclaimer:  'পিপল এআই ভুল করতে পারে। সকল গুরুত্বপূর্ণ সিদ্ধান্ত একজন অফিসিয়াল কনসালট্যান্টের সাথে যাচাই করুন।',
    faqToggle:   'সাধারণ প্রশ্ন',
    pricingBtn:  'মূল্য তালিকা',
    langBtn:     'English',
    pmTitle:     'সেবা পরিকল্পনা ও মূল্য',
    pmSub:       'আর্থ সলিউশনস ভিসা জোন — আপনার জন্য সঠিকটি বেছে নিন',
    pmNote:      '⚠️ ভিসা বা ভর্তির কোনো গ্যারান্টি নেই। ফলাফল ব্যক্তির যোগ্যতার উপর নির্ভর করে।',
    pmFullLink:  'সম্পূর্ণ মূল্য তালিকা দেখুন →',
    thinking:    'চিন্তা করছি…',
    offlineMsg:  'আপনি অফলাইনে আছেন। সংযোগ পরীক্ষা করুন।',
    errorMsg:    'সংযোগ সমস্যা। আবার চেষ্টা করুন।',
    pushPrompt:  '🔔 আপডেট ও বৃত্তির নোটিফিকেশন পেতে চান?',
    pushAllow:   'অনুমতি দিন',
    pushDeny:    'না, ধন্যবাদ',
    welcomeMsg:  `👋 **পিপল এআই**-তে আপনাকে স্বাগতম — **আর্থ সলিউশনস ভিসা জোন, ঢাকা** থেকে আপনার বিশেষজ্ঞ শিক্ষা ও ভিসা পরামর্শদাতা।

আমি আপনাকে সাহায্য করতে পারি:
• বিশ্ববিদ্যালয় নির্বাচন ও ভর্তি প্রক্রিয়া
• ভিসার প্রয়োজনীয়তা ও ধাপে ধাপে গাইডেন্স
• বৃত্তির সুযোগ ও আর্থিক সহায়তা
• এসওপি, সিভি ও ডকুমেন্ট প্রস্তুতি
• বিদেশে পড়াশোনার পথনির্দেশ ও দেশ তুলনা

শুরু করতে আপনার একাডেমিক পর্যায় নির্বাচন করুন, বা সরাসরি প্রশ্ন করুন!`,
    stageNames: {
      1: '🌱 ফাউন্ডেশন (প্রি-স্কুল – ক্লাস ৫)',
      2: '🔍 ডেভেলপমেন্ট (ক্লাস ৬–৮)',
      3: '🎯 স্ট্র্যাটেজিক (ক্লাস ৯–১২)',
      4: '🎓 আন্ডারগ্রাজুয়েট (ব্যাচেলর)',
      5: '🔬 মাস্টার্স (পোস্টগ্র্যাজুয়েট)',
      6: '🏛️ ডক্টরাল (পিএইচডি)',
      7: '👨‍👩‍👧 পেরেন্ট মোড'
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. FAQ QUICK CHIPS — per stage (client-side instant questions)
// ═══════════════════════════════════════════════════════════════════════════
const STAGE_FAQ = {
  1: {
    en: ['Which is better — English medium or Bangla medium?', 'When should my child start IELTS preparation?', 'What subjects build the best foundation for studying abroad?', 'What is Cambridge Primary?'],
    bn: ['ইংলিশ মিডিয়াম নাকি বাংলা মিডিয়াম কোনটা ভালো?', 'আমার সন্তানের আইইএলটিএস প্রস্তুতি কখন শুরু করা উচিত?', 'বিদেশে পড়াশোনার জন্য কোন বিষয়গুলো সবচেয়ে গুরুত্বপূর্ণ?']
  },
  2: {
    en: ['How do I build a strong academic profile at this stage?', 'When should I start IELTS prep — Class 6 or later?', 'What extracurricular activities help for foreign university admission?', 'O-level vs SSC — which is better for studying abroad?'],
    bn: ['এই পর্যায়ে কিভাবে ভালো একাডেমিক প্রোফাইল তৈরি করব?', 'আইইএলটিএস প্রস্তুতি কখন শুরু করা উচিত?', 'কোন এক্সট্রা কারিকুলার কার্যক্রম বিদেশে ভর্তিতে সাহায্য করে?']
  },
  3: {
    en: ['What GPA do I need for Australian universities?', 'Should I take SAT or A-levels for USA admission?', 'What IELTS score do I need for UK universities?', 'How many universities should I apply to?'],
    bn: ['অস্ট্রেলিয়ান বিশ্ববিদ্যালয়ের জন্য কত জিপিএ দরকার?', 'যুক্তরাষ্ট্রে ভর্তির জন্য স্যাট নাকি এ-লেভেল নেওয়া উচিত?', 'যুক্তরাজ্যের বিশ্ববিদ্যালয়ের জন্য কত আইইএলটিএস স্কোর দরকার?']
  },
  4: {
    en: ['What IELTS band do I need for Canada undergraduate?', 'Can I work part-time while studying in Australia?', 'How much does it cost to study in the UK?', 'What is the PR pathway after studying in Canada?'],
    bn: ['কানাডায় আন্ডারগ্র্যাড পড়তে কত আইইএলটিএস দরকার?', 'অস্ট্রেলিয়ায় পড়াশোনা করার সময় কি পার্ট-টাইম কাজ করা যায়?', 'যুক্তরাজ্যে পড়াশোনার খরচ কত?', 'কানাডায় পড়ার পর পিআর পাওয়ার সুযোগ কেমন?']
  },
  5: {
    en: ['What GRE score do I need for a top Master\'s programme?', 'How do I write a strong SOP for a Master\'s application?', 'Which countries offer funded Master\'s degrees?', 'How do I find universities offering DAAD scholarships?'],
    bn: ['শীর্ষ মাস্টার্স প্রোগ্রামের জন্য কত জিআরই স্কোর দরকার?', 'মাস্টার্স আবেদনের জন্য শক্তিশালী এসওপি কিভাবে লিখব?', 'কোন দেশে ফান্ডেড মাস্টার্স ডিগ্রি পাওয়া যায়?']
  },
  6: {
    en: ['How do I find a PhD supervisor in Germany?', 'What is a research proposal and how long should it be?', 'Which fully funded PhD scholarships accept Bangladeshi students?', 'How do I write a cold email to a professor?'],
    bn: ['জার্মানিতে পিএইচডি সুপারভাইজার কিভাবে খুঁজব?', 'রিসার্চ প্রপোজাল কি এবং কত দীর্ঘ হওয়া উচিত?', 'কোন ফুলি ফান্ডেড পিএইচডি স্কলারশিপে বাংলাদেশি শিক্ষার্থীরা আবেদন করতে পারে?']
  },
  7: {
    en: ['What is the total cost of education abroad in BDT?', 'Which country is safest for Bangladeshi students?', 'Can I visit my child while they study abroad?', 'Will their foreign degree be recognized in Bangladesh?'],
    bn: ['বিদেশে পড়াশোনার মোট খরচ বাংলাদেশি টাকায় কত?', 'বাংলাদেশি শিক্ষার্থীদের জন্য কোন দেশ সবচেয়ে নিরাপদ?', 'সন্তানের পড়াশোনার সময় কি আমি সেখানে যেতে পারব?', 'বিদেশি ডিগ্রি কি বাংলাদেশে স্বীকৃত হবে?']
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. OPTIONAL AD BANNERS — commercial engagement / revenue
//    Replace adContent with real sponsor deals or keep as internal promos
//    Set ADS_ENABLED = false to disable completely
// ═══════════════════════════════════════════════════════════════════════════
const ADS_ENABLED = true;
const AD_SLOTS = [
  {
    id: 'promo_structured',
    trigger: 4,   // show after this many AI messages
    en: { text: '📋 **Ready for a personalised plan?** Our Structured Guidance (৳100–৳500) includes human consultant review + AI risk analysis. [Get Started →](https://wa.me/8801535778111?text=I+want+Structured+Guidance)', cta: 'Get Structured Plan' },
    bn: { text: '📋 **ব্যক্তিগতকৃত পরিকল্পনার জন্য প্রস্তুত?** আমাদের স্ট্রাকচার্ড গাইডেন্স (৳১০০–৳৫০০)-এ মানব কনসালট্যান্ট পর্যালোচনা + এআই রিস্ক বিশ্লেষণ অন্তর্ভুক্ত। [শুরু করুন →](https://wa.me/8801535778111)', cta: 'স্ট্রাকচার্ড প্ল্যান নিন' }
  },
  {
    id: 'promo_mentor',
    trigger: 8,
    en: { text: '🎓 **Want a matched mentor?** Our Mid-Tier Mentorship connects you with alumni from your target country who\'ve walked this exact path. [Book Consultation →](https://wa.me/8801535778111?text=I+want+mentorship)', cta: 'Book a Mentor' },
    bn: { text: '🎓 **একজন মেন্টর চান?** আমাদের মিড-টায়ার মেন্টরশিপে আপনাকে আপনার লক্ষ্য দেশের প্রাক্তন শিক্ষার্থীর সাথে সংযুক্ত করা হয়। [পরামর্শ বুক করুন →](https://wa.me/8801535778111)', cta: 'মেন্টর বুক করুন' }
  },
  {
    id: 'promo_whatsapp',
    trigger: 12,
    en: { text: '💬 **Get faster answers on WhatsApp!** Send your documents and get a detailed assessment from our human consultants. [Chat Now →](https://wa.me/8801535778111)', cta: 'WhatsApp Us' },
    bn: { text: '💬 **হোয়াটসঅ্যাপে দ্রুত উত্তর পান!** আপনার ডকুমেন্ট পাঠান এবং মানব কনসালট্যান্টের কাছ থেকে বিস্তারিত মূল্যায়ন নিন। [এখনই চ্যাট করুন →](https://wa.me/8801535778111)', cta: 'হোয়াটসঅ্যাপ করুন' }
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. STATE
// ═══════════════════════════════════════════════════════════════════════════
let lang       = 'en';
let stage      = null;
let memory     = [];   // conversation history sent to server
let isTyping   = false;
let isOnline   = navigator.onLine;
let aiMsgCount = 0;    // for ad slot triggers
let userId     = localStorage.getItem('ppl_uid') || (() => {
  const id = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('ppl_uid', id);
  return id;
})();
let pushSubscription = null;

// ═══════════════════════════════════════════════════════════════════════════
// 4. DOM ELEMENT CACHE
// ═══════════════════════════════════════════════════════════════════════════
const els = {
  get messages()         { return document.getElementById('messages'); },
  get messageInput()     { return document.getElementById('messageInput'); },
  get sendBtn()          { return document.getElementById('sendBtn'); },
  get langBtn()          { return document.getElementById('langBtn'); },
  get clearBtn()         { return document.getElementById('clearBtn'); },
  get newChatBtn()       { return document.getElementById('newChatBtn'); },
  get chatTitle()        { return document.getElementById('chatTitle'); },
  get topbarSub()        { return document.getElementById('topbarSub'); },
  get disclaimerEl()     { return document.getElementById('disclaimerEl'); },
  get faqToggleLabel()   { return document.getElementById('faqToggleLabel'); },
  get faqPanel()         { return document.getElementById('faqPanel'); },
  get faqArrow()         { return document.getElementById('faqArrow'); },
  get sidebar()          { return document.getElementById('sidebar'); },
  get overlay()          { return document.getElementById('overlay'); },
  get menuBtn()          { return document.getElementById('menuBtn'); },
  get stageBadgeWrap()   { return document.getElementById('stageBadgeWrap'); },
  get stageBadge()       { return document.getElementById('stageBadge'); },
  get stageChangeBtn()   { return document.getElementById('stageChangeBtn'); },
  get stageModalBackdrop() { return document.getElementById('stageModalBackdrop'); },
  get offlineBar()       { return document.getElementById('offlineBar'); },
  get statusDot()        { return document.getElementById('statusDot'); },
  get pricingModalBackdrop() { return document.getElementById('pricingModalBackdrop'); },
  get pricingBtnLabel()  { return document.getElementById('pricingBtnLabel'); },
  get pmTitle()          { return document.getElementById('pmTitle'); },
  get pmSub()            { return document.getElementById('pmSub'); },
  get pmNote()           { return document.getElementById('pmNote'); },
  get pmFullLink()       { return document.getElementById('pmFullLink'); }
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════════════════
function renderMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    // Standard markdown links [text](url)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Bare URLs in brackets [url] — e.g. [www.example.com]
    .replace(/\[([^\]]*(?:www\.|https?:\/\/)[^\]]+)\]/g, (_, url) => {
      const href = url.startsWith('http') ? url : 'https://' + url;
      return `<a href="${href}" target="_blank" rel="noopener">${url}</a>`;
    })
    // Plain bare URLs not already linked
    .replace(/(?<!href=")(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  const lines = html.split('\n');
  const out   = [];
  let inList  = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[•\-\*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + trimmed.replace(/^[•\-\*]\s|^\d+\.\s/, '') + '</li>');
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      if (trimmed) out.push('<p>' + trimmed + '</p>');
      else out.push('<br>');
    }
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. MESSAGE RENDERING
// ═══════════════════════════════════════════════════════════════════════════
function addMessage(role, text, streaming = false) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  const textEl = document.createElement('div');
  textEl.className = 'msg-text';

  if (streaming) {
    textEl.classList.add('typing');
    textEl.innerHTML = '<span></span><span></span><span></span>';
  } else {
    textEl.innerHTML = renderMarkdown(text);
  }

  const timeEl = document.createElement('div');
  timeEl.className = 'msg-time';
  timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  bubble.appendChild(textEl);
  bubble.appendChild(timeEl);
  wrap.appendChild(bubble);
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
  return { wrap, textEl };
}

function addAdBanner(ad) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ad-banner';
  wrap.dataset.adId = ad.id;
  const content = lang === 'bn' ? ad.bn : ad.en;
  wrap.innerHTML = `
    <div class="ad-inner">
      <div class="ad-label">Sponsored</div>
      <div class="ad-text">${renderMarkdown(content.text)}</div>
      <button class="ad-dismiss" onclick="this.closest('.ad-banner').remove()">✕</button>
    </div>`;
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
  trackEvent('ad_impression', { adId: ad.id, stage, lang });
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. SEND MESSAGE
// ═══════════════════════════════════════════════════════════════════════════
async function sendMessage() {
  const input = els.messageInput;
  const text  = input.value.trim();
  if (!text || isTyping) return;

  if (!isOnline) { addMessage('assistant', LANG[lang].offlineMsg); return; }

  addMessage('user', text);
  memory.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';

  isTyping = true;
  if (els.sendBtn) els.sendBtn.disabled = true;
  const { wrap: typingWrap, textEl: typingEl } = addMessage('assistant', '', true);

  trackEvent('message_sent', { stage, lang, messageLength: text.length });

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        messages: memory.slice(-20),
        stage,
        lang
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';
    let firstChunk = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) throw new Error(parsed.error);
          const token = parsed.choices?.[0]?.delta?.content || '';
          if (token) {
            if (firstChunk) {
              typingEl.classList.remove('typing');
              typingEl.innerHTML = '';
              firstChunk = false;
            }
            fullText += token;
            typingEl.innerHTML = renderMarkdown(fullText);
            els.messages.scrollTop = els.messages.scrollHeight;
          }
        } catch {}
      }
    }

    if (fullText) {
      memory.push({ role: 'assistant', content: fullText });
      aiMsgCount++;
      maybeShowAd();
    }

  } catch (err) {
    typingWrap.remove();
    addMessage('assistant', LANG[lang].errorMsg);
    console.error('[Chat]', err);
  } finally {
    isTyping = false;
    if (els.sendBtn) els.sendBtn.disabled = false;
    if (els.messageInput) els.messageInput.focus();
  }
}

function maybeShowAd() {
  if (!ADS_ENABLED) return;
  for (const ad of AD_SLOTS) {
    if (aiMsgCount === ad.trigger) {
      // Don't show if already dismissed
      if (!document.querySelector(`.ad-banner[data-ad-id="${ad.id}"]`)) {
        setTimeout(() => addAdBanner(ad), 800);
      }
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. STAGE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
function showStageModal() {
  const backdrop = els.stageModalBackdrop;
  if (backdrop) backdrop.classList.remove('hidden');
}
function hideStageModal() {
  const backdrop = els.stageModalBackdrop;
  if (backdrop) backdrop.classList.add('hidden');
}
function selectStage(s) {
  stage = s;
  const name = LANG[lang].stageNames[s];
  if (els.stageBadge)     els.stageBadge.textContent = name;
  if (els.stageBadgeWrap) els.stageBadgeWrap.style.display = 'flex';
  hideStageModal();
  buildFAQPanel();
  trackEvent('stage_selected', { stage: s, lang });
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. FAQ PANEL
// ═══════════════════════════════════════════════════════════════════════════
function buildFAQPanel() {
  const panel = els.faqPanel;
  if (!panel) return;
  panel.innerHTML = '';
  const questions = stage && STAGE_FAQ[stage] ? (STAGE_FAQ[stage][lang] || STAGE_FAQ[stage].en) : [];
  if (!questions.length) return;
  questions.forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'qp';
    btn.textContent = q;
    btn.onclick = () => {
      if (els.messageInput) { els.messageInput.value = q; sendMessage(); }
    };
    panel.appendChild(btn);
  });
}

let faqOpen = false;
function toggleFAQ() {
  faqOpen = !faqOpen;
  const panel = els.faqPanel;
  const arrow = els.faqArrow;
  if (panel) panel.style.display = faqOpen ? 'flex' : 'none';
  if (arrow) arrow.textContent   = faqOpen ? '▴' : '▾';
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. LANGUAGE TOGGLE
// ═══════════════════════════════════════════════════════════════════════════
function setLang(l) {
  lang = l;
  const t = LANG[l];
  document.body.classList.toggle('bn-mode', l === 'bn');

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('chatTitle',      t.chatTitle);
  set('topbarSub',      t.topbarSub);
  set('newChatBtn',     t.newChat);
  set('faqToggleLabel', t.faqToggle);
  set('pricingBtnLabel',t.pricingBtn);
  set('disclaimerEl',   t.disclaimer);
  set('pmTitle',        t.pmTitle);
  set('pmSub',          t.pmSub);
  set('pmNote',         t.pmNote);
  if (els.pmFullLink) els.pmFullLink.textContent = t.pmFullLink;
  if (els.langBtn)    els.langBtn.textContent    = t.langBtn;
  if (els.messageInput) els.messageInput.placeholder = t.placeholder;
  if (stage && els.stageBadge) els.stageBadge.textContent = t.stageNames[stage];
  buildFAQPanel();
  trackEvent('language_toggle', { lang: l });
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. PRICING MODAL
// ═══════════════════════════════════════════════════════════════════════════
window.openPricingModal = function() {
  const m = els.pricingModalBackdrop;
  if (m) m.classList.remove('hidden');
  trackEvent('pricing_modal_open', { stage, lang });
};
window.closePricingModal = function() {
  const m = els.pricingModalBackdrop;
  if (m) m.classList.add('hidden');
};
window.closePricingOnBackdrop = function(e) {
  if (e.target === els.pricingModalBackdrop) window.closePricingModal();
};
window.selectPlan = function(planId) {
  document.querySelectorAll('.pm-plan').forEach(el => el.classList.remove('pm-selected'));
  const el = document.querySelector(`.pm-plan.${planId}`);
  if (el) el.classList.add('pm-selected');
  trackEvent('plan_selected', { planId, stage, lang });
};

// ═══════════════════════════════════════════════════════════════════════════
// 12. PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════
async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (localStorage.getItem('push_asked') === 'yes') return;

  // Ask after 30 seconds
  setTimeout(showPushPrompt, 30000);
}

function showPushPrompt() {
  const t = LANG[lang];
  const banner = document.createElement('div');
  banner.className = 'push-prompt';
  banner.innerHTML = `
    <span>${t.pushPrompt}</span>
    <button class="push-allow-btn" id="pushAllow">${t.pushAllow}</button>
    <button class="push-deny-btn"  id="pushDeny">${t.pushDeny}</button>`;
  document.body.appendChild(banner);

  document.getElementById('pushAllow').onclick = async () => {
    banner.remove();
    localStorage.setItem('push_asked', 'yes');
    await requestPushPermission();
  };
  document.getElementById('pushDeny').onclick = () => {
    banner.remove();
    localStorage.setItem('push_asked', 'yes');
    trackEvent('push_denied', { stage, lang });
  };
}

async function requestPushPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg = await navigator.serviceWorker.ready;

    // Get VAPID public key from server
    const keyRes  = await fetch('/api/push/vapid-public-key');
    const { key } = await keyRes.json();

    if (!key || key.startsWith('REPLACE')) {
      console.warn('[Push] VAPID not configured on server');
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });

    pushSubscription = sub;

    await fetch('/api/push/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription: sub, userId, stage, lang })
    });

    trackEvent('push_granted', { stage, lang });
  } catch (e) {
    console.error('[Push] Subscribe failed:', e);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. ANALYTICS — built-in (no Google Analytics)
// ═══════════════════════════════════════════════════════════════════════════
function trackEvent(name, meta) {
  try {
    fetch('/api/analytics/event', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, meta })
    }).catch(() => {});
  } catch {}
}
function trackPageview() {
  try {
    fetch('/api/analytics/pageview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path: location.pathname, referrer: document.referrer })
    }).catch(() => {});
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. CLEAR CONVERSATION
// ═══════════════════════════════════════════════════════════════════════════
function clearConversation() {
  if (els.messages) { els.messages.innerHTML = ''; memory = []; aiMsgCount = 0; }
  addMessage('assistant', LANG[lang].welcomeMsg);
}

// ═══════════════════════════════════════════════════════════════════════════
// 15. SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════
function toggleSidebar() {
  const open = els.sidebar.classList.toggle('open');
  els.overlay.classList.toggle('active', open);
}
function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.overlay.classList.remove('active');
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. AUTO-RESIZE TEXTAREA
// ═══════════════════════════════════════════════════════════════════════════
function autoResize() {
  const el = els.messageInput;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

// ═══════════════════════════════════════════════════════════════════════════
// 17. ONLINE/OFFLINE
// ═══════════════════════════════════════════════════════════════════════════
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  if (els.offlineBar) els.offlineBar.style.display = isOnline ? 'none' : 'flex';
  if (els.statusDot) {
    els.statusDot.style.background = isOnline ? 'var(--teal, #1ec8b0)' : '#e05c7a';
    els.statusDot.title = isOnline ? 'Online' : 'Offline';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 18. EVENT BINDING
// ═══════════════════════════════════════════════════════════════════════════
function bindEvents() {
  document.querySelectorAll('.stage-card').forEach(card => {
    card.addEventListener('click', () => selectStage(parseInt(card.dataset.stage)));
  });
  if (els.stageChangeBtn) els.stageChangeBtn.addEventListener('click', showStageModal);
  if (els.newChatBtn) els.newChatBtn.addEventListener('click', () => { clearConversation(); closeSidebar(); });
  if (els.menuBtn)    els.menuBtn.addEventListener('click', toggleSidebar);
  if (els.overlay)    els.overlay.addEventListener('click', closeSidebar);
  if (els.langBtn)    els.langBtn.addEventListener('click', () => setLang(lang === 'en' ? 'bn' : 'en'));
  if (els.clearBtn)   els.clearBtn.addEventListener('click', clearConversation);
  if (els.sendBtn)    els.sendBtn.addEventListener('click', sendMessage);
  if (els.messageInput) {
    els.messageInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    els.messageInput.addEventListener('input', autoResize);
  }
  window.addEventListener('online',  updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  // Close stage modal on backdrop click
  const backdrop = els.stageModalBackdrop;
  if (backdrop) backdrop.addEventListener('click', e => { if (e.target === backdrop) hideStageModal(); });
}

// ═══════════════════════════════════════════════════════════════════════════
// 19. SERVICE WORKER REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('[SW] Registered:', reg.scope);
    }).catch(e => console.warn('[SW] Registration failed:', e));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 20. INIT
// ═══════════════════════════════════════════════════════════════════════════
function init() {
  registerSW();
  bindEvents();
  updateOnlineStatus();
  setLang('en');
  buildFAQPanel();
  addMessage('assistant', LANG.en.welcomeMsg);
  setTimeout(showStageModal, 500);
  trackPageview();
  initPush();
}

document.addEventListener('DOMContentLoaded', init);
