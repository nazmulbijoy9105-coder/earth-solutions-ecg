// frontend/chat.js — Peopole AI v9.0 PREMIUM
// Earth Solutions Visa Zone | Hybrid FAQ+AI | EN/BN | Push | Analytics
// Premium: Avatars • Streaming cursor • Suggested replies • Empty state • Glass UI
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
    welcomeMsg:  `👋 **Welcome to Peopole AI** — Earth Solutions Visa Zone, Dhaka.

I'm not just an information bot. I work as your **personal academic amplifier** — I find your strengths, understand your challenges, and build a path that fits *you specifically*.

**Tell me about yourself:**
• How old are you, and what class/level are you in?
• What subject or career excites you most?
• What feels hardest right now — studies, language, finances, or direction?

*Every student is different. Your journey starts with your story — not a template.*

🌱 Or select your academic stage below to begin.`,
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
    welcomeMsg:  `👋 **পিপল এআই**-তে আপনাকে স্বাগতম — আর্থ সলিউশনস ভিসা জোন, ঢাকা।

আমি শুধু তথ্য দেওয়ার বট নই। আমি আপনার **ব্যক্তিগত একাডেমিক অ্যাম্পলিফায়ার** — আপনার শক্তি খুঁজে বের করি, দুর্বলতা বুঝি, এবং আপনার জন্য সঠিক পথ তৈরি করি।

**আপনার সম্পর্কে বলুন:**
• আপনার বয়স কত এবং কোন ক্লাস বা স্তরে আছেন?
• কোন বিষয় বা ক্যারিয়ার আপনাকে সবচেয়ে বেশি আগ্রহী করে?
• এখন সবচেয়ে কঠিন কোনটা — পড়াশোনা, ভাষা, অর্থ, নাকি দিকনির্দেশনা?

*প্রতিটি শিক্ষার্থী আলাদা। আপনার যাত্রা শুরু হয় আপনার গল্প থেকে — কোনো টেমপ্লেট থেকে নয়।*

🌱 অথবা নিচে আপনার একাডেমিক পর্যায় বেছে নিন।`,
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
// 1. FAQ QUICK CHIPS — per stage
// ═══════════════════════════════════════════════════════════════════════════
const STAGE_FAQ = {
  1: {
    en: ['Which is better — English medium or Bangla medium for going abroad?', 'When should my child start IELTS preparation?', 'How much will it cost to send my child abroad in total (in BDT)?', 'What subjects build the best foundation for studying abroad?'],
    bn: ['বিদেশে পড়াশোনার জন্য ইংলিশ মিডিয়াম নাকি বাংলা মিডিয়াম কোনটা ভালো?', 'আমার সন্তানের আইইএলটিএস প্রস্তুতি কখন শুরু করা উচিত?', 'মোট কত টাকা লাগবে বিদেশে পড়াতে?', 'বিদেশে পড়াশোনার জন্য কোন বিষয়গুলো এখনই শুরু করা উচিত?']
  },
  2: {
    en: ['Based on my class 6–8 grades, which countries can I target?', 'What extracurriculars help most for foreign university admission?', 'O-Level vs SSC — which is better recognised abroad?', 'How do I build a strong profile at this age?'],
    bn: ['আমার ক্লাস ৬-৮ এর গ্রেড দিয়ে কোন দেশে পড়া সম্ভব?', 'কোন এক্সট্রা কারিকুলার কার্যক্রম বিদেশে ভর্তিতে সবচেয়ে বেশি কাজে লাগে?', 'বিদেশে পড়ার জন্য কি ও-লেভেল নাকি এসএসসি ভালো?', 'এই বয়সে কিভাবে ভালো প্রোফাইল তৈরি করব?']
  },
  3: {
    en: ['Based on my SSC/HSC result, which countries am I eligible for?', 'Do I need IELTS — and what score for which country?', 'Should I do foundation year or direct undergrad?', 'Which scholarships can I apply for with my grades?'],
    bn: ['আমার এসএসসি/এইচএসসি রেজাল্ট দিয়ে কোন দেশে আবেদন করতে পারব?', 'আমার কি আইইএলটিএস লাগবে — কোন দেশে কত স্কোর দরকার?', 'ফাউন্ডেশন ইয়ার নাকি সরাসরি আন্ডারগ্র্যাড — কোনটা ভালো?', 'আমার গ্রেড দিয়ে কোন স্কলারশিপে আবেদন করা যাবে?']
  },
  4: {
    en: ['Can I work part-time while studying — and how much can I earn?', 'What is the total cost of studying in UK/Australia/Canada in BDT?', 'What IELTS score do I need for which country?', 'What are my visa options and post-study work rights?'],
    bn: ['পড়াশোনার সময় কি পার্ট-টাইম কাজ করা যাবে? কত আয় হবে?', 'যুক্তরাজ্য/অস্ট্রেলিয়া/কানাডায় মোট খরচ কত (বাংলাদেশি টাকায়)?', 'কোন দেশে কত আইইএলটিএস স্কোর লাগবে?', 'পড়াশোনার পর কোন দেশে থাকার সুযোগ বেশি?']
  },
  5: {
    en: ['Taught Masters or Research Masters — which suits me better?', 'Which scholarships are available for Bangladeshi Masters students?', 'How do I write a strong SOP for Masters application?', 'Low CGPA — can I still get into a good Masters programme?'],
    bn: ['টট মাস্টার্স নাকি রিসার্চ মাস্টার্স — কোনটা আমার জন্য ভালো?', 'বাংলাদেশি মাস্টার্স শিক্ষার্থীদের জন্য কোন স্কলারশিপ আছে?', 'মাস্টার্স আবেদনের জন্য শক্তিশালী এসওপি কিভাবে লিখব?', 'সিজিপিএ কম হলে কি ভালো মাস্টার্স প্রোগ্রামে সুযোগ আছে?']
  },
  6: {
    en: ['How do I find a PhD supervisor who will accept me?', 'Which fully funded PhD scholarships accept Bangladeshi students?', 'How do I write a cold email to a professor?', 'How do I write a strong research proposal?'],
    bn: ['আমাকে গ্রহণ করবেন এমন পিএইচডি সুপারভাইজার কিভাবে খুঁজব?', 'বাংলাদেশি শিক্ষার্থীদের জন্য কোন ফুলি ফান্ডেড পিএইচডি স্কলারশিপ আছে?', 'প্রফেসরকে কোল্ড ইমেইল কিভাবে লিখব?', 'শক্তিশালী রিসার্চ প্রপোজাল কিভাবে তৈরি করব?']
  },
  7: {
    en: ['What is the total cost in BDT to send my child abroad for 3–4 years?', 'Which country is safest and most affordable for Bangladeshi students?', 'Can I visit my child while they study abroad?', 'Will their foreign degree be recognised when they return to Bangladesh?'],
    bn: ['৩-৪ বছর বিদেশে পড়াতে মোট কত টাকা লাগবে?', 'বাংলাদেশি শিক্ষার্থীদের জন্য কোন দেশ সবচেয়ে নিরাপদ এবং সাশ্রয়ী?', 'সন্তানের পড়াশোনার সময় কি আমি সেখানে যেতে পারব?', 'বিদেশি ডিগ্রি কি বাংলাদেশে স্বীকৃত হবে?']
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. OPTIONAL AD BANNERS
// ═══════════════════════════════════════════════════════════════════════════
const ADS_ENABLED = true;
const AD_SLOTS = [
  {
    id: 'promo_structured',
    trigger: 4,
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
let memory     = [];
let isTyping   = false;
let isOnline   = navigator.onLine;
let aiMsgCount   = 0;
let userMsgCount = 0;

const FREE_MSG_LIMIT = 10;

function getAnonymousUserId() {
  const existing = localStorage.getItem('ppl_uid');

  if (existing && /^anon_[A-Za-z0-9_-]{16,100}$/.test(existing)) {
    return existing;
  }

  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  const id = 'anon_' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  localStorage.setItem('ppl_uid', id);
  return id;
}

const userId = getAnonymousUserId();
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
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\[([^\]]*(?:www\.|https?:\/\/)[^\]]+)\]/g, (_, url) => {
      const href = url.startsWith('http') ? url : 'https://' + url;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    })
    .replace(/(?<!href=")(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

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
// 6. MESSAGE RENDERING (Premium: avatars + streaming cursor)
// ═══════════════════════════════════════════════════════════════════════════
function addMessage(role, text, streaming = false) {
  // Remove empty state if present
  const empty = els.messages.querySelector('.empty-state');
  if (empty) empty.remove();

  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;

  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'assistant' ? 'P' : (lang === 'bn' ? 'আ' : 'U');
  avatar.title = role === 'assistant' ? 'Peopole AI' : 'You';

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
  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;

  return { wrap, textEl, bubble };
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

// Intelligent suggested replies under AI messages
function addSuggestedReplies(bubbleEl, aiText) {
  const suggestions = [];
  const lower = (aiText || '').toLowerCase();

  if (lower.includes('country') || lower.includes('দেশ') || lower.includes('canada') || lower.includes('uk') || lower.includes('australia') || lower.includes('germany')) {
    suggestions.push(lang === 'bn' ? 'কানাডা vs যুক্তরাজ্য — কোনটা ভালো?' : 'Canada vs UK — which is better for me?');
    suggestions.push(lang === 'bn' ? 'খরচের তুলনা দেখাও' : 'Show me a cost comparison');
  }
  if (lower.includes('ielts') || lower.includes('আইইএলটিএস') || lower.includes('toefl') || lower.includes('pte')) {
    suggestions.push(lang === 'bn' ? 'আমার স্কোর দিয়ে কোন দেশে যাওয়া যাবে?' : 'Which countries accept my IELTS score?');
  }
  if (lower.includes('sop') || lower.includes('এসওপি') || lower.includes('statement of purpose')) {
    suggestions.push(lang === 'bn' ? 'এসওপি এর খসড়া লিখে দাও' : 'Help me draft an SOP outline');
  }
  if (lower.includes('scholarship') || lower.includes('বৃত্তি') || lower.includes('funding')) {
    suggestions.push(lang === 'bn' ? 'ফুলি ফান্ডেড অপশনগুলো বলো' : 'Show fully-funded options');
  }
  if (lower.includes('visa') || lower.includes('ভিসা')) {
    suggestions.push(lang === 'bn' ? 'ভিসা রিজেকশনের কারণ কী?' : 'What are common visa rejection reasons?');
  }

  // Always useful forward paths
  suggestions.push(lang === 'bn' ? 'পরবর্তী ধাপ কী?' : 'What should be my next step?');
  suggestions.push(lang === 'bn' ? 'হোয়াটসঅ্যাপে কথা বলি' : 'Talk on WhatsApp');

  if (!suggestions.length) return;

  // Remove existing suggested replies in this bubble
  const old = bubbleEl.querySelector('.suggested-replies');
  if (old) old.remove();

  const container = document.createElement('div');
  container.className = 'suggested-replies';
  suggestions.slice(0, 3).forEach(s => {
    const chip = document.createElement('button');
    chip.className = 'suggested-chip';
    chip.textContent = s;
    chip.onclick = () => {
      if (els.messageInput) {
        els.messageInput.value = s;
        sendMessage();
      }
    };
    container.appendChild(chip);
  });
  bubbleEl.appendChild(container);
}

// Beautiful empty / welcome state
function renderEmptyState() {
  if (!els.messages || els.messages.children.length > 0) return;

  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <div class="empty-logo"><img src="/logo.jpg" alt="Peopole AI"/></div>
    <div class="empty-title">${LANG[lang].chatTitle}</div>
    <div class="empty-sub">${lang === 'bn'
      ? 'আপনার একাডেমিক যাত্রার ব্যক্তিগত গাইড। স্টেজ বেছে নিন বা সরাসরি প্রশ্ন করুন।'
      : 'Your personal academic amplifier. Select a stage or ask anything.'}</div>
    <div class="empty-stages" id="emptyStages"></div>
  `;
  els.messages.appendChild(div);

  const stagesContainer = div.querySelector('#emptyStages');
  const stageData = [
    { id: 1, icon: '🌱', name: lang === 'bn' ? 'ফাউন্ডেশন' : 'Foundation', range: 'Pre–Class 5' },
    { id: 2, icon: '🔍', name: lang === 'bn' ? 'ডেভেলপমেন্ট' : 'Development', range: 'Class 6–8' },
    { id: 3, icon: '🎯', name: lang === 'bn' ? 'স্ট্র্যাটেজিক' : 'Strategic', range: 'Class 9–12' },
    { id: 4, icon: '🎓', name: lang === 'bn' ? 'আন্ডারগ্র্যাড' : 'Undergraduate', range: 'Bachelor\'s' },
    { id: 5, icon: '🔬', name: lang === 'bn' ? 'মাস্টার্স' : 'Master\'s', range: 'Postgraduate' },
    { id: 6, icon: '🏛️', name: lang === 'bn' ? 'ডক্টরাল' : 'Doctoral', range: 'PhD' },
    { id: 7, icon: '👨‍👩‍👧', name: lang === 'bn' ? 'পেরেন্ট মোড' : 'Parent Mode', range: 'For Parents' }
  ];

  stageData.forEach(s => {
    const card = document.createElement('div');
    card.className = 'empty-stage-card';
    card.innerHTML = `
      <div class="empty-stage-icon">${s.icon}</div>
      <div class="empty-stage-name">${s.name}</div>
      <div class="empty-stage-range">${s.range}</div>
    `;
    card.onclick = () => selectStage(s.id);
    stagesContainer.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. SEND MESSAGE (with live streaming cursor)
// ═══════════════════════════════════════════════════════════════════════════
async function sendMessage() {
  const input = els.messageInput;
  const text  = input.value.trim();
  if (!text || isTyping) return;

  if (!isOnline) {
    addMessage('assistant', LANG[lang].offlineMsg);
    return;
  }

  // Free message limit
  if (userMsgCount >= FREE_MSG_LIMIT) {
    const limitMsg = lang === 'bn'
      ? `🔒 **আপনি বিনামূল্যে ${FREE_MSG_LIMIT}টি বার্তার সীমায় পৌঁছেছেন।**\n\nআরও সহায়তার জন্য আমাদের হোয়াটসঅ্যাপে যোগাযোগ করুন অথবা একটি পরিষেবা পরিকল্পনা বেছে নিন:\n📱 [WhatsApp করুন →](https://wa.me/8801535778111?text=আমি+আরও+সাহায্য+চাই)\n💰 [সেবা পরিকল্পনা দেখুন →](/pricing.html)`
      : `🔒 **You've reached the ${FREE_MSG_LIMIT}-message free limit for this session.**\n\nTo continue getting expert guidance, contact us or choose a service plan:\n📱 [WhatsApp Us →](https://wa.me/8801535778111?text=I+need+more+guidance)\n💰 [View Service Plans →](/pricing.html)`;
    addMessage('assistant', limitMsg);
    if (els.messageInput) els.messageInput.disabled = true;
    if (els.sendBtn)      els.sendBtn.disabled = true;
    return;
  }

  addMessage('user', text);
  memory.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';
  userMsgCount++;

  isTyping = true;
  if (els.sendBtn) els.sendBtn.disabled = true;
  const { wrap: typingWrap, textEl: typingEl, bubble: typingBubble } = addMessage('assistant', '', true);

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

    if (response.status === 429 || response.status === 403) {
      typingWrap.remove();

      let message = LANG[lang].errorMsg;

      try {
        const data = await response.clone().json();
        if (data && typeof data.error === 'string' && data.error.trim()) {
          message = data.error;
        }
      } catch {
        // Preserve the localized fallback when the response is not JSON.
      }

      addMessage('assistant', message);
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Chat response body is unavailable');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let firstChunk = true;
    let sseBuffer = '';

    const processSSE = rawEvent => {
      const payload = rawEvent
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('\n')
        .trim();

      if (!payload || payload === '[DONE]') return;

      const parsed = JSON.parse(payload);

      if (parsed.error) {
        throw new Error(parsed.error);
      }

      const token = parsed.choices?.[0]?.delta?.content || '';

      if (!token) return;

      if (firstChunk) {
        typingEl.classList.remove('typing');
        typingEl.innerHTML = '';
        firstChunk = false;
      }

      fullText += token;

      // Live streaming cursor
      typingEl.innerHTML =
        renderMarkdown(fullText) +
        '<span class="stream-cursor"></span>';

      els.messages.scrollTop = els.messages.scrollHeight;
    };

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });

      const events = sseBuffer.split('\n\n');
      sseBuffer = events.pop() || '';

      for (const event of events) {
        if (!event.trim()) continue;
        processSSE(event);
      }
    }

    // Flush any incomplete UTF-8 sequence.
    sseBuffer += decoder.decode();

    // Process final SSE event if the server closed without a trailing
    // blank line.
    if (sseBuffer.trim()) {
      processSSE(sseBuffer);
    }

    // Final render without cursor
    if (fullText) {
      typingEl.innerHTML = renderMarkdown(fullText);
      memory.push({ role: 'assistant', content: fullText });
      aiMsgCount++;
      maybeShowAd();
      // Intelligent suggested replies
      addSuggestedReplies(typingBubble, fullText);
    } else {
      typingWrap.remove();
      addMessage('assistant', LANG[lang].errorMsg);
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
  stage = Number(s);
  const name = LANG[lang].stageNames[stage];
  if (els.stageBadge)     els.stageBadge.textContent = name;
  if (els.stageBadgeWrap) els.stageBadgeWrap.style.display = 'flex';
  hideStageModal();
  buildFAQPanel();

  // Clear empty state and show a short confirmation
  const empty = els.messages.querySelector('.empty-state');
  if (empty) empty.remove();

  const confirm = lang === 'bn'
    ? `✅ **${name}** নির্বাচিত হয়েছে। এখন আপনার প্রশ্ন জিজ্ঞাসা করুন বা নিচের সাধারণ প্রশ্নগুলো ব্যবহার করুন।`
    : `✅ **${name}** selected. Ask me anything or use the common questions below.`;
  addMessage('assistant', confirm);

  trackEvent('stage_selected', { stage, lang });
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
  if (panel) {
    panel.style.display = faqOpen ? 'flex' : 'none';
    panel.classList.toggle('open', faqOpen);
  }
  if (arrow) arrow.textContent = faqOpen ? '▴' : '▾';
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

  // Refresh empty state language if visible
  const empty = els.messages.querySelector('.empty-state');
  if (empty) {
    els.messages.innerHTML = '';
    renderEmptyState();
  }

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
    const keyRes = await fetch('/api/push/vapid-public-key');

    if (!keyRes.ok) {
      throw new Error(`VAPID public-key request failed: HTTP ${keyRes.status}`);
    }

    const { key } = await keyRes.json();

    if (!key || typeof key !== 'string' || key.startsWith('REPLACE')) {
      console.warn('[Push] VAPID not configured on server');
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });

    pushSubscription = sub;

    const pushResponse = await fetch('/api/push/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription: sub, userId, stage, lang })
    });

    if (!pushResponse.ok) {
      throw new Error(
        `Push subscription failed: HTTP ${pushResponse.status}`
      );
    }

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
// 13. ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════
function trackEvent(name, meta) {
  // no-op: analytics stubs optional; avoid client dependency
}
function trackPageview() {
  // no-op: analytics stubs optional; avoid client dependency
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. CLEAR CONVERSATION
// ═══════════════════════════════════════════════════════════════════════════
function clearConversation() {
  if (els.messages) {
    els.messages.innerHTML = '';
    memory = [];
    aiMsgCount = 0;
    userMsgCount = 0;
    if (els.messageInput) els.messageInput.disabled = false;
    if (els.sendBtn) els.sendBtn.disabled = false;
  }
  renderEmptyState();
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
// 17. ONLINE / OFFLINE
// ═══════════════════════════════════════════════════════════════════════════
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  if (els.offlineBar) els.offlineBar.style.display = isOnline ? 'none' : 'flex';
  if (els.statusDot) {
    els.statusDot.classList.toggle('offline', !isOnline);
    els.statusDot.title = isOnline ? 'Online' : 'Offline';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 18. INIT
// ═══════════════════════════════════════════════════════════════════════════
function init() {
  // Stage cards
  document.querySelectorAll('.stage-card').forEach(card => {
    card.addEventListener('click', () => {
      const s = card.getAttribute('data-stage');
      if (s) selectStage(s);
    });
  });

  // Buttons
  if (els.sendBtn)      els.sendBtn.addEventListener('click', sendMessage);
  if (els.langBtn)      els.langBtn.addEventListener('click', () => setLang(lang === 'en' ? 'bn' : 'en'));
  if (els.clearBtn)     els.clearBtn.addEventListener('click', clearConversation);
  if (els.newChatBtn)   els.newChatBtn.addEventListener('click', () => {
    clearConversation();
    stage = null;
    if (els.stageBadgeWrap) els.stageBadgeWrap.style.display = 'none';
    showStageModal();
  });
  if (els.stageChangeBtn) els.stageChangeBtn.addEventListener('click', showStageModal);
  if (els.menuBtn)      els.menuBtn.addEventListener('click', toggleSidebar);
  if (els.overlay)      els.overlay.addEventListener('click', closeSidebar);

  // Textarea
  if (els.messageInput) {
    els.messageInput.addEventListener('input', autoResize);
    els.messageInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Online status
  window.addEventListener('online',  updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // Initial empty state + stage modal
  renderEmptyState();
  showStageModal();

  // Analytics + Push
  trackPageview();
  // initPush(); // disabled until push fully configured on Vercel

  // Focus
  if (els.messageInput) els.messageInput.focus();
}

document.addEventListener('DOMContentLoaded', init);